const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cookie = require('cookie');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const socketIo = require('socket.io');
//const apiRouter = express.Router();
const apiRouter = require('./routes/api');
const cashPurchaseRouter = require("./routes/cashpurchase");
const weightbridgeRouter = require("./routes/weightbridge");
const printerRouter = require("./routes/printer");




const app = express();
app.use(express.json({ limit: "10mb" }));

// NOTE: in dev we allow all origins. In production set specific origin.
app.use(cors({ origin: true, credentials: true }));


app.use("/api", apiRouter);
app.use('/api/cashpurchase', cashPurchaseRouter);
app.use(weightbridgeRouter);
app.use(printerRouter);

const rgpProcessRouter = require("./routes/rgpprocess");
app.use("/api/rgpprocess", rgpProcessRouter);

const nrgpProcessRouter = require("./routes/nrgpprocess");
app.use("/api/nrgpprocess", nrgpProcessRouter);



const SAP_BASE = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
const SAP_BASE_WEIGHTBRIDGE = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_CAPTURINGWEIGHTDETAILS_CDS';
const SAP_BASE_InitialRegistration = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_INITIALREGISTRATION_CDS';
const SAP_BASE_UserAccess = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_USERACCESS_CDS';
const SAP_BASE_LiveDashBoard = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_LIVEDASHBOARD_CDS'
const SAP_BASE_Transporter = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_TRANSPORTERDETAILS_CDS';
const SAP_USER = 'BTPINTEGRATION';
const SAP_PASS = 'BTPIntegration@1234567890';

const SAP_BASE_PO = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001/';
const SAP_BASE_GRN = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV';
const SAP_BASE_SO = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/API_SALES_ORDER_SRV';
const SAP_BASE_OBD ='https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV;v=0002'
const SAP_BASE_BILLING = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata4/sap/api_billingdocument/srvd_a2x/sap/billingdocument/0001/';
const SAP_BASE_BILLING_PDF = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/API_BILLING_DOCUMENT_SRV';
const SAP_BASE_PRODUCT = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata4/sap/api_product/srvd_a2x/sap/product/0002/';
const SAP_BASE_CustomerMaster = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_CUSTOMER_MASTER_CDS';
const SAP_BASE_SupplierMaster = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_VENDOR_MASTER_CDS';
const SAP_BASE_SO2 = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_RFID_SO_CDS';
const SAP_BASE_MAILIDADDRESSES = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_MAILIDADDRESSES_CDS';
const SAP_USER_ST = 'BTPINTEGRATION';
const SAP_PASS_ST = 'BTPIntegration@1234567890';


if (!SAP_BASE || !SAP_USER || !SAP_PASS) {
  console.warn('Make sure SAP_BASE, SAP_USER and SAP_PASS env vars are set');
}

const sapAxios = axios.create({
  baseURL: SAP_BASE,
  auth: { 
    username: SAP_USER, 
    password: SAP_PASS 
  }
});

const sapAxiosWeight = axios.create({
  baseURL: SAP_BASE_WEIGHTBRIDGE,
  auth: { 
    username: SAP_USER, 
    password: SAP_PASS 
  }
});



const sapAxiosInitialRegistration = axios.create({
  baseURL: SAP_BASE_InitialRegistration,
  auth: { 
    username: SAP_USER, 
    password: SAP_PASS 
  }
});
const sapAxiosUserAccess = axios.create({
  baseURL: SAP_BASE_UserAccess,
  auth: { 
    username: SAP_USER, 
    password: SAP_PASS 
  }
});

const sapAxiosLiveDashBoard = axios.create({
  baseURL: SAP_BASE_LiveDashBoard,
  auth:{
    username: SAP_USER,
    password: SAP_PASS
  }
})

const sapAxiosTransporter = axios.create({
  baseURL: SAP_BASE_Transporter,
  auth: {
    username: SAP_USER,
    password: SAP_PASS
  }
});


const sapAxiosPO = axios.create({
  baseURL: SAP_BASE_PO,
  auth: { 
    username: SAP_USER_ST, 
    password: SAP_PASS_ST 
  }
});
const sapAxiosSO = axios.create({ 
  baseURL: SAP_BASE_SO,
  auth: { 
    username: SAP_USER_ST, 
    password: SAP_PASS_ST 
  }
});
const sapAxiosOBD = axios.create({
  baseURL: SAP_BASE_OBD,
  auth: { 
    username: SAP_USER_ST, 
    password: SAP_PASS_ST 
  }
});
const sapAxiosBilling = axios.create({
  baseURL: SAP_BASE_BILLING,
  auth: { 
    username: SAP_USER_ST, 
    password: SAP_PASS_ST 
  }
});
const sapAxiosBillingPDF = axios.create({
  baseURL: SAP_BASE_BILLING_PDF,
  auth: {
    username: SAP_USER_ST,
    password: SAP_PASS_ST
  }
});

const sapAxiosProduct = axios.create({
  baseURL: SAP_BASE_PRODUCT,
  auth: {
    username: SAP_USER_ST,
    password: SAP_PASS_ST
  }
});

const sapAxiosGRN = axios.create({
  baseURL: SAP_BASE_GRN,
  auth: {
    username: SAP_USER_ST,
    password: SAP_PASS_ST
  }
});

const sapAxiosCustomerMaster = axios.create({
  baseURL: SAP_BASE_CustomerMaster,
  auth: {
    username: SAP_USER_ST,
    password: SAP_PASS_ST
  }
});

const sapAxiosSupplierMaster = axios.create({
  baseURL: SAP_BASE_SupplierMaster,
  auth: {
    username: SAP_USER_ST,
    password: SAP_PASS_ST
  }
});

const sapAxiosSOdetails = axios.create({
  baseURL: SAP_BASE_SO2,
  auth: {
    username: SAP_USER_ST,
    password: SAP_PASS_ST
  }
});

const sapAxiosMailIDAddresses = axios.create({
  baseURL: SAP_BASE_MAILIDADDRESSES,
  auth: {
    username: SAP_USER_ST,
    password: SAP_PASS_ST
  }
});

// Small hot-cache for repeated vehicle status checks during scan flow.
const vehicleStatusCache = new Map();
const VEHICLE_STATUS_CACHE_TTL_MS = 8000;

function vehicleStatusCacheKey(vehicleNumber) {
  return String(vehicleNumber || '').trim().toUpperCase();
}

/* ---------- Utility helpers ---------- */

async function fetchCsrfToken() {
  try {
    const res = await sapAxios.get('/', {
      headers: { 'x-csrf-token': 'Fetch' },
      validateStatus: () => true,
    });
    const token = res.headers['x-csrf-token'];
    const setCookie = res.headers['set-cookie'] || res.headers['Set-Cookie'] || [];
    const cookies = Array.isArray(setCookie)
      ? setCookie
          .map(c => {
            try {
              const parsed = cookie.parse(c); 
              return Object.entries(parsed).map(([k, v]) => `${k}=${v}`).join('; ');
            } catch (e) {
              return c.split(';')[0];
            }
          })
          .join('; ')
      : (setCookie || '').toString();
    return { token, cookies };
  } catch (err) {
    console.error('fetchCsrfToken error', err?.response?.status, err?.message);
    throw err;
  }
}

async function fetchCsrfTokenWeight() {
  try {
    const res = await sapAxiosWeight.get('/', {
      headers: { 'x-csrf-token': 'Fetch' },
      validateStatus: () => true,
    });
    const token = res.headers['x-csrf-token'];
    const setCookie = res.headers['set-cookie'] || res.headers['Set-Cookie'] || [];
    const cookies = Array.isArray(setCookie)
      ? setCookie
          .map(c => {
            try {
              const parsed = cookie.parse(c);
              return Object.entries(parsed).map(([k, v]) => `${k}=${v}`).join('; ');
            } catch (e) {
              return c.split(';')[0];
            }
          })
          .join('; ')
      : (setCookie || '').toString();
    return { token, cookies };
  } catch (err) {
    console.error('fetchCsrfTokenWeight error', err?.response?.status, err?.message);
    throw err;
  }
}

/**
 * Fetch CSRF token + cookies for Initial Registration OData service.
 */
async function fetchCsrfTokenInitialRegistration() {
  try {
    const res = await sapAxiosInitialRegistration.get('/', {
      headers: { 'x-csrf-token': 'Fetch' },
      validateStatus: () => true,
    });
    const token = res.headers['x-csrf-token'];
    const setCookie = res.headers['set-cookie'] || res.headers['Set-Cookie'] || [];
    const cookies = Array.isArray(setCookie)
      ? setCookie
          .map(c => {
            try {
              const parsed = cookie.parse(c);
              return Object.entries(parsed).map(([k, v]) => `${k}=${v}`).join('; ');
            } catch (e) {
              return c.split(';')[0];
            }
          })
          .join('; ')
      : (setCookie || '').toString();

    if (!token) {
      console.warn('[WARN] No CSRF token returned for Initial Registration fetch');
    }
    return { token, cookies };
  } catch (err) {
    console.error('fetchCsrfTokenInitialRegistration error', err?.response?.status, err?.message);
    throw err;
  }
}

function sanitizePayloadForSapServerSide(input) {
  const payload = JSON.parse(JSON.stringify(input || {}));

  // Client-only helper fields must never be forwarded to SAP entities.
  delete payload.SerialCode;
  delete payload.SeriesCode;

  // Normalize known alias typo used by older frontend payloads.
  if (payload.NetWeght !== undefined && payload.NetWeight === undefined) {
    payload.NetWeight = payload.NetWeght;
  }
  delete payload.NetWeght;

  // Remove undefined/null and empty strings for top-level keys
  // BUT PRESERVE WeightDocNumber (the correct SAP field name)
  Object.keys(payload).forEach(k => {
    // Skip WeightDocNumber - let SAP validate it
    if (k === 'WeightDocNumber') return;
    
    if (payload[k] === undefined || payload[k] === null) delete payload[k];
    if (typeof payload[k] === 'string' && payload[k].trim() === '') delete payload[k];
  });

  // Normalize date if only date provided
  if (payload.GateEntryDate && payload.GateEntryDate.length === 10) {
    payload.GateEntryDate = `${payload.GateEntryDate}T00:00:00`;
  }
  if (payload.GateOutDate && payload.GateOutDate.length === 10) {
    payload.GateOutDate = `${payload.GateOutDate}T00:00:00`;
  }

  // Numeric cleaning for vendor weights and balances if provided as header-level fields
  for (let i = 1; i <= 5; i++) {
    const suffix = i === 1 ? '' : String(i);
    const wKey = `VendorInvoiceWeight${suffix}`;
    const bKey = `BalanceQty${suffix}`;

    if (wKey in payload) {
      const raw = payload[wKey];
      if (raw === '' || raw === null || raw === undefined) delete payload[wKey];
      else {
        const cleaned = String(raw).replace(/,/g, '').trim();
        const normalized = cleaned.replace(',', '.');
        if (/^-?\d+(\.\d+)?$/.test(normalized)) {
          payload[wKey] = normalized;
        } else {
          delete payload[wKey];
        }
      }
    }

    if (bKey in payload) {
      const raw = payload[bKey];
      if (raw === '' || raw === null || raw === undefined) delete payload[bKey];
      else {
        const cleaned = String(raw).replace(/,/g, '').trim();
        const normalized = cleaned.replace(',', '.');
        if (/^-?\d+(\.\d+)?$/.test(normalized)) {
          payload[bKey] = normalized;
        } else {
          delete payload[bKey];
        }
      }
    }
  }

  // Clean other numeric fields (TruckCapacity, TareWeight, GrossWeight, NetWeight, etc.)
  const numericFields = [
    'TruckCapacity', 'TareWeight', 'GrossWeight', 'NetWeight', 
    'DifferenceBT', 'ToleranceWeight', 'ActuallyWeight'
  ];
  
  numericFields.forEach(field => {
    if (field in payload) {
      const raw = payload[field];
      if (raw === '' || raw === null || raw === undefined) {
        delete payload[field];
      } else {
        const cleaned = String(raw).replace(/,/g, '').trim();
        const normalized = cleaned.replace(',', '.');
        if (/^-?\d+(\.\d+)?$/.test(normalized)) {
          payload[field] = normalized;
        } else {
          delete payload[field];
        }
      }
    }
  });

  return payload;
}

/* ---------- GateEntryNumber generator helpers ---------- */

// Mutex for atomic number generation
const { Mutex } = require('async-mutex');
const gateNumberMutex = new Mutex();

// Build prefix based on Indian financial year (April-March)
function buildPrefixFromYearAndCode(dateInput, codeInput) {
  // dateInput: string (YYYY-MM-DD) or Date object
  let date = dateInput ? new Date(dateInput) : new Date();
  let year = date.getFullYear();
  let month = date.getMonth() + 1; // JS months: 0-11

  // If before April, use previous year as financial year start
  if (month < 4) year = year - 1;

  const yy = String(year).slice(-2);
  const code = String(codeInput);
  return `${yy}${code}`;
}

function computeNextGateEntryNumber(prefix, latestGateNumber) {
  const suffixLength = 7; // 3(prefix) + 7 = 10 digits
  if (!latestGateNumber) return `${prefix}${String(1).padStart(suffixLength, '0')}`;
  const suffix = latestGateNumber.slice(prefix.length);
  const next = (parseInt(suffix, 10) || 0) + 1;
  return `${prefix}${String(next).padStart(suffixLength, '0')}`;
}

function computeNextWeightDocNumber(prefix, latestWeightNumber) {
  const suffixLength = 7; // 3(prefix) + 7 = 10 digits
  if (!latestWeightNumber) return `${prefix}${String(1).padStart(suffixLength, '0')}`; // FIXED
  const suffix = latestWeightNumber.slice(prefix.length); // FIXED
  const next = (parseInt(suffix, 10) || 0) + 1;
  return `${prefix}${String(next).padStart(suffixLength, '0')}`;
}

// Fetch latest gate entry number from SAP matching the prefix
async function getLatestGateEntryNumberFromSap(prefix) {
  try {
    const filter = `startswith(GateEntryNumber,'${prefix}')`;
    const path = `/YY1_GATEINWARD_OUTWARDDETA?$filter=${filter}&$orderby=GateEntryNumber desc&$top=1&$format=json`;
    const resp = await sapAxios.get(path);
    const results = resp.data?.d?.results || [];
    return results.length > 0 ? results[0].GateEntryNumber : null;
  } catch (err) {
    console.error('getLatestGateEntryNumberFromSap error', err?.message);
    return null;
  }
}

// Fetch latest weight document number from SAP matching the prefix
async function getLatestWeightDocNumberFromSap(prefix) {
  try {
    const filter = `startswith(WeightDocNumber,'${prefix}')`;
    const path = `/YY1_CAPTURINGWEIGHTDETAILS?$filter=${filter}&$orderby=WeightDocNumber desc&$top=1&$format=json`;
    console.log('[DEBUG] Fetching latest WeightDocNumber with path:', path);
    
    const resp = await sapAxiosWeight.get(path);
    console.log('[DEBUG] Weight query response:', JSON.stringify(resp.data, null, 2));
    
    const results = resp.data?.d?.results || [];
    const latestNumber = results.length > 0 ? results[0].WeightDocNumber : null;
    console.log('[DEBUG] Latest WeightDocNumber found:', latestNumber);
    
    return latestNumber;
  } catch (err) {
    console.error('getLatestWeightDocNumberFromSap error', err?.response?.status, err?.response?.data || err?.message);
    return null;
  }
}

/* ---------- API Routes ---------- */

// Simple request logger for debugging
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.originalUrl}`);
  if (Object.keys(req.body || {}).length) console.log(' body:', JSON.stringify(req.body));
  next();
});

// GET next gate number: /api/next-gatenumber?year=2025&code=3
app.get('/api/next-gatenumber', async (req, res) => {/* Lines 413-423 omitted */});

// GET next inward gate number: /api/next-inward-gatenumber?year=2025&code=3
app.get('/api/next-inward-gatenumber', async (req, res) => {
  // This uses the same logic as /api/next-gatenumber, but can be extended for 'inward' type if needed
  try {
    const { year, code } = req.query;
    // Build prefix for inward (can be customized if needed)
    const prefix = buildPrefixFromYearAndCode(year, code);
    const latestGateNumber = await getLatestGateEntryNumberFromSap(prefix);
    const next = computeNextGateEntryNumber(prefix, latestGateNumber);
    res.json({ next });
  } catch (err) {
    console.error('Error generating next inward gate number', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to generate next inward gate number' });
  }
});
app.get('/api/next-gatenumber', async (req, res) => {
  try {
    const { year, code } = req.query;
    const prefix = buildPrefixFromYearAndCode(year, code);
    // For SC (code=2), use robust skip-used logic
    if (String(code) === '2') {
      // Helper to check if a Gate Entry Number already exists in SAP for SC
      async function checkSCGateEntryExists(gateEntryNumber) {
        const filter = `GateEntryNumber eq '${gateEntryNumber}'`;
        const path = `/YY1_GATEINWARD_OUTWARDDETA?$filter=${encodeURIComponent(filter)}&$format=json`;
        try {
          const resp = await sapAxios.get(path);
          const results = resp.data?.d?.results || [];
          return results.length > 0;
        } catch (err) {
          console.error('[ERROR] Failed to check SC Gate Entry existence:', err?.response?.data || err.message);
          return false;
        }
      }

      // Helper to get the next SC Gate Entry Number from SAP (read only)
      async function getNextSCGateEntryNumberFromSAP(prefix) {
        const filter = `startswith(GateEntryNumber,'${prefix}')`;
        const path = `/YY1_GATEINWARD_OUTWARDDETA?$filter=${encodeURIComponent(filter)}&$orderby=GateEntryNumber desc&$top=1&$format=json`;
        try {
          const resp = await sapAxios.get(path);
          const results = resp.data?.d?.results || [];
          const latest = results.length > 0 ? results[0].GateEntryNumber : null;
          if (!latest) {
            return prefix + String(1).padStart(7, '0');
          }
          const suffix = latest.slice(prefix.length);
          const next = (parseInt(suffix, 10) || 0) + 1;
          return prefix + String(next).padStart(7, '0');
        } catch (err) {
          console.error('[ERROR] Failed to fetch last SC Gate Entry Number from SAP:', err?.response?.data || err.message);
          return prefix + String(1).padStart(7, '0');
        }
      }

      // Helper to find the next available SC Gate Entry Number (that doesn't exist in SAP)
      async function findNextAvailableSCGateEntryNumber(prefix, maxAttempts = 50) {
        let candidate = await getNextSCGateEntryNumberFromSAP(prefix);
        let attempts = 0;
        while (attempts < maxAttempts) {
          const exists = await checkSCGateEntryExists(candidate);
          if (!exists) {
            return candidate;
          }
          const suffix = candidate.slice(prefix.length);
          const next = (parseInt(suffix, 10) || 0) + 1;
          candidate = prefix + String(next).padStart(7, '0');
          attempts++;
        }
        // Fallback: use timestamp
        const timestamp = Date.now().toString().slice(-6);
        const fallbackCandidate = prefix + timestamp.padStart(7, '0');
        const fallbackExists = await checkSCGateEntryExists(fallbackCandidate);
        if (!fallbackExists) {
          return fallbackCandidate;
        }
        throw new Error(`Could not find available SC Gate Entry Number after ${maxAttempts} attempts and fallback also exists`);
      }

      const next = await findNextAvailableSCGateEntryNumber(prefix);
      return res.json({ next });
    } else {
      // Default logic for other codes
      const latest = await getLatestGateEntryNumberFromSap(prefix);
      const nextNumber = computeNextGateEntryNumber(prefix, latest);
      return res.json({ next: nextNumber });
    }
  } catch (e) {
    console.error('next-gatenumber error', e?.response?.data || e.message);
    res.status(500).json({ error: e?.response?.data || e.message });
  }
});

// GET next weight number: /api/next-weightnumber?year=2025&code=1
app.get('/api/next-weightnumber', async (req, res) => {
  try {
    const { year, code } = req.query;
    const prefix = buildPrefixFromYearAndCode(year, code);
    console.log('[DEBUG] Generating next weight number for prefix:', prefix);
    
    const latest = await getLatestWeightDocNumberFromSap(prefix);
    const nextNumber = computeNextWeightDocNumber(prefix, latest);
    
    console.log('[DEBUG] Next WeightDocNumber:', nextNumber);
    return res.json({ next: nextNumber });
  } catch (e) {
    console.error('next-weightnumber error', e?.response?.data || e.message);
    res.status(500).json({ error: e?.response?.data || e.message });
  }
});


app.get('/api/transporterdetails', async (req, res) => {
  const search = (req.query.search || '').trim();
  if (!search) {
    return res.status(400).json({ error: 'Missing search parameter' });
  }
  try {
    // Use substringof for partial search
    const filter = `substringof('${search.replace(/'/g, "''")}',Transporter)`;
    const path = `/YY1_TRANSPORTERDETAILS?$filter=${filter}&$format=json`;
    const resp = await sapAxiosTransporter.get(path);
    const results = resp.data?.d?.results || [];
    if (!results.length) {
      return res.json({ results: [] });
    }
    // Map only required fields for frontend
    const mapped = results.map(t => ({
      TransporterCode: t.TransporterCode,
      TransporterName: t.Transporter,
      Email: t.Email,
      Email2: t.Email2,
      TaxNumber3: t.TaxNumber3,
      Remarks: t.SAP_Description,
      Remarks2: t.Remarks2
    }));
    res.json({ results: mapped });
  } catch (err) {
    console.error('Transporter fetch error', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch transporter details' });
  }
});

/* GET headers with query forwarding */
app.get('/api/headers', async (req, res) => {
  try {
    const rawQuery = (req.originalUrl || '').split('?')[1] || '';
    const sapPath = rawQuery ? `/YY1_GATEINWARD_OUTWARDDETA?${rawQuery}` : '/YY1_GATEINWARD_OUTWARDDETA?$top=50&$format=json';
    console.log('[API] forwarding to SAP ->', sapPath);
    const resp = await sapAxios.get(sapPath);
    res.json(resp.data);
  } catch (err) {
    console.error('Error fetching gate entry:', err?.response?.status, err?.response?.data || err?.message);
    res.status(500).json({ error: err?.response?.data || err?.message || 'Failed to fetch gate entry details' });
  }
});

