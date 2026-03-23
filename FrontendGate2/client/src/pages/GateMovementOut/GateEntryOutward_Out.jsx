// Vehicle Out (Departure) - SD focused minimal screen
import React, { useState, useEffect } from "react";
import api, { fetchGateEntryByNumber } from "../../api";
import "./GateOutHome.css";

export default function GateEntryOutwardSD() {
  const todayISO = new Date().toISOString().split("T")[0];

  // --- date helper ---
  const parseSapDateToISODateOnly = (val) => {
    if (!val) return '';
    // OData v2 "/Date(167xxx)/" or "/Date(167xxx+0530)/"
    if (typeof val === 'string' && val.startsWith('/Date(')) {
      const m = val.match(/\/Date\(([-\d+]+)(?:[+-]\d+)?\)\//);      if (m) {
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

  // --- time helpers ---
  const hhmmssNow = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  };
  const hhmmssToSapDuration = (val) => {
    if (!val) return null;
    if (typeof val === "string" && /^\d{2}:\d{2}:\d{2}$/.test(val)) {
      const [h, m, s] = val.split(":").map(Number);
      return `PT${h}H${m}M${s}S`;
    }
    return val;
  };
  const sapDurationToHHMMSS = (val) => {
    if (!val) return "";
    if (typeof val === "string" && val.startsWith("PT")) {
      const mh = val.match(/(\d+)H/);
      const mm = val.match(/(\d+)M/);
      const ms = val.match(/(\d+)S/);
      const h = String(mh ? parseInt(mh[1], 10) : 0).padStart(2, "0");
      const m = String(mm ? parseInt(mm[1], 10) : 0).padStart(2, "0");
      const s = String(ms ? parseInt(ms[1], 10) : 0).padStart(2, "0");
      return `${h}:${m}:${s}`;
    }
    return val;
  };

  // --- GUID extraction ---
  const extractGuid = (rec) => {
    if (!rec) return null;
    return (
      rec.SAP_UUID ||
      rec.ID ||
      rec.Guid ||
      rec.GUID ||
      (() => {
        const idUrl = rec.__metadata?.id || rec.__metadata?.uri;
        if (idUrl) {
          const m = String(idUrl).match(/\(guid'([0-9a-fA-F-]{36})'\)/);
          return m ? m[1] : null;
        }
        return null;
      })()
    );
  };

  // helpers
  const first = (obj, keys) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return "";
  };

  // Try to build a materials array from common field patterns:
  // Material/MaterialDescription/Quantity/UOM/Batch with suffixes: "", "2".."5" for RGP
  const parseMaterials = (r = {}) => {
    const items = [];
    // RGP uses suffixes: "", "2", "3", "4", "5" (not "1")
    const suffixes = ["", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
    
    // For single-value fields (RGP has only one UOM/ApproximateValue/Purpose for entire entry)
    const singleUOM = r.UOM || "";
    const singleApproxValue = r.ApproximateValue || "";
    const singlePurpose = r.Purpose || "";
    
    for (const sfx of suffixes) {
      const code = first(r, [
        `Material${sfx}`,
        `SDMaterial${sfx}`,
        `ItemMaterial${sfx}`,
        `MatCode${sfx}`,
        `Material_Code${sfx}`,
      ]);
      const desc = first(r, [
        `MaterialDescription${sfx}`,
        `SDMaterialDescription${sfx}`,
        `ItemDescription${sfx}`,
        `MatDesc${sfx}`,
        `Material_Description${sfx}`,
      ]);
      const qty = first(r, [
        `Quantity${sfx}`,
        `Qty${sfx}`,
        `OrderQty${sfx}`,
        `DeliveryQty${sfx}`,
        `IssuedQty${sfx}`,
        `QtyIssued${sfx}`,
        `ReturnableQuantity${sfx}`,
      ]);
      const uom = first(r, [
        `UOM${sfx}`,
        `Unit${sfx}`,
        `UnitOfMeasure${sfx}`,
        `BaseUOM${sfx}`,
      ]) || singleUOM;
      const batch = first(r, [
        `Batch${sfx}`,
        `BatchNumber${sfx}`,
        `Lot${sfx}`,
      ]);
      const remarks = first(r, [
        `MaterialRemarks${sfx}`,
        `ItemRemarks${sfx}`,
        `Remark${sfx}`,
      ]);
      const approxValue = first(r, [
        `ApproximateValue${sfx}`,
        `ApproxValue${sfx}`,
        `Value${sfx}`,
      ]) || (sfx === "" ? singleApproxValue : "");
      const purpose = first(r, [
        `Purpose${sfx}`,
        `ItemPurpose${sfx}`,
      ]) || (sfx === "" ? singlePurpose : "");

      // Consider it a valid row if at least code/desc/qty are present
      if (String(code || desc || qty).trim() !== "") {
        items.push({
          code: String(code || "").trim(),
          desc: String(desc || "").trim(),
          qty: String(qty || "").trim(),
          uom: String(uom || "").trim(),
          batch: String(batch || "").trim(),
          remarks: String(remarks || "").trim(),
          approxValue: String(approxValue || "").trim(),
          purpose: String(purpose || "").trim(),
        });
      }
    }
    return items;
  };

  // --- mapping SD and RGP fields ---
  const hydrateFromSap = (r = {}) => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    const currentDate = now.toISOString().split("T")[0];
    
    // Parse gate entry date from SAP format
    const gateEntryDate = parseSapDateToISODateOnly(
      r.GateEntryDate || r.GateInDate || r.GateDate || r.InwardDate
    );
    
    const base = {
      GateEntryNumber: r.GateEntryNumber || "",
      VehicleStatus: r.VehicleStatus || r.status || "",
      GateEntryDate: gateEntryDate || "",
      GateOutDate: currentDate,
      VehicleNumber: r.VehicleNumber || r.TruckNumber || r.LorryNumber || "",
      TransporterCode: r.TransporterCode || "",
      TransporterName: r.TransporterName || r.Transporter || r.CarrierName || "",
      DriverName: r.DriverName || r.Driver || "",
      DriverPhoneNumber: r.DriverPhoneNumber || r.DriverMobile || r.DriverPhone || "",
      DLNumber: r.DLNumber || r.DrivingLicenseNumber || "",
      OutwardTime: currentTime,
      // SD fields
      salesdocument:
        r.salesdocument ||
        r.saledocument ||
        r.SalesDocument ||
        r.SalesDoc ||
        r.SONumber ||
        r.SalesOrderNumber ||
        "",
      Customer: r.Customer || r.CustomerCode || r.SoldTo || "",
      CustomerName: r.CustomerName || r.SoldToName || "",
      PurchaseOrder: r.PurchaseOrder || r.PO || r.PONumber || r.PurchaseOrderNumber || "",
      POItem: r.POItem || r.Item || r.ItemNumber || r.LineItem || "",
      // RGP fields
      Plant: r.Plant || "",
      Vendor: r.Vendor || "",
      VendorName: r.VendorName || "",
      Department: r.Department || "",
      Requisitioner: r.Requisitioner || "",
      Place: r.Place || "",
      UOM: r.UOM || "",
      ApproximateValue: r.ApproximateValue || "",
      Purpose: r.Purpose || "",
      ModeOfTransport: r.ModeOfTransport || r.TransportMode || "",
      Remarks: r.Remarks || "",
      Materials: parseMaterials(r),
    };
    return base;
  };

  const initialState = {
    GateEntryNumber: "",
    VehicleStatus: "OUT",
    GateEntryDate: "",
    GateOutDate: todayISO,
    VehicleNumber: "",
    TransporterCode: "",
    TransporterName: "",
    DriverName: "",
    DriverPhoneNumber: "",
    DLNumber: "",
    OutwardTime: "",
    // SD fields
    salesdocument: "",
    Customer: "",
    CustomerName: "",
    PurchaseOrder: "",
    POItem: "",
    // RGP fields
    Plant: "",
    Vendor: "",
    VendorName: "",
    Department: "",
    Requisitioner: "",
    Place: "",
    UOM: "",
    ApproximateValue: "",
    Purpose: "",
    ModeOfTransport: "",
    Remarks: "",
    Materials: [],
  };

  const [data, setData] = useState(initialState);
  const [searchNumber, setSearchNumber] = useState("");
  const [guid, setGuid] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Keep (no fiscal year logic needed now)

  const handleLoad = async (e) => {
    e?.preventDefault?.();
    setError(null);
    setResult(null);
    setLoading(true);
    setGuid(null);
    try {
      const key = (searchNumber || "").trim();
      if (!key) {
        setError("Enter a Gate Entry Number.");
        return;
      }
      const resp = await fetchGateEntryByNumber(key);
      const results = resp?.data?.d?.results || [];
      if (!results.length) {
        setError("No record found.");
        return;
      }
      const rec = results[0];
      const g = extractGuid(rec);
      if (!g) {
        setError("Record GUID not found.");
        return;
      }
      setGuid(g);
      
      const hydrated = hydrateFromSap(rec);
      const nowDate = new Date().toISOString().split("T")[0];
      
      setData({
        ...hydrated,
        GateOutDate: nowDate
      });
    } catch (err) {
      setError(
        err?.response?.data?.error?.message?.value ||
          err?.message ||
          "Failed to load record"
      );
    } finally {
      setLoading(false);
    }
  };
  const handleSetOutwardNow = () => {
    setData((prev) => ({ ...prev, OutwardTime: hhmmssNow() }));
  };

  const handleSaveOutward = async () => {
    setError(null);
    setResult(null);
    // Use GateEntryNumber for PATCH
    const gateEntryNumber = data.GateEntryNumber;
    if (!gateEntryNumber) {
      setError("Load an entry first.");
      return;
    }
    // Block save if already OUT
    if (data.VehicleStatus === "OUT") {
      setError("Vehicle is already marked as OUT. Cannot save departure again.");
      return;
    }
    // Normalize
    if (data.OutwardTime?.startsWith("PT")) {
      setData((prev) => ({ ...prev, OutwardTime: sapDurationToHHMMSS(prev.OutwardTime) }));
    }

    setSaving(true);
    const currentDate = new Date().toISOString().split("T")[0];
    try {
      const payload = {
        OutwardTime: hhmmssToSapDuration(data.OutwardTime || hhmmssNow()),
        VehicleStatus: "OUT",
        GateOutDate: currentDate
      };
      // PATCH using GateEntryNumber
      const resp = await api.patch(`/headers/${gateEntryNumber}`, payload);
      if (resp.status >= 200 && resp.status < 300) {
        setResult("Departure time saved.");
        setData(prev => ({ ...prev, OutwardTime: data.OutwardTime, VehicleStatus: "OUT" }));
      } else {
        setError(`Unexpected status ${resp.status}`);
      }
    } catch (err) {
      setError(
        err?.response?.data?.error?.message?.value ||
          err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to save outward time"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="create-header-container">
      <h2 className="page-title">Vehicle Departure Complete OUT</h2>

      {/* Search */}
      <form onSubmit={handleLoad} className="form-section" style={{ marginBottom: 12 }}>
        <h3 className="section-title">Search Entry</h3>
        <div className="grid-3-cols">
          <div className="form-group">
            <label className="form-label">Gate Entry Number</label>
            <input
              className="form-input"
              value={searchNumber}
              onChange={(e) => setSearchNumber(e.target.value)}
              placeholder="Gate Outward Number Enter"
            />
          </div>
          <div className="form-group">
            <label className="form-label">&nbsp;</label>
            <button
              type="submit"
              disabled={loading}
              className={`btn btn-primary ${loading ? "disabled" : ""}`}
            >
              {loading ? "Loading..." : "Load"}
            </button>
          </div>
        </div>
      </form>

      {/* Core Details */}
      <section className="form-section">
        <h3 className="section-title">Vehicle / Gate Info</h3>
        <div className="grid-3-cols">
          <div className="form-group">
            <label className="form-label">Gate Entry</label>
            <input className="form-input" value={data.GateEntryNumber} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Gate Entry Date</label>
            <input className="form-input" type="date" value={data.GateEntryDate} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Vehicle Status</label>
            <input className="form-input" value={data.VehicleStatus} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Outward Date</label>
            <input className="form-input" type="date" value={data.GateOutDate} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Outward Time</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="form-input" value={data.OutwardTime} readOnly />
              <button type="button" className="btn btn-secondary" onClick={handleSetOutwardNow}>
                Set Now
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Vehicle</label>
            <input className="form-input" value={data.VehicleNumber} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Transporter</label>
            <input className="form-input" value={data.TransporterName} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Driver</label>
            <input className="form-input" value={data.DriverName} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Driver Phone</label>
            <input className="form-input" value={data.DriverPhoneNumber} readOnly />
          </div>
        </div>
      </section>

      {/* SD Docs */}
      {(data.salesdocument || data.Customer || data.CustomerName || data.PurchaseOrder || data.POItem) && (
        <section className="form-section">
          <h3 className="section-title">Sales / Delivery Docs</h3>
          <div className="grid-3-cols">
            {data.salesdocument && (
              <div className="form-group">
                <label className="form-label">Sales Document</label>
                <input className="form-input" value={data.salesdocument} readOnly />
              </div>
            )}
            {data.PurchaseOrder && (
              <div className="form-group">
                <label className="form-label">Purchase Order</label>
                <input className="form-input" value={data.PurchaseOrder} readOnly />
              </div>
            )}
            {data.POItem && (
              <div className="form-group">
                <label className="form-label">PO Item</label>
                <input className="form-input" value={data.POItem} readOnly />
              </div>
            )}
            {data.Customer && (
              <div className="form-group">
                <label className="form-label">Customer Code</label>
                <input className="form-input" value={data.Customer} readOnly />
              </div>
            )}
            {data.CustomerName && (
              <div className="form-group">
                <label className="form-label">Customer Name</label>
                <input className="form-input" value={data.CustomerName} readOnly />
              </div>
            )}
          </div>
        </section>
      )}

      {/* RGP Fields */}
      {(data.Plant || data.Vendor || data.Department || data.Requisitioner || data.Place || data.UOM || data.ApproximateValue || data.Purpose) && (
        <section className="form-section">
          <h3 className="section-title">RGP Details</h3>
          <div className="grid-3-cols">
            {data.Plant && (
              <div className="form-group">
                <label className="form-label">Plant</label>
                <input className="form-input" value={data.Plant} readOnly />
              </div>
            )}
            {data.Vendor && (
              <div className="form-group">
                <label className="form-label">Vendor Code</label>
                <input className="form-input" value={data.Vendor} readOnly />
              </div>
            )}
            {data.VendorName && (
              <div className="form-group">
                <label className="form-label">Vendor Name</label>
                <input className="form-input" value={data.VendorName} readOnly />
              </div>
            )}
            {data.Department && (
              <div className="form-group">
                <label className="form-label">Department</label>
                <input className="form-input" value={data.Department} readOnly />
              </div>
            )}
            {data.Requisitioner && (
              <div className="form-group">
                <label className="form-label">Requisitioner</label>
                <input className="form-input" value={data.Requisitioner} readOnly />
              </div>
            )}
            {data.Place && (
              <div className="form-group">
                <label className="form-label">Place</label>
                <input className="form-input" value={data.Place} readOnly />
              </div>
            )}
            {data.ModeOfTransport && (
              <div className="form-group">
                <label className="form-label">Mode of Transport</label>
                <input className="form-input" value={data.ModeOfTransport} readOnly />
              </div>
            )}
            {data.TransporterCode && (
              <div className="form-group">
                <label className="form-label">Transporter Code</label>
                <input className="form-input" value={data.TransporterCode} readOnly />
              </div>
            )}
            {data.DLNumber && (
              <div className="form-group">
                <label className="form-label">DL Number</label>
                <input className="form-input" value={data.DLNumber} readOnly />
              </div>
            )}
            {data.UOM && (
              <div className="form-group">
                <label className="form-label">UOM</label>
                <input className="form-input" value={data.UOM} readOnly />
              </div>
            )}
            {data.ApproximateValue && (
              <div className="form-group">
                <label className="form-label">Approximate Value</label>
                <input className="form-input" value={data.ApproximateValue} readOnly />
              </div>
            )}
            {data.Purpose && (
              <div className="form-group">
                <label className="form-label">Purpose</label>
                <input className="form-input" value={data.Purpose} readOnly />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Remarks */}
      {data.Remarks && (
        <section className="form-section">
          <h3 className="section-title">Additional Information</h3>
          <div className="grid-1-col">
            <div className="form-group">
              <label className="form-label">Remarks</label>
              <textarea className="form-textarea" value={data.Remarks} readOnly rows={2} />
            </div>
          </div>
        </section>
      )}

      {/* Materials */}
      {Array.isArray(data.Materials) && data.Materials.length > 0 && (
        <section className="form-section">
          <h3 className="section-title">Material Details</h3>
          {data.Materials.map((it, idx) => (
            <div key={idx} className="po-entry-card" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Material Code</label>
                  <input className="form-input" value={it.code} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">Material Description</label>
                  <input className="form-input" value={it.desc} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">Returnable Quantity</label>
                  <input className="form-input" value={it.qty} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">UOM</label>
                  <input className="form-input" value={it.uom} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">Approximate Value</label>
                  <input className="form-input" value={it.approxValue} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">Remarks</label>
                  <input className="form-input" value={it.remarks} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">Purpose</label>
                  <input className="form-input" value={it.purpose} readOnly />
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Action */}
      <div className="form-actions">
<button
  type="button"
  onClick={handleSaveOutward}
  disabled={saving}
  className={`btn btn-primary ${saving ? "disabled" : ""}`}
>
  {saving ? "Saving..." : "Save Departure"}
</button>
</div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="success-message">
          <div className="success-header">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
            <h3>{result}</h3>
          </div>
          <div className="success-content">
            <p>Gate Entry: <strong>{data.GateEntryNumber || "-"}</strong></p>
            <p>Vehicle: {data.VehicleNumber || "-"}</p>
            <p>Outward Time: {data.OutwardTime || "-"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
