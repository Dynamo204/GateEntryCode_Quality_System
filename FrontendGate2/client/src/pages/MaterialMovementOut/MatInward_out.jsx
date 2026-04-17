
// src/pages/WeightBridge/CreateWeight.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  updateMaterialInward, // We'll create this to UPDATE existing record
  fetchMaterialInwardByGateNumber, // Fetch existing weight record
  fetchGateEntryByNumber,
  fetchGateOutWaymentFromBridge,
  API_BASE
} from '../../api';
import html2pdf from 'html2pdf.js';
import './MaterialOutHome.css';

// Helper: ISO timestamp
const nowIso = (d = new Date()) => d.toISOString();

// initial state factory
const createInitialState = () => {
  const todayDateOnly = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return {
    WeightDocNumber: '', // This will be fetched from existing record
    SAP_UUID: '', // Need this to update the record
    FiscalYear: new Date().getFullYear().toString(),
    Indicators: 'I',
    GateEntryNumber: '',
    GateFiscalYear: new Date().getFullYear().toString(),
    GateIndicators: 'I',
    
    // Initialize ALL PO fields to prevent uncontrolled -> controlled warning
    PurchaseOrderNumber: '',
    PurchaseOrderNumber2: '',
    PurchaseOrderNumber3: '',
    PurchaseOrderNumber4: '',
    PurchaseOrderNumber5: '',

    PurchaseOrderItem: '',
    PurchaseOrderItem2: '',
    PurchaseOrderItem3: '',
    PurchaseOrderItem4: '',
    PurchaseOrderItem5: '',
    
    SalesDocument: '',
    
    Material: '',
    Material2: '',
    Material3: '',
    Material4: '',
    Material5: '',
    
    MaterialDescription: '',
    MaterialDescription2: '',
    MaterialDescription3: '',
    MaterialDescription4: '',
    MaterialDescription5: '',
    
    TruckNumber: '',
    TransporterCode: '',
    DriverName: '',
    DriverPhoneNumber: '',
    LRGCNumber: '',
    PermitNumber: '',
    SubTransporterName: '',
    Remarks: '',
    TruckCapacity: '',
    TareWeight: '', // User will enter this
    GrossWeight: '', // This will come from the original record
    NetWeight: '', // This will be calculated
    DifferenceBT: '',
    
    VendorInvoiceNumber: '',
    VendorInvoiceNumber2: '',
    VendorInvoiceNumber3: '',
    VendorInvoiceNumber4: '',
    VendorInvoiceNumber5: '',
    
    VendorInvoiceWeight: '',
    VendorInvoiceWeight2: '',
    VendorInvoiceWeight3: '',
    VendorInvoiceWeight4: '',
    VendorInvoiceWeight5: '',
    
    BalanceQty: '',
    BalanceQty2: '',
    BalanceQty3: '',
    BalanceQty4: '',
    BalanceQty5: '',
    
    ToleranceWeight: '',
    ActuallyWeight: '',
    
    Vendor: '',
    Vendor2: '',
    Vendor3: '',
    Vendor4: '',
    Vendor5: '',
    
    VendorName: '',
    VendorName2: '',
    VendorName3: '',
    VendorName4: '',
    VendorName5: '',
    
    GateEntryDate: '',
    GateOutDate: todayDateOnly,
    InwardTime: '',
    OutwardTime: '',
    SAP_CreatedDateTime: nowIso(),
  };
};

const getField = (obj, paths) => {
  for (const path of paths) {
    if (obj && obj[path] !== undefined) return obj[path];
  }
  return '';
};

