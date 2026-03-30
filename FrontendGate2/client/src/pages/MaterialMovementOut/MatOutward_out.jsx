// src/pages/WeightBridge/MaterialOutwardTareCapture.jsx
import React, { useState, useEffect } from 'react';
import { 
  updateMaterialInward, // We'll create this to UPDATE existing record
  fetchMaterialOutwardByGateNumber, // Fetch existing weight record
  createGoodsIssue,
  updateOutboundDelivery,
  updateHeaderByKey,
  fetchGateEntryByNumber,
  fetchGateOutWaymentFromBridge,
  API_BASE
} from '../../api';
import axios from 'axios';
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
    Indicators: 'O', // OUTWARD indicator
    GateEntryNumber: '',
    GateFiscalYear: new Date().getFullYear().toString(),
    GateIndicators: 'O',
    
    // SD Fields (instead of PO)
    SalesDocument: '',
    Customer: '',
    CustomerName: '',
    Material: '',
    MaterialDescription: '',
    
    TruckNumber: '',
    TransporterCode: '',
    LRGCNumber: '',
    PermitNumber: '',
    Remarks: '',
    TruckCapacity: '',
    TareWeight: '', // User will enter this
    GrossWeight: '', // From original outward record
    NetWeight: '', // Calculated
    DifferenceBT: '',
    
    ToleranceWeight: '',
    ActuallyWeight: '',
    
    GateEntryDate: todayDateOnly,
    GateOutDate: todayDateOnly,
    SAP_CreatedDateTime: nowIso(),
  };
};

const getField = (obj, paths) => {
  for (const path of paths) {
    if (obj && obj[path] !== undefined) return obj[path];
  }
  return '';
};