/* GET header by GUID */
app.get('/api/headers/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const resp = await sapAxios.get(`/YY1_GATEINWARD_OUTWARDDETA(guid'${id}')?$format=json`);
    res.json(resp.data);
  } catch (err) {
    console.error(err?.response?.status, err?.response?.data || err.message);
    res.status(err?.response?.status || 500).json({ error: err?.response?.data || err?.message });
  }
});

// GET all transporters (code + name)
app.get('/api/transporters', async (req, res) => {
  try {
    const path = '/YY1_TRANSPORTERDETAILS?$format=json';
    const resp = await sapAxiosTransporter.get(path);
    const results = resp.data?.d?.results || [];
    const mapped = results.map(t => ({
      TransporterCode: t.TransporterCode,
      TransporterName: t.Transporter,
      Email: t.Email,
      Email2: t.Email2,
      TaxNumber3: t.TaxNumber3,
      Remarks: t.SAP_Description,
      Remarks2: t.Remarks2
    }));
    res.json({ results: mapped });
  } catch (err) {
    console.error('Error fetching all transporters', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch transporters' });
  }
});

// // Get PO+Material remaining (balance) quantity from gate entry (multi-line)
// app.get('/api/po-material-balance', async (req, res) => {
//   const { poNumber, material } = req.query;
//   if (!poNumber || !material) {
//     return res.status(400).json({ error: 'poNumber and material are required' });
//   }
//   try {
//     // 1. Fetch total ordered qty for this PO/material from SAP PO API (OData v4)
//     let orderedQty = 0;
//     try {
//       // Use correct OData v4 entity: /PurchaseOrderItem?$filter=PurchaseOrder eq '...' and Material eq '...'
//       const poPath = `/PurchaseOrderItem?$filter=PurchaseOrder eq '${poNumber}' and Material eq '${material}'`;
//       const poResp = await sapAxiosPO.get(poPath);
//       const poItems = poResp.data?.value || poResp.data?.d?.results || [];
//       console.log(`[DEBUG] PO items for ${poNumber} & ${material}:`, poItems);
//       orderedQty = poItems.reduce((sum, item) => sum + Number(item.OrderQuantity || 0), 0);
//     } catch (poErr) {
//       console.error('Error fetching PO ordered qty:', poErr?.response?.data || poErr.message);
//       // If PO fetch fails, orderedQty stays 0
//     }

//     // 2. Sum received qty from gate entry (as before)
//     const filter = [
//       `PurchaseOrderNumber eq '${poNumber}'`,
//       `PurchaseOrderNumber2 eq '${poNumber}'`,
//       `PurchaseOrderNumber3 eq '${poNumber}'`,
//       `PurchaseOrderNumber4 eq '${poNumber}'`,
//       `PurchaseOrderNumber5 eq '${poNumber}'`
//     ].join(' or ');
//     const matFilter = [
//       `Material eq '${material}'`,
//       `Material2 eq '${material}'`,
//       `Material3 eq '${material}'`,
//       `Material4 eq '${material}'`,
//       `Material5 eq '${material}'`
//     ].join(' or ');
//     const gatePath = `/YY1_GATEINWARD_OUTWARDDETA?$filter=(${filter}) and (${matFilter})&$format=json`;
//     console.log('[DEBUG] Fetching gate entries with filter:', filter + ' and ' + matFilter);
//     const gateResponse = await sapAxios.get(gatePath);
//     const gateEntries = gateResponse.data?.d?.results || gateResponse.data?.value || [];
//   //  console.log(`[DEBUG] Matching gate entries for PO ${poNumber} & Material ${material}:`, gateEntries);

//     // Normalize and trim PO and Material for comparison
//     const norm = v => (v == null ? '' : String(v).replace(/^0+/, '').trim());
//     const normPo = norm(poNumber);
//     const normMat = norm(material);
//     let receivedQty = 0;
//     gateEntries.forEach(ge => {
//       const poFields = [ge.PurchaseOrderNumber, ge.PurchaseOrderNumber2, ge.PurchaseOrderNumber3, ge.PurchaseOrderNumber4, ge.PurchaseOrderNumber5].map(norm);
//       const matFields = [ge.Material, ge.Material2, ge.Material3, ge.Material4, ge.Material5].map(norm);
//       const balFields = [ge.VendorInvoiceWeight, ge.VendorInvoiceWeight2, ge.VendorInvoiceWeight3, ge.VendorInvoiceWeight4, ge.VendorInvoiceWeight5].map(Number);

//       for (let i = 0; i < 5; i++) {
//         for (let j = 0; j < 5; j++) {
//           if (poFields[i] === normPo && matFields[j] === normMat) {
//             receivedQty += balFields[j] || 0;
//             console.log(`[DEBUG] Matched PO ${poFields[i]} & Material ${matFields[j]} with BalanceQty ${balFields[j]} in Gate Entry ${ge.GateEntryNumber}`);
//           }
//         }
//       }
//     });
// //console.log(`[DEBUG] Total ordered qty: ${orderedQty}, Total received qty: ${receivedQty} for PO ${poNumber} & Material ${material}`);
//     // 3. Calculate remaining
//     const remainingQty = orderedQty - receivedQty;

//     res.json({
//       poNumber,
//       material,
//       orderedQty,
//       receivedQty,
//       remainingQty
//     });
//   } catch (err) {
//     console.error('Error fetching PO+Material balance:', err?.response?.data || err.message);
//     res.status(500).json({ error: 'Failed to fetch PO+Material balance' });
//   }
// });

/* GET header Vehicle status IN means need to error */
app.get('/api/headers/vehiclestatus/:VehicleNumber', async (req, res) => {
  const VehicleNumber = String(req.params.VehicleNumber || '').trim();
  if (!VehicleNumber) {
    return res.status(400).json({ error: 'VehicleNumber is required' });
  }

  const cacheKey = vehicleStatusCacheKey(VehicleNumber);
  const now = Date.now();
  const cached = vehicleStatusCache.get(cacheKey);
  if (cached && now - cached.ts < VEHICLE_STATUS_CACHE_TTL_MS) {
    return res.json(cached.payload);
  }

  try {
    const escapedVehicle = VehicleNumber.replace(/'/g, "''");
    const select = 'GateEntryNumber,VehicleNumber,VehicleStatus,GateEntryDate,SAP_CreatedDateTime,SAP_LastChangedDateTime';
    const filter = `VehicleNumber eq '${escapedVehicle}'`;
    const path = `/YY1_GATEINWARD_OUTWARDDETA?$filter=${filter}&$select=${select}&$orderby=SAP_LastChangedDateTime desc,GateEntryDate desc,GateEntryNumber desc&$top=20&$format=json`;

    const resp = await sapAxios.get(path, { timeout: 2000 });
    const results = resp?.data?.d?.results || resp?.data?.value || [];
    const payload = { d: { results } };

    vehicleStatusCache.set(cacheKey, { ts: now, payload });
    res.json(payload);
  } catch (err) {
    // Fallback to stale cache for resilience when SAP is briefly slow.
    const stale = vehicleStatusCache.get(cacheKey);
    if (stale) {
      return res.json(stale.payload);
    }
    console.error(err?.response?.status, err?.response?.data || err.message);
    res.status(err?.response?.status || 500).json({ error: err?.response?.data || err?.message });
  }
});

// Get PO + Material remaining quantity
app.get('/api/po-material-balance', async (req, res) => {
  const { poNumber, material } = req.query;

  if (!poNumber || !material) {
    return res.status(400).json({
      error: 'poNumber and material are required'
    });
  }

  try {
    /***********************
     * 1️⃣ Fetch PO Ordered Qty
     ***********************/
    let orderedQty = 0;

    try {
      const poPath =
        `/PurchaseOrderItem?$filter=PurchaseOrder eq '${poNumber}' and Material eq '${material}'`;

      const poResp = await sapAxiosPO.get(poPath);
      const poItems = poResp.data?.value || [];

      console.log(
        `[DEBUG] PO items for ${poNumber} & ${material}:`,
        poItems
      );

      orderedQty = poItems.reduce(
        (sum, item) => sum + Number(item.OrderQuantity || 0),
        0
      );
    } catch (poErr) {
      console.error(
        'Error fetching PO ordered qty:',
        poErr?.response?.data || poErr.message
      );
    }

    /***********************
     * 2️⃣ Fetch Gate Entries
     ***********************/
    const poFilter = [
      `PurchaseOrderNumber eq '${poNumber}'`,
      `PurchaseOrderNumber2 eq '${poNumber}'`,
      `PurchaseOrderNumber3 eq '${poNumber}'`,
      `PurchaseOrderNumber4 eq '${poNumber}'`,
      `PurchaseOrderNumber5 eq '${poNumber}'`
    ].join(' or ');

    const matFilter = [
      `Material eq '${material}'`,
      `Material2 eq '${material}'`,
      `Material3 eq '${material}'`,
      `Material4 eq '${material}'`,
      `Material5 eq '${material}'`
    ].join(' or ');

    const gatePath =
      `/YY1_GATEINWARD_OUTWARDDETA?$filter=(${poFilter}) and (${matFilter})&$format=json`;

    console.log('[DEBUG] Gate filter:', gatePath);

    const gateResp = await sapAxios.get(gatePath);
    const gateEntries =
      gateResp.data?.d?.results || gateResp.data?.value || [];

    /***********************
     * 3️⃣ Calculate Received Qty (FIXED)
     ***********************/
    const normalize = v =>
      v == null ? '' : String(v).replace(/^0+/, '').trim();

    const normPo = normalize(poNumber);
    const normMat = normalize(material);

    let receivedQty = 0;

    gateEntries.forEach(ge => {
      const poFields = [
        ge.PurchaseOrderNumber,
        ge.PurchaseOrderNumber2,
        ge.PurchaseOrderNumber3,
        ge.PurchaseOrderNumber4,
        ge.PurchaseOrderNumber5
      ].map(normalize);

      const matFields = [
        ge.Material,
        ge.Material2,
        ge.Material3,
        ge.Material4,
        ge.Material5
      ].map(normalize);

      // 👇 Quantity field used (change if needed)
      const qtyFields = [
        ge.VendorInvoiceWeight,
        ge.VendorInvoiceWeight2,
        ge.VendorInvoiceWeight3,
        ge.VendorInvoiceWeight4,
        ge.VendorInvoiceWeight5
      ].map(Number);

      // ✅ SINGLE LOOP (no duplicate counting)
      for (let i = 0; i < 5; i++) {
        if (poFields[i] === normPo && matFields[i] === normMat) {
          const qty = qtyFields[i] || 0;
          receivedQty += qty;

          console.log(
            `[DEBUG] Gate ${ge.GateEntryNumber} → PO ${poFields[i]}, Material ${matFields[i]}, Qty ${qty}`
          );
        }
      }
    });

    /***********************
     * 4️⃣ Remaining Qty
     ***********************/
    const remainingQty = Math.max(orderedQty - receivedQty, 0);

    /***********************
     * 5️⃣ Response
     ***********************/
    res.json({
      poNumber,
      material,
      orderedQty,
      receivedQty,
      remainingQty
    });
  } catch (err) {
    console.error(
      'Error fetching PO+Material balance:',
      err?.response?.data || err.message
    );

    res.status(500).json({
      error: 'Failed to fetch PO+Material balance'
    });
  }
});

/* GET header Vehicle status IN means need to error */
app.get('/api/headers/poremainingqty/:PurchaseOrder', async (req, res) => {
  const PurchaseOrder = req.params.PurchaseOrder;
  try {
    // Do NOT encode here, frontend already encodes the filter
    const filter = `PurchaseOrder eq '${PurchaseOrder}'`;
    const resp = await sapAxios.get(`/YY1_GATEINWARD_OUTWARDDETA?$filter=${filter}&$format=json`);
    res.json(resp.data);
  } catch (err) {
    console.error(err?.response?.status, err?.response?.data || err.message);
    res.status(err?.response?.status || 500).json({ error: err?.response?.data || err?.message });
  }
});
/* GET items for a header */
app.get('/api/headers/:id/items', async (req, res) => {
  const id = req.params.id;
  try {
    const path = `/YY1_GATEINWARD_OUTWARDDETA(guid'${id}')/to_GateEntryItems?$format=json`;
    const resp = await sapAxios.get(path);
    res.json(resp.data);
  } catch (err) {
    console.error(err?.response?.status, err?.response?.data || err.message);
    res.status(err?.response?.status || 500).json({ error: err?.response?.data || err?.message });
  }
});

 
function formatSapODataDate(date) {
  if (!date) return null;

  // If already SAP format → return as is
  if (typeof date === "string" && date.startsWith("/Date(")) {
    return date;
  }

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
const now = new Date();
const systemdate = now.toISOString().split("T")[0];
const systemtime = now.toTimeString().split(" ")[0];
// POST new header (deep insert with items) - Gate Entry
app.post('/api/headers', async (req, res) => {
  // Only one request at a time can generate and assign a GateEntryNumber
  await gateNumberMutex.runExclusive(async () => {
    try {
      const input = sanitizePayloadForSapServerSide(req.body);

if (req.body.Indicators === "I") {
 

const now = new Date();

const systemdate = now.toISOString().split("T")[0];
const systemtime = now.toTimeString().split(" ")[0];

// 🔹 Step 1: Collect POs
const poNumbers = [
  req.body.PurchaseOrderNumber,
  req.body.PurchaseOrderNumber2,
  req.body.PurchaseOrderNumber3,
  req.body.PurchaseOrderNumber4,
  req.body.PurchaseOrderNumber5
].filter(Boolean);

// 🔹 Step 2: Fetch all PO data
let allPOItems = [];

for (const po of poNumbers) {
  try {
const url = `https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_RFIDPO_CDS/YY1_RFIDPO?$filter=PurchaseOrder eq '${po}'&$format=json`;

    const resp = await sapAxios.get(url, {
      auth: {
        username: SAP_USER,
        password: SAP_PASS
      }
    });

    const results = resp.data?.d?.results || [];

    if (results.length > 0) {
      allPOItems.push(results[0]); // keep your logic
    }

  } catch (err) {
    console.error("PO fetch error:", po, err.message);
  }
}

console.log("All PO Items:", allPOItems);

// 🔹 Step 3: Assign fields
allPOItems.forEach((poItem, index) => {

  const suffix = index === 0 ? "" : (index + 1);

  input[`PurchaseOrderItem${suffix}`] = input[`PurchaseOrderItem${suffix}`] || poItem.PurchaseOrderItem;

  input[`Material${suffix}`] = input[`Material${suffix}`] || poItem.Material;

  input[`MaterialDescription${suffix}`] = input[`MaterialDescription${suffix}`] || poItem.ProductDescription;

  input[`Vendor${suffix}`] = input[`Vendor${suffix}`] || poItem.Supplier;

  input[`VendorName${suffix}`] = input[`VendorName${suffix}`] || poItem.SupplierName_1;

  // 👉 Only first PO
  if (index === 0) {

    input.UOM = input.UOM || poItem.PurchaseOrderQuantityUnit;

    input.Status = input.Status || "Success";

    input.VehicleStatus = input.VehicleStatus || "IN";

    input.InwardTime = input.InwardTime || formatSapTime(systemtime);

    input.GateEntryDate = input.GateEntryDate || formatSapODataDate(systemdate);
  }

});


    if (!req.body.VendorInvoiceNumber && req.body.PurchaseOrderNumber) {
      {
      return res.status(400).json({ success: false, error: 'Vendor Invoice Number is mandatory' });
       }
      }
      if (!req.body.VendorInvoiceNumber2 && req.body.PurchaseOrderNumber2) {
      {
      return res.status(400).json({ success: false, error: 'Vendor Invoice Number2 is mandatory' });
       }
      }
      if (!req.body.VendorInvoiceNumber3 && req.body.PurchaseOrderNumber3) {
      {
      return res.status(400).json({ success: false, error: 'Vendor Invoice Number3 is mandatory' });
       }
      }
      if (!req.body.VendorInvoiceNumber4 && req.body.PurchaseOrderNumber4) {
      {
      return res.status(400).json({ success: false, error: 'Vendor Invoice Number4 is mandatory' });
       }
      }
      if (!req.body.VendorInvoiceNumber5 && req.body.PurchaseOrderNumber5) {
      {
      return res.status(400).json({ success: false, error: 'Vendor Invoice Number5 is mandatory' });
       }
      }
      if (!req.body.VendorInvoiceDate && req.body.PurchaseOrderNumber) {
      {
      return res.status(400).json({ success: false, error: 'Vendor Invoice Date is Mandatory.' });
       }
      }
        if (!req.body.VendorInvoiceDate2 && req.body.PurchaseOrderNumber2) {
      {
      return res.status(400).json({ success: false, error: 'Vendor Invoice Date2 is Mandatory.' });
       }
      }
        if (!req.body.VendorInvoiceDate3 && req.body.PurchaseOrderNumber3) {
      {
      return res.status(400).json({ success: false, error: 'Vendor Invoice Date3 is Mandatory.' });
       }
      }
        if (!req.body.VendorInvoiceDate4 && req.body.PurchaseOrderNumber4) {
      {
      return res.status(400).json({ success: false, error: 'Vendor Invoice Date4 is Mandatory.' });
       }
      }
        if (!req.body.VendorInvoiceDate5 && req.body.PurchaseOrderNumber5) {
      {
      return res.status(400).json({ success: false, error: 'Vendor Invoice Date5 is Mandatory.' });
       }
      }
      if (!req.body.VendorInvoiceWeight && req.body.PurchaseOrderNumber) {
      {
      return res.status(400).json({ success: false, error: 'Vendor Invoice Weight is mandatory' });
      }
    }   if (!req.body.VendorInvoiceWeight2 && req.body.PurchaseOrderNumber2) {
      {
      return res.status(400).json({ success: false, error: 'Vendor Invoice Weight2 is mandatory' });
      }
    }   if (!req.body.VendorInvoiceWeight3 && req.body.PurchaseOrderNumber3) {
      {
      return res.status(400).json({ success: false, error: 'Vendor Invoice Weight3 is mandatory' });
      }
    }
    if (!req.body.VendorInvoiceWeight4 && req.body.PurchaseOrderNumber4) {
      {
      return res.status(400).json({ success: false, error: 'Vendor Invoice Weight4 is mandatory' });
      }
    }
    if (!req.body.VendorInvoiceWeight5 && req.body.PurchaseOrderNumber5) {
      {
      return res.status(400).json({ success: false, error: 'Vendor Invoice Weight5 is mandatory' });
      }
    }
    if (!req.body.BalanceQty && req.body.PurchaseOrderNumber) {
      {
        return res.status(400).json({ success: false, error: 'Balance Quantity is mandatory' });
      }
    }
    if (!req.body.BalanceQty2 && req.body.PurchaseOrderNumber2) {
      {
        return res.status(400).json({ success: false, error: 'Balance Quantity2 is mandatory' });
      }
    }
    if (!req.body.BalanceQty3 && req.body.PurchaseOrderNumber3) {
      {
        return res.status(400).json({ success: false, error: 'Balance Quantity3 is mandatory' });
      }
    }
    if (!req.body.BalanceQty4 && req.body.PurchaseOrderNumber4) {
      {
        return res.status(400).json({ success: false, error: 'Balance Quantity4 is mandatory' });
      }
    }
    if (!req.body.BalanceQty5 && req.body.PurchaseOrderNumber5) {
      {
        return res.status(400).json({ success: false, error: 'Balance Quantity5 is mandatory' });
      }
    }
}
    if (req.body.Indicators === "O") {
      
        const sodetails = "https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_RFID_SO_CDS/YY1_RFID_SO?$filter=SalesDocument eq '"
  + req.body.SalesDocument + "'&$format=json";
 
const sodetailsresp = await sapAxios.get(sodetails, {
  auth: {
    username: SAP_USER,
    password: SAP_PASS
  }
});
 
const sodetailsresults = sodetailsresp.data?.d?.results || [];
 
console.log('SO details for SalesDocument', req.body.SalesDocument, sodetailsresults);
 
if (sodetailsresults.length > 0) {
 
  const soItem = sodetailsresults[0]; // take first item or loop if needed
 console.log('SO Item for GateEntry Creation:', soItem);
  if (!input.UOM) {
    input.UOM = soItem.OrderQuantityUnit;
  }
  if (!input.PurchaseOrderItem) {
    input.PurchaseOrderItem = soItem.SalesDocumentItem;
  }
  if (!input.Material) {
    input.Material = soItem.Product;
   }
   if (!input.MaterialDescription) {
    input.MaterialDescription = soItem.ProductDescription;
  }
  if (!input.Customer){
    input.Customer = soItem.Customer;
  }
  if (!input.CustomerName){
    input.CustomerName = soItem.CustomerName;
  }
  if(!input.InwardTime)
  {
    input.InwardTime = formatSapTime(systemtime);
  }
  if(!input.GateEntryDate)
  {
    input.GateEntryDate = formatSapODataDate(systemdate);
  }
  if(!input.Status)
  {    input.Status = "Success";}
  if (!input.VehicleStatus)
  { input.VehicleStatus = "IN"; }


}
      if (!req.body.SalesDocument) {
        return res.status(400).json({ success: false, error: 'SalesDocument is mandatory for Outward entries' });
      }
      if (!req.body.VehicleNumber) {  
        return res.status(400).json({ success: false, error: 'Vehicle Number is mandatory for Outward entries' });
      }
      if (!req.body.TransporterCode) {  
        return res.status(400).json({ success: false, error: 'Transporter Code is mandatory for Outward entries' });
      }
      if (!req.body.LRGCNumber){
        return res.status(400).json({ success: false, error: 'LRGC Number is mandatory for Outward entries' });
      }
    }   

      // Generate GateEntryNumber if not present
      if (!input.GateEntryNumber) {
        // You may want to get year/code from input or use defaults
        const year = input.GateEntryDate ? String(input.GateEntryDate).slice(0, 4) : (new Date()).getFullYear();
        let code = input.SeriesCode;
        // Fallback: use Indicators to determine default code
        if (!code) {
          if (input.Indicators === "O") code = "1"; // Outward (SD)
          else if (input.Indicators === "I") code = "2"; // Inward (MM)
          else code = "1"; // Default to SD
        }
        const prefix = buildPrefixFromYearAndCode(year, code);
        const latest = await getLatestGateEntryNumberFromSap(prefix);
        input.GateEntryNumber = computeNextGateEntryNumber(prefix, latest);
      }
      // Remove SeriesCode before sending to SAP (not a valid property)
      if (input.SeriesCode !== undefined) {
        delete input.SeriesCode;
      }

      const { token, cookies } = await fetchCsrfToken();
      const resp = await sapAxios.post('/YY1_GATEINWARD_OUTWARDDETA', input, {
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
          Cookie: cookies,
        },
      });
      res.status(resp.status).json(resp.data);
    } catch (err) {
      console.error('POST header error', err?.response?.status,
    err?.response?.data || err?.message
  );
 
  const sapMessage =
    err?.response?.data?.error?.message?.value ||
    err?.response?.data?.error?.message ||
    err?.message;
 
  res.status(err?.response?.status || 500).json({
    success: false,
    message: sapMessage
  });
}
  });
});

const SAP_URL2 ="https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_CAPTURINGWEIGHTDETAILS_CDS/YY1_CAPTURINGWEIGHTDETAILS";
const SAP_USER2 = "BTPINTEGRATION";
const SAP_PASS2 = "BTPIntegration@1234567890";

  // /* POST Material Inward - Weight Bridge */
  // app.post('/api/headers/material/in', async (req, res) => {
  //   try {
  //     const input = sanitizePayloadForSapServerSide(req.body);

  //     // GrossWeight may come from manual entry or from the Get Gross button.
  //     if (req.body.GrossWeight !== undefined && req.body.GrossWeight !== null) {
  //       input.GrossWeight = String(req.body.GrossWeight).trim();
  //     }

  //     const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';
  //     const firstNonBlank = (...values) => values.find((value) => !isBlank(value));

  //     // Keep both weight fields aligned so GrossWeight persists reliably for QR flows.
  //     const fallbackWeight = firstNonBlank(
  //       input.GrossWeight,
  //       input.VendorInvoiceWeight,
  //       input.VendorInvoiceWeight2,
  //       input.VendorInvoiceWeight3,
  //       input.VendorInvoiceWeight4,
  //       input.VendorInvoiceWeight5
  //     );

  //     if (!isBlank(fallbackWeight)) {
  //       if (isBlank(input.GrossWeight)) input.GrossWeight = String(fallbackWeight);
  //       if (isBlank(input.VendorInvoiceWeight)) input.VendorInvoiceWeight = String(input.GrossWeight);
  //     }

  //     if (isBlank(input.GrossWeight) || Number(input.GrossWeight) <= 0) {
  //       return res.status(400).json({ success: false, error: 'Gross Weight is mandatory and must be greater than 0' });
  //     }
      

  //     // Generate WeightDocNumber if not provided
  //     if (!input.WeightDocNumber) {
  //       // Use current year and code=4 (for inward, as per your fetchNextWeightDocNumber usage)
  //       const year = input.FiscalYear || new Date().getFullYear().toString();
  //       const code = 4; // 251 series for Inward
  //       const prefix = buildPrefixFromYearAndCode(year, code);
  //       const latest = await getLatestWeightDocNumberFromSap(prefix);
  //       input.WeightDocNumber = computeNextWeightDocNumber(prefix, latest);
  //       console.log('[INFO] Auto-generated WeightDocNumber:', input.WeightDocNumber);
  //     }

  //     const { token, cookies } = await fetchCsrfTokenWeight();

  //     console.log('[DEBUG] Sanitized payload for Material Inward:', JSON.stringify(input, null, 2));

  //     const resp = await sapAxiosWeight.post('/YY1_CAPTURINGWEIGHTDETAILS', input, {
  //       headers: {
  //         'Content-Type': 'application/json',
  //         'x-csrf-token': token,
  //         Cookie: cookies,
  //       },
  //     });

  //     // Keep the linked gate-entry record aligned with the stored inward gross weight.
  //     if (input.GateEntryNumber && input.GrossWeight) {
  //       try {
  //         const headerLookupResp = await sapAxios.get(
  //           `/YY1_GATEINWARD_OUTWARDDETA?$filter=GateEntryNumber eq '${input.GateEntryNumber}'&$format=json`
  //         );
  //         const headerResults = headerLookupResp.data?.d?.results || headerLookupResp.data?.value || [];

  //         if (headerResults.length > 0) {
  //           const headerUuid =
  //             headerResults[0].SAP_UUID ||
  //             headerResults[0].UUID ||
  //             headerResults[0].Guid ||
  //             headerResults[0].GUID;

  //           if (headerUuid) {
  //             const { token: headerToken, cookies: headerCookies } = await fetchCsrfToken();
  //             await sapAxios.patch(
  //               `/YY1_GATEINWARD_OUTWARDDETA(guid'${headerUuid}')`,
  //               {
  //                 GrossWeight: String(input.GrossWeight),
  //               },
  //               {
  //                 headers: {
  //                   'Content-Type': 'application/json',
  //                   'x-csrf-token': headerToken,
  //                   Cookie: headerCookies,
  //                 },
  //                 validateStatus: (status) => status < 500,
  //               }
  //             );
  //           }
  //         }
  //       } catch (headerPatchErr) {
  //         console.error(
  //           '[WARN] Material inward created, but linked gate entry GrossWeight patch failed',
  //           headerPatchErr?.response?.status,
  //           headerPatchErr?.response?.data || headerPatchErr?.message
  //         );
  //       }
  //     }

  //   //  res.status(resp.status).json(resp.data);

  // // Example if SAP OData returns { d: { WeightDocNumber, GateEntryNumber } }
  // res.status(resp.status).json({ success: true, data: { 
  //   WeightDocNumber: resp.data.d?.WeightDocNumber,
  //   GateEntryNumber: resp.data.d?.GateEntryNumber, 
  // }});
  //   } catch (err) {
  //   console.error('POST Material Inward error',
  //     err?.response?.status,
  //     err?.response?.data || err?.message
  //   );
  
  //   const sapMessage =
  //     err?.response?.data?.error?.message?.value ||
  //     err?.response?.data?.error?.message ||
  //     err?.message;
  
  //   res.status(err?.response?.status || 500).json({
  //     success: false,
  //     message: sapMessage
  //   });
  // }
  // });

/* POST Material Inward - Weight Bridge */
app.post('/api/headers/material/in', async (req, res) => {
  try {

    const input = sanitizePayloadForSapServerSide(req.body);

    const now = new Date();
    const systemdate = now.toISOString().split("T")[0];
    const systemtime = now.toTimeString().split(" ")[0];

    const isBlank = (v) =>
      v === undefined || v === null || String(v).trim() === '';

    // ==========================
    // 1️⃣ FETCH GATE ENTRY DATA FIRST
    // ==========================
    let header = null;

      // ==========================
    // 2️⃣ CHECK EXISTING WEIGHMENT
    // ==========================
    let existing = null;

    if (input.GateEntryNumber) {
      const checkResp = await sapAxiosWeight.get(
        `/YY1_CAPTURINGWEIGHTDETAILS?$filter=GateEntryNumber eq '${input.GateEntryNumber}' & Status eq 'Success' &$format=json`
      );

      const results = checkResp.data?.d?.results || [];

      if (results.length > 0) {
        existing = results[0];
      }
    }

    // 👉 Block duplicate
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Weighment already exists for this Gate Entry"
      });
    }


    if (input.GateEntryNumber) {
      const headerResp = await sapAxios.get(
        `/YY1_GATEINWARD_OUTWARDDETA?$filter=GateEntryNumber eq '${input.GateEntryNumber}'&$format=json`
      );

      header = headerResp.data?.d?.results?.[0];

      if (!header) {
        return res.status(404).json({
          success: false,
          message: "Gate Entry not found"
        });
      }
    }

    // ==========================
    // 2️⃣ MERGE GATE ENTRY → WEIGHMENT
    // ==========================
    if (header) {

      input.Material = header.Material;
      input.Material2 = header.Material2;
      input.Material3 = header.Material3;
      input.Material4 = header.Material4;
      input.Material5 = header.Material5;

      input.MaterialDescription = header.MaterialDescription;
      input.MaterialDescription2 = header.MaterialDescription2;
      input.MaterialDescription3 = header.MaterialDescription3; 
      input.MaterialDescription4 = header.MaterialDescription4;
      input.MaterialDescription5 = header.MaterialDescription5;

      input.Vendor = header.Vendor;
      input.Vendor2 = header.Vendor2;
      input.Vendor3 = header.Vendor3;
      input.Vendor4 = header.Vendor4;
      input.Vendor5 = header.Vendor5;

      input.VendorName = header.VendorName;
      input.VendorName2 = header.VendorName2;
      input.VendorName3 = header.VendorName3;
      input.VendorName4 = header.VendorName4;
      input.VendorName5 = header.VendorName5;

      input.PurchaseOrderNumber = header.PurchaseOrderNumber;
      input.PurchaseOrderItem = header.PurchaseOrderItem;
      input.PurchaseOrderNumber2 = header.PurchaseOrderNumber2;
      input.PurchaseOrderItem2 = header.PurchaseOrderItem2;
      input.PurchaseOrderNumber3 = header.PurchaseOrderNumber3;
      input.PurchaseOrderItem3 = header.PurchaseOrderItem3;
      input.PurchaseOrderNumber4 = header.PurchaseOrderNumber4;
      input.PurchaseOrderItem4 = header.PurchaseOrderItem4;
      input.PurchaseOrderNumber5 = header.PurchaseOrderNumber5;
      input.PurchaseOrderItem5 = header.PurchaseOrderItem5;
    }

    // ==========================
    // 3️⃣ DEFAULT VALUES
    // ==========================
    input.VehicleStatus = "IN";
    input.InwardTime = formatSapTime(systemtime);
    input.GateEntryDate = formatSapODataDate(systemdate);
    input.Status = "Success";

    if (req.body.GrossWeight) {
      input.GrossWeight = String(req.body.GrossWeight);
    }

    if (isBlank(input.GrossWeight) || Number(input.GrossWeight) <= 0) {
      return res.status(400).json({
        success: false,
        error: "Gross Weight required"
      });
    }

    // ==========================
    // 4️⃣ GENERATE DOC NUMBER
    // ==========================
    if (!input.WeightDocNumber) {
      const year = new Date().getFullYear().toString();
      const prefix = buildPrefixFromYearAndCode(year, 4);
      const latest = await getLatestWeightDocNumberFromSap(prefix);
      input.WeightDocNumber = computeNextWeightDocNumber(prefix, latest);
    }

    const { token, cookies } = await fetchCsrfTokenWeight();

    console.log("FINAL PAYLOAD:", input);

    // ==========================
    // 5️⃣ CREATE WEIGHMENT ONLY ONCE
    // ==========================
    const resp = await sapAxiosWeight.post(
      '/YY1_CAPTURINGWEIGHTDETAILS',
      input,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
          Cookie: cookies,
        }
      }
    );

    console.log("✅ Weighment Created Successfully");

    // ==========================
    // RESPONSE
    // ==========================
    res.status(resp.status).json({
      success: true,
      data: {
        WeightDocNumber: resp.data.d?.WeightDocNumber,
        GateEntryNumber: resp.data.d?.GateEntryNumber
      }
    });

  } catch (err) {

    console.error("❌ ERROR", err?.response?.data || err.message);

    res.status(500).json({
      success: false,
      message:
        err?.response?.data?.error?.message?.value ||
        err?.message
    });
  }
});


