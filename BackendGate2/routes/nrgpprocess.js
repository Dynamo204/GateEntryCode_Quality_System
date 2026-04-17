const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// GET /api/nrgpprocess/:gateEntryNumber/items - fetch all line items for a Gate Entry
router.get('/:gateEntryNumber/items', async (req, res) => {
  try {
    const { gateEntryNumber } = req.params;
    //const SAP_URL_BASE = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
      const SAP_URL_BASE = 'https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
  //  const SAP_URL_BASE = 'https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
    // Find header by GateEntryNumber
    const headerPath = `/YY1_GATEINWARD_OUTWARDDETA?$filter=GateEntryNumber eq '${gateEntryNumber}'&$format=json`;
    const headerResp = await axios.get(SAP_URL_BASE + headerPath, {
      auth: { username: SAP_USER, password: SAP_PASS },
    });
    const headerResults = headerResp.data?.d?.results || [];
    if (!headerResults.length) {
      return res.status(404).json({ error: 'NRGP Gate Entry not found' });
    }
    const parentUUID = headerResults[0].SAP_UUID || headerResults[0].Guid;
    if (!parentUUID) {
      return res.status(404).json({ error: 'NRGP Gate Entry UUID not found' });
    }
    // Fetch line items using navigation property
    const itemsPath = `/YY1_GATEINWARD_OUTWARDDETA(guid'${parentUUID}')/to_GateEntryItems?$format=json`;
    const itemsResp = await axios.get(SAP_URL_BASE + itemsPath, {
      auth: { username: SAP_USER, password: SAP_PASS },
    });
    const items = itemsResp.data?.d?.results || [];
    res.json({ items });
  } catch (err) {
    console.error('[ERROR] Failed to fetch NRGP line items:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch NRGP line items' });
  }
});

// SAP config for Gate Entry
const SAP_URL = 'https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEINWARD_OUTWARDDETA';
//const SAP_URL = 'https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEINWARD_OUTWARDDETA';
const SAP_USER = 'BTPINTEGRATION';
const SAP_PASS = 'BTPIntegration@1234567890';

const nrgpGateEntryNumPath = path.resolve(__dirname, '../routes/nrgpgateentrynum.json');

