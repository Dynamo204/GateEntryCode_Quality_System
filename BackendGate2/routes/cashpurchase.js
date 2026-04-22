
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const router = express.Router();
 
// SAP config for Gate Entry
//const SAP_URL = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEINWARD_OUTWARDDETA';
const SAP_URL = 'https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEINWARD_OUTWARDDETA';
// const SAP_URL = 'https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEINWARD_OUTWARDDETA';
const SAP_USER = 'BTPINTEGRATION';
const SAP_PASS = 'BTPIntegration@1234567890';
 
 
// Helper to get the next Gate Entry Number from SAP (read only)
async function getNextGateEntryNumberFromSAP(prefix = '266') {
 // const SAP_URL_BASE = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
   const SAP_URL_BASE = 'https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
 // const SAP_URL_BASE = 'https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
  const filter = `startswith(GateEntryNumber,'${prefix}') and Indicators eq 'CP'`;
  const path = `/YY1_GATEINWARD_OUTWARDDETA?$filter=${encodeURIComponent(filter)}&$orderby=GateEntryNumber desc&$top=1&$format=json`;
  try {
    const resp = await axios.get(SAP_URL_BASE + path, {
      auth: { username: SAP_USER, password: SAP_PASS },
    });
    const results = resp.data?.d?.results || [];
    const latest = results.length > 0 ? results[0].GateEntryNumber : null;
   
    // Compute next number
    if (!latest) {
      return prefix + String(1).padStart(7, '0'); // First number: prefix + 0000001
    }
    const suffix = latest.slice(prefix.length);
    const next = (parseInt(suffix, 10) || 0) + 1;
    return prefix + String(next).padStart(7, '0');
  } catch (err) {
    console.error('[ERROR] Failed to fetch last Gate Entry Number from SAP:', err?.response?.data || err.message);
    // fallback to default
    return prefix + String(1).padStart(7, '0');
  }
}
 
// Helper to check if a Gate Entry Number already exists in SAP
async function checkGateEntryExists(gateEntryNumber) {
  //const SAP_URL_BASE = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
  const SAP_URL_BASE = 'https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
 // const SAP_URL_BASE = 'https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
  const filter = `GateEntryNumber eq '${gateEntryNumber}'`;
  const path = `/YY1_GATEINWARD_OUTWARDDETA?$filter=${encodeURIComponent(filter)}&$format=json`;
  try {
    const resp = await axios.get(SAP_URL_BASE + path, {
      auth: { username: SAP_USER, password: SAP_PASS },
    });
    const results = resp.data?.d?.results || [];
    return results.length > 0; // true if exists
  } catch (err) {
    console.error('[ERROR] Failed to check Gate Entry existence:', err?.response?.data || err.message);
    return false; // Assume doesn't exist on error
  }
}
 
// Helper to find the next available Gate Entry Number (that doesn't exist in SAP)
async function findNextAvailableGateEntryNumber(prefix = '266', maxAttempts = 50) {
  let candidate = await getNextGateEntryNumberFromSAP(prefix);
  let attempts = 0;
 
  console.log(`[INFO] Starting search for available Gate Entry Number with prefix: ${prefix}`);
  console.log(`[INFO] Initial candidate from SAP: ${candidate}`);
 
  while (attempts < maxAttempts) {
    const exists = await checkGateEntryExists(candidate);
    if (!exists) {
      console.log(`[INFO] Found available Gate Entry Number: ${candidate} after ${attempts + 1} attempts`);
      return candidate;
    }
   
    // If exists, increment and try again
    console.log(`[WARN] Gate Entry Number ${candidate} already exists (attempt ${attempts + 1}/${maxAttempts}), trying next...`);
    const suffix = candidate.slice(prefix.length);
    const next = (parseInt(suffix, 10) || 0) + 1;
    candidate = prefix + String(next).padStart(7, '0');
    attempts++;
  }
 
  // If we still can't find one, use a timestamp-based approach as fallback
  console.error(`[ERROR] Could not find available Gate Entry Number after ${maxAttempts} attempts`);
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
  const fallbackCandidate = prefix + timestamp.padStart(7, '0');
  console.log(`[INFO] Using timestamp-based fallback: ${fallbackCandidate}`);
 
  // Check if the fallback exists
  const fallbackExists = await checkGateEntryExists(fallbackCandidate);
  if (!fallbackExists) {
    return fallbackCandidate;
  }
 
  throw new Error(`Could not find available Gate Entry Number after ${maxAttempts} attempts and fallback also exists`);
}
 
