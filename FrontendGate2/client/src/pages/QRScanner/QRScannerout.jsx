// Helper to parse SAP duration (e.g. PT15H46M07S) to HH:MM:SS
function parseSapDurationToTime(sapDuration) {
  if (!sapDuration) return '-';
  const m = sapDuration.match(/^PT(\d{1,2})H(\d{1,2})M(\d{1,2})S$/i);
  if (!m) return '-';
  const [, h, mnt, s] = m;
  return [h, mnt, s].map(v => v.padStart(2, '0')).join(':');
}

// Helper to parse ISO date (e.g. 2026-04-04T00:00:00) to DD-MM-YYYY (Indian format)
function parseIsoDateToDMY(isoDate) {
  if (!isoDate) return '-';
  let d = isoDate;
  if (d.includes('T')) d = d.split('T')[0];
  if (d === '0000-00-00') return '-';
  const [yyyy, mm, dd] = d.split('-');
  if (!yyyy || !mm || !dd) return '-';
  return `${dd}-${mm}-${yyyy}`;
}

// Helper to format JS Date to DD-MM-YYYY
function formatDateDMY(date) {
  if (!date) return '-';
  if (typeof date === 'string') {
    // Try to parse as ISO or OData
    if (date.match(/^\d{4}-\d{2}-\d{2}/)) {
      return parseIsoDateToDMY(date);
    }
    // OData format: /Date(1710115200000)/
    const m = date.match(/^\/Date\((\d+)(?:[+-]\d+)?\)\/$/);
    if (m) {
      const d = new Date(Number(m[1]));
      return formatDateDMY(d);
    }
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// Helper to format time (HH:MM:SS) from SAP duration or string
function formatTimeHHMMSS(val) {
  if (!val) return '-';
  if (typeof val === 'string') {
    // SAP duration: PT15H46M07S
    const m = val.match(/^PT(\d{1,2})H(\d{1,2})M(\d{1,2})S$/i);
    if (m) {
      return [m[1], m[2], m[3]].map(v => v.padStart(2, '0')).join(':');
    }
    // Already HH:MM:SS
    if (/^\d{2}:\d{2}:\d{2}$/.test(val)) return val;
    // ISO string
    if (val.includes('T')) {
      const t = val.split('T')[1];
      return t ? t.split('.')[0] : '-';
    }
  }
  if (val instanceof Date) {
    return val.toTimeString().split(' ')[0];
  }
  return String(val);
}
// Print weighment slip (logo is now in JSX)
  const handlePrintSlip = () => {
    const printContents = document.getElementById('weighment-slip-print-area').innerHTML;
    const originalContents = document.body.innerHTML;
    document.body.innerHTML = printContents;
    window.print();
    document.body.innerHTML = originalContents;
    window.location.reload(); // reload to restore event handlers
  };
// Version 6 - Create Gate Entry + Material Inward (Weight Document) together
import React, { useState, useEffect, useRef } from "react";
import { createHeader, createMaterialInward, sendEmailNotification,fetchPurchaseOrderByPermitNumber ,
    updateMaterialInward,
  fetchWeightDetailsByVendorInvoiceNumber,
  fetchMaterialInwardByGateNumber,
  fetchGateEntryByNumber,
  checkVehicleStatus,
  fetchPurchaseOrderByNumber,
  transporterDetails,
  updateHeaderByKey,
  fetchTareWeightFromBridge
} from "../../api";
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
      TareWeight: "",
      GrossWeight: "",
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
  // Store the original BalanceQty for calculation (production safe)
  const [originalBalance, setOriginalBalance] = useState(null);
  // Store the original BalanceQty from backend only once
  useEffect(() => {
    if (header.BalanceQty && originalBalance === null) {
      setOriginalBalance(parseFloat(header.BalanceQty));
    }
  }, [header.BalanceQty, originalBalance]);
  const [loading, setLoading] = useState(false);
  const [tareWeightLoading, setTareWeightLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [scanFetchTick, setScanFetchTick] = useState(0);
  const [selectedInboundRecord, setSelectedInboundRecord] = useState(null);
  const [transporterDropdown, setTransporterDropdown] = useState({
    show: false,
    field: '',
    list: [],
    loading: false,
  });
  
  const transporterSearchTimeoutRef = useRef(null);
  const permitLookupTimeoutRef = useRef(null);
  const poLookupTimeoutRef = useRef(null);
  const lookupRequestRef = useRef(0);

  const location = useLocation();
  const pathTail = location.pathname.split("/").pop();
  const pageMode = pathTail === "inward" ? "inward" : (pathTail === "outward" ? "outward" : "default");

  const parseNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const normalized = String(value).replace(/,/g, '').trim();
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  };

  const extractResults = (payload) => {
    const data = payload?.data ?? payload;
    if (Array.isArray(data?.d?.results)) return data.d.results;
    if (Array.isArray(data?.value)) return data.value;
    if (Array.isArray(data?.results)) return data.results;
    return [];
  };

  const getRecordTimestamp = (record) => {
    const rawTs =
      record?.SAP_LastChangedDateTime ||
      record?.LastChangedDateTime ||
      record?.SAP_CreatedDateTime ||
      record?.CreatedAt ||
      record?.GateOutDate ||
      record?.GateEntryDate ||
      '';
    if (!rawTs) return 0;
    const t = new Date(rawTs).getTime();
    return Number.isNaN(t) ? 0 : t;
  };

  const getGateEntryNumberRank = (record) => {
    const raw = String(record?.GateEntryNumber || '').replace(/\D/g, '');
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  };

  const isCancelledStatus = (value) => String(value || '').trim().toUpperCase() === 'CANCELLED';

  const pickBestWeightRecord = (records, preferredWeightDocNumber = '') => {
    if (!Array.isArray(records) || records.length === 0) return null;

    const preferred = String(preferredWeightDocNumber || '').trim();
    if (preferred) {
      const exact = records.find((r) => String(r?.WeightDocNumber || '').trim() === preferred);
      if (exact) return exact;
    }

    const sorted = [...records].sort((a, b) => {
      const tsDiff = getRecordTimestamp(b) - getRecordTimestamp(a);
      if (tsDiff !== 0) return tsDiff;
      return getGateEntryNumberRank(b) - getGateEntryNumberRank(a);
    });

    // Prefer latest gate entry first; if it has no gross, then fallback to latest with gross.
    const latestRecord = sorted[0];
    const latestGross = parseNumber(latestRecord?.GrossWeight);
    if (latestRecord && latestGross !== null) {
      return latestRecord;
    }

    const withPositiveGross = sorted.find((r) => {
      const gross = parseNumber(r?.GrossWeight);
      return gross !== null && gross > 0;
    });
    if (withPositiveGross) return withPositiveGross;

    const withAnyGross = sorted.find((r) => String(r?.GrossWeight ?? '').trim() !== '');
    return withAnyGross || sorted[0];
  };

  const fetchWeightDocByVendorInvoice = async (vendorInvoiceNumber, context = {}) => {
    const firstDefinedValue = (...values) => {
      for (const value of values) {
        if (value !== null && value !== undefined && String(value) !== '') return value;
      }
      return '';
    };

    const toFieldString = (value, fallback = '') => {
      if (value === null || value === undefined || value === '') return fallback;
      return String(value);
    };

    const toInputDate = (value, fallback = '') => {
      if (!value) return fallback;
      const raw = String(value).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

      // SAP OData V2 date format: /Date(1710115200000)/
      const sapMatch = raw.match(/^\/Date\((\d+)(?:[+-]\d+)?\)\/$/);
      if (sapMatch) {
        const ms = Number(sapMatch[1]);
        if (Number.isFinite(ms)) {
          const d = new Date(ms);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        }
      }

      const part = raw.split('T')[0];
      return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : fallback;
    };

    const sapDurationToClock = (value, fallback = '') => {
      if (!value) return fallback;
      const v = String(value).trim();
      const m = v.match(/^PT(\d{1,2})H(\d{1,2})M(\d{1,2})S$/i);
      if (!m) return fallback || v;
      const [, h, mm, s] = m;
      return `${h.padStart(2, '0')}:${mm.padStart(2, '0')}:${s.padStart(2, '0')}`;
    };

    const applyFetchedRecordToHeader = (record) => {
      const parsedRemarks = parseQRRemarks(String(record.Remarks || ''));
      setHeader((prev) => ({
        ...prev,
        GateEntryNumber: toFieldString(record.GateEntryNumber, prev.GateEntryNumber),
        WeightDocNumber: toFieldString(record.WeightDocNumber, prev.WeightDocNumber),
        GateEntryDate: toInputDate(record.HeaderGateEntryDate || record.GateEntryDate, prev.GateEntryDate),
        InwardTime: sapDurationToClock(record.InwardTime, prev.InwardTime),
        OutwardTime: sapDurationToClock(record.HeaderOutwardTime || record.OutwardTime, prev.OutwardTime),
        VehicleNumber: toFieldString(record.HeaderVehicleNumber || record.TruckNumber || record.VehicleNumber, prev.VehicleNumber),
        TransporterCode: toFieldString(record.TransporterCode, prev.TransporterCode),
        TransporterName: toFieldString(record.TransporterName, prev.TransporterName),
        DriverName: toFieldString(firstDefinedValue(record.DriverName, record.HeaderDriverName), prev.DriverName),
        DriverPhoneNumber: toFieldString(firstDefinedValue(record.DriverPhoneNumber, record.DriverPhone, record.DriverMobile, record.HeaderDriverPhoneNumber), prev.DriverPhoneNumber),
        LRGCNumber: toFieldString(firstDefinedValue(record.LRGCNumber, parsedRemarks.mteNumber), prev.LRGCNumber),
        PermitNumber: toFieldString(firstDefinedValue(record.HeaderPermitNumber, record.PermitNumber, record.PermitNo, record.DLNumber, parsedRemarks.PermitNumber), prev.PermitNumber),
        EWayBill: record.EWayBill !== undefined && record.EWayBill !== null ? Boolean(record.EWayBill) : prev.EWayBill,
        Division: toFieldString(record.Division, prev.Division),
        Remarks: toFieldString(record.Remarks, prev.Remarks),
        SubTransporterName: toFieldString(firstDefinedValue(record.SubTransporterName, record.SubTransporter), prev.SubTransporterName),
        // Do NOT auto-fill TareWeight from fetched record; always keep as is (empty or user input)
        // TareWeight: toFieldString(record.TareWeight, prev.TareWeight),
        GrossWeight: toFieldString(firstDefinedValue(record.GrossWeight, record.GrossWeght), prev.GrossWeight),
        NetWeight: toFieldString(firstDefinedValue(record.NetWeight, record.NetWeght), prev.NetWeight),
        PurchaseOrderNumber: toFieldString(firstDefinedValue(record.PurchaseOrderNumber, record.PurchaseOrder, record.SalesDocument), prev.PurchaseOrderNumber),
        Material: toFieldString(firstDefinedValue(record.Material, parsedRemarks.material), prev.Material),
        MaterialDescription: toFieldString(firstDefinedValue(record.MaterialDescription, parsedRemarks.grade), prev.MaterialDescription),
        Vendor: toFieldString(firstDefinedValue(record.Vendor, record.Supplier, record.Customer), prev.Vendor),
        VendorName: toFieldString(firstDefinedValue(record.VendorName, record.SupplierName, record.CustomerName), prev.VendorName),
        VendorInvoiceNumber: toFieldString(firstDefinedValue(record.VendorInvoiceNumber, record.HandInvoiceNumber, record.SalesDocument, parsedRemarks.VendorInvoiceNumber), prev.VendorInvoiceNumber),
        VendorInvoiceDate: toInputDate(
          firstDefinedValue(
            record.VendorInvoiceDate,
            record["d:VendorInvoiceDate"],
            record.HeaderVendorInvoiceDate,
            record["d:HeaderVendorInvoiceDate"],
            record.GateEntryDate,
            parsedRemarks.VendorInvoiceDate
          ),
          prev.VendorInvoiceDate
        ),
       
        VendorInvoiceWeight: toFieldString(firstDefinedValue(record.VendorInvoiceWeight, parsedRemarks.VendorInvoiceWeight, record.GrossWeight), prev.VendorInvoiceWeight),
        BalanceQty: toFieldString(record.BalanceQty, prev.BalanceQty),
        // Only BalanceQty is used for main Balance Quantity in this screen
        // BalanceQty2, BalanceQty3, etc. are ignored for this field
      }));
    };

    const normalizeToken = (value) => String(value || '').trim().toUpperCase();

    try {
      const resp = await fetchWeightDetailsByVendorInvoiceNumber(vendorInvoiceNumber, {
        vehicleNumber: context?.vehicleNumber,
        permitNumber: context?.permitNumber,
        material: context?.material,
        grade: context?.grade,
        includeOut: true,
      });
      const records = extractResults(resp);

      const scannedVehicle = normalizeToken(context?.vehicleNumber);
      const scannedPermit = normalizeToken(context?.permitNumber);

      let scopedRecords = records;
      if (scannedVehicle) {
        const truckMatched = records.filter((r) => {
          const recVehicle = normalizeToken(r?.TruckNumber || r?.VehicleNumber);
          return recVehicle && recVehicle === scannedVehicle;
        });
        if (truckMatched.length > 0) {
          scopedRecords = truckMatched;
        }
      }

      if (scannedPermit) {
        const permitMatched = scopedRecords.filter((r) => {
          const recPermit = normalizeToken(r?.PermitNumber);
          return recPermit && recPermit === scannedPermit;
        });
        if (permitMatched.length > 0) {
          scopedRecords = permitMatched;
        }
      }

      const record = pickBestWeightRecord(scopedRecords);

      if (record) {
        const gateNo = String(record.GateEntryNumber || '').trim();
        let gateHeader = null;
        if (gateNo) {
          try {
            const hdrResp = await fetchGateEntryByNumber(gateNo);
            const hdrResults = hdrResp?.data?.d?.results || hdrResp?.data?.value || [];
            gateHeader = Array.isArray(hdrResults) ? hdrResults[0] : null;
          } catch (e) {
            gateHeader = null;
          }
        }

        const hydratedRecord = {
          ...(record || {}),
          ...(gateHeader || {}),
          WeightSAPUUID: record?.SAP_UUID || record?.UUID || record?.Guid || record?.GUID || '',
          HeaderSAPUUID: gateHeader?.SAP_UUID || gateHeader?.UUID || gateHeader?.Guid || gateHeader?.GUID || record?.HeaderSAPUUID || '',
          HeaderVehicleNumber: gateHeader?.VehicleNumber || record?.HeaderVehicleNumber || record?.TruckNumber || '',
          HeaderPermitNumber: gateHeader?.PermitNumber || record?.HeaderPermitNumber || record?.PermitNumber || '',
          HeaderGateEntryDate: gateHeader?.GateEntryDate || record?.HeaderGateEntryDate || null,
          HeaderOutwardTime: gateHeader?.OutwardTime || record?.HeaderOutwardTime || '',
          GrossWeight: record?.GrossWeight ?? gateHeader?.GrossWeight,
          TareWeight: record?.TareWeight ?? gateHeader?.TareWeight,
          NetWeight: record?.NetWeight ?? gateHeader?.NetWeight,
        };

        const recordStatus = String(hydratedRecord.VehicleStatus || '').toUpperCase();
        if (recordStatus === 'OUT') {
          setSelectedInboundRecord(null);
          setError(`Vehicle already OUT for Gate Entry ${hydratedRecord.GateEntryNumber || ''}`.trim());
          return;
        }

        setSelectedInboundRecord(hydratedRecord);
        applyFetchedRecordToHeader(hydratedRecord);
        setError(null);
        // Clear TareWeight only ONCE after a successful fetch
        setHeader(prev => ({ ...prev, TareWeight: "" }));
      } else {
        setSelectedInboundRecord(null);
        setError('No record found for this Vendor Invoice Number');
      }
    } catch (err) {
      setSelectedInboundRecord(null);
      setError('No record found for this Vendor Invoice Number');
    }
  };

  const fetchOutDataByGateEntryNumber = async (gateEntryNumber) => {
    const requestId = ++lookupRequestRef.current;
    const isActiveRequest = () => requestId === lookupRequestRef.current;
    const normalizeToken = (value) => String(value || '').trim().toUpperCase();
    const toFieldString = (value, fallback = '') => {
      if (value === null || value === undefined || value === '') return fallback;
      return String(value);
    };
    const firstDefinedValue = (...values) => {
      for (const value of values) {
        if (value !== null && value !== undefined && String(value) !== '') return value;
      }
      return '';
    };

    const toInputDate = (value, fallback = '') => {
      if (!value) return fallback;
      const raw = String(value).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

      // SAP OData V2 date format: /Date(1710115200000)/
      const sapMatch = raw.match(/^\/Date\((\d+)(?:[+-]\d+)?\)\/$/);
      if (sapMatch) {
        const ms = Number(sapMatch[1]);
        if (Number.isFinite(ms)) {
          const d = new Date(ms);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        }
      }

      const part = raw.split('T')[0];
      return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : fallback;
    };

    const sapDurationToClock = (value, fallback = '') => {
      if (!value) return fallback;
      const v = String(value).trim();
      const m = v.match(/^PT(\d{1,2})H(\d{1,2})M(\d{1,2})S$/i);
      if (!m) return fallback || v;
      const [, h, mm, s] = m;
      return `${h.padStart(2, '0')}:${mm.padStart(2, '0')}:${s.padStart(2, '0')}`;
    };

    const applyFetchedRecordToHeader = (record) => {
      const parsedRemarks = parseQRRemarks(String(record.Remarks || ''));
      setHeader((prev) => ({
        ...prev,
        GateEntryNumber: toFieldString(record.GateEntryNumber, prev.GateEntryNumber),
        WeightDocNumber: toFieldString(record.WeightDocNumber, prev.WeightDocNumber),
        GateEntryDate: toInputDate(record.HeaderGateEntryDate || record.GateEntryDate, prev.GateEntryDate),
        InwardTime: sapDurationToClock(record.InwardTime, prev.InwardTime),
        // --- Ensure GateOutDate and OutwardTime are always mapped and formatted ---
        GateOutDate: toInputDate(
          firstDefinedValue(
            record.GateOutDate,
            record.HeaderGateOutDate,
            record["d:GateOutDate"],
            record["d:HeaderGateOutDate"],
            prev.GateOutDate
          )
        ),
        OutwardTime: sapDurationToClock(
          firstDefinedValue(
            record.OutwardTime,
            record.HeaderOutwardTime,
            record["d:OutwardTime"],
            record["d:HeaderOutwardTime"],
            prev.OutwardTime
          )
        ),
        VehicleNumber: toFieldString(record.HeaderVehicleNumber || record.TruckNumber || record.VehicleNumber, prev.VehicleNumber),
        TransporterCode: toFieldString(record.TransporterCode, prev.TransporterCode),
        TransporterName: toFieldString(record.TransporterName, prev.TransporterName),
        DriverName: toFieldString(firstDefinedValue(record.DriverName, record.HeaderDriverName), prev.DriverName),
        DriverPhoneNumber: toFieldString(firstDefinedValue(record.DriverPhoneNumber, record.DriverPhone, record.DriverMobile, record.HeaderDriverPhoneNumber), prev.DriverPhoneNumber),
        LRGCNumber: toFieldString(firstDefinedValue(record.LRGCNumber, parsedRemarks.mteNumber), prev.LRGCNumber),
        PermitNumber: toFieldString(firstDefinedValue(record.HeaderPermitNumber, record.PermitNumber, record.PermitNo, record.DLNumber, parsedRemarks.PermitNumber), prev.PermitNumber),
        EWayBill: record.EWayBill !== undefined && record.EWayBill !== null ? Boolean(record.EWayBill) : prev.EWayBill,
        Division: toFieldString(record.Division, prev.Division),
        Remarks: toFieldString(record.Remarks, prev.Remarks),
        SubTransporterName: toFieldString(firstDefinedValue(record.SubTransporterName, record.SubTransporter), prev.SubTransporterName),
        TareWeight: toFieldString(record.TareWeight, prev.TareWeight),
        GrossWeight: toFieldString(firstDefinedValue(record.GrossWeight, record.GrossWeght), prev.GrossWeight),
        NetWeight: toFieldString(firstDefinedValue(record.NetWeight, record.NetWeght), prev.NetWeight),
        PurchaseOrderNumber: toFieldString(firstDefinedValue(record.PurchaseOrderNumber, record.PurchaseOrder, record.SalesDocument), prev.PurchaseOrderNumber),
        Material: toFieldString(firstDefinedValue(record.Material, parsedRemarks.material), prev.Material),
        MaterialDescription: toFieldString(firstDefinedValue(record.MaterialDescription, parsedRemarks.grade), prev.MaterialDescription),
        Vendor: toFieldString(firstDefinedValue(record.Vendor, record.Supplier, record.Customer), prev.Vendor),
        VendorName: toFieldString(firstDefinedValue(record.VendorName, record.SupplierName, record.CustomerName), prev.VendorName),
        VendorInvoiceNumber: toFieldString(firstDefinedValue(record.VendorInvoiceNumber, record.HandInvoiceNumber, record.SalesDocument, parsedRemarks.VendorInvoiceNumber), prev.VendorInvoiceNumber),
        VendorInvoiceDate: toInputDate(
          firstDefinedValue(
            record.VendorInvoiceDate,
            record["d:VendorInvoiceDate"],
            record.HeaderVendorInvoiceDate,
            record["d:HeaderVendorInvoiceDate"],
            record.GateEntryDate,
            parsedRemarks.VendorInvoiceDate
          ),
          prev.VendorInvoiceDate
        ),
        VendorInvoiceWeight: toFieldString(firstDefinedValue(record.VendorInvoiceWeight, parsedRemarks.VendorInvoiceWeight, record.GrossWeight), prev.VendorInvoiceWeight),
        BalanceQty: toFieldString(record.BalanceQty, prev.BalanceQty),
      }));
    };

    try {
      const [weightResp, headerResp] = await Promise.all([
        fetchMaterialInwardByGateNumber(gateEntryNumber),
        fetchGateEntryByNumber(gateEntryNumber),
      ]);

      const weightRecords = extractResults(weightResp);
      const headerRecords = extractResults(headerResp);
      const gateHeader = Array.isArray(headerRecords) ? headerRecords[0] : null;

      const weightRecord = pickBestWeightRecord(weightRecords);
      if (!weightRecord && !gateHeader) {
        if (isActiveRequest()) {
          setSelectedInboundRecord(null);
          setError('No record found for this Gate Entry Number');
        }
        return;
      }

      const headerStatus = gateHeader?.Status || gateHeader?.['d:Status'] || '';
      const weightStatus = weightRecord?.Status || weightRecord?.['d:Status'] || '';
      if (isCancelledStatus(headerStatus) || isCancelledStatus(weightStatus)) {
        if (isActiveRequest()) {
          setSelectedInboundRecord(null);
          setError(`Gate Entry ${gateEntryNumber} is cancelled. Please scan a valid slip.`);
        }
        return;
      }

      const vehicleStatus = normalizeToken(gateHeader?.VehicleStatus || weightRecord?.VehicleStatus);
      if (vehicleStatus === 'OUT') {
        if (isActiveRequest()) {
          setSelectedInboundRecord(null);
          setError(`Vehicle already OUT for Gate Entry ${gateEntryNumber}`);
        }
        return;
      }

      const mergedRecord = {
        ...(weightRecord || {}),
        ...(gateHeader || {}),
        WeightSAPUUID: weightRecord?.SAP_UUID || weightRecord?.UUID || weightRecord?.Guid || weightRecord?.GUID || '',
        VehicleStatus: gateHeader?.VehicleStatus || weightRecord?.VehicleStatus || 'IN',
        HeaderSAPUUID: gateHeader?.SAP_UUID || gateHeader?.UUID || gateHeader?.Guid || gateHeader?.GUID || '',
        HeaderVehicleNumber: gateHeader?.VehicleNumber || weightRecord?.HeaderVehicleNumber || weightRecord?.TruckNumber || '',
        HeaderPermitNumber: gateHeader?.PermitNumber || weightRecord?.HeaderPermitNumber || weightRecord?.PermitNumber || '',
        HeaderGateEntryDate: gateHeader?.GateEntryDate || weightRecord?.HeaderGateEntryDate || null,
        HeaderOutwardTime: gateHeader?.OutwardTime || weightRecord?.HeaderOutwardTime || '',
        GateEntryNumber: gateHeader?.GateEntryNumber || weightRecord?.GateEntryNumber || gateEntryNumber,
        GrossWeight: weightRecord?.GrossWeight ?? gateHeader?.GrossWeight,
        TareWeight: weightRecord?.TareWeight ?? gateHeader?.TareWeight,
        NetWeight: weightRecord?.NetWeight ?? gateHeader?.NetWeight,
      };

      if (!isActiveRequest()) return;
      setSelectedInboundRecord(mergedRecord);
      applyFetchedRecordToHeader(mergedRecord);
      setError(null);
    } catch (err) {
      if (isActiveRequest()) {
        setSelectedInboundRecord(null);
        setError('No record found for this Gate Entry Number');
      }
    }
  };

  const fetchActiveInByVehicleNumber = async (vehicleNumber) => {
    const scannedVehicle = String(vehicleNumber || '').trim();
    if (!scannedVehicle) return false;

    try {
      const resp = await checkVehicleStatus(scannedVehicle);
      const records = resp?.data?.d?.results || resp?.data?.value || [];

      if (!Array.isArray(records) || records.length === 0) {
        setSelectedInboundRecord(null);
        setError(`There is no active vehicle for ${scannedVehicle}`);
        return false;
      }

      const sorted = [...records].sort((a, b) => {
        const tsDiff = getRecordTimestamp(b) - getRecordTimestamp(a);
        if (tsDiff !== 0) return tsDiff;
        return getGateEntryNumberRank(b) - getGateEntryNumberRank(a);
      });

      const activeIn = sorted.find((r) => String(r?.VehicleStatus || '').toUpperCase() === 'IN');
      if (!activeIn?.GateEntryNumber) {
        setSelectedInboundRecord(null);
        setError(`There is no active vehicle for ${scannedVehicle}`);
        return false;
      }

      await fetchOutDataByGateEntryNumber(String(activeIn.GateEntryNumber));
      return true;
    } catch (err) {
      setSelectedInboundRecord(null);
      setError(`There is no active vehicle for ${scannedVehicle}`);
      return false;
    }
  };

  const fetchOutDataByScanCriteria = async (vendorInvoiceNumber, vehicleNumber) => {
    const requestId = ++lookupRequestRef.current;
    const isActiveRequest = () => requestId === lookupRequestRef.current;
    const normalizeToken = (value) => String(value || '').trim().toUpperCase();
    const scannedInvoice = normalizeToken(vendorInvoiceNumber);
    const scannedVehicle = normalizeToken(vehicleNumber);
    const escapeODataValue = (value) => String(value || '').replace(/'/g, "''");

    const precheckVehicleStatus = async () => {
      try {
        const vehicleResp = await checkVehicleStatus(vehicleNumber);
        const vehicleRecords = vehicleResp?.data?.d?.results || vehicleResp?.data?.value || [];
        if (!Array.isArray(vehicleRecords) || vehicleRecords.length === 0) {
          return { block: false };
        }

        const sortedVehicleRecords = [...vehicleRecords].sort((a, b) => {
          const tsDiff = getRecordTimestamp(b) - getRecordTimestamp(a);
          if (tsDiff !== 0) return tsDiff;
          return getGateEntryNumberRank(b) - getGateEntryNumberRank(a);
        });

        const latestRecord = sortedVehicleRecords[0];
        const latestStatus = normalizeToken(latestRecord?.VehicleStatus);
        if (latestStatus === 'OUT') {
          const outGateEntry = String(latestRecord?.GateEntryNumber || '').trim();
          return {
            block: true,
            message: `Vehicle already OUT${outGateEntry ? ` for Gate Entry ${outGateEntry}` : ''}`,
          };
        }

        return { block: false };
      } catch (e) {
        // Ignore pre-check errors and continue with detailed lookup flow.
        return { block: false };
      }
    };

    const tryHeaderFallback = async () => {
      const safeInvoice = escapeODataValue(vendorInvoiceNumber);
      const headerResp = await fetchGateEntryByNumber(`$filter=VendorInvoiceNumber eq '${safeInvoice}'`);
      const headerRecords = extractResults(headerResp);

      if (!Array.isArray(headerRecords) || headerRecords.length === 0) {
        return false;
      }

      const vehicleMatchedHeaders = headerRecords.filter((h) => {
        const recVehicle = normalizeToken(h?.VehicleNumber || h?.['d:VehicleNumber']);
        return recVehicle && recVehicle === scannedVehicle;
      });

      if (vehicleMatchedHeaders.length === 0) {
        if (isActiveRequest()) {
          setSelectedInboundRecord(null);
          setError(`Vendor Invoice matched, but vehicle ${vehicleNumber} did not match`);
        }
        return false;
      }

      const nonCancelled = vehicleMatchedHeaders.filter((h) => !isCancelledStatus(h?.Status || h?.['d:Status']));
      if (nonCancelled.length === 0) {
        if (isActiveRequest()) {
          setSelectedInboundRecord(null);
          setError('This slip is cancelled. Please scan a valid slip.');
        }
        return false;
      }

      const inStatusHeaders = nonCancelled.filter((h) => normalizeToken(h?.VehicleStatus || h?.['d:VehicleStatus']) === 'IN');
      if (inStatusHeaders.length === 0) {
        const outStatusHeader = nonCancelled.find((h) => normalizeToken(h?.VehicleStatus || h?.['d:VehicleStatus']) === 'OUT');
        if (outStatusHeader) {
          const outGateEntry = String(outStatusHeader?.GateEntryNumber || outStatusHeader?.['d:GateEntryNumber'] || '').trim();
          if (isActiveRequest()) {
            setSelectedInboundRecord(null);
            setError(`Vehicle already OUT${outGateEntry ? ` for Gate Entry ${outGateEntry}` : ''}`);
          }
          return false;
        }

        if (isActiveRequest()) {
          setSelectedInboundRecord(null);
          setError(`Matched records are not in IN status for vehicle ${vehicleNumber}`);
        }
        return false;
      }

      const chosenHeader = [...inStatusHeaders].sort((a, b) => {
        const tsDiff = getRecordTimestamp(b) - getRecordTimestamp(a);
        if (tsDiff !== 0) return tsDiff;
        return getGateEntryNumberRank(b) - getGateEntryNumberRank(a);
      })[0];

      const gateEntryNumber = String(chosenHeader?.GateEntryNumber || chosenHeader?.['d:GateEntryNumber'] || '').trim();
      if (!gateEntryNumber) {
        return false;
      }

      await fetchOutDataByGateEntryNumber(gateEntryNumber);
      return true;
    };

    if (!scannedInvoice || !scannedVehicle) {
      if (isActiveRequest()) {
        setSelectedInboundRecord(null);
        setError('Scan must include both Vendor Invoice Number and Vehicle Number');
      }
      return false;
    }

    try {
      // Start weight lookup immediately, but do not block fast OUT validation on it.
      const weightLookupPromise = fetchWeightDetailsByVendorInvoiceNumber(vendorInvoiceNumber, {
        vehicleNumber,
        includeOut: true,
      });
      const precheck = await precheckVehicleStatus();

      if (precheck?.block) {
        if (isActiveRequest()) {
          setSelectedInboundRecord(null);
          setError(precheck.message);
        }
        return false;
      }

      const resp = await weightLookupPromise;

      const records = extractResults(resp);
      if (!Array.isArray(records) || records.length === 0) {
        const resolvedFromHeader = await tryHeaderFallback();
        if (resolvedFromHeader) return true;
        if (isActiveRequest()) {
          setSelectedInboundRecord(null);
          setError(`No record found for Vendor Invoice ${vendorInvoiceNumber}`);
        }
        return false;
      }

      const invoiceMatched = records.filter((r) => {
        const recInvoice = normalizeToken(
          r?.VendorInvoiceNumber ||
          r?.['d:VendorInvoiceNumber'] ||
          r?.HandInvoiceNumber ||
          r?.SalesDocument
        );
        return recInvoice && recInvoice === scannedInvoice;
      });

      if (invoiceMatched.length === 0) {
        const resolvedFromHeader = await tryHeaderFallback();
        if (resolvedFromHeader) return true;
        if (isActiveRequest()) {
          setSelectedInboundRecord(null);
          setError(`Vendor Invoice ${vendorInvoiceNumber} did not match any record`);
        }
        return false;
      }

      const vehicleMatched = invoiceMatched.filter((r) => {
        const recVehicle = normalizeToken(r?.TruckNumber || r?.VehicleNumber || r?.HeaderVehicleNumber);
        return recVehicle && recVehicle === scannedVehicle;
      });

      if (vehicleMatched.length === 0) {
        const resolvedFromHeader = await tryHeaderFallback();
        if (resolvedFromHeader) return true;
        if (isActiveRequest()) {
          setSelectedInboundRecord(null);
          setError(`Vendor Invoice matched, but vehicle ${vehicleNumber} did not match`);
        }
        return false;
      }

      const nonCancelledRecords = vehicleMatched.filter((r) => !isCancelledStatus(r?.Status || r?.['d:Status']));
      if (nonCancelledRecords.length === 0) {
        if (isActiveRequest()) {
          setSelectedInboundRecord(null);
          setError('This slip is cancelled. Please scan a valid slip.');
        }
        return false;
      }

      const inStatusRecords = nonCancelledRecords.filter((r) => normalizeToken(r?.VehicleStatus) === 'IN');
      if (inStatusRecords.length === 0) {
        const outStatusRecord = vehicleMatched.find((r) => normalizeToken(r?.VehicleStatus) === 'OUT');
        if (outStatusRecord) {
          const outGateEntry = String(outStatusRecord?.GateEntryNumber || '').trim();
          if (isActiveRequest()) {
            setSelectedInboundRecord(null);
            setError(`Vehicle already OUT${outGateEntry ? ` for Gate Entry ${outGateEntry}` : ''}`);
          }
          return false;
        }
        if (isActiveRequest()) {
          setSelectedInboundRecord(null);
          setError(`Matched records are not in IN status for vehicle ${vehicleNumber}`);
        }
        return false;
      }

      const chosenRecord = pickBestWeightRecord(inStatusRecords) || inStatusRecords[0];
      const gateEntryNumber = String(chosenRecord?.GateEntryNumber || '').trim();

      if (!gateEntryNumber) {
        if (isActiveRequest()) {
          setSelectedInboundRecord(null);
          setError('Matched record has no Gate Entry Number');
        }
        return false;
      }

      await fetchOutDataByGateEntryNumber(gateEntryNumber);
      return true;
    } catch (err) {
      if (isActiveRequest()) {
        setSelectedInboundRecord(null);
        setError('Failed to fetch gate entry using scanned Vendor Invoice and Vehicle');
      }
      return false;
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // If user clears GrossWeight or TareWeight, reset NetWeight
    if ((name === 'GrossWeight' || name === 'TareWeight') && value === '') {
      setHeader(prev => ({
        ...prev,
        [name]: '',
        NetWeight: '',
        BalanceQty: originalBalance !== null ? originalBalance.toFixed(3) : prev.BalanceQty
      }));
      return;
    }

    // Prevent TareWeight > GrossWeight
    if (name === 'TareWeight') {
      const gross = parseFloat(header.GrossWeight);
      const tare = parseFloat(value);
      if (!isNaN(gross) && !isNaN(tare) && tare > gross) {
        setError('Tare Weight cannot be greater than Gross Weight.');
        return;
      } else {
        setError(null);
      }
    }

    if (name === 'GateEntryNumber') {
      setHeader((prev) => ({ ...prev, GateEntryNumber: value }));
      setSelectedInboundRecord(null);
      return;
    }

    if (name === 'TransporterCode' || name === 'TransporterName') {
      setHeader(prev => ({ ...prev, [name]: value }));
      debouncedFetchTransporters(value, name);
      return;
    }

    if (name.includes('VendorInvoiceWeight') || name.includes('BalanceQty') || name === 'GrossWeight') {
      if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
        setHeader(prev => ({ ...prev, [name]: value }));
      }
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
    }, 800);
    

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
    if (poNumber.length < 10) return;

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
        const plant = firstItem.Plant || firstItem.plant || resp?.data?.Plant || resp?.data?.plant || '';

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
    }, 800);

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


  // Fetch and fill saved values from Weight Document ONLY when user leaves VendorInvoiceNumber field
  const handleVendorInvoiceBlur = () => {
    if (pageMode === 'outward') return;
    const gateNo = String(header.GateEntryNumber || '').trim();
    if (gateNo.length >= 6) return;
    if (header.VendorInvoiceNumber && header.VendorInvoiceNumber.length > 0) {
      fetchWeightDocByVendorInvoice(header.VendorInvoiceNumber, {
        vehicleNumber: header.VehicleNumber,
        permitNumber: header.PermitNumber,
        material: header.Material,
        grade: header.MaterialDescription,
      });
    }
    if (header.BalanceQty && originalBalance === null) {
      setOriginalBalance(parseFloat(header.BalanceQty));
    }
  };

  // Direct lookup by gate entry number in outward screen.
  // Skip if selectedInboundRecord is already set — means the scan path already resolved it.
  useEffect(() => {
    if (pageMode !== 'outward') return;
    if (selectedInboundRecord) return;
    const gateNo = String(header.GateEntryNumber || '').trim();
    if (gateNo.length < 6) return;
    fetchOutDataByGateEntryNumber(gateNo);
  }, [header.GateEntryNumber, pageMode, selectedInboundRecord]);



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

  const parseBridgeWeightValue = (rawWeight) => {
    const cleaned = String(rawWeight || '')
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const numberMatch = cleaned.match(/-?\d+(?:\.\d+)?/);
    return numberMatch ? numberMatch[0] : '';
  };

  const handleGetTareWeight = async () => {
    setTareWeightLoading(true);
    setError(null);

    try {
      const response = await fetchTareWeightFromBridge();
      const rawWeight = response?.data?.data?.weight;
      const parsedWeight = parseBridgeWeightValue(rawWeight);

      if (!parsedWeight) {
        throw new Error('Unable to parse tare weight from weighbridge response');
      }

      setHeader((prev) => ({ ...prev, TareWeight: parsedWeight }));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setTareWeightLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const record = selectedInboundRecord;
      if (!record) {
        setError('No active IN record found for this scanned vehicle/invoice');
        setLoading(false);
        return;
      }

      const recordStatus = String(record.VehicleStatus || '').toUpperCase();
      if (recordStatus === 'OUT') {
        setError(`Vehicle already OUT for Gate Entry ${record.GateEntryNumber || ''}`.trim());
        setLoading(false);
        return;
      }

      // Use the correct field for UUID/guid (adjust as per SAP response)
      const weightUuid = record?.WeightSAPUUID || '';

      // Always recalculate NetWeight here for backend update (BalanceQty logic removed)
      const tareNum = parseFloat(header.TareWeight) || 0;
      const grossNum = parseFloat(header.GrossWeight) || 0;
      const netNum = grossNum - tareNum;

      if (!Number.isFinite(tareNum)) {
        setError('Please enter valid Tare Weight before OUT submit.');
        setLoading(false);
        return;
      }

      if (tareNum === 0 || tareNum < 0) {
        setError('❌ Tare Weight cannot be zero or negative. Vehicle may not be at the weighbridge. Please try again.');
        setLoading(false);
        return;
      }

      if (!Number.isFinite(grossNum) || grossNum === 0 || grossNum < 0) {
        setError('❌ Gross Weight must be a valid positive number. Please check the weighbridge reading.');
        setLoading(false);
        return;
      }

      if (!Number.isFinite(netNum) || netNum < 0) {
        setError('Net Weight is invalid. Please check Gross and Tare weight.');
        setLoading(false);
        return;
      }

      // Update NetWeight in state for UI consistency (BalanceQty untouched)
      setHeader(prev => ({
        ...prev,
        NetWeight: netNum.toFixed(3)
      }));


      // Always use current system date and time for OUT
      const now = new Date();
      // SAP expects YYYY-MM-DDT00:00:00 for date fields
      const outwardDate = now.toISOString().split('T')[0] + 'T00:00:00';
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const outwardClock = `${hh}:${mm}:${ss}`;
      const outwardTime = hhmmssToSapDuration(outwardClock);

      // Debug: Check UUID and API call
      console.log('Weight UUID:', weightUuid);
      if (weightUuid) {
        const materialInwardPayload = {
          TareWeight: tareNum.toFixed(3),
          NetWeight: netNum.toFixed(3),
          GateOutDate: outwardDate,
          OutwardTime: outwardTime,
          VehicleStatus: 'OUT',
        };
        console.log('Calling updateMaterialInward... Payload:', materialInwardPayload);
        await updateMaterialInward(weightUuid, materialInwardPayload);
      }

      // Header entity update: status, weights, and outward timestamp fields (BalanceQty untouched)
      const headerPayload = {
        VehicleStatus: 'OUT',
        TareWeight: tareNum.toFixed(3),
        NetWeight: netNum.toFixed(3),
        GateOutDate: outwardDate,
        OutwardTime: outwardTime,
      };
      console.log('Calling updateHeaderByKey... Payload:', headerPayload);
      await updateHeaderByKey(record.GateEntryNumber, headerPayload);

      setResult(`✅ Vehicle OUT saved for Gate Entry ${record.GateEntryNumber}`);
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Update error:', err?.response?.data || err);
      const msg = extractErrorMessage(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setHeader(createInitialHeaderState());
    setSelectedInboundRecord(null);
    setError(null);
    setResult(null);
  };

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

      if (pageMode === 'outward') {
        const scannedInvoice = String(fields.VendorInvoiceNumber || '').trim();
        const scannedVehicle = String(fields.TruckNumber || '').trim();
        const currentInvoice = String(header.VendorInvoiceNumber || '').trim();
        const currentVehicle = String(header.VehicleNumber || '').trim();
        const effectiveInvoice = scannedInvoice || currentInvoice;
        const effectiveVehicle = scannedVehicle || currentVehicle;

        setHeader((prev) => ({
          ...prev,
          VendorInvoiceNumber: scannedInvoice || prev.VendorInvoiceNumber,
          VehicleNumber: scannedVehicle || prev.VehicleNumber,
          PermitNumber: fields.PermitNumber || prev.PermitNumber,
          LRGCNumber: fields.mteNumber || prev.LRGCNumber,
        }));

        if (!effectiveInvoice) {
          setSelectedInboundRecord(null);
          setError('Scanned QR does not contain Vendor Invoice Number');
          return;
        }

        if (!effectiveVehicle) {
          setSelectedInboundRecord(null);
          setError('Scanned QR does not contain Vehicle Number');
          return;
        }

        setError(null);
        fetchOutDataByScanCriteria(effectiveInvoice, effectiveVehicle);
        return;
      }

      // Fallback for non-outward mode.
      const shouldApplyScanValues = (
        (!header.VendorInvoiceNumber && !!fields.VendorInvoiceNumber) ||
        (!header.VehicleNumber && !!fields.TruckNumber) ||
        (!header.Material && !!fields.material) ||
        (!header.MaterialDescription && !!fields.grade)
      );

      if (shouldApplyScanValues) {
        setHeader((prev) => ({
          ...prev,
          PermitNumber: fields.PermitNumber || prev.PermitNumber,
          LRGCNumber: fields.mteNumber || prev.LRGCNumber,
          VendorInvoiceDate: fields.VendorInvoiceDate || prev.VendorInvoiceDate,
          VendorInvoiceNumber: fields.VendorInvoiceNumber || prev.VendorInvoiceNumber,
          VendorInvoiceWeight: fields.VendorInvoiceWeight || prev.VendorInvoiceWeight,
          VehicleNumber: fields.TruckNumber || prev.VehicleNumber,
          Material: fields.material || prev.Material,
          MaterialDescription: fields.grade || prev.MaterialDescription,
          Division: fields.location || prev.Division,
        }));
      }
    }
  }, [header.Remarks, pageMode]);




  // Calculate NetWeight for display only (BalanceQty is not auto-calculated)
  const gross = parseFloat(header.GrossWeight);
  const tare = parseFloat(header.TareWeight);
  const net = (!isNaN(gross) && !isNaN(tare)) ? (gross - tare) : '';
  const displayNetWeight = (net !== '' && isFinite(net)) ? net.toFixed(3) : '';
  const displayBalanceQty = header.BalanceQty;


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
      <div style={{ width:'65%', height:'1px', margin:'8px auto', background:'linear-gradient(90deg, transparent, rgba(67,255,142,0.45), rgba(6,182,212,0.45), rgba(139,92,246,0.3), transparent)' }} />
      <form onSubmit={handleSubmit} onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.type !== 'submit') {
          e.preventDefault();
        }
      }}>
        <section className="form-section" style={{ marginBottom: 14, paddingBottom: 0 }}>
          {/* <h3 className="section-title">Header Information</h3> */}
          <div className="grid-7-cols">
            <div className="form-group">
              <label className="form-label">Gate Entry Number (Auto)</label>
              <input className="form-input" name="GateEntryNumber" value={header.GateEntryNumber} onChange={handleChange} placeholder="Enter or scan gate entry number" style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
            </div>

            <div className="form-group">
              <label className="form-label">Weight Doc(Auto)</label>
              <input className="form-input" name="WeightDocNumber" value={header.WeightDocNumber} readOnly style={{ background: '#f0f0f0', height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
            </div>

            <div className="form-group">
              <label className="form-label">Gate Entry Date *</label>
              <input className="form-input" name="GateEntryDate" type="date" value={header.GateEntryDate} onChange={handleChange} required style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
            </div>

            {/* Error is now shown below Remarks */}

            <div className="form-group">
              <label className="form-label">Vehicle Number *</label>
              <input className="form-input" name="VehicleNumber" value={header.VehicleNumber} onChange={handleChange} required style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
            </div>

            <div className="form-group" style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
              <label className="form-label">Transporter Code</label>
              <input
                className="form-input"
                name="TransporterCode"
                value={header.TransporterCode}
                onChange={handleChange}
                onFocus={() => handleTransporterFocus('TransporterCode')}
                style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }}
              />
              {transporterDropdown.show && transporterDropdown.field === 'TransporterCode' && (
                <div style={{
                  position: 'absolute',top: '100%',left: 0,right: 0,zIndex: 20,background: '#fff',border: '1px solid #e5e7eb', borderRadius: '6px',maxHeight: '220px',overflowY: 'auto',boxShadow: '0 6px 16px rgba(0,0,0,0.12)'
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
                style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }}
              />
              {transporterDropdown.show && transporterDropdown.field === 'TransporterName' && (
                <div style={{position: 'absolute',top: '100%',left: 0,right: 0,zIndex: 20,background: '#fff',border: '1px solid #e5e7eb',borderRadius: '6px', maxHeight: '220px',overflowY: 'auto',boxShadow: '0 6px 16px rgba(0,0,0,0.12)'}}>
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
              <input className="form-input" name="DriverName" value={header.DriverName} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Driver Phone</label>
              <input className="form-input" name="DriverPhoneNumber" value={header.DriverPhoneNumber} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
            </div>
            <div className="form-group">
              <label className="form-label">LR/GC Number</label>
              <input className="form-input" name="LRGCNumber" value={header.LRGCNumber} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Permit Number</label>
              <input className="form-input" name="PermitNumber" value={header.PermitNumber} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Sub Transporter Name</label>
              <input className="form-input" name="SubTransporterName" value={header.SubTransporterName} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
            </div>
            <div className="form-group form-group-checkbox">
              <input type="checkbox" className="form-checkbox" name="EWayBill" checked={header.EWayBill} onChange={handleChange} />
              <label className="form-checkbox-label">E-Way Bill</label>
            </div>
            <div className="form-group">
              <label className="form-label">Division</label>
              <input className="form-input" name="Division" value={header.Division} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
            </div>

            <div className="form-group">
              <label className="form-label">Inward Time</label>
              <input className="form-input" name="InwardTime" value={header.InwardTime} readOnly style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
            </div>

            <div className="form-group">
              {/* Outward Time is hidden visually but present in DOM for storing/submitting */}
              <div style={{ display: 'none' }}>
                <label className="form-label">Outward Time</label>
                <input className="form-input" name="OutwardTime" value={header.OutwardTime} readOnly style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
              </div>
            </div>

            <div className="form-group full-width">
              <label className="form-label" style={{ marginBottom: 4 }}>Remarks</label>
              <textarea className="form-textarea" name="Remarks" value={header.Remarks} onChange={handleChange}
                rows={2}
                style={{
                  minHeight: 30,
                  height: 34,
                  paddingTop: 4,
                  paddingBottom: 4,
                  backgroundColor: typeof header.Remarks === 'string' && (header.Remarks.match(/\|/g) || []).length >= 4 ? '#fffbe6' : undefined,
                  fontWeight: typeof header.Remarks === 'string' && (header.Remarks.match(/\|/g) || []).length >= 4 ? 'bold' : undefined
                }}
              />
              {error && (
                <div style={{ color: 'red', margin: '4px 0' }}>{error}</div>
              )}
            </div>
          </div>
        </section>

        <section className="form-section">
          {/* <h3 className="section-title">Purchase Order Details</h3> */}
          <div className="po-entry-card">
            {/* <h4 className="po-entry-title">PO Details</h4> */}
            <div className="grid-8-cols">
              <div className="form-group">
                <label className="form-label">PO Number</label>
                <input className="form-input" name="PurchaseOrderNumber" value={header["PurchaseOrderNumber"]} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Material</label>
                <input className="form-input" name="Material" value={header["Material"]} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Material Description</label>
                <input className="form-input" name="MaterialDescription" value={header["MaterialDescription"]} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor</label>
                <input className="form-input" name="Vendor" value={header["Vendor"]} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor Name</label>
                <input className="form-input" name="VendorName" value={header["VendorName"]} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor Invoice No</label>
                <input className="form-input" name="VendorInvoiceNumber" value={header["VendorInvoiceNumber"]} onChange={handleChange} onBlur={handleVendorInvoiceBlur} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor Invoice Date</label>
                <input className="form-input" type="date" name="VendorInvoiceDate" value={header["VendorInvoiceDate"]} onChange={handleChange} style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor Invoice Weight</label>
                <input className="form-input" name="VendorInvoiceWeight" type="text" inputMode="decimal" value={header["VendorInvoiceWeight"]} onChange={handleChange} placeholder="0.00" style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Balance Quantity</label>
                <input className="form-input" name="BalanceQty" type="text" inputMode="decimal" value={header["BalanceQty"]} onChange={handleChange} placeholder="0.000" style={{ height: 34, minHeight: 34, paddingTop: 4, paddingBottom: 4 }} />
              </div>
            </div>
          </div>
        </section>

        <div className="form-actions" style={{ padding: '8px 0', minHeight: 0, display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
          {/* Weight fields group */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, minWidth: 0 }}>
            <div className="form-group" style={{ minWidth: '190px', marginBottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <label className="form-label" style={{ color: '#0b5ed7', fontWeight: 700, fontSize: '1.08em', marginBottom: 4 }}>TARE WEIGHT (MT)</label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minHeight: 0 }}>
                <input className="form-input" name="TareWeight" value={header.TareWeight === "0.000" ? "" : header.TareWeight} onChange={handleChange} readOnly placeholder="Enter or Get Tare" style={{ borderColor: '#0b5ed7', backgroundColor: '#fff', height: 44, minHeight: 40, paddingTop: 6, paddingBottom: 6, fontSize: '1.18em', width: '130px' }} inputMode="decimal" />
                <button type="button" className="btn btn-secondary" onClick={handleGetTareWeight} disabled={tareWeightLoading || loading} style={{ whiteSpace: 'nowrap', backgroundColor: '#ff8c00', borderColor: '#ff8c00', color: '#fff', height: 44, minHeight: 40, fontSize: '1.18em', padding: '0 24px', fontWeight: 700 }}>{tareWeightLoading ? 'Getting...' : 'Get Tare'}</button>
              </div>
              <span style={{ fontSize: '0.92em', color: '#888', marginLeft: '2px', marginTop: '4px' }}></span>
            </div>

            <div className="form-group" style={{ minWidth: '160px', marginBottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <label className="form-label" style={{ color: '#0b5ed7', fontWeight: 700, fontSize: '1.08em', marginBottom: 4 }}>GROSS WEIGHT (MT)</label>
              
              <input className="form-input" name="GrossWeight" value={header.GrossWeight} onChange={handleChange} placeholder="Enter or Get Gross" style={{ borderColor: '#0b5ed7', backgroundColor: '#e0e0e0', height: 44, minHeight: 40, paddingTop: 6, paddingBottom: 6, fontSize: '1.18em', width: '130px' }} inputMode="decimal" disabled />
              <span style={{ fontSize: '0.92em', color: '#a09f9f', marginLeft: '2px', marginTop: '4px' }}></span>
            </div>

            <div className="form-group" style={{ minWidth: '160px', marginBottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <label className="form-label" style={{ color: '#0b5ed7', fontWeight: 700, fontSize: '1.08em', marginBottom: 4 }}>NET WEIGHT (MT)</label>
              <input className="form-input" name="NetWeight" value={displayNetWeight} readOnly placeholder="Auto-calculated" style={{ borderColor: '#0b5ed7', backgroundColor: '#f0f0f0', height: 44, minHeight: 40, paddingTop: 6, paddingBottom: 6, fontSize: '1.18em', width: '130px' }} />
            </div>

            <div className="form-group" style={{ minWidth: '160px', marginBottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <label className="form-label" style={{ color: '#0b5ed7', fontWeight: 700, fontSize: '1.08em', marginBottom: 4 }}>BALANCE QUANTITY</label>
              <input className="form-input" name="BalanceQty" value={displayBalanceQty} readOnly placeholder="Enter or fetch from backend" style={{ borderColor: '#0b5ed7', backgroundColor: '#f0f0f0', height: 44, minHeight: 40, paddingTop: 6, paddingBottom: 6, fontSize: '1.18em', width: '130px' }} />
            </div>
          </div>
          {/* Action buttons group */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', minWidth: '160px' }}>
            <button type="submit" disabled={loading} className={`btn btn-primary ${loading ? 'disabled' : ''}`} style={{ height: 44, minHeight: 38, fontSize: '1.08em', padding: '0 22px', marginBottom: 0, fontWeight: 700 }}>
              {loading ? "Creating..." : "✅ Create Gate Entry + Weight Document"}
            </button>
          </div>
        </div>

      </form>

      {/* Success Modal */}
      {showSuccessModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', padding: 32, minWidth: 340, maxWidth: '90vw', textAlign: 'center', position: 'relative' }}>
            <div className="success-header" style={{marginBottom: 12}}>
              <svg viewBox="0 0 24 24" width="32" height="32">
                <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              <h3 style={{margin: 0, fontSize: '1.3em'}}>Success!</h3>
            </div>
            <div className="success-content" style={{marginBottom: 16}}>
              <p><strong>{result}</strong></p>
              {header.GateEntryNumber && (
                <>
                  <p>Gate Entry Number: <strong>{header.GateEntryNumber}</strong></p>
                  <p>Weight Doc Number: <strong>{header.WeightDocNumber}</strong></p>
                  <p>Vehicle: {header.VehicleNumber}</p>
                  {header.GrossWeight && <p>Gross Weight: {header.GrossWeight} MT</p>}
                </>
              )}
            </div>
            <button type="button" className="btn btn-secondary" style={{marginTop:'8px', marginRight: '8px'}} onClick={handlePrintSlip}>Download Weighment Slip</button>
            <button type="button" className="btn btn-primary" style={{marginTop:'8px'}} onClick={() => { setShowSuccessModal(false); resetForm(); }}>OK</button>
          </div>
        </div>
      )}
      {/* Hidden printable slip template */}
      <div id="weighment-slip-print-area" style={{display:'none'}}>
        <div style={{fontFamily:'Arial, sans-serif', color:'#000', background:'#fff', width:'100%', maxWidth:'700px', margin:'0 auto', fontSize:'10px', padding:'18px 8px'}}>
          {/* Removed top-left date/time and GateInWard&Outward label */}
          <div className="minera-slip-header-row" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #000', paddingBottom: '2px', marginBottom: '4px'}}>
            <div>
              <div style={{fontSize: '13px', fontWeight: 'bold'}}>Minera Steel &amp; Power Pvt Ltd</div>
              <div style={{fontSize: '9px'}}>Yerabanahalli Village, Sandur Taluk, Ballari Dist, Karnataka - 583115</div>
            </div>
            <img src="/Minera_Logo.jpg" alt="Minera Logo" style={{height:'35px', width:'auto', marginLeft:'8px'}} className="minera-logo-img" />
          </div>
          <div style={{textAlign:'center', fontSize:'12px', fontWeight:'bold', marginBottom:'4px'}}>Material Movement - Weighment Slip</div>
          <div style={{display:'flex', flexWrap:'nowrap', gap:'32px', marginBottom:'8px', justifyContent:'space-between'}}>
            {/* Left fields */}
            <table style={{fontSize:'10px', minWidth:'200px'}}>
              <tbody>
                <tr><td><b>Weighment No</b></td><td>: {header.WeightDocNumber || '-'}</td></tr>
                <tr><td><b>Gate Entry</b></td><td>: {header.GateEntryNumber || '-'}</td></tr>
                <tr><td><b>Truck</b></td><td>: {header.VehicleNumber || '-'}</td></tr>
                <tr><td><b>Party Code</b></td><td>: {header.Vendor || '-'}</td></tr>
                <tr><td><b>Transporter<br/>Code</b></td><td>: {header.TransporterCode || '-'}</td></tr>
                <tr><td><b>Challan Number</b></td><td>: {header.VendorInvoiceNumber || '-'}</td></tr>
                <tr><td><b>Challan Weight</b></td><td>: {header.VendorInvoiceWeight || '-'}</td></tr>
              </tbody>
            </table>
            {/* Right fields */}
            <table style={{fontSize:'10px', minWidth:'220px'}}>
              <tbody>
                <tr><td><b>PO Number</b></td><td>: {header.PurchaseOrderNumber || '-'}</td></tr>
                <tr><td><b>Product Name</b></td><td>: {header.MaterialDescription || '-'}</td></tr>
                <tr><td><b>Party</b></td><td>: {header.VendorName || '-'}</td></tr>
                <tr><td><b>Transporter Name</b></td><td>: {header.TransporterName || '-'}</td></tr>
                <tr><td><b>Challan Date</b></td><td>: {header.VendorInvoiceDate || '-'}</td></tr>
                <tr><td><b>Sub Transporter Name</b></td><td>: {header.SubTransporterName || '-'}</td></tr>
                {/* <tr><td><b>Shift</b></td><td>:</td></tr> */}
              </tbody>
            </table>
          </div>
          <div style={{borderBottom:'1px solid #000', margin:'8px 0 6px 0'}} />
          <div style={{display:'flex', flexWrap:'nowrap', gap:'32px', justifyContent:'space-between', marginTop:'2px'}}>
            {/* Date/Time left */}
            <table style={{fontSize:'10px', minWidth:'180px'}}>
              <tbody>
                <tr><td><b>Date In</b></td><td>: {formatDateDMY(selectedInboundRecord?.GateEntryDate || header.GateEntryDate)}</td></tr>
                <tr><td><b>Time In</b></td><td>: {formatTimeHHMMSS(selectedInboundRecord?.InwardTime || header.InwardTime)}</td></tr>
                <tr><td><b>Date Out</b></td><td>: {formatDateDMY(new Date())}</td></tr>
                <tr><td><b>Time Out</b></td><td>: {formatTimeHHMMSS(new Date())}</td></tr>
              </tbody>
            </table>
            {/* Weights right */}
            <table style={{fontSize:'15px', minWidth:'200px'}}>
              <tbody>
                <tr><td><b>Tare</b></td><td>: {header.TareWeight || '-'} MT</td></tr>
                <tr><td><b>Gross</b></td><td>: {header.GrossWeight || '-'} MT</td></tr>
                <tr><td><b>Net</b></td><td>: <b>{header.NetWeight || '-'} MT</b></td></tr>
              </tbody>
            </table>
          </div>

        </div>
      </div>
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
    // Do not map gross from scan text; rely on fetched stored value.
    GrossWeight: prev.GrossWeight,
    VehicleNumber: fields.TruckNumber || prev.VehicleNumber,
    LRGCNumber: fields.mteNumber || prev.LRGCNumber,
    Material: fields.material || prev.Material,
    MaterialDescription: fields.grade || prev.MaterialDescription,
    Division: fields.location || prev.Division,
    Remarks: remarks
  }));
};