require("dotenv").config();
const express = require("express");
const axios = require("axios");
const router = express.Router();

/* ================= SC OUTWARD HEADER UPDATE ================= */
router.post("/sc-out", async (req, res) => {
  try {
    const { GateEntryNumber, OutwardTime, VehicleStatus } = req.body;
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

const SAP_GATE_BASE =
  "https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS";

const SAP_PO_BASE =
  "https://my430301-api.s4hana.cloud.sap/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001";

const SAP_GATE_AUTH = {
  username: "BTPINTEGRATION",
  password: "BTPIntegration@1234567890",
};

const SAP_PO_AUTH = {
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

    const poItems = await sapPO.get(
      `/PurchaseOrderItem?$filter=PurchaseOrder eq '${poNumber}'`
    );

    const used = await sapGate.get(
      `/YY1_GATEENTRYITEMS_GATEINWA000?$filter=PurchaseOrderNumber eq '${poNumber}'`
    );

    const usedMap = {};
    used.data.d.results.forEach((i) => {
      usedMap[i.PurchaseOrderItem] = Number(i.RemainQty);
    });

    res.json({
      items: poItems.data.value.map((i) => ({
        PurchaseOrderItem: i.PurchaseOrderItem,
        Material: i.Material,
        MaterialDescription: i.PurchaseOrderItemText,
        OrderedQty: Number(i.OrderQuantity),
        RemainQty:
          usedMap[i.PurchaseOrderItem] !== undefined
            ? usedMap[i.PurchaseOrderItem]
            : Number(i.OrderQuantity),
      })),
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "PO fetch failed" });
  }
});

/* ================= NEXT SC GATE NUMBER ================= */

function buildPrefixFromYearAndCode(yearInput, codeInput) {
  const year = Number(yearInput);
  const code = String(codeInput);

  if (!year || !code) {
    throw new Error("Invalid year or code");
  }

  // SAFE & SIMPLE PREFIX (NO MONTH LOGIC)
  const fyShort = String(year).slice(-2);
  return `${fyShort}${code}`;
}

function computeNextGateEntryNumber(prefix, latest) {
  if (!latest) {
    return prefix + "0000001";
  }

  const suffix = latest.slice(prefix.length);
  const next = (parseInt(suffix, 10) || 0) + 1;
  return prefix + String(next).padStart(7, "0");
}

router.get("/next-gatenumber-SC", async (req, res) => {
  try {
    const { year, code } = req.query;

    if (!year || !code) {
      return res.status(400).json({
        error: `Year and Code are required. Received Year: ${year}, Code: ${code}`
      });
    }

    const prefix = buildPrefixFromYearAndCode(year, code);

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
      InwardTime: "PT00H00M00S",
      SAP_LifecycleStatus: "A",

      TransportMode: transportMode,

      VehicleNumber: req.body.VehicleNumber || "",
      TransporterName: req.body.TransporterName || "",
      DriverName: req.body.DriverName || "",
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

    await sapGate.post(
      `/YY1_GATEINWARD_OUTWARDDETA(guid'${parentUUID}')/to_GateEntryItems`,
      {
        PurchaseOrderNumber: req.body.PurchaseOrderNumber,
        PurchaseOrderItem: req.body.PurchaseOrderItem,
        Material: req.body.Material,
        MaterialDescription: req.body.MaterialDescription,
        RecivedQty: String(req.body.ReceivedQty), // SAP expects 'RecivedQty' (typo in SAP schema)
        RemainQty: String(req.body.RemainQty),
        BalanceQty: String(req.body.RemainQty),
        VendorInvoiceNumber: req.body.VendorInvoiceNumber,
        VendorInvoicedate: req.body.VendorInvoiceDate
          ? `/Date(${new Date(req.body.VendorInvoiceDate).getTime()})/`
          : null,
      },
      {
        headers: {
          "X-CSRF-Token": token,
          Cookie: cookies.join(";"),
        },
      }
    );

    res.json({ status: "ITEM_CREATED" });

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