// Version 6 - Create Gate Entry + Material Inward (Weight Document) together
import React, { useState, useEffect, useRef } from "react";
import { createHeader, createMaterialInward, sendEmailNotification, fetchPurchaseOrderByPermitNumber, fetchPurchaseOrderByNumber, transporterDetails, fetchPelletInWeightFromBridge } from "../../api";
import { useLocation } from "react-router-dom";

export default function CreateHeader() {
  // Financial year rule: Apr-Mar maps to ending year (e.g. FY 2025-26 => 2026).
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

  // Helper: Format current time into SAP duration string e.g. PT16H42M16S
  const formatTimeToSapDuration = (date = new Date()) => {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `PT${hh}H${mm}M${ss}S`;
  };

  // Helper: Full ISO timestamp (UTC) for SAP_CreatedDateTime
  const nowIso = (date = new Date()) => date.toISOString();

  // Create initial state function to avoid reference issues
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
      OutwardTime: new Date().toISOString().includes('T')
        ? `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}:${new Date().getSeconds().toString().padStart(2, '0')}`
        : '',
      SAP_CreatedDateTime: new Date().toISOString(),
      
      // Weight Bridge fields (NEW)
      WeightDocNumber: "",
      GrossWeight: "",
      TruckCapacity: "",
    };

    // Add PO fields dynamically
    for (let i = 1; i <= 5; i++) {
      const suffix = i === 1 ? "" : String(i);
      initialState[`PurchaseOrderNumber${suffix}`] = "";
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
  const [loading, setLoading] = useState(false);
  const [grossWeightLoading, setGrossWeightLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [transporterDropdown, setTransporterDropdown] = useState({
    show: false,
    field: '',
    list: [],
    loading: false,
  });
  const transporterSearchTimeoutRef = useRef(null);
  const permitLookupTimeoutRef = useRef(null);
  const poLookupTimeoutRef = useRef(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === 'TransporterCode' || name === 'TransporterName') {
      setHeader(prev => ({ ...prev, [name]: value }));
      debouncedFetchTransporters(value, name);
      return;
    }

    if (name.includes('VendorInvoiceWeight') || name.includes('BalanceQty') || name === 'GrossWeight') {
      if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
        setHeader(prev => ({ ...prev, [name]: value }));
      }
    } else if (name === 'PermitNumber') {
      setHeader(prev => ({ ...prev, PermitNumber: value, LRGCNumber: value }));
    } else {
      setHeader(prev => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value
      }));
    }
  };

  const fetchTransporterDropdown = async (searchValue, fieldName) => {
    const query = String(searchValue || '').trim() || 'a';
    setTransporterDropdown(prev => ({ ...prev, show: true, field: fieldName, loading: true }));
    try {
      const resp = await transporterDetails(query);
      const list = Array.isArray(resp?.data?.results) ? resp.data.results : [];
      setTransporterDropdown({ show: true, field: fieldName, list, loading: false });
    } catch (err) {
      console.warn('Failed to fetch transporter details', err);
      setTransporterDropdown({ show: true, field: fieldName, list: [], loading: false });
    }
  };

  const debouncedFetchTransporters = (searchValue, fieldName) => {
    if (transporterSearchTimeoutRef.current) {
      clearTimeout(transporterSearchTimeoutRef.current);
    }
    transporterSearchTimeoutRef.current = setTimeout(() => {
      fetchTransporterDropdown(searchValue, fieldName);
    }, 250);
  };

  const handleTransporterFocus = (fieldName) => {
    const query = fieldName === 'TransporterCode' ? header.TransporterCode : header.TransporterName;
    fetchTransporterDropdown(query, fieldName);
  };

  const handleSelectTransporter = (item) => {
    setHeader(prev => ({
      ...prev,
      TransporterCode: item?.TransporterCode || prev.TransporterCode,
      TransporterName: item?.TransporterName || prev.TransporterName,
    }));
    setTransporterDropdown(prev => ({ ...prev, show: false }));
  };



  // Keep fiscal year in sync with gate entry date.
  useEffect(() => {
    if (header.GateEntryDate) {
      const year = getFiscalYear(header.GateEntryDate);
      setHeader(prev => ({ ...prev, FiscalYear: year }));
    }
  }, [header.GateEntryDate]);

  // Debounced permit lookup to avoid request spam while typing.
  useEffect(() => {
    const permitNumber = String(header.PermitNumber || '').trim();
    if (permitNumber.length < 10) return;

    let cancelled = false;
    if (permitLookupTimeoutRef.current) {
      clearTimeout(permitLookupTimeoutRef.current);
    }

    permitLookupTimeoutRef.current = setTimeout(async () => {
      if (cancelled) return;
      try {
        const resp = await fetchPurchaseOrderByPermitNumber(permitNumber);
        if (!cancelled && resp.data && resp.data.PurchaseOrder) {
          setHeader(prev => (prev.PermitNumber === permitNumber
            ? {
                ...prev,
                PurchaseOrderNumber: resp.data.PurchaseOrder,
                BalanceQty: resp.data.items?.[0]?.OrderQuantity || ''
              }
            : prev));
        }
      } catch (err) {
        // 404 is expected for permits without a PO mapping.
        if (err?.response?.status !== 404) {
          console.warn('Permit lookup failed', permitNumber, err);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      if (permitLookupTimeoutRef.current) {
        clearTimeout(permitLookupTimeoutRef.current);
      }
    };
  }, [header.PermitNumber]);

  // Debounced PO lookup for Division to prevent calls on each keystroke.
  useEffect(() => {
    const poNumber = String(header.PurchaseOrderNumber || '').trim();
    if (poNumber.length < 5) return;

    let cancelled = false;
    if (poLookupTimeoutRef.current) {
      clearTimeout(poLookupTimeoutRef.current);
    }

    poLookupTimeoutRef.current = setTimeout(async () => {
      if (cancelled) return;
      try {
        const resp = await fetchPurchaseOrderByNumber(poNumber);
        const items = resp?.data?.items || [];
        const firstItem = items[0] || {};
        const plant =
          firstItem.Plant ||
          firstItem.plant ||
          firstItem.ReceivingPlant ||
          firstItem.SupplyingPlant ||
          resp?.data?.Plant ||
          resp?.data?.plant ||
          '';

        if (!cancelled && plant) {
          setHeader(prev => (
            prev.PurchaseOrderNumber === poNumber
              ? { ...prev, Division: plant }
              : prev
          ));
        }
      } catch (err) {
        if (err?.response?.status !== 404) {
          console.warn('Unable to fetch plant for PO', poNumber, err);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      if (poLookupTimeoutRef.current) {
        clearTimeout(poLookupTimeoutRef.current);
      }
    };
  }, [header.PurchaseOrderNumber]);

  useEffect(() => {
    const closeDropdown = () => {
      setTransporterDropdown(prev => ({ ...prev, show: false }));
    };

    document.addEventListener('click', closeDropdown);
    return () => {
      document.removeEventListener('click', closeDropdown);
      if (transporterSearchTimeoutRef.current) {
        clearTimeout(transporterSearchTimeoutRef.current);
      }
      if (permitLookupTimeoutRef.current) {
        clearTimeout(permitLookupTimeoutRef.current);
      }
      if (poLookupTimeoutRef.current) {
        clearTimeout(poLookupTimeoutRef.current);
      }
    };
  }, []);

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
      const materialField = `Material${suffix}`;
      const materialDescField = `MaterialDescription${suffix}`;
      transformed[weightField] = normalizeDecimalString(transformed[weightField]);
      transformed[qtyField] = normalizeDecimalString(transformed[qtyField]);

      // SAP expects Material as a code, not free-text/location values.
      const materialValue = String(transformed[materialField] || '').trim();
      if (materialValue) {
        const looksLikeMaterialCode = /^[A-Za-z0-9]+$/.test(materialValue);
        if (!looksLikeMaterialCode) {
          const existingDesc = String(transformed[materialDescField] || '').trim();
          if (!existingDesc) {
            transformed[materialDescField] = materialValue;
          } else if (!existingDesc.toLowerCase().includes(materialValue.toLowerCase())) {
            // Preserve both mapped values when material is free text (e.g. "Iron Ore") and grade already exists.
            transformed[materialDescField] = `${materialValue} | ${existingDesc}`;
          }
          transformed[materialField] = null;
        } else {
          transformed[materialField] = materialValue;
        }
      }
    }

    // Normalize weight fields
    transformed.GrossWeight = normalizeDecimalString(transformed.GrossWeight);
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
    if (err?.code === 'ECONNABORTED' || String(err?.message || '').toLowerCase().includes('timeout')) {
      return 'Request timed out while waiting for server response. Please retry in a moment.';
    }
    const resp = err?.response?.data;
    if (!resp) return err?.message || String(err);
    if (typeof resp.error === 'string') return resp.error;
    if (resp.error?.message?.value) return resp.error.message.value;
    if (resp.error?.message && typeof resp.error.message === 'string') return resp.error.message;
    if (resp.message && typeof resp.message === 'string') return resp.message;
    return JSON.stringify(resp);
  };

  const parseGrossWeightValue = (rawWeight) => {
    const cleaned = String(rawWeight || '')
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const numberMatch = cleaned.match(/-?\d+(?:\.\d+)?/);
    return numberMatch ? numberMatch[0] : '';
  };

  const handleGetGrossWeight = async () => {
    setGrossWeightLoading(true);
    setError(null);

    try {
      const response = await fetchPelletInWeightFromBridge();
      const payload = response?.data;
      const rawWeight = payload?.data?.weight;
      const parsedWeight = parseGrossWeightValue(rawWeight);

      if (!parsedWeight) {
        throw new Error('Unable to parse gross weight from weighbridge response');
      }

      setHeader((prev) => ({ ...prev, GrossWeight: parsedWeight }));
    } catch (err) {
      setError(err?.message || 'Failed to get gross weight');
    } finally {
      setGrossWeightLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let updatedHeader = { ...header };

      const inbound = updatedHeader.InwardTime || `${new Date().getHours().toString().padStart(2,'0')}:${new Date().getMinutes().toString().padStart(2,'0')}:${new Date().getSeconds().toString().padStart(2,'0')}`;
      const outbound = updatedHeader.OutwardTime || inbound;

      // STEP 1: Create Gate Entry
      const gatePayload = {
        ...updatedHeader,
        GateEntryDate: `${updatedHeader.GateEntryDate}T00:00:00`,
        InwardTime: hhmmssToSapDuration(updatedHeader.InwardTime || inbound),
        OutwardTime: pageMode === "outward" ? hhmmssToSapDuration(outbound) : (updatedHeader.OutwardTime ? hhmmssToSapDuration(updatedHeader.OutwardTime) : null),
        SAP_CreatedDateTime: nowIso(),
        FiscalYear: updatedHeader.FiscalYear || currentYear
      };

      // Match CreateHeader behavior: send vendor invoice dates as datetime strings.
      for (let i = 1; i <= 5; i++) {
        const suffix = i === 1 ? '' : String(i);
        const dateField = `VendorInvoiceDate${suffix}`;
        const dateVal = gatePayload[dateField];
        if (!dateVal) continue;
        if (typeof dateVal === 'string' && !dateVal.includes('T')) {
          gatePayload[dateField] = `${dateVal}T00:00:00`;
        }
      }

      const transformedGatePayload = transformDataForAPI(gatePayload);
      
      // Remove weight-specific fields from gate entry
      delete transformedGatePayload.WeightDocNumber;
      
      console.debug('Creating Gate Entry:', transformedGatePayload);
      const gateResp = await createHeader(transformedGatePayload);
      const createdGateEntryNumber = gateResp?.data?.d?.GateEntryNumber || gateResp?.data?.GateEntryNumber || updatedHeader.GateEntryNumber;
      updatedHeader = { ...updatedHeader, GateEntryNumber: createdGateEntryNumber };
      setHeader(updatedHeader);
      console.log(`✅ Gate Entry created: ${updatedHeader.GateEntryNumber}`);

      // STEP 2: Create Material Inward (Weight Document) - ONLY if GrossWeight is provided
      if (updatedHeader.GrossWeight && updatedHeader.GrossWeight.trim() !== '') {
        const resolvedTruckCapacity =
          String(updatedHeader.TruckCapacity || '').trim() ||
          String(updatedHeader.GrossWeight || '').trim() ||
          String(updatedHeader.VendorInvoiceWeight || '').trim() ||
          String(updatedHeader.VendorInvoiceWeight2 || '').trim() ||
          String(updatedHeader.VendorInvoiceWeight3 || '').trim() ||
          String(updatedHeader.VendorInvoiceWeight4 || '').trim() ||
          String(updatedHeader.VendorInvoiceWeight5 || '').trim();

        const weightPayload = {
          WeightDocNumber: updatedHeader.WeightDocNumber,
          FiscalYear: updatedHeader.FiscalYear || currentYear,
          Indicators: 'I',
          GateEntryNumber: updatedHeader.GateEntryNumber,
          GateFiscalYear: updatedHeader.FiscalYear || currentYear,
          GateIndicators: 'I',
          GateEntryDate: `${updatedHeader.GateEntryDate}T00:00:00`,
          TruckNumber: updatedHeader.VehicleNumber,
          TruckCapacity: resolvedTruckCapacity,
          PermitNumber: updatedHeader.PermitNumber || null,
          GrossWeight: updatedHeader.GrossWeight,
          SAP_CreatedDateTime: nowIso(),
          // Copy PO fields (same as before)
          PurchaseOrderNumber: updatedHeader.PurchaseOrderNumber || null,
          PurchaseOrderNumber2: updatedHeader.PurchaseOrderNumber2 || null,
          PurchaseOrderNumber3: updatedHeader.PurchaseOrderNumber3 || null,
          PurchaseOrderNumber4: updatedHeader.PurchaseOrderNumber4 || null,
          PurchaseOrderNumber5: updatedHeader.PurchaseOrderNumber5 || null,
          Material: updatedHeader.Material || null,
          Material2: updatedHeader.Material2 || null,
          Material3: updatedHeader.Material3 || null,
          Material4: updatedHeader.Material4 || null,
          Material5: updatedHeader.Material5 || null,
          MaterialDescription: updatedHeader.MaterialDescription || null,
          MaterialDescription2: updatedHeader.MaterialDescription2 || null,
          MaterialDescription3: updatedHeader.MaterialDescription3 || null,
          MaterialDescription4: updatedHeader.MaterialDescription4 || null,
          MaterialDescription5: updatedHeader.MaterialDescription5 || null,
          Vendor: updatedHeader.Vendor || null,
          Vendor2: updatedHeader.Vendor2 || null,
          Vendor3: updatedHeader.Vendor3 || null,
          Vendor4: updatedHeader.Vendor4 || null,
          Vendor5: updatedHeader.Vendor5 || null,
          VendorName: updatedHeader.VendorName || null,
          VendorName2: updatedHeader.VendorName2 || null,
          VendorName3: updatedHeader.VendorName3 || null,
          VendorName4: updatedHeader.VendorName4 || null,
          VendorName5: updatedHeader.VendorName5 || null,
          VendorInvoiceNumber: updatedHeader.VendorInvoiceNumber || null,
          VendorInvoiceNumber2: updatedHeader.VendorInvoiceNumber2 || null,
          VendorInvoiceNumber3: updatedHeader.VendorInvoiceNumber3 || null,
          VendorInvoiceNumber4: updatedHeader.VendorInvoiceNumber4 || null,
          VendorInvoiceNumber5: updatedHeader.VendorInvoiceNumber5 || null,
          VendorInvoiceWeight: (String(updatedHeader.VendorInvoiceWeight || '').trim() !== ''
            ? updatedHeader.VendorInvoiceWeight
            : updatedHeader.GrossWeight) || null,
          VendorInvoiceWeight2: updatedHeader.VendorInvoiceWeight2 || null,
          VendorInvoiceWeight3: updatedHeader.VendorInvoiceWeight3 || null,
          VendorInvoiceWeight4: updatedHeader.VendorInvoiceWeight4 || null,
          VendorInvoiceWeight5: updatedHeader.VendorInvoiceWeight5 || null,
          BalanceQty: updatedHeader.BalanceQty || null,
          BalanceQty2: updatedHeader.BalanceQty2 || null,
          BalanceQty3: updatedHeader.BalanceQty3 || null,
          BalanceQty4: updatedHeader.BalanceQty4 || null,
          BalanceQty5: updatedHeader.BalanceQty5 || null,
        };

        // Handle VendorInvoiceDate fields
        for (let i = 1; i <= 5; i++) {
          const suffix = i === 1 ? '' : String(i);
          const dateField = `VendorInvoiceDate${suffix}`;
          if (updatedHeader[dateField] && updatedHeader[dateField].length === 10) {
            weightPayload[dateField] = `${updatedHeader[dateField]}T00:00:00`;
          }
        }

        const transformedWeightPayload = transformDataForAPI(weightPayload);
        // Remove fields that don't belong to Weight Document entity
        delete transformedWeightPayload.EWayBill;
        delete transformedWeightPayload.TransporterCode;
        delete transformedWeightPayload.TransporterName;
        delete transformedWeightPayload.DriverName;
        delete transformedWeightPayload.DriverPhoneNumber;
        delete transformedWeightPayload.LRGCNumber;
        delete transformedWeightPayload.PermitNumber;
        delete transformedWeightPayload.Division;
        delete transformedWeightPayload.Remarks;
        delete transformedWeightPayload.SubTransporterName;
        delete transformedWeightPayload.InwardTime;
        delete transformedWeightPayload.OutwardTime;
        delete transformedWeightPayload.VehicleNumber;
        // Remove empty fields
        Object.keys(transformedWeightPayload).forEach(key => {
          if (transformedWeightPayload[key] === '' || transformedWeightPayload[key] === null || transformedWeightPayload[key] === undefined) {
            delete transformedWeightPayload[key];
          }
        });

        console.debug('Creating Weight Document:', transformedWeightPayload);
        const weightResp = await createMaterialInward(transformedWeightPayload);
        const createdWeightDocNumber = weightResp?.data?.d?.WeightDocNumber || weightResp?.data?.WeightDocNumber || updatedHeader.WeightDocNumber;
        updatedHeader = { ...updatedHeader, WeightDocNumber: createdWeightDocNumber };
        setHeader(updatedHeader);
        console.log(`✅ Weight Document created: ${updatedHeader.WeightDocNumber}`);
        setResult(`✅ Gate Entry (${updatedHeader.GateEntryNumber}) + Weight Document (${updatedHeader.WeightDocNumber}) created successfully!`);
        sendEmailNotification({
          gateEntryNumber: updatedHeader.GateEntryNumber,
          weightDocNumber: updatedHeader.WeightDocNumber,
          vehicleNumber: updatedHeader.VehicleNumber,
          grossWeight: updatedHeader.GrossWeight,
          date: updatedHeader.GateEntryDate
        }).catch(err => console.warn('Email notification failed:', err));
      } else {
        setResult(`✅ Gate Entry (${updatedHeader.GateEntryNumber}) created successfully!`);
      }
      // Do not auto-reset the form after submit; user can reset manually
    } catch (err) {
      console.error('Submit error:', err?.response?.data || err);
      const msg = extractErrorMessage(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setHeader(createInitialHeaderState());
    setError(null);
    setResult(null);
  };

  const location = useLocation();
  const pathTail = location.pathname.split("/").pop();
  const pageMode = pathTail === "inward" ? "inward" : (pathTail === "outward" ? "outward" : "default");

  useEffect(() => {
    if (pageMode === "inward") {
      const hh = String(new Date().getHours()).padStart(2, "0");
      const mm = String(new Date().getMinutes()).padStart(2, "0");
      const ss = String(new Date().getSeconds()).padStart(2, "0");
      setHeader(h => ({ ...h, InwardTime: `${hh}:${mm}:${ss}`, OutwardTime: "" }));
    }
    if (pageMode === "outward") {
      setHeader(h => ({ ...h, OutwardTime: "" }));
    }
  }, [pageMode]);

  // Auto-parse remarks and map fields if remarks is pipe-delimited and not already mapped
  useEffect(() => {
    if (header.Remarks && (header.Remarks.match(/\|/g) || []).length >= 4) {
      // Avoid infinite loop: only parse if at least one mapped field is empty or different
      const fields = parseQRRemarks(header.Remarks);
      // Only update if at least one field is not already set
      if (
        (!header.VendorInvoiceNumber && fields.VendorInvoiceNumber) ||
        (!header.VehicleNumber && fields.TruckNumber) ||
        (!header.Material && fields.material) ||
        (!header.MaterialDescription && fields.grade)
      ) {
        setHeader(prev => ({
          ...prev,
          PermitNumber: fields.PermitNumber || prev.PermitNumber,
          LRGCNumber: fields.PermitNumber || fields.mteNumber || prev.LRGCNumber,
          VendorInvoiceDate: fields.VendorInvoiceDate || prev.VendorInvoiceDate,
          VendorInvoiceNumber: fields.VendorInvoiceNumber || prev.VendorInvoiceNumber,
          VendorInvoiceWeight: fields.VendorInvoiceWeight || prev.VendorInvoiceWeight,
          // GrossWeight should be entered manually in inward screen.
          GrossWeight: prev.GrossWeight,
          VehicleNumber: fields.TruckNumber || prev.VehicleNumber,
          Material: fields.material || prev.Material,
          MaterialDescription: fields.grade || prev.MaterialDescription,
          Division: fields.location || prev.Division,
          // Remarks: prev.Remarks // don't overwrite
        }));
      }
    }
  }, [header.Remarks]);

  return (
    <div className="create-header-container">
      <h2 className="page-title">
        {pageMode === "inward" ? "Create Gate Entry + Weight (Inward)" : 
         pageMode === "outward" ? "Create Gate Entry (Outward)" : 
         "Create Gate Entry + Weight Document"}
      </h2>

      <form onSubmit={handleSubmit} onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.type !== 'submit') {
          e.preventDefault();
        }
      }}>
        <section className="form-section">
          <h3 className="section-title">Header Information</h3>
          <div className="grid-3-cols">
            <div className="form-group">
              <label className="form-label">Gate Entry Number (Auto) *</label>
              <input className="form-input" name="GateEntryNumber" value={header.GateEntryNumber} readOnly style={{ background: '#f0f0f0' }} />
            </div>

            <div className="form-group">
              <label className="form-label">Weight Doc Number (Auto)</label>
              <input className="form-input" name="WeightDocNumber" value={header.WeightDocNumber} readOnly style={{ background: '#f0f0f0' }} />
            </div>

            <div className="form-group">
              <label className="form-label">Gate Entry Date *</label>
              <input className="form-input" name="GateEntryDate" type="date" value={header.GateEntryDate} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label className="form-label">Vehicle Number *</label>
              <input className="form-input" name="VehicleNumber" value={header.VehicleNumber} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label className="form-label">Gross Weight (MT)</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input className="form-input" name="GrossWeight" value={header.GrossWeight} onChange={handleChange} placeholder="0" />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleGetGrossWeight}
                  disabled={grossWeightLoading || loading}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {grossWeightLoading ? 'Getting...' : 'Get Gross'}
                </button>
              </div>
            </div>

            <div className="form-group" style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
              <label className="form-label">Transporter Code</label>
              <input
                className="form-input"
                name="TransporterCode"
                value={header.TransporterCode}
                onChange={handleChange}
                onFocus={() => handleTransporterFocus('TransporterCode')}
              />
              {transporterDropdown.show && transporterDropdown.field === 'TransporterCode' && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.12)'
                }}>
                  {transporterDropdown.loading && (
                    <div style={{ padding: '8px 10px', color: '#555' }}>Loading...</div>
                  )}
                  {!transporterDropdown.loading && transporterDropdown.list.length === 0 && (
                    <div style={{ padding: '8px 10px', color: '#555' }}>No transporters found</div>
                  )}
                  {!transporterDropdown.loading && transporterDropdown.list.map((t, idx) => (
                    <div
                      key={`${t.TransporterCode || 'code'}-${idx}`}
                      style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                      onClick={() => handleSelectTransporter(t)}
                    >
                      <div style={{ fontWeight: 600 }}>{t.TransporterCode}</div>
                      <div style={{ fontSize: '0.9rem', color: '#475569' }}>{t.TransporterName}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group" style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
              <label className="form-label">Transporter Name</label>
              <input
                className="form-input"
                name="TransporterName"
                value={header.TransporterName}
                onChange={handleChange}
                onFocus={() => handleTransporterFocus('TransporterName')}
              />
              {transporterDropdown.show && transporterDropdown.field === 'TransporterName' && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.12)'
                }}>
                  {transporterDropdown.loading && (
                    <div style={{ padding: '8px 10px', color: '#555' }}>Loading...</div>
                  )}
                  {!transporterDropdown.loading && transporterDropdown.list.length === 0 && (
                    <div style={{ padding: '8px 10px', color: '#555' }}>No transporters found</div>
                  )}
                  {!transporterDropdown.loading && transporterDropdown.list.map((t, idx) => (
                    <div
                      key={`${t.TransporterCode || 'name'}-${idx}`}
                      style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                      onClick={() => handleSelectTransporter(t)}
                    >
                      <div style={{ fontWeight: 600 }}>{t.TransporterName}</div>
                      <div style={{ fontSize: '0.9rem', color: '#475569' }}>{t.TransporterCode}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Driver Name</label>
              <input className="form-input" name="DriverName" value={header.DriverName} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label className="form-label">Driver Phone</label>
              <input className="form-input" name="DriverPhoneNumber" value={header.DriverPhoneNumber} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label className="form-label">LR/GC Number</label>
              <input className="form-input" name="LRGCNumber" value={header.LRGCNumber} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label className="form-label">Permit Number</label>
              <input className="form-input" name="PermitNumber" value={header.PermitNumber} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label className="form-label">Sub Transporter Name</label>
              <input className="form-input" name="SubTransporterName" value={header.SubTransporterName} onChange={handleChange} />
            </div>

            <div className="form-group form-group-checkbox">
              <input type="checkbox" className="form-checkbox" name="EWayBill" checked={header.EWayBill} onChange={handleChange} />
              <label className="form-checkbox-label">E-Way Bill</label>
            </div>

            <div className="form-group">
              <label className="form-label">Division</label>
              <input className="form-input" name="Division" value={header.Division} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label className="form-label">Inward Time (auto)</label>
              <input className="form-input" name="InwardTime" value={header.InwardTime} readOnly />
            </div>

            {pageMode !== "inward" && (
            <div className="form-group">
              <label className="form-label">Outward Time (will be set at submit)</label>
              <input className="form-input" name="OutwardTime" value={header.OutwardTime} readOnly />
            </div>
            )}

            <div className="form-group full-width">
              <label className="form-label">Remarks</label>
              <textarea className="form-textarea" name="Remarks" value={header.Remarks} onChange={handleChange} rows={2} />
            </div>
          </div>
        </section>

        <section className="form-section">
          <h3 className="section-title">Purchase Order Details</h3>
          <div className="po-entry-card">
            <h4 className="po-entry-title">PO Entry</h4>
            <div className="grid-4-cols">
              <div className="form-group">
                <label className="form-label">PO Number</label>
                <input className="form-input" name="PurchaseOrderNumber" value={header.PurchaseOrderNumber} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Material</label>
                <input className="form-input" name="Material" value={header.Material} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Material Description</label>
                <input className="form-input" name="MaterialDescription" value={header.MaterialDescription} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor</label>
                <input className="form-input" name="Vendor" value={header.Vendor} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor Name</label>
                <input className="form-input" name="VendorName" value={header.VendorName} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor Invoice No</label>
                <input className="form-input" name="VendorInvoiceNumber" value={header.VendorInvoiceNumber} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor Invoice Date</label>
                <input className="form-input" type="date" name="VendorInvoiceDate" value={header.VendorInvoiceDate} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor Invoice Weight</label>
                <input className="form-input" name="VendorInvoiceWeight" type="text" inputMode="decimal" value={header.VendorInvoiceWeight} onChange={handleChange} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="form-label">Balance Quantity</label>
                <input className="form-input" name="BalanceQty" type="text" inputMode="decimal" value={header.BalanceQty} onChange={handleChange} placeholder="0.000" />
              </div>
            </div>
          </div>
        </section>

        <div className="form-actions">
          <button type="submit" disabled={loading} className={`btn btn-primary ${loading ? 'disabled' : ''}`}>
            {loading ? "Creating..." : "✅ Create Gate Entry + Weight Document"}
          </button>
          <button type="button" onClick={resetForm} className="btn btn-secondary">Reset Form</button>
        </div>
      </form>

      {error && (<div className="error-message"><strong>❌ Error:</strong> {error}</div>)}
      {result && (
        <div className="success-message">
          <div className="success-header">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <h3>Success!</h3>
          </div>
          <div className="success-content">
            <p><strong>{result}</strong></p>
            {header.GateEntryNumber && (
              <>
                <p>Gate Entry Number: <strong>{header.GateEntryNumber}</strong></p>
                <p>Weight Doc Number: <strong>{header.WeightDocNumber}</strong></p>
                <p>Vehicle: {header.VehicleNumber}</p>
                {header.GrossWeight && <p>Gross Weight: {header.GrossWeight} </p>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function parseQRRemarks(remarks) {
  const toInputDate = (value) => {
    if (!value) return '';
    const datePart = String(value).trim().split(' ')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
    const m = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return '';
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  };

  // Log the raw input for debugging
  console.log('Raw remarks:', remarks);

  // Split by pipe with optional spaces around it
  const parts = remarks.split(/\s*\|\s*/).map(s => s.trim());
  console.log('Split parts:', parts);

  // Map to fields (adjust as per your QR format)
  return {
    PermitNumber: parts[0] || '',
    VendorInvoiceNumber: parts[1] || '',
    VendorInvoiceWeight: parts[2] || '',
    GateEntryDate: toInputDate(parts[3]),
    VendorInvoiceDate: toInputDate(parts[3]),
    TruckNumber: parts[4] || '',
    vehicleType: parts[5] || '',
    material: parts[6] || '',
    grade: parts[7] || '',
    mteNumber: parts[8] || '',
    location: parts[9] || ''
  };
}

// Example usage:
const remarks = "25267031B000010 | 25267031T004063 | 19.26 | 16/10/2025 9:23 PM | KA35D 7399 | Tipper | Iron Ore | Fines 55-58% | MTE123930103 | Yerabanahalli - 583130";
const fields = parseQRRemarks(remarks);
console.log(fields);

const handleQRRemarks = (remarks) => {
  const fields = parseQRRemarks(remarks);
  setHeader(prev => ({
    ...prev,
    PermitNumber: fields.PermitNumber || prev.PermitNumber,
    VendorInvoiceNumber: fields.VendorInvoiceNumber || prev.VendorInvoiceNumber,
    VendorInvoiceWeight: fields.VendorInvoiceWeight || prev.VendorInvoiceWeight,
    // Keep manual inward gross weight; do not auto-fill from scan remarks.
    GrossWeight: prev.GrossWeight,
    VehicleNumber: fields.TruckNumber || prev.VehicleNumber,
    LRGCNumber: fields.PermitNumber || fields.mteNumber || prev.LRGCNumber,
    Material: fields.material || prev.Material,
    MaterialDescription: fields.grade || prev.MaterialDescription,
    Division: fields.location || prev.Division,
    Remarks: remarks
  }));
};