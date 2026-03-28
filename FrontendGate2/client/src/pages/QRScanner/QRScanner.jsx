// Version 6 - Create Gate Entry + Material Inward (Weight Document) together
import React, { useState, useEffect, useRef } from "react";
import { createHeader, createMaterialInward, sendEmailNotification, fetchPurchaseOrderByPermitNumber, fetchPurchaseOrderByNumber, transporterDetails, fetchPelletInWeightFromBridge, fetchGateEntryByNumber, fetchWeightDetailsByVendorInvoiceNumber } from "../../api";
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
    }, 300);

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
            record?.VendorInvoiceNumber2 ||
            record?.VendorInvoiceNumber3 ||
            record?.VendorInvoiceNumber4 ||
            record?.VendorInvoiceNumber5 ||
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
    }, 300);

    return () => {
      cancelled = true;
      if (duplicateMdpTimeoutRef.current) {
        clearTimeout(duplicateMdpTimeoutRef.current);
      }
    };
  }, [header.VendorInvoiceNumber]);

  // Debounced PO lookup for Division to prevent calls on each keystroke.
  useEffect(() => {
    const poNumber = String(header.PurchaseOrderNumber || '').trim();
    if (poNumber.length < 5) {
      setPoApprovalError(null);
      return;
    }

    let cancelled = false;
    if (poLookupTimeoutRef.current) {
      clearTimeout(poLookupTimeoutRef.current);
    }

    poLookupTimeoutRef.current = setTimeout(async () => {
      if (cancelled) return;
      try {
        const resp = await fetchPurchaseOrderByNumber(poNumber);

        if (!isPurchaseOrderApproved(resp?.data)) {
          if (!cancelled) {
            setPoApprovalError(`PO ${poNumber} is not approved.`);
            setHeader(prev => (
              prev.PurchaseOrderNumber === poNumber
                ? {
                    ...prev,
                    Division: '',
                    Material: '',
                    MaterialDescription: '',
                    BalanceQty: ''
                  }
                : prev
            ));
          }
          return;
        }

        if (!cancelled) {
          setPoApprovalError(null);
        }

        const items =
          resp?.data?.items ||
          resp?.data?.d?.results ||
          resp?.data?.value ||
          [];
        const firstItem = items[0] || {};
        const plant =
          firstItem.Plant ||
          firstItem.plant ||
          firstItem.ReceivingPlant ||
          firstItem.SupplyingPlant ||
          resp?.data?.Plant ||
          resp?.data?.plant ||
          '';

        const poMaterial =
          firstItem.Material ||
          firstItem["d:Material"] ||
          resp?.data?.Material ||
          resp?.data?.["d:Material"] ||
          '';

        const poMaterialDescription =
          firstItem.ProductDescription ||
          firstItem.MaterialDescription ||
          firstItem.productDescription ||
          firstItem["d:ProductDescription"] ||
          firstItem["d:MaterialDescription"] ||
          resp?.data?.ProductDescription ||
          resp?.data?.MaterialDescription ||
          resp?.data?.d?.ProductDescription ||
          resp?.data?.["d:ProductDescription"] ||
          resp?.data?.["d:MaterialDescription"] ||
          '';

        if (!cancelled && (plant || poMaterial || poMaterialDescription)) {
          setHeader(prev => {
            if (prev.PurchaseOrderNumber !== poNumber) return prev;

            return {
              ...prev,
              Division: plant || prev.Division,
              Material: poMaterial || prev.Material,
              MaterialDescription: poMaterialDescription || prev.MaterialDescription,
            };
          });
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
    <div className="create-header-container">
      {/* ══ ULTRA PREMIUM QR SCANNER BANNER ══ */}
      <div style={{
        position: 'relative',
        borderRadius: '20px',
        marginBottom: '32px',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 4px 20px rgba(67,255,142,0.12), inset 0 1px 0 rgba(255,255,255,0.07)',
      }}>
        {/* Deep layered background */}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,#020817 0%,#071a3e 25%,#0a2d6e 50%,#0842a0 70%,#0b5ed7 100%)' }} />
        {/* Aurora sweep — purple + teal + emerald */}
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 80% 120% at 50% -20%,rgba(139,92,246,0.18) 0%,transparent 60%),radial-gradient(ellipse 60% 80% at 100% 100%,rgba(6,182,212,0.14) 0%,transparent 55%),radial-gradient(ellipse 50% 70% at 0% 100%,rgba(16,185,129,0.1) 0%,transparent 50%)' }} />
        {/* Subtle grid mesh */}
        <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(67,255,142,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(67,255,142,0.03) 1px,transparent 1px)', backgroundSize:'32px 32px' }} />
        {/* Diagonal shimmer streak */}
        <div style={{ position:'absolute', top:'-40%', left:'-10%', width:'40%', height:'200%', background:'linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.035) 50%,transparent 60%)', transform:'skewX(-15deg)', pointerEvents:'none' }} />
        {/* Ghost QR watermark right side */}
        <div style={{ position:'absolute', right:'-8px', top:'50%', transform:'translateY(-50%)', opacity:0.045, pointerEvents:'none' }}>
          <svg viewBox="0 0 80 80" width="108" height="108" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="24" height="24" rx="3" fill="none" stroke="white" strokeWidth="4"/>
            <rect x="10" y="10" width="10" height="10" fill="white"/>
            <rect x="53" y="3" width="24" height="24" rx="3" fill="none" stroke="white" strokeWidth="4"/>
            <rect x="60" y="10" width="10" height="10" fill="white"/>
            <rect x="3" y="53" width="24" height="24" rx="3" fill="none" stroke="white" strokeWidth="4"/>
            <rect x="10" y="60" width="10" height="10" fill="white"/>
            <rect x="34" y="3" width="6" height="6" fill="white"/><rect x="42" y="3" width="6" height="6" fill="white"/>
            <rect x="34" y="34" width="6" height="6" fill="white"/><rect x="50" y="42" width="6" height="6" fill="white"/>
            <rect x="66" y="50" width="6" height="6" fill="white"/><rect x="66" y="66" width="6" height="6" fill="white"/>
          </svg>
        </div>
        {/* Rainbow prismatic top bar */}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:'linear-gradient(90deg,#8b5cf6 0%,#06b6d4 20%,#43ff8e 40%,#facc15 60%,#f97316 80%,#ec4899 100%)', boxShadow:'0 0 18px rgba(67,255,142,0.55),0 0 36px rgba(6,182,212,0.28)' }} />
        {/* Bottom shimmer bar */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'2px', background:'linear-gradient(90deg,transparent 0%,#8b5cf6 20%,#06b6d4 40%,#43ff8e 60%,#facc15 80%,transparent 100%)', opacity:0.5 }} />
        {/* Corner brackets — alternating green + cyan */}
        <div style={{ position:'absolute', top:'10px', left:'10px', width:'22px', height:'22px', borderTop:'2px solid #43ff8e', borderLeft:'2px solid #43ff8e', borderRadius:'4px 0 0 0', boxShadow:'0 0 8px rgba(67,255,142,0.5)', opacity:0.9 }} />
        <div style={{ position:'absolute', top:'10px', right:'10px', width:'22px', height:'22px', borderTop:'2px solid #06b6d4', borderRight:'2px solid #06b6d4', borderRadius:'0 4px 0 0', boxShadow:'0 0 8px rgba(6,182,212,0.5)', opacity:0.9 }} />
        <div style={{ position:'absolute', bottom:'10px', left:'10px', width:'22px', height:'22px', borderBottom:'2px solid #06b6d4', borderLeft:'2px solid #06b6d4', borderRadius:'0 0 0 4px', boxShadow:'0 0 8px rgba(6,182,212,0.5)', opacity:0.9 }} />
        <div style={{ position:'absolute', bottom:'10px', right:'10px', width:'22px', height:'22px', borderBottom:'2px solid #43ff8e', borderRight:'2px solid #43ff8e', borderRadius:'0 0 4px 0', boxShadow:'0 0 8px rgba(67,255,142,0.5)', opacity:0.9 }} />

        {/* ── Main content row ── */}
        <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', gap:'22px', padding:'22px 44px', paddingRight:'clamp(130px, 28vw, 320px)', textAlign:'center' }}>
          {/* QR icon with glowing ring */}
            <div style={{ position:'relative', flexShrink:0, width:'72px', height:'72px', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ position:'absolute', inset:'-4px', borderRadius:'18px', background:'linear-gradient(135deg,#43ff8e,#06b6d4,#8b5cf6,#43ff8e)', opacity:0.45, filter:'blur(6px)' }} />
              <div style={{ position:'absolute', inset:0, borderRadius:'16px', padding:'2px', background:'linear-gradient(135deg,#43ff8e 0%,#06b6d4 50%,#8b5cf6 100%)' }}>
                <div style={{ width:'100%', height:'100%', borderRadius:'14px', background:'#040e24' }} />
              </div>
              <div style={{ position:'relative', filter:'drop-shadow(0 0 8px rgba(67,255,142,0.8))' }}>
                <svg viewBox="0 0 80 80" width="46" height="46" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="qG1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#43ff8e" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                    <linearGradient id="qG2" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#06b6d4" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                  <rect x="3" y="3" width="24" height="24" rx="3" fill="none" stroke="url(#qG1)" strokeWidth="4" />
                  <rect x="10" y="10" width="10" height="10" fill="url(#qG1)" />
                  <rect x="53" y="3" width="24" height="24" rx="3" fill="none" stroke="url(#qG1)" strokeWidth="4" />
                  <rect x="60" y="10" width="10" height="10" fill="url(#qG1)" />
                  <rect x="3" y="53" width="24" height="24" rx="3" fill="none" stroke="url(#qG2)" strokeWidth="4" />
                  <rect x="10" y="60" width="10" height="10" fill="url(#qG2)" />
                  <rect x="34" y="3" width="6" height="6" fill="#43ff8e" /><rect x="42" y="3" width="6" height="6" fill="#06b6d4" />
                  <rect x="34" y="11" width="6" height="6" fill="#06b6d4" /><rect x="42" y="11" width="6" height="6" fill="#43ff8e" />
                  <rect x="34" y="19" width="6" height="6" fill="#8b5cf6" />
                  <rect x="3" y="34" width="6" height="6" fill="#43ff8e" /><rect x="11" y="34" width="6" height="6" fill="#06b6d4" /><rect x="19" y="34" width="6" height="6" fill="#43ff8e" />
                  <rect x="34" y="34" width="6" height="6" fill="#8b5cf6" /><rect x="42" y="34" width="6" height="6" fill="#43ff8e" />
                  <rect x="50" y="34" width="6" height="6" fill="#06b6d4" /><rect x="58" y="34" width="6" height="6" fill="#8b5cf6" /><rect x="66" y="34" width="6" height="6" fill="#43ff8e" />
                  <rect x="3" y="42" width="6" height="6" fill="#06b6d4" /><rect x="19" y="42" width="6" height="6" fill="#8b5cf6" />
                  <rect x="34" y="42" width="6" height="6" fill="#43ff8e" /><rect x="50" y="42" width="6" height="6" fill="#06b6d4" /><rect x="66" y="42" width="6" height="6" fill="#43ff8e" />
                  <rect x="34" y="50" width="6" height="6" fill="#8b5cf6" /><rect x="42" y="50" width="6" height="6" fill="#06b6d4" /><rect x="58" y="50" width="6" height="6" fill="#43ff8e" />
                  <rect x="34" y="58" width="6" height="6" fill="#06b6d4" /><rect x="50" y="58" width="6" height="6" fill="#8b5cf6" />
                  <rect x="34" y="66" width="6" height="6" fill="#43ff8e" /><rect x="42" y="66" width="6" height="6" fill="#06b6d4" />
                  <rect x="58" y="66" width="6" height="6" fill="#8b5cf6" /><rect x="66" y="58" width="6" height="6" fill="#06b6d4" /><rect x="66" y="66" width="6" height="6" fill="#43ff8e" />
                </svg>
              </div>
            </div>

            <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center' }}>
              <div style={{
                display:'inline-flex', alignItems:'center', gap:'6px',
                background: pageMode === 'inward'
                  ? 'linear-gradient(90deg, rgba(67,255,142,0.18), rgba(6,182,212,0.12))'
                  : pageMode === 'outward'
                    ? 'linear-gradient(90deg, rgba(6,182,212,0.18), rgba(139,92,246,0.12))'
                    : 'linear-gradient(90deg, rgba(250,204,21,0.18), rgba(249,115,22,0.12))',
                border: `1px solid ${pageMode === 'inward' ? 'rgba(67,255,142,0.5)' : pageMode === 'outward' ? 'rgba(6,182,212,0.5)' : 'rgba(250,204,21,0.5)'}`,
                borderRadius:'30px', padding:'3px 14px', marginBottom:'8px',
                fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase',
                color: pageMode === 'inward' ? '#43ff8e' : pageMode === 'outward' ? '#06b6d4' : '#facc15',
                boxShadow: pageMode === 'inward' ? '0 0 12px rgba(67,255,142,0.2)' : pageMode === 'outward' ? '0 0 12px rgba(6,182,212,0.2)' : '0 0 12px rgba(250,204,21,0.2)',
              }}>
                <span style={{
                  width:'5px', height:'5px', borderRadius:'50%', flexShrink:0,
                  background: pageMode === 'inward' ? '#43ff8e' : pageMode === 'outward' ? '#06b6d4' : '#facc15',
                  boxShadow: `0 0 6px ${pageMode === 'inward' ? '#43ff8e' : pageMode === 'outward' ? '#06b6d4' : '#facc15'}`,
                }} />
                {pageMode === 'inward' ? '⬇ Inward' : pageMode === 'outward' ? '⬆ Outward' : '⟳ Default'}
              </div>
              <h2 style={{
                margin:0, fontSize:'1.7rem', fontWeight:800,
                fontFamily:"'Playfair Display', 'Cormorant Garamond', Georgia, serif",
                fontStyle:'italic', letterSpacing:'0.01em', lineHeight:1.15,
                background:'linear-gradient(90deg, #ffffff 0%, #c7f4ff 30%, #43ff8e 60%, #06b6d4 100%)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
                filter:'drop-shadow(0 2px 12px rgba(67,255,142,0.25))',
              }}>
                {pageMode === 'inward'
                  ? 'QR Scanner — Gate Entry + Weight'
                  : pageMode === 'outward'
                    ? 'QR Scanner — Gate Entry'
                    : 'QR Scanner — Gate Entry + Weight Document'}
              </h2>
              <div style={{ width:'65%', height:'1px', margin:'8px auto', background:'linear-gradient(90deg, transparent, rgba(67,255,142,0.45), rgba(6,182,212,0.45), rgba(139,92,246,0.3), transparent)' }} />
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', flexWrap:'wrap' }}>
                <span style={{ color:'#94d8f8', fontWeight:500, fontSize:'0.83rem', fontFamily:"'Playfair Display', Georgia, serif", letterSpacing:'0.03em', display:'flex', alignItems:'center', gap:'5px' }}>
                  <span>📡</span>
                  Scan QR slip to auto-fill vehicle &amp; invoice details
                </span>
                {/* <span style={{ background:'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(6,182,212,0.2))', border:'1px solid rgba(139,92,246,0.45)', borderRadius:'8px', padding:'2px 10px', fontSize:'0.72rem', color:'#c4b5fd', fontWeight:700, letterSpacing:'0.05em', boxShadow:'0 0 8px rgba(139,92,246,0.15)' }}>
                  🏗 Gate 2
                </span> */}
                <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', background:'rgba(67,255,142,0.1)', border:'1px solid rgba(67,255,142,0.3)', borderRadius:'8px', padding:'2px 10px', fontSize:'0.72rem', color:'#43ff8e', fontWeight:700, letterSpacing:'0.06em' }}>
                  <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#43ff8e', boxShadow:'0 0 6px #43ff8e, 0 0 10px rgba(67,255,142,0.6)', display:'inline-block' }} />
                  LIVE
                </span>
              </div>
          </div>
        </div>

        <div style={{
          position: 'absolute',
          top: '0',
          right: '0',
          bottom: '0',
          width: 'clamp(120px, 22vw, 240px)',
          pointerEvents: 'none',
          opacity: 0.94,
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'flex-end',
          
          overflow: 'hidden',
        }}>
          <img
            src="/ChatGPT%20Image%20Mar%2026,%202026,%2004_04_01%20PM.png"
            alt="Scanner"
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: 'cover',
              objectPosition: 'right center',
              maskImage: 'linear-gradient(90deg, transparent 0%, black 35%, black 100%)',
              WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 35%, black 100%)',
            }}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.type !== 'submit') {
          e.preventDefault();
        }
      }}>
        <section className="form-section">
          <h3 className="section-title">Header Information</h3>
          <div className="grid-7-cols">
            <div className="form-group">
              <label className="form-label">Gate Entry Number</label>
              <input className="form-input" name="GateEntryNumber" value={header.GateEntryNumber} readOnly style={{ background: '#f0f0f0' }} />
            </div>

            <div className="form-group">
              <label className="form-label">Weight Doc Number</label>
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
              {duplicateMdpError && (
                <div className="error-message" style={{ marginTop: '8px' }}>
                  <strong>Error:</strong> {duplicateMdpError}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="form-section">
          <h3 className="section-title">Purchase Order Details</h3>
          <div className="po-entry-card">
            <h4 className="po-entry-title">PO Entry</h4>
            <div className="grid-7-cols">
              <div className="form-group">
                <label className="form-label">PO Number</label>
                <input className="form-input" name="PurchaseOrderNumber" value={header.PurchaseOrderNumber} onChange={handleChange} />
                {poApprovalError && (
                  <div className="error-message" style={{ marginTop: '8px' }}>
                    <strong>Error:</strong> {poApprovalError}
                  </div>
                )}
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
              <div className="form-group">
                <label className="form-label">PO Quantity</label>
                <input className="form-input" name="BalanceQty3" type="text" inputMode="decimal" value={header.BalanceQty3} onChange={handleChange} placeholder="0.000" />
              </div>
            </div>
          </div>
        </section>

        <div className="form-actions">
          <div className="form-group" style={{ minWidth: '280px', marginBottom: 0 }}>
            <label className="form-label" style={{ color: '#0b5ed7', fontWeight: 700 }}>Gross Weight *</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                className="form-input"
                name="GrossWeight"
                value={header.GrossWeight}
                readOnly
                placeholder="0"
                style={{ borderColor: '#0b5ed7', backgroundColor: '#f0f0f0' }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleGetGrossWeight}
                disabled={grossWeightLoading || loading}
                style={{ whiteSpace: 'nowrap', backgroundColor: '#ff8c00', borderColor: '#ff8c00', color: '#fff' }}
              >
                {grossWeightLoading ? 'Getting...' : 'Get Gross'}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className={`btn btn-primary ${loading ? 'disabled' : ''}`}>
            {loading ? "Creating..." : "✅ Create Gate Entry"}
          </button>
          {/* <button type="button" onClick={resetForm} className="btn btn-secondary">Reset Form</button> */}
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