// Example: PATCH /api/headers/material/:docNumber
app.patch('/api/headers/weighmentupdate/:gentry', async (req, res) => {
  const docNumber = req.params.gentry;
  const updateFields = sanitizePayloadForSapServerSide(req.body);
  try {
    // 1. Fetch the record by GateEntryNumber to get the UUID
    const now = new Date();
    const systemdate = now.toISOString().split("T")[0];
    const systemtime = now.toTimeString().split(" ")[0];
    updateFields.VehicleStatus = "OUT"; 
    updateFields.OutwardTime = formatSapTime(systemtime);
    updateFields.GateOutDate = formatSapODataDate(systemdate);


    const getResp = await sapAxiosWeight.get(`/YY1_CAPTURINGWEIGHTDETAILS?$filter=GateEntryNumber eq '${docNumber}'&$format=json`);
    const results = getResp.data?.d?.results || [];

   // console.log('Existing weighment record for update:', results);

     const record = results[0];

    if (record && record.VehicleStatus === 'OUT' && record.Status === 'Success') {
     return res.status(400).json({
     error: 'Vehicle already Weighment OUT'
      });
      }
    if (!results.length) return res.status(404).json({ error: 'Weighment record not found' });
    const uuid = results[0].SAP_UUID || results[0].UUID || results[0].Guid || results[0].GUID;
    if (!uuid) return res.status(400).json({ error: 'Weighment UUID not found for this record' });


    // 2. Fetch the full record, merge, and PATCH using the UUID
    const fullResp = await sapAxiosWeight.get(`/YY1_CAPTURINGWEIGHTDETAILS(guid'${uuid}')?$format=json`);
    const existing = fullResp.data?.d || fullResp.data;
    const merged = { ...existing, ...updateFields };
    delete merged.__metadata;
    delete merged.__proto__;

    // Ensure WeightDocNumber is always the original docNumber (max 10 chars, not UUID)
    if (typeof merged.WeightDocNumber === 'string' && merged.WeightDocNumber.length > 10) {
      merged.WeightDocNumber = docNumber;
    }

    const { token, cookies } = await fetchCsrfTokenWeight();
    const path = `/YY1_CAPTURINGWEIGHTDETAILS(guid'${uuid}')`;

    const resp = await sapAxiosWeight.patch(path, merged, {
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token,
        'If-Match': '*',
        Cookie: cookies,
      },
      validateStatus: status => status < 500
    });

    if (resp.status === 204) {
      return res.status(200).json();
    }
    // If not 204, send the SAP response as fallback
    res.status(resp.status).json(resp.data);
    
  } catch (err) {
    console.error('PATCH Material Inward error', err?.response?.status, err?.response?.data || err?.message);
    res.status(err?.response?.status || 500).json({ error: err?.response?.data || err?.message });
  }
});

/* ==================== WEIGHT DOCUMENTS ENDPOINTS ==================== */

// GET weight documents with filters
app.get('/api/weightdocs', async (req, res) => {
  try {
    const filter = req.query.$filter || '';
    const format = req.query.$format || 'json';
    const orderby = req.query.$orderby || '';
    const top = req.query.$top || '';

    let url = '/YY1_CAPTURINGWEIGHTDETAILS';
    const params = [];
    if (filter) params.push(`$filter=${encodeURIComponent(filter)}`);
    if (orderby) params.push(`$orderby=${encodeURIComponent(orderby)}`);
    if (top) params.push(`$top=${top}`);
    params.push(`$format=${format}`);

    url += params.length ? `?${params.join('&')}` : '';

    const resp = await sapAxiosWeight.get(url);
    res.json(resp.data);
  } catch (err) {
    console.error('GET weight documents error', err?.response?.status, err?.response?.data || err?.message);
    res.status(err?.response?.status || 500).json({ error: err?.response?.data || err?.message });
  }
});

// PATCH update weight document by WeightDocNumber or UUID
app.patch('/api/weightdocs/:id', async (req, res) => {
  const id = req.params.id;
  const body = sanitizePayloadForSapServerSide(req.body);
  try {
    let uuid = id;
    // If id is not a UUID, look up by WeightDocNumber
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
      // Find the record by WeightDocNumber
      const resp = await sapAxiosWeight.get(`/YY1_CAPTURINGWEIGHTDETAILS?$filter=WeightDocNumber eq '${id}'&$format=json`);
      const results = resp.data?.d?.results || resp.data?.value || [];
      if (!results.length) {
        return res.status(404).json({ error: 'Weight document not found' });
      }
      uuid = results[0].SAP_UUID || results[0].UUID || results[0].Guid || results[0].GUID;
      if (!uuid) {
        return res.status(400).json({ error: 'UUID not found for this WeightDocNumber' });
      }
    }
    const { token, cookies } = await fetchCsrfTokenWeight();
    const path = `/YY1_CAPTURINGWEIGHTDETAILS(guid'${uuid}')`;
    const patchResp = await sapAxiosWeight.patch(path, body, {
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token,
        Cookie: cookies,
      },
      validateStatus: status => status < 500
    });
    if (patchResp.status === 204) return res.status(204).send();
    res.status(patchResp.status).json(patchResp.data);
  } catch (err) {
    console.error('PATCH weight document error', err?.response?.status, err?.response?.data || err?.message);
    res.status(err?.response?.status || 500).json({ error: err?.response?.data || err?.message });
  }
});

// PATCH update header Inward and Outward by GateEntryNumber or UUID
app.patch('/api/headers/:id', async (req, res) => {
  const id = req.params.id;
  const body = sanitizePayloadForSapServerSide(req.body);
  try {

    body.VehicleStatus= "OUT";
    body.OutwardTime = formatSapTime(systemtime);
    body.GateOutDate = formatSapODataDate(systemdate);
    let uuid = id;
    // If id is not a UUID, look up by GateEntryNumber
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
      // Find the record by GateEntryNumber
      const resp = await sapAxios.get(`/YY1_GATEINWARD_OUTWARDDETA?$filter=GateEntryNumber eq '${id}'&$format=json`);
      const results = resp.data?.d?.results || resp.data?.value || [];
      const record = results[0];
      if (record.Status === 'Cancelled') {
       return res.status(404).json({ error: 'Gate entry is cancelled' });
      }
      if (record.VehicleStatus === 'OUT') {
       return res.status(404).json({ error: 'Vehicle status already OUT' });
      }
      if (!results.length) {
        return res.status(404).json({ error: 'Gate entry not found' });
      }
      uuid = results[0].SAP_UUID || results[0].UUID || results[0].Guid || results[0].GUID;
      if (!uuid) {
        return res.status(400).json({ error: 'UUID not found for this GateEntryNumber' });
      }
    }
    const { token, cookies } = await fetchCsrfToken();
    const path = `/YY1_GATEINWARD_OUTWARDDETA(guid'${uuid}')`;
    const patchResp = await sapAxios.patch(path, body, {
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token,
        Cookie: cookies,
      },
      validateStatus: status => status < 500
    });
    if (patchResp.status === 204) return res.status(204).send();
    res.status(patchResp.status).json(patchResp.data);
  } catch (err) {
    console.error('PATCH header error', err?.response?.status, err?.response?.data || err?.message);
    res.status(err?.response?.status || 500).json({ error: err?.response?.data || err?.message });
  }
});

app.post('/api/headers/:id/pdf', async (req, res) => {
  const id = req.params.id;
  try {
    const resp = await sapAxios.get(`/YY1_GATEINWARD_OUTWARDDETA(guid'${id}')?$format=json`);
    const data = resp.data?.d || resp.data;

    const fields = [
      { label: "Internal Transfer Posting Entry", value: data.GateEntryNumber },
      { label: "Internal Transfer Posting Date", value: (data.GateEntryDate || '').slice(0, 10) },
      { label: "Vehicle Number", value: data.VehicleNumber },
      { label: "Transporter Name", value: data.TransporterName },
      { label: "Driver Name", value: data.DriverName },
      { label: "Gross Weight", value: data.GrossWeight },
      { label: "Tare Weight", value: data.TareWeight },
      { label: "Net Weight", value: data.NetWeight },
      { label: "Outward Time", value: data.OutwardTime },
      { label: "Remarks", value: data.Remarks },
    ];

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader('Content-disposition', 'attachment; filename="header.pdf"');
    res.setHeader('Content-type', 'application/pdf');
    doc.pipe(res); // <-- Pipe before writing content!

    // Draw border rectangle
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const borderMargin = 20;
    doc.rect(borderMargin, borderMargin, pageWidth - 2 * borderMargin, pageHeight - 2 * borderMargin).stroke();

    // Title
    doc.fontSize(20).font('Helvetica-Bold').text('Truck Internal Transfer Posting Details', {
      align: 'center',
      underline: true
    });
    doc.moveDown(1.5);

    // Draw a line under the title
    doc.moveTo(borderMargin + 10, 80).lineTo(pageWidth - borderMargin - 10, 80).stroke();

    // Content
    let y = 100;
    fields.forEach(({ label, value }) => {
      doc.font('Helvetica-Bold').fontSize(13).text(`${label}:`, borderMargin + 30, y, { continued: true });
      doc.font('Helvetica').fontSize(13).text(` ${value ?? ''}`);
      y += 28;
      // Optional: draw a light line between fields
      doc.moveTo(borderMargin + 25, y - 6).lineTo(pageWidth - borderMargin - 25, y - 6).dash(1, { space: 2 }).stroke().undash();
    });

    // Footer (optional)
    doc.fontSize(10).fillColor('gray').text('Generated by Truck Internal Transfer Posting System', borderMargin, pageHeight - borderMargin - 10, { align: 'center' });

    doc.end(); // <-- End after all content is written
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});
/* POST create item under existing header */
app.post('/api/headers/:id/items', async (req, res) => {
  const id = req.params.id;
  const item = req.body;
  try {
    const { token, cookies } = await fetchCsrfToken();

    const resp = await sapAxios.post('/YY1_GATEENTRYITEMS_GATEINWA000', {
      ...item,
      SAP_PARENT_UUID: id
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token,
        Cookie: cookies,
      }
    });

    res.status(resp.status).json(resp.data);
  } catch (err) {
    console.error('POST item error', err?.response?.status, err?.response?.data || err?.message);
    res.status(err?.response?.status || 500).json({ error: err?.response?.data || err?.message });
  }
});

/* PATCH update item */
app.patch('/api/items/:id', async (req, res) => {
  const id = req.params.id;
  const body = req.body;
  try {
    const { token, cookies } = await fetchCsrfToken();
    const path = `/YY1_GATEENTRYITEMS_GATEINWA000(guid'${id}')`;
    const resp = await sapAxios.patch(path, body, {
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token,
        Cookie: cookies,
      },
      validateStatus: status => status < 500
    });
    if (resp.status === 204) return res.status(204).send();
    res.status(resp.status).json(resp.data);
  } catch (err) {
    console.error('PATCH item error', err?.response?.status, err?.response?.data || err?.message);
    res.status(err?.response?.status || 500).json({ error: err?.response?.data || err?.message });
  }
});