// Add helper to parse SAP OData v2 dates ("/Date(169...) /") or ISO strings
const parseSapDateToISODateOnly = (val) => {
  if (!val) return '';
  // OData v2 "/Date(167xxx)/" or "/Date(167xxx+0530)/"
  if (typeof val === 'string' && val.startsWith('/Date(')) {
    const m = val.match(/\/Date\(([-\d+]+)(?:[+-]\d+)?\)\//);
    if (m) {
      const millis = parseInt(m[1], 10);
      if (!Number.isNaN(millis)) return new Date(millis).toISOString().slice(0, 10);
    }
    return '';
  }
  // If already ISO-like:
  try {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch (e) { /* ignore */ }
  // Fall back to string slice if looks like "2025-11-04T..."
  if (typeof val === 'string' && val.length >= 10) return val.slice(0, 10);
  return '';
};

// Helper to parse SAP time format (PT15H19M14S) to HH:mm:ss
const parseSapTimeToHHMMSS = (val) => {
  if (!val) return '';
  
  // Check if it's in ISO 8601 duration format (PT15H19M14S)
  if (typeof val === 'string' && val.startsWith('PT')) {
    const match = val.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (match) {
      const hours = (match[1] || '0').padStart(2, '0');
      const minutes = (match[2] || '0').padStart(2, '0');
      const seconds = (match[3] || '0').padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    }
  }
  
  // If already in HH:mm:ss format or similar
  if (typeof val === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(val)) {
    return val;
  }
  
  return val;
};

export default function MaterialInwardOut() {
  const [form, setForm] = useState(createInitialState());
  const [loading, setLoading] = useState(false);
  const [tareWeightLoading, setTareWeightLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [recordFound, setRecordFound] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Vehicle/Truck Number - no spaces allowed
    if (name === 'TruckNumber') {
      const noSpaces = value.replace(/\s/g, '');
      setForm(prev => ({ ...prev, [name]: noSpaces }));
      return;
    }

    // Numeric fields - only numbers and decimal
    if (name === 'TareWeight' || name === 'GrossWeight' || name === 'NetWeight' ||
        name === 'TruckCapacity' || name === 'DifferenceBT' || 
        name === 'ToleranceWeight' || name === 'ActuallyWeight' ||
        name.includes('VendorInvoiceWeight') || name.includes('BalanceQty')) {
      if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
        setForm(prev => {
          const updated = { ...prev, [name]: value };
          
          // Auto-calculate Net Weight when Tare Weight changes
          if (name === 'TareWeight' && updated.GrossWeight) {
            const gross = parseFloat(updated.GrossWeight) || 0;
            const tare = parseFloat(value) || 0;
            updated.NetWeight = (gross - tare).toFixed(3);
          }
          
          return updated;
        });
      }
      return;
    }

    // Character-only fields (names)
    if (name === 'SubTransporterName' || name === 'Driver' || name === 'DriverName') {
      const charsOnly = value.replace(/[0-9]/g, '');
      setForm(prev => ({ ...prev, [name]: charsOnly }));
      return;
    }

    // Default handling
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const validate = () => {
    const errs = [];
    if (!form.GateEntryNumber) errs.push('Gate Entry Number is required');
    if (!form.WeightDocNumber) errs.push('Weight Document Number not found');
    if (!form.TareWeight) errs.push('Tare Weight is required');
    
    // Vehicle number must not contain spaces
    if (form.TruckNumber && /\s/.test(form.TruckNumber)) {
      errs.push('Vehicle number must not contain spaces.');
    }
    
    return errs;
  };

  const parseBridgeWeightValue = (rawWeight) => {
    const cleaned = String(rawWeight || '')
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const numberMatch = cleaned.match(/-?\d+(?:\.\d+)?/);
    return numberMatch ? numberMatch[0] : '';
  };

  const getBridgeErrorMessage = (err, endpointName) => {
    const backendMessage = err?.response?.data?.error || err?.response?.data?.message;
    const statusCode = err?.response?.status;
    if (backendMessage && statusCode) {
      return `${endpointName} failed (${statusCode}): ${backendMessage}`;
    }
    if (backendMessage) return `${endpointName} failed: ${backendMessage}`;
    return err?.message || `Failed to read weight from ${endpointName}`;
  };

  const handleGetTareWeight = async () => {
    setTareWeightLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetchGateOutWaymentFromBridge();
      const rawWeight = response?.data?.data?.weight;
      const parsedWeight = parseBridgeWeightValue(rawWeight);

      if (!parsedWeight) {
        throw new Error('Unable to parse tare weight from weighbridge response');
      }

      setForm((prev) => {
        const updated = { ...prev, TareWeight: parsedWeight };
        if (updated.GrossWeight) {
          const gross = parseFloat(updated.GrossWeight) || 0;
          const tare = parseFloat(parsedWeight) || 0;
          updated.NetWeight = (gross - tare).toFixed(3);
        }
        return updated;
      });
      setResult(`Tare loaded from gate-out-wayment: ${parsedWeight}`);
    } catch (err) {
      setError(getBridgeErrorMessage(err, 'gate-out-wayment'));
    } finally {
      setTareWeightLoading(false);
    }
  };

  /* ================= PDF PRINT (same design as SC screen) ================= */
  const generatePdfBlob = async (data) => {
    const element = document.createElement('div');
    const now = new Date();
    const printDate = now.toLocaleDateString('en-GB');
    const printTime = now.toLocaleTimeString('en-GB');

    // Pre-fetch logo and convert to base64 so html2canvas can embed it
    let logoDataUrl = '';
    try {
      const logoRes = await fetch('/Minera_Logo.jpg');
      const logoBlob = await logoRes.blob();
      logoDataUrl = await new Promise((res) => {
        const r = new FileReader();
        r.onloadend = () => res(r.result);
        r.readAsDataURL(logoBlob);
      });
    } catch (_) {}

    const f = (key) => {
      const v = data[key];
      return (v === undefined || v === null || v === '') ? '-' : v;
    };

    const poRows = Array.from({ length: 5 }).map((_, idx) => {
      const suffix = idx === 0 ? '' : String(idx + 1);
      const poNum = data[`PurchaseOrderNumber${suffix}`];
      const poItem = data[`PurchaseOrderItem${suffix}`];
      const vendor = data[`Vendor${suffix}`];
      const vendorName = data[`VendorName${suffix}`];
      const mat = data[`Material${suffix}`];
      const matDesc = data[`MaterialDescription${suffix}`];
      if (!poNum && !mat) return '';
      return `
        <tr>
          <td style="border:1px solid #000; padding:3px;">${poNum || '-'}</td>
          <td style="border:1px solid #000; padding:3px; text-align:center;">${poItem || '-'}</td>
          <td style="border:1px solid #000; padding:3px;">${vendor || '-'}</td>
          <td style="border:1px solid #000; padding:3px;">${vendorName || '-'}</td>
          <td style="border:1px solid #000; padding:3px;">${mat || '-'}</td>
          <td style="border:1px solid #000; padding:3px;">${matDesc || '-'}</td>
        </tr>
      `;
    }).join('');

    const headerRows = [
      ['Weight Doc No:', f('WeightDocNumber'), 'Date:', printDate],
      ['Gate Entry No:', f('GateEntryNumber'), 'Print Time:', printTime],
      ['Gate Entry Date:', f('GateEntryDate'), 'Vehicle No:', f('TruckNumber')],
      ['Gross Weight:', `${f('GrossWeight')} MT`, 'Tare Weight:', `${f('TareWeight')} MT`],
      ['Net Weight:', `${data.NetWeight || '-'} MT`, 'Permit No:', f('PermitNumber')],
      ['Sub Transporter:', f('SubTransporterName'), 'LR/GC No:', f('LRGCNumber')],
      ['Remarks:', f('Remarks'), '', ''],
    ];

    element.innerHTML = `
      <div style="font-family: Arial, sans-serif; color: #000; background: #fff; width: 100%; max-width: 700px; margin: 0 auto; font-size: 10px;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 4px;">
          <div>
            <div style='font-size: 13px; font-weight: bold;'>Minera Steel &amp; Power Pvt Ltd</div>
            <div style='font-size: 9px;'>Yerabanahalli Village, Sandur Taluk, Ballari Dist, Karnataka - 583115</div>
          </div>
          ${logoDataUrl ? `<img src='${logoDataUrl}' alt='Logo' style='height: 28px; width: auto; margin-left: 8px;'/>` : ''}
        </div>
        <div style="text-align:center; font-size:12px; font-weight:bold; margin-bottom: 4px;">Material Inward - Weight Slip</div>
        <table style="width:100%; border-collapse:collapse; margin-bottom: 2px; font-size:9px;">
          ${headerRows.map(row => `
            <tr style="height:18px;">
              <td style="width:110px; text-align:right; font-weight:bold; padding:2px 2px 2px 0;">${row[0]}</td>
              <td style="width:90px; text-align:left; padding:2px 8px 2px 8px;">${row[1]}</td>
              <td style="width:110px; text-align:right; font-weight:bold; padding:2px 2px 2px 0;">${row[2]}</td>
              <td style="width:90px; text-align:left; padding:2px 8px 2px 8px;">${row[3]}</td>
            </tr>
          `).join('')}
        </table>
        <div style="margin-bottom: 2px; font-size:10px;"><b>Purchase Order Details</b></div>
        <table style="width:100%; border:1px solid #000; border-collapse:collapse; font-size:8.5px;">
          <thead>
            <tr>
              <th style="border:1px solid #000; padding:4px; text-align:left;">PO Number</th>
              <th style="border:1px solid #000; padding:4px; text-align:center;">Item</th>
              <th style="border:1px solid #000; padding:4px; text-align:left;">Vendor</th>
              <th style="border:1px solid #000; padding:4px; text-align:left;">Vendor Name</th>
              <th style="border:1px solid #000; padding:4px; text-align:left;">Material</th>
              <th style="border:1px solid #000; padding:4px; text-align:left;">Description</th>
            </tr>
          </thead>
          <tbody>
            ${poRows || '<tr><td colspan="6" style="border:1px solid #000; padding:4px; text-align:center;">-</td></tr>'}
          </tbody>
        </table>
        <div style="margin-top: 10px; display: flex; justify-content: space-between; font-size: 9px;">
          <div style="text-align:center; width:32%;">Security Officer<br/>__________</div>
          <div style="text-align:center; width:32%;">Weight Bridge Operator<br/>__________</div>
          <div style="text-align:center; width:32%;">Authorized Sign<br/>__________</div>
        </div>
        <div style="margin-top: 4px; text-align:center; font-size:8px;">Generated by Minera Gate Entry System</div>
      </div>
    `;

    const worker = html2pdf()
      .from(element)
      .set({
        margin: [8, 8, 8, 8],
        filename: `MaterialInward_${data.WeightDocNumber || data.GateEntryNumber || 'Slip'}.pdf`,
        html2canvas: { scale: 1.5, useCORS: true },
        jsPDF: { unit: 'mm', format: [210, 148], orientation: 'portrait', compress: true },
        pagebreak: { mode: 'avoid-all' }
      });

    return worker.outputPdf('blob');
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const fullDataUrl = String(reader.result || '');
        const base64 = fullDataUrl.includes(',') ? fullDataUrl.split(',')[1] : fullDataUrl;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const printPdfSlip = async (data) => {
    const pdfBlob = await generatePdfBlob(data);
    const pdfBase64 = await blobToBase64(pdfBlob);
    return axios.post(`${API_BASE}/printer/print`, {
      pdfBase64,
      fileName: `MaterialInward_${data.WeightDocNumber || data.GateEntryNumber || 'Slip'}.pdf`,
    });
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    setError(null);
    setResult(null);
    const v = validate();
    if (v.length) { setError(v.join(' ')); return; }

    if (!recordFound) {
      setError('Please enter a valid Gate Entry Number to load existing record first');
      return;
    }

    setLoading(true);
    try {
      const payload = { ...form };

      // Convert dates
      if (payload.GateEntryDate && payload.GateEntryDate.length === 10) {
        payload.GateEntryDate = `${payload.GateEntryDate}T00:00:00`;
      }
      if (payload.GateOutDate && payload.GateOutDate.length === 10) {
        payload.GateOutDate = `${payload.GateOutDate}T00:00:00`;
      }

      // Calculate Net Weight
      const gross = parseFloat(payload.GrossWeight) || 0;
      const tare = parseFloat(payload.TareWeight) || 0;
      payload.NetWeight = (gross - tare).toFixed(3);

      // Remove time fields - we're only updating Tare Weight and Net Weight
      delete payload.InwardTime;
      delete payload.OutwardTime;

      payload.SAP_CreatedDateTime = nowIso();

      console.debug('Update Weight payload ->', payload);

      // UPDATE existing record using SAP_UUID
      const response = await updateMaterialInward(payload.SAP_UUID, payload);
      setResult('Tare Weight captured successfully! Net Weight calculated. Printing...');

      // ✅ AUTO PRINT (same design as SC screen)
      try { await printPdfSlip(payload); } catch (_) {}
      
      // Reset form after success
      setTimeout(() => {
        setForm(createInitialState());
        setRecordFound(false);
      }, 2000);
    } catch (err) {
      console.error('Update weight err', err?.response?.data || err.message);
      const msg = err?.response?.data?.error?.message?.value || err?.response?.data?.error || err.message || 'Unknown error';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  // When Gate Entry Number changes, fetch existing Material Inward record
  const handleGateEntryChange = async (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setRecordFound(false);
    
    if (name === 'GateEntryNumber' && value && value.trim().length >= 5) {
      setLoading(true);
      setError(null);
      try {
        // Use the imported API function instead of local implementation
        const resp = await fetchMaterialInwardByGateNumber(value.trim());
        console.log('[DBG] Material Inward response:', resp?.data);
        
        const entries = resp?.data?.d?.results || resp?.data?.value || [];
        if (!Array.isArray(entries) || entries.length === 0) {
          setError('No Material Inward record found for this Gate Entry Number. Please complete Material Inward first.');
          setLoading(false);
          return;
        }
        
        // Filter for Inward (Indicators = 'I') on client side
        const inwardRecords = entries.filter(e => e.Indicators === 'I');
        
        if (inwardRecords.length === 0) {
          setError('No Inward records found for this Gate Entry Number.');
          setLoading(false);
          return;
        }
        
        // Get the first matching entry
        const inwardRecord = inwardRecords[0];

        // Check if Tare Weight already exists
        if (inwardRecord.TareWeight && parseFloat(inwardRecord.TareWeight) > 0) {
          setError('Tare Weight already captured for this record!');
          setLoading(false);
          return;
        }

        const parsedDate = parseSapDateToISODateOnly(
          inwardRecord.GateEntryDate || inwardRecord.GateInDate || inwardRecord.GateDate
        );

        // Fetch gate entry details to get InwardTime
        let gateEntryInwardTime = '';
        try {
          const gateResp = await fetchGateEntryByNumber(value.trim());
          const gateEntries = gateResp?.data?.d?.results || gateResp?.data?.value || [];
          if (gateEntries.length > 0) {
            const gateEntry = gateEntries[0];
            gateEntryInwardTime = parseSapTimeToHHMMSS(
              gateEntry.InwardTime || gateEntry.GateInTime || gateEntry.TimeIn || ''
            );
          }
        } catch (err) {
          console.warn('Could not fetch gate entry for InwardTime:', err);
        }

        function formatSapODataDate(date) {
        if (!date) return null;

        if (typeof date === "string" && date.startsWith("/Date(")) {
        return date;
        }

        const d = new Date(date);
        if (isNaN(d.getTime())) return null;

        return `/Date(${d.getTime()})/`;
        }

        function formatSapTime(timeStr) {
        if (!timeStr) return null;

        if (timeStr.startsWith("PT")) {
        return timeStr;
        }

        const [hh, mm, ss] = timeStr.split(":");
        return `PT${hh}H${mm}M${ss}S`;
       }

       // ✅ SINGLE IST SOURCE (IMPORTANT)
       const now = new Date();

       const istDateObj = new Date(
       now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
        );

     // ✅ YYYY-MM-DD (for SAP OData)
     const year = istDateObj.getFullYear();
     const month = String(istDateObj.getMonth() + 1).padStart(2, "0");
     const day = String(istDateObj.getDate()).padStart(2, "0");

     const systemdate = `${year}-${month}-${day}`;

     // ✅ HH:MM:SS
     const hours = String(istDateObj.getHours()).padStart(2, "0");
     const minutes = String(istDateObj.getMinutes()).padStart(2, "0");
     const seconds = String(istDateObj.getSeconds()).padStart(2, "0");

     const systemtime = `${hours}:${minutes}:${seconds}`;

// ✅ DD.MM.YYYY (for TextElement)
     function formatDateDDMMYYYY(date) {
     const d = new Date(date);

     const day = String(d.getDate()).padStart(2, "0");
     const month = String(d.getMonth() + 1).padStart(2, "0");
     const year = d.getFullYear();

     return `${day}.${month}.${year}`;
     }

    const formattedDate = formatDateDDMMYYYY(istDateObj);

        // Populate form with existing Material Inward data
        setForm(prev => ({
          ...prev,
          SAP_UUID: inwardRecord.SAP_UUID || inwardRecord.UUID, // Important for update
          WeightDocNumber: inwardRecord.WeightDocNumber || '',
          GateEntryNumber: value.trim(),
          GateEntryDate: parsedDate || prev.GateEntryDate,
          TruckNumber: inwardRecord.TruckNumber || '',
          TransporterCode: inwardRecord.TransporterCode || '',
          SubTransporterName: inwardRecord.SubTransporterName || '',
          Remarks: inwardRecord.Remarks || '',
          DriverName: inwardRecord.DriverName || '',
          DriverPhoneNumber: inwardRecord.DriverPhoneNumber || '',
          InwardTime: gateEntryInwardTime,
          OutwardTime: formatSapTime(systemtime) || '',
          GateOutDate: formatSapODataDate(systemdate) || '',
          LRGCNumber: inwardRecord.LRGCNumber || '',
          PermitNumber: inwardRecord.PermitNumber || '',
          GateFiscalYear: inwardRecord.FiscalYear || inwardRecord.GateFiscalYear || prev.GateFiscalYear,
          FiscalYear: inwardRecord.FiscalYear || prev.FiscalYear,
          VehicleStatus:"OUT",

          // Gross Weight from the original record (READ-ONLY)
          GrossWeight: inwardRecord.GrossWeight || '',
          TruckCapacity: inwardRecord.TruckCapacity || '',
          
          // Keep Tare Weight empty for user to enter
          TareWeight: '',
          NetWeight: '',

          // PO Details
          PurchaseOrderNumber: inwardRecord.PurchaseOrderNumber || '',
          PurchaseOrderNumber2: inwardRecord.PurchaseOrderNumber2 || '',
          PurchaseOrderNumber3: inwardRecord.PurchaseOrderNumber3 || '',
          PurchaseOrderNumber4: inwardRecord.PurchaseOrderNumber4 || '',
          PurchaseOrderNumber5: inwardRecord.PurchaseOrderNumber5 || '',

          PurchaseOrderItem: inwardRecord.PurchaseOrderItem || '',
          PurchaseOrderItem2: inwardRecord.PurchaseOrderItem2 || '',
          PurchaseOrderItem3: inwardRecord.PurchaseOrderItem3 || '',
          PurchaseOrderItem4: inwardRecord.PurchaseOrderItem4 || '',
          PurchaseOrderItem5: inwardRecord.PurchaseOrderItem5 || '',

          Material: inwardRecord.Material || '',
          Material2: inwardRecord.Material2 || '',
          Material3: inwardRecord.Material3 || '',
          Material4: inwardRecord.Material4 || '',
          Material5: inwardRecord.Material5 || '',

          MaterialDescription: inwardRecord.MaterialDescription || '',
          MaterialDescription2: inwardRecord.MaterialDescription2 || '',
          MaterialDescription3: inwardRecord.MaterialDescription3 || '',
          MaterialDescription4: inwardRecord.MaterialDescription4 || '',
          MaterialDescription5: inwardRecord.MaterialDescription5 || '',

          Vendor: inwardRecord.Vendor || '',
          Vendor2: inwardRecord.Vendor2 || '',
          Vendor3: inwardRecord.Vendor3 || '',
          Vendor4: inwardRecord.Vendor4 || '',
          Vendor5: inwardRecord.Vendor5 || '',

          VendorName: inwardRecord.VendorName || '',
          VendorName2: inwardRecord.VendorName2 || '',
          VendorName3: inwardRecord.VendorName3 || '',
          VendorName4: inwardRecord.VendorName4 || '',
          VendorName5: inwardRecord.VendorName5 || '',

          VendorInvoiceNumber: inwardRecord.VendorInvoiceNumber || '',
          VendorInvoiceNumber2: inwardRecord.VendorInvoiceNumber2 || '',
          VendorInvoiceNumber3: inwardRecord.VendorInvoiceNumber3 || '',
          VendorInvoiceNumber4: inwardRecord.VendorInvoiceNumber4 || '',
          VendorInvoiceNumber5: inwardRecord.VendorInvoiceNumber5 || '',

          VendorInvoiceWeight: inwardRecord.VendorInvoiceWeight || '',
          VendorInvoiceWeight2: inwardRecord.VendorInvoiceWeight2 || '',
          VendorInvoiceWeight3: inwardRecord.VendorInvoiceWeight3 || '',
          VendorInvoiceWeight4: inwardRecord.VendorInvoiceWeight4 || '',
          VendorInvoiceWeight5: inwardRecord.VendorInvoiceWeight5 || '',

          BalanceQty: inwardRecord.BalanceQty || '',
          BalanceQty2: inwardRecord.BalanceQty2 || '',
          BalanceQty3: inwardRecord.BalanceQty3 || '',
          BalanceQty4: inwardRecord.BalanceQty4 || '',
          BalanceQty5: inwardRecord.BalanceQty5 || '',

          ToleranceWeight: inwardRecord.ToleranceWeight || '',
          ActuallyWeight: inwardRecord.ActuallyWeight || '',
        }));

        setRecordFound(true);
        console.log('[DBG] Material Inward record loaded successfully');
      } catch (err) {
        console.error('Failed to fetch material inward:', err);
        setError('Could not fetch Material Inward details');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="create-header-container">
      <h2 className="page-title" style={{ margin: '0 auto 10px', textAlign: 'center', width: '100%' }}>Material Inward - Tare Weight Capture</h2>
      <p className="page-description" style={{ textAlign: 'center' }}>Enter Gate Entry Number to load existing Material Inward record and capture Tare Weight</p>
      
      <form onSubmit={onSubmit} className="create-form" onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.type !== 'submit') {
          e.preventDefault();
        }
      }}>
        <section className="form-section">
          <h3 className="section-title">Weight Document</h3>
          
          <div className="grid-2-cols">
            <div className="form-group" style={{ background: '#e8f4ff', border: '1.5px solid #4a90d9', borderRadius: '8px', padding: '10px 12px' }}>
              <label className="form-label" style={{ color: '#1a5fa8', fontWeight: '700' }}>Gate Entry Number *</label>
              <input
                type="text"
                name="GateEntryNumber"
                value={form.GateEntryNumber}
                onChange={handleGateEntryChange}
                className="form-input"
                required
                placeholder="Enter to load existing record"
                style={{ background: '#ffffff', border: '1.5px solid #4a90d9', fontWeight: '600' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Weight Doc Number (Existing)</label>
              <input
                type="text"
                name="WeightDocNumber"
                value={form.WeightDocNumber}
                className="form-input"
                readOnly
                style={{ backgroundColor: '#f0f0f0' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Fiscal Year</label>
              <input
                type="text"
                name="FiscalYear"
                value={form.FiscalYear}
                className="form-input"
                readOnly
                style={{ backgroundColor: '#f0f0f0' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Gate Entry Date</label>
              <input
                type="date"
                name="GateEntryDate"
                value={form.GateEntryDate}
                className="form-input"
                readOnly
                style={{ backgroundColor: '#f0f0f0' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Vehicle Number</label>
              <input
                type="text"
                name="TruckNumber"
                value={form.TruckNumber}
                className="form-input"
                readOnly
                style={{ backgroundColor: '#f0f0f0' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Transporter</label>
              <input
                type="text"
                name="TransporterCode"
                value={form.TransporterCode}
                className="form-input"
                readOnly
                style={{ backgroundColor: '#f0f0f0' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">LRGC Number</label>
              <input
                type="text"
                name="LRGCNumber"
                value={form.LRGCNumber}
                className="form-input"
                readOnly
                style={{ backgroundColor: '#f0f0f0' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Permit Number</label>
              <input  
                type="text"
                name="PermitNumber"
                value={form.PermitNumber}
                className="form-input"
                readOnly
                style={{ backgroundColor: '#f0f0f0' }}  
              />
            </div>

            <div className="form-group">
              <label className="form-label">Sub Transporter Name</label>
              <input
                type="text"
                name="SubTransporterName"
                value={form.SubTransporterName}
                className="form-input"
                readOnly
                style={{ backgroundColor: '#f0f0f0' }}
              />
            </div>
          
          <div className="form-group">  
              <label className="form-label">Remarks</label>
              <input
                type="text"
                name="Remarks"
                value={form.Remarks}
                className="form-input"
                readOnly
                style={{ backgroundColor: '#f0f0f0' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Inward Time</label>
              <input
                type="text"
                name="InwardTime"
                value={form.InwardTime}
                className="form-input"
                readOnly
                style={{ backgroundColor: '#f0f0f0' }}
                placeholder="HH:MM:SS"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Gross Weight (Loaded)</label>
              <input
                type="text"
                name="GrossWeight"
                value={form.GrossWeight}
                className="form-input"
                readOnly
                style={{ backgroundColor: '#e8f5e9' }}
                placeholder="From Material Inward"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tare Weight (Empty) *</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  name="TareWeight"
                  value={form.TareWeight}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Enter tare weight"
                  required
                  disabled={!recordFound}
                />
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
              <label className="form-label">Net Weight (Calculated)</label>
              <input
                type="text"
                name="NetWeight"
                value={form.NetWeight}
                className="form-input"
                readOnly
                style={{ backgroundColor: '#fff3e0', fontWeight: 'bold' }}
                placeholder="Auto-calculated"
              />
            </div>
          </div>
        </section>

        {recordFound && (
          <section className="form-section">
            <h3 className="section-title">Purchase Order Details (Read-Only)</h3>
            {Array.from({ length: 5 }).map((_, idx) => {
              const suffix = idx === 0 ? "" : String(idx + 1);
              const hasData = form[`PurchaseOrderNumber${suffix}`] || form[`Material${suffix}`];
              
              if (!hasData && idx > 0) return null; // Hide empty entries after first
              
              return (
                <div key={idx} className="po-entry-card" style={{ opacity: 0.7 }}>
                  <h4 className="po-entry-title">PO Entry {idx + 1}</h4>
                  <div className="grid-4-cols">
                    <div className="form-group">
                      <label className="form-label">PO Number</label>
                      <input
                        className="form-input"
                        name={`PurchaseOrderNumber${suffix}`}
                        value={form[`PurchaseOrderNumber${suffix}`]}
                        readOnly
                        style={{ backgroundColor: '#f0f0f0' }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">PO Item</label>
                      <input
                        className="form-input"
                        name={`PurchaseOrderItem${suffix}`}
                        value={form[`PurchaseOrderItem${suffix}`]}
                        readOnly
                        style={{ backgroundColor: '#f0f0f0' }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Material</label>
                      <input
                        className="form-input"
                        name={`Material${suffix}`}
                        value={form[`Material${suffix}`]}
                        readOnly
                        style={{ backgroundColor: '#f0f0f0' }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Material Description</label>
                      <input
                        className="form-input"
                        name={`MaterialDescription${suffix}`}
                        value={form[`MaterialDescription${suffix}`]}
                        readOnly
                        style={{ backgroundColor: '#f0f0f0' }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Vendor</label>
                      <input
                        className="form-input"
                        name={`Vendor${suffix}`}
                        value={form[`Vendor${suffix}`]}
                        readOnly
                        style={{ backgroundColor: '#f0f0f0' }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading || !recordFound}>
            {loading ? 'Updating...' : 'Capture Tare Weight & Calculate'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setForm(createInitialState());
              setRecordFound(false);
            }}
          >
            Reset
          </button>
        </div>
      </form>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="success-message">
          <strong>Success:</strong> {result}
        </div>
      )}
    </div>
  );
}
