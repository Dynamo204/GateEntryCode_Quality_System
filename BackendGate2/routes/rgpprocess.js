
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const router = express.Router();

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDecimal(value) {
  return toNumber(value).toFixed(2);
}

function parseSapDurationToSeconds(value) {
  if (!value || typeof value !== 'string') return 0;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return (hours * 3600) + (minutes * 60) + seconds;
}

function getIstNowParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '00';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

function getCurrentIstSapDateTime() {
  const now = getIstNowParts();
  return {
    receivedDate: `${now.year}-${now.month}-${now.day}T00:00:00`,
    receivedTime: `PT${now.hour}H${now.minute}M${now.second}S`,
  };
}

function getLineItemTimestamp(item) {
  const rawDate = item?.RecivedDate || item?.ReceivedDate || item?.['d:RecivedDate'] || item?.['d:ReceivedDate'] || '';
  const rawTime = item?.RecivedTime || item?.ReceivedTime || item?.['d:RecivedTime'] || item?.['d:ReceivedTime'] || '';

  let dateMs = 0;
  if (typeof rawDate === 'string' && rawDate.startsWith('/Date(')) {
    const match = rawDate.match(/\/Date\(([-\d+]+)(?:[+-]\d+)?\)\//);
    if (match) {
      dateMs = Number(match[1]) || 0;
    }
  } else if (rawDate) {
    const parsed = new Date(rawDate).getTime();
    dateMs = Number.isFinite(parsed) ? parsed : 0;
  }

  return dateMs + (parseSapDurationToSeconds(rawTime) * 1000);
}

function getMaterialKey(item) {
  // Use Material (material code) as primary key, fallback to SAP_UUID if missing
  const material = String(item?.Material || item?.material || item?.['d:Material'] || '').trim();
  if (material) return material;
  // Fallback to SAP_UUID if material code is missing
  return String(item?.SAP_UUID || item?.sap_uuid || item?.uuid || item?.['d:SAP_UUID'] || '').trim();
}

function pickLatestLineItems(items) {
  const latestByMaterial = new Map();
  items.forEach((item) => {
    const materialKey = getMaterialKey(item);
    if (!materialKey) {
      return;
    }
    const current = latestByMaterial.get(materialKey);
    const itemTs = getLineItemTimestamp(item);
    const currentTs = current ? getLineItemTimestamp(current) : -1;
    if (!current || itemTs >= currentTs) {
      latestByMaterial.set(materialKey, item);
    }
  });
  return Array.from(latestByMaterial.values());
}

async function fetchRgpHeaderByGateEntryNumber(gateEntryNumber) {
  const SAP_URL_BASE = 'https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
//  const SAP_URL_BASE = 'https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
  const headerPath = `/YY1_GATEINWARD_OUTWARDDETA?$filter=GateEntryNumber eq '${gateEntryNumber}'&$format=json`;
  const headerResp = await axios.get(SAP_URL_BASE + headerPath, {
    auth: { username: SAP_USER, password: SAP_PASS },
  });
  return headerResp.data?.d?.results?.[0] || null;
}

async function fetchRgpLineItemsByParentUuid(parentUUID) {
   const SAP_URL_BASE = 'https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
 // const SAP_URL_BASE = 'https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
  const navigationPath = `/YY1_GATEINWARD_OUTWARDDETA(guid'${parentUUID}')/to_GateEntryItems?$format=json`;

  try {
    const navResp = await axios.get(SAP_URL_BASE + navigationPath, {
      auth: { username: SAP_USER, password: SAP_PASS },
    });
    const navItems = navResp.data?.d?.results || [];
    if (Array.isArray(navItems) && navItems.length > 0) {
      return navItems;
    }
  } catch (navErr) {
    console.warn('[WARN] Navigation fetch for RGP line items failed, trying filter fallback:', navErr?.response?.data || navErr.message);
  }

  const filterPath = `/YY1_GATEENTRYITEMS_GATEINWA000?$filter=SAP_PARENT_UUID eq guid'${parentUUID}'&$format=json`;
  const filterResp = await axios.get(SAP_URL_BASE + filterPath, {
    auth: { username: SAP_USER, password: SAP_PASS },
  });
  return filterResp.data?.d?.results || [];
}

function buildReceiptLinePayload(sourceItem, receivedQuantity) {
  const { receivedDate, receivedTime } = getCurrentIstSapDateTime();
   // Always calculate RecivedQty as ReturnableQty - RemainQty
   const prevReturnableQty = toNumber(sourceItem?.ReturnableQty ?? sourceItem?.['d:ReturnableQty']);
   const prevRemainQty = toNumber(sourceItem?.RemainQty ?? sourceItem?.['d:RemainQty']);
   const updatedRemainQty = prevRemainQty - receivedQuantity;
   // The new RecivedQty is (ReturnableQty - updatedRemainQty)
   const newRecivedQty = prevReturnableQty - updatedRemainQty;

  return {
    PurchaseOrderNumber: sourceItem?.PurchaseOrderNumber || '',
    PurchaseOrderItem: sourceItem?.PurchaseOrderItem || '',
    Material: sourceItem?.Material || '',
    MaterialDescription: sourceItem?.MaterialDescription || '',
    Vendor: sourceItem?.Vendor || '',
    VendorName: sourceItem?.VendorName || '',
    VendorInvoiceNumber: sourceItem?.VendorInvoiceNumber || '',
    VendorInvoicedate: sourceItem?.VendorInvoicedate || null,
    VendorInvoiceWeight: sourceItem?.VendorInvoiceWeight || '0.000',
    BalanceQty: sourceItem?.BalanceQty || '0.000',
    SalesDocument: sourceItem?.SalesDocument || '',
    Customer: sourceItem?.Customer || '',
   RecivedQty: formatDecimal(newRecivedQty),
    RemainQty: formatDecimal(updatedRemainQty),
    ReturnableQty: sourceItem?.ReturnableQty != null ? String(sourceItem.ReturnableQty) : formatDecimal(previousRemainQty),
    UOM: sourceItem?.UOM || '',
    ApproximateValue: sourceItem?.ApproximateValue || '0.00',
    Remarks: sourceItem?.Remarks || '',
    Purpose: sourceItem?.Purpose || '',
    Description: sourceItem?.Description || '',
    Quantity: sourceItem?.Quantity || '0.000',
    Rate: sourceItem?.Rate || '0.00',
    Amount: sourceItem?.Amount || '0.0000',
    Remarks1: sourceItem?.Remarks1 || '',
    RecivedDate: receivedDate,
    RecivedTime: receivedTime,
  };
}

// GET /api/rgpprocess/:gateEntryNumber/items - fetch all line items for a Gate Entry
router.get('/:gateEntryNumber/items', async (req, res) => {
  try {
    const { gateEntryNumber } = req.params;
    const header = await fetchRgpHeaderByGateEntryNumber(gateEntryNumber);
    if (!header || !header.SAP_UUID) {
      return res.status(404).json({ error: 'Gate Entry not found or missing SAP_UUID' });
    }
    const items = await fetchRgpLineItemsByParentUuid(header.SAP_UUID);
    const latestItems = pickLatestLineItems(items);
    res.json({ items: latestItems });
  } catch (err) {
    console.error('[ERROR] Failed to fetch RGP line items by GateEntryNumber:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch RGP line items by GateEntryNumber' });
  }
});

