import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { createHeader, fetchNextGateNumber, fetchPurchaseOrderByNumber, fetchPurchaseOrderSuggestions, updateHeaderByKey, fetchGateEntryByNumber, fetchGateEntriesByPO, fetchSupplierCustomerDetails, fetchTransporters } from "../../api";
import { useLocation, useNavigate } from "react-router-dom";
import "./CreateHeader.css";

export default function CreateHeader() {
    // State to control manual transporter selection
    const [autoTransporter, setAutoTransporter] = useState(false);
  // Supplier list state
  const [allSuppliers, setAllSuppliers] = useState([]);
  // Transporter list state
  const [allTransporters, setAllTransporters] = useState([]);
  // Track if we are editing an existing entry
  const [isUpdateMode, setIsUpdateMode] = useState(false);

  // Fetch supplier/customer list and transporter list on mount
  useEffect(() => {
    async function fetchSuppliers() {
      try {
        const resp = await fetchSupplierCustomerDetails("");
        const list = resp.data?.suppliers || resp.suppliers || [];
        setAllSuppliers(list);
      } catch (err) {
        setAllSuppliers([]);
      }
    }
    async function loadTransporters() {
      try {
        const resp = await fetchTransporters();
        const list = resp?.data?.results || resp?.results || [];
        setAllTransporters(Array.isArray(list) ? list : []);
      } catch (err) {
        setAllTransporters([]);
        console.error('Transporter fetch error:', err);
      }
    }
    fetchSuppliers();
    loadTransporters();
  }, []);

  // Helper: Get SupplierName by Vendor code (Vendor = Supplier)
  function getSupplierNameByNumber(suppliers, vendorCode) {
    if (!Array.isArray(suppliers) || !vendorCode) return '';
    const code = String(vendorCode).trim();
    const found = suppliers.find(s => s && (String(s.Supplier).trim() === code));
    return found && found.SupplierName ? found.SupplierName : '';
  }
    const [loadedUUID, setLoadedUUID] = useState(null);

  // Financial year rule: Apr-Mar maps to the ending year.
  // Example: Apr 2025 - Mar 2026 => FiscalYear 2026.
  const getFiscalYear = (dateLike) => {
    if (!dateLike) return String(new Date().getFullYear());
    const d = dateLike instanceof Date ? dateLike : new Date(`${dateLike}T00:00:00`);
    if (Number.isNaN(d.getTime())) return String(new Date().getFullYear());
    const month = d.getMonth();
    const year = d.getFullYear();
    return String(month >= 3 ? year + 1 : year);
  };

  const currentDate = new Date().toISOString().split('T')[0];
  const currentYear = getFiscalYear(currentDate);

  // Create initial state function
  const createInitialHeaderState = () => {
    const initialState = {
      GateEntryNumber: "",
      GateEntryDate: currentDate,
      Indicators: "I",
      VehicleStatus: "IN",
      VehicleNumber: "",
      TransporterCode: "",
      TransporterName: "",
      DriverName: "",
      DriverPhoneNumber: "",
      DrivingLicenseNumber: "",
      DLNumber: "",
      LRGCNumber: "",
      PermitNumber: "",
      EWayBill: false,
      Division: "",
      Remarks: "",
      SubTransporterName: "",
      FiscalYear: currentYear,
      InwardTime: new Date().toISOString().includes('T')
        ? `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}:${new Date().getSeconds().toString().padStart(2, '0')}`
        : '',
      OutwardTime: "",
      SAP_CreatedDateTime: new Date().toISOString(),
    };

    for (let i = 1; i <= 5; i++) {
      const suffix = i === 1 ? "" : String(i);
      initialState[`PurchaseOrderNumber${suffix}`] = "";
      initialState[`PurchaseOrderItem${suffix}`] = "";
      initialState[`Material${suffix}`] = "";
      initialState[`MaterialDescription${suffix}`] = "";
      initialState[`Vendor${suffix}`] = "";
      initialState[`VendorName${suffix}`] = "";
      initialState[`VendorInvoiceNumber${suffix}`] = "";
      initialState[`VendorInvoiceDate${suffix}`] = "";
      initialState[`VendorInvoiceWeight${suffix}`] = "";
      initialState[`BalanceQty${suffix}`] = "";
    }

    return initialState;
  };

  const [header, setHeader] = useState(createInitialHeaderState());
  const [series, setSeries] = useState("2");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [poLoading, setPoLoading] = useState({});
  const [lastCreated, setLastCreated] = useState(null);
  const [visiblePOSections, setVisiblePOSections] = useState(1);
  

  // PO dropdown state
  const [poDropdown, setPoDropdown] = useState({
    show: false,
    poList: [],
    suffix: '',
    searchQuery: '',
    loading: false
    // selectedPO: null
  });

  const [poItemsModal, setPoItemsModal] = useState({
    show: false,
    items: [],
    suffix: '',
    poNumber: '',
    headerData: null
  });

  // Refs for debouncing
  const searchTimeoutRef = useRef(null);

  // Helper functions
  const formatTimeToSapDuration = (date = new Date()) => {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `PT${hh}H${mm}M${ss}S`;
  };

  const nowIso = (date = new Date()) => date.toISOString();

  // Enhanced handleChange to sync transporter code/name
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Transporter Code dropdown
    if (name === 'TransporterCode') {
      // Find transporter by code
      const found = allTransporters.find(t => String(t.TransporterCode).trim() === String(value).trim());
      setHeader(prev => ({
        ...prev,
        TransporterCode: value,
        TransporterName: found ? found.TransporterName : ''
      }));
      return;
    }
    // Transporter Name dropdown
    if (name === 'TransporterName') {
      // Find transporter by name
      const found = allTransporters.find(t => String(t.TransporterName).trim() === String(value).trim());
      setHeader(prev => ({
        ...prev,
        TransporterName: value,
        TransporterCode: found ? found.TransporterCode : ''
      }));
      return;
    }

    // Driver Phone - only digits, max 10
    if (name === 'DriverPhoneNumber') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
      setHeader(prev => ({ ...prev, [name]: digitsOnly }));
      return;
    }

    // Numeric fields - only numbers and decimal
    if (name.includes('VendorInvoiceWeight') || name.includes('BalanceQty')) {
      if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
        setHeader(prev => ({ ...prev, [name]: value }));
      }
      return;
    }

    // Vendor Invoice Number - alphanumeric
    if (name.includes('VendorInvoiceNumber')) {
      setHeader(prev => ({ ...prev, [name]: value }));
      return;
    }

    // Vendor Invoice Date - allow date format
    if (name.includes('VendorInvoiceDate')) {
      setHeader(prev => ({ ...prev, [name]: value }));
      return;
    }

    // Character-only fields (names)
    if (name === 'DriverName' || name === 'SubTransporterName') {
      const charsOnly = value.replace(/[0-9]/g, '');
      setHeader(prev => ({ ...prev, [name]: charsOnly }));
      return;
    }

    // Default handling
    setHeader(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  // ============================================
  // NEW: Enhanced PO Number Change Handler (Live filtering only)
  const handlePONumberChange = (e, suffix) => {
    const { value } = e.target;
    const poFieldName = `PurchaseOrderNumber${suffix}`;
    setHeader(prev => ({ ...prev, [poFieldName]: value }));

    if (!value || value.trim() === '') {
      setPoDropdown({ show: false, poList: [], suffix: '', searchQuery: '', loading: false });
      return;
    }

    // Debounce
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      fetchAndShowPODropdown(value, suffix);
    }, 300);
  };

  // NEW: Handle Enter key for PO validation
  const handlePOEnter = async (poNumber, suffix) => {
    if (!poNumber) return;
    try {
      const response = await fetchPurchaseOrderByNumber(poNumber);
      const poData = response.data;
      // NOW apply validation
      if (poData.PurchasingProcessingStatus !== '05') {
        setError(`PO ${poNumber} is not approved.`);
        clearPOFields(suffix);
        return;
      }
      // If approved → show items
      fetchAndShowPOItems(poNumber, suffix, false);
    } catch (err) {
      setError('Error validating PO');
    }
  };


  // ============================================
  // NEW: Function to fetch and show PO dropdown
  // ============================================
  const fetchAndShowPODropdown = async (query, suffix) => {
    setPoDropdown(prev => ({ ...prev, loading: true, show: true, suffix, searchQuery: query }));
    try {
      const response = await fetchPurchaseOrderSuggestions(query);
      // Live filter: show all POs containing query, regardless of status
      const allPOs = response.data.items || [];
      const filteredPOs = allPOs.filter(po => String(po.PurchaseOrder || '').includes(query));
      setPoDropdown(prev => ({ ...prev, poList: filteredPOs, loading: false, show: true, suffix, searchQuery: query }));
      // Do not set error or clear fields if no match; just show empty list
    } catch (err) {
      setPoDropdown(prev => ({ ...prev, show: false, poList: [], loading: false }));
      // Only show error if fetch fails, not for filtering or status
      setError('Error fetching PO suggestions.');
      // Do not clear PO fields on fetch error
    }
  };

  // ============================================
  // NEW: Function to fetch and show PO line items
  // ============================================
  const fetchAndShowPOItems = async (poNumber, suffix, shouldUpdateField = false) => {
    try {
      if (shouldUpdateField) {
        setHeader(prev => ({ 
          ...prev, 
          [`PurchaseOrderNumber${suffix}`]: poNumber 
        }));
      }

      // Fetch PO details (line items)
      const response = await fetchPurchaseOrderByNumber(poNumber);
      const poData = response.data;
      const items = poData.items || [];

      // Fetch all gate entries for this PO
      const gateEntriesResp = await fetchGateEntriesByPO(poNumber);
      const gateEntries = (gateEntriesResp.data?.d?.results || gateEntriesResp.data?.value || []);

      // Build a map: { key: PO__Material__ItemNo, value: totalUsedQty }
      const usedQtyMap = {};
      gateEntries.forEach(entry => {
        for (let i = 1; i <= 5; i++) {
          const s = i === 1 ? '' : String(i);
          const po = entry[`PurchaseOrderNumber${s}`];
          const itemNo = entry[`PurchaseOrderItem${s}`];
          const used = Number(entry[`VendorInvoiceWeight${s}`]) || 0;
          if (po && itemNo && used > 0) {
            const key = `${po}__${itemNo}`;
            usedQtyMap[key] = (usedQtyMap[key] || 0) + used;
          }
        }
      });

      // Attach usedQty to each item
      const itemsWithUsed = items.map(item => {
        const itemNo = item.PurchaseOrderItem || item.purchaseOrderItem || '';
        const key = `${poNumber}__${itemNo}`;
        const orderQty = Number(item.OrderQuantity || item.orderQuantity) || 0;
        const usedQty = usedQtyMap[key] || 0;
        const remaining = orderQty - usedQty;
        return { ...item, _usedQty: usedQty, _remaining: remaining };
      });

      setPoItemsModal({
        show: true,
        items: itemsWithUsed,
        suffix: suffix,
        poNumber: poNumber,
        headerData: poData
      });
    } catch (err) {
      console.error('Error fetching PO details:', err);
      const errorMsg = err?.response?.data?.error || err?.message || 'Failed to fetch PO details';
      alert(`Error loading PO: ${errorMsg}`);
      clearPOFields(suffix);
    }
  };

  // ============================================
  // NEW: Handle PO selection from dropdown
  // ============================================
  const handleSelectPOFromDropdown = async (selectedPO) => {
    // Only apply status check on selection
    try {
      const response = await fetchPurchaseOrderByNumber(selectedPO.PurchaseOrder);
      const poData = response.data;
      if (poData.PurchasingProcessingStatus !== '05') {
        setError(`PO ${selectedPO.PurchaseOrder} is not approved.`);
        clearPOFields(poDropdown.suffix);
        setPoDropdown({ show: false, poList: [], suffix: '', searchQuery: '', loading: false });
        return;
      }
      setHeader(prev => ({
        ...prev,
        [`PurchaseOrderNumber${poDropdown.suffix}`]: selectedPO.PurchaseOrder
      }));
      setPoDropdown({ show: false, poList: [], suffix: '', searchQuery: '', loading: false });
      fetchAndShowPOItems(selectedPO.PurchaseOrder, poDropdown.suffix, false);
    } catch (err) {
      setError('Error validating PO');
    }
  };

  // ============================================
  // Helper Functions
  // ============================================
  const clearPOFields = (suffix) => {
    const fieldsToClear = [
      'PurchaseOrderItem','Material', 'MaterialDescription', 'Vendor', 'VendorName',
      'BalanceQty', 'VendorInvoiceNumber', 'VendorInvoiceDate', 'VendorInvoiceWeight'
    ];
    
    const updates = {};
    fieldsToClear.forEach(field => {
      updates[`${field}${suffix}`] = '';
    });
    
    setHeader(prev => ({ ...prev, ...updates }));
  };

  const fillPOFields = (suffix, item, headerData) => {
    // Always get supplier code from headerData, then get name from allSuppliers
    const supplierCode = headerData?.Supplier || headerData?.supplier || '';
    const supplierName = getSupplierNameByNumber(allSuppliers, supplierCode);

    const purchaseOrderItem = item.PurchaseOrderItem || item.purchaseOrderItem || '';
    const material = item.Material || item.material || '';
    const materialDesc = item.PurchaseOrderItemText || item.MaterialDescription || item.materialDescription || '';
    const orderQtyNum = toNum(item.OrderQuantity || item.orderQuantity);
    // Always use the latest _remaining from the item (calculated in fetchAndShowPOItems)
    const latestRemaining = Number.isFinite(item._remaining) ? item._remaining : (Number.isFinite(orderQtyNum) ? orderQtyNum : '');

    setHeader(prev => {
      const poNo = prev[`PurchaseOrderNumber${suffix}`] || headerData?.PurchaseOrder || '';
      return {
        ...prev,
        [`PurchaseOrderItem${suffix}`]: purchaseOrderItem,
        [`Material${suffix}`]: material,
        [`MaterialDescription${suffix}`]: materialDesc,
        [`Vendor${suffix}`]: supplierCode,
        [`VendorName${suffix}`]: supplierName,
        // Always update BalanceQty from latestRemaining
        [`BalanceQty${suffix}`]: latestRemaining === 0 ? '' : String(latestRemaining || ''),
        // Fill Division and PermitNumber from PO item
        Division: item.Plant || item.plant || prev.Division,
        PermitNumber: item.YY1_PERMITNUMBER_PDI || prev.PermitNumber,
      };
    });
  };

  const handleSelectPOItem = (item) => {
    fillPOFields(poItemsModal.suffix, item, poItemsModal.headerData);
    setPoItemsModal({ show: false, items: [], suffix: '', poNumber: '', headerData: null });

    // Fetch pricing element for selected PO
    const poNumber = poItemsModal.poNumber;
    if (poNumber) {
      axios.get(`http://localhost:4600/api/po/pricing?poNumber=${poNumber}`, {
        headers: {
          "Accept": "application/json",
        },
      }).then(res => {
        const pricingData = res.data.value || [];
        const freightSupplier = pricingData.find(item => item.FreightSupplier && item.FreightSupplier !== "");
        if (freightSupplier) {
          setHeader(prev => ({ ...prev, TransporterCode: freightSupplier.FreightSupplier }));
          setAutoTransporter(true);
        } else {
          setAutoTransporter(false);
        }
      }).catch(() => {
        setAutoTransporter(false);
      });
    }
  };

  const closePOListModal = () => {
    setPoSelectionModal({ show: false, poList: [], suffix: '', searchQuery: '', loading: false });
  };

  const closePOItemsModal = () => {
    setPoItemsModal({ show: false, items: [], suffix: '', poNumber: '', headerData: null });
  };

  // Add PO Section handler
  const handleAddPOSection = () => {
    if (visiblePOSections < 5) {
      setVisiblePOSections(prev => prev + 1);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Rest of your existing code (transformDataForAPI, handleSubmit, etc.)
  // ============================================
  // [Keep all your existing functions below - they remain the same]
  // ============================================

  const transformDataForAPI = (data) => {
    const transformed = { ...data };

    const normalizeDecimalString = (val) => {
      if (val === '' || val === null || val === undefined) return null;
      const s = String(val).trim().replace(/,/g, '');
      const normalized = s.replace(/\s+/g, '').replace(',', '.');
      if (/^-?\d+(\.\d+)?$/.test(normalized)) {
        return normalized;
      }
      return null;
    }; 

    for (let i = 1; i <= 5; i++) {
      const suffix = i === 1 ? "" : String(i);
      const weightField = `VendorInvoiceWeight${suffix}`;
      const qtyField = `BalanceQty${suffix}`;
      transformed[weightField] = normalizeDecimalString(transformed[weightField]);
      transformed[qtyField] = normalizeDecimalString(transformed[qtyField]);
    }

    transformed.EWayBill = Boolean(transformed.EWayBill);
    return transformed;
  };

  const hhmmssToSapDuration = (val) => {
    if (!val) return null;
    if (typeof val === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(val)) {
      const [h, m, s] = val.split(':').map(v => parseInt(v, 10));
      return `PT${h}H${m}M${s}S`;
    }
    if (val instanceof Date) {
      return formatTimeToSapDuration(val);
    }
    return String(val);
  };

  const extractErrorMessage = (err) => {
    const resp = err?.response?.data;
    if (!resp) return err?.message || 'Unknown error occurred';

    // Handle XML errors from SAP
    if (typeof resp === 'string') {
      // Check if it's XML
      if (resp.trim().startsWith('<?xml') || resp.includes('<error>')) {
        try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(resp, 'text/xml');
          
          // Try to extract error message from common XML structures
          const errorMsg = xmlDoc.querySelector('message')?.textContent || 
                          xmlDoc.querySelector('error')?.textContent ||
                          xmlDoc.querySelector('errordetails')?.textContent;
          
          if (errorMsg) {
            return formatUserFriendlyError(errorMsg);
          }
        } catch (xmlErr) {
          console.error('XML parsing error:', xmlErr);
        }
      }
      return formatUserFriendlyError(resp);
    }

    // Handle nested SAP error structures
    let errorMessage = '';
    
    // Deep nested structure: error.error.message.value
    if (resp.error?.error?.message?.value) {
      errorMessage = resp.error.error.message.value;
    }
    // Standard nested: error.message.value
    else if (resp.error?.message?.value) {
      errorMessage = resp.error.message.value;
    }
    // String error message
    else if (typeof resp.error === 'string') {
      errorMessage = resp.error;
    }
    // Direct error.message
    else if (resp.error?.message && typeof resp.error.message === 'string') {
      errorMessage = resp.error.message;
    }
    // Response message
    else if (resp.message && typeof resp.message === 'string') {
      errorMessage = resp.message;
    }
    // Error details array
    else if (resp.errordetails && Array.isArray(resp.errordetails) && resp.errordetails.length > 0) {
      errorMessage = resp.errordetails.map(detail => 
        detail.message || detail.value || JSON.stringify(detail)
      ).join('; ');
    }
    
    if (errorMessage) {
      return formatUserFriendlyError(errorMessage);
    }

    // Fallback: try to extract any meaningful info
    try {
      return 'Error: ' + JSON.stringify(resp, null, 2).substring(0, 500);
    } catch {
      return 'An unexpected error occurred. Please contact support.';
    }
  };

  const formatUserFriendlyError = (technicalError) => {
    if (!technicalError) return 'An error occurred';

    const errorStr = String(technicalError);

    // Common SAP error patterns and their user-friendly versions
    const errorPatterns = [
      {
        pattern: /property\s+'(\w+)'\s+at\s+offset\s+'(\d+)'\s+has\s+invalid\s+value\s+'([^']+)'/i,
        format: (match) => `Invalid value "${match[3]}" for field ${formatFieldName(match[1])}. Please check and correct this field.`
      },
      {
        pattern: /mandatory\s+field\s+'?(\w+)'?\s+is\s+missing/i,
        format: (match) => `Required field ${formatFieldName(match[1])} is missing. Please fill in this field.`
      },
      {
        pattern: /field\s+'?(\w+)'?\s+is\s+required/i,
        format: (match) => `Required field ${formatFieldName(match[1])} is missing. Please fill in this field.`
      },
      {
        pattern: /value\s+'([^']+)'\s+of\s+field\s+'?(\w+)'?\s+is\s+invalid/i,
        format: (match) => `Invalid value "${match[1]}" for ${formatFieldName(match[2])}. Please check the format.`
      },
      {
        pattern: /duplicate\s+entry/i,
        format: () => 'This entry already exists. Please check the Gate Entry Number or Vehicle Number.'
      },
      {
        pattern: /purchase\s+order\s+(\d+)\s+does\s+not\s+exist/i,
        format: (match) => `Purchase Order ${match[1]} not found. Please verify the PO number.`
      },
      {
        pattern: /material\s+'?([^']+)'?\s+not\s+found/i,
        format: (match) => `Material ${match[1]} not found in the system. Please verify the material code.`
      },
      {
        pattern: /vendor\s+'?([^']+)'?\s+not\s+found/i,
        format: (match) => `Vendor ${match[1]} not found. Please verify the vendor code.`
      },
      {
        pattern: /quantity\s+exceeds\s+available/i,
        format: () => 'Quantity exceeds the available balance. Please check the order quantity.'
      },
      {
        pattern: /connection\s+(failed|refused|timeout)/i,
        format: () => 'Unable to connect to SAP. Please check your network connection and try again.'
      },
      {
        pattern: /unauthorized|forbidden|403/i,
        format: () => 'You do not have permission to perform this action. Please contact your administrator.'
      },
      {
        pattern: /timeout|timed\s+out/i,
        format: () => 'Request timed out. Please try again.'
      },
      {
        pattern: /internal\s+server\s+error|500/i,
        format: () => 'Server error occurred. Please try again later or contact support.'
      }
    ];

    // Check each pattern
    for (const { pattern, format } of errorPatterns) {
      const match = errorStr.match(pattern);
      if (match) {
        return format(match);
      }
    }

    // If no pattern matches, clean up technical jargon
    let cleanedError = errorStr
      .replace(/\/IWCOR\/[A-Z_]+\/[A-F0-9]+/g, '') // Remove SAP error codes
      .replace(/component_id[^,}]+/g, '')
      .replace(/service_namespace[^,}]+/g, '')
      .replace(/service_id[^,}]+/g, '')
      .replace(/transaction[^,}]+/g, '')
      .replace(/SAP_Transaction[^,}]+/g, '')
      .replace(/SAP_Note[^,}]+/g, '')
      .replace(/https?:\/\/[^\s,}"]+/g, '') // Remove URLs
      .replace(/\s+/g, ' ')
      .trim();

    // If cleaned error is too short or still technical, provide generic message
    if (cleanedError.length < 10 || cleanedError.includes('://')) {
      return 'An error occurred while processing your request. Please verify all fields and try again.';
    }

    return cleanedError.charAt(0).toUpperCase() + cleanedError.slice(1);
  };

  const formatFieldName = (fieldName) => {
    // Convert camelCase or technical field names to readable format
    const fieldNameMap = {
      'lrgcnumber': 'LR/GC Number',
      'vehiclenumber': 'Vehicle Number',
      'gateentrynumber': 'Gate Entry Number',
      'purchaseordernumber': 'Purchase Order Number',
      'vendorinvoicenumber': 'Vendor Invoice Number',
      'drivername': 'Driver Name',
      'transportercode': 'Transporter Code',
      'transportername': 'Transporter Name',
      'materialdescription': 'Material Description',
      'vendorname': 'Vendor Name',
      'balanceqty': 'Balance Quantity'
    };

    const lowerField = fieldName.toLowerCase();
    if (fieldNameMap[lowerField]) {
      return fieldNameMap[lowerField];
    }

    // Convert camelCase to readable: "someFieldName" -> "Some Field Name"
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    // Validation
    const validationErrors = [];

    // 1. At least one PO must be provided
    const hasPO = [1, 2, 3, 4, 5].some(i => {
      const suffix = i === 1 ? '' : String(i);
      return header[`PurchaseOrderNumber${suffix}`]?.trim();
    });
    
    if (!hasPO) {
      validationErrors.push('At least one Purchase Order is required to create a gate entry.');
      setError('At least one Purchase Order is required to create a gate entry.');
      setLoading(false);
      return;
    }

    // 2. Vehicle number must not contain spaces
    if (header.VehicleNumber && /\s/.test(header.VehicleNumber)) {
      validationErrors.push('Vehicle number must not contain spaces.');
    }

    // 3. PO Remaining qty checks
    for (let i = 1; i <= 5; i++) {
      const s = i === 1 ? '' : String(i);
      const poNo = header[`PurchaseOrderNumber${s}`];
      const itemNo = header[`PurchaseOrderItem${s}`];
      if (!poNo || !itemNo) continue;

      // Only use PO Number and PO Item for remaining
      const remaining = getRemainingFor(poNo, undefined, itemNo);
      const weight = toNum(header[`VendorInvoiceWeight${s}`]);

      if (Number.isFinite(remaining) && remaining < 0) {
        validationErrors.push(`PO ${poNo} / ${itemNo}: Remaining quantity is negative (${remaining}). Please check PO data.`);
      }
      if (Number.isFinite(remaining) && remaining === 0 && Number.isFinite(weight) && weight > 0) {
        validationErrors.push(`PO ${poNo} / ${itemNo} is fully used (remaining 0). Remove weight or choose another line.`);
      }
      if (Number.isFinite(remaining) && Number.isFinite(weight) && weight > remaining) {
        validationErrors.push(`PO ${poNo} / ${itemNo}: entered weight ${weight} exceeds remaining ${remaining}.`);
      }
    }
    if (validationErrors.length) {
      setError(validationErrors.join(' | '));
      setLoading(false);
      return;
    }

    try {
      let uuid = loadedUUID;
      // If update mode, use PATCH
      if (isUpdateMode && uuid) {
        // Prepare payload (do not send GateEntryNumber or UUID fields)
        const rawPayload = {
          ...header,
          GateEntryDate: `${header.GateEntryDate}T00:00:00`,
          InwardTime: hhmmssToSapDuration(header.InwardTime),
          OutwardTime: hhmmssToSapDuration(header.OutwardTime),
          SAP_CreatedDateTime: nowIso(),
          FiscalYear: header.FiscalYear || currentYear
        };
        delete rawPayload.GateEntryNumber;
        const payload = transformDataForAPI(rawPayload);
        // Use GateEntryNumber if available, else fallback to uuid
        const key = header.GateEntryNumber || uuid;
        const response = await updateHeaderByKey(key, payload);
        setResult('Gate entry updated successfully');
        setTimeout(() => setResult(null), 20000);
        setLoading(false);
        return;
      }

      // Else, create new (let backend generate GateEntryNumber)
      const inbound = header.InwardTime || `${new Date().getHours().toString().padStart(2,'0')}:${new Date().getMinutes().toString().padStart(2,'0')}:${new Date().getSeconds().toString().padStart(2,'0')}`;
      const outbound = header.OutwardTime || inbound;

      const rawPayload = {
        ...header,
        // SeriesCode removed as backend handles prefix logic
        GateEntryDate: `${header.GateEntryDate}T00:00:00`,
        InwardTime: hhmmssToSapDuration(header.InwardTime || inbound),
        OutwardTime: mode === "outward" ? hhmmssToSapDuration(outbound) : (header.OutwardTime ? hhmmssToSapDuration(header.OutwardTime) : null),
        SAP_CreatedDateTime: nowIso(),
        FiscalYear: header.FiscalYear || currentYear
      };

      // Ensure vendor invoice dates are properly formatted
      for (let i = 1; i <= 5; i++) {
        const suffix = i === 1 ? '' : String(i);
        const dateField = `VendorInvoiceDate${suffix}`;
        if (rawPayload[dateField]) {
          // If it's already a date string, keep it as is; otherwise format it
          if (!rawPayload[dateField].includes('T')) {
            rawPayload[dateField] = `${rawPayload[dateField]}T00:00:00`;
          }
        }
      }

      const payload = transformDataForAPI(rawPayload);
      console.debug('Sending payload', payload);

      const response = await createHeader(payload);
      // Get the generated GateEntryNumber from backend response
      const createdGateNumber = response.data?.d?.GateEntryNumber || response.data?.GateEntryNumber;
      setHeader(h => ({ ...h, GateEntryNumber: createdGateNumber }));
      setResult('Gate entry created successfully');

      setLastCreated({
        gateEntryNumber: createdGateNumber,
        date: header.GateEntryDate,
        vehicle: header.VehicleNumber
      });

      // Update remaining quantities
      for (let i = 1; i <= 5; i++) {
        const s = i === 1 ? '' : String(i);
        const poNo = header[`PurchaseOrderNumber${s}`];
        const material = header[`Material${s}`];
        const itemNo = header[`PurchaseOrderItem${s}`];
        if (!poNo || !material || !itemNo) continue;

        const prevRemainingStored = getRemainingFor(poNo, material, itemNo);
        const formBalance = toNum(header[`BalanceQty${s}`]);
        const received = toNum(header[`VendorInvoiceWeight${s}`]);

        const prevRemaining = Number.isFinite(prevRemainingStored)
          ? prevRemainingStored
          : (Number.isFinite(formBalance) ? formBalance : NaN);

        if (!Number.isFinite(prevRemaining)) continue;

        let consumed = 0;
        if (Number.isFinite(received) && received > 0) {
          consumed = received;
        } else if (Number.isFinite(formBalance) && formBalance < prevRemaining) {
          consumed = prevRemaining - formBalance;
        }

        const newRemaining = Math.max(0, prevRemaining - consumed);
        setRemainingFor(poNo, material, itemNo, newRemaining);
      }

      setTimeout(() => setResult(null), 20000);
      resetForm({ keepMessages: true });
    } catch (err) {
      console.error('Submit error:', err?.response?.data || err);
      const msg = extractErrorMessage(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = (opts = { keepMessages: false }) => {
    setHeader(createInitialHeaderState());
    setError(null);
    setIsUpdateMode(false);
    setLoadedUUID(null);
    setVisiblePOSections(1);
    if (!opts.keepMessages) {
      setResult(null);
      setLastCreated(null);
    }
  };

  // Load existing entry by GateEntryNumber
  const handleLoadForUpdate = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!header.GateEntryNumber) {
        setError('Enter Gate Entry Number to load for update');
        setLoading(false);
        return;
      }
      const resp = await fetchGateEntryByNumber(header.GateEntryNumber);
      let entry = null;
      if (resp.data?.d?.results?.length) {
        entry = resp.data.d.results[0];
      } else if (resp.data?.value?.length) {
        entry = resp.data.value[0];
      }
      if (!entry) {
        setError('Gate entry not found');
        setLoading(false);
        return;
      }
      // Map SAP fields to form fields as needed
      setHeader(prev => ({ ...prev, ...entry }));
      setIsUpdateMode(true);
      setLoadedUUID(entry.SAP_UUID || entry.uuid || entry.Id || entry.id);
      setResult('Loaded for update. Edit and click Update.');
    } catch (err) {
      setError('Failed to load entry for update');
    } finally {
      setLoading(false);
    }
  };

  // Mode detection
  const location = useLocation();
  const navigate = useNavigate();
  const pathTail = location.pathname.split("/").pop();
  const mode = pathTail === "inward" ? "inward" : (pathTail === "outward" ? "outward" : "default");

  useEffect(() => {
    if (mode === "inward") {
      const hh = String(new Date().getHours()).padStart(2, "0");
      const mm = String(new Date().getMinutes()).padStart(2, "0");
      const ss = String(new Date().getSeconds()).padStart(2, "0");
      setHeader(h => ({ ...h, InwardTime: `${hh}:${mm}:${ss}`, OutwardTime: "" }));
    }
    if (mode === "outward") {
      setHeader(h => ({ ...h, OutwardTime: "" }));
    }
  }, [mode]);

  useEffect(() => {
    if (header.GateEntryDate) {
      const year = getFiscalYear(header.GateEntryDate);
      setHeader(prev => ({ ...prev, FiscalYear: year }));
    }
  }, [header.GateEntryDate]);

  // ============================================
  // JSX Render
  // ============================================
  return (
    <div className="create-header-container">
      {/* <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          navigate(-1);
        }}
        style={{
          background: 'linear-gradient(135deg, #0f5cf7 0%, #0990f1 100%)',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '10px',
          fontSize: '0.9375rem',
          fontWeight: '600',
          cursor: 'pointer',
          marginBottom: '20px',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 12px rgba(107, 114, 128, 0.3)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #0c85ef 0%, #18b6e6 100%)';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 39, 53, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(107, 114, 128, 0.3)';
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        ← Back
      </button> */}

      <h2 className="page-title" style={{ margin: '0 auto 10px', textAlign: 'center', width: '100%' }}>
        {mode === "inward" ? " Gate Entry (Inward)" : 
         mode === "outward" ? " Gate Entry (Outward)" : 
         "Create Gate Entry"}
      </h2>

      <form onSubmit={handleSubmit} onKeyDown={(e) => {
        // Prevent form submission when Enter is pressed in input fields
        if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.type !== 'submit') {
          e.preventDefault();
        }
      }}>
        <section className="form-section">
          <h3 className="section-title">Header Information</h3>
          <div className="grid-3-cols">
            {/* Top row: Gate Entry Number, Gate Entry Date, Inward Time */}
            <div className="form-group" style={{ display: 'none' }}>
              <label className="form-label">Gate Entry Number *</label>
              <input
                className="form-input"
                name="GateEntryNumber"
                value={header.GateEntryNumber}
                readOnly
                placeholder="Gate Entry Number"
              />
            </div>
            <div className="form-group" style={{ display: 'none' }}>
              <label className="form-label">Gate Entry Date *</label>
              <input
                className="form-input"
                name="GateEntryDate"
                type="date"
                value={header.GateEntryDate}
                readOnly
                disabled
                style={{ backgroundColor: '#f3f4f6', color: '#888' }}
                tabIndex={-1}
              />
            </div>
            <div className="form-group" style={{ display: 'none' }}>
              <label className="form-label">Inward Time (auto)</label>
              <input
                className="form-input"
                name="InwardTime"
                value={header.InwardTime}
                readOnly
              />
            </div>

            {/* Second row: Series, Vehicle Number, Transporter Code */}
            {/* Series field hidden in UI, logic maintained in backend */}
            <div className="form-group">
              <label className="form-label">Vehicle Number</label>
              <input
                className="form-input"
                name="VehicleNumber"
                value={header.VehicleNumber}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Transporter Code</label>
              {autoTransporter && header.TransporterCode ? (
                <input
                  className="form-input"
                  name="TransporterCode"
                  value={header.TransporterCode}
                  readOnly
                  style={{ backgroundColor: '#f3f4f6', color: '#888' }}
                />
              ) : (
                <select
                  className="form-input"
                  name="TransporterCode"
                  value={header.TransporterCode}
                  onChange={handleChange}
                >
                  <option value="">Select Code</option>
                  {allTransporters.map((t, idx) => (
                    <option key={idx} value={t.TransporterCode}>{t.TransporterCode}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Third row: Transporter Name, Driver Name, Driver Phone */}
            <div className="form-group">
              <label className="form-label">Transporter Name</label>
              <select
                className="form-input"
                name="TransporterName"
                value={header.TransporterName}
                onChange={handleChange}
              >
                <option value="">Select Name</option>
                {allTransporters.map((t, idx) => (
                  <option key={idx} value={t.TransporterName}>{t.TransporterName}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Driver Name</label>
              <input
                className="form-input"
                name="DriverName"
                value={header.DriverName}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Driver Phone (10 digits)</label>
              <input
                className="form-input"
                name="DriverPhoneNumber"
                value={header.DriverPhoneNumber}
                onChange={handleChange}
                placeholder="Enter 10 digit number"
                maxLength="10"
                inputMode="numeric"
              />
            </div>

            {/* Fourth row: DL Number, LR/GC Number, Permit Number */}
            <div className="form-group">
              <label className="form-label">DL Number</label>
              <input
                className="form-input"
                name="DLNumber"
                value={header.DLNumber}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">LR/GC Number</label>
              <input
                className="form-input"
                name="LRGCNumber"
                value={header.LRGCNumber}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Permit Number</label>
              <input
                className="form-input"
                name="PermitNumber"
                value={header.PermitNumber}
                readOnly
                disabled
                style={{ backgroundColor: '#f3f4f6', color: '#888' }}
                tabIndex={-1}
              />
            </div>

            {/* Fifth row: Sub Transporter Name, EWayBill, Division */}
            <div className="form-group">
              <label className="form-label">Sub Transporter Name</label>
              <input
                className="form-input"
                name="SubTransporterName"
                value={header.SubTransporterName}
                onChange={handleChange}
              />
            </div>
            <div className="form-group form-group-checkbox">
              <input type="checkbox" className="form-checkbox" name="EWayBill" checked={header.EWayBill} onChange={handleChange} />
              <label className="form-checkbox-label">E-Way Bill</label>
            </div>
            <div className="form-group">
              <label className="form-label">Division</label>
              <input
                className="form-input"
                name="Division"
                value={header.Division}
                readOnly
                disabled
                style={{ backgroundColor: '#f3f4f6', color: '#888' }}
                tabIndex={-1}
              />
            </div>

            {/* Remarks full width */}
            <div className="form-group">
              <label className="form-label">Remarks</label>
              <textarea
                className="form-textarea"
                name="Remarks"
                value={header.Remarks}
                onChange={handleChange}
                rows={1}
              />
            </div>
          </div>
        </section>

        <section className="form-section">
          <h3 className="section-title">Purchase Order Details</h3>
          {Array.from({ length: 5 }).map((_, idx) => {
            const suffix = idx === 0 ? "" : String(idx + 1);
            // Only render if within visible sections count
            if (idx >= visiblePOSections) return null;
            // Error highlight and inline error below PO section
            let poError = null;
            const poNum = header[`PurchaseOrderNumber${suffix}`];
            if (error && poNum && typeof error === 'string' && error.includes(poNum)) {
              poError = error;
            }
            return (
              <div key={idx} className="po-entry-card">
                <h4 className="po-entry-title">Purchase Order Entry {idx + 1}</h4>
                <div className="grid-4-cols">
                  <div className="form-group" style={{ position: 'relative' }}>
                    <label className="form-label">Purchase Order Number</label>
                    <div className="po-input-wrapper">
                      <input
                        className={`form-input${poError ? ' po-error-input' : ''}`}
                        name={`PurchaseOrderNumber${suffix}`}
                        value={header[`PurchaseOrderNumber${suffix}`]}
                        onChange={(e) => handlePONumberChange(e, suffix)}
                        placeholder="Purchase Order Number"
                        style={{
                          paddingRight: poLoading[suffix] ? '40px' : '12px',
                          fontSize: '1em',
                          borderColor: poError ? '#ef4444' : undefined,
                          background: poError ? '#fff1f1' : undefined
                        }}
                        autoComplete="off"
                      />
                      {poLoading[suffix] && (
                        <div className="po-loading-spinner" />
                      )}
                      {/* PO Dropdown */}
                      {poDropdown.show && poDropdown.suffix === suffix && poDropdown.poList.length > 0 && (
                        <div className="po-dropdown" style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          zIndex: 10,
                          background: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: 6,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                          minWidth: '240px',
                          maxHeight: '220px',
                          overflowY: 'auto',
                          marginTop: 2
                        }}>
                          {poDropdown.poList.map((po, i) => (
                            <div key={i} className="po-dropdown-item" style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              borderBottom: i < poDropdown.poList.length - 1 ? '1px solid #f3f4f6' : 'none',
                              background: '#fff'
                            }}
                              onClick={() => handleSelectPOFromDropdown(po)}
                            >
                              <div style={{ fontWeight: 600 }}>{po.PurchaseOrder}</div>
                              <div style={{ fontSize: '0.95em', color: '#444' }}>{po.Supplier} - {po.SupplierName}</div>
                              <div style={{ fontSize: '0.9em', color: '#666' }}>{po.PurchaseOrderDate ? new Date(po.PurchaseOrderDate).toLocaleDateString() : 'N/A'}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {header[`__POCompletedMsg${suffix}`] && (
                      <div className="po-completed-badge" style={{ color: '#b91c1c', fontWeight: 500, marginTop: 4 }}>
                        {header[`__POCompletedMsg${suffix}`]}
                      </div>
                    )}
                  </div>
                  {/* ... rest of PO fields (keep as is) ... */}
                  <div className="form-group">
                    <label className="form-label">Purchase Order Item</label>
                    <input  
                      className="form-input"
                      name={`PurchaseOrderItem${suffix}`}
                      value={header[`PurchaseOrderItem${suffix}`]}
                      onChange={handleChange}
                      readOnly
                      style={{ backgroundColor: '#f3f4f6' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Material Code</label>
                    <input
                      className="form-input"
                      name={`Material${suffix}`}
                      value={header[`Material${suffix}`]}
                      onChange={handleChange}
                      readOnly
                      style={{ backgroundColor: '#f3f4f6' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Material Description</label>
                    <input
                      className="form-input"
                      name={`MaterialDescription${suffix}`}
                      value={header[`MaterialDescription${suffix}`]}
                      onChange={handleChange}
                      readOnly
                      style={{ backgroundColor: '#f3f4f6' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor Code</label>
                    <input
                      className="form-input"
                      name={`Vendor${suffix}`}
                      value={header[`Vendor${suffix}`]}
                      onChange={handleChange}
                      readOnly
                      style={{ backgroundColor: '#f3f4f6' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor Name</label>
                    <input
                      className="form-input"
                      name={`VendorName${suffix}`}
                      value={header[`VendorName${suffix}`]}
                      onChange={handleChange}
                      readOnly
                      style={{ backgroundColor: '#f3f4f6' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor Invoice No</label>
                    <input
                      className="form-input"
                      name={`VendorInvoiceNumber${suffix}`}
                      value={header[`VendorInvoiceNumber${suffix}`]}
                      onChange={handleChange}
                      placeholder="Enter invoice number"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor Invoice Date</label>
                    <input
                      className="form-input"
                      name={`VendorInvoiceDate${suffix}`}
                      type="date"
                      value={header[`VendorInvoiceDate${suffix}`]}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor Invoice Weight</label>
                    <input
                      className="form-input"
                      name={`VendorInvoiceWeight${suffix}`}
                      type="text"
                      inputMode="decimal"
                      value={header[`VendorInvoiceWeight${suffix}`]}
                      onChange={handleChange}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">PO Balance Quantity</label>
                    <input
                      className="form-input"
                      name={`BalanceQty${suffix}`}
                      type="text"
                      inputMode="decimal"
                      value={header[`BalanceQty${suffix}`]}
                      onChange={handleChange}
                      placeholder="0.000"
                      readOnly={toNum(header[`BalanceQty${suffix}`]) === 0}
                      style={toNum(header[`BalanceQty${suffix}`]) === 0 ? { backgroundColor: '#ffe5e5' } : {}}
                    />
                    {toNum(header[`BalanceQty${suffix}`]) === 0 && (
                      <span className="po-completed-badge">
                        Completed: No remaining quantity
                      </span>
                    )}
                  </div>
                </div>
                {/* Inline PO error below this PO section */}
                {poError && (
                  <div className="po-error-message" style={{ color: '#b91c1c', background: '#fee2e2', borderRadius: '6px', padding: '8px 12px', margin: '8px 0', fontWeight: 500 }}>
                    <strong>Error:</strong> {poError}
                  </div>
                )}
              </div>
            );
          })}
          {visiblePOSections < 5 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
              <button
                type="button"
                onClick={handleAddPOSection}
                className="btn btn-secondary"
                style={{
                  padding: '10px 24px',
                  fontSize: '0.95rem',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
                }}
              >
                <span style={{ fontSize: '1.3rem', lineHeight: '1' }}>+</span>
                Add Another PO Section
              </button>
            </div>
          )}
        </section>

        <div className="form-actions">
          <button
            type="submit"
            disabled={loading}
            className={`btn btn-primary ${loading ? 'disabled' : ''}`}
          >
            {loading
              ? (isUpdateMode ? "Updating..." : "Creating...")
              : isUpdateMode
                ? "Update Gate Entry"
                : (mode === "inward"
                  ? "Create Inward Entry"
                  : mode === "outward"
                    ? "Create Outward Entry"
                    : "Create Gate Entry")}
          </button>

          {/* <button
            type="button"
            onClick={resetForm}
            className="btn btn-secondary"
          >
            Reset Form
          </button> */}
        </div>
      </form>

      {/* PO dropdown is now inline under the input, not a modal */}

      {/* ============================================
          MODAL 2: Line Items Selection (Second Step)
      ============================================ */}
      {poItemsModal.show && (
        <div className="modal-overlay" onClick={closePOItemsModal}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select Line Item - PO: {poItemsModal.poNumber}</h3>
              <p className="modal-subtitle">{poItemsModal.items.length} line item(s) available</p>
              <button className="modal-close" onClick={closePOItemsModal}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="table-container">
                <table className="po-items-table">
                  <thead>
                    <tr>
                      <th>Item No</th>
                      <th>Material</th>
                      <th>Description</th>
                      <th>Order Qty</th>
                      <th>Unit</th>
                      <th>Remaining</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poItemsModal.items.map((item, index) => {
                      const material = item.Material || item.material || '';
                      const itemNo = item.PurchaseOrderItem || item.purchaseOrderItem || '';
                      const orderQty = toNum(item.OrderQuantity || item.orderQuantity);
                      const usedQty = item._usedQty || 0;
                      const remaining = item._remaining;
                      return (
                        <tr key={index} className={remaining === 0 ? 'row-completed' : ''}>
                          <td>{itemNo || index + 1}</td>
                          <td>{material}</td>
                          <td title={item.PurchaseOrderItemText || item.MaterialDescription || item.materialDescription || '-'}>
                            {item.PurchaseOrderItemText || item.MaterialDescription || item.materialDescription || '-'}
                          </td>
                          <td>{orderQty.toLocaleString()}</td>
                          <td>{item.OrderQuantityUnit || item.PurchaseOrderQuantityUnit || 'KG'}</td>
                          <td>
                            {Number.isFinite(remaining) ? (
                              <span className={remaining === 0 ? 'badge-completed' : 'badge-available'}>
                                {remaining.toLocaleString()}
                              </span>
                            ) : (
                              <span className="badge-unknown">Unknown</span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`btn-select-item ${remaining === 0 ? 'disabled' : ''}`}
                              onClick={() => handleSelectPOItem(item)}
                              disabled={remaining === 0}
                              title={remaining === 0 ? 'Item fully consumed' : 'Select this item'}
                            >
                              {remaining === 0 ? 'Completed' : 'Select'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global error removed, now shown inline below PO section if relevant */}

      {result && (
        <div className="success-message">
          <div className="success-header">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <h3>Gate Entry Created Successfully!</h3>
          </div>
          <div className="success-content">
            <p>Gate Entry Number: <strong>{lastCreated?.gateEntryNumber || header.GateEntryNumber}</strong></p>
            <p>Date: {lastCreated?.date || header.GateEntryDate}</p>
            <p>Vehicle: {lastCreated?.vehicle || header.VehicleNumber}</p>
          </div>
        </div>
      )}
    </div>
  );
}


// Utility functions (keep at bottom)
const poKey = (poNo, material, itemNo) => `${String(poNo || '').trim()}__${String(material || '').trim()}__${String(itemNo || '').trim()}`;

const getRemainingMap = () => {
  try { return JSON.parse(localStorage.getItem('poRemainingMap') || '{}'); }
  catch { return {}; }
};

const getRemainingFor = (poNo, material, itemNo) => {
  const map = getRemainingMap();
  const v = map[poKey(poNo, material, itemNo)];
  return typeof v === 'number' ? v : (v != null ? Number(v) : null);
};

const setRemainingFor = (poNo, material, itemNo, qty) => {
  try {
    const map = getRemainingMap();
    const key = poKey(poNo, material, itemNo);
    if (!Number.isFinite(qty) || qty <= 0) {
      delete map[key];
    } else {
      map[key] = qty;
    }
    localStorage.setItem('poRemainingMap', JSON.stringify(map));
  } catch {}
};

const toNum = (val) => {
  if (val === '' || val === null || val === undefined) return NaN;
  const n = Number(String(val).replace(',', '.').trim());
  return Number.isFinite(n) ? n : NaN;
};



