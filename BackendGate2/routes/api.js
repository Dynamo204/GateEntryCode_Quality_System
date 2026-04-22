
require("dotenv").config();
const express = require("express");
const axios = require("axios");
const router = express.Router();
 
/* ================= SC OUTWARD HEADER UPDATE ================= */
router.post("/sc-out", async (req, res) => {
  try {
    const { GateEntryNumber, OutwardTime, VehicleStatus, GateOutDate } = req.body;
    if (!GateEntryNumber || !OutwardTime || !VehicleStatus) {
      return res.status(400).json({ error: "Missing GateEntryNumber, OutwardTime, or VehicleStatus" });
    }
 
    // Fetch CSRF token and cookies
    const { token, cookies } = await fetchCsrf();
 
    // Fetch header by GateEntryNumber to get SAP_UUID
    const headerUrl = `/YY1_GATEINWARD_OUTWARDDETA?$filter=GateEntryNumber eq '${GateEntryNumber}'&$format=json`;
    const headerResp = await sapGate.get(headerUrl);
    const header = headerResp.data?.d?.results?.[0];
    if (!header || !header.SAP_UUID) {
      return res.status(404).json({ error: "Gate Entry not found or missing SAP_UUID" });
    }
 
    // PATCH header with VehicleStatus and OutwardTime
    const patchUrl = `/YY1_GATEINWARD_OUTWARDDETA(guid'${header.SAP_UUID}')`;
    const patchBody = {
      VehicleStatus,
      OutwardTime,
      GateOutDate: `/Date(${new Date(GateOutDate || new Date().toISOString().split("T")[0]).getTime()})/`,
    };
    await sapGate.patch(patchUrl, patchBody, {
      headers: {
        "X-CSRF-Token": token,
        Cookie: cookies.join(";"),
      },
    });
 
    res.json({ status: "Header updated", SAP_UUID: header.SAP_UUID });
  } catch (err) {
    console.error("SC OUT ERROR:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to update SC Outward header" });
  }
});
 
/* ================= SAP CONFIG ================= */
 //Customizing
//const SAP_GATE_BASE ="https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS";
 //const SAP_PO_BASE ="https://my430301-api.s4hana.cloud.sap/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001";
 //const SAP_VENDOR_BASE ="https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_VENDOR_MASTER_CDS";
 // Quality 
 const SAP_GATE_BASE ="https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS";
 const SAP_PO_BASE ="https://my430382-api.s4hana.cloud.sap/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001";
 const SAP_VENDOR_BASE ="https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_VENDOR_MASTER_CDS";

 // production
//  const SAP_GATE_BASE ="https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS";
//  const SAP_PO_BASE ="https://my437207-api.s4hana.cloud.sap/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001";
//  const SAP_VENDOR_BASE ="https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_VENDOR_MASTER_CDS";
 
const SAP_GATE_AUTH = {
  username: "BTPINTEGRATION",
  password: "BTPIntegration@1234567890",
};
 
const SAP_PO_AUTH = {
  username: "BTPINTEGRATION",
  password: "BTPIntegration@1234567890",
};
 
const SAP_VENDOR_AUTH = {
  username: "BTPINTEGRATION",
  password: "BTPIntegration@1234567890",
};
 
/* ================= AXIOS ================= */
 
// PO (OData V4 – no CSRF)
const sapPO = axios.create({
  baseURL: SAP_PO_BASE,
  auth: SAP_PO_AUTH,
  headers: { Accept: "application/json" },
});
 
// Gate (OData V2 – CSRF required)
const sapGate = axios.create({
  baseURL: SAP_GATE_BASE,
  auth: SAP_GATE_AUTH,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});
 
// Vendor Master (OData V2 – no CSRF needed for reads)
const sapVendor = axios.create({
  baseURL: SAP_VENDOR_BASE,
  auth: SAP_VENDOR_AUTH,
  headers: { Accept: "application/json" },
});
 
/* ================= CSRF ================= */
 
async function fetchCsrf() {
  const res = await sapGate.get("/YY1_GATEINWARD_OUTWARDDETA", {
    headers: { "X-CSRF-Token": "Fetch" },
  });
 
  return {
    token: res.headers["x-csrf-token"],
    cookies: res.headers["set-cookie"],
  };
}

function toNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildPoItemKey(poNumber, poItem, material) {
  return [poNumber, poItem, material].map((part) => String(part || "").trim()).join("__");
}

function calculateRemainingQuantity(totalPoQuantity, totalReceivedQuantity) {
  return Math.max(toNumber(totalPoQuantity) - toNumber(totalReceivedQuantity), 0);
}

function buildReceivedQuantityMap(results = []) {
  return results.reduce((map, item) => {
    const key = buildPoItemKey(item.PurchaseOrderNumber, item.PurchaseOrderItem, item.Material);
    map[key] = (map[key] || 0) + toNumber(item.RecivedQty ?? item.ReceivedQty);
    return map;
  }, {});
}
 
/* ================= GET ALL PO NUMBERS ================= */
 
router.get("/all-po-numbers", async (req, res) => {
  try {
    const poResponse = await sapPO.get(
      `/PurchaseOrder?$select=PurchaseOrder&$top=1000`
    );
 
    const poNumbers = [
      ...new Set(poResponse.data.value.map(po => po.PurchaseOrder))
    ].sort();
 
    res.json({ poNumbers });
  } catch (err) {
    console.error("ALL PO ERROR:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch PO numbers", poNumbers: [] });
  }
});
 
/* ================= PO DETAILS ================= */
 
router.get("/po-details", async (req, res) => {
  try {
    const { poNumber } = req.query;
 
    // Fetch PO header (for Supplier), PO items, and already-used quantities in parallel
    const [poHeaderResp, poItemsResp, usedResp] = await Promise.all([
      sapPO.get(`/PurchaseOrder?$filter=PurchaseOrder eq '${poNumber}'&$select=PurchaseOrder,Supplier`),
      sapPO.get(`/PurchaseOrderItem?$filter=PurchaseOrder eq '${poNumber}'`),
      sapGate.get(`/YY1_GATEENTRYITEMS_GATEINWA000?$filter=PurchaseOrderNumber eq '${poNumber}'`),
    ]);
 
    // Extract Supplier from PO header
    const supplier = poHeaderResp.data?.value?.[0]?.Supplier || "";
 
    // Fetch Vendor Name from Vendor Master if supplier exists
    let vendorName = "";
    if (supplier) {
      try {
        const vendorResp = await sapVendor.get(
          `/YY1_Vendor_Master?$filter=Supplier eq '${supplier}'&$select=Supplier,SupplierName&$format=json`
        );
        vendorName = vendorResp.data?.d?.results?.[0]?.SupplierName || "";
      } catch (vendorErr) {
        console.error("VENDOR MASTER ERROR:", vendorErr.response?.data || vendorErr.message);
      }
    }

    const receivedQtyMap = buildReceivedQuantityMap(usedResp.data?.d?.results || []);
 
    res.json({
      vendor: supplier,
      vendorName,
      items: poItemsResp.data.value.map((i) => {
        const orderedQty = toNumber(i.OrderQuantity);
        const totalReceivedQty = receivedQtyMap[
          buildPoItemKey(poNumber, i.PurchaseOrderItem, i.Material)
        ] || 0;
        const remainQty = calculateRemainingQuantity(orderedQty, totalReceivedQty);

        return {
          PurchaseOrderItem: i.PurchaseOrderItem,
          Material: i.Material,
          MaterialDescription: i.PurchaseOrderItemText,
          OrderedQty: orderedQty,
          TotalReceivedQty: totalReceivedQty,
          RemainQty: remainQty,
          Vendor: supplier,
          VendorName: vendorName,
        };
      }),
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "PO fetch failed" });
  }
});
 
/* ================= NEXT SC GATE NUMBER ================= */
 
 
// Helper to get the SC prefix for the current financial year (like NRGP)
function getFinancialYearPrefixSC(date = new Date()) {
  // Financial year starts April 1st
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // JS months are 0-based
  let fyStartYear = year;
  if (month < 4) fyStartYear = year - 1;
  // 2024-25: 247, 2025-26: 257, 2026-27: 267, etc.
  // 2000-01: 7, 2001-02: 17, 2002-03: 27, ...
  // So: prefix = (fyStartYear - 2000) * 10 + 7
  return String((fyStartYear - 2000) * 10 + 7);
}
 