// Get PO+Material remaining (balance) quantity from gate entry (multi-line)
app.get('/api/po-material-balance', async (req, res) => {
  const { poNumber, material } = req.query;
  if (!poNumber || !material) {
    return res.status(400).json({ error: 'poNumber and material are required' });
  }
  try {
    // 1. Fetch total ordered qty for this PO/material from SAP PO API (OData v4)
    let orderedQty = 0;
    try {
      // Use correct OData v4 entity: /PurchaseOrderItem?$filter=PurchaseOrder eq '...' and Material eq '...'
      const poPath = `/PurchaseOrderItem?$filter=PurchaseOrder eq '${poNumber}' and Material eq '${material}'`;
      const poResp = await sapAxiosPO.get(poPath);
      const poItems = poResp.data?.value || poResp.data?.d?.results || [];
      console.log(`[DEBUG] PO items for ${poNumber} & ${material}:`, poItems);
      orderedQty = poItems.reduce((sum, item) => sum + Number(item.OrderQuantity || 0), 0);
    } catch (poErr) {
      console.error('Error fetching PO ordered qty:', poErr?.response?.data || poErr.message);
      // If PO fetch fails, orderedQty stays 0
    }

    // 2. Sum received qty from gate entry (as before)
    const filter = [
      `PurchaseOrderNumber eq '${poNumber}'`,
      `PurchaseOrderNumber2 eq '${poNumber}'`,
      `PurchaseOrderNumber3 eq '${poNumber}'`,
      `PurchaseOrderNumber4 eq '${poNumber}'`,
      `PurchaseOrderNumber5 eq '${poNumber}'`
    ].join(' or ');
    const matFilter = [
      `Material eq '${material}'`,
      `Material2 eq '${material}'`,
      `Material3 eq '${material}'`,
      `Material4 eq '${material}'`,
      `Material5 eq '${material}'`
    ].join(' or ');
    const gatePath = `/YY1_GATEINWARD_OUTWARDDETA?$filter=(${filter}) and (${matFilter})&$format=json`;
    console.log('[DEBUG] Fetching gate entries with filter:', filter + ' and ' + matFilter);
    const gateResponse = await sapAxios.get(gatePath);
    const gateEntries = gateResponse.data?.d?.results || gateResponse.data?.value || [];
    console.log(`[DEBUG] Matching gate entries for PO ${poNumber} & Material ${material}:`, gateEntries);

    let receivedQty = 0;
    gateEntries.forEach(ge => {
      for (let i = 1; i <= 5; i++) {
        const poField = i === 1 ? 'PurchaseOrderNumber' : `PurchaseOrderNumber${i}`;
        const matField = i === 1 ? 'Material' : `Material${i}`;
        const balField = i === 1 ? 'BalanceQty' : `BalanceQty${i}`;
        if (
          (ge[poField] === poNumber) &&
          (ge[matField] === material)
        ) {
          receivedQty += Number(ge[balField] || 0);
        }
      }
    });

    // 3. Calculate remaining
    const remainingQty = orderedQty - receivedQty;

    res.json({
      poNumber,
      material,
      orderedQty,
      receivedQty,
      remainingQty
    });
  } catch (err) {
    console.error('Error fetching PO+Material balance:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch PO+Material balance' });
  }
});

app.get("/api/header/weightdetails", async (req, res) => {
  try {
    const gateNumber = req.query.gateEntryNumber || req.query.GateEntryNumber;
    if (!gateNumber) {
      return res.status(400).json({ error: "Missing required parameter: gateNumber" });
    }

    // Proper OData filter string
    const filter = `$filter=GateEntryNumber eq '${gateNumber}'&$format=json`;
    const fullUrl = `${SAP_URL2}?${filter}`;

    console.log("[INFO] Fetching SAP Weight Details →", fullUrl);

    // Perform the SAP OData request
    const response = await axios.get(fullUrl, {
      auth: { username: SAP_USER2, password: SAP_PASS2 },
      headers: { Accept: "application/json" },
      validateStatus: () => true // prevents throwing error on 4xx
    });

    if (response.status >= 400) {
      console.error("[SAP ERROR]", response.status, response.data);
      return res.status(response.status).json({
        error: response.data || `SAP returned status ${response.status}`
      });
    }

    // Parse SAP OData V2 format
    const results =
      response.data?.d?.results || response.data?.value || (response.data?.d ? [response.data.d] : []);

    console.log(`[INFO] SAP returned ${results.length} record(s)`);

    // Filter only Indicators = "I" (Inward)
    const filteredResults = results.filter((r) => (r.Indicators || "").toUpperCase() === "I");

    // Return consistent JSON
    return res.json({
      d: {
        results: filteredResults
      }
    });
  } catch (error) {
    console.error("[API ERROR]", error.response?.status, error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message || "Failed to fetch SAP data"
    });
  }
});


// GET Material Outward records (Indicators='O')
app.get("/api/header/weightdetails/outward", async (req, res) => {
  try {
    const gateNumber = req.query.gateEntryNumber || req.query.GateEntryNumber;
    if (!gateNumber) {
      return res.status(400).json({ error: "Missing required parameter: gateEntryNumber" });
    }

    const filter = `$filter=GateEntryNumber eq '${gateNumber}'&$format=json`;
    const fullUrl = `${SAP_URL2}?${filter}`;
    console.log("[INFO] Fetching SAP Weight Details (Outward) →", fullUrl);

    console.log("[INFO] Fetching SAP Weight Details (Outward) →", fullUrl);

    const response = await axios.get(fullUrl, {
      auth: { username: SAP_USER2, password: SAP_PASS2 },
      headers: { Accept: "application/json" },
      validateStatus: () => true
    });

    if (response.status >= 400) {
      console.error("[SAP ERROR]", response.status, response.data);
      return res.status(response.status).json({
        error: response.data || `SAP returned status ${response.status}`
      });
    }

    const results =
      response.data?.d?.results || response.data?.value || (response.data?.d ? [response.data.d] : []);

    console.log(`[INFO] SAP returned ${results.length} record(s)`);

    // Filter only Indicators = "O" (Outward)
    const filteredResults = results.filter((r) => (r.Indicators || "").toUpperCase() === "O");

    // Return latest outward rows first so UI updates target the most recent weight row.
    const parseSapDateMs = (value) => {
      if (!value) return 0;
      if (typeof value === 'string' && value.startsWith('/Date(')) {
        const match = value.match(/\/Date\((\d+)/);
        return match ? Number(match[1]) || 0 : 0;
      }
      const ms = new Date(value).getTime();
      return Number.isFinite(ms) ? ms : 0;
    };

    filteredResults.sort((a, b) => {
      const aTime = Math.max(
        parseSapDateMs(a.SAP_LastChangedDateTime),
        parseSapDateMs(a.SAP_CreatedDateTime)
      );
      const bTime = Math.max(
        parseSapDateMs(b.SAP_LastChangedDateTime),
        parseSapDateMs(b.SAP_CreatedDateTime)
      );
      if (bTime !== aTime) return bTime - aTime;

      const aDoc = Number(String(a.WeightDocNumber || '').replace(/\D/g, '')) || 0;
      const bDoc = Number(String(b.WeightDocNumber || '').replace(/\D/g, '')) || 0;
      return bDoc - aDoc;
    });

    return res.json({
      d: {
        results: filteredResults
      }
    });
  } catch (error) {
    console.error("[API ERROR]", error.response?.status, error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message || "Failed to fetch SAP data"
    });
  }
});


// GET Material Outward records by Vendor Invoice Number (Indicators='O')
app.get("/api/weightdetails/vendorinvoice/:VendorInvoiceNumber", async (req, res) => {
  try {
    const vendorInvoiceNumber = req.params.VendorInvoiceNumber;
    const normalizeToken = (value) => String(value || '').trim().toUpperCase();
    const queryVehicle = normalizeToken(req.query.vehicleNumber);
    const queryPermit = normalizeToken(req.query.permitNumber);
    const queryMaterial = normalizeToken(req.query.material);
    const queryGrade = normalizeToken(req.query.grade);
    const includeOut = String(req.query.includeOut || '').toLowerCase() === 'true';

    if (!vendorInvoiceNumber) {
      return res.status(400).json({ error: "Missing required parameter: vendorInvoiceNumber" });
    }

    const filter = `$filter=VendorInvoiceNumber eq '${vendorInvoiceNumber}'&$format=json`;
    const fullUrl = `${SAP_URL2}?${filter}`;

    console.log("[INFO] Fetching SAP Weight Details (Outward by VendorInvoiceNumber) →", fullUrl);

    const response = await axios.get(fullUrl, {
      auth: { username: SAP_USER2, password: SAP_PASS2 },
      headers: { Accept: "application/json" },
      validateStatus: () => true
    });

    if (response.status >= 400) {
      console.error("[SAP ERROR]", response.status, response.data);
      return res.status(response.status).json({
        error: response.data || `SAP returned status ${response.status}`
      });
    }

    const results =
      response.data?.d?.results || response.data?.value || (response.data?.d ? [response.data.d] : []);

    console.log(`[INFO] SAP returned ${results.length} record(s)`);

    // Outward scan should find inward-created weight docs first.
    let filteredResults = results.filter((r) => (r.Indicators || '').toUpperCase() === 'I');

    if (queryVehicle) {
      filteredResults = filteredResults.filter((r) => {
        const recVehicle = normalizeToken(r.TruckNumber || r.VehicleNumber);
        return recVehicle && recVehicle === queryVehicle;
      });
    }

    if (queryPermit) {
      filteredResults = filteredResults.filter((r) => normalizeToken(r.PermitNumber) === queryPermit);
    }

    if (queryMaterial) {
      filteredResults = filteredResults.filter((r) => normalizeToken(r.Material) === queryMaterial);
    }

    if (queryGrade) {
      filteredResults = filteredResults.filter((r) => normalizeToken(r.MaterialDescription) === queryGrade);
    }

    const gateNumbers = [...new Set(filteredResults.map((r) => String(r.GateEntryNumber || '').trim()).filter(Boolean))];
    const headerByGate = {};

    if (gateNumbers.length > 0) {
      const gateFilter = gateNumbers.map((n) => `GateEntryNumber eq '${n}'`).join(' or ');
      const headerResp = await sapAxios.get(`/YY1_GATEINWARD_OUTWARDDETA?$filter=${gateFilter}&$format=json`);
      const headerResults = headerResp.data?.d?.results || headerResp.data?.value || [];
      headerResults.forEach((h) => {
        const gn = String(h.GateEntryNumber || '').trim();
        if (gn) headerByGate[gn] = h;
      });
    }

    filteredResults = filteredResults
      .map((r) => {
        const gate = String(r.GateEntryNumber || '').trim();
        const hdr = headerByGate[gate] || {};
        return {
          ...r,
          VehicleStatus: hdr.VehicleStatus || r.VehicleStatus || '',
          HeaderSAPUUID: hdr.SAP_UUID || hdr.UUID || hdr.Guid || hdr.GUID || '',
          HeaderOutwardTime: hdr.OutwardTime || '',
          HeaderGateOutDate: hdr.GateOutDate || null,
          HeaderVehicleNumber: hdr.VehicleNumber || '',
          HeaderPermitNumber: hdr.PermitNumber || '',
          HeaderGateEntryDate: hdr.GateEntryDate || null,
          HeaderCreatedDateTime: hdr.SAP_CreatedDateTime || hdr.CreatedAt || null,
        };
      })
      .filter((r) => includeOut || String(r.VehicleStatus || '').toUpperCase() === 'IN')
      .sort((a, b) => {
        const aDate = new Date(a.HeaderGateEntryDate || a.HeaderCreatedDateTime || a.SAP_CreatedDateTime || 0).getTime() || 0;
        const bDate = new Date(b.HeaderGateEntryDate || b.HeaderCreatedDateTime || b.SAP_CreatedDateTime || 0).getTime() || 0;
        if (bDate !== aDate) return bDate - aDate;
        const aGate = Number(String(a.GateEntryNumber || '').replace(/\D/g, '')) || 0;
        const bGate = Number(String(b.GateEntryNumber || '').replace(/\D/g, '')) || 0;
        return bGate - aGate;
      });

    return res.json({ d: { results: filteredResults } });
  } catch (error) {
    console.error("[API ERROR]", error.response?.status, error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message || "Failed to fetch SAP data"
    });
  }
});



/* PATCH Update Material Inward (for tare weight) */
app.patch('/api/headers/material/:uuid', async (req, res) => {
  const uuid = req.params.uuid;
  const body = sanitizePayloadForSapServerSide(req.body);
  try {
    const { token, cookies } = await fetchCsrfTokenWeight();
    
    // REMOVE $format=json from PATCH - SAP doesn't allow query options on updates
    const path = `/YY1_CAPTURINGWEIGHTDETAILS(guid'${uuid}')`;
    
    console.log('[DEBUG] Updating Material Inward:', path);
    console.log('[DEBUG] Update payload:', JSON.stringify(body, null, 2));
    
    const resp = await sapAxiosWeight.patch(path, body, {
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token,
        'If-Match': '*', // to avoid 412 Precondition Failed
        Cookie: cookies,
      },
      validateStatus: status => status < 500
    });

    // Also update linked gate-entry weights so header feed stays in sync.
    const gateEntryNumber = String(body.GateEntryNumber || '').trim();
    const hasWeightToSync =
      body.GrossWeight !== undefined ||
      body.TareWeight !== undefined ||
      body.NetWeight !== undefined;

    if (gateEntryNumber && hasWeightToSync) {
      try {
        const headerLookupResp = await sapAxios.get(
          `/YY1_GATEINWARD_OUTWARDDETA?$filter=GateEntryNumber eq '${gateEntryNumber}'&$format=json`
        );
        const headerResults = headerLookupResp.data?.d?.results || headerLookupResp.data?.value || [];

        if (headerResults.length > 0) {
          const headerUuid =
            headerResults[0].SAP_UUID ||
            headerResults[0].UUID ||
            headerResults[0].Guid ||
            headerResults[0].GUID;

          if (headerUuid) {
            const headerPatchBody = {};
            if (body.GrossWeight !== undefined) headerPatchBody.GrossWeight = String(body.GrossWeight);
            if (body.TareWeight !== undefined) headerPatchBody.TareWeight = String(body.TareWeight);
            if (body.NetWeight !== undefined) headerPatchBody.NetWeight = String(body.NetWeight);

            const { token: headerToken, cookies: headerCookies } = await fetchCsrfToken();
            await sapAxios.patch(
              `/YY1_GATEINWARD_OUTWARDDETA(guid'${headerUuid}')`,
              headerPatchBody,
              {
                headers: {
                  'Content-Type': 'application/json',
                  'x-csrf-token': headerToken,
                  Cookie: headerCookies,
                },
                validateStatus: (status) => status < 500,
              }
            );
          }
        }
      } catch (headerPatchErr) {
        console.error(
          '[WARN] Material inward tare update succeeded, but header weight sync failed',
          headerPatchErr?.response?.status,
          headerPatchErr?.response?.data || headerPatchErr?.message
        );
      }
    }
    
    if (resp.status === 204) return res.status(204).send();
    res.status(resp.status).json(resp.data);
  } catch (err) {
    console.error('PATCH Material Inward error', err?.response?.status,
    err?.response?.data || err?.message
  );
 
  const sapMessage =
    err?.response?.data?.error?.message?.value ||
    err?.response?.data?.error?.message ||
    err?.message;
 
  res.status(err?.response?.status || 500).json({
    success: false,
    message: sapMessage
  });
}
});



// Example: PATCH /api/headers/material/:docNumber
app.patch('/api/headers/material/obd/:docNumber', async (req, res) => {
  const docNumber = req.params.docNumber;
  const updateFields = sanitizePayloadForSapServerSide(req.body);
  try {
    // 1. Fetch the record by WeightDocNumber to get the UUID
    const getResp = await sapAxiosWeight.get(`/YY1_CAPTURINGWEIGHTDETAILS?$filter=WeightDocNumber eq '${docNumber}'&$format=json`);
    const results = getResp.data?.d?.results || [];
    if (!results.length) return res.status(404).json({ error: 'Record not found' });
    const uuid = results[0].SAP_UUID || results[0].UUID || results[0].Guid || results[0].GUID;
    if (!uuid) return res.status(400).json({ error: 'UUID not found for this record' });


    // 2. Fetch the full record, merge, and PATCH using the UUID
    const fullResp = await sapAxiosWeight.get(`/YY1_CAPTURINGWEIGHTDETAILS(guid'${uuid}')?$format=json`);
    const existing = fullResp.data?.d || fullResp.data;
    const merged = { ...existing, ...updateFields };
    delete merged.__metadata;
    delete merged.__proto__;

    // Ensure WeightDocNumber is always the original docNumber (max 10 chars, not UUID)
    if (typeof merged.WeightDocNumber === 'string' && merged.WeightDocNumber.length > 10) {
      merged.WeightDocNumber = docNumber;
    }

    const { token, cookies } = await fetchCsrfTokenWeight();
    const path = `/YY1_CAPTURINGWEIGHTDETAILS(guid'${uuid}')`;

    const resp = await sapAxiosWeight.patch(path, merged, {
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token,
        'If-Match': '*',
        Cookie: cookies,
      },
      validateStatus: status => status < 500
    });

    if (resp.status === 204) 
      return res.status(204).send();
      res.status(resp.status).json(resp.data);
  } catch (err) {
    console.error('PATCH Material Inward error', err?.response?.status, err?.response?.data || err?.message);
    res.status(err?.response?.status || 500).json({ error: err?.response?.data || err?.message });
  }
});


// ============================================
// REGISTRATION NUMBER GENERATION (10-digit format: YY + 8-digit increment)
// ============================================

// Build RegistrationNumber prefix: last 2 digits of FY year
// FY 2025-26 (Jan-Mar 2026) → 25, FY 2026-27 (Apr 2026-Mar 2027) → 26
function buildRegNumPrefix(dateInput) {
  console.log('[REGNUM-GEN] buildRegNumPrefix called with:', dateInput);
  let date;
  if (!dateInput) {
    date = new Date();
  } else if (typeof dateInput === 'string' && dateInput.length === 4) {
    date = new Date(Number(dateInput), 3, 1); // April 1st
  } else {
    date = new Date(dateInput);
  }
  
  console.log('[REGNUM-GEN] Parsed date:', date);
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  console.log('[REGNUM-GEN] Year:', year, 'Month:', month);
  
  // If before April (Jan-Mar), use previous year
  if (month < 4) {
    year = year - 1;
    console.log('[REGNUM-GEN] Month < 4, adjusted year to:', year);
  }
  
  // Get last 2 digits: 2025 → 25, 2026 → 26
  const prefix = String(year).slice(-2);
  console.log('[REGNUM-GEN] Final prefix:', prefix);
  return prefix;
}

// Compute next RegistrationNumber
// Format: {YY}{00000001} e.g., 2500000001, 2500000002, 2600000001
// latestRegNum is already parsed as integer (e.g., 2500000001)
function computeNextRegNum(yearPrefix, latestRegNum) {
  console.log('[REGNUM-GEN] computeNextRegNum called');
  console.log('[REGNUM-GEN] yearPrefix:', yearPrefix, 'latestRegNum:', latestRegNum);
  
  if (!latestRegNum) {
    // First number for this FY: YY00000001
    const firstNumber = `${yearPrefix}00000001`;
    console.log('[REGNUM-GEN] No latest number, returning first:', firstNumber);
    return firstNumber;
  }
  
  // latestRegNum is already an integer like 2500000001
  const latestStr = String(latestRegNum);
  
  // Extract year prefix (first 2 digits)
  const latestYearPrefix = latestStr.slice(0, 2);
  console.log('[REGNUM-GEN] Latest year prefix:', latestYearPrefix);
  
  // Check if same FY
  if (latestYearPrefix !== yearPrefix) {
    // Different year, start from 1
    const firstNumber = `${yearPrefix}00000001`;
    console.log('[REGNUM-GEN] Different FY, starting fresh:', firstNumber);
    return firstNumber;
  }
  
  // Increment the entire number
  const nextNumber = String(latestRegNum + 1);
  console.log('[REGNUM-GEN] Next number:', nextNumber);
  
  return nextNumber;
}

// Fetch latest RegistrationNumber from SAP matching the year prefix
async function getLatestRegNumFromSap(yearPrefix) {
  try {
    const path = `/YY1_INITIALREGISTRATION?$orderby=SAP_CreatedDateTime desc&$top=500&$format=json`;
    console.log('[REGNUM-GEN] Fetching latest RegistrationNumbers from SAP (top 500)');
    const resp = await sapAxiosInitialRegistration.get(path);
    
    let results = [];
    if (resp.data && resp.data.d && resp.data.d.results) {
      results = resp.data.d.results;
    } else if (resp.data && resp.data.value) {
      results = resp.data.value;
    }
    
    console.log('[REGNUM-GEN] Total registrations fetched:', results.length);
    
    // Log samples
    if (results.length > 0) {
      const samples = results.slice(0, 10).map(r => ({ 
        RegNum: r.RegistrationNumber, 
        Type: typeof r.RegistrationNumber,
        SalesDoc: r.SalesDocument,
        Created: r.SAP_CreatedDateTime 
      }));
      console.log('[REGNUM-GEN] Sample records:', JSON.stringify(samples, null, 2));
    }
    
    // Parse SAP's format (might be zero-padded) and filter by year prefix
    const matchingNumbers = results
      .map(r => r.RegistrationNumber)
      .filter(num => {
        if (!num) return false;
        // Parse to remove leading zeros if any
        const parsedNum = parseInt(num, 10);
        if (isNaN(parsedNum)) return false;
        // Check if starts with year prefix
        const numStr = String(parsedNum);
        const matches = numStr.startsWith(yearPrefix);
        if (matches) console.log('[REGNUM-GEN] Found match:', num, '-> parsed:', numStr);
        return matches;
      })
      .map(num => parseInt(num, 10)) // Convert to numbers
      .sort((a, b) => b - a); // Descending
    
    const latestNumber = matchingNumbers.length > 0 ? matchingNumbers[0] : null;
    console.log('[REGNUM-GEN] Matching numbers for FY', yearPrefix + ':', matchingNumbers.slice(0, 10));
    console.log('[REGNUM-GEN] Latest number selected:', latestNumber);
    return latestNumber;
  } catch (e) {
    console.error('[REGNUM-GEN] Error fetching latest RegistrationNumber', e);
    return null;
  }
}