const toWeightNumber = (value) => {
  const normalized = String(value || '').replace(',', '.').trim();
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const calculateNetWeight = (gross, tare) => {
  const grossNum = toWeightNumber(gross);
  const tareNum = toWeightNumber(tare);
  if (!Number.isFinite(grossNum) || !Number.isFinite(tareNum)) return '';
  return (grossNum - tareNum).toFixed(3);
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

export default function MaterialOutwardTareCapture() {
  const [form, setForm] = useState(createInitialState());
  const [loading, setLoading] = useState(false);
  const [grossWeightLoading, setGrossWeightLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [recordFound, setRecordFound] = useState(false);


  const validate = () => {
    const errs = [];
    if (!form.GateEntryNumber) errs.push('Gate Entry Number is required');
    if (!form.WeightDocNumber) errs.push('Weight Document Number not found');
    // Only require Tare Weight once record has been loaded
    if (recordFound && !form.TareWeight) errs.push('Tare Weight is required');
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

  const handleGetGrossWeight = async () => {
    setGrossWeightLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetchGateOutWaymentFromBridge();
      const rawWeight = response?.data?.data?.weight;
      const parsedWeight = parseBridgeWeightValue(rawWeight);

      if (!parsedWeight) {
        throw new Error('Unable to parse gross weight from weighbridge response');
      }

      setForm((prev) => {
        const updated = { ...prev, GrossWeight: parsedWeight };
        updated.NetWeight = calculateNetWeight(parsedWeight, updated.TareWeight);
        return updated;
      });
      setResult(`Gross loaded from gate-out-wayment: ${parsedWeight}`);
    } catch (err) {
      setError(getBridgeErrorMessage(err, 'gate-out-wayment'));
    } finally {
      setGrossWeightLoading(false);
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

    const headerRows = [
      ['Weight Doc No:', f('WeightDocNumber'), 'Date:', printDate],
      ['Gate Entry No:', f('GateEntryNumber'), 'Print Time:', printTime],
      ['Gate Entry Date:', f('GateEntryDate'), 'Vehicle No:', f('TruckNumber')],
      ['Gross Weight:', `${f('GrossWeight')} MT`, 'Tare Weight:', `${f('TareWeight')} MT`],
      ['Net Weight:', `${data.NetWeight || '-'} MT`, 'Permit No:', f('PermitNumber')],
      ['Transporter:', f('TransporterCode'), 'LR/GC No:', f('LRGCNumber')],
      ['Remarks:', f('Remarks'), '', ''],
    ];

    const sdRows = (data.SalesDocument || data.Customer || data.Material) ? `
      <tr>
        <td style="border:1px solid #000; padding:3px;">${data.SalesDocument || '-'}</td>
        <td style="border:1px solid #000; padding:3px;">${data.Customer || '-'}</td>
        <td style="border:1px solid #000; padding:3px;">${data.CustomerName || '-'}</td>
        <td style="border:1px solid #000; padding:3px;">${data.Material || '-'}</td>
        <td style="border:1px solid #000; padding:3px;">${data.MaterialDescription || '-'}</td>
      </tr>
    ` : '<tr><td colspan="5" style="border:1px solid #000; padding:4px; text-align:center;">-</td></tr>';

    element.innerHTML = `
      <div style="font-family: Arial, sans-serif; color: #000; background: #fff; width: 100%; max-width: 700px; margin: 0 auto; font-size: 10px;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 4px;">
          <div>
            <div style='font-size: 13px; font-weight: bold;'>Minera Steel &amp; Power Pvt Ltd</div>
            <div style='font-size: 9px;'>Yerabanahalli Village, Sandur Taluk, Ballari Dist, Karnataka - 583115</div>
          </div>
          ${logoDataUrl ? `<img src='${logoDataUrl}' alt='Logo' style='height: 28px; width: auto; margin-left: 8px;'/>` : ''}
        </div>
        <div style="text-align:center; font-size:12px; font-weight:bold; margin-bottom: 4px;">Material Outward - Weight Slip</div>
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
        <div style="margin-bottom: 2px; font-size:10px;"><b>Sales Document Details</b></div>
        <table style="width:100%; border:1px solid #000; border-collapse:collapse; font-size:8.5px;">
          <thead>
            <tr>
              <th style="border:1px solid #000; padding:4px; text-align:left;">Sales Document</th>
              <th style="border:1px solid #000; padding:4px; text-align:left;">Customer</th>
              <th style="border:1px solid #000; padding:4px; text-align:left;">Customer Name</th>
              <th style="border:1px solid #000; padding:4px; text-align:left;">Material</th>
              <th style="border:1px solid #000; padding:4px; text-align:left;">Description</th>
            </tr>
          </thead>
          <tbody>
            ${sdRows}
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
        filename: `MaterialOutward_${data.WeightDocNumber || data.GateEntryNumber || 'Slip'}.pdf`,
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
      fileName: `MaterialOutward_${data.WeightDocNumber || data.GateEntryNumber || 'Slip'}.pdf`,
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
      const normalizedGross = String(payload.GrossWeight || '').trim();
      const normalizedTare = String(payload.TareWeight || '').trim();

      // Convert dates
      if (payload.GateEntryDate && payload.GateEntryDate.length === 10) {
        payload.GateEntryDate = `${payload.GateEntryDate}T00:00:00`;
      }
      if (payload.GateOutDate && payload.GateOutDate.length === 10) {
        payload.GateOutDate = `${payload.GateOutDate}T00:00:00`;
      }

      // Calculate Net Weight
      payload.GrossWeight = normalizedGross;
      payload.TareWeight = normalizedTare;
      payload.NetWeight = calculateNetWeight(payload.GrossWeight, payload.TareWeight);

      if (!payload.NetWeight) {
        setError('Gross Weight and Tare Weight must be valid numbers.');
        setLoading(false);
        return;
      }

      payload.SAP_CreatedDateTime = nowIso();

      console.debug('Update Weight payload ->', payload);

      // UPDATE existing record using SAP_UUID
      const response = await updateMaterialInward(payload.SAP_UUID, payload);

      // Explicitly update gate header weights too (same fields user sees in gate header feed).
      await updateHeaderByKey(payload.GateEntryNumber, {
        GrossWeight: payload.GrossWeight,
        TareWeight: payload.TareWeight,
        NetWeight: payload.NetWeight,
        OutwardTime: formatSapTime(payload.OutwardTime || new Date().toISOString().slice(11, 19)),
      });

      setResult('Tare Weight captured successfully! Net Weight calculated.');
      // No auto print. Show print button after success.
    } catch (err) {
      console.error('Update weight err', err?.response?.data || err.message);
      let msg = err?.response?.data?.error?.message?.value || err?.response?.data?.error || err.message || 'Unknown error';
      // Try to extract error from XML if present
      if (typeof msg === 'string' && msg.trim().startsWith('<?xml')) {
        // Try to extract <message>...</message> or <Message>...</Message>
        const match = msg.match(/<message>([\s\S]*?)<\/message>/i) || msg.match(/<Message>([\s\S]*?)<\/Message>/i);
        if (match && match[1]) {
          msg = match[1].replace(/\n/g, ' ').trim();
        } else {
          // fallback: strip XML tags
          msg = msg.replace(/<[^>]+>/g, '').replace(/\n/g, ' ').trim();
        }
      }
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => {
      const updated = { ...prev, [name]: type === 'checkbox' ? checked : value };

      // Always recalculate Net Weight if either GrossWeight or TareWeight changes
      if (name === 'TareWeight' || name === 'GrossWeight') {
        const gross = name === 'GrossWeight' ? value : updated.GrossWeight;
        const tare = name === 'TareWeight' ? value : updated.TareWeight;
        updated.NetWeight = calculateNetWeight(gross, tare);
      }

      return updated;
    });
  };
  // When Gate Entry Number changes, fetch existing Material Outward record
  const handleGateEntryChange = async (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setRecordFound(false);
    
    if (name === 'GateEntryNumber' && value && value.trim().length >= 5) {
      setLoading(true);
      setError(null);
      try {
        // Fetch outward records (Indicators='O')
        const resp = await fetchMaterialOutwardByGateNumber(value.trim());
        console.log('[DBG] Material Outward response:', resp?.data);
        
        const entries = resp?.data?.d?.results || resp?.data?.value || [];
        if (!Array.isArray(entries) || entries.length === 0) {
          setError('No Material Outward record found for this Gate Entry Number. Please complete Material Outward first.');
          setLoading(false);
          return;
        }
        
        // Filter for Outward (Indicators = 'O')
        const outwardRecords = entries.filter(e => e.Indicators === 'O');
        
        if (outwardRecords.length === 0) {
          setError('No Outward records found for this Gate Entry Number.');
          setLoading(false);
          return;
        }
        
        // Get the first matching entry
        const outwardRecord = outwardRecords[0];
        console.log('Fetched outwardRecord:', outwardRecord);

        const parsedDate = parseSapDateToISODateOnly(
          outwardRecord.GateEntryDate || outwardRecord.GateOutDate || outwardRecord.GateDate
        );

        // Populate form with existing Material Outward data
        setForm(prev => ({
          ...prev,
          SAP_UUID: outwardRecord.SAP_UUID || outwardRecord.UUID,
          WeightDocNumber: outwardRecord.WeightDocNumber || '',
          GateEntryNumber: value.trim(),
          GateEntryDate: parsedDate || prev.GateEntryDate,
          TruckNumber: outwardRecord.TruckNumber || '',
          TransporterCode: outwardRecord.TransporterCode || '',
          LRGCNumber: outwardRecord.LRGCNumber || '',
          PermitNumber: outwardRecord.PermitNumber || '',
          Remarks: outwardRecord.Remarks || '',
          GateFiscalYear: outwardRecord.FiscalYear || outwardRecord.GateFiscalYear || prev.GateFiscalYear,
          FiscalYear: outwardRecord.FiscalYear || prev.FiscalYear,

          // Gross Weight from the original record (READ-ONLY)
          GrossWeight: outwardRecord.GrossWeight || '',
          TruckCapacity: outwardRecord.TruckCapacity || '',
          
          // Keep Tare Weight empty for user to enter
          TareWeight: outwardRecord.TareWeight || '',
          NetWeight: calculateNetWeight(outwardRecord.GrossWeight, outwardRecord.TareWeight),
          

          // SD Details
          SalesDocument: outwardRecord.SalesDocument || '',
          Customer: outwardRecord.Customer || '',
          CustomerName: outwardRecord.CustomerName || '',
          Material: outwardRecord.Material || '',
          MaterialDescription: outwardRecord.MaterialDescription || '',

          ToleranceWeight: outwardRecord.ToleranceWeight || '',
          ActuallyWeight: outwardRecord.ActuallyWeight || '',
          OutboundDelivery: outwardRecord.OutboundDelivery,
        }));

        setRecordFound(true);
        console.log('[DBG] Material Outward record loaded successfully');
      } catch (err) {
        console.error('Failed to fetch material outward:', err);
        setError('Could not fetch Material Outward details');
      } finally {
        setLoading(false);
      }
    }
  };
  


const handleGoodsIssue = async () => {
  setError(null);
  setResult(null);
  setLoading(true);

  try {
    const deliveryDoc = form.OutboundDelivery;
    const netWeight = calculateNetWeight(form.GrossWeight, form.TareWeight);
    const itemNumber = "10";

    if (!deliveryDoc) {
      setError('No Outbound Delivery number found.');
      setLoading(false);
      return;
    }
    if (!netWeight) {
      setError('Net Weight is required to update Outbound Delivery.');
      setLoading(false);
      return;
    }

    // 1) Update Outbound Delivery item with Net Weight
    // await updateOutboundDelivery(deliveryDoc, itemNumber, {
    //   ActualDeliveryQuantity: netWeight,
    //   YY1_GrossWeight_DLH: form.GrossWeight,
    // });
function formatSapODataDate(date) {
  if (!date) return null;
  if (typeof date === 'string' && date.startsWith('/Date(')) return date;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return `/Date(${d.getTime()})/`;
}
function formatSapTime(timeStr) {
  if (!timeStr) return null;

  // If already SAP format → return as is
  if (timeStr.startsWith("PT")) {
    return timeStr;
  }

  // If normal format → convert
  const [hh, mm, ss] = timeStr.split(":");
  return `PT${hh}H${mm}M${ss}S`;
}
    // 1) Update Outbound Delivery item with Net Weight
await updateOutboundDelivery(deliveryDoc, itemNumber, {
  item: {
    ActualDeliveryQuantity: netWeight
  },
  header: {
    YY1_GrossWeight_DLH: form.GrossWeight,
    YY1_WeighbridgeNo_DLH: form.WeightDocNumber,
    YY1_WeighbridgeDate_DLH: formatSapODataDate(form.GateEntryDate),
    YY1_WeighbridgeTime_DLH: formatSapTime(form.OutwardTime),
    YY1_PGIDate_DLH: formatSapODataDate(form.GateEntryDate),
    YY1_PGITime_DLH: formatSapTime(form.OutwardTime),
    YY1_LRDate_DLH: formatSapODataDate(form.GateEntryDate),
   // YY1_WeighbridgeTime_DLH: new Date().toISOString().slice(11, 19)
  }
});


    // 2) Create Goods Issue and Billing Document, and get PDF
    const response = await axios.post(
       'http://localhost:4600/api/goodsissue-and-invoice-int',
       //'https://gateentry.cfapps.in30.hana.ondemand.com/api/goodsissue-and-invoice-int',
      // 'https://gateentry-backend-latest.onrender.com/api/goodsissue-and-invoice',
  //    'https://GateEntry.cfapps.us10-001.hana.ondemand.com/api/goodsissue-and-invoice',
      { DeliveryDocument: deliveryDoc },
      { responseType: 'arraybuffer', timeout: 60000 } // use arraybuffer for binary
    );

    // Debug: log headers & length
    console.log('Download response headers:', response.headers);
    const contentType = response.headers['content-type'] || '';
    const goodsIssueNumber = response.headers['x-goods-issue-number'] || response.headers['X-Goods-Issue-Number'];
    const billingDocumentNumber = response.headers['x-billing-document-number'] || response.headers['X-Billing-Document-Number'];
    console.log('GI:', goodsIssueNumber, 'Billing:', billingDocumentNumber);
    console.log('Received byteLength:', response.data && response.data.byteLength);

    // If server returned a PDF (content-type contains pdf OR large enough array)
    const isPdfMime = contentType.toLowerCase().includes('pdf');
    const byteLen = response.data ? response.data.byteLength || response.data.length || 0 : 0;

    if (isPdfMime || byteLen > 2000) {
      // Build blob and trigger download
      const blob = new Blob([response.data], { type: (contentType && contentType !== '') ? contentType : 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // filename with billing number if available
      const fileName = billingDocumentNumber ? `Billing_${billingDocumentNumber}.pdf` : `GoodsIssueBilling_${Date.now()}.pdf`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setResult(
        `Outbound Delivery updated and Goods Issue + Billing Document created successfully! 
         Goods Issue No: ${goodsIssueNumber || 'N/A'}, 
         Billing Doc No: ${billingDocumentNumber || 'N/A'}`
      );
    } else {
      // Probably an error JSON or small corrupted PDF — try to decode text
      const textDecoder = new TextDecoder('utf-8');
      const text = textDecoder.decode(response.data);
      console.warn('Server returned non-PDF response (text):', text);
      setError(text || 'Failed to download PDF: server returned non-PDF response.');
    }
  } catch (err) {
    console.error('handleGoodsIssue error:', err);
    // If server responded with data (arraybuffer) but with error status, decode it
    if (err?.response?.data) {
      try {
        const textDecoder = new TextDecoder('utf-8');
        const errText = textDecoder.decode(err.response.data);
        setError(errText || err.message || 'Unknown server error');
      } catch (e) {
        setError(err.message || 'Unknown server error');
      }
    } else {
      setError(err?.response?.data?.error || err.message || 'Failed to update Outbound Delivery or create Goods Issue');
    }
  } finally {
    setLoading(false);
  }
};

const handleCombinedAction = async () => {
  setLoading(true);
  setError(null);
  setResult(null);
  try {
    // 1. Capture Tare Weight & Calculate
    await onSubmit({ preventDefault: () => {} });
    // Only proceed if no error
    if (error) return;
    // 2. Create Goods Issue
    await handleGoodsIssue();
    // If both succeed, set a combined result
    setResult('Tare Weight captured, calculated, and Goods Issue created successfully!');
  } catch (err) {
    setError(err.message || 'Unknown error');
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="create-header-container">
      <h2 className="page-title">Material Outward - Tare Weight Capture</h2>
      <p className="page-description">Enter Gate Entry Number to load existing Material Outward record and capture Tare Weight</p>
      
      <form onSubmit={onSubmit} className="create-form">
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
              <label className="form-label">LR/GC Number</label>
              <input  
                type="text"
                name="LRGCNumber"
                value={form.LRGCNumber}
                className="form-input"
                onChange={handleChange}
                readOnly={!recordFound}
                style={{ backgroundColor: recordFound ? '#ffffff' : '#f0f0f0' }}
                placeholder="Enter LR/GC Number (any value)"
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
              <label className="form-label">Gross Weight (Loaded)</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  name="GrossWeight"
                  value={form.GrossWeight}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Enter Gross weight"
                  required
                  disabled={!recordFound}
                />
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

            <div className="form-group">
              <label className="form-label">Tare Weight (Loaded)</label>
              <input
                type="text"
                name="TareWeight"
                value={form.TareWeight}
                onChange={handleChange}
                className="form-input"
                placeholder="Enter Tare Weight"
                disabled={!recordFound}
                // Remove readOnly & green background
                style={{
                  backgroundColor: recordFound ? '#ffffff' : '#f0f0f0'
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Net Weight</label>
              <input
                type="text"
                name="NetWeight"
                value={form.NetWeight}
                onChange={handleChange}
                className="form-input"
                placeholder="Enter Net Weight"
                disabled={!recordFound}
                // Remove readOnly & green background
                style={{
                  backgroundColor: recordFound ? '#ffffff' : '#f0f0f0'
                }}
              />
            </div>

            {/* <div className="form-group">
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
            </div> */}
          </div>
        </section>

        {recordFound && (
          <section className="form-section">
            <h3 className="section-title">Sales Document Details (Read-Only)</h3>
            <div className="sd-entry-card" style={{ opacity: 0.7 }}>
              <div className="grid-4-cols">
                <div className="form-group">
                  <label className="form-label">Sales Document</label>
                  <input
                    className="form-input"
                    name="SalesDocument"
                    value={form.SalesDocument}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Customer</label>
                  <input
                    className="form-input"
                    name="Customer"
                    value={form.Customer}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Customer Name</label>
                  <input
                    className="form-input"
                    name="CustomerName"
                    value={form.CustomerName}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Material</label>
                  <input
                    className="form-input"
                    name="Material"
                    value={form.Material}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Material Description</label>
                  <input
                    className="form-input"
                    name="MaterialDescription"
                    value={form.MaterialDescription}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="form-actions">
          {/* <button type="button" className="btn btn-primary" disabled={loading || !recordFound} onClick={onSubmit}>
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
          </button> */}
        </div>
      </form>

      {recordFound && (
        // <div className="form-actions" style={{ marginTop: 16 }}>
        //   <button
        //     type="button"
        //     className="btn btn-success"
        //     onClick={handleGoodsIssue}
        //     disabled={loading}
        //   >
        //     {loading ? 'Processing...' : 'Create Goods Issue'}
        //   </button>
        // </div>
        <button
  type="button"
  className="btn btn-success"
  disabled={loading || !recordFound}
  onClick={handleCombinedAction}
>
  {loading ? 'Processing...' : 'Goods Issue & Capture Tare Weight & Calculate'}
</button>
      )}

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {typeof error === 'object' ? JSON.stringify(error) : error}
        </div>
      )}

      {result && (
        <div className="success-message">
          <strong>Success:</strong> {result}
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                setLoading(true);
                try {
                  await printPdfSlip(form);
                  setResult(r => (r ? r + ' (Slip sent to printer)' : 'Slip sent to printer'));
                } catch (e) {
                  setError('Failed to print slip: ' + (e?.message || e));
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              {loading ? 'Printing...' : 'Print Weight Slip'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
