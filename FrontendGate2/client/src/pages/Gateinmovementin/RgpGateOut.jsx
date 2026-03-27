import React, { useState } from "react";
import { fetchRgpGateEntryByNumber, saveRgpGateOut, fetchRgpLineItems } from "../../api";
import "./CreateHeader.css";

export default function RgpGateOut() {
  const getVehicleStatus = (header) => {
    if (!header) return "";
    return String(
      header.VehicleStatus ||
      header["d:VehicleStatus"] ||
      header.vehicleStatus ||
      ""
    ).toUpperCase();
  };

  const formatDateToIST = (value) => {
    if (!value) return "";
    try {
      if (typeof value === "string" && value.startsWith("/Date(")) {
        const ms = Number(value.replace(/\D/g, ""));
        if (!Number.isNaN(ms)) {
          return new Intl.DateTimeFormat("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
          }).format(new Date(ms));
        }
      }
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
          return new Intl.DateTimeFormat("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
          }).format(date);
        }
      }
    } catch (_e) {}
    return String(value);
  };

  const formatTimeToIST = (value) => {
    if (!value) return "";
    try {
      if (typeof value === "string" && /^PT(\d+H)?(\d+M)?(\d+S)?$/.test(value)) {
        const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
        const h = String(match?.[1] ? Number(match[1]) : 0).padStart(2, "0");
        const m = String(match?.[2] ? Number(match[2]) : 0).padStart(2, "0");
        const s = String(match?.[3] ? Number(match[3]) : 0).padStart(2, "0");
        return `${h}:${m}:${s}`;
      }
      if (typeof value === "string" && value.startsWith("/Date(")) {
        const ms = Number(value.replace(/\D/g, ""));
        if (!Number.isNaN(ms)) {
          return new Intl.DateTimeFormat("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
          }).format(new Date(ms));
        }
      }
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        }).format(date);
      }
    } catch (_e) {}
    return String(value);
  };

    // Save RGP Gate Out
    const handleSave = async () => {
      setLoading(true);
      setError("");
      setSuccess(false);
      try {
        const currentStatus = getVehicleStatus(entryData);
        if (currentStatus === "OUT") {
          setError("Gate Out was already done for this entry.");
          setLoading(false);
          return;
        }

        // Only PATCH ReturnableQty for line items
        const patchItems = lineItems.map(item => ({
          SAP_UUID: item.SAP_UUID || item.sap_uuid || item.uuid,
          ReturnableQty: Number(item.ReturnableQty)
        })).filter(i => i.SAP_UUID);
        if (patchItems.length === 0) {
          setError("No valid line items to update (missing SAP_UUID).");
          setLoading(false);
          return;
        }
        // Call PATCH endpoint
        const gateEntryNumber = entryData?.GateEntryNumber || entryData?.["d:GateEntryNumber"];
        if (!gateEntryNumber) {
          setError("Gate Entry Number missing in fetched data.");
          setLoading(false);
          return;
        }

        let patchRes;
        try {
          patchRes = await window.updateRgpReturnableQty
            ? window.updateRgpReturnableQty(gateEntryNumber, patchItems)
            : (await import("../../api")).updateRgpReturnableQty(gateEntryNumber, patchItems);
        } catch (err) {
          // If PATCH returns 500 or fails, show error
          const backendErr = err?.response?.data?.details || err?.response?.data?.error || err?.message || err;
          setError("Failed to update ReturnableQty: " + (typeof backendErr === 'string' ? backendErr : JSON.stringify(backendErr)));
          setLoading(false);
          return;
        }
        // If PATCH failed, show error
        if (patchRes?.data?.error) {
          setError("Failed to update ReturnableQty: " + (patchRes.data.error || "Unknown error"));
          setLoading(false);
          return;
        }
        // Optionally, check patchRes.data.updated for errors
        if (patchRes?.data?.updated?.some(r => r.status === "error")) {
          const firstErr = patchRes.data.updated.find(r => r.status === "error");
          setError("Failed to update ReturnableQty: " + (firstErr?.error || "Unknown error"));
          setLoading(false);
          return;
        }
        // Set outward time only when Save Gate Out is clicked
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");
        const outwardTimeSAP = `PT${hh}H${mm}M${ss}S`;

        await saveRgpGateOut({
          header: {
            GateEntryNumber: gateEntryNumber,
            VehicleStatus: "OUT",
            OutwardTime: outwardTimeSAP
          },
          // Line items are already patched above; avoid duplicate PATCH in gateout endpoint.
          items: []
        });

        setEntryData(prev => ({
          ...(prev || {}),
          OutwardTime: outwardTimeSAP
        }));

        // Only show success if save succeeded
        setSuccess(true);
      } catch (err) {
        const backendDetails = err?.response?.data?.details;
        const backendError = err?.response?.data?.error;
        const friendly =
          (typeof backendDetails === "string" && backendDetails) ||
          (typeof backendError === "string" && backendError) ||
          err?.message ||
          "Failed to save Gate Out.";
        setError(friendly);
      }
      setLoading(false);
    };
  const [gateEntryNum, setGateEntryNum] = useState("");
  const [entryData, setEntryData] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Fetch RGP entry and line items
  const handleFetch = async () => {
    setLoading(true);
    setError("");
    setSuccess(false);
    setEntryData(null);
    setLineItems([]);
    try {
      // Fetch header
      const headerRes = await fetchRgpGateEntryByNumber(gateEntryNum);
      const header = headerRes?.data?.d?.results?.[0] || headerRes?.data || null;
      if (!header) throw new Error("No header found");
      setEntryData(header);

      if (getVehicleStatus(header) === "OUT") {
        setLineItems([]);
        setError("Gate Out was already done for this entry.");
        setLoading(false);
        return;
      }

        // Fetch all line items for this Gate Entry using a dedicated API path
        let itemsRes;
        if (header.GateEntryNumber) {
          itemsRes = await fetchRgpLineItems(header.GateEntryNumber);
        } else if (header.SAP_PARENT_UUID) {
          itemsRes = await fetchRgpLineItems(header.SAP_PARENT_UUID);
        } else if (header.SAP_UUID) {
          itemsRes = await fetchRgpLineItems(header.SAP_UUID);
        } else {
          throw new Error("No valid identifier for line item fetch");
        }
        let items = itemsRes?.data?.d?.results || itemsRes?.data?.items || itemsRes?.data || [];
        if (!Array.isArray(items)) items = [];
        // Defensive mapping: ensure all required fields exist, including SAP_UUID
        items = items.map((item, idx) => ({
          SAP_UUID: item.SAP_UUID || item.sap_uuid || item.uuid || item['d:SAP_UUID'] || item['SAP_UUID'] || item['Guid'] || item['d:Guid'] || "",
          Material: item.Material || item.material || item['d:Material'] || "",
          MaterialDescription: item.MaterialDescription || item.materialDescription || item['d:MaterialDescription'] || "",
          RecivedQty: item.RecivedQty ?? item.recivedQty ?? item.ReceivedQty ?? item.receivedQty ?? item['d:RecivedQty'] ?? item['d:ReceivedQty'] ?? "",
          RemainQty: item.RemainQty ?? item.remainQty ?? item['d:RemainQty'] ?? "",
          ReturnableQty: item.ReturnableQty ?? item.returnableQty ?? item.Quantity ?? item.quantity ?? item['d:ReturnableQty'] ?? "",
          UOM: item.UOM || item.uom || item.UnitOfMeasure || item['d:UOM'] || "",
          ApproximateValue: item.ApproximateValue ?? item.approximateValue ?? item.Value ?? item['d:ApproximateValue'] ?? "",
          Remarks: item.Remarks || item.remarks || item['d:Remarks'] || "",
          Purpose: item.Purpose || item.purpose || item['d:Purpose'] || "",
          idx: idx + 1,
        }));
        setLineItems(items);
        if (items.length === 0) setError("No line items found for this entry.");
    } catch (err) {
      setError(err?.message || "Failed to fetch entry or line items.");
    }
    setLoading(false);
  };

  // Helper to fetch line items for a header
  // No longer needed: replaced by fetchRgpLineItems in api.js

  return (
    <div className="rgp-container">
      <div className="rgp-header">
        <h2>RGP Gate Out</h2>
      </div>
      <div className="action-section" style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px'}}>
        <input
          type="text"
          value={gateEntryNum}
          onChange={e => setGateEntryNum(e.target.value)}
          className="input-field"
          style={{width: '160px', flex: '0 0 160px' }}
        />
        <button onClick={handleFetch} disabled={loading || !gateEntryNum} className="submit-btn" style={{height: '36px', minWidth: '120px', marginBottom: '0'}}>
          Fetch Entry
        </button>
      </div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '10px', marginBottom: '10px'}}>
        
        <div className="form-group" style={{marginBottom: '0'}}>
          
          <label className="form-label" style={{marginBottom: '2px'}}>Plant</label>
          <input type="text" className="form-input" value={entryData?.Plant || ''} readOnly style={{ backgroundColor: '#f0f0f0', marginBottom: '0' }} />
        </div>
        <div className="form-group" style={{marginBottom: '0'}}>
          <label className="form-label" style={{marginBottom: '2px'}}>Vendor</label>
          <input type="text" className="form-input" value={entryData?.Vendor || ''} readOnly style={{ backgroundColor: '#f0f0f0', marginBottom: '0' }} />
        </div>
        <div className="form-group" style={{marginBottom: '0'}}>
          <label className="form-label" style={{marginBottom: '2px'}}>Vehicle Number</label>
          <input type="text" className="form-input" value={entryData?.VehicleNumber || ''} readOnly style={{ backgroundColor: '#f0f0f0', marginBottom: '0' }} />
        </div>
        <div className="form-group" style={{marginBottom: '0'}}>
          <label className="form-label" style={{marginBottom: '2px'}}>Creation Time</label>
          <input type="text" className="form-input" value={formatTimeToIST(entryData?.InwardTime || entryData?.['d:InwardTime'] || '')} readOnly style={{ backgroundColor: '#f0f0f0', marginBottom: '0' }} />
        </div>
        <div className="form-group" style={{marginBottom: '0'}}>
          <label className="form-label" style={{marginBottom: '2px'}}>Expected Date of Return</label>
          <input type="text" className="form-input" value={formatDateToIST(entryData?.Expecteddateofreturn || entryData?.['d:Expecteddateofreturn'] || '')} readOnly style={{ backgroundColor: '#f0f0f0', marginBottom: '0' }} />
        </div>
      </div>
      
      {loading && <div className="loading-indicator">Loading...</div>}
      {error && <div className="error-message">{error}</div>}
      {entryData && (
        <div className="rgp-entry-details">
          <div className="details-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '12px', marginBottom: '16px'}}>
            <div className="form-group">
              <label className="form-label">Gate Entry Number</label>
              <input type="text" className="form-input" value={entryData.GateEntryNumber || entryData['d:GateEntryNumber'] || ''} readOnly style={{ backgroundColor: '#f0f0f0' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Remarks</label>
              <input type="text" className="form-input" value={entryData.Remarks || entryData['d:Remarks'] || ''} readOnly style={{ backgroundColor: '#f0f0f0' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Requisitioner</label>
              <input type="text" className="form-input" value={entryData.Requisitioner || entryData['d:Requisitioner'] || ''} readOnly style={{ backgroundColor: '#f0f0f0' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Transport Mode</label>
              <input type="text" className="form-input" value={entryData.TransportMode || entryData['d:TransportMode'] || ''} readOnly style={{ backgroundColor: '#f0f0f0' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <input type="text" className="form-input" value={entryData.Department || entryData['d:Department'] || ''} readOnly style={{ backgroundColor: '#f0f0f0' }} />
            </div>
          </div>
          <h3>Line Items</h3>
          <div className="table-section">
            <table className="rgp-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Material Code</th>
                  <th>Description</th>
                  <th style={{ display: 'none' }}>Recived Qty</th>
                  <th style={{ display: 'none' }}>Remain Qty</th>
                  <th>Returnable Qty</th>
                  <th>UOM</th>
                  <th>Approx. Value</th>
                  <th>Remarks</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>{item.Material}</td>
                    <td>{item.MaterialDescription}</td>
                    <td style={{ display: 'none' }}>{item.RecivedQty}</td>
                    <td style={{ display: 'none' }}>{item.RemainQty}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.ReturnableQty}
                        onChange={e => {
                          const newQty = e.target.value;
                          setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, ReturnableQty: newQty } : li));
                        }}
                        style={{ width: '80px', textAlign: 'right' }}
                      />
                    </td>
                    <td>{item.UOM}</td>
                    <td>{item.ApproximateValue}</td>
                    <td>{item.Remarks}</td>
                    <td>{item.Purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={handleSave} disabled={loading} className="submit-btn">
            Save Gate Out
          </button>
          {success && <div className="success-message">Gate Out saved successfully!</div>}
        </div>
      )}
    </div>
  );
}