function computeNextGateEntryNumber(prefix, latest) {
  if (!latest) {
    return prefix + "0000001";
  }
 
  const suffix = latest.slice(prefix.length);
  const next = (parseInt(suffix, 10) || 0) + 1;
  return prefix + String(next).padStart(7, "0");
}
 
function toSapDurationTime(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
 
    // Already in SAP duration format
    if (/^PT\d{2}H\d{2}M\d{2}S$/.test(trimmed)) {
      return trimmed;
    }
 
    // Accept HH:mm or HH:mm:ss from UI and convert
    const hmsMatch = trimmed.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (hmsMatch) {
      const [, hh, mm, ss = "00"] = hmsMatch;
      return `PT${hh}H${mm}M${ss}S`;
    }
 
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const hh = String(parsed.getHours()).padStart(2, "0");
      const mm = String(parsed.getMinutes()).padStart(2, "0");
      const ss = String(parsed.getSeconds()).padStart(2, "0");
      return `PT${hh}H${mm}M${ss}S`;
    }
  }
 
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `PT${hh}H${mm}M${ss}S`;
}
 
router.get("/next-gatenumber-SC", async (req, res) => {
  try {
    // Use current date to determine prefix for current FY
    const prefix = getFinancialYearPrefixSC();
    // Do NOT encodeURIComponent the filter string, let axios handle URL encoding
    const filter = `startswith(GateEntryNumber,'${prefix}')`;
    const url = `/YY1_GATEINWARD_OUTWARDDETA?$filter=${filter}&$orderby=GateEntryNumber desc&$top=1&$format=json`;
    const response = await sapGate.get(url);
    const results = response.data?.d?.results || [];
    const latest = results.length ? results[0].GateEntryNumber : null;
    const next = computeNextGateEntryNumber(prefix, latest);
    res.json({ next });
  } catch (err) {
    console.error("SC NUMBER ERROR:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to generate SC gate number" });
  }
});
 
/* ================= CREATE HEADER ================= */
 
router.post("/sc", async (req, res) => {
  try {
    const { token, cookies } = await fetchCsrf();
 
    const transportMode =
      req.body.TransportMode || req.body.TransporterMode || "Truck";
 
    // Only include SAP-supported fields in the payload
    const payload = {
      GateEntryNumber: req.body.GateEntryNumber,
      GateEntryDate: `/Date(${new Date(req.body.GateEntryDate).getTime()})/`,
      Indicators: "SC",
      FiscalYear: String(new Date().getFullYear()),
      Division: "01",
      InwardTime: toSapDurationTime(req.body.InwardTime),
      SAP_LifecycleStatus: "A",
 
      TransportMode: transportMode,
 
      VehicleNumber: req.body.VehicleNumber || "",
      TransporterName: req.body.TransporterName || "",
      DriverName: req.body.DriverName || "",
      HelperName: req.body.HelperName || "",
      DriverPhoneNumber: req.body.DriverPhoneNumber || "",
      DLNumber: req.body.DLNumber || "",
 
      PersonName: req.body.PersonName || "",
 
      VendorInvoiceNumber: req.body.VendorInvoiceNumber || "",
      VendorInvoiceDate: req.body.VendorInvoiceDate
        ? `/Date(${new Date(req.body.VendorInvoiceDate).getTime()})/`
        : null,
 
      PurchaseOrderNumber: req.body.PurchaseOrderNumber || "",
      PurchaseOrderNumber2: req.body.PurchaseOrderNumber2 || "",
      PurchaseOrderNumber3: req.body.PurchaseOrderNumber3 || "",
      PurchaseOrderNumber4: req.body.PurchaseOrderNumber4 || "",
      PurchaseOrderNumber5: req.body.PurchaseOrderNumber5 || "",
 
      EWayBill: Boolean(req.body.EWayBill),
      NetWeight: req.body.NetWeight
        ? String(Number(req.body.NetWeight).toFixed(3))
        : "0.000",
    };
 
    const sapRes = await sapGate.post(
      "/YY1_GATEINWARD_OUTWARDDETA",
      payload,
      {
        headers: {
          "X-CSRF-Token": token,
          Cookie: cookies.join(";"),
        },
      }
    );
 
    const uuid = sapRes.data?.d?.SAP_UUID || sapRes.data?.SAP_UUID;
 
    if (!uuid) {
      return res.status(400).json({ error: "SAP UUID missing" });
    }
 
    res.json({ SAP_UUID: uuid });
 
  } catch (err) {
    console.error("HEADER ERROR:", err.response?.data || err.message);
    res.status(400).json({ error: "Header creation failed" });
  }
});
 