// PATCH ReturnableQty for existing line items by GateEntryNumber (utility endpoint)
router.patch('/update-returnableqty/:gateEntryNumber', async (req, res) => {
  try {
    const { gateEntryNumber } = req.params;
    const { items } = req.body;
    if (!gateEntryNumber || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing gateEntryNumber or items array' });
    }
  
      const SAP_URL_BASE = 'https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
   // const SAP_URL_BASE = 'https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';

    // Resolve header UUID from GateEntryNumber
    const headerPath = `/YY1_GATEINWARD_OUTWARDDETA?$filter=GateEntryNumber eq '${gateEntryNumber}'&$format=json`;
    let headerUUID;
    let headerVehicleStatus = '';
    try {
      const headerResp = await axios.get(SAP_URL_BASE + headerPath, {
        auth: { username: SAP_USER, password: SAP_PASS },
      });
      const header = headerResp.data?.d?.results?.[0];
      headerUUID = header?.SAP_UUID || header?.Guid;
      headerVehicleStatus = String(header?.VehicleStatus || '').toUpperCase();
      if (!headerUUID) {
        return res.status(404).json({ error: 'NRGP Gate Entry not found or missing SAP_UUID' });
      }
      if (headerVehicleStatus === 'OUT') {
        return res.status(400).json({ error: 'This vehicle was already OUT' });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch NRGP header', details: err?.response?.data || err.message });
    }

    // Fetch CSRF token and cookies for PATCH
    let csrfToken, cookies;
    try {
      const tokenResp = await axios.get(SAP_URL, {
        auth: { username: SAP_USER, password: SAP_PASS },
        headers: { 'x-csrf-token': 'Fetch' },
      });
      csrfToken = tokenResp.headers['x-csrf-token'];
      cookies = tokenResp.headers['set-cookie'] || [];
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch CSRF token from SAP', details: err?.response?.data || err.message });
    }

    // PATCH header for Gate Out action
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const outwardTime = `PT${hh}H${mm}M${ss}S`;
    const today = now.toISOString().split('T')[0];
    const gateOutDate = `${today}T00:00:00`;
    const headerPatchUrl = `${SAP_URL}(guid'${headerUUID}')`;

    try {
      await axios({
        method: 'PATCH',
        url: headerPatchUrl,
        auth: { username: SAP_USER, password: SAP_PASS },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-csrf-token': csrfToken,
          Cookie: cookies.join(';'),
        },
        data: {
          VehicleStatus: 'OUT',
          OutwardTime: outwardTime,
          GateOutDate: gateOutDate,
        },
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update NRGP header for gate out', details: err?.response?.data || err.message });
    }

    // PATCH each line item (same strategy as working RGP route)
    const results = [];
    let anyError = false;
    for (const item of items) {
      if (item.SAP_UUID && item.ReturnableQty != null) {
        const itemPatchUrl = `${SAP_URL_BASE}/YY1_GATEENTRYITEMS_GATEINWA000(SAP_UUID=guid'${item.SAP_UUID}')`;
        try {
          let patchResp;
          try {
            patchResp = await axios({
              method: 'PATCH',
              url: itemPatchUrl,
              auth: { username: SAP_USER, password: SAP_PASS },
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'x-csrf-token': csrfToken,
                Cookie: cookies.join(';'),
              },
              data: { ReturnableQty: item.ReturnableQty },
            });
          } catch (errNum) {
            try {
              // Some SAP services accept decimals as strings only
              patchResp = await axios({
                method: 'PATCH',
                url: itemPatchUrl,
                auth: { username: SAP_USER, password: SAP_PASS },
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'x-csrf-token': csrfToken,
                  Cookie: cookies.join(';'),
                },
                data: { ReturnableQty: String(item.ReturnableQty) },
              });
            } catch (errStr) {
              // Compatibility fallback for services where ReturnableQty is not writable
              const sapMsg = errStr?.response?.data?.error?.message?.value || '';
              if (sapMsg.includes('ReturnableQty')) {
                patchResp = await axios({
                  method: 'PATCH',
                  url: itemPatchUrl,
                  auth: { username: SAP_USER, password: SAP_PASS },
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'x-csrf-token': csrfToken,
                    Cookie: cookies.join(';'),
                  },
                  data: { Quantity: String(item.ReturnableQty) },
                });
              } else {
                throw errStr;
              }
            }
          }

          if (patchResp.status !== 204 && patchResp.status !== 200) {
            anyError = true;
            results.push({ SAP_UUID: item.SAP_UUID, status: 'error', error: `Unexpected SAP response status: ${patchResp.status}` });
          } else {
            results.push({ SAP_UUID: item.SAP_UUID, status: 'success' });
          }
        } catch (err) {
          anyError = true;
          let errorMsg = err?.response?.data || err.message;
          if (err?.response?.data?.error?.message?.value) {
            errorMsg = err.response.data.error.message.value;
          }
          results.push({ SAP_UUID: item.SAP_UUID, status: 'error', error: errorMsg });
        }
      } else {
        anyError = true;
        results.push({ SAP_UUID: item?.SAP_UUID, status: 'error', error: 'Missing SAP_UUID or ReturnableQty' });
      }
    }

    if (anyError) {
      return res.status(500).json({ error: 'One or more items failed to update', details: results });
    }

    res.json({ updated: results });
  } catch (err) {
    console.error('[ERROR] Failed to PATCH NRGP ReturnableQty:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to PATCH NRGP ReturnableQty' });
  }
});


// Helper to get the NRGP prefix for the current financial year
function getFinancialYearPrefixNRGP(date = new Date()) {
  // Financial year starts April 1st
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // JS months are 0-based
  let fyStartYear = year;
  if (month < 4) fyStartYear = year - 1;
  // 2024-25: 248, 2025-26: 258, 2026-27: 268, etc.
  // 2000-01: 8, 2001-02: 18, 2002-03: 28, ...
  // So: prefix = (fyStartYear - 2000) * 10 + 8
  return String((fyStartYear - 2000) * 10 + 8);
}