// Helper to get and increment the next Gate Entry Number (for POST)
function getNextGateEntryNumberAndIncrement() {
  let data = { lastGateEntryNumber: 2560000000 };
  try {
    if (fs.existsSync(gateEntryNumPath)) {
      data = JSON.parse(fs.readFileSync(gateEntryNumPath, 'utf8'));
    }
  } catch (e) {
    // fallback to default
  }
  const next = (parseInt(data.lastGateEntryNumber, 10) || 2560000000) + 1;
  data.lastGateEntryNumber = next;
  fs.writeFileSync(gateEntryNumPath, JSON.stringify(data, null, 2));
  return next.toString();
}
 
// GET /api/cashpurchase/next-number (matches frontend expectation)
router.get('/next-number', async (req, res) => {
  try {
    const { year } = req.query;
    // Build prefix dynamically based on year
    const now = new Date();
    const y = year && String(year).length === 4 ? String(year) : String(now.getFullYear());
    const yy = y.slice(-2);
    const prefix = yy + '6'; // YY + 6 for cash purchase (266 for 2026, 276 for 2027)
   
    const next = await findNextAvailableGateEntryNumber(prefix);
    res.json({ next });
  } catch (err) {
    console.error('[ERROR] Failed to get next Gate Entry Number:', err);
    res.status(500).json({ error: 'Failed to get next Gate Entry Number' });
  }
});
 
// Also keep the old route for backward compatibility
router.get('/next-gate-entry-number', async (req, res) => {
  try {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const prefix = yy + '6'; // YY + 6 for cash purchase
    const next = await findNextAvailableGateEntryNumber(prefix);
    res.json({ nextGateEntryNumber: next });
  } catch (err) {
    console.error('[ERROR] Failed to get next Gate Entry Number:', err);
    res.status(500).json({ error: 'Failed to get next Gate Entry Number' });
  }
});
 
// POST /api/cashpurchase - create gate entry with next number
router.post('/', async (req, res) => {
  // Create Cash Purchase header (Gate Entry)
  try {
    // Get year from request or current year
    const now = new Date();
    const year = req.body.GateEntryDate ? String(req.body.GateEntryDate).slice(0, 4) : String(now.getFullYear());
    const yy = year.slice(-2);
    const prefix = yy + '6'; // YY + 6 for cash purchase (266 for 2026, 276 for 2027)
 
    // Find the next AVAILABLE Gate Entry Number (not already in SAP)
    const nextGateEntryNumber = await findNextAvailableGateEntryNumber(prefix);
 
    // Fix SAP date format for GateEntryDate
    let gateEntryDate = req.body.GateEntryDate;
    if (gateEntryDate && /^\d{4}-\d{2}-\d{2}$/.test(gateEntryDate)) {
      gateEntryDate = gateEntryDate + 'T00:00:00';
    }
 
    // Convert InwardTime from 'HH:mm:ss' to 'PTxxHxxMxxS' for SAP
    let inwardTimeSAP = req.body.InwardTime;
    if (inwardTimeSAP && /^\d{2}:\d{2}:\d{2}$/.test(inwardTimeSAP)) {
      const [h, m, s] = inwardTimeSAP.split(':');
      inwardTimeSAP = `PT${h}H${m}M${s}S`;
    }
 
    // Only map required header fields
    const payload = {
      GateEntryNumber: nextGateEntryNumber,
      Indicators: 'CP',
      GateEntryDate: gateEntryDate,
      CashPurchaseApprover: req.body.CashPurchaseApprover,
      PersonName: req.body.PersonName,
      Remarks: req.body.Remarks,
      VendorName: req.body.VendorName,
      InwardTime: inwardTimeSAP,
      DriverPhoneNumber: req.body.DriverPhoneNumber,
      VendorInvoiceNumber: req.body.VendorInvoiceNumber,
      TransportMode: req.body.TransportMode,
      TotalAmount: req.body.TotalAmount || req.body.totalAmount
    };
    // Remove undefined/null/empty values
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined || payload[key] === null || payload[key] === '') {
        delete payload[key];
      }
    });
 
    // Get CSRF token
    const tokenResp = await axios.get(SAP_URL, {
      auth: { username: SAP_USER, password: SAP_PASS },
      headers: { 'x-csrf-token': 'Fetch' },
    });
    const csrfToken = tokenResp.headers['x-csrf-token'];
    const cookies = tokenResp.headers['set-cookie'] || [];
 
    // Create Gate Entry (header only)
    let createResp;
    try {
      createResp = await axios.post(SAP_URL, payload, {
        auth: { username: SAP_USER, password: SAP_PASS },
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
          Cookie: cookies.join(';'),
        },
      });
    } catch (err) {
      // If SAP creation fails, do NOT increment or reserve the number
      console.error('CashPurchase error:', err.response?.data || err.message);
      if (err.response?.data?.error?.message?.value?.includes('already exists')) {
        return res.status(409).json({
          error: 'Gate Entry Number already exists. Please try again.',
          details: err.response?.data
        });
      } else {
        return res.status(err.response?.status || 500).json({
          error: err.response?.data || err.message
        });
      }
    }
 
    // Only after successful SAP creation, increment/save the number locally if needed
    // (If you use a local file for tracking, update here)
    // Return SAP_UUID for use in line item creation
    const sapUUID = createResp.data?.d?.SAP_UUID || createResp.data?.SAP_UUID;
    res.status(createResp.status).json({
      ...createResp.data,
      GateEntryNumber: nextGateEntryNumber,
      SAP_UUID: sapUUID
    });
  } catch (err) {
    console.error('CashPurchase error:', err.response?.data || err.message);
    // Handle duplicate key error specifically
    if (err.response?.data?.error?.message?.value?.includes('already exists')) {
      res.status(409).json({
        error: 'Gate Entry Number already exists. Please try again.',
        details: err.response?.data
      });
    } else {
      res.status(err.response?.status || 500).json({
        error: err.response?.data || err.message
      });
    }
  }
});
 