// Generate next RegistrationNumber
const getNextRegNum = async (yearInput) => {
  const yearPrefix = buildRegNumPrefix(yearInput);
  console.log('[REGNUM-GEN] Year prefix:', yearPrefix);
  
  const latestRegNum = await getLatestRegNumFromSap(yearPrefix);
  console.log('[REGNUM-GEN] Latest RegistrationNumber from SAP:', latestRegNum);
  
  const nextNumber = computeNextRegNum(yearPrefix, latestRegNum);
  console.log('[REGNUM-GEN] Computed next RegistrationNumber:', nextNumber);
  
  return nextNumber;
};


// ============================================
// SALES DOCUMENT (S.NO) GENERATION (10-digit format: YY + 8-digit increment)
// ============================================

// Build SalesDocument (S.NO) prefix based on Indian financial year (April-March)
// Returns full 4-digit year: 2025, 2026, 2027...
function buildSalesDocPrefix(dateInput) {
  console.log('[SALESDOC-GEN] buildSalesDocPrefix called with:', dateInput);
  // Financial year starts April 1st: 2025-04-01 to 2026-03-31 = FY 2025-26 = prefix "2025"
  let date;
  if (!dateInput) {
    date = new Date();
  } else if (typeof dateInput === 'string' && dateInput.length === 4) {
    date = new Date(Number(dateInput), 3, 1); // April 1st of that year
  } else {
    date = new Date(dateInput);
  }
  
  console.log('[SALESDOC-GEN] Parsed date:', date);
  let year = date.getFullYear();
  let month = date.getMonth() + 1; // JS months: 0-11
  console.log('[SALESDOC-GEN] Year:', year, 'Month:', month);
  
  // If before April (Jan-Mar), use previous year as financial year start
  if (month < 4) {
    year = year - 1;
    console.log('[SALESDOC-GEN] Month < 4, adjusted year to:', year);
  }
  
  // Return full 4-digit year: 2025, 2026, etc.
  const prefix = String(year);
  console.log('[SALESDOC-GEN] Final prefix:', prefix);
  return prefix;
}

// Compute next SalesDocument (S.NO) number
// Format: {YYYY}{increment} e.g., 20251, 20252, 20253, 202510, 20261, 20262...
// latestSalesDoc is already parsed as integer (e.g., 20251)
function computeNextSalesDocNumber(yearPrefix, latestSalesDoc) {
  console.log('[SALESDOC-GEN] computeNextSalesDocNumber called');
  console.log('[SALESDOC-GEN] yearPrefix:', yearPrefix, 'latestSalesDoc:', latestSalesDoc);
  
  if (!latestSalesDoc) {
    // First number for this financial year: {YYYY}1 (e.g., 20251)
    const firstNumber = `${yearPrefix}1`;
    console.log('[SALESDOC-GEN] No latest number, returning first:', firstNumber);
    return firstNumber;
  }
  
  // latestSalesDoc is already an integer like 20251, 20259, 202510, etc.
  const latestStr = String(latestSalesDoc);
  
  // Extract year prefix (first 4 digits) and sequence (remaining digits)
  const latestYearPrefix = latestStr.slice(0, 4);
  const latestSequence = latestStr.slice(4); // Everything after year
  console.log('[SALESDOC-GEN] Latest year prefix:', latestYearPrefix, 'Sequence:', latestSequence);
  
  // Check if the latest number is from the same financial year
  if (latestYearPrefix !== yearPrefix) {
    // Different year, start from 1
    const firstNumber = `${yearPrefix}1`;
    console.log('[SALESDOC-GEN] Different FY, starting fresh:', firstNumber);
    return firstNumber;
  }
  
  // Same year - increment the sequence number only
  const currentSequence = parseInt(latestSequence, 10) || 0;
  const nextSequence = currentSequence + 1;
  const nextNumber = `${yearPrefix}${nextSequence}`;
  console.log('[SALESDOC-GEN] Incrementing sequence:', currentSequence, '->', nextSequence);
  console.log('[SALESDOC-GEN] Next number:', nextNumber);
  
  return nextNumber;
}

// Fetch latest SalesDocument from SAP matching the year prefix
async function getLatestSalesDocNumberFromSap(yearPrefix) {
  try {
    // Fetch recent records ordered by creation time to get latest entries
    // Then filter client-side for matching year prefix
    const path = `/YY1_INITIALREGISTRATION?$orderby=SAP_CreatedDateTime desc&$top=500&$format=json`;
    console.log('[SALESDOC-GEN] Fetching latest SalesDocument numbers from SAP (top 500, ordered by creation time)');
    const resp = await sapAxiosInitialRegistration.get(path);
    
    let results = [];
    if (resp.data && resp.data.d && resp.data.d.results) {
      results = resp.data.d.results;
    } else if (resp.data && resp.data.value) {
      results = resp.data.value;
    }
    
    console.log('[SALESDOC-GEN] Total registrations fetched:', results.length);
    
    // Log first 10 SalesDocument values to debug
    if (results.length > 0) {
      const samples = results.slice(0, 10).map(r => ({ 
        SalesDoc: r.SalesDocument, 
        Type: typeof r.SalesDocument,
        RegNum: r.RegistrationNumber,
        Created: r.SAP_CreatedDateTime 
      }));
      console.log('[SALESDOC-GEN] Sample records:', JSON.stringify(samples, null, 2));
    }
    
    // Parse SAP's format and filter by year prefix (first 4 digits: 2025, 2026, etc.)
    const matchingNumbers = results
      .map(r => r.SalesDocument)
      .filter(num => {
        if (!num) return false;
        // Parse to remove leading zeros if any
        const parsedNum = parseInt(num, 10);
        if (isNaN(parsedNum)) return false;
        // Check if first 4 digits match year prefix
        const numStr = String(parsedNum);
        // Extract first 4 digits and compare
        const numYearPrefix = numStr.slice(0, 4);
        const matches = numYearPrefix === yearPrefix;
        if (matches) console.log('[SALESDOC-GEN] Found match:', num, '-> parsed:', numStr, 'year:', numYearPrefix);
        return matches;
      })
      .map(num => parseInt(num, 10)) // Convert to numbers
      .sort((a, b) => b - a); // Descending
    
    const latestNumber = matchingNumbers.length > 0 ? matchingNumbers[0] : null;
    console.log('[SALESDOC-GEN] Matching numbers for FY', yearPrefix + ':', matchingNumbers.slice(0, 10));
    console.log('[SALESDOC-GEN] Latest number selected:', latestNumber);
    return latestNumber;
  } catch (e) {
    console.error('[SALESDOC-GEN] Error fetching latest SalesDocument', e);
    return null;
  }
}

// Utility: Generate SalesDocument (S.NO) - year-based series
const getNextSalesDocNumber = async (yearInput) => {
  const yearPrefix = buildSalesDocPrefix(yearInput);
  console.log('[SALESDOC-GEN] Year prefix:', yearPrefix);
  
  const latest = await getLatestSalesDocNumberFromSap(yearPrefix);
  console.log('[SALESDOC-GEN] Latest SalesDocument from SAP:', latest);
  
  const nextNumber = computeNextSalesDocNumber(yearPrefix, latest);
  console.log('[SALESDOC-GEN] Computed next SalesDocument:', nextNumber);
  
  return nextNumber;
};

// Mutex for atomic number generation
const salesDocMutex = new Mutex();


// Initial Registration POST
app.post('/api/initial-registration', async (req, res) => {
  await salesDocMutex.runExclusive(async () => {
    try {
      console.log('[DEBUG] Initial Registration request received:', req.body);
      // Use current date for FY calculation
      const regDate = req.body.RegistrationDate || new Date();
      console.log('[DEBUG] Using date for FY calculation:', regDate);
     
      // Generate SalesDocument (S.NO) - simple format: 20251, 20252, 20253...
      const salesDocument = await getNextSalesDocNumber(regDate);
      console.log('[DEBUG] Generated SalesDocument (S.NO):', salesDocument);
     
      // Generate RegistrationNumber - 10 digits (YY + 8-digit increment)
      const registrationNumber = await getNextRegNum(regDate);
      const paddedRegNumber = registrationNumber.padStart(10, '0');
      console.log('[DEBUG] Generated RegistrationNumber:', registrationNumber, '-> Padded:', paddedRegNumber);
     
      console.log('[DEBUG] SalesDocument type:', typeof salesDocument);
      console.log('[DEBUG] RegistrationNumber type:', typeof registrationNumber);
     
      const body = req.body;
     
      // Remove BalanceQty, RegistrationNumber, and Status from payload if present
      const { BalanceQty, RegistrationNumber, Status, ...rest } = req.body;
      const input = sanitizePayloadForSapServerSide({
        ...rest,
        SalesDocument: salesDocument,           // No padding: 20251, 20252, 20253
        RegistrationNumber: paddedRegNumber,     // Padded to 10 digits: 2500000001
        Status: '01'
      });
     
      console.log('[DEBUG] Full payload to SAP:', JSON.stringify(input, null, 2));
      console.log('[DEBUG] SalesDocument in payload:', input.SalesDocument);
     
      const { token, cookies } = await fetchCsrfTokenInitialRegistration();
      const resp = await sapAxiosInitialRegistration.post('/YY1_INITIALREGISTRATION', input, {
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
          Cookie: cookies,
        },
      });
     
      console.log('[DEBUG] SAP response status:', resp.status);
      console.log('[DEBUG] SAP response data:', JSON.stringify(resp.data, null, 2));
      console.log('[DEBUG] SalesDocument from SAP:', resp.data?.d?.SalesDocument);
      console.log('[DEBUG] RegistrationNumber from SAP:', resp.data?.d?.RegistrationNumber);
     
      // Return response with generated numbers (unpacked for display)
      res.status(resp.status).json({
        ...resp.data,
        SalesDocument: salesDocument,           // 20251, 20252, 20253
        RegistrationNumber: registrationNumber  // 2500000001, 2500000002
      });
    } catch (err) {
      console.error('[ERROR] POST Initial Registration failed');
      console.error('[ERROR] Status:', err?.response?.status);
      console.error('[ERROR] Data:', JSON.stringify(err?.response?.data, null, 2));
      console.error('[ERROR] Message:', err?.message);
      res.status(err?.response?.status || 500).json({ error: err?.response?.data || err?.message });
    }
  });
});
  





/* GET Initial Registration list with optional search and count */
app.get('/api/initial-registrations', async (req, res) => {
  try {
    const top = Math.min(parseInt(req.query.top, 10) || 50, 250); // increased cap to 250
    const search = (req.query.search || '').trim();
    const wantCount = String(req.query.count || 'false').toLowerCase() === 'true';
    const orderby = req.query.$orderby || 'SAP_CreatedDateTime desc'; // default to newest first

    // Build OData $filter using substringof (OData V2 compatible)
    let filterExpr = '';
    if (search) {
      const s = search.replace(/'/g, "''"); // escape single quotes for OData
      // Use substringof instead of contains - OData V2 syntax
      const clauses = [
        `substringof('${s}',RegistrationNumber)`,
        `substringof('${s}',SalesDocument2)`,
        `substringof('${s}',VehicleNumber)`,
        `substringof('${s}',Transporter)`,
        `substringof('${s}',SAP_Description)`
      ];
      filterExpr = clauses.join(' or ');
    }

    let path = `/YY1_INITIALREGISTRATION?$format=json&$top=${top}`;
    if (filterExpr) path += `&$filter=${encodeURIComponent(filterExpr)}`;
    if (wantCount) path += `&$inlinecount=allpages`;
    if (orderby) path += `&$orderby=${encodeURIComponent(orderby)}`; // Add orderby to SAP query

    console.log('[DEBUG] Initial Registration query path:', path);

    const resp = await sapAxiosInitialRegistration.get(path);

    // Normalize OData V2 shape
    const d = resp.data?.d || {};
    let results = Array.isArray(d.results) ? d.results : (Array.isArray(resp.data?.value) ? resp.data.value : []);
    const count = d.__count != null ? Number(d.__count) : results.length;

    // --- RemainingQty always shows total available quantity ---
    // Group by SO (SalesDocument2 or SalesDocument), sum ExpectedQty
    const soGroups = {};
    results.forEach(r => {
      const so = r.SalesDocument2 || r.SalesDocument;
      if (!so) return;
      if (!soGroups[so]) soGroups[so] = { totalQty: 0 };
      soGroups[so].totalQty += Number(r.ExpectedQty) || 0;
    });
    // Attach RemainingQty (totalQty) to each record
    results = results.map(r => {
      const so = r.SalesDocument2 || r.SalesDocument;
      if (so && soGroups[so]) {
        return { ...r, RemainingQty: soGroups[so].totalQty };
      }
      return r;
    });

    return res.json({ d: { __count: count, results } });
  } catch (err) {
    console.error('GET Initial Registrations error', err?.response?.status, err?.response?.data || err?.message);
    res.status(err?.response?.status || 500).json({ error: err?.response?.data || err?.message });
  }
});

/* GET Initial Registration list with multiple vehicle number filter */
app.get('/api/truck-registrations', async (req, res) => {
  try {
    const top = Math.min(parseInt(req.query.top, 10) || 50, 200);
    const search = (req.query.search || '').trim();
    const vehicleNumbers = (req.query.vehicleNumbers || '').trim(); // comma-separated: "1,2,3"
    const wantCount = String(req.query.count || 'false').toLowerCase() === 'true';

    let filterConditions = [];

    // General search
    if (search) {
      const s = search.replace(/'/g, "''");
      const clauses = [
        `substringof('${s}',SalesDocument)`,
        `substringof('${s}',VehicleNumber)`,
        `substringof('${s}',Transporter)`,
        `substringof('${s}',SAP_Description)`
      ];
      filterConditions.push(`(${clauses.join(' or ')})`);
    }

    // Multiple Vehicle Numbers filter (OR condition)
    if (vehicleNumbers) {
      const vnArray = vehicleNumbers.split(',').map(vn => vn.trim()).filter(vn => vn);
      if (vnArray.length > 0) {
        const vehicleConditions = vnArray.map(vn => {
          const cleanVn = vn.replace(/'/g, "''");
          return `substringof('${cleanVn}',VehicleNumber)`; // Contains any of the numbers
          // OR use exact match: `VehicleNumber eq '${cleanVn}'`
        });
        filterConditions.push(`(${vehicleConditions.join(' or ')})`);
      }
    }

    let path = `/YY1_INITIALREGISTRATION?$format=json&$top=${top}`;
    
    if (filterConditions.length > 0) {
      const filterExpr = filterConditions.join(' and ');
      path += `&$filter=${encodeURIComponent(filterExpr)}`;
    }
    
    if (wantCount) path += `&$inlinecount=allpages`;

    console.log('[DEBUG] Query path:', path);

    const resp = await sapAxiosInitialRegistration.get(path);

    const d = resp.data?.d || {};
    const results = Array.isArray(d.results) ? d.results : (Array.isArray(resp.data?.value) ? resp.data.value : []);
    const count = d.__count != null ? Number(d.__count) : results.length;

    return res.json({ d: { __count: count, results } });
  } catch (err) {
    console.error('GET Initial Registrations error', err?.response?.status, err?.response?.data || err?.message);
    res.status(err?.response?.status || 500).json({ error: err?.response?.data || err?.message });
  }
});

/* PATCH Update Initial Registration (e.g., change Status to Failed) */
app.patch('/api/initial-registration/:uuid', async (req, res) => {
  const uuid = req.params.uuid;
  const updateFields = sanitizePayloadForSapServerSide(req.body);
  try {
    // 1. Fetch the full record from SAP
    const getResp = await sapAxiosInitialRegistration.get(`/YY1_INITIALREGISTRATION(guid'${uuid}')?$format=json`);
    const existing = getResp.data?.d || getResp.data;
    if (!existing) {
      return res.status(404).json({ error: 'Initial Registration record not found' });
    }
    // 2. Merge the update fields into the full record
    const merged = { ...existing, ...updateFields };
    delete merged.__metadata;
    delete merged.__proto__;
    // Remove OData navigation properties (to_* fields with __deferred)
    Object.keys(merged).forEach(key => {
      if (key.startsWith('to_') && merged[key] && merged[key].__deferred) {
        delete merged[key];
      }
    });

    const { token, cookies } = await fetchCsrfTokenInitialRegistration();
    const path = `/YY1_INITIALREGISTRATION(guid'${uuid}')`;
    console.log('[DEBUG] Updating Initial Registration (full record, cleaned):', path, merged);
    const resp = await sapAxiosInitialRegistration.patch(path, merged, {
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token,
        Cookie: cookies,
      },
      validateStatus: status => status < 500
    });
    if (resp.status === 204) return res.status(204).send();
    res.status(resp.status).json(resp.data);
  } catch (err) {
    console.error('PATCH Initial Registration error', err?.response?.status, err?.response?.data || err?.message);
    res.status(err?.response?.status || 500).json({ error: err?.response?.data || err?.message });
  }
});

async function getMailConfigFromSAP() {
  const resp = await sapAxiosMailIDAddresses.get(
      `/YY1_MAILIDADDRESSES?$filter=Technicaltype eq 'BTP_INVOICE_PDF'&$format=json`
  );
 
  const data = resp.data?.d?.results?.[0];
 
  if (!data) throw new Error("No mail config found in SAP");
 
  return {
    user: data.MailUser,
    pass: data.MailPassword,
    host: data.Host,
    port: Number(data.Port) || 587
  };
}
async function getSapTransporter() {
  const mailConfig = await getMailConfigFromSAP();
 
  console.log("MAIL CONFIG:", mailConfig); // debug
 
  return {
    transporter: nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: false, // for 587
      auth: {
        user: mailConfig.user,
        pass: mailConfig.pass
      },
      tls: {
        rejectUnauthorized: false
      }
    }),
    mailConfig
  };
}

 
 