// Helper to get the next Gate Entry Number from SAP (read only)
async function getNextNrgpGateEntryNumberFromSAP() {
  const prefix = getFinancialYearPrefixNRGP();
  const SAP_URL_BASE = 'https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
 // const SAP_URL_BASE = 'https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
  const filter = `startswith(GateEntryNumber,'${prefix}')`;
  const path = `/YY1_GATEINWARD_OUTWARDDETA?$filter=${filter}&$orderby=GateEntryNumber desc&$top=1&$format=json`;
  try {
    const resp = await axios.get(SAP_URL_BASE + path, {
      auth: { username: SAP_USER, password: SAP_PASS },
    });
    const results = resp.data?.d?.results || [];
    const latest = results.length > 0 ? results[0].GateEntryNumber : null;
    const next = latest ? (parseInt(latest, 10) + 1).toString() : (prefix + '0000001');
    return next;
  } catch (err) {
    console.error('[ERROR] Failed to fetch last NRGP Gate Entry Number from SAP:', err?.response?.data || err.message);
    // fallback to local file if SAP fails
    let data = { lastGateEntryNumber: Number(prefix + '0000000') };
    try {
      if (fs.existsSync(nrgpGateEntryNumPath)) {
        data = JSON.parse(fs.readFileSync(nrgpGateEntryNumPath, 'utf8'));
      }
    } catch (e) {
      console.error('[ERROR] Failed to read local NRGP gate entry file:', e.message);
    }
    const next = (parseInt(data.lastGateEntryNumber, 10) || Number(prefix + '0000000')) + 1;
    return next.toString();
  }
}

// Helper to get and increment the next Gate Entry Number (for POST)
function getNextNrgpGateEntryNumberAndIncrement() {
  const prefix = getFinancialYearPrefixNRGP();
  let data = { lastGateEntryNumber: Number(prefix + '0000000') };
  try {
    if (fs.existsSync(nrgpGateEntryNumPath)) {
      data = JSON.parse(fs.readFileSync(nrgpGateEntryNumPath, 'utf8'));
    }
  } catch (e) {
    console.error('[ERROR] Failed to read local NRGP gate entry file:', e.message);
  }
  const next = (parseInt(data.lastGateEntryNumber, 10) || Number(prefix + '0000000')) + 1;
  data.lastGateEntryNumber = next;
  fs.writeFileSync(nrgpGateEntryNumPath, JSON.stringify(data, null, 2));
  return next.toString();
}

// GET /api/nrgpprocess/next-gate-entry-number
router.get('/next-gate-entry-number', async (req, res) => {
  try {
    const next = await getNextNrgpGateEntryNumberFromSAP();
    console.log('[INFO] Next NRGP Gate Entry Number:', next);
    res.json({ nextGateEntryNumber: next });
  } catch (err) {
    console.error('[ERROR] Failed to get next NRGP Gate Entry Number:', err);
    res.status(500).json({ error: 'Failed to get next NRGP Gate Entry Number' });
  }
});

