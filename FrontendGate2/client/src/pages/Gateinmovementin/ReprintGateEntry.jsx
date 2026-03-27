import React, { useMemo, useState } from "react";
import axios from "axios";
import html2pdf from "html2pdf.js";
import { Link } from "react-router-dom";
import {
  API_BASE,
  fetchGateEntryByNumber,
  fetchScLineItems,
} from "../../api";
import "./ReprintGateEntry.css";

const NON_PRINTABLE_HEADER_KEYS = new Set([
  "__metadata",
  "to_GateEntryItems",
  "to_WeightDetails",
]);

const isTechnicalKey = (key = "") => {
  const normalized = String(key || "").trim();
  if (!normalized) return true;
  if (NON_PRINTABLE_HEADER_KEYS.has(normalized)) return true;
  if (/^sap_/i.test(normalized)) return true;
  return false;
};

const PREFERRED_ITEM_COLUMNS = [
  "PurchaseOrderItem",
  "Material",
  "MaterialDescription",
  "OrderedQty",
  "RemainQty",
  "EnteredQty",
  "ReturnableQty",
  "UOM",
  "VendorInvoiceNumber",
  "VendorInvoiceDate",
  "Type",
  "Remarks",
  "Purpose",
  "ApproximateValue",
];

const formatValue = (value) => {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && value.startsWith("/Date(")) {
    const ms = Number(value.replace(/\D/g, ""));
    if (!Number.isNaN(ms)) return new Date(ms).toLocaleDateString("en-GB");
  }
  if (typeof value === "string" && /^PT(\d+H)?(\d+M)?(\d+S)?$/.test(value)) {
    const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    const h = String(match?.[1] ? Number(match[1]) : 0).padStart(2, "0");
    const m = String(match?.[2] ? Number(match[2]) : 0).padStart(2, "0");
    const s = String(match?.[3] ? Number(match[3]) : 0).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "-";
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime()) && trimmed.includes("T")) {
      return `${parsed.toLocaleDateString("en-GB")} ${parsed.toLocaleTimeString("en-GB")}`;
    }
    return trimmed;
  }
  return String(value);
};

const isMeaningfulValue = (value) => {
  if (value === undefined || value === null) return false;

  if (typeof value === "boolean") return true;

  if (typeof value === "number") {
    return Number.isFinite(value) && value !== 0;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return false;

    const lowered = trimmed.toLowerCase();
    if (["null", "undefined", "na", "n/a", "none", "-", "invalid date"].includes(lowered)) {
      return false;
    }

    if (trimmed === "PT00H00M00S") return false;

    if (/^0+(\.0+)?$/.test(trimmed)) return false;

    return true;
  }

  return true;
};

const displayValue = (value) => (isMeaningfulValue(value) ? formatValue(value) : "");

const getResults = (payload) => payload?.d?.results || payload?.results || [];

const getLineItemsFromResponse = (payload) => {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.d?.results)) return payload.d.results;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const pickSlipTag = (header = {}) => {
  const gateEntryNumber = String(header.GateEntryNumber || "");
  const indicator = String(header.Indicators || "").toUpperCase();
  if (gateEntryNumber.startsWith("257")) return "RGP";
  if (gateEntryNumber.startsWith("258")) return "NRGP";
  if (indicator === "I") return "INWARD";
  if (indicator === "O") return "OUTWARD";
  if (indicator === "SC") return "SC";
  if (indicator === "CP") return "CASHPURCHASE";
  return "GATEENTRY";
};

const toPrintableHeaderEntries = (header = {}) =>
  Object.entries(header)
    .filter(([key, value]) => {
      if (isTechnicalKey(key)) return false;
      if (!isMeaningfulValue(value)) return false;
      if (typeof value === "object") return false;
      return true;
    })
    .sort(([a], [b]) => a.localeCompare(b));