/* ================= CREATE ITEM ================= */
 
router.post("/gateentry/item", async (req, res) => {
  try {
    const { token, cookies } = await fetchCsrf();
    const parentUUID = req.body.SAP_PARENT_UUID;
    const poNumber = req.body.PurchaseOrderNumber;
    const poItem = req.body.PurchaseOrderItem;
    const material = req.body.Material;
    const currentReceivedQty = toNumber(req.body.ReceivedQty);

    const [poItemResp, usedResp] = await Promise.all([
      sapPO.get(
        `/PurchaseOrderItem?$filter=PurchaseOrder eq '${poNumber}' and PurchaseOrderItem eq '${poItem}'`
      ),
      sapGate.get(`/YY1_GATEENTRYITEMS_GATEINWA000?$filter=PurchaseOrderNumber eq '${poNumber}'`),
    ]);

    const matchedPoItem = (poItemResp.data?.value || []).find(
      (item) => String(item.PurchaseOrderItem || "").trim() === String(poItem || "").trim()
        && String(item.Material || "").trim() === String(material || "").trim()
    );

    if (!matchedPoItem) {
      return res.status(400).json({ error: "PO item not found for remaining quantity calculation" });
    }

    const orderedQty = toNumber(matchedPoItem.OrderQuantity);
    const receivedQtyMap = buildReceivedQuantityMap(usedResp.data?.d?.results || []);
    const existingReceivedQty = receivedQtyMap[buildPoItemKey(poNumber, poItem, material)] || 0;

    if (currentReceivedQty <= 0) {
      return res.status(400).json({ error: "Received quantity must be greater than zero" });
    }

    const newRemainingQty = calculateRemainingQuantity(
      orderedQty,
      existingReceivedQty + currentReceivedQty
    );
 
    await sapGate.post(
      `/YY1_GATEINWARD_OUTWARDDETA(guid'${parentUUID}')/to_GateEntryItems`,
      {
        PurchaseOrderNumber: poNumber,
        PurchaseOrderItem: poItem,
        Material: material,
        MaterialDescription: req.body.MaterialDescription,
        RecivedQty: String(currentReceivedQty), // SAP expects 'RecivedQty' (typo in SAP schema)
        RemainQty: String(newRemainingQty),
        BalanceQty: String(newRemainingQty),
        VendorInvoiceNumber: req.body.VendorInvoiceNumber,
        VendorInvoicedate: req.body.VendorInvoiceDate
          ? `/Date(${new Date(req.body.VendorInvoiceDate).getTime()})/`
          : null,
        Vendor: req.body.Vendor || "",
        VendorName: req.body.VendorName || "",
      },
      {
        headers: {
          "X-CSRF-Token": token,
          Cookie: cookies.join(";"),
        },
      }
    );
 
    res.json({ status: "ITEM_CREATED", RemainQty: newRemainingQty, BalanceQty: newRemainingQty });
 
  } catch (err) {
    console.error("ITEM ERROR:", err.response?.data || err.message);
    res.status(500).json({ error: "Item creation failed" });
  }
});
 
/* ================= FETCH SC LINE ITEMS ================= */
 
// GET /api/gateentry/items?parentUUID=...
router.get("/gateentry/items", async (req, res) => {
  try {
    const parentUUID = req.query.parentUUID;
    if (!parentUUID) {
      return res.status(400).json({ error: "Missing parentUUID query parameter" });
    }
    // SAP OData navigation property for line items
    const lineItemsUrl = `/YY1_GATEINWARD_OUTWARDDETA(guid'${parentUUID}')/to_GateEntryItems?$format=json`;
    const resp = await sapGate.get(lineItemsUrl);
    // Defensive: return .d.results or empty array
    const items = resp.data?.d?.results || [];
    res.json({ items });
  } catch (err) {
    console.error("SC LINE ITEMS ERROR:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch SC line items" });
  }
});
 
module.exports = router;
 