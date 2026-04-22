require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(cors()); // Allow all origins for development

// SAP Credentials
const SAP_URL =
//  "https://my430301-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS";
     "https://my430382-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS";
//    "https://my437207-api.s4hana.cloud.sap/sap/opu/odata/sap/YY1_GATEINWARD_OUTWARDDETA_CDS";
const SAP_USER = "BTPINTEGRATION";
const SAP_PASS = "BTPIntegration@1234567890";

// 1️⃣ GET PO DETAILS
app.get("/api/po-details", async (req, res) => {
  const { poNumber } = req.query;

  if (!poNumber) return res.status(400).json({ error: "PO Number required" });

  try {
    const url = `${SAP_URL}/YY1_GATEENTRYITEMS_GATEINWA000?$filter=PurchaseOrderNumber eq '${poNumber}'&$format=json`;

    const response = await axios.get(url, {
      auth: { username: SAP_USER, password: SAP_PASS },
      headers: { Accept: "application/json" },
    });

    const results = response.data.d.results;

    if (!results.length) return res.json({ message: "No PO found" });

    return res.json(results);
  } catch (err) {
    console.log("ERROR FETCHING PO:", err.response?.data || err.message);
    res.status(500).json({ error: "Error fetching PO data" });
  }
});

// 2️⃣ UPDATE REMAINING QTY
app.patch("/api/update-po", async (req, res) => {
  const { SAP_UUID, RemainQty } = req.body;

  if (!SAP_UUID || RemainQty === undefined)
    return res.status(400).json({ error: "SAP_UUID & RemainQty required" });

  try {
    const entityUrl = `${SAP_URL}/YY1_GATEENTRYITEMS_GATEINWA000(guid'${SAP_UUID}')`;

    // STEP A: GET CSRF TOKEN
    const tokenResp = await axios.get(entityUrl, {
      auth: { username: SAP_USER, password: SAP_PASS },
      headers: {
        "x-csrf-token": "fetch",
        Accept: "application/json",
      },
    });

    const csrfToken = tokenResp.headers["x-csrf-token"];
    const cookies = tokenResp.headers["set-cookie"];

    // STEP B: PATCH UPDATE
    await axios.patch(
      entityUrl,
      { RemainQty: `${RemainQty}` },
      {
        auth: { username: SAP_USER, password: SAP_PASS },
        headers: {
          "x-csrf-token": csrfToken,
          "Content-Type": "application/json",
          Cookie: cookies,
          Accept: "application/json",
        },
      }
    );

    return res.json({ message: "PO Updated Successfully" });
  } catch (err) {
    console.log("ERROR UPDATING PO:", err.response?.data || err.message);
    res.status(500).json({ error: "Error updating PO" });
  }
});

app.listen(4600, () => {
  console.log("Server running on port 4600");
});