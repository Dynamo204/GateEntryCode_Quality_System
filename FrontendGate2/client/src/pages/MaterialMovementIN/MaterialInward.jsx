
import React, { useState, useEffect } from 'react';
import { 
  createMaterialInward, 
  fetchNextWeightDocNumber,
  fetchGateEntryByNumber,
  fetchMaterialInwardByGateNumber,
  fetchGateInWaymentFromBridge
} from '../../api';
import './MaterialINHome.css';

// Helper: ISO timestamp
const nowIso = (d = new Date()) => d.toISOString();

// initial state factory
const createInitialState = () => {
  const todayDateOnly = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  return {
    WeightDocNumber: '',
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
    LRGCNumber: "",
    PermitNumber: "",
    SubTransporterName:"",
    TruckCapacity: '70',
    GrossWeight: '',
    NetWeght: '',
    DifferenceBT: '',
    Remarks: '',
    
    VendorInvoiceNumber: '',
    VendorInvoiceNumber2: '',
    VendorInvoiceNumber3: '',
    VendorInvoiceNumber4: '',
    VendorInvoiceNumber5: '',
    
    VendorInvoiceDate: '',
    VendorInvoiceDate2: '',
    VendorInvoiceDate3: '',
    VendorInvoiceDate4: '',
    VendorInvoiceDate5: '',

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
    
    Customer: '',
    CustomerName: '',
    
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
    
    GateEntryDate: todayDateOnly,
    GateOutDate: todayDateOnly,
    SAP_CreatedDateTime: nowIso(),
    
    // Keep InwardTime empty - filled from gate entry
    InwardTime: '',
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

const fetchGateEntryDetails = async (gateEntryNumber) => {
  try {
    const resp = await fetchGateEntryByNumber(gateEntryNumber);
    console.log('[DBG] Gate entry response:', resp?.data);
    
    // Handle OData v2 response structure
    const entries = resp?.data?.d?.results || resp?.data?.value || [];
    if (!Array.isArray(entries) || entries.length === 0) {
      console.log('No gate entry found for number:', gateEntryNumber);
      return null;
    }
    
    // Return the first (and should be only) matching entry
    return entries[0];
  } catch (err) {
    console.error('Error fetching gate entry:', err);
    throw err;
  }
};

export default function MaterialInward() {
  const [form, setForm] = useState(createInitialState());
  const [loading, setLoading] = useState(false);
  const [grossWeightLoading, setGrossWeightLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [visiblePOSections, setVisiblePOSections] = useState(1);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Vehicle/Truck Number - no spaces allowed
    if (name === 'TruckNumber') {
      const noSpaces = value.replace(/\s/g, '');
      setForm(prev => ({ ...prev, [name]: noSpaces }));
      return;
    }

    // Prevent changes to TruckCapacity (fixed at 70)
    if (name === 'TruckCapacity') {
      return;
    }

    // Numeric fields - only numbers and decimal
    if (name.includes('VendorInvoiceWeight') || name.includes('BalanceQty') || 
      name === 'GrossWeight' ||
        name === 'NetWeght' || name === 'DifferenceBT' || name === 'ToleranceWeight' ||
        name === 'ActuallyWeight') {
      if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
        setForm(prev => ({ ...prev, [name]: value }));
      }
      return;
    }

    // Vendor Invoice Number - alphanumeric
    if (name.includes('VendorInvoiceNumber')) {
      setForm(prev => ({ ...prev, [name]: value }));
      return;
    }

    // Vendor Invoice Date - allow date format
    if (name.includes('VendorInvoiceDate')) {
      setForm(prev => ({ ...prev, [name]: value }));
      return;
    }

    // Character-only fields (names)
    if (name === 'SubTransporterName') {
      const charsOnly = value.replace(/[0-9]/g, '');
      setForm(prev => ({ ...prev, [name]: charsOnly }));
      return;
    }

    // Default handling
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const validate = () => {
    const errs = [];
    if (!form.GateEntryNumber) errs.push('GateEntryNumber is required (link gate entry).');
    if (!form.TruckNumber) errs.push('TruckNumber is required.');
    if (!form.GrossWeight) errs.push('GrossWeight is required.');
    if (form.GrossWeight && Number(form.GrossWeight) <= 0) errs.push('GrossWeight must be greater than 0.');
    
    // Vehicle number must not contain spaces
    if (form.TruckNumber && /\s/.test(form.TruckNumber)) {
      errs.push('Vehicle number must not contain spaces.');
    }
    
    // add more checks as you want
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

  const handleGetGrossWeight = async () => {
    setGrossWeightLoading(true);
    setError(null);

    try {
      const response = await fetchGateInWaymentFromBridge();
      const rawWeight = response?.data?.data?.weight;
      const parsedWeight = parseBridgeWeightValue(rawWeight);

      if (!parsedWeight) {
        throw new Error('Unable to parse gross weight from weighbridge response');
      }

      setForm((prev) => ({ ...prev, GrossWeight: parsedWeight }));
    } catch (err) {
      setError(err?.message || 'Failed to get gross weight');
    } finally {
      setGrossWeightLoading(false);
    }
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    setError(null);
    setResult(null);
    const v = validate();
    if (v.length) { setError(v.join(' ')); return; }

    setLoading(true);
    try {
      let payload = { ...form };
      // Only generate WeightDocNumber on Save
      if (!form.WeightDocNumber) {
        const year = new Date().getFullYear().toString();
        const resp = await fetchNextWeightDocNumber(year, 4); // code=4 for 251 series (Inward)
        const nextNumber = resp?.data?.next || resp?.data?.value || resp?.data || '';
        setForm(prev => ({ ...prev, WeightDocNumber: String(nextNumber || '') }));
        payload.WeightDocNumber = String(nextNumber || '');
      }

      // Convert date fields to SAP datetime format (YYYY-MM-DDTHH:mm:ss)
      if (payload.GateEntryDate && payload.GateEntryDate.length === 10) {
        payload.GateEntryDate = `${payload.GateEntryDate}T00:00:00`;
      }
      if (payload.GateOutDate && payload.GateOutDate.length === 10) {
        payload.GateOutDate = `${payload.GateOutDate}T00:00:00`;
      }

      // Handle VendorInvoiceDate fields (1 through 5)
      for (let i = 1; i <= 5; i++) {
        const suffix = i === 1 ? '' : String(i);
        const dateField = `VendorInvoiceDate${suffix}`;
        
        if (payload[dateField]) {
          // If it's a date string (YYYY-MM-DD), convert to datetime
          if (payload[dateField].length === 10) {
            payload[dateField] = `${payload[dateField]}T00:00:00`;
          }
        } else {
          // Remove empty date fields
          delete payload[dateField];
        }
      }

      // Tare weight is handled in the next process screen, not in this create screen.
      delete payload.TareWeight;

      // Ensure GrossWeight is always sent from this screen.
      payload.GrossWeight = String(form.GrossWeight || '').trim();

      // Keep VendorInvoiceWeight aligned when first PO line exists and value is empty.
      if (payload.PurchaseOrderNumber && !payload.VendorInvoiceWeight) {
        payload.VendorInvoiceWeight = payload.GrossWeight;
      }

      // Remove or set InwardTime and OutwardTime to null if not needed
      delete payload.InwardTime;
      delete payload.OutwardTime;

      payload.SAP_CreatedDateTime = nowIso();

      Object.keys(payload).forEach(key => {
        if (payload[key] === '' || payload[key] === null || payload[key] === undefined) {
          delete payload[key];
        }
      });

      console.debug('Weight payload ->', payload);

      const response = await createMaterialInward(payload);
      setResult({
        message: 'Material Inward created successfully',
        gateNumber: form.GateEntryNumber,
        weightDocNumber: form.WeightDocNumber,
        date: form.GateEntryDate,
        vehicle: form.TruckNumber
      });

      setTimeout(() => {
        setForm(createInitialState());
        setResult(null);
        setVisiblePOSections(1);
      }, 3000);
    } catch (err) {
      console.error('create weight err', err?.response?.data || err.message);
      const resp = err?.response?.data;
      let msg = err?.message || 'Unknown error';
      if (resp) {
        if (typeof resp.error === 'string') {
          msg = resp.error;
        } else if (resp.error?.message?.value) {
          msg = resp.error.message.value;
        } else if (resp.error?.message && typeof resp.error.message === 'string') {
          msg = resp.error.message;
        } else if (resp.message && typeof resp.message === 'string') {
          msg = resp.message;
        } else if (typeof resp.error === 'object') {  
          msg = JSON.stringify(resp.error);
        }
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };



  // Extract fetch logic to reusable function
  const fetchNextWeightNumber = async () => {
    try {
      const year = new Date().getFullYear().toString();
      const response = await fetchNextWeightDocNumber(year, 4); // code=1 for 251 series (Inward)
      const nextNumber = response?.data?.next || response?.data?.value || response?.data || '';
      
      if (nextNumber) {
        setForm(prev => ({
          ...prev,
          WeightDocNumber: String(nextNumber),
          FiscalYear: year
        }));
        console.log('[INFO] Fetched next WeightDocNumber:', nextNumber);
      } else {
        console.warn('[WARN] No WeightDocNumber returned from API');
        setError('Could not fetch next weight document number');
      }
    } catch (err) {
      console.error('Error fetching next weight doc number:', err);
      setError('Could not fetch next weight document number');
    }
  };

  // Add this new function inside component
  const handleGateEntryChange = async (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    
    if (name === 'GateEntryNumber' && value && value.length >= 5) {
      setLoading(true);
      setError(null);
      try {
        // 1. Check for existing material inward for this gate entry
        const inwardResp = await fetchMaterialInwardByGateNumber(value);
        const inwardResults = inwardResp?.data?.d?.results || inwardResp?.data?.value || [];
        if (Array.isArray(inwardResults) && inwardResults.length > 0) {
          setError('⚠️ This Gate Entry Number already has a weightbridge/material inward record. Please use a different gate entry.');
          setLoading(false);
          return;
        }

        const gateEntry = await fetchGateEntryDetails(value);
        if (!gateEntry) {
          console.log('No gate entry found for:', value);
          setLoading(false);
          return;
        }

        // Convert SAP date to yyyy-MM-dd for <input type="date">
        const parsedDate = parseSapDateToISODateOnly(gateEntry.GateEntryDate || gateEntry.GateInDate || gateEntry.GateDate);

        // Count how many PO lines have data
        let poCount = 0;
        for (let i = 1; i <= 5; i++) {
          const suffix = i === 1 ? '' : String(i);
          if (gateEntry[`PurchaseOrderNumber${suffix}`]) {
            poCount = i;
          }
        }
        // Set visible sections to the count of PO lines, minimum 1
        setVisiblePOSections(Math.max(1, poCount));

        // Map gate entry fields to form (map nested/alternate properties as available)
        setForm(prev => ({
          ...prev,
          GateEntryDate: parsedDate || prev.GateEntryDate,
          TruckNumber: gateEntry.VehicleNumber || gateEntry.TruckNumber || gateEntry.VehicleNo || '',
          TransporterCode: gateEntry.TransporterCode || gateEntry.TransporterName || '',
          GateFiscalYear: gateEntry.FiscalYear || prev.GateFiscalYear,
          LRGCNumber: gateEntry.LRGCNumber || '',
          PermitNumber: gateEntry.PermitNumber || '',
          SubTransporterName: gateEntry.SubTransporterName || '',
          Remarks: gateEntry.Remarks || '',

          // PO lines (fill suffix 1..5)
          PurchaseOrderNumber: gateEntry.PurchaseOrderNumber || '',
          PurchaseOrderNumber2: gateEntry.PurchaseOrderNumber2 || '',
          PurchaseOrderNumber3: gateEntry.PurchaseOrderNumber3 || '',
          PurchaseOrderNumber4: gateEntry.PurchaseOrderNumber4 || '',
          PurchaseOrderNumber5: gateEntry.PurchaseOrderNumber5 || '',

          PurchaseOrderItem: gateEntry.PurchaseOrderItem || '',
          PurchaseOrderItem2: gateEntry.PurchaseOrderItem2 || '',
          PurchaseOrderItem3: gateEntry.PurchaseOrderItem3 || '',
          PurchaseOrderItem4: gateEntry.PurchaseOrderItem4 || '',
          PurchaseOrderItem5: gateEntry.PurchaseOrderItem5 || '',

          Material: gateEntry.Material || '',
          Material2: gateEntry.Material2 || '',
          Material3: gateEntry.Material3 || '',
          Material4: gateEntry.Material4 || '',
          Material5: gateEntry.Material5 || '',

          MaterialDescription: gateEntry.MaterialDescription || '',
          MaterialDescription2: gateEntry.MaterialDescription2 || '',
          MaterialDescription3: gateEntry.MaterialDescription3 || '',
          MaterialDescription4: gateEntry.MaterialDescription4 || '',
          MaterialDescription5: gateEntry.MaterialDescription5 || '',

          Vendor: gateEntry.Vendor || '',
          Vendor2: gateEntry.Vendor2 || '',
          Vendor3: gateEntry.Vendor3 || '',
          Vendor4: gateEntry.Vendor4 || '',
          Vendor5: gateEntry.Vendor5 || '',

          VendorName: gateEntry.VendorName || '',
          VendorName2: gateEntry.VendorName2 || '',
          VendorName3: gateEntry.VendorName3 || '',
          VendorName4: gateEntry.VendorName4 || '',
          VendorName5: gateEntry.VendorName5 || '',

          VendorInvoiceNumber: gateEntry.VendorInvoiceNumber || '',
          VendorInvoiceNumber2: gateEntry.VendorInvoiceNumber2 || '',
          VendorInvoiceNumber3: gateEntry.VendorInvoiceNumber3 || '',
          VendorInvoiceNumber4: gateEntry.VendorInvoiceNumber4 || '',
          VendorInvoiceNumber5: gateEntry.VendorInvoiceNumber5 || '',

          VendorInvoiceDate: parseSapDateToISODateOnly(gateEntry.VendorInvoiceDate) || '',
          VendorInvoiceDate2: parseSapDateToISODateOnly(gateEntry.VendorInvoiceDate2) || '',
          VendorInvoiceDate3: parseSapDateToISODateOnly(gateEntry.VendorInvoiceDate3) || '',
          VendorInvoiceDate4: parseSapDateToISODateOnly(gateEntry.VendorInvoiceDate4) || '',
          VendorInvoiceDate5: parseSapDateToISODateOnly(gateEntry.VendorInvoiceDate5) || '',

          VendorInvoiceWeight: gateEntry.VendorInvoiceWeight || '',
          VendorInvoiceWeight2: gateEntry.VendorInvoiceWeight2 || '',
          VendorInvoiceWeight3: gateEntry.VendorInvoiceWeight3 || '',
          VendorInvoiceWeight4: gateEntry.VendorInvoiceWeight4 || '',
          VendorInvoiceWeight5: gateEntry.VendorInvoiceWeight5 || '',

          BalanceQty: gateEntry.BalanceQty || '',
          BalanceQty2: gateEntry.BalanceQty2 || '',
          BalanceQty3: gateEntry.BalanceQty3 || '',
          BalanceQty4: gateEntry.BalanceQty4 || '',
          BalanceQty5: gateEntry.BalanceQty5 || '',

          // Fetch InwardTime from gate entry and convert from PT format if needed
          InwardTime: parseSapTimeToHHMMSS(gateEntry.InwardTime || gateEntry.GateInTime || gateEntry.TimeIn || ''),
        }));

        console.log('[DBG] Form updated with gate entry details');
      } catch (err) {
        console.error('Failed to fetch gate entry details:', err);
        setError('Could not fetch gate entry details');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="create-header-container">
      <h2 className="page-title" style={{ margin: '0 auto 10px', textAlign: 'center', width: '100%' }}>Material Movement Inward</h2>
      
      <form onSubmit={onSubmit} className="create-form" onKeyDown={(e) => {
        // Prevent form submission when Enter is pressed in input fields
        if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.type !== 'submit') {
          e.preventDefault();
        }
      }}>
        <section className="form-section">
          <h3 className="section-title">Material Details</h3>
          
          <div className="grid-2-cols">
            <div className="form-group" style={{ background: '#e8f4ff', border: '1.5px solid #4a90d9', borderRadius: '8px', padding: '10px 12px' }}>
              <label className="form-label" style={{ color: '#1a5fa8', fontWeight: '700' }}>Gate Entry Number</label>
              <input
                type="text"
                name="GateEntryNumber"
                value={form.GateEntryNumber}
                onChange={handleGateEntryChange}
                className="form-input"
                required
                style={{ background: '#ffffff', border: '1.5px solid #4a90d9', fontWeight: '600' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Gate Entry Date</label>
              <input
                type="date"
                name="GateEntryDate"
                value={form.GateEntryDate}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Weight Doc Number</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  name="WeightDocNumber"
                  value={form.WeightDocNumber}
                  className="form-input"
                  readOnly
                  style={{ flex: 1 }}
                  placeholder="WeightBridge Number"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">FiscalYear</label>
              <input
                type="text"
                name="FiscalYear"
                value={form.FiscalYear}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Vehicle Number</label>
              <input
                type="text"
                name="TruckNumber"
                value={form.TruckNumber}
                onChange={handleChange}
                className="form-input"
                
              />
            </div>
            <div className="form-group">
              <label className="form-label">Transporter</label>
              <input
                type="text"
                name="TransporterCode"
                value={form.TransporterCode}
                onChange={handleChange}
                className="form-input"
                
              />
            </div>
            <div className="form-group">
              <label className="form-label">Permit Number</label>
              <input
                type="text"
                name="PermitNumber"
                value={form.PermitNumber}
                onChange={handleChange}
                className="form-input"
                
              />
            </div>
            <div className="form-group">
              <label className="form-label">LRGC Number</label>
              <input
                type="text"
                name="LRGCNumber"
                value={form.LRGCNumber}
                onChange={handleChange}
                className="form-input"
                
              />
            </div>
            <div className="form-group">
              <label className="form-label">Sub Transporter Name</label>
              <input
                type="text"
                name="SubTransporterName"
                value={form.SubTransporterName}
                onChange={handleChange}
                className="form-input"
                
              />
            </div>
            <div className="form-group">
              <label className="form-label">Remarks</label>
              <input
                type="text"
                name="Remarks"
                value={form.Remarks}
                onChange={handleChange}
                className="form-input"
              
              />
            </div>
            <div className="form-group">
              <label className="form-label">Truck Capacity</label>
              <input
                type="text"
                name="TruckCapacity"
                value={form.TruckCapacity}
                onChange={handleChange}
                className="form-input"
                placeholder="70"
                readOnly
                style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Gross Weight</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  name="GrossWeight"
                  value={form.GrossWeight}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="0.00"
                  required
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

            {/* <div className="form-group">
              <label className="form-label">Net Weight</label>
              <input
                type="text"
                name="NetWeght"
                value={form.NetWeght}
                onChange={handleChange}
                className="form-input"
                placeholder="30.000"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Difference BT</label>
              <input
                type="text"
                name="DifferenceBT"
                value={form.DifferenceBT}
                onChange={handleChange}
                className="form-input"
                placeholder="30.000"
                required
              />
            </div> */}

            {/* <div className="form-group">
              <label className="form-label">Vendor Invoice Number</label>
              <input
                type="text"
                name="VendorInvoiceNumber"
                value={form.VendorInvoiceNumber}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Vendor Invoice Weight</label>
              <input
                type="text"
                name="VendorInvoiceWeight"
                value={form.VendorInvoiceWeight}
                onChange={handleChange}
                className="form-input"
                placeholder="32.000"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Balance Qty</label>
              <input
                type="text"
                name="BalanceQty"
                value={form.BalanceQty}
                onChange={handleChange}
                className="form-input"
                placeholder="25.000"
                required
              />
            </div> */}

            {/* <div className="form-group">
              <label className="form-label">Tolerance Weight</label>
              <input
                type="text"
                name="ToleranceWeight"
                value={form.ToleranceWeight}
                onChange={handleChange}
                className="form-input"
                placeholder="20.000"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Actually Weight</label>
              <input
                type="text"
                name="ActuallyWeight"
                value={form.ActuallyWeight}
                onChange={handleChange}
                className="form-input"
                placeholder="30.000"
                required
              />
            </div> */}

            {/* <div className="form-group">
              <label className="form-label">Vendor</label>
              <input
                type="text"
                name="Vendor"
                value={form.Vendor}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Vendor Name</label>
              <input
                type="text"
                name="VendorName"
                value={form.VendorName}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div> */}

            <div className="form-group">
              <label className="form-label">Inward Time (HH:mm:ss)</label>
              <input
                type="text"
                name="InwardTime"
                value={form.InwardTime}
                onChange={handleChange}
                className="form-input"
                placeholder="15:02:25"
                readOnly
                style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
                required
              />
            </div>

          </div>
        </section>

        {/* Purchase Order Details - 5 lines like CreateHeader */}
        <section className="form-section">
          <h3 className="section-title">Purchase Order Details</h3>
          {Array.from({ length: 5 }).map((_, idx) => {
            const suffix = idx === 0 ? "" : String(idx + 1);
            // Only render if within visible sections count
            if (idx >= visiblePOSections) return null;
            return (
              <div key={idx} className="po-entry-card">
                <h4 className="po-entry-title">PO Entry {idx + 1}</h4>
                <div className="grid-4-cols">
                  <div className="form-group">
                    <label className="form-label">PO Number</label>
                    <input
                      className="form-input"
                      name={`PurchaseOrderNumber${suffix}`}
                      value={form[`PurchaseOrderNumber${suffix}`]}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">PO Item</label>
                    <input
                      className="form-input"
                      name={`PurchaseOrderItem${suffix}`}
                      value={form[`PurchaseOrderItem${suffix}`]}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Material</label>
                    <input
                      className="form-input"
                      name={`Material${suffix}`}
                      value={form[`Material${suffix}`]}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Material Description</label>
                    <input
                      className="form-input"
                      name={`MaterialDescription${suffix}`}
                      value={form[`MaterialDescription${suffix}`]}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor</label>
                    <input
                      className="form-input"
                      name={`Vendor${suffix}`}
                      value={form[`Vendor${suffix}`]}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor Name</label>
                    <input
                      className="form-input"
                      name={`VendorName${suffix}`}
                      value={form[`VendorName${suffix}`]}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor Invoice No</label>
                    <input
                      className="form-input"
                      name={`VendorInvoiceNumber${suffix}`}
                      value={form[`VendorInvoiceNumber${suffix}`]}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor Invoice Date</label>
                    <input
                      type="date"
                      className="form-input"
                      name={`VendorInvoiceDate${suffix}`}
                      value={form[`VendorInvoiceDate${suffix}`]}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor Invoice Weight</label>
                    <input
                      className="form-input"
                      name={`VendorInvoiceWeight${suffix}`}
                      value={form[`VendorInvoiceWeight${suffix}`]}
                      onChange={handleChange}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Balance Quantity</label>
                    <input
                      className="form-input"
                      name={`BalanceQty${suffix}`}
                      value={form[`BalanceQty${suffix}`]}
                      onChange={handleChange}
                      placeholder="0.000"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Material Description (existing) */}
        {/* <section className="form-section">
          <div className="grid-2-cols">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Material Description</label>
              <input
                type="text"
                name="MaterialDescription"
                value={form.MaterialDescription}
                onChange={handleChange}
                className="form-input"
                style={{ width: '100%' }}
                required
              />
            </div>
          </div>
        </section> */}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Material Inward'}
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
          <strong>Success:</strong> {result.message}
            <p><strong>Gate Entry Number:</strong> {result.gateNumber}</p>
            <p><strong>Weight Doc Number:</strong> {result.weightDocNumber}</p>
            <p><strong>Date:</strong> {result.date}</p>
            <p><strong>Vehicle:</strong> {result.vehicle}</p>
        </div>
      )}
    </div>
  );
}