router.post('/:gateEntryNumber/receive', async (req, res) => {
  try {
    const { gateEntryNumber } = req.params;
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const headerRemarks = req.body?.headerRemarks;

    if (!gateEntryNumber || items.length === 0) {
      // Allow updating header remarks even if no items, as long as headerRemarks is provided
      if (typeof headerRemarks !== 'string') {
        return res.status(400).json({ error: 'Missing gateEntryNumber or receipt items' });
      }
    }

    const header = await fetchRgpHeaderByGateEntryNumber(gateEntryNumber);
    if (!header || !header.SAP_UUID) {
      return res.status(404).json({ error: 'Gate Entry not found or missing SAP_UUID' });
    }

    const allItems = await fetchRgpLineItemsByParentUuid(header.SAP_UUID);
    const latestItems = pickLatestLineItems(allItems);

    if (latestItems.length > 0 && latestItems.every((item) => toNumber(item?.RemainQty ?? item?.['d:RemainQty']) <= 0)) {
      return res.status(400).json({ error: 'Gate Entry process is closed. All quantities are received.' });
    }

    // Build maps for matching: by material code, SAP_UUID, and MaterialDescription
    const latestByMaterial = new Map();
    const latestByUuid = new Map();
    const latestByDescription = new Map();
    for (const li of latestItems) {
      const materialKey = String(li.Material || li.material || li['d:Material'] || '').trim();
      const uuidKey = String(li.SAP_UUID || li.sap_uuid || li.uuid || li['d:SAP_UUID'] || '').trim();
      const descKey = String(li.MaterialDescription || li.materialDescription || li['d:MaterialDescription'] || '').trim();
      if (materialKey) latestByMaterial.set(materialKey, li);
      if (uuidKey) latestByUuid.set(uuidKey, li);
      if (descKey) latestByDescription.set(descKey, li);
    }
    const preparedReceipts = [];

    for (const item of items) {
      const receivedQuantityRaw = item?.receivedQuantity;
      const remarksRaw = typeof item?.remarks === 'string' ? item.remarks : undefined;
      // Only skip if both are missing/null/empty
      if ((receivedQuantityRaw == null || receivedQuantityRaw === '') && (remarksRaw == null || remarksRaw === '')) {
        continue;
      }

      const uuidKey = String(item.SAP_UUID || item.sap_uuid || item.uuid || item['d:SAP_UUID'] || '').trim();
      const materialKey = String(item.Material || item.material || item['d:Material'] || item.materialCode || '').trim();
      const descKey = String(item.MaterialDescription || item.materialDescription || item['d:MaterialDescription'] || item.materialDescription || '').trim();

      let sourceItem = null;
      if (uuidKey && latestByUuid.has(uuidKey)) {
        sourceItem = latestByUuid.get(uuidKey);
      } else if (materialKey && latestByMaterial.has(materialKey)) {
        sourceItem = latestByMaterial.get(materialKey);
      } else if (descKey && latestByDescription.has(descKey)) {
        sourceItem = latestByDescription.get(descKey);
      }
      if (!sourceItem) {
        return res.status(400).json({ error: `Latest line item not found for material code '${materialKey || descKey || uuidKey || 'unknown'}'` });
      }

      const currentRemainQty = toNumber(sourceItem?.RemainQty ?? sourceItem?.['d:RemainQty'] ?? sourceItem?.ReturnableQty ?? sourceItem?.['d:ReturnableQty']);
      if (currentRemainQty <= 0) {
        return res.status(400).json({ error: 'Gate Entry process is closed. All quantities are received.' });
      }

      const receivedQuantity = toNumber(receivedQuantityRaw);
      if (receivedQuantity > currentRemainQty) {
        return res.status(400).json({ error: `Received Quantity cannot exceed Remaining Quantity for material code '${materialKey || descKey || uuidKey}'` });
      }

      // Build payload and override remarks if provided
      const linePayload = buildReceiptLinePayload(sourceItem, receivedQuantity);
      if (remarksRaw !== undefined) {
        linePayload.Remarks = remarksRaw;
      }
      preparedReceipts.push({
        materialKey,
        sourceItem,
        linePayload,
      });
    }

    if (preparedReceipts.length === 0 && typeof headerRemarks !== 'string') {
      return res.status(400).json({ error: 'Please enter at least one valid Received Quantity or Remarks' });
    }

    // Always fetch CSRF token and cookies before any PATCH
    const tokenResp = await axios.get(SAP_URL, {
      auth: { username: SAP_USER, password: SAP_PASS },
      headers: { 'x-csrf-token': 'Fetch' },
    });
    const csrfToken = tokenResp.headers['x-csrf-token'];
    const cookies = tokenResp.headers['set-cookie'] || [];

    // PATCH header remarks if provided
    let headerRemarksPatched = false;
    if (typeof headerRemarks === 'string') {
      try {
        const patchUrl = `${SAP_URL}(guid'${header.SAP_UUID}')`;
        await axios.patch(patchUrl, { Remarks: headerRemarks }, {
          auth: { username: SAP_USER, password: SAP_PASS },
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
            Cookie: cookies.join(';'),
          },
        });
        headerRemarksPatched = true;
      } catch (err) {
        console.warn('[WARN] Failed to patch header remarks:', err?.response?.data || err.message);
      }
    }


    // PATCH existing line items instead of POST to avoid duplicates
    const updated = [];
    for (const receipt of preparedReceipts) {
      const sourceItem = receipt.sourceItem;
      if (!sourceItem || !sourceItem.SAP_UUID) {
        updated.push({ Material: receipt.materialKey, status: 'error', error: 'Missing SAP_UUID for PATCH' });
        continue;
      }
      const itemPatchUrl = `https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEENTRYITEMS_GATEINWA000(SAP_UUID=guid'${sourceItem.SAP_UUID}')`;
     // const itemPatchUrl = `https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEENTRYITEMS_GATEINWA000(SAP_UUID=guid'${sourceItem.SAP_UUID}')`;
      // Debug: log PATCH payload and URL
      console.log('[DEBUG] PATCH URL:', itemPatchUrl);
      console.log('[DEBUG] PATCH payload:', JSON.stringify(receipt.linePayload, null, 2));
      try {
        const patchResp = await axios({
          method: 'PATCH',
          url: itemPatchUrl,
          auth: { username: SAP_USER, password: SAP_PASS },
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'x-csrf-token': csrfToken,
            Cookie: cookies.join(';'),
          },
          data: receipt.linePayload,
        });
        // Debug: log SAP response
        console.log('[DEBUG] PATCH response:', JSON.stringify(patchResp.data, null, 2));
        updated.push({ SAP_UUID: sourceItem.SAP_UUID, status: 'success' });
      } catch (err) {
        console.error('[ERROR] PATCH failed:', err?.response?.data || err.message);
        updated.push({ SAP_UUID: sourceItem.SAP_UUID, status: 'error', error: err?.response?.data || err.message });
      }
    }

    const refreshedItems = await fetchRgpLineItemsByParentUuid(header.SAP_UUID);
    const latestRefreshedItems = pickLatestLineItems(refreshedItems);
    const processClosed = latestRefreshedItems.length > 0 && latestRefreshedItems.every((item) => toNumber(item?.RemainQty ?? item?.['d:RemainQty']) <= 0);

    res.json({
      success: true,
      updated,
      items: latestRefreshedItems,
      processClosed,
      headerRemarksPatched,
    });
  } catch (err) {
    console.error('[ERROR] Failed to create RGP Gate In receipt history:', err?.response?.data || err.message);
    const sapError = err?.response?.data?.error?.message?.value || err?.response?.data?.error || err?.response?.data || err.message;
    res.status(500).json({ error: sapError || 'Failed to create RGP Gate In receipt history' });
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
        const itemPatchUrl = `https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEENTRYITEMS_GATEINWA000(SAP_UUID=guid'${item.SAP_UUID}')`;
      // const itemPatchUrl = `https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEENTRYITEMS_GATEINWA000(SAP_UUID=guid'${item.SAP_UUID}')`;
      
        // Debug log
        console.log('[DEBUG] PATCH URL:', itemPatchUrl);
        console.log('[DEBUG] PATCH payload (number):', { ReturnableQty: item.ReturnableQty, RemainQty: item.ReturnableQty });
        console.log('[DEBUG] PATCH payload (string):', { ReturnableQty: String(item.ReturnableQty), RemainQty: String(item.ReturnableQty) });
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
              data: { ReturnableQty: item.ReturnableQty, RemainQty: item.ReturnableQty },
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
              data: { ReturnableQty: String(item.ReturnableQty), RemainQty: String(item.ReturnableQty) },
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
      const SAP_URL_BASE = 'https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
   //const SAP_URL_BASE = 'https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
   // const SAP_URL_BASE = 
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
          const itemPatchUrl = `https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEENTRYITEMS_GATEINWA000(SAP_UUID=guid'${item.SAP_UUID}')`;
        //   const itemPatchUrl = `https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEENTRYITEMS_GATEINWA000(SAP_UUID=guid'${item.SAP_UUID}')`;
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
const SAP_URL = 'https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEINWARD_OUTWARDDETA';
// const SAP_URL = 'https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEINWARD_OUTWARDDETA';
const SAP_USER = 'BTPINTEGRATION';
const SAP_PASS = 'BTPIntegration@1234567890';

const rgpGateEntryNumPath = path.resolve(__dirname, '../routes/rgpgateentrynum.json');


// Helper to get the RGP prefix for the current financial year
function getFinancialYearPrefixRGP(date = new Date()) {
  // Use IST (Asia/Kolkata) timezone for financial year calculation
  const istDate = new Date(
    date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );
  const year = istDate.getFullYear();
  const month = istDate.getMonth() + 1; // JS months are 0-based
  let fyStartYear = year;
  if (month < 4) fyStartYear = year - 1;
  // 2024-25: 247, 2025-26: 257, 2026-27: 267, etc.
  // 2000-01: 7, 2001-02: 17, 2002-03: 27, ...
  // So: prefix = (fyStartYear - 2000) * 10 + 7
  return String((fyStartYear - 2000) * 10 + 7);
}

// Helper to get the next Gate Entry Number from SAP (read only)
async function getNextRgpGateEntryNumberFromSAP() {
  const prefix = getFinancialYearPrefixRGP();
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
    console.error('[ERROR] Failed to fetch last RGP Gate Entry Number from SAP:', err?.response?.data || err.message);
    // fallback to local file if SAP fails
    let data = { lastGateEntryNumber: Number(prefix + '0000000') };
    try {
      if (fs.existsSync(rgpGateEntryNumPath)) {
        data = JSON.parse(fs.readFileSync(rgpGateEntryNumPath, 'utf8'));
      }
    } catch (e) {
      console.error('[ERROR] Failed to read local RGP gate entry file:', e.message);
    }
    const next = (parseInt(data.lastGateEntryNumber, 10) || Number(prefix + '0000000')) + 1;
    return next.toString();
  }
}