// POST /api/cashpurchase/item - create line items for Cash Purchase
router.post('/item', async (req, res) => {
  // Create line items for Cash Purchase
  try {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    if (!items.length) {
      return res.status(400).json({ error: 'No items provided' });
    }
    // Accepts: array of item objects, each with Description, Quantity, Rate, Amount, Remarks1, SAP_PARENT_UUID
    const results = [];
    let anyError = false;
    for (const item of items) {
      if (!item.SAP_PARENT_UUID) {
        results.push({ status: 'error', error: 'Missing SAP_PARENT_UUID', item });
        anyError = true;
        continue;
      }
      // Use exact payload structure as in Postman
      const payload = {
        // Accept both camelCase and lowercase for table/Excel compatibility
        Description: item.Description ?? item.description ?? '',
        Quantity: item.Quantity !== undefined ? String(item.Quantity) : (item.quantity !== undefined ? String(item.quantity) : '0.000'),
        Rate: item.Rate !== undefined ? String(item.Rate) : (item.rate !== undefined ? String(item.rate) : '0.00'),
        Amount: item.Amount !== undefined ? String(item.Amount) : (item.amount !== undefined ? String(item.amount) : '0.0000'),
        Remarks1: item.Remarks1 ?? item.remarks1 ?? item.remarks ?? '',
        SAP_PARENT_UUID: item.SAP_PARENT_UUID
      };
      // Navigation property URL (as in Postman)
    //  const NAV_URL = `https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEINWARD_OUTWARDDETA%27${item.SAP_PARENT_UUID}')/to_GateEntryItems`;
     const NAV_URL = `https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEINWARD_OUTWARDDETA(guid'${item.SAP_PARENT_UUID}')/to_GateEntryItems`;
    //  const NAV_URL = `https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEINWARD_OUTWARDDETA(guid'${item.SAP_PARENT_UUID}')/to_GateEntryItems`;
      let csrfToken, cookies;
      try {
        const tokenResp = await axios.get(NAV_URL, {
          auth: { username: SAP_USER, password: SAP_PASS },
          headers: { 'X-CSRF-Token': 'Fetch' },
        });
        csrfToken = tokenResp.headers['x-csrf-token'];
        cookies = tokenResp.headers['set-cookie'] || [];
      } catch (err) {
        results.push({ status: 'error', error: 'Failed to fetch CSRF token', item });
        anyError = true;
        continue;
      }
      try {
        const resp = await axios.post(NAV_URL, payload, {
          auth: { username: SAP_USER, password: SAP_PASS },
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
            Cookie: cookies.join(';'),
            Accept: 'application/json'
          },
        });
        results.push({ status: 'created', data: resp.data?.d });
      } catch (err) {
        let errorMsg = err?.response?.data || err.message;
        if (err?.response?.data?.error?.message?.value) {
          errorMsg = err.response.data.error.message.value;
        }
        results.push({ status: 'error', error: errorMsg, item });
        anyError = true;
        console.error('[SAP ERROR] CashPurchase item:', {
          error: errorMsg,
          payload,
          sapResponse: err?.response?.data
        });
      }
    }
    if (anyError) {
      return res.status(500).json({ error: 'One or more items failed', details: results });
    }
    res.status(201).json({ status: 'Line items processed', results });
  } catch (err) {
    console.error('[ERROR] CashPurchase item creation:', err?.response?.data || err.message);
    // Handle errors during item creation
    res.status(500).json({ error: err?.response?.data || err.message });
  }
});
 
module.exports = router;
 