app.post("/api/send-notification", async (req, res) => {
  try {
    console.log("API HIT");
 
    const { transporter, mailConfig } = await getSapTransporter();
 
    const { gateEntryNumber, weightDocNumber, vehicleNumber, grossWeight, date } = req.body;
 
    const mailOptions = {
      from: mailConfig.user, // MUST match SMTP user
      to: "n.sukumar056@gmail.com",
      subject: `Gate Entry Created - ${gateEntryNumber}`,
      html: `
        <h2>Gate Entry Created</h2>
        <p><b>Gate Entry:</b> ${gateEntryNumber}</p>
        <p><b>Vehicle:</b> ${vehicleNumber}</p>
        <p><b>Weight:</b> ${grossWeight || "N/A"}</p>
        <p><b>Date:</b> ${date}</p>
      `
    };
 
    await transporter.sendMail(mailOptions);
 
    console.log("MAIL SENT SUCCESS");
    res.json({ success: true });
 
  } catch (error) {
    console.error("FULL ERROR:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
 
 
app.post("/api/initial/send-notification", async (req, res) => {
  try {
    console.log("API HIT INITIAL");
 
    const { transporter, mailConfig } = await getSapTransporter();
 
    const {
      registrationNumber,
      weightDocNumber,
      vehicleNumber,
      transporterNumber,
      grossWeight,
      date,
      transporterEmail
    } = req.body;
 
    const mailOptions = {
      from: mailConfig.user,
      to: transporterEmail || "n.sukumar056@gmail.com",
      subject: `✅ Registration Created - ${registrationNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
         
          <div style="background: #ffffff; padding: 25px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
           
            <p>Dear Sir / Madam,</p>
 
            <p>
              As per your request, the truck has been successfully registered for loading.
            </p>
 
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
             
              <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 10px; font-weight: bold;">Registration</td>
                <td style="padding: 10px;">${registrationNumber}</td>
              </tr>
 
              <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 10px; font-weight: bold;">Transporter</td>
                <td style="padding: 10px;">${transporterNumber}</td>
              </tr>
 
              <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 10px; font-weight: bold;">Vehicle Number</td>
                <td style="padding: 10px;">${vehicleNumber}</td>
              </tr>
 
              <tr>
                <td style="padding: 10px; font-weight: bold;">Date</td>
                <td style="padding: 10px;">${date || "N/A"}</td>
              </tr>
 
            </table>
 
            <div style="margin-top: 20px;">
              <p>
                Regards,<br/>
                <strong>Gate Entry Team</strong>
              </p>
            </div>
 
          </div>
        </div>
      `
    };
 
    await transporter.sendMail(mailOptions);
 
    console.log("MAIL SENT SUCCESS");
    res.json({ success: true, message: "Email sent successfully" });
 
  } catch (error) {
    console.error("FULL ERROR:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
 

/**
 * Parse SAP error into user-friendly message
 * Converts technical SAP errors into simple messages clients can understand
 */
function parseSapErrorToFriendlyMessage(err) {
  try {
    // Extract error data from various possible structures
    const errData = err?.response?.data?.error?.error || err?.response?.data?.error || err?.response?.data;
    
    if (!errData) {
      return err?.message || 'An unexpected error occurred';
    }

    // Extract the main error message
    const message = errData.message?.value || errData.message || '';
    
    // Common SAP error patterns and their friendly translations
    const patterns = [
      {
        // Property validation errors - extract field name and value
        regex: /Property '(\w+)' at offset '\d+' has invalid value '([^']+)'/i,
        format: (match) => {
          const fieldName = match[1];
          const invalidValue = match[2];
          
          // Convert technical field names to user-friendly names
          const fieldMap = {
            'PurchaseOrderNumber': 'Purchase Order 1',
            'PurchaseOrderNumber2': 'Purchase Order 2',
            'PurchaseOrderNumber3': 'Purchase Order 3',
            'PurchaseOrderNumber4': 'Purchase Order 4',
            'PurchaseOrderNumber5': 'Purchase Order 5',
            'Material': 'Material 1',
            'Material2': 'Material 2',
            'Material3': 'Material 3',
            'Material4': 'Material 4',
            'Material5': 'Material 5',
            'MaterialDescription': 'Material Description 1',
            'MaterialDescription2': 'Material Description 2',
            'MaterialDescription3': 'Material Description 3',
            'MaterialDescription4': 'Material Description 4',
            'MaterialDescription5': 'Material Description 5',
            'Vendor': 'Vendor 1',
            'Vendor2': 'Vendor 2',
            'Vendor3': 'Vendor 3',
            'Vendor4': 'Vendor 4',
            'Vendor5': 'Vendor 5',
            'VendorName': 'Vendor Name 1',
            'VendorName2': 'Vendor Name 2',
            'VendorName3': 'Vendor Name 3',
            'VendorName4': 'Vendor Name 4',
            'VendorName5': 'Vendor Name 5',
            'VendorInvoiceNumber': 'Vendor Invoice Number 1',
            'VendorInvoiceNumber2': 'Vendor Invoice Number 2',
            'VendorInvoiceNumber3': 'Vendor Invoice Number 3',
            'VendorInvoiceNumber4': 'Vendor Invoice Number 4',
            'VendorInvoiceNumber5': 'Vendor Invoice Number 5',
            'VendorInvoiceWeight': 'Vendor Invoice Weight 1',
            'VendorInvoiceWeight2': 'Vendor Invoice Weight 2',
            'VendorInvoiceWeight3': 'Vendor Invoice Weight 3',
            'VendorInvoiceWeight4': 'Vendor Invoice Weight 4',
            'VendorInvoiceWeight5': 'Vendor Invoice Weight 5',
            'VendorInvoiceDate': 'Vendor Invoice Date 1',
            'VendorInvoiceDate2': 'Vendor Invoice Date 2',
            'VendorInvoiceDate3': 'Vendor Invoice Date 3',
            'VendorInvoiceDate4': 'Vendor Invoice Date 4',
            'VendorInvoiceDate5': 'Vendor Invoice Date 5',
            'BalanceQty': 'Balance Quantity 1',
            'BalanceQty2': 'Balance Quantity 2',
            'BalanceQty3': 'Balance Quantity 3',
            'BalanceQty4': 'Balance Quantity 4',
            'BalanceQty5': 'Balance Quantity 5',
            'GateEntryNumber': 'Gate Entry Number',
            'WeightDocNumber': 'Weight Document Number',
            'VehicleNumber': 'Vehicle Number',
            'TruckNumber': 'Truck Number',
            'GateEntryDate': 'Gate Entry Date',
            'FiscalYear': 'Fiscal Year',
            'TransporterCode': 'Transporter Code',
            'TransporterName': 'Transporter Name',
            'DriverName': 'Driver Name',
            'DriverPhoneNumber': 'Driver Phone Number',
            'LRGCNumber': 'LR/GC Number',
            'TruckCapacity': 'Truck Capacity',
            'TareWeight': 'Tare Weight',
            'GrossWeight': 'Gross Weight',
            'NetWeght': 'Net Weight'
          };
          
          const friendlyFieldName = fieldMap[fieldName] || fieldName.replace(/([A-Z])/g, ' $1').trim();
          return `${friendlyFieldName} has invalid value '${invalidValue}'. Please check and correct it.`;
        }
      },
      {
        // Required field errors
        regex: /Property '(\w+)' is required|mandatory field '(\w+)'/i,
        format: (match) => {
          const fieldName = match[1] || match[2];
          return `${fieldName.replace(/([A-Z])/g, ' $1').trim()} is required. Please provide a value.`;
        }
      },
      {
        // Duplicate key errors
        regex: /duplicate.*key|already exists|unique constraint/i,
        format: () => 'This record already exists in the system. Please check your data.'
      },
      {
        // Type mismatch errors
        regex: /type mismatch|invalid type|cannot convert/i,
        format: () => 'Invalid data type provided. Please check that all fields have the correct format.'
      },
      {
        // Date format errors
        regex: /invalid date|date format|cannot parse date/i,
        format: () => 'Invalid date format. Please use the correct date format (YYYY-MM-DD).'
      },
      {
        // Numeric validation errors
        regex: /invalid numeric|not a number|numeric overflow/i,
        format: () => 'Invalid number format. Please enter a valid numeric value.'
      }
    ];

    // Try to match patterns
    for (const pattern of patterns) {
      const match = message.match(pattern.regex);
      if (match) {
        return pattern.format(match);
      }
    }

    // If no pattern matches but we have a clean message, return it
    if (message && message.length < 200 && !message.includes('{')) {
      return message;
    }

    // Default fallback message
    return 'An error occurred while processing your request. Please check your input and try again.';
    
  } catch (parseError) {
    console.error('Error parsing SAP error:', parseError);
    return 'An unexpected error occurred. Please contact support if the issue persists.';
  }
}

// backend/server.js or routes file

app.get('/api/po-suggestions', async (req, res) => {
  const query = req.query.query || '';
  const limit = parseInt(req.query.limit) || 10;

  if (!query || query.length < 1) {
    return res.json({ items: [] });
  }

  try {
    let sapPath;
    if (query.length <= 10) {
      sapPath = `/PurchaseOrder?$filter=startswith(PurchaseOrder, '${query}')&$top=${limit}&$select=PurchaseOrder,Supplier,PurchaseOrderDate&$format=json`;
    } else {
      sapPath = `/PurchaseOrder?$filter=substringof('${query}', PurchaseOrder) eq true&$top=${limit}&$select=PurchaseOrder,Supplier,PurchaseOrderDate&$format=json`;
    }

    console.log('SAP Query:', sapPath);
    const response = await sapAxiosPO.get(sapPath);

    const suggestions = response.data.value.map(po => ({
      PurchaseOrder: po.PurchaseOrder,
      Supplier: po.Supplier,
      PurchaseOrderDate: po.PurchaseOrderDate
    }));

    res.json({ items: suggestions });
  } catch (error) {
    // Add this for better debugging:
    console.error('Error fetching PO suggestions:', error?.response?.data || error.message || error);
    res.status(500).json({ error: 'Failed to fetch PO suggestions', details: error?.response?.data || error.message || error });
  }
});

app.get('/api/purchaseorder/:poNumber', async (req, res) => {
  const poNumber = req.params.poNumber;
  try {
    const headerPath = `/PurchaseOrder?$filter=PurchaseOrder eq '${poNumber}'&$top=1&$format=json`;
    const itemPath = `/PurchaseOrderItem?$filter=PurchaseOrder eq '${poNumber}'&$format=json`;
    const rfidPath = `https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_RFID_PURCHASE_CDS/YY1_RFID_PURCHASE?$filter=PurchaseOrder eq '${poNumber}'&$format=json`;

    const [headerResponse, itemResponse, rfidResponse] = await Promise.all([
      sapAxiosPO.get(headerPath),
      sapAxiosPO.get(itemPath),
      sapAxios.get(rfidPath, {
        auth: {
          username: SAP_USER,
          password: SAP_PASS,
        },
      })
    ]);

    const headerData = headerResponse.data.value?.[0] || {};
    const poItems = itemResponse.data.value || [];
    const rfidItems = rfidResponse?.data?.d?.results || [];

    const descByPoItem = new Map();
    const descByMaterial = new Map();

    rfidItems.forEach((row) => {
      const poItem = String(row?.PurchaseOrderItem || '').trim();
      const material = String(row?.Material || '').trim();
      const productDescription = String(row?.ProductDescription || row?.['d:ProductDescription'] || '').trim();

      if (poItem && productDescription && !descByPoItem.has(poItem)) {
        descByPoItem.set(poItem, productDescription);
      }
      if (material && productDescription && !descByMaterial.has(material)) {
        descByMaterial.set(material, productDescription);
      }
    });

    const items = poItems.map((item) => {
      const poItem = String(item?.PurchaseOrderItem || '').trim();
      const material = String(item?.Material || '').trim();

      const productDescription =
        descByPoItem.get(poItem) ||
        descByMaterial.get(material) ||
        item?.ProductDescription ||
        item?.PurchaseOrderItemText ||
        '';

      return {
        ...item,
        ProductDescription: productDescription,
      };
    });

    res.json({
      ...headerData,
      items: items
    });
  } catch (error) {
    console.error('Error fetching PO and items:', error);
    res.status(500).json({ error: 'Failed to fetch PO and items' });
  }
});


// Get PO details by SupplierRespSalesPersonName (header first, then items)
app.get('/api/po-permitnumber/:permitnumber', async (req, res) => {
  const permitnumber = req.params.permitnumber;
  try {
    // 1. Get header by SupplierRespSalesPersonName
    const headerPath = `/PurchaseOrderItem?$filter=YY1_PERMITNUMBER_PDI eq '${permitnumber}'&$top=1&$format=json`;
    const headerResponse = await sapAxiosPO.get(headerPath);
    const headerData = headerResponse.data.value?.[0];
    if (!headerData || !headerData.PurchaseOrder) {
      return res.status(404).json({ error: 'No PO found for given salesPersonName' });
    }
    // 2. Now get line items by PO number
    const poNumToUse = headerData.PurchaseOrder;
    const itemPath = `/PurchaseOrderItem?$filter=PurchaseOrder eq '${poNumToUse}'&$format=json`;
    const itemResponse = await sapAxiosPO.get(itemPath);
    const items = itemResponse.data.value || [];
    return res.json({ ...headerData, items });
  } catch (error) {
    // Try to extract SAP error message if available
    let sapErrorMsg = error?.response?.data?.error?.error?.message?.value
      || error?.response?.data?.error?.message?.value
      || error?.response?.data?.error?.message
      || error?.response?.data?.error
      || error?.message
      || 'Failed to fetch PO and items by salesPersonName';
    console.error('Error fetching PO by salesPersonName:', sapErrorMsg);
    res.status(500).json({ error: sapErrorMsg });
  }
});


app.post('/api/user-credentials', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    const path = `/YY1_USERACCESS?$filter=UserName eq '${username}' and Password eq '${password}'`;
    const response = await sapAxiosUserAccess.get(path, {
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    });
    let results = [];
    if (response.data && response.data.value) {
      results = response.data.value;
    } else if (response.data && response.data.d && response.data.d.results) {
      results = response.data.d.results;
    } else if (response.data && response.data.d) {
      results = [response.data.d];
    } else {
      results = response.data || [];
    }
    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Return user info (never return password)
    const { UserName, RoleCode, ModuleWise } = results[0];
    return res.json({ success: true, user: { UserName, RoleCode, ModuleWise } });
  } catch (error) {
    console.error('User credential check error:', error);
    return res.status(500).json({ error: 'Failed to check credentials' });
  }
});

//Sales Order Details
// GET /api/salesorders?search=12
app.get('/api/salesorder/:soNumber', async (req, res) => {
  const soNumber = req.params.soNumber;
  try {
    // Expand items using $expand=to_Item
    const path = `/A_SalesOrder('${soNumber}')?$expand=to_Item&$format=json`;
    const resp = await sapAxiosSO.get(path);
    const so = resp.data?.d || {};
    // Flatten items
    const items = so.to_Item?.results || [];
    res.json({
      SalesDocument: so.SalesOrder,
      ...so,
      items
    });
  } catch (err) {
    console.error('SO fetch error', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch sales order' });
  }
});


// GET /api/salesorders?search=12
app.get('/api/salesorders', async (req, res) => {
  const search = (req.query.search || '').trim();
  if (!search) {
    return res.status(400).json({ error: 'Missing search parameter' });
  }
  try {
    // 1. Fetch SO headers matching the search
    const filter = `substringof('${search}',SalesOrder)`;
    const headerPath = `/A_SalesOrder?$filter=${filter}&$top=10&$format=json`;
    const headerResp = await sapAxiosSO.get(headerPath);
    const headers = headerResp.data?.d?.results || [];

    // 2. For each SO, fetch its line items
    // Collect all SO numbers
    const soNumbers = headers.map(h => h.SalesOrder);
    if (soNumbers.length === 0) return res.json([]);

    // Fetch all line items for these SOs in one call (OData V2: use 'or' in filter)
    const itemFilter = soNumbers.map(so => `SalesOrder eq '${so}'`).join(' or ');
    const itemPath = `/A_SalesOrderItem?$filter=${encodeURIComponent(itemFilter)}&$format=json`;
    const itemResp = await sapAxiosSO.get(itemPath);
    const items = itemResp.data?.d?.results || [];

    // 3. Group items by SO number
    const itemsBySO = {};
    items.forEach(item => {
      if (!itemsBySO[item.SalesOrder]) itemsBySO[item.SalesOrder] = [];
      itemsBySO[item.SalesOrder].push(item);
    });

    // 4. Build response: for each SO, include header fields and line items
    const result = headers.map(h => ({
      SalesDocument: h.SalesOrder,
      Customer: h.SoldToParty,
      CustomerName: h.SoldToPartyName,
      // Add more header fields if needed
      items: (itemsBySO[h.SalesOrder] || []).map(li => ({
      Material: li.Material,
      MaterialDescription: li.SalesOrderItemText,
      BalanceQty: li.ConfdDelivQtyInOrderQtyUnit, // or the correct field for balance qty
        // Add more line item fields if needed
      }))
    }));

    res.json(result);
  } catch (err) {
    console.error('SO suggest error', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch SO suggestions' });
  }
});

// Fetch CSRF token for Outbound Delivery OData service
async function fetchCsrfTokenOutboundDelivery() {
  try {
    const res = await sapAxiosOBD.get('/', {
      headers: { 'x-csrf-token': 'Fetch' },
      validateStatus: () => true,
    });
    const token = res.headers['x-csrf-token'];
    const setCookie = res.headers['set-cookie'] || res.headers['Set-Cookie'] || [];
    const cookies = Array.isArray(setCookie)
      ? setCookie
          .map(c => {
            try {
              const parsed = cookie.parse(c);
              return Object.entries(parsed).map(([k, v]) => `${k}=${v}`).join('; ');
            } catch (e) {
              return c.split(';')[0];
            }
          })
          .join('; ')
      : (setCookie || '').toString();
    return { token, cookies };
  } catch (err) {
    console.error('fetchCsrfTokenOutboundDelivery error', err?.response?.status, err?.message);
    throw err;
  }
}

app.get('/api/sodetails', async (req, res) => {
  const search = (req.query.search || '').trim();
  if (!search) {
    return res.status(400).json({ error: 'Missing search parameter' });
  }
 
  try {
    // 1. Fetch SO headers matching the search (partial match, top 25)
    const filter = `substringof('${search}',SalesDocument)`;
    const headerPath = `/YY1_RFID_SO?$filter=${filter}&$top=25&$format=json`;
    const headerResp = await sapAxiosSOdetails.get(headerPath);
    const headers = headerResp.data?.d?.results || [];
    if (headers.length === 0) return res.json([]);
 
    // 2. Collect all SO numbers
    const soNumbers = headers.map(h => h.SalesDocument);
    if (soNumbers.length === 0) return res.json([]);
 
    // 3. Fetch all line items for these SOs in one call
    const itemFilter = soNumbers.map(so => `SalesDocument eq '${so}'`).join(' or ');
    const itemPath = `/YY1_RFID_SO?$filter=${encodeURIComponent(itemFilter)}&$format=json`;
    const itemResp = await sapAxiosSOdetails.get(itemPath);
    const items = itemResp.data?.d?.results || [];
 
    // 4. Group items by SO number
    const itemsBySO = {};
    items.forEach(item => {
      if (!itemsBySO[item.SalesDocument]) itemsBySO[item.SalesDocument] = [];
      itemsBySO[item.SalesDocument].push(item);
    });
 
    // 5. Build response: for each SO, include header fields and line items
    const result = headers.map(h => ({
      SalesDocument: h.SalesDocument,
      Customer: h.Customer,
      CustomerName: h.CustomerName,
      items: (itemsBySO[h.SalesDocument] || []).map(li => ({
        Material: li.Product,
        MaterialDescription: li.ProductDescription,
        BalanceQty: li.OpenReqdDelivQtyInOrdQtyUnit,
        BalanceQtyUnit: li.OrderQuantity
      }))
    }));
 
    res.json(result);
  } catch (err) {
    console.error('SO details error', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch SO details' });
  }
});


app.post('/api/materialoutward-full', async (req, res) => {
  try {
    const { outboundDelivery, WeightDocument, TareWeight, FiscalYear, TruckNumber, TruckCapancity, LRGCNumber, permitnumber, Remarks } = req.body;
    console.log('Received request for material outward with payload:', req.body);
    const path = `/YY1_GATEINWARD_OUTWARDDETA?$filter=GateEntryNumber eq '${WeightDocument.GateEntryNumber}'&$format=json`;
    const gateEntryResp = await sapAxios.get(path);
    const gateEntries = gateEntryResp.data?.d?.results || [];
    if (gateEntries.length === 0) {
      return res.status(404).json({ success: false, error: 'No gate entry found with the provided GateEntryNumber' });
    }

    //const { token: weightToken, cookies: weightCookies } = await fetchCsrfTokenWeight();
    const weightget = await sapAxiosWeight.get(
    `/YY1_CAPTURINGWEIGHTDETAILS?$filter=GateEntryNumber eq '${WeightDocument.GateEntryNumber}'&$format=json`
    );
    const weightResults = weightget.data?.d?.results || [];

const weight = weightResults[0];

// ✅ SAFE CHECK
if (weight && weight.GateEntryNumber === WeightDocument.GateEntryNumber && weight.Status === 'Success') {
  return res.status(400).json({
    success: false,
    error: 'Weighment already created for this Gate Entry'
  });
}

    if (gateEntries.Status === 'Cancelled') {
      return res.status(400).json({ success: false, error: 'The gate entry has been cancelled and cannot be processed.' });
    }

    if (gateEntries.GateEntryNumber === WeightDocument.GateEntryNumber ){
      return res.status(400).json({ success: false, error: 'The gate entry number already exists in the system. Please check and provide a unique gate entry number.' });
    }

  if (WeightDocument.GateEntryNumber === null || WeightDocument.GateEntryNumber === undefined || WeightDocument.GateEntryNumber === '')
      {
      return res.status(400).json({ success: false, error: 'Gate entry number is missing for the gate entry.' });
    }
    if (WeightDocument.TareWeight === null || WeightDocument.TareWeight === undefined || WeightDocument.TareWeight === '' || WeightDocument.TareWeight === '0')
      {
      return res.status(400).json({ success: false, error: 'Tare weight is missing for the gate entry.' });
    }
    if (WeightDocument.TruckCapacity === null || WeightDocument.TruckCapacity === undefined || WeightDocument.TruckCapacity === '' || WeightDocument.TruckCapacity === '0')
      {
      return res.status(400).json({ success: false, error: 'Truck capacity is missing for the gate entry.' });
    }
    //  if (WeightDocument.PermitNumber === null || WeightDocument.PermitNumber === undefined || WeightDocument.PermitNumber === '') {
    //   return res.status(400).json({ success: false, error: 'Permit number is missing for the gate entry.' });
    // }
    if (WeightDocument.LRGCNumber === null || WeightDocument.LRGCNumber === undefined || WeightDocument.LRGCNumber === '') {
      return res.status(400).json({ success: false, error: 'LR/GC number is missing for the gate entry.' });
    }
    //  if (WeightDocument.Remarks === null || WeightDocument.Remarks === undefined || WeightDocument.Remarks === '') {
    //   return res.status(400).json({ success: false, error: 'Remarks is missing for the gate entry.' });
    // }
 
function formatSapODataDate(date) {
  if (!date) return null;

  // If already SAP format → return as is
  if (typeof date === "string" && date.startsWith("/Date(")) {
    return date;
  }

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
    const entry = gateEntries[0];
    console.log('Fetched gate entry from SAP:', entry);
    console.log('Weighment 1 data :', WeightDocument);
    // 1. Create Outbound Delivery
    const outboundDeliveryPayload = {
      YY1_LRNo_DLH: entry.LRGCNumber,
      YY1_GateEntryNo_DLH: entry.GateEntryNumber,
      YY1_LRDate_DLH: formatSapODataDate(entry.GateOutDate),
      YY1_TransporterID_DLH: entry.TransporterCode,
      YY1_TransporterName_DLH: entry.Transporter,
      YY1_TruckNumber_DLH: entry.TruckNumber,
      YY1_GateEntryDate_DLH: formatSapODataDate(entry.GateEntryDate),
      YY1_GateEntryTime_DLH: formatSapTime(entry.InwardTime),
     // YY1_TareWeight_DLH: entry.TareWeight,
      YY1_WeighbridgeDate_DLH: formatSapODataDate(entry.GateOutDate),
      YY1_WeighbridgeTime_DLH: formatSapTime(entry.OutwardTime),
      YY1_TareWeight_DLH: WeightDocument.TareWeight,
      to_DeliveryDocumentItem: {
        results: [
          {
            ReferenceSDDocument: entry.SalesDocument,
            ReferenceSDDocumentItem: entry.PurchaseOrderItem || '00010',
            ActualDeliveryQuantity: WeightDocument.TareWeight,
            DeliveryQuantityUnit: entry.UOM
          }
        ]
      }
    };
    const { token: obdToken, cookies: obdCookies } = await fetchCsrfTokenOutboundDelivery();
    const obdResp = await sapAxiosOBD.post('/A_OutbDeliveryHeader', outboundDeliveryPayload, {
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': obdToken,
        Cookie: obdCookies
      }
    });
    const outboundDeliveryNumber =
      obdResp.data?.d?.DeliveryDocument ||
      obdResp.data?.DeliveryDocument ||
      obdResp.data?.d?.DeliveryNumber ||
      obdResp.data?.DeliveryNumber ||
      null;
    // 2. Assign SAP fields directly to weightInput
    const weightInput = sanitizePayloadForSapServerSide(WeightDocument);
   // weightInput.SerialCode = "3";
    weightInput.OutboundDelivery = outboundDeliveryNumber;
    // Assign SAP fields directly
    weightInput.GateEntryNumber = entry.GateEntryNumber;
    weightInput.TruckNumber = WeightDocument.TruckNumber || entry.TruckNumber;
    weightInput.TruckCapacity = WeightDocument.TruckCapacity || entry.TruckCapacity;
    weightInput.TareWeight = WeightDocument.TareWeight || entry.TareWeight;
    weightInput.GateEntryDate = formatSapODataDate(systemdate);
    weightInput.InwardTime = formatSapTime(systemtime);
    weightInput.VehicleStatus = 'IN';
    weightInput.FiscalYear = entry.FiscalYear;
    weightInput.Customer = entry.Customer;
    weightInput.CustomerName = entry.CustomerName;
   // weightInput.GateOutDate = formatSapODataDate(WeightDocument.GateOutDate || entry.GateOutDate);
    weightInput.TransporterCode = entry.TransporterCode;
    weightInput.LRGCNumber = entry.LRGCNumber;
    weightInput.PurchaseOrderItem = entry.PurchaseOrderItem;
    weightInput.SalesDocument = entry.SalesDocument;
    weightInput.Material = entry.Material;
    weightInput.MaterialDescription = entry.MaterialDescription;
    weightInput.Status = 'Success';
 
    // Generate WeightDocNumber if not present
    if (!weightInput.WeightDocNumber) {
      const prefix = buildPrefixFromYearAndCode(entry.FiscalYear, 3);
      const latest = await getLatestWeightDocNumberFromSap(prefix);
      weightInput.WeightDocNumber = computeNextWeightDocNumber(prefix, latest);
    }

    const { token: weightToken, cookies: weightCookies } = await fetchCsrfTokenWeight();
    const weightResp = await sapAxiosWeight.post('/YY1_CAPTURINGWEIGHTDETAILS', weightInput, {
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': weightToken,
        Cookie: weightCookies,
      },
    });
    const weightDocNumber =
      weightResp.data?.d?.WeightDocNumber ||
      weightResp.data?.WeightDocNumber ||
      null;
    const gateEntryNumber =
      weightResp.data?.d?.GateEntryNumber ||
      weightResp.data?.GateEntryNumber ||
      null;

    // Keep gate-entry header feed in sync with outward tare captured in weight document.
    try {
      const headerUuid =
        entry?.SAP_UUID ||
        entry?.UUID ||
        entry?.Guid ||
        entry?.GUID;

      if (headerUuid && WeightDocument?.TareWeight !== undefined) {
        const { token: headerToken, cookies: headerCookies } = await fetchCsrfToken();
        await sapAxios.patch(
          `/YY1_GATEINWARD_OUTWARDDETA(guid'${headerUuid}')`,
          { TareWeight: String(WeightDocument.TareWeight) },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-csrf-token': headerToken,
              'If-Match': '*',
              Cookie: headerCookies,
            },
            validateStatus: (status) => status < 500,
          }
        );
      }
    } catch (headerPatchErr) {
      console.error(
        '[WARN] Material outward created, but gate header tare sync failed',
        headerPatchErr?.response?.status,
        headerPatchErr?.response?.data || headerPatchErr?.message
      );
    }

    res.json({
      success: true,
      outboundDeliveryNumber,
      weightDocNumber,
      gateEntryNumber
    });
  } catch (err) {
    const friendlyMsg = parseSapErrorToFriendlyMessage(err);
    res.status(500).json({ success: false, error: friendlyMsg });
  }
});
// Fetch CSRF token for Goods Issue OData service
async function fetchCsrfTokenGoodsIssue() {
  try {
    const res = await sapAxiosOBD.get('/', {
      headers: { 'x-csrf-token': 'Fetch' },
      validateStatus: () => true,
    });
    const token = res.headers['x-csrf-token'];
    const setCookie = res.headers['set-cookie'] || res.headers['Set-Cookie'] || [];
    const cookies = Array.isArray(setCookie)
      ? setCookie
          .map(c => {
            try {
              const parsed = cookie.parse(c);
              return Object.entries(parsed).map(([k, v]) => `${k}=${v}`).join('; ');
            } catch (e) {
              return c.split(';')[0];
            }
          })
          .join('; ')
      : (setCookie || '').toString();
    return { token, cookies };
  } catch (err) {
    console.error('fetchCsrfTokenGoodsIssue error', err?.response?.status, err?.message);
    throw err;
  }
}



app.patch('/api/outbounddelivery/:deliveryDocument/items/:itemNumber', async (req, res) => {
 
  const deliveryDocument = req.params.deliveryDocument;
  const itemNumber = req.params.itemNumber;
  console.log("Received PATCH for Outbound Delivery", { deliveryDocument, itemNumber, body: req.body });
 
  const { item, header } = req.body;
 
  if (!item?.ActualDeliveryQuantity) {
    return res.status(400).json({ error: "ActualDeliveryQuantity is required" });
  }
 
  try {
 
    const { token, cookies } = await fetchCsrfTokenOutboundDelivery();
 
    /* -------------------------
       1️⃣ UPDATE ITEM
    -------------------------- */
 
    const itemPath =
      `/A_OutbDeliveryItem(DeliveryDocument='${deliveryDocument}',DeliveryDocumentItem='${itemNumber}')`;
 
    const itemPayload = {
      ActualDeliveryQuantity: item.ActualDeliveryQuantity
    };
 
    if (item.ActualDeliveryQtyUnit) {
      itemPayload.ActualDeliveryQtyUnit = item.ActualDeliveryQtyUnit;
    }
 
    await sapAxiosOBD.patch(itemPath, itemPayload, {
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token,
        'If-Match': '*',
        Cookie: cookies
      }
    });
 
    /* -------------------------
       2️⃣ UPDATE HEADER
    -------------------------- */
 
    if (header) {
 
      const headerPath =
        `/A_OutbDeliveryHeader(DeliveryDocument='${deliveryDocument}')`;
 
      await sapAxiosOBD.patch(headerPath, header, {
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
          'If-Match': '*',
          Cookie: cookies
        }
      });
 
    }
 
    res.json({
      success: true,
      message: "Outbound Delivery Updated"
    });
 
  } catch (err) {
 
    console.error(
      'Outbound Delivery PATCH error',
      err?.response?.data || err.message
    );
 
    res.status(500).json({
      error: err?.response?.data || err.message
    });
 
  }
});

 
 app.post('/api/goodsissue-and-invoice-int', async (req, res) => {
  try {
    const deliveryDocument = req.body.DeliveryDocument;
    if (!deliveryDocument) {
      return res.status(400).json({ error: "DeliveryDocument parameter is required" });
    }
 
    // 1. Post Goods Issue
    const { token, cookies } = await fetchCsrfTokenGoodsIssue();
    const url = `/PostGoodsIssue?DeliveryDocument='${encodeURIComponent(deliveryDocument)}'`;
    const goodsIssueResp = await sapAxiosOBD.post(url, {}, {
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token,
        'If-Match': '*',
        Cookie: cookies
      }
    });
 
    // 2. If successful, create billing document
    if (goodsIssueResp.status === 201 || goodsIssueResp.status === 200) {
      const billingPayload = {
        "_Control": {
          "DefaultBillingDocumentType": "F2",
          "AutomPostingToAcctgIsDisabled": false,
        },
        "_Reference": [
          {
            "SDDocument": deliveryDocument,
            "SDDocumentCategory": "J"
          }
        ]
      };
      const billingUrl = `/BillingDocument/SAP__self.CreateFromSDDocument?DeliveryDocument='${encodeURIComponent(deliveryDocument)}'`;
      const billingResp = await sapAxiosBilling.post(billingUrl, billingPayload, {
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
          'If-Match': '*',
          Cookie: cookies
        }
      });
 
      console.log('Billing response status:', billingResp.status, 'data:', billingResp.data);
      // Extract billing document number from value array if present
      let billingDocumentNumber = undefined;
      if (Array.isArray(billingResp.data?.value) && billingResp.data.value.length > 0) {
        billingDocumentNumber = billingResp.data.value[0].BillingDocument;
      } else if (billingResp.data?.BillingDocument) {
        billingDocumentNumber = billingResp.data.BillingDocument;
      }
      console.log('Billing Document Number from response:', billingDocumentNumber);
 
      // Only continue if billing creation was successful
      if (billingResp.status === 201 || billingResp.status === 200 || billingResp.status === 204) {
        const billingDocNumber = billingDocumentNumber;
        console.log('Billing Document Number:', billingDocNumber);
        if (!billingDocNumber) {
          console.error('Billing document number is missing in response:', billingResp.data);
          return res.status(500).json({
            error: 'Billing document number is missing in SAP response',
            details: billingResp.data
          });
        }
        console.log(`✅ Billing document ${billingDocNumber} created`);
        // Wait for SAP to process the document
        await new Promise(resolve => setTimeout(resolve, 3000));
        // Download PDF (SAP returns XML with base64 PDF)
        try {
          const { XMLParser } = require("fast-xml-parser");
          function findBillingBinary(obj) {
            if (obj == null) return null;
            if (typeof obj === "string") {
              if (obj.trim().startsWith("JVBER")) return obj;
              return null;
            }
            if (typeof obj !== "object") return null;
            for (const key of Object.keys(obj)) {
              const val = obj[key];
              const shortKey = key.includes(":") ? key.split(":").pop() : key;
              if (shortKey === "BillingDocumentBinary") {
                if (typeof val === "string") return val;
                if (val && typeof val === "object") {
                  if ("#text" in val) return val["#text"];
                  if ("text" in val) return val["text"];
                  const s = JSON.stringify(val);
                  if (s && s.includes("JVBER")) {
                    const m = s.match(/JVBER[^\"]*/);
                    if (m) return m[0];
                  }
                }
              }
              const found = findBillingBinary(val);
              if (found) return found;
            }
            return null;
          }
          const pdfUrl = `/GetPDF?BillingDocument='${billingDocNumber}'`;
          const pdfResponse = await sapAxiosBillingPDF.get(pdfUrl, {
            headers: {
              'x-csrf-token': token,
              'Cookie': cookies,
              'Accept': 'application/xml, text/xml, */*'
            },
            timeout: 30000
          });
          const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
          const parsed = parser.parse(pdfResponse.data);
          const base64 = findBillingBinary(parsed);
          if (!base64) {
            console.error("BillingDocumentBinary not found in SAP response. Raw SAP response:\n", pdfResponse.data.substring(0, 1000));
            throw new Error("BillingDocumentBinary not found in SAP response");
          }
          const b64clean = base64.toString().replace(/\s+/g, "");
          const pdfBuffer = Buffer.from(b64clean, "base64");
          // Set response headers for PDF download
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="Billing_${billingDocNumber}.pdf"`);
          res.setHeader('X-Goods-Issue-Number', deliveryDocument || '');
          res.setHeader('X-Billing-Document-Number', billingDocNumber);
          res.setHeader('Access-Control-Expose-Headers', 'X-Goods-Issue-Number, X-Billing-Document-Number');
          console.log('Base64 PDF (first 500 chars):', b64clean.substring(0, 500));
          console.log('PDF buffer length:', pdfBuffer.length);
          if (!pdfBuffer || pdfBuffer.length < 1000) {
            console.error('PDF buffer is too small, likely invalid.');
          }
          // Send PDF buffer directly
          res.send(pdfBuffer);
          // Send PDF as email attachment (non-blocking for client)
          try {
const customerEmail =
  billingResp.data?.value?.[0]?.YY1_SoldtoParty_Email_BDH ||
  billingResp.data?.value?.[0]?.YY1_ShiptoParty_Email_BDH;
 
 
const mailConfig = await getMailConfigFromSAP();
const transporter = nodemailer.createTransport({
  host: mailConfig.host,
  port: mailConfig.port,
  secure: false,
  auth: {
    user: mailConfig.user,
    pass: mailConfig.pass
  },
  tls: {
    rejectUnauthorized: false
  }
});
 
 
await transporter.sendMail({
  from: mailConfig.user, // your client mail
  to: customerEmail, // dynamic customer email
  subject: `Billing Document PDF - ${billingDocNumber}`,
  text: `Please find attached the billing document PDF for Billing Document: ${billingDocNumber}`,
  attachments: [
    {
      filename: `Billing_${billingDocNumber}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }
  ]
});
            console.log('✅ Billing PDF emailed successfully');
          } catch (mailErr) {
            console.error('❌ Failed to send billing PDF email:', mailErr);
          }      
    try {
       // Call your own printer API
    const printResp = await axios.post(
     "http://localhost:4600/api/printer/print",
     {
    pdfBase64: pdfBuffer.toString("base64"),
    fileName: `Billing_${billingDocNumber}.pdf`
     }
     );
       console.log("✅ Billing PDF sent to printer:", printResp.data);
     } catch (printErr) {
     console.error("❌ Failed to print billing PDF:", printErr?.message);
     }
          console.log(`📄 PDF for ${billingDocNumber} downloaded automatically`);
          return;
        } catch (pdfError) {
          console.error(`PDF download failed for ${billingDocNumber}:`, pdfError.message);
          // Fallback: Return JSON response
          if (!res.headersSent) {
            return res.status(201).json({
              success: true,
              billingDocument: billingDocNumber,
              message: 'Billing created but PDF download failed',
              error: pdfError.message || 'PDF download failed',
              goodsIssueNumber: deliveryDocument
            });
          }
        }
      } else {
        return res.status(billingResp.status).json({ error: 'Billing creation failed', details: billingResp.data });
      }
    } else {
      return res.status(goodsIssueResp.status).json({ error: 'Goods issue failed', details: goodsIssueResp.data });
    }
  } catch (err) {
    // Only log serializable error info
    const status = err?.response?.status;
    const data = err?.response?.data;
    const message = err?.message;
    console.error('Goods Issue + Invoice error', status, message, data);
res.status(status || 500).json({
  error: message
});
  }
});
 
