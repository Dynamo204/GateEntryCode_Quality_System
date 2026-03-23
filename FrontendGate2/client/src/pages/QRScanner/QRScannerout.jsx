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
  const [loading, setLoading] = useState(false);
  const [tareWeightLoading, setTareWeightLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
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

  const location = useLocation();
  const pathTail = location.pathname.split("/").pop();
  const pageMode = pathTail === "inward" ? "inward" : (pathTail === "outward" ? "outward" : "default");

  const parseNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const normalized = String(value).replace(/,/g, '').trim();
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
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
        TareWeight: toFieldString(record.TareWeight, prev.TareWeight),
        GrossWeight: toFieldString(firstDefinedValue(record.GrossWeight, record.GrossWeght), prev.GrossWeight),
        NetWeight: toFieldString(firstDefinedValue(record.NetWeight, record.NetWeght), prev.NetWeight),
        PurchaseOrderNumber: toFieldString(firstDefinedValue(record.PurchaseOrderNumber, record.PurchaseOrder, record.SalesDocument), prev.PurchaseOrderNumber),
        PurchaseOrderNumber2: toFieldString(record.PurchaseOrderNumber2, prev.PurchaseOrderNumber2),
        PurchaseOrderNumber3: toFieldString(record.PurchaseOrderNumber3, prev.PurchaseOrderNumber3),
        PurchaseOrderNumber4: toFieldString(record.PurchaseOrderNumber4, prev.PurchaseOrderNumber4),
        PurchaseOrderNumber5: toFieldString(record.PurchaseOrderNumber5, prev.PurchaseOrderNumber5),
        Material: toFieldString(firstDefinedValue(record.Material, parsedRemarks.material), prev.Material),
        Material2: toFieldString(record.Material2, prev.Material2),
        Material3: toFieldString(record.Material3, prev.Material3),
        Material4: toFieldString(record.Material4, prev.Material4),
        Material5: toFieldString(record.Material5, prev.Material5),
        MaterialDescription: toFieldString(firstDefinedValue(record.MaterialDescription, parsedRemarks.grade), prev.MaterialDescription),
        MaterialDescription2: toFieldString(record.MaterialDescription2, prev.MaterialDescription2),
        MaterialDescription3: toFieldString(record.MaterialDescription3, prev.MaterialDescription3),
        MaterialDescription4: toFieldString(record.MaterialDescription4, prev.MaterialDescription4),
        MaterialDescription5: toFieldString(record.MaterialDescription5, prev.MaterialDescription5),
        Vendor: toFieldString(firstDefinedValue(record.Vendor, record.Supplier, record.Customer), prev.Vendor),
        Vendor2: toFieldString(record.Vendor2, prev.Vendor2),
        Vendor3: toFieldString(record.Vendor3, prev.Vendor3),
        Vendor4: toFieldString(record.Vendor4, prev.Vendor4),
        Vendor5: toFieldString(record.Vendor5, prev.Vendor5),
        VendorName: toFieldString(firstDefinedValue(record.VendorName, record.SupplierName, record.CustomerName), prev.VendorName),
        VendorName2: toFieldString(record.VendorName2, prev.VendorName2),
        VendorName3: toFieldString(record.VendorName3, prev.VendorName3),
        VendorName4: toFieldString(record.VendorName4, prev.VendorName4),
        VendorName5: toFieldString(record.VendorName5, prev.VendorName5),
        VendorInvoiceNumber: toFieldString(firstDefinedValue(record.VendorInvoiceNumber, record.HandInvoiceNumber, record.SalesDocument, parsedRemarks.VendorInvoiceNumber), prev.VendorInvoiceNumber),
        VendorInvoiceNumber2: toFieldString(record.VendorInvoiceNumber2, prev.VendorInvoiceNumber2),
        VendorInvoiceNumber3: toFieldString(record.VendorInvoiceNumber3, prev.VendorInvoiceNumber3),
        VendorInvoiceNumber4: toFieldString(record.VendorInvoiceNumber4, prev.VendorInvoiceNumber4),
        VendorInvoiceNumber5: toFieldString(record.VendorInvoiceNumber5, prev.VendorInvoiceNumber5),
        VendorInvoiceDate: toInputDate(firstDefinedValue(record.VendorInvoiceDate, record.GateEntryDate, parsedRemarks.VendorInvoiceDate), prev.VendorInvoiceDate),
        VendorInvoiceDate2: toInputDate(record.VendorInvoiceDate2, prev.VendorInvoiceDate2),
        VendorInvoiceDate3: toInputDate(record.VendorInvoiceDate3, prev.VendorInvoiceDate3),
        VendorInvoiceDate4: toInputDate(record.VendorInvoiceDate4, prev.VendorInvoiceDate4),
        VendorInvoiceDate5: toInputDate(record.VendorInvoiceDate5, prev.VendorInvoiceDate5),
        VendorInvoiceWeight: toFieldString(firstDefinedValue(record.VendorInvoiceWeight, parsedRemarks.VendorInvoiceWeight, record.GrossWeight), prev.VendorInvoiceWeight),
        VendorInvoiceWeight2: toFieldString(record.VendorInvoiceWeight2, prev.VendorInvoiceWeight2),
        VendorInvoiceWeight3: toFieldString(record.VendorInvoiceWeight3, prev.VendorInvoiceWeight3),
        VendorInvoiceWeight4: toFieldString(record.VendorInvoiceWeight4, prev.VendorInvoiceWeight4),
        VendorInvoiceWeight5: toFieldString(record.VendorInvoiceWeight5, prev.VendorInvoiceWeight5),
        BalanceQty: toFieldString(record.BalanceQty, prev.BalanceQty),
        BalanceQty2: toFieldString(record.BalanceQty2, prev.BalanceQty2),
        BalanceQty3: toFieldString(record.BalanceQty3, prev.BalanceQty3),
        BalanceQty4: toFieldString(record.BalanceQty4, prev.BalanceQty4),
        BalanceQty5: toFieldString(record.BalanceQty5, prev.BalanceQty5),
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
      const records = resp.data?.d?.results || [];

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
        TareWeight: toFieldString(record.TareWeight, prev.TareWeight),
        GrossWeight: toFieldString(firstDefinedValue(record.GrossWeight, record.GrossWeght), prev.GrossWeight),
        NetWeight: toFieldString(firstDefinedValue(record.NetWeight, record.NetWeght), prev.NetWeight),
        PurchaseOrderNumber: toFieldString(firstDefinedValue(record.PurchaseOrderNumber, record.PurchaseOrder, record.SalesDocument), prev.PurchaseOrderNumber),
        PurchaseOrderNumber2: toFieldString(record.PurchaseOrderNumber2, prev.PurchaseOrderNumber2),
        PurchaseOrderNumber3: toFieldString(record.PurchaseOrderNumber3, prev.PurchaseOrderNumber3),
        PurchaseOrderNumber4: toFieldString(record.PurchaseOrderNumber4, prev.PurchaseOrderNumber4),
        PurchaseOrderNumber5: toFieldString(record.PurchaseOrderNumber5, prev.PurchaseOrderNumber5),
        Material: toFieldString(firstDefinedValue(record.Material, parsedRemarks.material), prev.Material),
        Material2: toFieldString(record.Material2, prev.Material2),
        Material3: toFieldString(record.Material3, prev.Material3),
        Material4: toFieldString(record.Material4, prev.Material4),
        Material5: toFieldString(record.Material5, prev.Material5),
        MaterialDescription: toFieldString(firstDefinedValue(record.MaterialDescription, parsedRemarks.grade), prev.MaterialDescription),
        MaterialDescription2: toFieldString(record.MaterialDescription2, prev.MaterialDescription2),
        MaterialDescription3: toFieldString(record.MaterialDescription3, prev.MaterialDescription3),
        MaterialDescription4: toFieldString(record.MaterialDescription4, prev.MaterialDescription4),
        MaterialDescription5: toFieldString(record.MaterialDescription5, prev.MaterialDescription5),
        Vendor: toFieldString(firstDefinedValue(record.Vendor, record.Supplier, record.Customer), prev.Vendor),
        Vendor2: toFieldString(record.Vendor2, prev.Vendor2),
        Vendor3: toFieldString(record.Vendor3, prev.Vendor3),
        Vendor4: toFieldString(record.Vendor4, prev.Vendor4),
        Vendor5: toFieldString(record.Vendor5, prev.Vendor5),
        VendorName: toFieldString(firstDefinedValue(record.VendorName, record.SupplierName, record.CustomerName), prev.VendorName),
        VendorName2: toFieldString(record.VendorName2, prev.VendorName2),
        VendorName3: toFieldString(record.VendorName3, prev.VendorName3),
        VendorName4: toFieldString(record.VendorName4, prev.VendorName4),
        VendorName5: toFieldString(record.VendorName5, prev.VendorName5),
        VendorInvoiceNumber: toFieldString(firstDefinedValue(record.VendorInvoiceNumber, record.HandInvoiceNumber, record.SalesDocument, parsedRemarks.VendorInvoiceNumber), prev.VendorInvoiceNumber),
        VendorInvoiceNumber2: toFieldString(record.VendorInvoiceNumber2, prev.VendorInvoiceNumber2),
        VendorInvoiceNumber3: toFieldString(record.VendorInvoiceNumber3, prev.VendorInvoiceNumber3),
        VendorInvoiceNumber4: toFieldString(record.VendorInvoiceNumber4, prev.VendorInvoiceNumber4),
        VendorInvoiceNumber5: toFieldString(record.VendorInvoiceNumber5, prev.VendorInvoiceNumber5),
        VendorInvoiceDate: toInputDate(firstDefinedValue(record.VendorInvoiceDate, record.GateEntryDate, parsedRemarks.VendorInvoiceDate), prev.VendorInvoiceDate),
        VendorInvoiceDate2: toInputDate(record.VendorInvoiceDate2, prev.VendorInvoiceDate2),
        VendorInvoiceDate3: toInputDate(record.VendorInvoiceDate3, prev.VendorInvoiceDate3),
        VendorInvoiceDate4: toInputDate(record.VendorInvoiceDate4, prev.VendorInvoiceDate4),
        VendorInvoiceDate5: toInputDate(record.VendorInvoiceDate5, prev.VendorInvoiceDate5),
        VendorInvoiceWeight: toFieldString(firstDefinedValue(record.VendorInvoiceWeight, parsedRemarks.VendorInvoiceWeight, record.GrossWeight), prev.VendorInvoiceWeight),
        VendorInvoiceWeight2: toFieldString(record.VendorInvoiceWeight2, prev.VendorInvoiceWeight2),
        VendorInvoiceWeight3: toFieldString(record.VendorInvoiceWeight3, prev.VendorInvoiceWeight3),
        VendorInvoiceWeight4: toFieldString(record.VendorInvoiceWeight4, prev.VendorInvoiceWeight4),
        VendorInvoiceWeight5: toFieldString(record.VendorInvoiceWeight5, prev.VendorInvoiceWeight5),
        BalanceQty: toFieldString(record.BalanceQty, prev.BalanceQty),
        BalanceQty2: toFieldString(record.BalanceQty2, prev.BalanceQty2),
        BalanceQty3: toFieldString(record.BalanceQty3, prev.BalanceQty3),
        BalanceQty4: toFieldString(record.BalanceQty4, prev.BalanceQty4),
        BalanceQty5: toFieldString(record.BalanceQty5, prev.BalanceQty5),
      }));
    };

    try {
      const [weightResp, headerResp] = await Promise.all([
        fetchMaterialInwardByGateNumber(gateEntryNumber),
        fetchGateEntryByNumber(gateEntryNumber),
      ]);

      const weightRecords = weightResp?.data?.d?.results || [];
      const headerRecords = headerResp?.data?.d?.results || headerResp?.data?.value || [];
      const gateHeader = Array.isArray(headerRecords) ? headerRecords[0] : null;

      const weightRecord = pickBestWeightRecord(weightRecords);
      if (!weightRecord && !gateHeader) {
        setSelectedInboundRecord(null);
        setError('No record found for this Gate Entry Number');
        return;
      }

      const vehicleStatus = normalizeToken(gateHeader?.VehicleStatus || weightRecord?.VehicleStatus);
      if (vehicleStatus === 'OUT') {
        setSelectedInboundRecord(null);
        setError(`Vehicle already OUT for Gate Entry ${gateEntryNumber}`);
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

      setSelectedInboundRecord(mergedRecord);
      applyFetchedRecordToHeader(mergedRecord);
      setError(null);
    } catch (err) {
      setSelectedInboundRecord(null);
      setError('No record found for this Gate Entry Number');
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
    const normalizeToken = (value) => String(value || '').trim().toUpperCase();
    const scannedInvoice = normalizeToken(vendorInvoiceNumber);
    const scannedVehicle = normalizeToken(vehicleNumber);

    if (!scannedInvoice || !scannedVehicle) {
      setSelectedInboundRecord(null);
      setError('Scan must include both Vendor Invoice Number and Vehicle Number');
      return false;
    }

    try {
      const resp = await fetchWeightDetailsByVendorInvoiceNumber(vendorInvoiceNumber, {
        vehicleNumber,
        includeOut: true,
      });

      const records = resp?.data?.d?.results || [];
      if (!Array.isArray(records) || records.length === 0) {
        setSelectedInboundRecord(null);
        setError(`No record found for Vendor Invoice ${vendorInvoiceNumber}`);
        return false;
      }

      const invoiceMatched = records.filter((r) => {
        const recInvoice = normalizeToken(r?.VendorInvoiceNumber || r?.HandInvoiceNumber || r?.SalesDocument);
        return recInvoice && recInvoice === scannedInvoice;
      });

      if (invoiceMatched.length === 0) {
        setSelectedInboundRecord(null);
        setError(`Vendor Invoice ${vendorInvoiceNumber} did not match any record`);
        return false;
      }

      const vehicleMatched = invoiceMatched.filter((r) => {
        const recVehicle = normalizeToken(r?.TruckNumber || r?.VehicleNumber || r?.HeaderVehicleNumber);
        return recVehicle && recVehicle === scannedVehicle;
      });

      if (vehicleMatched.length === 0) {
        setSelectedInboundRecord(null);
        setError(`Vendor Invoice matched, but vehicle ${vehicleNumber} did not match`);
        return false;
      }

      const inStatusRecords = vehicleMatched.filter((r) => normalizeToken(r?.VehicleStatus) === 'IN');
      if (inStatusRecords.length === 0) {
        const outStatusRecord = vehicleMatched.find((r) => normalizeToken(r?.VehicleStatus) === 'OUT');
        if (outStatusRecord) {
          const outGateEntry = String(outStatusRecord?.GateEntryNumber || '').trim();
          setSelectedInboundRecord(null);
          setError(`Vehicle already OUT${outGateEntry ? ` for Gate Entry ${outGateEntry}` : ''}`);
          return false;
        }
        setSelectedInboundRecord(null);
        setError(`Matched records are not in IN status for vehicle ${vehicleNumber}`);
        return false;
      }

      const chosenRecord = pickBestWeightRecord(inStatusRecords) || inStatusRecords[0];
      const gateEntryNumber = String(chosenRecord?.GateEntryNumber || '').trim();

      if (!gateEntryNumber) {
        setSelectedInboundRecord(null);
        setError('Matched record has no Gate Entry Number');
        return false;
      }

      await fetchOutDataByGateEntryNumber(gateEntryNumber);
      return true;
    } catch (err) {
      setSelectedInboundRecord(null);
      setError('Failed to fetch gate entry using scanned Vendor Invoice and Vehicle');
      return false;
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

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

  // Fetch and fill saved values from Weight Document.
  useEffect(() => {
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
  }, [header.VendorInvoiceNumber, header.VehicleNumber, header.PermitNumber, header.Material, header.MaterialDescription, scanFetchTick, pageMode]);

  // Direct lookup by gate entry number in outward screen.
  useEffect(() => {
    if (pageMode !== 'outward') return;
    const gateNo = String(header.GateEntryNumber || '').trim();
    if (gateNo.length < 6) return;
    fetchOutDataByGateEntryNumber(gateNo);
  }, [header.GateEntryNumber, pageMode]);



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

      const tareRaw = String(header.TareWeight || '').trim();
      const grossRaw = String(header.GrossWeight || '').trim();
      const netRaw = String(header.NetWeight || '').trim();

      const tareNum = tareRaw === '' ? NaN : Number(tareRaw);
      const grossNum = grossRaw === '' ? NaN : Number(grossRaw);
      const netNumFromField = netRaw === '' ? NaN : Number(netRaw);
      const derivedNet = Number.isFinite(grossNum) && Number.isFinite(tareNum)
        ? (grossNum - tareNum)
        : NaN;
      const netNum = Number.isFinite(netNumFromField) ? netNumFromField : derivedNet;

      if (!Number.isFinite(tareNum)) {
        setError('Please enter valid Tare Weight before OUT submit.');
        setLoading(false);
        return;
      }

      if (!Number.isFinite(netNum)) {
        setError('Net Weight is invalid. Please check Gross and Tare weight.');
        setLoading(false);
        return;
      }

      // Weight entity update: only outward-relevant weights.
      if (weightUuid) {
        await updateMaterialInward(weightUuid, {
          TareWeight: tareNum.toFixed(3),
          NetWeight: netNum.toFixed(3),
        });
      }

      const outwardDate = new Date().toISOString().split('T')[0];
      const hh = String(new Date().getHours()).padStart(2, '0');
      const mm = String(new Date().getMinutes()).padStart(2, '0');
      const ss = String(new Date().getSeconds()).padStart(2, '0');
      const outwardClock = `${hh}:${mm}:${ss}`;

      // Header entity update: only status + outward timestamp fields.
      await updateHeaderByKey(record.GateEntryNumber, {
        VehicleStatus: 'OUT',
        TareWeight: tareNum.toFixed(3),
        NetWeight: netNum.toFixed(3),
        GateOutDate: outwardDate,
        OutwardTime: hhmmssToSapDuration(outwardClock),
      });

      setResult(`✅ Vehicle OUT saved for Gate Entry ${record.GateEntryNumber}`);
      setTimeout(() => resetForm(), 3000);
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

        setHeader((prev) => ({
          ...prev,
          VendorInvoiceNumber: scannedInvoice || prev.VendorInvoiceNumber,
          VehicleNumber: scannedVehicle || prev.VehicleNumber,
          PermitNumber: fields.PermitNumber || prev.PermitNumber,
          LRGCNumber: fields.mteNumber || prev.LRGCNumber,
        }));

        if (!scannedInvoice) {
          setSelectedInboundRecord(null);
          setError('Scanned QR does not contain Vendor Invoice Number');
          return;
        }

        if (!scannedVehicle) {
          setSelectedInboundRecord(null);
          setError('Scanned QR does not contain Vehicle Number');
          return;
        }

        fetchOutDataByScanCriteria(scannedInvoice, scannedVehicle);
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



  // Calculate NetWeight automatically
  useEffect(() => {
    if (header.GrossWeight && header.TareWeight) {
      const net = parseFloat(header.GrossWeight) - parseFloat(header.TareWeight);
      setHeader(prev => ({
        ...prev,
        NetWeight: isNaN(net) ? '' : net.toFixed(3),
      }));
    }
  }, [header.GrossWeight, header.TareWeight]);

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
              <input className="form-input" name="GateEntryNumber" value={header.GateEntryNumber} onChange={handleChange} placeholder="Enter or scan gate entry number" />
            </div>

            <div className="form-group">
              <label className="form-label">Weight Doc Number (Auto)</label>
              <input className="form-input" name="WeightDocNumber" value={header.WeightDocNumber} readOnly style={{ background: '#f0f0f0' }} />
            </div>

            <div className="form-group">
              <label className="form-label">Gate Entry Date *</label>
              <input className="form-input" name="GateEntryDate" type="date" value={header.GateEntryDate} onChange={handleChange} required />
            </div>

            {error && (
              <div className="form-group full-width" style={{ marginTop: '-8px', marginBottom: '4px' }}>
                <div className="error-message">
                  <strong>❌ Error:</strong> {error}
                </div>
              </div>
            )}

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

            <div className="form-group">
              <label className="form-label">Tare Weight (MT)</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input className="form-input" name="TareWeight" value={header.TareWeight} onChange={handleChange} placeholder="0.00" />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleGetTareWeight}
                  disabled={tareWeightLoading || loading}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {tareWeightLoading ? 'Getting...' : 'Get Tare'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Gross Weight (MT)</label>
              <input className="form-input" name="GrossWeight" value={header.GrossWeight} onChange={handleChange} placeholder="0" />
            </div>

            <div className="form-group">
              <label className="form-label">Net Weight (MT)</label>
              <input className="form-input" name="NetWeight" value={header.NetWeight} readOnly style={{ background: '#f0f0f0' }} placeholder="30.000" />
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
              <label className="form-label">Inward Time</label>
              <input className="form-input" name="InwardTime" value={header.InwardTime} readOnly />
            </div>

            <div className="form-group">
              <label className="form-label">Outward Time</label>
              <input className="form-input" name="OutwardTime" value={header.OutwardTime} readOnly />
            </div>

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
                <input className="form-input" name="PurchaseOrderNumber" value={header["PurchaseOrderNumber"]} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Material</label>
                <input className="form-input" name="Material" value={header["Material"]} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Material Description</label>
                <input className="form-input" name="MaterialDescription" value={header["MaterialDescription"]} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor</label>
                <input className="form-input" name="Vendor" value={header["Vendor"]} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor Name</label>
                <input className="form-input" name="VendorName" value={header["VendorName"]} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor Invoice No</label>
                <input className="form-input" name="VendorInvoiceNumber" value={header["VendorInvoiceNumber"]} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor Invoice Date</label>
                <input className="form-input" type="date" name="VendorInvoiceDate" value={header["VendorInvoiceDate"]} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor Invoice Weight</label>
                <input className="form-input" name="VendorInvoiceWeight" type="text" inputMode="decimal" value={header["VendorInvoiceWeight"]} onChange={handleChange} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="form-label">Balance Quantity</label>
                <input className="form-input" name="BalanceQty" type="text" inputMode="decimal" value={header["BalanceQty"]} onChange={handleChange} placeholder="0.000" />
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
                {header.GrossWeight && <p>Gross Weight: {header.GrossWeight} MT</p>}
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