const resolveItemColumns = (items) => {
  if (!items.length) return [];
  const availableKeys = new Set();
  items.forEach((item) => {
    Object.keys(item || {}).forEach((key) => {
      if (isTechnicalKey(key)) return;
      const val = item?.[key];
      if (typeof val !== "object" && isMeaningfulValue(val)) {
        availableKeys.add(key);
      }
    });
  });

  const preferred = PREFERRED_ITEM_COLUMNS.filter((key) => availableKeys.has(key));
  if (preferred.length) return preferred.slice(0, 8);

  return Array.from(availableKeys).slice(0, 8);
};

export default function ReprintGateEntry() {
  const [gateEntryNumber, setGateEntryNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [headerData, setHeaderData] = useState(null);
  const [lineItems, setLineItems] = useState([]);

  const headerEntries = useMemo(() => toPrintableHeaderEntries(headerData || {}), [headerData]);
  const itemColumns = useMemo(() => resolveItemColumns(lineItems), [lineItems]);

  const fetchLineItemsForGate = async (header, gateNo) => {
    const tasks = [
      fetchScLineItems(header?.SAP_UUID),
      axios.get(`${API_BASE}/rgpprocess/${gateNo}/items`),
      axios.get(`${API_BASE}/nrgpprocess/${gateNo}/items`),
    ];

    const [scResult, rgpResult, nrgpResult] = await Promise.allSettled(tasks);

    const scItems = scResult.status === "fulfilled" ? getLineItemsFromResponse(scResult.value.data) : [];
    const rgpItems = rgpResult.status === "fulfilled" ? getLineItemsFromResponse(rgpResult.value.data) : [];
    const nrgpItems = nrgpResult.status === "fulfilled" ? getLineItemsFromResponse(nrgpResult.value.data) : [];

    const slipTag = pickSlipTag(header);

    const filterMeaningfulRows = (items = []) =>
      items.filter((item) =>
        Object.entries(item || {}).some(([key, val]) => {
          if (isTechnicalKey(key)) return false;
          if (typeof val === "object") return false;
          return isMeaningfulValue(val);
        })
      );

    const cleanScItems = filterMeaningfulRows(scItems);
    const cleanRgpItems = filterMeaningfulRows(rgpItems);
    const cleanNrgpItems = filterMeaningfulRows(nrgpItems);

    if (slipTag === "RGP" && cleanRgpItems.length) return cleanRgpItems;
    if (slipTag === "NRGP" && cleanNrgpItems.length) return cleanNrgpItems;
    if (cleanScItems.length) return cleanScItems;
    if (cleanRgpItems.length) return cleanRgpItems;
    if (cleanNrgpItems.length) return cleanNrgpItems;

    return [];
  };

  const handleFetch = async () => {
    const gateNo = gateEntryNumber.trim();
    if (!gateNo) {
      setError("Please enter Gate Entry Number");
      return;
    }

    setLoading(true);
    setError("");
    setStatusMessage("");

    try {
      const headerResp = await fetchGateEntryByNumber(gateNo);
      const headerResults = getResults(headerResp.data);
      const header = headerResults[0];

      if (!header) {
        setHeaderData(null);
        setLineItems([]);
        setError(`No data found for Gate Entry Number ${gateNo}`);
        return;
      }

      const items = await fetchLineItemsForGate(header, gateNo);
      setHeaderData(header);
      setLineItems(items);
      setStatusMessage(`Data fetched for Gate Entry Number ${gateNo}`);
    } catch (err) {
      const backendError = err?.response?.data?.error || err?.response?.data?.message;
      setHeaderData(null);
      setLineItems([]);
      setError(backendError || err?.message || "Failed to fetch gate entry data");
    } finally {
      setLoading(false);
    }
  };

  const buildSlipElement = async () => {
    const now = new Date();
    const printDate = now.toLocaleDateString("en-GB");
    const printTime = now.toLocaleTimeString("en-GB");

    let logoDataUrl = "";
    try {
      const logoRes = await fetch("/Minera_Logo.jpg");
      const logoBlob = await logoRes.blob();
      logoDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ""));
        reader.readAsDataURL(logoBlob);
      });
    } catch (_err) {
      logoDataUrl = "";
    }

    const element = document.createElement("div");

    const usedHeaderKeys = new Set();
    const slipFields = [];

    const addField = (label, value, keyName = null) => {
      if (!isMeaningfulValue(value)) return;
      slipFields.push({ label, value: formatValue(value) });
      if (keyName) usedHeaderKeys.add(keyName);
    };

    addField("Gate Entry No", headerData?.GateEntryNumber, "GateEntryNumber");
    addField("Print Date", printDate);
    addField("Print Time", printTime);
    addField("Slip Type", pickSlipTag(headerData));
    addField("Vehicle No", headerData?.VehicleNumber, "VehicleNumber");
    addField("Transporter", headerData?.TransporterName, "TransporterName");
    addField("Driver Name", headerData?.DriverName, "DriverName");
    addField("Vendor Name", headerData?.VendorName, "VendorName");
    addField("Mode Of Transport", headerData?.ModeOfTransport, "ModeOfTransport");
    addField("Indicator", headerData?.Indicators, "Indicators");

    headerEntries.forEach(([key, value]) => {
      if (usedHeaderKeys.has(key)) return;
      addField(key, value, key);
    });

    const detailItems = slipFields
      .map(
        ({ label, value }) =>
          `<div style="display:flex; gap:4px; padding:2px 0;">
            <span style="font-weight:600; min-width:130px; flex-shrink:0;">${label}</span>
            <span style="margin:0 4px;">:</span>
            <span>${value}</span>
          </div>`
      )
      .join("");

    const itemHead = itemColumns
      .map((col) => `<th style="border:1px solid #000; padding:4px; text-align:left;">${col}</th>`)
      .join("");

    const itemRows = lineItems
      .map((item, index) => {
        const cells = itemColumns
          .map((col) => `<td style="border:1px solid #000; padding:4px;">${displayValue(item?.[col])}</td>`)
          .join("");
        return `<tr><td style="border:1px solid #000; padding:4px; text-align:center;">${index + 1}</td>${cells}</tr>`;
      })
      .join("");

    element.innerHTML = `
      <div style="font-family: Arial, sans-serif; color:#000; background:#fff; max-width:700px; margin:0 auto; font-size:10px;">
        <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #000; padding-bottom:2px; margin-bottom:4px;">
          <div>
            <div style="font-size:13px; font-weight:bold;">Minera Steel &amp; Power Pvt Ltd</div>
            <div style="font-size:9px;">Yerabanahalli Village, Sandur Taluk, Ballari Dist, Karnataka - 583115</div>
          </div>
          ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Logo" style="height:28px; width:auto; margin-left:8px;" />` : ""}
        </div>

        <div style="font-size:10px; font-weight:bold; margin-bottom:4px;">Gate Entry Details</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0 16px; margin-bottom:8px; font-size:8.5px;">
          ${detailItems || '<span style="color:#666;">No details available</span>'}
        </div>

        <div style="font-size:10px; font-weight:bold; margin-bottom:2px;">Item Details</div>
        <table style="width:100%; border:1px solid #000; border-collapse:collapse; font-size:8.5px;">
          <thead>
            <tr>
              <th style="border:1px solid #000; padding:4px; text-align:center; width:40px;">#</th>
              ${itemHead}
            </tr>
          </thead>
          <tbody>
            ${itemRows || `<tr><td colspan="${itemColumns.length + 1}" style="border:1px solid #000; padding:4px; text-align:center;">No line items available</td></tr>`}
          </tbody>
        </table>

        <div style="margin-top:10px; display:flex; justify-content:space-between; font-size:9px;">
          <div style="text-align:center; width:32%;">Security Officer<br/>__________</div>
          <div style="text-align:center; width:32%;">Dept. In-charge<br/>__________</div>
          <div style="text-align:center; width:32%;">Authorized Sign<br/>__________</div>
        </div>
      </div>
    `;

    return element;
  };

  const generatePdfBlob = async () => {
    const element = await buildSlipElement();
    const worker = html2pdf().from(element).set({
      margin: [8, 8, 8, 8],
      filename: `GateEntry_${headerData?.GateEntryNumber || "Slip"}.pdf`,
      html2canvas: { scale: 1.5, useCORS: true },
      jsPDF: { unit: "mm", format: [210, 148], orientation: "portrait", compress: true },
      pagebreak: { mode: "avoid-all" },
    });

    return worker.outputPdf("blob");
  };

  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const fullDataUrl = String(reader.result || "");
        resolve(fullDataUrl.includes(",") ? fullDataUrl.split(",")[1] : fullDataUrl);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const handlePrint = async () => {
    if (!headerData) return;
    setPrinting(true);
    setError("");

    try {
      const pdfBlob = await generatePdfBlob();
      const pdfBase64 = await blobToBase64(pdfBlob);
      const fileName = `GateEntry_${headerData?.GateEntryNumber || "Slip"}.pdf`;
      const response = await axios.post(`${API_BASE}/printer/print`, { pdfBase64, fileName });
      setStatusMessage(response?.data?.message || "Print request sent successfully");
    } catch (err) {
      const backendError = err?.response?.data?.error || err?.response?.data?.message;
      setError(backendError || err?.message || "Failed to print slip");
    } finally {
      setPrinting(false);
    }
  };

  const handleDownload = async () => {
    if (!headerData) return;
    setDownloading(true);
    setError("");

    try {
      const pdfBlob = await generatePdfBlob();
      const fileName = `GateEntry_${headerData?.GateEntryNumber || "Slip"}.pdf`;
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.setAttribute("download", fileName);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage("Slip downloaded successfully");
    } catch (err) {
      setError(err?.message || "Failed to download slip");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="reprint-page">
      <header className="reprint-header">
        <div>
          <h2>Gate Entry Reprint</h2>
          <p>Search by Gate Entry Number and print or download the slip.</p>
        </div>
        <Link to="/home" className="reprint-back-btn">Back to Home</Link>
      </header>

      <section className="reprint-card">
        <label htmlFor="reprint-gate-number">Gate Entry Number</label>
        <div className="reprint-actions-row">
          <input
            id="reprint-gate-number"
            type="text"
            value={gateEntryNumber}
            onChange={(e) => setGateEntryNumber(e.target.value)}
            placeholder="Enter Gate Entry Number"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleFetch();
              }
            }}
          />
          <button
            type="button"
            onClick={handleFetch}
            className="reprint-primary-btn"
            disabled={loading}
          >
            {loading ? "Fetching..." : "Fetch Data"}
          </button>
        </div>

        {error && <div className="reprint-error">{error}</div>}
        {statusMessage && <div className="reprint-status">{statusMessage}</div>}
      </section>

      {headerData && (
        <section className="reprint-card">
          <div className="reprint-result-head">
            <h3>Fetched Data</h3>
            <div className="reprint-cta-group">
              <button
                type="button"
                onClick={handlePrint}
                className="reprint-primary-btn"
                disabled={printing}
              >
                {printing ? "Printing..." : "Print"}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="reprint-secondary-btn"
                disabled={downloading}
              >
                {downloading ? "Downloading..." : "Download Slip"}
              </button>
            </div>
          </div>

          <div className="reprint-grid">
            {headerEntries.map(([key, value]) => (
              <div key={key} className="reprint-grid-item">
                <span className="k">{key}</span>
                <span className="v">{displayValue(value)}</span>
              </div>
            ))}
          </div>

          <div className="reprint-table-wrap">
            <table className="reprint-table">
              <thead>
                <tr>
                  <th>#</th>
                  {itemColumns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!lineItems.length && (
                  <tr>
                    <td colSpan={Math.max(itemColumns.length + 1, 2)} className="reprint-empty-row">
                      No line items found for this gate entry.
                    </td>
                  </tr>
                )}
                {lineItems.map((row, index) => (
                  <tr key={row.SAP_UUID || `${row.Material || "row"}-${index}`}>
                    <td>{index + 1}</td>
                    {itemColumns.map((column) => (
                      <td key={`${column}-${index}`}>{displayValue(row?.[column])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