// POST /api/nrgpprocess - create NRGP gate entry with next number
router.post('/', async (req, res) => {
  try {
    // Get next NRGP Gate Entry Number
    const nextGateEntryNumber = await getNextNrgpGateEntryNumberFromSAP();

    // Fix SAP date format for GateEntryDate
    let gateEntryDate = req.body.GateEntryDate;
    if (gateEntryDate && /^\d{4}-\d{2}-\d{2}$/.test(gateEntryDate)) {
      gateEntryDate = gateEntryDate + 'T00:00:00';
    } else {
      gateEntryDate = new Date().toISOString().split('T')[0] + 'T00:00:00';
    }

    // Fix SAP time format for InwardTime
    let inwardTime = req.body.InwardTime;
    if (inwardTime && /^\d{2}:\d{2}$/.test(inwardTime)) {
      const [hh, mm] = inwardTime.split(':');
      inwardTime = `PT${hh}H${mm}M00S`;
    } else {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      inwardTime = `PT${hh}H${mm}M00S`;
    }

    // Prepare header payload (no material fields)
    const headerPayload = {
      GateEntryNumber: nextGateEntryNumber,
      GateEntryDate: gateEntryDate,
      InwardTime: inwardTime,
      FiscalYear: req.body.FiscalYear || new Date().getFullYear().toString(),
      Plant: req.body.Plant || '',
      Vendor: req.body.Vendor || '',
      VendorName: req.body.VendorName || '',
      Department: req.body.Department || '',
      Requisitioner: req.body.Requisitioner || '',
      VehicleNumber: req.body.VehicleNumber || '',
      TransporterCode: req.body.TransporterCode || '',
      TransporterName: req.body.TransporterName || '',
      DriverName: req.body.DriverName || '',
      DriverPhoneNumber: req.body.DriverPhoneNumber || '',
      DLNumber: req.body.DLNumber || '',
      TransportMode: req.body.ModeOfTransport || 'By Hand',
      Remarks: req.body.Remarks || '',
      Indicators: 'N', // Always Inward for NRGP
    };

    // Fetch CSRF Token
    const tokenResp = await axios.get(SAP_URL, {
      auth: { username: SAP_USER, password: SAP_PASS },
      headers: { 'x-csrf-token': 'Fetch' },
    });
    const csrfToken = tokenResp.headers['x-csrf-token'];
    const cookies = tokenResp.headers['set-cookie'] || [];

    // Create Gate Entry header in SAP
    const createResp = await axios.post(SAP_URL, headerPayload, {
      auth: { username: SAP_USER, password: SAP_PASS },
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        Cookie: cookies.join(';'),
      },
    });

    // Get parent UUID for line items
    let parentUUID = createResp.data?.d?.SAP_UUID || createResp.data?.SAP_UUID;
    if (!parentUUID) {
      // Fallback: fetch header by GateEntryNumber
      const SAP_URL_BASE = 'https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
    //  const SAP_URL_BASE = 'https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
      const path = `/YY1_GATEINWARD_OUTWARDDETA?$filter=GateEntryNumber eq '${nextGateEntryNumber}'&$format=json`;
      const resp = await axios.get(SAP_URL_BASE + path, {
        auth: { username: SAP_USER, password: SAP_PASS },
      });
      const results = resp.data?.d?.results || [];
      if (results.length > 0) {
        parentUUID = results[0].SAP_UUID;
      }
    }

    // Table rows from frontend
    const tableRows = req.body.tableRows || [];
    const itemResults = [];

    // Use navigation property endpoint for line items
    if (parentUUID && tableRows.length > 0) {
      const lineItemURL = `https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEINWARD_OUTWARDDETA(guid'${parentUUID}')/to_GateEntryItems`;
    // const lineItemURL = `https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEINWARD_OUTWARDDETA(guid'${parentUUID}')/to_GateEntryItems`;
      for (const row of tableRows) {
        const linePayload = {
          Material: row.materialCode || '',
          MaterialDescription: row.materialDescription || '',
          ReturnableQty: row.returnableQty || row.ReturnableQty || row.quantity || '',
          UOM: row.uom || '',
          ApproximateValue: row.approximateValue || '',
          Remarks: row.remarks || '',
          Purpose: row.purpose || '',
        };
        try {
          const itemResp = await axios.post(lineItemURL, linePayload, {
            auth: { username: SAP_USER, password: SAP_PASS },
            headers: {
              'Content-Type': 'application/json',
              'x-csrf-token': csrfToken,
              Cookie: cookies.join(';'),
            },
          });
          itemResults.push({ status: itemResp.status, data: itemResp.data });
        } catch (itemErr) {
          itemResults.push({ error: itemErr.response?.data || itemErr.message });
        }
      }
    }

    // Return SAP response in RGP format
    res.status(createResp.status).json({ ...createResp.data, SAP_UUID: parentUUID, items: itemResults });
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// GET /api/nrgpprocess/:gateEntryNumber - get specific NRGP gate entry
router.get('/:gateEntryNumber', async (req, res) => {
  try {
    const { gateEntryNumber } = req.params;
     const SAP_URL_BASE = 'https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
   // const SAP_URL_BASE = 'https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
    const path = `/YY1_GATEINWARD_OUTWARDDETA?$filter=GateEntryNumber eq '${gateEntryNumber}'&$format=json`;

    const resp = await axios.get(SAP_URL_BASE + path, {
      auth: { username: SAP_USER, password: SAP_PASS },
    });

    const results = resp.data?.d?.results || [];
    if (!results.length) {
      return res.status(404).json({ error: 'NRGP Gate Entry not found' });
    }

    res.json(resp.data);
  } catch (err) {
    console.error('[ERROR] Failed to fetch NRGP Gate Entry:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch NRGP Gate Entry' });
  }
});

// GET /api/nrgpprocess - get all NRGP gate entries
router.get('/', async (req, res) => {
  try {
    const prefix = getFinancialYearPrefixNRGP();
     const SAP_URL_BASE = 'https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
   // const SAP_URL_BASE = 'https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
    const filter = `startswith(GateEntryNumber,'${prefix}')`;
    const path = `/YY1_GATEINWARD_OUTWARDDETA?$filter=${filter}&$orderby=GateEntryNumber desc&$format=json`;
    const resp = await axios.get(SAP_URL_BASE + path, {
      auth: { username: SAP_USER, password: SAP_PASS },
    });
    res.json(resp.data);
  } catch (err) {
    console.error('[ERROR] Failed to fetch NRGP Gate Entries:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch NRGP Gate Entries' });
  }
});

module.exports = router;