app.get('/api/billing-pdf/:billingDocumentNumber', async (req, res) => {
  try {
    const billingDocNumber = req.params.billingDocumentNumber;
    if (!billingDocNumber) {
      return res.status(400).json({ error: "BillingDocumentNumber is required" });
    }
    const { token, cookies } = await fetchCsrfTokenGoodsIssue();
    const { XMLParser } = require("fast-xml-parser");
    function findBillingBinary(obj) {
      if (obj == null) return null;
      if (typeof obj === "string") {
        if (obj.trim().startsWith("JVBER")) return obj;
        return null;
      }
      if (typeof obj !== "object") return null;
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        const shortKey = key.includes(":") ? key.split(":").pop() : key;
        if (shortKey === "BillingDocumentBinary") {
          if (typeof val === "string") return val;
          if (val && typeof val === "object") {
            if ("#text" in val) return val["#text"];
            if ("text" in val) return val["text"];
            const s = JSON.stringify(val);
            if (s && s.includes("JVBER")) {
              const m = s.match(/JVBER[^\"]*/);
              if (m) return m[0];
            }
          }
        }
        const found = findBillingBinary(val);
        if (found) return found;
      }
      return null;
    }
 
    const pdfUrl = `/GetPDF?BillingDocument='${billingDocNumber}'`;
    const pdfResponse = await sapAxiosBillingPDF.get(pdfUrl, {
      headers: {
        'x-csrf-token': token,
        'Cookie': cookies,
        'Accept': 'application/xml, text/xml, */*'
      },
      timeout: 30000
    });
 
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const parsed = parser.parse(pdfResponse.data);
    const base64 = findBillingBinary(parsed);
    if (!base64) {
      return res.status(404).json({ error: "BillingDocumentBinary not found in SAP response" });
    }
    const b64clean = base64.toString().replace(/\s+/g, "");
    const pdfBuffer = Buffer.from(b64clean, "base64");
 
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Billing_${billingDocNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Billing PDF download error:', err?.message);
    res.status(500).json({ error: err?.message || 'Failed to download billing PDF' });
  }
});
 
 
 
 
app.post("/api/goodsissue-and-invoice", async (req, res) => {
  try {
 
    const {
      GateEntryNumber,
      WeighmentUpdate,
      OutboundDeliveryUpdate,
      GoodsIssue
    } = req.body;
     if (GateEntryNumber === null || GateEntryNumber === undefined || GateEntryNumber === '') {
      return res.status(400).json({ error: 'GateEntryNumber is required in the request body Weighment2' });
    }
    if (OutboundDeliveryUpdate.DeliveryDocument === null || OutboundDeliveryUpdate.DeliveryDocument === undefined || OutboundDeliveryUpdate.DeliveryDocument === '') {
      return res.status(400).json({ error: 'DeliveryDocument is required in the request body' });
    }
    if (WeighmentUpdate.NetWeight === null || WeighmentUpdate.NetWeight === undefined || WeighmentUpdate.NetWeight.length === 0) {
      return res.status(400).json({ error: 'NetWeight is required in the request body' });  }

    if (WeighmentUpdate.Status === 'Cancelled' ) {
      return res.status(400).json({ error: 'Weighment status is cancelled' });  }

    if (WeighmentUpdate.GrossWeight === null || WeighmentUpdate.GrossWeight === undefined || WeighmentUpdate.GrossWeight.length === 0) {
      return res.status(400).json({ error: 'GrossWeight is required in the request body' });  }
    if (Number(WeighmentUpdate.NetWeight) < 0.100) {
     return res.status(400).json({error: "NetWeight should be greater than 99 KG",
      DeliveryDocument: OutboundDeliveryUpdate.DeliveryDocument    });   }
 
    if (Number(WeighmentUpdate?.NetWeight) < 0.100) {
 
     const { token, cookies } = await fetchCsrfTokenOutboundDelivery();
 
     const deletePath = `/A_OutbDeliveryHeader('${OutboundDeliveryUpdate.DeliveryDocument}')`;
 
      await sapAxiosOBD.delete(deletePath, {
      headers: {
       "x-csrf-token": token,
       "If-Match": "*",
       Cookie: cookies
      }
      });
 
      return res.status(400).json({
       message: "NetWeight below 99 KG. Outbound Delivery Deleted",
       DeliveryDocument: OutboundDeliveryUpdate.DeliveryDocument
       });
      }
 
    let result = {
      weighment: null,
      outboundDelivery: null,
      goodsIssue: null,
      billing: null
    };
 
    // Always fetch weighment data if GateEntryNumber is present
    let getResp = null;
    let uuid = null;
    if (GateEntryNumber) {
      getResp = await sapAxiosWeight.get(
        `/YY1_CAPTURINGWEIGHTDETAILS?$filter=GateEntryNumber eq '${GateEntryNumber}'&$format=json`
      );
      uuid = getResp.data?.d?.results?.[0]?.SAP_UUID;
    }
      console.log(getResp?.data?.d?.results?.[0], "Weighement response getResp data");
 
    /* ==========================
       1️⃣ UPDATE WEIGHMENT
    ========================== */
    //  WeighmentUpdate.VehicleStatus = "OUT";
    //  WeighmentUpdate.OutwardTime = formatSapTime(systemtime);
    //  WeighmentUpdate.OutEntryDate = formatSapODataDate(systemdate);

    // if (GateEntryNumber && WeighmentUpdate) {
    //   if (!uuid) return res.status(404).json({ error: "Weighment not found" });
    //   const { token, cookies } = await fetchCsrfTokenWeight();
    //   await sapAxiosWeight.patch(
    //     `/YY1_CAPTURINGWEIGHTDETAILS(guid'${uuid}')`,
    //     WeighmentUpdate,
    //     {
    //       headers: {
    //         "Content-Type": "application/json",
    //         "x-csrf-token": token,
    //         "If-Match": "*",
    //         Cookie: cookies
    //       }
    //     }
    //   );
    //   result.weighment = "Updated";
    // }
const now1 = new Date();

const systemdate1 = now1.toISOString().split("T")[0];
const systemtime1 = now1.toTimeString().split(" ")[0];

if (!WeighmentUpdate) {
  WeighmentUpdate = {};
}

// ✅ use correct field names
WeighmentUpdate.VehicleStatus = "OUT";
WeighmentUpdate.OutwardTime = formatSapTime(systemtime1);
WeighmentUpdate.GateOutDate = formatSapODataDate(systemdate1);

if (GateEntryNumber && WeighmentUpdate) {
  if (!uuid) return res.status(404).json({ error: "Weighment not found" });

  const { token, cookies } = await fetchCsrfTokenWeight();

  await sapAxiosWeight.patch(
    `/YY1_CAPTURINGWEIGHTDETAILS(guid'${uuid}')`,
    WeighmentUpdate,
    {
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": token,
        "If-Match": "*",
        Cookie: cookies
      }
    }
  );

  result.weighment = "Updated";
}
 
    /* ==========================
       2️⃣ UPDATE OUTBOUND DELIVERY ITEMS
    ========================== */
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
  const [hh, mm, ss] = timeStr.split(":");
  return `PT${hh}H${mm}M${ss}S`;
}

const now = new Date();
const systemdate = now.toISOString().split("T")[0];
const systemtime = now.toTimeString().split(" ")[0];
    if (OutboundDeliveryUpdate?.DeliveryDocument && OutboundDeliveryUpdate?.Items?.length) {
            for (const item of OutboundDeliveryUpdate.Items) {
            const { token, cookies } = await fetchCsrfTokenOutboundDelivery();
            // PATCH Outbound Delivery Header with custom fields
            const headerPath = `/A_OutbDeliveryHeader(DeliveryDocument='${OutboundDeliveryUpdate.DeliveryDocument}')`;
            const headerPayload = {
              YY1_WeighbridgeDate_DLH: formatSapODataDate(getResp?.data?.d?.results?.[0]?.GateOutDate),
              YY1_WeighbridgeTime_DLH: formatSapTime(getResp?.data?.d?.results?.[0]?.OutwardTime),
              YY1_WeighbridgeNo_DLH: String(getResp?.data?.d?.results?.[0]?.WeightDocNumber || '').trim(),
              YY1_GrossWeight_DLH: item.GrossWeight,
              YY1_PGIDate_DLH: formatSapODataDate(systemdate),
              YY1_PGITime_DLH: formatSapTime(systemtime),
              YY1_LRDate_DLH: formatSapODataDate(systemdate),
              // Add other custom header fields as needed
            };
            await sapAxiosOBD.patch(headerPath, headerPayload, {
              headers: {
                "Content-Type": "application/json",
                "x-csrf-token": token,
                "If-Match": "*",
                Cookie: cookies
              }
            });
 
        const path = `/A_OutbDeliveryItem(DeliveryDocument='${OutboundDeliveryUpdate.DeliveryDocument}',DeliveryDocumentItem='${10}')`;
        const payload = {
          ActualDeliveryQuantity: item.NetWeight,
        };
 
        await sapAxiosOBD.patch(path, payload, {
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": token,
            "If-Match": "*",
            Cookie: cookies
          }
        });
      }
      result.outboundDelivery = "Items Updated";
    }
 
   
 
    /* ==========================
       3️⃣ POST GOODS ISSUE
    ========================== */
    if (GoodsIssue?.DeliveryDocument) {
 
      const { token, cookies } = await fetchCsrfTokenGoodsIssue();
 
      const giResp = await sapAxiosOBD.post(
        `/PostGoodsIssue?DeliveryDocument='${encodeURIComponent(GoodsIssue.DeliveryDocument)}'`,
        {},
        {
          headers: {
            "x-csrf-token": token,
            "If-Match": "*",
            Cookie: cookies
          }
        }
      );
 
      if (giResp.status !== 200 && giResp.status !== 201) {
        return res.status(400).json({ error: "Goods Issue Failed" });
      }
 
      result.goodsIssue = "Posted";
 
      /* ==========================
         4️⃣ CREATE BILLING
      ========================== */
 
      const billingPayload = {
        "_Control": {
          "DefaultBillingDocumentType": "F2",
          "AutomPostingToAcctgIsDisabled": false
        },
        "_Reference": [
          {
            "SDDocument": GoodsIssue.DeliveryDocument,
            "SDDocumentCategory": "J"
          }
        ]
      };
 
      const billingResp = await sapAxiosBilling.post(
        `/BillingDocument/SAP__self.CreateFromSDDocument?DeliveryDocument='${encodeURIComponent(GoodsIssue.DeliveryDocument)}'`,
        billingPayload,
        {
          headers: {
            "x-csrf-token": token,
            "If-Match": "*",
            Cookie: cookies
          }
        }
      );
 
      result.billing =
        billingResp.data?.value?.[0]?.BillingDocument ||
        billingResp.data?.BillingDocument;
   
 
    console.log('RFID Billing document details:', billingResp?.data);
          // Only continue if billing creation was successful
      if (billingResp.status === 201 || billingResp.status === 200 || billingResp.status === 204) {
        const billingDocNumber = result.billing;
        console.log('Billing Document Number:', billingDocNumber);
        if (!billingDocNumber) {
          console.error('Billing document number is missing in response:', billingResp.data);
          return res.status(500).json({
            error: 'Billing document number is missing in SAP response',
            details: billingResp.data
          });
        }
        console.log(`✅ Billing document ${billingDocNumber} created`);
        // Respond immediately with billing document number
        res.status(201).json({
          success: true,
          billingDocument: billingDocNumber,
          message: 'Billing created',
          goodsIssueNumber: GoodsIssue.DeliveryDocument
        });
        // In background, download PDF and send email
        (async () => {
          try {
            await new Promise(resolve => setTimeout(resolve, 3000));
            const { XMLParser } = require("fast-xml-parser");
            function findBillingBinary(obj) {
              if (obj == null) return null;
              if (typeof obj === "string") {
                if (obj.trim().startsWith("JVBER")) return obj;
                return null;
              }
              if (typeof obj !== "object") return null;
              for (const key of Object.keys(obj)) {
                const val = obj[key];
                const shortKey = key.includes(":") ? key.split(":").pop() : key;
                if (shortKey === "BillingDocumentBinary") {
                  if (typeof val === "string") return val;
                  if (val && typeof val === "object") {
                    if ("#text" in val) return val["#text"];
                    if ("text" in val) return val["text"];
                    const s = JSON.stringify(val);
                    if (s && s.includes("JVBER")) {
                      const m = s.match(/JVBER[^"]*/);
                      if (m) return m[0];
                    }
                  }
                }
                const found = findBillingBinary(val);
                if (found) return found;
              }
              return null;
            }
            const pdfUrl = `/GetPDF?BillingDocument='${billingDocNumber}'`;
            const pdfResponse = await sapAxiosBillingPDF.get(pdfUrl, {
              headers: {
                'x-csrf-token': token,
                'Cookie': cookies,
                'Accept': 'application/xml, text/xml, */*'
              },
              timeout: 30000
            });
            const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
            const parsed = parser.parse(pdfResponse.data);
            const base64 = findBillingBinary(parsed);
            if (!base64) {
              console.error("BillingDocumentBinary not found in SAP response. Raw SAP response:\n", pdfResponse.data.substring(0, 1000));
              throw new Error("BillingDocumentBinary not found in SAP response");
            }
            const b64clean = base64.toString().replace(/\s+/g, "");
            const pdfBuffer = Buffer.from(b64clean, "base64");
            // Send PDF as email attachment
            try {
              const customerEmail =
                billingResp.data?.value?.[0]?.YY1_SoldtoParty_Email_BDH ||
                billingResp.data?.value?.[0]?.YY1_ShiptoParty_Email_BDH;
              const mailConfig = await getMailConfigFromSAP();
              const transporter = nodemailer.createTransport({
                host: mailConfig.host,
                port: mailConfig.port,
                secure: false,
                auth: {
                  user: mailConfig.user,
                  pass: mailConfig.pass
                },
                tls: {
                  rejectUnauthorized: false
                }
              });
              await transporter.sendMail({
                from: mailConfig.user,
                to: customerEmail,
                subject: `Billing Document PDF - ${billingDocNumber}`,
                text: `Please find attached the billing document PDF for Billing Document: ${billingDocNumber}`,
                attachments: [
                  {
                    filename: `Billing_${billingDocNumber}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                  }
                ]
              });
              console.log('✅ Billing PDF emailed successfully');
            } catch (mailErr) {
              console.error('❌ Failed to send billing PDF email:', mailErr);
            }
            console.log(`📄 PDF for ${billingDocNumber} processed in background`);
// Additionally, send PDF to printer API
       try {
       // Call your own printer API
    const printResp = await axios.post(
     "http://localhost:4600/api/printer/print",
     {
    pdfBase64: pdfBuffer.toString("base64"),
    fileName: `Billing_${billingDocNumber}.pdf`
     }
     );
       console.log("✅ Billing PDF sent to printer:", printResp.data);
     } catch (printErr) {
     console.error("❌ Failed to print billing PDF:", printErr?.message);
     }

     (async () => {
  try {
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Existing billing PDF logic...

    // ✅ ADD THIS HERE (WEIGHMENT PRINT)
    const weighmentData = getResp?.data?.d?.results?.[0];

    console.log("Weighment data:", weighmentData);

    const slipBuffer = await generateWeighmentSlip({
      WeightDocNumber: weighmentData.WeightDocNumber,
      GateEntryNumber: weighmentData.GateEntryNumber,
      VehicleNumber: weighmentData.VehicleNumber,
      Party: weighmentData.Party,
      Transporter: weighmentData.Transporter,
      Material: weighmentData.MaterialDescription,
      GrossWeight: weighmentData.GrossWeight,
      TareWeight: weighmentData.TareWeight,
      NetWeight: weighmentData.NetWeight,
      InwardTime: formatSapTime(weighmentData.InwardTime),
      OutwardTime: formatSapTime(weighmentData.OutwardTime)
    });

    await axios.post("http://localhost:4600/api/printer/print", {
      pdfBase64: slipBuffer.toString("base64"),
      fileName: `Weighment_${weighmentData.GateEntryNumber}.pdf`
    });

    console.log("✅ Weighment slip printed");

  } catch (err) {
    console.error("Weighment print error:", err.message);
  }
})();
          } catch (pdfError) {
            console.error(`PDF download/email failed for ${billingDocNumber}:`, pdfError.message);
          }
        })();
        return;
      }
    }

    return res.json({
      success: true,
      result
    });
 
  } catch (err) {
    console.error("Combined Flow Error:", err?.response?.data || err.message);
    return res.status(500).json({
      error: err?.response?.data?.error?.message?.value
  || err.message
    });
  }
});
 
//const PDFDocument = require("pdfkit");

function generateWeighmentSlip(data) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 30 });
    const buffers = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));

    // HEADER
    doc.fontSize(16).text("Minera Steel & Power Pvt Ltd", { align: "center" });
    doc.fontSize(10).text("Factory Address: Yerabanahalli Village Sandur taluk Ballari", { align: "center" });
    doc.moveDown();

    doc.fontSize(14).text("Weighbridge Ticket", { align: "center" });
    doc.moveDown();

    // DATE & TIME
    doc.fontSize(10);
    doc.text(`Print Date: ${new Date().toLocaleDateString()}`);
    doc.text(`Time: ${new Date().toLocaleTimeString()}`);
    doc.moveDown();

    doc.text("------------------------------------------------------------");

    // LEFT SIDE
    doc.text(`Weighment No : ${data.WeightDocNumber}`);
    doc.text(`Gate Entry No: ${data.GateEntryNumber}`);
    doc.text(`Truck Number : ${data.VehicleNumber}`);
    doc.text(`Party        : ${data.Party}`);
    doc.text(`Transporter  : ${data.Transporter}`);

    doc.moveDown();

    // RIGHT SIDE
    doc.text(`Product      : ${data.Material}`);
    doc.text(`Gross Weight : ${data.GrossWeight} t`);
    doc.text(`Tare Weight  : ${data.TareWeight} t`);
    doc.text(`Net Weight   : ${data.NetWeight} t`);

    doc.moveDown();

    // TIME DETAILS
    doc.text(`In Time  : ${data.InwardTime}`);
    doc.text(`Out Time : ${data.OutwardTime}`);

    doc.moveDown();

    doc.text("------------------------------------------------------------");
    doc.text("Note: This vehicle weighment includes driver weight");

    doc.end();
  });
}

// // GET /api/material-trucks?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
//   app.get("/api/material-trucks", async (req, res) => {
//   let { fromDate, toDate } = req.query;

//   // ✅ Default = TODAY
//   if (!fromDate || !toDate) {
//     const today = new Date().toISOString().split("T")[0];
//     fromDate = today;
//     toDate = today;
//   }

//   const filter =
//     `GateEntryDate ge datetime'${fromDate}T00:00:00' and ` +
//     `GateEntryDate le datetime'${toDate}T23:59:59'`;

//   try {
//     const resp = await sapAxiosLiveDashBoard.get(
//       `/YY1_LiveDashBoard?$filter=${encodeURIComponent(filter)}&$format=json`
//     );

//     const data = resp.data.d.results || [];

//     res.json({
//       sales: processData(data, "O"),   // SD
//       inward: processData(data, "I")   // MM
//     });

//   } catch (err) {
//     console.error("SAP ERROR:", err.response?.data || err.message);
//     res.status(500).json(err.response?.data || err.message);
//   }
// });

// /* ================================
//    DATA PROCESSING
// ================================ */
// function processData(data, indicator) {
//   const map = {};
//   let totalIn = 0, totalOut = 0, totalWeight = 0;

//   data
//     .filter(d => d.Indicators === indicator)
//     .forEach(item => {
//       const material = item.MaterialDescription || "No Description";

//       if (!map[material]) {
//         map[material] = {
//           material,
//           in: 0,
//           out: 0,
//           netWeight: 0
//         };
//       }

//       if (item.VehicleStatus === "IN") {
//         map[material].in++;
//         totalIn++;
//       }

//       if (item.VehicleStatus === "OUT") {
//         map[material].out++;
//         totalOut++;
//       }

//       const weight = Number(item.NetWeight || 0);
//       map[material].netWeight += weight;
//       totalWeight += weight;
//     });

//   return {
//     rows: Object.values(map).map(m => ({
//       ...m,
//       pending:  Math.max(m.in - m.out, 0)
//     })),
//     totals: {
//       in: totalIn,
//       out: totalOut,
//       pending: Math.max(totalIn - totalOut, 0),
//       netWeight: totalWeight.toFixed(2)
//     }
//   };
// }


// GET /api/material-trucks
app.get("/api/material-trucks", async (req, res) => {
  
  try {
    // SAP works in UTC → always use ISO date
    const today = new Date().toISOString().slice(0, 10);

    // Fetch ALL records till today
    const filter = `GateEntryDate le datetime'${today}T23:59:59'`;
    console.log('Material Trucks Filter:', filter);

    const resp = await sapAxiosLiveDashBoard.get(
      `/YY1_LiveDashBoard?$filter=${encodeURIComponent(filter)}&$format=json`
    );

    const data = resp.data?.d?.results || [];

    res.json({
      sales: processData(data, "O", today),   // SD
      inward: processData(data, "I", today)   // MM
    });

  } catch (err) {
    console.error("SAP ERROR:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch material trucks data" });
  }
});

function sapDateToYMD(sapDate) {
  if (!sapDate) return null;

  // Handles /Date(1766361600000)/
  const match = sapDate.match(/\d+/);
  if (!match) return null;

  const date = new Date(Number(match[0]));
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

/* ================================
   DATA PROCESSING – FINAL LOGIC
================================ */
function processData(data, indicator, today) {
  const map = {};
  let totalIn = 0;
  let totalOut = 0;
  let totalWeight = 0;

  data
    .filter(item => item.Indicators === indicator)
    .forEach(item => {

      const material = item.MaterialDescription || "No Description";

      // Entry date (IN)
      const entryDate = sapDateToYMD(item.GateEntryDate);

      // OUT date → SAP usually updates one of these
      const outDate = sapDateToYMD(item.GateOutDate);
      console.log('EntryDate:', entryDate, 'OutDate:', outDate, 'Today:', today); 

      if (!map[material]) {
        map[material] = {
          material,
          in: 0,
          out: 0,
          netWeight: 0
        };
      }

      const weight = Number(item.NetWeight || 0);

      /* =========================
         IN LOGIC (ALL DAYS)
      ========================= */
      if (item.VehicleStatus === "IN") {
        map[material].in++;
        map[material].netWeight += weight;

        totalIn++;
        totalWeight += weight;
      }

      /* =========================
         OUT LOGIC (ONLY TODAY)
      ========================= */
      if (
        item.VehicleStatus === "OUT" &&
        outDate === today &&
        map[material].out < map[material].in
      ) {
        map[material].out++;
        map[material].netWeight += weight;

        totalOut++;
        totalWeight += weight;
      }
    });

  /* =========================
     FINAL RESPONSE
  ========================= */
  const rows = Object.values(map)
    .filter(m => m.in > 0) // show only if any IN exists
    .map(m => ({
      material: m.material,
      in: m.in,
      out: m.out,
      pending: Math.max(m.in - m.out, 0),
      netWeight: Number(m.netWeight.toFixed(2))
    }));

  return {
    rows,
    totals: {
      in: totalIn,
      out: totalOut,
      pending: Math.max(totalIn - totalOut, 0),
      netWeight: totalWeight.toFixed(2)
    }
  };
}


// Material & Product List with Search and Merged Data


app.get('/api/products', async (req, res) => {
  const { search } = req.query;
  try {
    let productUrl = `/Product?$format=json`;
    // Always fetch all products, filter later
    const productResp = await sapAxiosProduct.get(productUrl);
    const products = productResp.data.value || [];

    const productIds = products.map(p => p.Product).filter(Boolean);
    if (productIds.length === 0) {
      return res.json([]);
    }
    const descFilter = productIds
      .map(id => `(Product eq '${id}' and Language eq 'EN')`)
      .join(' or ');
    const descUrl = `/ProductDescription?$filter=${encodeURIComponent(descFilter)}&$format=json`;
    const descResp = await sapAxiosProduct.get(descUrl);
    const descriptions = descResp.data.value || [];

    const plantFilter = productIds.map(id => `Product eq '${id}'`).join(' or ');
    const plantUrl = `/ProductPlant?$filter=${encodeURIComponent(plantFilter)}&$format=json`;
    const plantResp = await sapAxiosProduct.get(plantUrl);
    const plants = plantResp.data.value || [];

    const descMap = {};
    descriptions.forEach(d => {
      if (d.Product && !descMap[d.Product]) {
        descMap[d.Product] = d.ProductDescription;
      }
    });
    const plantMap = {};
    plants.forEach(pl => {
      if (!pl.Product) return;
      if (!plantMap[pl.Product]) {
        plantMap[pl.Product] = [];
      }
      plantMap[pl.Product].push(pl.Plant);
    });

    // Merge all data
    let result = products.map(p => ({
      Product: p.Product,
      ProductType: p.ProductType,
      BaseUnit: p.BaseUnit,
      Description: descMap[p.Product] || "",
      Plant: plantMap[p.Product] ? plantMap[p.Product].join(', ') : ""
    }));

    // If search is present, filter by Product or Description (case-insensitive, partial match)
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      result = result.filter(
        p =>
          (p.Product && String(p.Product).toLowerCase().includes(s)) ||
          (p.Description && String(p.Description).toLowerCase().includes(s))
      );
    }

    res.json(result);
  } catch (err) {
    console.error('Product list error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});
 
//GRN Creation based on PO Number and ZMad Creation

// Fetch CSRF token for GRN OData service
async function fetchCsrfTokenGRN() {
  try {
    const res = await sapAxiosGRN.get('/', {
      headers: { 'x-csrf-token': 'Fetch' },
      validateStatus: () => true,
    });
    const token = res.headers['x-csrf-token'];
    const setCookie = res.headers['set-cookie'] || res.headers['Set-Cookie'] || [];
    const cookies = Array.isArray(setCookie)
      ? setCookie
          .map(c => {
            try {
              const parsed = cookie.parse(c);
              return Object.entries(parsed).map(([k, v]) => `${k}=${v}`).join('; ');
            } catch (e) {
              return c.split(';')[0];
            }
          })
          .join('; ')
      : (setCookie || '').toString();
    return { token, cookies };
  } catch (err) {
    console.error('fetchCsrfTokenGRN error', err?.response?.status, err?.message);
    throw err;
  }
}

app.post('/api/create-grn', async (req, res) => {
  try {
    let { gateEntryNumber } = req.body;
    let gateEntryNumbers = [];
    if (Array.isArray(gateEntryNumber)) {
      gateEntryNumbers = gateEntryNumber;
    } else if (gateEntryNumber) {
      gateEntryNumbers = [gateEntryNumber];
    }

    if (!gateEntryNumbers.length) {
      return res.status(400).json({ error: "gateEntryNumber (single or array) is required" });
    }

    const { token, cookies } = await fetchCsrfTokenGRN();
    const results = [];

    for (const entryNum of gateEntryNumbers) {
      try {
        // 1️⃣ Fetch Gate Entry + Weight Data
        const filter = `$filter=GateEntryNumber eq '${entryNum}'&$format=json`;
        const fullUrl = `${SAP_URL2}?${filter}`;
        const response = await axios.get(fullUrl, {
          auth: { username: SAP_USER2, password: SAP_PASS2 },
          headers: { Accept: "application/json" }
        });

        const gateResults = response.data?.d?.results || response.data?.value || [];
        const entry = gateResults.find(r => (r.Indicators || "").toUpperCase() === "I");
        if (!entry) {
          results.push({ gateEntryNumber: entryNum, error: "Inward Gate Entry not found" });
          continue;
        }

        if (!entry.PurchaseOrderNumber || !entry.Material || !entry.NetWeight) {
          results.push({ gateEntryNumber: entryNum, error: "Incomplete Gate Entry data (PO / Material / Qty missing)" });
          continue;
        }
        const poNumbergrn = entry.PurchaseOrderNumber;
        const poItem = entry.PurchaseOrderItem;
        console.log(`Processing GRN for Gate Entry ${entryNum}, PO: ${poNumbergrn}, Item: ${poItem}`);
        const headerPath = `/PurchaseOrder?$filter=PurchaseOrder eq '${poNumbergrn}'&$top=1&$format=json`;
        const itemPath = `/PurchaseOrderItem?$filter=PurchaseOrder eq '${poNumbergrn}' and PurchaseOrderItem eq '${poItem}' &$format=json`;

        const [headerResponse, itemResponse] = await Promise.all([
          sapAxiosPO.get(headerPath),
          sapAxiosPO.get(itemPath)
        ]);

        const headerData = headerResponse.data.value?.[0] || {};
        const items = itemResponse.data.value || [];
        const item = Array.isArray(items) && items.length > 0 ? items[0] : {};
        console.log('Fetched PO Items:', headerResponse.data, itemResponse.data);
        console.log('Fetched PO Item:', item.PurchaseOrder);
        // Build GRN payload
        const grnPayload = {
          DocumentDate: entry.VendorInvoiceDate,
          PostingDate: entry.GateEntryDate,
          MaterialDocumentHeaderText: `${entryNum}`,
          ReferenceDocument: entry.VendorInvoiceNumber,
          GoodsMovementCode: "01",
          to_MaterialDocumentItem: {
            results: [
              {
                Material: entry.Material,
                Plant: item.Plant || "SID1",
                StorageLocation: item.StorageLocation || "1101",
                GoodsMovementType: "101",
                PurchaseOrder: entry.PurchaseOrderNumber,
                PurchaseOrderItem: item.PurchaseOrderItem,
                GoodsMovementRefDocType: "B",
                EntryUnit:  item.BaseUnit || "KG",
                QuantityInEntryUnit: String(entry.NetWeight)
              }
            ]
          }
        };

        // Post GRN
        const resp = await sapAxiosGRN.post(
          '/A_MaterialDocumentHeader',
          grnPayload,
          {
            headers: {
              'Content-Type': 'application/json',
              'x-csrf-token': token,
              Cookie: cookies
            }
          }
        );

        let materialDocument = resp.data?.MaterialDocument
          || resp.data?.d?.MaterialDocument
          || (Array.isArray(resp.data?.d?.results) && resp.data.d.results[0]?.MaterialDocument)
          || resp.data?.value?.MaterialDocument
          || resp.data?.d?.value?.MaterialDocument
          || undefined;

        let materialDocumentYear = resp.data?.MaterialDocumentYear
          || resp.data?.d?.MaterialDocumentYear
          || (Array.isArray(resp.data?.d?.results) && resp.data.d.results[0]?.MaterialDocumentYear)
          || resp.data?.value?.MaterialDocumentYear
          || resp.data?.d?.value?.MaterialDocumentYear
          || undefined;

        results.push({
          gateEntryNumber: entryNum,
          materialDocument,
          year: materialDocumentYear,
          poHeader: headerData,
          poItems: items
        });
      } catch (errEach) {
        const sapError =
          errEach?.response?.data?.error?.message?.value ||
          errEach?.response?.data?.error?.message ||
          errEach.message;
        results.push({ gateEntryNumber: entryNum, error: sapError });
      }
    }

    res.status(201).json({
      message: "GRN(s) Created",
      results
    });

  } catch (err) {
    const sapError =
      err?.response?.data?.error?.message?.value ||
      err?.response?.data?.error?.message ||
      err.message;

    console.error("GRN ERROR:", sapError);

    res.status(500).json({ error: sapError });
  }
});


//Supplier and Customer Details API
app.get('/api/supplier-customer', async (req, res) => {
  try {
    const supplierResp = await sapAxiosSupplierMaster.get('/YY1_Vendor_Master?$format=json');
    const customerResp = await sapAxiosCustomerMaster.get('/YY1_Customer_Master?$format=json');
    const suppliers = supplierResp.data?.d?.results || supplierResp.data?.value || [];
    const customers = customerResp.data?.d?.results || customerResp.data?.value || [];
    res.json({ suppliers, customers });
  } catch (err) {
    console.error('Supplier/Customer fetch error', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch supplier/customer data' });
  }
});

// Start server
const port = process.env.PORT || 4600;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));

