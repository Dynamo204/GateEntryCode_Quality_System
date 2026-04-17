// Version 6 - Create Gate Entry + Material Inward (Weight Document) together
import React, { useState, useEffect, useRef } from "react";
import { createHeader, 
  createMaterialInward, 
  sendEmailNotification, 
  fetchPurchaseOrderByPermitNumber, 
  fetchPurchaseOrderByNumber, 
  fetchSubTransporterByPurchaseOrder, 
  transporterDetails, 
  fetchPelletInWeightFromBridge, 
  fetchGateEntryByNumber, 
  fetchWeightDetailsByVendorInvoiceNumber, 
  fetchQRWeightmentSummary } from "../../api";
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

  // Helper: Format current time into SAP duration string e.g. PT16H42M16S
  const formatTimeToSapDuration = (date = new Date()) => {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `PT${hh}H${mm}M${ss}S`;
  };

  // Helper: Full ISO timestamp (UTC) for SAP_CreatedDateTime
  const nowIso = (date = new Date()) => date.toISOString();
  const currentDate = new Date().toISOString().split('T')[0];
  const currentYear = getFiscalYear(currentDate);

  // Create initial state function to avoid reference issues
  const createInitialHeaderState = () => {
    const initialState = {
      GateEntryNumber: "",
      GateEntryDate: currentDate,
      Indicators: "I",
      Indicators2: "QR",
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
    // Add BalanceQty3 for PO Quantity (if not already present)
    if (!initialState.BalanceQty3) initialState.BalanceQty3 = "";
    return initialState;
  };

  const [header, setHeader] = useState(createInitialHeaderState());
  const [loading, setLoading] = useState(false);
  const [grossWeightLoading, setGrossWeightLoading] = useState(false);
  const [error, setError] = useState(null);
  const [poApprovalError, setPoApprovalError] = useState(null);
  const [duplicateMdpError, setDuplicateMdpError] = useState(null);
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
  const duplicateMdpTimeoutRef = useRef(null);

  const normalizeLifecycleStatus = (value) => String(value || '').trim().toUpperCase();

  const isPurchaseOrderApproved = (payload) => {
    const status = String(
      payload?.PurchasingProcessingStatus ||
      payload?.d?.PurchasingProcessingStatus ||
      payload?.value?.[0]?.PurchasingProcessingStatus ||
      payload?.items?.[0]?.PurchasingProcessingStatus ||
      ''
    ).trim().toUpperCase();
    return status === '05' || status === 'APPROVED';
  };

  const escapeODataValue = (value) => String(value || '').replace(/'/g, "''");

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === 'TransporterCode' || name === 'TransporterName') {
      setHeader(prev => ({ ...prev, [name]: value }));
      debouncedFetchTransporters(value, name);
      return;
    }

    if (name === 'VendorInvoiceWeight' || name === 'BalanceQty') {
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

    if (name === 'VendorInvoiceNumber') {
      setDuplicateMdpError(null);
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
    }, 800);
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
          const poQty = resp.data.items?.[0]?.OrderQuantity || '';
          setHeader(prev => (prev.PermitNumber === permitNumber
            ? {
                ...prev,
                PurchaseOrderNumber: resp.data.PurchaseOrder,
                BalanceQty: poQty,
                BalanceQty3: poQty // Set PO Quantity in BalanceQty3 as well
              }
            : prev));
        }
      } catch (err) {
        // 404 is expected for permits without a PO mapping.
        if (err?.response?.status !== 404) {
          console.warn('Permit lookup failed', permitNumber, err);
        }
      }
    }, 800);

    return () => {
      cancelled = true;
      if (permitLookupTimeoutRef.current) {
        clearTimeout(permitLookupTimeoutRef.current);
      }
    };
  }, [header.PermitNumber]);

  useEffect(() => {
    const mdpNumber = String(header.VendorInvoiceNumber || '').trim();
    if (mdpNumber.length < 3) {
      setDuplicateMdpError(null);
      return;
    }

    let cancelled = false;
    if (duplicateMdpTimeoutRef.current) {
      clearTimeout(duplicateMdpTimeoutRef.current);
    }

    duplicateMdpTimeoutRef.current = setTimeout(async () => {
      if (cancelled) return;
      try {
        const safeMdp = escapeODataValue(mdpNumber);
        const [gateResponse, weightResponse] = await Promise.all([
          fetchGateEntryByNumber(`$filter=VendorInvoiceNumber eq '${safeMdp}'`),
          fetchWeightDetailsByVendorInvoiceNumber(mdpNumber, { includeOut: true })
        ]);

        const gateResults = gateResponse?.data?.d?.results || gateResponse?.data?.value || [];
        const weightResults = weightResponse?.data?.d?.results || weightResponse?.data?.value || [];

        const matchingEntries = Array.isArray(gateResults) ? gateResults : [];
        const matchingWeights = (Array.isArray(weightResults) ? weightResults : []).filter((record) => {
          const recordMdp = String(
            record?.VendorInvoiceNumber ||
            ''
          ).trim();
          return recordMdp === mdpNumber;
        });

        const activeEntry = matchingEntries.find((entry) => {
          const status = normalizeLifecycleStatus(entry.Status || entry["d:Status"]);
          return status !== "CANCELLED";
        });

        const activeWeight = matchingWeights.find((record) => {
          const status = normalizeLifecycleStatus(record.Status || record["d:Status"]);
          return status !== "CANCELLED";
        });

        const cancelledEntryExists = matchingEntries.some((entry) => normalizeLifecycleStatus(entry.Status || entry["d:Status"]) === "CANCELLED");
        const cancelledWeightExists = matchingWeights.some((record) => normalizeLifecycleStatus(record.Status || record["d:Status"]) === "CANCELLED");

        if (!cancelled && String(header.VendorInvoiceNumber || '').trim() === mdpNumber) {
          if (activeEntry) {
            const existingGateEntry = activeEntry.GateEntryNumber || activeEntry["d:GateEntryNumber"] || "";
            setDuplicateMdpError(
              `With this MDP Number ${mdpNumber} Gate Entry ${existingGateEntry} already created. Please check slip once.`.trim()
            );
          } else if (cancelledEntryExists && activeWeight) {
            setDuplicateMdpError("Gate Entry was cancelled but Weight Document was not cancelled. Same MDP is not acceptable.");
          } else if (!cancelledEntryExists && cancelledWeightExists) {
            setDuplicateMdpError("Weight Document was cancelled but Gate Entry was not cancelled. Same MDP is not acceptable.");
          } else if (cancelledEntryExists && !cancelledWeightExists) {
            setDuplicateMdpError("Gate Entry was cancelled but Weight Document was not cancelled. Same MDP is not acceptable.");
          } else if (cancelledEntryExists && cancelledWeightExists) {
            setDuplicateMdpError(null);
          } else {
            setDuplicateMdpError(null);
          }
        }
      } catch (lookupError) {
        if (!cancelled) {
          console.warn('Duplicate MDP lookup failed', header.VendorInvoiceNumber, lookupError);
          setDuplicateMdpError(null);
        }
      }
    }, 800);

    return () => {
      cancelled = true;
      if (duplicateMdpTimeoutRef.current) {
        clearTimeout(duplicateMdpTimeoutRef.current);
      }
    };
  }, [header.VendorInvoiceNumber]);

  // Debounced PO lookup for Division and fetch latest valid Gate Entry BalanceQty for PO
  useEffect(() => {
    const poNumber = String(header.PurchaseOrderNumber || '').trim();
    if (poNumber.length < 5) {
      setPoApprovalError(null);
      setHeader(prev => ({ ...prev,
        Division: '', Material: '', MaterialDescription: '', Vendor: '', VendorName: '', BalanceQty3: '',
      }));
      return;
    }

    let cancelled = false;
    if (poLookupTimeoutRef.current) {
      clearTimeout(poLookupTimeoutRef.current);
    }

    poLookupTimeoutRef.current = setTimeout(async () => {
      if (cancelled) return;
      try {
        const [poResult, subTransporterResult] = await Promise.allSettled([
          fetchPurchaseOrderByNumber(poNumber),
          fetchSubTransporterByPurchaseOrder(poNumber)
        ]);

        if (poResult.status !== 'fulfilled') {
          throw poResult.reason;
        }

        const poResp = poResult.value;
        const items = poResp?.data?.items || poResp?.data?.d?.results || poResp?.data?.value || [];
        const firstItem = items[0] || {};
        const subTransporterRecord = subTransporterResult.status === 'fulfilled'
          ? (subTransporterResult.value?.data?.result || subTransporterResult.value?.data?.results?.[0] || null)
          : null;

        // Fetch finalBalance from backend (like QRScannerout)
        let finalBalance = '';
        try {
          const qrWeightResp = await fetchQRWeightmentSummary(poNumber);
          finalBalance = qrWeightResp?.data?.finalBalance;
        } catch (e) {
          finalBalance = '';
        }

        setHeader(prev => {
          if (prev.PurchaseOrderNumber !== poNumber) return prev;
          // Try all possible keys for Material Description
          const materialDescription =
            firstItem.MaterialDescription ||
            firstItem.ProductDescription ||
            firstItem.materialDescription ||
            firstItem.productDescription ||
            prev.MaterialDescription;
          // Always store BalanceQty as positive value
          let absFinalBalance = finalBalance;
          if (absFinalBalance !== undefined && absFinalBalance !== null && !isNaN(absFinalBalance)) {
            absFinalBalance = Math.abs(Number(absFinalBalance)).toFixed(3);
          } else {
            absFinalBalance = prev.BalanceQty;
          }
          return {
            ...prev,
            Division: firstItem.Plant || firstItem.ReceivingPlant || firstItem.SupplyingPlant || prev.Division,
            Material: firstItem.Material || prev.Material,
            MaterialDescription: materialDescription,
            Vendor: firstItem.Vendor || prev.Vendor,
            VendorName: firstItem.VendorName || prev.VendorName,
            TransporterCode: subTransporterRecord?.MainTransporterCode || prev.TransporterCode,
            TransporterName: subTransporterRecord?.MainTransporterName || prev.TransporterName,
            SubTransporterName: subTransporterRecord?.SubTransporterName || prev.SubTransporterName,
            BalanceQty3: firstItem.OrderQuantity || '', // PO Quantity
            BalanceQty: absFinalBalance,
          };
        });
        setPoApprovalError(null);
      } catch (err) {
        setPoApprovalError('Failed to fetch PO details');
        setHeader(prev => ({ ...prev,
          Division: '', Material: '', MaterialDescription: '', Vendor: '', VendorName: '', BalanceQty3: '', BalanceQty: '',
        }));
      }
    }, 800);

    return () => {
      cancelled = true;
      if (poLookupTimeoutRef.current) {
        clearTimeout(poLookupTimeoutRef.current);
      }
    };
  }, [header.PurchaseOrderNumber]);

  // Effect: When PO Quantity is set, fetch totalNetWeight and update BalanceQty
  useEffect(() => {
    const poNumber = String(header.PurchaseOrderNumber || '').trim();
    const poQtyStr = header.BalanceQty3;
    const poQty = parseFloat(poQtyStr);
    if (!poNumber || !poQtyStr || isNaN(poQty)) {
      setHeader(prev => ({ ...prev, BalanceQty: '0.000' }));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const qrResp = await fetchQRWeightmentSummary(poNumber);
        const totalNetWeightStr = qrResp?.data?.totalNetWeight || '0';
        const totalNetWeight = parseFloat(totalNetWeightStr) || 0;
        const balanceQty = poQty - totalNetWeight;
        if (!cancelled) {
          setHeader(prev => ({ ...prev, BalanceQty: balanceQty.toFixed(3) }));
        }
      } catch {
        if (!cancelled) setHeader(prev => ({ ...prev, BalanceQty: '0.000' }));
      }
    })();
    return () => { cancelled = true; };
  }, [header.PurchaseOrderNumber, header.BalanceQty3]);

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
      if (duplicateMdpTimeoutRef.current) {
        clearTimeout(duplicateMdpTimeoutRef.current);
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
      if (poApprovalError) {
        setError(poApprovalError);
        setLoading(false);
        return;
      }

      if (duplicateMdpError) {
        setError(duplicateMdpError);
        setLoading(false);
        return;
      }

      // Validate Gross Weight
      const grossWeightStr = String(header.GrossWeight || '').trim();
      if (grossWeightStr === '') {
        setError('❌ Gross Weight is required. Please click Get Gross before creating the entry.');
        setLoading(false);
        return;
      }

      const grossWeightNum = Number(grossWeightStr);
      if (!Number.isFinite(grossWeightNum) || grossWeightNum <= 0) {
        setError('❌ Gross Weight must be a valid positive number greater than 0. Please check the weighbridge reading.');
        setLoading(false);
        return;
      }

      let updatedHeader = { ...header };
      // Correct calculation for BalanceQty: BalanceQty = previous BalanceQty - VendorInvoiceWeight
      const viw = parseFloat(updatedHeader.VendorInvoiceWeight) || 0;
      const prevBalance = parseFloat(updatedHeader.BalanceQty) || 0;

      // Correct calculation
      let newBalance = prevBalance - viw;
      // Prevent negative
      if (newBalance < 0) newBalance = 0;
      updatedHeader.BalanceQty = newBalance.toFixed(3);

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
          String(updatedHeader.VendorInvoiceWeight || '').trim();

        const weightPayload = {
          WeightDocNumber: updatedHeader.WeightDocNumber,
          FiscalYear: updatedHeader.FiscalYear || currentYear,
          Indicators: 'I',
          Indicators2: 'QR',
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
          Material: updatedHeader.Material || null,
          MaterialDescription: updatedHeader.MaterialDescription || null,
          Vendor: updatedHeader.Vendor || null,
          VendorName: updatedHeader.VendorName || null,
          VendorInvoiceNumber: updatedHeader.VendorInvoiceNumber || null,
          VendorInvoiceWeight: (String(updatedHeader.VendorInvoiceWeight || '').trim() !== ''
            ? updatedHeader.VendorInvoiceWeight
            : updatedHeader.GrossWeight) || null,
          BalanceQty: updatedHeader.BalanceQty || null,
          BalanceQty3: updatedHeader.BalanceQty3 || null,

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
    setDuplicateMdpError(null);
    setResult(null);
  };

  const location = useLocation();
  const pathTail = location.pathname.split("/").pop();
  const pageMode = pathTail === "inward" ? "inward" : (pathTail === "outward" ? "outward" : "default");
  const pageTitle = pageMode === "inward"
    ? "QR Scanner - Create Gate Entry + Weight (Inward)"
    : pageMode === "outward"
      ? "QR Scanner - Create Gate Entry (Outward)"
      : "QR Scanner - Create Gate Entry + Weight Document";

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
      const fields = parseQRRemarks(header.Remarks);
      const parsedVehicle = String(fields.TruckNumber || '').trim();
      const currentVehicle = String(header.VehicleNumber || '').trim();
      const parsedInvoice = String(fields.VendorInvoiceNumber || '').trim();
      const currentInvoice = String(header.VendorInvoiceNumber || '').trim();

      // Update when parsed value is brand new OR a fuller continuation of current partial value.
      const shouldUpdateVehicle = Boolean(parsedVehicle) && (
        !currentVehicle || parsedVehicle === currentVehicle || parsedVehicle.startsWith(currentVehicle)
      );
      const shouldUpdateInvoice = Boolean(parsedInvoice) && (
        !currentInvoice || parsedInvoice === currentInvoice || parsedInvoice.startsWith(currentInvoice)
      );

      if (
        shouldUpdateInvoice ||
        shouldUpdateVehicle
      ) {
        setHeader(prev => ({
          ...prev,
          PermitNumber: fields.PermitNumber || prev.PermitNumber,
          LRGCNumber: fields.PermitNumber || fields.mteNumber || prev.LRGCNumber,
          VendorInvoiceDate: fields.VendorInvoiceDate || prev.VendorInvoiceDate,
          VendorInvoiceNumber: shouldUpdateInvoice ? parsedInvoice : prev.VendorInvoiceNumber,
          VendorInvoiceWeight: fields.VendorInvoiceWeight || prev.VendorInvoiceWeight,
          // GrossWeight should be entered manually in inward screen.
          GrossWeight: prev.GrossWeight,
          VehicleNumber: shouldUpdateVehicle ? parsedVehicle : prev.VehicleNumber,
          Division: fields.location || prev.Division,
          // Remarks: prev.Remarks // don't overwrite
        }));
      }
    }
  }, [header.Remarks]);


  return (
    <div className="create-header-container" style={{ paddingTop: 14, paddingBottom: 14 }}>
      {/* Simple heading instead of banner */}
      <h2 style={{ textAlign: 'center', margin: '12px 0', fontWeight: 700, fontSize: '2rem', color: '#222' }}>
        {pageMode === 'inward'
          ? 'QR Scanner Inward'
          : pageMode === 'outward'
            ? 'QR Scanner Outward'
            : 'QR Scanner'}
      </h2>

      <form onSubmit={handleSubmit} onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.type !== 'submit') {
          e.preventDefault();
        }
      }}>
        <section className="form-section" style={{ marginBottom: 14, paddingBottom: 0 }}>
          {/* <h3 className="section-title" style={{ marginBottom: 10 }}>Header Information</h3> */}
          <div className="grid-7-cols" style={{ rowGap: 8 }}>
            <div className="form-group" style={{ marginBottom: 6 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Gate Entry Number</label>
              <input className="form-input form-input-readonly" name="GateEntryNumber" value={header.GateEntryNumber} readOnly style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
            </div>

            <div className="form-group" style={{ marginBottom: 6 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Weight Doc Number</label>
              <input className="form-input form-input-readonly" name="WeightDocNumber" value={header.WeightDocNumber} readOnly style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
            </div>

            <div className="form-group" style={{ marginBottom: 6 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Gate Entry Date *</label>
              <input className="form-input" name="GateEntryDate" type="date" value={header.GateEntryDate} onChange={handleChange} required style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
            </div>

            <div className="form-group" style={{ marginBottom: 6 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Vehicle Number *</label>
              <input className="form-input" name="VehicleNumber" value={header.VehicleNumber} onChange={handleChange} required style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
            </div>

            <div className="form-group form-group-relative" style={{ marginBottom: 6 }} onClick={(e) => e.stopPropagation()}>
              <label className="form-label" style={{ marginBottom: 4 }}>Transporter Code</label>
              <input className="form-input" name="TransporterCode" value={header.TransporterCode} onChange={handleChange} onFocus={() => handleTransporterFocus('TransporterCode')} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
              {transporterDropdown.show && transporterDropdown.field === 'TransporterCode' && (
                <div className="dropdown-list">
                  {transporterDropdown.loading && (
                    <div className="dropdown-list-loading">Loading...</div>
                  )}
                  {!transporterDropdown.loading && transporterDropdown.list.length === 0 && (
                    <div className="dropdown-list-empty">No transporters found</div>
                  )}
                  {!transporterDropdown.loading && transporterDropdown.list.map((t, idx) => (
                    <div
                      key={`${t.TransporterCode || 'code'}-${idx}`}
                      className="dropdown-list-item"
                      onClick={() => handleSelectTransporter(t)}
                    >
                      <div className="dropdown-list-item-code">{t.TransporterCode}</div>
                      <div className="dropdown-list-item-name">{t.TransporterName}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group form-group-relative" style={{ marginBottom: 6 }} onClick={(e) => e.stopPropagation()}>
              <label className="form-label" style={{ marginBottom: 4 }}>Transporter Name</label>
              <input className="form-input" name="TransporterName" value={header.TransporterName} onChange={handleChange} onFocus={() => handleTransporterFocus('TransporterName')} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
              {transporterDropdown.show && transporterDropdown.field === 'TransporterName' && (
                <div className="dropdown-list">
                  {transporterDropdown.loading && (
                    <div className="dropdown-list-loading">Loading...</div>
                  )}
                  {!transporterDropdown.loading && transporterDropdown.list.length === 0 && (
                    <div className="dropdown-list-empty">No transporters found</div>
                  )}
                  {!transporterDropdown.loading && transporterDropdown.list.map((t, idx) => (
                    <div
                      key={`${t.TransporterCode || 'name'}-${idx}`}
                      className="dropdown-list-item"
                      onClick={() => handleSelectTransporter(t)}
                    >
                      <div className="dropdown-list-item-name">{t.TransporterName}</div>
                      <div className="dropdown-list-item-code">{t.TransporterCode}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 6 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Driver Name</label>
              <input className="form-input" name="DriverName" value={header.DriverName} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
            </div>

            <div className="form-group" style={{ marginBottom: 6 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Driver Phone</label>
              <input className="form-input" name="DriverPhoneNumber" value={header.DriverPhoneNumber} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
            </div>

            <div className="form-group" style={{ marginBottom: 6 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>LR/GC Number</label>
              <input className="form-input" name="LRGCNumber" value={header.LRGCNumber} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
            </div>

            <div className="form-group" style={{ marginBottom: 6 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Permit Number</label>
              <input className="form-input" name="PermitNumber" value={header.PermitNumber} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
            </div>

            <div className="form-group" style={{ marginBottom: 6 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Sub Transporter Name</label>
              <input className="form-input" name="SubTransporterName" value={header.SubTransporterName} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
            </div>

            <div className="form-group form-group-checkbox" style={{ marginBottom: 6, minHeight: 34, height: 34, display: 'flex', alignItems: 'center' }}>
              <input type="checkbox" className="form-checkbox" name="EWayBill" checked={header.EWayBill} onChange={handleChange} style={{ marginRight: 6 }} />
              <label className="form-checkbox-label" style={{ marginBottom: 0 }}>E-Way Bill</label>
            </div>

            <div className="form-group" style={{ marginBottom: 6 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Division</label>
              <input className="form-input" name="Division" value={header.Division} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
            </div>

            <div className="form-group" style={{ marginBottom: 6 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Inward Time (auto)</label>
              <input className="form-input" name="InwardTime" value={header.InwardTime} readOnly style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
            </div>

            {pageMode !== "inward" && (<div className="form-group" style={{ marginBottom: 6 }}><label className="form-label" style={{ marginBottom: 4 }}>Outward Time (will be set at submit)</label><input className="form-input" name="OutwardTime" value={header.OutwardTime} readOnly style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} /></div>)}

            <div className="form-group full-width" style={{ marginBottom: 6 }}><label className="form-label" style={{ marginBottom: 4 }}>Remarks</label><textarea className="form-textarea" name="Remarks" value={header.Remarks} onChange={handleChange} rows={2} style={{ minHeight: 30, height: 34, paddingTop: 4, paddingBottom: 4, backgroundColor: typeof header.Remarks === 'string' && (header.Remarks.match(/\|/g) || []).length >= 4 ? '#fffbe6' : undefined, fontWeight: typeof header.Remarks === 'string' && (header.Remarks.match(/\|/g) || []).length >= 4 ? 'bold' : undefined }} />{duplicateMdpError && (<div style={{ color: 'red', fontWeight: 500, margin: '4px 0' }}>{duplicateMdpError}</div>)}</div>
          </div>
        </section>

        <section className="form-section" style={{ marginBottom: 14, paddingBottom: 0 }}>
         {/* <h3 className="section-title" style={{ marginBottom: 10 }}>Purchase Order Details</h3>  */}
          <div className="po-entry-card" style={{ marginBottom: 8, paddingBottom: 0 }}>
            <h4 className="po-entry-title" style={{ marginBottom: 8 }}>PO Detals</h4>
            <div className="grid-7-cols" style={{ rowGap: 8 }}>
              <div className="form-group" style={{ marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>PO Number</label><input className="form-input" name="PurchaseOrderNumber" value={header.PurchaseOrderNumber} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />{poApprovalError && (<div className="error-message" style={{ marginTop: '6px' }}><strong>Error:</strong> {poApprovalError}</div>)}
              </div>
              <div className="form-group" style={{ marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>Material</label><input className="form-input" name="Material" value={header.Material} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
              </div>
              <div className="form-group" style={{ marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>Material Description</label><input className="form-input" name="MaterialDescription" value={header.MaterialDescription} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
              </div>
              <div className="form-group" style={{ marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>Vendor</label><input className="form-input" name="Vendor" value={header.Vendor} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
              </div>
              <div className="form-group" style={{ marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>Vendor Name</label><input className="form-input" name="VendorName" value={header.VendorName} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
              </div>
              <div className="form-group" style={{ marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>Vendor Invoice No</label><input className="form-input" name="VendorInvoiceNumber" value={header.VendorInvoiceNumber} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
              </div>
              <div className="form-group" style={{ marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>Vendor Invoice Date</label><input className="form-input" type="date" name="VendorInvoiceDate" value={header.VendorInvoiceDate} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
              </div>
              <div className="form-group" style={{ marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>Vendor Invoice Weight</label>
                <input
                  className="form-input"
                  name="VendorInvoiceWeight"
                  type="text"
                  inputMode="decimal"
                  value={header.VendorInvoiceWeight}
                  onChange={handleChange}
                  placeholder="0.00"
                  style={{
                    borderColor: '#0b5ed7',
                    backgroundColor: '#fff',
                    height: 44,
                    minHeight: 40,
                    paddingTop: 6,
                    paddingBottom: 6,
                    fontSize: '1.18em',
                    width: '130px'
                  }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>Balance Quantity</label>
                <input
                  className="form-input"
                  name="BalanceQty"
                  type="text"
                  inputMode="decimal"
                  value={header.BalanceQty}
                  onChange={handleChange}
                  placeholder="0.000"
                  style={{
                    borderColor: '#0b5ed7',
                    backgroundColor: '#f0f0f0',
                    height: 44,
                    minHeight: 40,
                    paddingTop: 6,
                    paddingBottom: 6,
                    fontSize: '1.18em',
                    width: '130px'
                  }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>PO Quantity</label><input className="form-input" name="BalanceQty3" type="text" inputMode="decimal" value={header.BalanceQty3} onChange={handleChange} placeholder="0.000" style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
              </div>
            </div>
          </div>
        </section>

        <div className="form-actions" style={{ marginTop: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
          <div className="form-group gross-weight-group" style={{ marginBottom: 6, minWidth: '190px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <label className="form-label gross-weight-label" style={{ marginBottom: 4, color: '#0b5ed7', fontWeight: 700, fontSize: '1.08em' }}>Gross Weight *</label>
            <div className="gross-weight-row" style={{ minHeight: 44, height: 44, alignItems: 'center', display: 'flex', gap: '12px' }}>
              <input
                className="form-input gross-weight-input"
                name="GrossWeight"
                value={header.GrossWeight}
                onChange={handleChange}
                readOnly
                placeholder="Enter or Get Gross"
                inputMode="decimal"
                style={{ borderColor: '#0b5ed7', backgroundColor: '#fff', height: 44, minHeight: 40, paddingTop: 6, paddingBottom: 6, fontSize: '1.18em', width: '130px' }}
              />
              <button
                type="button"
                className="btn btn-secondary gross-weight-btn"
                onClick={handleGetGrossWeight}
                disabled={grossWeightLoading || loading}
                style={{ whiteSpace: 'nowrap', backgroundColor: '#ff8c00', borderColor: '#ff8c00', color: '#fff', height: 44, minHeight: 40, fontSize: '1.18em', padding: '0 24px', fontWeight: 700 }}
              >
                {grossWeightLoading ? 'Getting...' : 'Get Gross'}
              </button>
              <span className="gross-weight-hint" style={{ marginLeft: 6, fontSize: '0.92em', color: '#888' }}>(You can enter manually or use Get Gross)</span>
            </div>
          </div>
          <button type="submit" disabled={loading} className={`btn btn-primary ${loading ? 'disabled' : ''}`} style={{ height: 48, minHeight: 40, fontSize: '1.08em', padding: '0 28px', fontWeight: 700 }}>
            {loading ? "Creating..." : "✅ Create Gate Entry"}
          </button>
        </div>
      </form>

      {error && (<div style={{ color: 'red', fontWeight: 500, margin: '8px 0' }}>{error}</div>)}
      {result && (<div className="success-message"><div className="success-header"><svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg><h3>Success!</h3></div><div className="success-content"><p><strong>{result}</strong></p>{header.GateEntryNumber && (<><p>Gate Entry Number: <strong>{header.GateEntryNumber}</strong></p><p>Weight Doc Number: <strong>{header.WeightDocNumber}</strong></p><p>Vehicle: {header.VehicleNumber}</p>{header.GrossWeight && <p>Gross Weight: {header.GrossWeight} </p>}</>)}</div></div>)}
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

// Helper: Fetch latest valid (non-cancelled) Gate Entry for a PO, using GateEntryDate and InwardTime
function parseSapDurationToSeconds(duration) {
  // SAP duration format: PT14H22M41S
  if (!duration || typeof duration !== 'string') return 0;
  const m = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const h = parseInt(m[1] || '0', 10);
  const min = parseInt(m[2] || '0', 10);
  const s = parseInt(m[3] || '0', 10);
  return h * 3600 + min * 60 + s;
}

async function fetchLatestValidGateEntryForPO(poNumber) {
  try {
    // Query all gate entries for the PO
    const resp = await fetchGateEntryByNumber(`$filter=PurchaseOrderNumber eq '${poNumber}'`);
    const entries = resp?.data?.d?.results || resp?.data?.value || [];
    // Filter out cancelled entries first
    const validEntries = entries.filter(entry => String(entry.Status || entry["d:Status"] || "").toUpperCase() !== "CANCELLED");
    // Sort by GateEntryDate desc, then InwardTime desc
    const sorted = validEntries.slice().sort((a, b) => {
      let dateA = a.GateEntryDate || a["d:GateEntryDate"];
      let dateB = b.GateEntryDate || b["d:GateEntryDate"];
      let timeA = parseSapDurationToSeconds(a.InwardTime || a["d:InwardTime"]);
      let timeB = parseSapDurationToSeconds(b.InwardTime || b["d:InwardTime"]);
      // Handle missing/invalid dates
      let tsA = dateA ? new Date(dateA).getTime() : 0;
      let tsB = dateB ? new Date(dateB).getTime() : 0;
      if (tsA !== tsB) return tsB - tsA;
      return timeB - timeA;
    });
    return sorted[0] || null;
  } catch (err) {
    console.warn("Failed to fetch gate entries for PO", poNumber, err);
    return null;
  }
}

// Updated QR remarks handler with correct balance/material logic
const handleQRRemarks = async (remarks) => {
  const fields = parseQRRemarks(remarks);
  let poNumber = fields.PurchaseOrderNumber || fields.poNumber || fields.PermitNumber || "";
  poNumber = String(poNumber).trim();

  let material = fields.material || "";
  let materialDescription = fields.grade || "";
  let balanceQty = "";
  let poQty = "";

  if (poNumber) {
    // 1. Always get PO master for PO quantity and fallback material/desc
    try {
      const resp = await fetchPurchaseOrderByNumber(poNumber);
      const items = resp?.data?.items || resp?.data?.d?.results || resp?.data?.value || [];
      const firstItem = items[0] || {};
      if (!material) material = firstItem.Material || material;
      if (!materialDescription) materialDescription = firstItem.MaterialDescription || materialDescription;
      poQty = firstItem.OrderQuantity || poQty;
    } catch (err) {
      // ignore
    }
    // 2. Only get balanceQty from latest valid entry (by GateEntryDate/InwardTime)
    const latestEntry = await fetchLatestValidGateEntryForPO(poNumber);
    if (latestEntry) {
      material = latestEntry.Material || latestEntry["d:Material"] || material;
      materialDescription = latestEntry.MaterialDescription || latestEntry["d:MaterialDescription"] || materialDescription;
      // Only use BalanceQty, never BalanceQty2/3/4/5
      balanceQty = String(latestEntry.BalanceQty || latestEntry["d:BalanceQty"] || "");
    } else {
      // No valid gate entry: leave balanceQty blank
      balanceQty = "";
    }
  }

  setHeader(prev => ({
    ...prev,
    PermitNumber: fields.PermitNumber || prev.PermitNumber,
    VendorInvoiceNumber: fields.VendorInvoiceNumber || prev.VendorInvoiceNumber,
    VendorInvoiceWeight: fields.VendorInvoiceWeight || prev.VendorInvoiceWeight,
    GrossWeight: prev.GrossWeight,
    VehicleNumber: fields.TruckNumber || prev.VehicleNumber,
    LRGCNumber: fields.PermitNumber || fields.mteNumber || prev.LRGCNumber,
    Material: material || prev.Material,
    MaterialDescription: materialDescription || prev.MaterialDescription,
    BalanceQty: balanceQty, // Only from latest valid gate entry's BalanceQty
    BalanceQty3: poQty || prev.BalanceQty3,
    Division: fields.location || prev.Division,
    Remarks: remarks
  }));
};

