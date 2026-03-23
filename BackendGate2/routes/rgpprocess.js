const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const router = express.Router();
// GET /api/rgpprocess/:gateEntryNumber/items - fetch all line items for a Gate Entry
router.get('/:gateEntryNumber/items', async (req, res) => {
  try {
    const { gateEntryNumber } = req.params;
    const SAP_URL_BASE = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
    // Step 1: Fetch header by GateEntryNumber
    const headerPath = `/YY1_GATEINWARD_OUTWARDDETA?$filter=GateEntryNumber eq '${gateEntryNumber}'&$format=json`;
    const headerResp = await axios.get(SAP_URL_BASE + headerPath, {
      auth: { username: SAP_USER, password: SAP_PASS },
    });
    const header = headerResp.data?.d?.results?.[0];
    if (!header || !header.SAP_UUID) {
      return res.status(404).json({ error: 'Gate Entry not found or missing SAP_UUID' });
    }
    // Step 2: Fetch all line items where SAP_PARENT_UUID matches header's SAP_UUID
    const itemsPath = `/YY1_GATEENTRYITEMS_GATEINWA000?$filter=SAP_PARENT_UUID eq guid'${header.SAP_UUID}'&$format=json`;
    const itemsResp = await axios.get(SAP_URL_BASE + itemsPath, {
      auth: { username: SAP_USER, password: SAP_PASS },
    });
    res.json(itemsResp.data);
  } catch (err) {
    console.error('[ERROR] Failed to fetch RGP line items by GateEntryNumber:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch RGP line items by GateEntryNumber' });
  }
});
// PATCH ReturnableQty for existing line items by GateEntryNumber (utility endpoint)
router.patch('/update-returnableqty/:gateEntryNumber', async (req, res) => {
  try {
    const { gateEntryNumber } = req.params;
    const { items } = req.body;
    if (!gateEntryNumber || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing gateEntryNumber or items array' });
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

    // PATCH each line item
    const results = [];
    let anyError = false;
    for (const item of items) {
      if (item.SAP_UUID && item.ReturnableQty != null) {
        const itemPatchUrl = `https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEENTRYITEMS_GATEINWA000(SAP_UUID=guid'${item.SAP_UUID}')`;
        // Debug log
        console.log('[DEBUG] PATCH URL:', itemPatchUrl);
        console.log('[DEBUG] PATCH payload (number):', { ReturnableQty: item.ReturnableQty });
        console.log('[DEBUG] PATCH payload (string):', { ReturnableQty: String(item.ReturnableQty) });
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
            // If PATCH with number fails, try with string
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
      // If any item failed, return error and do not show success
      return res.status(500).json({ error: 'One or more items failed to update', details: results });
    }
    res.json({ updated: results });
  } catch (err) {
    console.error('[ERROR] Failed to update ReturnableQty for existing items:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to update ReturnableQty', details: err?.response?.data || err.message });
  }
});

// POST /api/rgpprocess/gateout - save RGP Gate Out entry
router.post('/gateout', async (req, res) => {
  try {
    const gateOutPayload = req.body;
    console.log('[INFO] Saving RGP Gate Out:', JSON.stringify(gateOutPayload, null, 2));

    // Defensive: check payload is object
    if (!gateOutPayload || typeof gateOutPayload !== 'object') {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Extract fields after validation
    const GateEntryNumber = gateOutPayload.GateEntryNumber;
    const VehicleStatus = gateOutPayload.VehicleStatus;
    const OutwardTime = gateOutPayload.OutwardTime;
    const items = gateOutPayload.items;
    if (!GateEntryNumber || !VehicleStatus || !OutwardTime) {
      return res.status(400).json({ error: 'Missing GateEntryNumber, VehicleStatus, or OutwardTime' });
    }

    // Step 1: Fetch header by GateEntryNumber to get SAP_UUID
    const SAP_URL_BASE = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
    const headerPath = `/YY1_GATEINWARD_OUTWARDDETA?$filter=GateEntryNumber eq '${GateEntryNumber}'&$format=json`;
    const headerResp = await axios.get(SAP_URL_BASE + headerPath, {
      auth: { username: SAP_USER, password: SAP_PASS },
    });
    const header = headerResp.data?.d?.results?.[0];
    if (!header || !header.SAP_UUID) {
      return res.status(404).json({ error: 'Gate Entry not found or missing SAP_UUID' });
    }

    // Step 2: Fetch CSRF token and cookies for PATCH
    const tokenResp = await axios.get(SAP_URL, {
      auth: { username: SAP_USER, password: SAP_PASS },
      headers: { 'x-csrf-token': 'Fetch' },
    });
    const csrfToken = tokenResp.headers['x-csrf-token'];
    const cookies = tokenResp.headers['set-cookie'] || [];

    // PATCH header with VehicleStatus and OutwardTime (use correct SAP OData entity key format)
    const patchUrl = `${SAP_URL}(guid'${header.SAP_UUID}')`;
    const patchBody = {
      VehicleStatus,
      OutwardTime,
    };
    await axios({
      method: 'PATCH',
      url: patchUrl,
      auth: { username: SAP_USER, password: SAP_PASS },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-csrf-token': csrfToken,
        Cookie: cookies.join(';'),
      },
      data: patchBody,
    });

    // PATCH each line item with updated ReturnableQty if SAP_UUID is present
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item.SAP_UUID && item.ReturnableQty != null) {
          const itemPatchUrl = `https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEENTRYITEMS_GATEINWA000(SAP_UUID=guid'${item.SAP_UUID}')`;
          await axios({
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
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[ERROR] Failed to save RGP Gate Out:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to save RGP Gate Out', details: err?.response?.data || err.message });
  }
});

// SAP config for Gate Entry
const SAP_URL = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEINWARD_OUTWARDDETA';
const SAP_USER = 'BTPINTEGRATION';
const SAP_PASS = 'BTPIntegration@1234567890';

const rgpGateEntryNumPath = path.resolve(__dirname, '../routes/rgpgateentrynum.json');

// Helper to get the next Gate Entry Number from SAP (read only)
async function getNextRgpGateEntryNumberFromSAP() {
  // RGP series prefix is 257
  const prefix = '257';
  const SAP_URL_BASE = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
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
    console.error('[ERROR] Failed to fetch last RGP Gate Entry Number from SAP:', err?.response?.data || err.message);
    // fallback to local file if SAP fails
    let data = { lastGateEntryNumber: 2570000000 };
    try {
      if (fs.existsSync(rgpGateEntryNumPath)) {
        data = JSON.parse(fs.readFileSync(rgpGateEntryNumPath, 'utf8'));
      }
    } catch (e) {
      console.error('[ERROR] Failed to read local RGP gate entry file:', e.message);
    }
    const next = (parseInt(data.lastGateEntryNumber, 10) || 2570000000) + 1;
    return next.toString();
  }
}

// Helper to get and increment the next Gate Entry Number (for POST)
function getNextRgpGateEntryNumberAndIncrement() {
  let data = { lastGateEntryNumber: 2570000000 };
  try {
    if (fs.existsSync(rgpGateEntryNumPath)) {
      data = JSON.parse(fs.readFileSync(rgpGateEntryNumPath, 'utf8'));
    }
  } catch (e) {
    console.error('[ERROR] Failed to read local RGP gate entry file:', e.message);
  }
  const next = (parseInt(data.lastGateEntryNumber, 10) || 2570000000) + 1;
  data.lastGateEntryNumber = next;
  fs.writeFileSync(rgpGateEntryNumPath, JSON.stringify(data, null, 2));
  return next.toString();
}

// GET /api/rgpprocess/next-gate-entry-number
router.get('/next-gate-entry-number', async (req, res) => {
  try {
    const next = await getNextRgpGateEntryNumberFromSAP();
    console.log('[INFO] Next RGP Gate Entry Number:', next);
    res.json({ nextGateEntryNumber: next });
  } catch (err) {
    console.error('[ERROR] Failed to get next RGP Gate Entry Number:', err);
    res.status(500).json({ error: 'Failed to get next RGP Gate Entry Number' });
  }
});

// POST /api/rgpprocess - create RGP gate entry with next number
router.post('/', async (req, res) => {
  try {
    // Always get the next Gate Entry Number from SAP for consistency
    const nextGateEntryNumber = await getNextRgpGateEntryNumberFromSAP();

    // Fix SAP date format for GateEntryDate
    let gateEntryDate = req.body.GateEntryDate;
    if (gateEntryDate && /^\d{4}-\d{2}-\d{2}$/.test(gateEntryDate)) {
      gateEntryDate = gateEntryDate + 'T00:00:00';
    }

    // Fix SAP date format for ExpectedDateOfReturn
    let expectedDateOfReturn = req.body.ExpectedDateOfReturn;
    if (expectedDateOfReturn && /^\d{4}-\d{2}-\d{2}$/.test(expectedDateOfReturn)) {
      expectedDateOfReturn = expectedDateOfReturn + 'T00:00:00';
    }

    // Convert InwardTime from 'HH:mm' to 'PTxxHxxM00S' for SAP
    let inwardTimeSAP = req.body.InwardTime;
    if (inwardTimeSAP && /^\d{2}:\d{2}$/.test(inwardTimeSAP)) {
      const [h, m] = inwardTimeSAP.split(':');
      inwardTimeSAP = `PT${h}H${m}M00S`;
    } else {
      // Default to current time if not provided
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      inwardTimeSAP = `PT${hh}H${mm}M00S`;
    }

    // Extract fields from req.body (not gateOutPayload)
    const GateEntryNumber = req.body.GateEntryNumber;
    const VehicleStatus = req.body.VehicleStatus;
    const OutwardTime = req.body.OutwardTime;
    const items = req.body.items || req.body.tableRows || [];
    // For gate entry creation, VehicleStatus and OutwardTime are not required
    // Only check for required header fields if needed
    // Prepare header payload for SAP (no material fields)
    const headerPayload = {
      GateEntryNumber: nextGateEntryNumber,
      GateEntryDate: gateEntryDate,
      InwardTime: inwardTimeSAP,
      FiscalYear: req.body.FiscalYear || new Date().getFullYear().toString(),
      Indicators: 'R', // Inward indicator for RGP
      VehicleNumber: req.body.VehicleNumber || '',
      TransporterCode: req.body.TransporterCode || '',
      TransporterName: req.body.TransporterName || '',
      DriverName: req.body.DriverName || '',
      DriverPhoneNumber: req.body.DriverPhoneNumber || req.body.MobileNumber || '',
      DLNumber: req.body.DLNumber || '',
      Remarks: req.body.Remarks || req.body.Purpose || '',
      Vendor: req.body.Vendor || '',
      VendorName: req.body.VendorName || '',
      Plant: req.body.Plant || '',
      TransportMode: req.body.ModeOfTransport || 'By Hand',
      Department: req.body.Department || '',
      Requisitioner: req.body.Requisitioner || '',
      Place: req.body.Place || '',
      // No material fields here
    };

    // Get CSRF token
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
    const parentUUID = createResp.data?.d?.SAP_UUID || createResp.data?.SAP_UUID;
    if (!parentUUID) {
      return res.status(400).json({ error: 'SAP UUID missing for header' });
      // Step 3: PATCH each line item with updated ReturnableQty if needed
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item.SAP_UUID && item.ReturnableQty != null) {
            const itemPatchUrl = `https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEENTRYITEMS_GATEINWA000(guid'${item.SAP_UUID}')`;
            await axios({
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
          }
        }
      }
    }

    // Table rows from frontend
    const tableRows = req.body.tableRows || [];
    // Use correct navigation property for line items
    const lineItemURL = `https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEINWARD_OUTWARDDETA(guid'${parentUUID}')/to_GateEntryItems`;
    for (const row of tableRows) {
      // Prepare line item payload (fields same as table row)
      const linePayload = {
        Material: row.materialCode || '',
        MaterialDescription: row.materialDescription || '',
        ReturnableQty: row.returnableQuantity || '0.00',
        UOM: row.uom || '',
        ApproximateValue: row.approximateValue || '0.00',
        Remarks: row.remarks || '',
        Purpose: row.purpose || '',
        // Add other fields as needed
      };
      await axios.post(lineItemURL, linePayload, {
        auth: { username: SAP_USER, password: SAP_PASS },
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
          Cookie: cookies.join(';'),
        },
      });
    }

    console.log('[INFO] RGP Gate Entry and line items created successfully:', nextGateEntryNumber);
    res.status(createResp.status).json({ ...createResp.data, SAP_UUID: parentUUID });
  } catch (err) {
    console.error('[ERROR] RGP Process error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});


// GET /api/rgpprocess/vendors - fetch vendor list from SAP
router.get('/vendors', async (req, res) => {
  try {
    const SAP_VENDOR_URL = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_VENDOR_MASTER_CDS/YY1_Vendor_Master?$format=json';
    const resp = await axios.get(SAP_VENDOR_URL, {
      auth: { username: SAP_USER, password: SAP_PASS }
    });
    const vendors = (resp.data?.d?.results || []).map(v => ({
      code: v.Supplier,
      name: v.SupplierName,
      fullName: v.SupplierFullName,
      Full_Address: v.Full_Address || v.FullAddress || v.Address || ""
    }));
    res.json(vendors);
  } catch (err) {
    console.error('[ERROR] Failed to fetch vendors from SAP:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch vendor data from SAP' });
  }
});

// GET /api/rgpprocess/:gateEntryNumber - get specific RGP gate entry
router.get('/:gateEntryNumber', async (req, res) => {
  try {
    const { gateEntryNumber } = req.params;
    const SAP_URL_BASE = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
    // Use $filter to search by GateEntryNumber field instead of using it as entity key
    const filter = `$filter=GateEntryNumber eq '${gateEntryNumber}'`;
    const path = `/YY1_GATEINWARD_OUTWARDDETA?${filter}&$format=json`;
    
    console.log('[INFO] Fetching RGP Gate Entry:', gateEntryNumber);
    
    const resp = await axios.get(SAP_URL_BASE + path, {
      auth: { username: SAP_USER, password: SAP_PASS },
    });
    
    // Return the results array - frontend expects this format
    const results = resp.data?.d?.results || [];
    if (results.length === 0) {
      return res.status(404).json({ error: 'Gate Entry not found' });
    }
    
    console.log('[INFO] RGP Gate Entry found, SAP_UUID:', results[0].SAP_UUID);
    
    // Return in OData format that frontend expects (axios will wrap it in .data)
    res.json({ d: { results: results } });
  } catch (err) {
    console.error('[ERROR] Failed to fetch RGP Gate Entry:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch RGP Gate Entry' });
  }
});

// GET /api/rgpprocess - get all RGP gate entries
router.get('/', async (req, res) => {
  try {
    const SAP_URL_BASE = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
    const filter = `startswith(GateEntryNumber,'257')`;
    const path = `/YY1_GATEINWARD_OUTWARDDETA?$filter=${filter}&$orderby=GateEntryNumber desc&$format=json`;
    
    const resp = await axios.get(SAP_URL_BASE + path, {
      auth: { username: SAP_USER, password: SAP_PASS },
    });
    
    res.json(resp.data);
  } catch (err) {
    console.error('[ERROR] Failed to fetch RGP Gate Entries:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch RGP Gate Entries' });
  }
});

// PATCH /api/rgpprocess/:uuid - update RGP gate entry (for Gate In received quantities)
// GET /api/rgpprocess/:uuid/items - fetch line items for a given RGP header UUID
router.get('/:uuid/items', async (req, res) => {
  try {
    const { uuid } = req.params;
    const SAP_URL_BASE = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
    // Step 1: Fetch header by SAP_UUID
    const headerPath = `/YY1_GATEINWARD_OUTWARDDETA(guid'${uuid}')?$format=json`;
    const headerResp = await axios.get(SAP_URL_BASE + headerPath, {
      auth: { username: SAP_USER, password: SAP_PASS },
    });
    const parentUUID = headerResp.data?.d?.SAP_PARENT_UUID;
    if (!parentUUID) {
      return res.status(404).json({ error: 'SAP_PARENT_UUID not found for header' });
    }
    // Step 2: Fetch line items by SAP_PARENT_UUID (ensure guid format)
    const parentGuid = parentUUID.startsWith("guid'") ? parentUUID : `guid'${parentUUID}'`;
    const lineItemsPath = `/YY1_GATEINWARD_OUTWARDDETA(${parentGuid})/to_GateEntryItems?$format=json`;
    const resp = await axios.get(SAP_URL_BASE + lineItemsPath, {
      auth: { username: SAP_USER, password: SAP_PASS },
    });
    res.json(resp.data);
  } catch (err) {
    console.error('[ERROR] Failed to fetch RGP line items:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch RGP line items' });
  }
});
router.patch('/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    const SAP_URL_BASE = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
    const path = `/YY1_GATEINWARD_OUTWARDDETA(guid'${uuid}')`;

    console.log('[INFO] Updating RGP Gate Entry:', uuid);
    console.log('[INFO] Payload:', req.body);

    // Get CSRF token
    const tokenResp = await axios.get(SAP_URL, {
      auth: { username: SAP_USER, password: SAP_PASS },
      headers: { 'x-csrf-token': 'Fetch' },
    });
    const csrfToken = tokenResp.headers['x-csrf-token'];
    const cookies = tokenResp.headers['set-cookie'] || [];

    // Update Gate Entry in SAP
    const updateResp = await axios.patch(SAP_URL_BASE + path, req.body, {
      auth: { username: SAP_USER, password: SAP_PASS },
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        Cookie: cookies.join(';'),
      },
    });

    console.log('[INFO] RGP Gate Entry updated successfully');
    res.status(updateResp.status || 200).json({ message: 'Updated successfully' });
  } catch (err) {
    console.error('[ERROR] Failed to update RGP Gate Entry:', err?.response?.data || err.message);
    res.status(500).json({ error: err?.response?.data || 'Failed to update RGP Gate Entry' });
  }
});



module.exports = router;