// Helper to get and increment the next Gate Entry Number (for POST)
function getNextRgpGateEntryNumberAndIncrement() {
  const prefix = getFinancialYearPrefixRGP();
  let data = { lastGateEntryNumber: Number(prefix + '0000000') };
  try {
    if (fs.existsSync(rgpGateEntryNumPath)) {
      data = JSON.parse(fs.readFileSync(rgpGateEntryNumPath, 'utf8'));
    }
  } catch (e) {
    console.error('[ERROR] Failed to read local RGP gate entry file:', e.message);
  }
  const next = (parseInt(data.lastGateEntryNumber, 10) || Number(prefix + '0000000')) + 1;
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

    // Fix SAP date format for Expecteddateofreturn
    let expectedDateOfReturn = req.body.Expecteddateofreturn || req.body.ExpectedDateOfReturn;
    if (expectedDateOfReturn && /^\d{4}-\d{2}-\d{2}$/.test(expectedDateOfReturn)) {
      expectedDateOfReturn = expectedDateOfReturn + 'T00:00:00';
    }

    // Convert InwardTime from 'HH:mm' to 'PTxxHxxM00S' for SAP
    let inwardTimeSAP = req.body.InwardTime;
    if (inwardTimeSAP && /^\d{2}:\d{2}$/.test(inwardTimeSAP)) {
      const [h, m] = inwardTimeSAP.split(':');
      inwardTimeSAP = `PT${h}H${m}M00S`;
    } else {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      inwardTimeSAP = `PT${hh}H${mm}M00S`;
    }

    // Extract line items from request
    const items = req.body.items || req.body.tableRows || [];
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one line item is required. Gate Entry will not be created.' });
    }

    // Prepare header payload for SAP (no material fields)
    const headerPayload = {
      GateEntryNumber: nextGateEntryNumber,
      GateEntryDate: gateEntryDate,
      InwardTime: inwardTimeSAP,
      FiscalYear: req.body.FiscalYear || new Date().getFullYear().toString(),
      Indicators: 'R',
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
      Expecteddateofreturn: expectedDateOfReturn || null,
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
    }

    // Use correct navigation property for line items
    const lineItemURL = `https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEINWARD_OUTWARDDETA(guid'${parentUUID}')/to_GateEntryItems`;
    //const lineItemURL = `https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS/YY1_GATEINWARD_OUTWARDDETA(guid'${parentUUID}')/to_GateEntryItems`;
    for (const row of items) {
      try {
        const returnableQty = parseFloat(row.returnableQuantity) || 0;
        const linePayload = {
          Material: row.materialCode || '',
          MaterialDescription: row.materialDescription || '',
          ReturnableQty: returnableQty.toString(),
          RemainQty: returnableQty.toString(),
          UOM: row.uom || '',
          ApproximateValue: row.approximateValue || '0.00',
          Remarks: row.remarks || '',
          Purpose: row.purpose || '',
        };
        await axios.post(lineItemURL, linePayload, {
          auth: { username: SAP_USER, password: SAP_PASS },
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
            Cookie: cookies.join(';'),
          },
        });
      } catch (lineErr) {
        // Rollback: delete the header if any line item fails
        try {
          await axios.delete(`${SAP_URL}(guid'${parentUUID}')`, {
            auth: { username: SAP_USER, password: SAP_PASS },
            headers: {
              'x-csrf-token': csrfToken,
              Cookie: cookies.join(';'),
            },
          });
        } catch (delErr) {
          console.error('[ERROR] Failed to rollback header after line item error:', delErr?.response?.data || delErr.message);
        }
        // Try to extract SAP error message and field
        let errorMsg = 'Failed to create line item. Gate Entry was not created.';
        let fieldHint = '';
        const details = lineErr?.response?.data || lineErr.message;
        if (typeof details === 'object' && details?.error?.message?.value) {
          errorMsg = details.error.message.value;
        } else if (typeof details === 'string') {
          errorMsg = details;
        }
        // Try to extract field name from SAP error message
        const fieldMatch = errorMsg.match(/Property (\w+)/i);
        if (fieldMatch) {
          fieldHint = ` (Field: ${fieldMatch[1]})`;
        }
        return res.status(500).json({ error: errorMsg + fieldHint, details });
      }
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
    const SAP_VENDOR_URL = 'https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_VENDOR_MASTER_CDS/YY1_Vendor_Master?$format=json';
 //  const SAP_VENDOR_URL = 'https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_VENDOR_MASTER_CDS/YY1_Vendor_Master?$format=json';
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
      const SAP_URL_BASE = 'https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
   // const SAP_URL_BASE = 'https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
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
    const prefix = getFinancialYearPrefixRGP();
  //  const SAP_URL_BASE = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
    const SAP_URL_BASE = 'https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
   // const SAP_URL_BASE = 'https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
    const filter = `startswith(GateEntryNumber,'${prefix}')`;
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
    //const SAP_URL_BASE = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
    const SAP_URL_BASE = 'https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
   // const SAP_URL_BASE = 'https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';

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
    //const SAP_URL_BASE = 'https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
      const SAP_URL_BASE = 'https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
 //  const SAP_URL_BASE = 'https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS';
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