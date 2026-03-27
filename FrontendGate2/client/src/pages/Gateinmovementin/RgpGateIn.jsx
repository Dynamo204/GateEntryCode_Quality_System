import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchRgpGateEntryByNumber, fetchRgpLineItems, receiveRgpGateInItems } from "../../api";
import "./RgpProcess.css";
import "./CreateHeader.css";

export default function RgpGateIn() {
  const navigate = useNavigate();
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

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [gateEntryNumber, setGateEntryNumber] = useState("");
  const [recordFound, setRecordFound] = useState(false);

  const [formData, setFormData] = useState({
    plant: "",
    vendor: "",
    vendorName: "",
    department: "",
    requisitioner: "",
    place: "",
    modeOfTransport: "",
    vehicleNumber: "",
    transporterCode: "",
    transporterName: "",
    driverName: "",
    driverPhoneNumber: "",
    dlNumber: "",
    uom: "",
    approximateValue: "",
    purpose: "",
    remarks: "",
    gateEntryDate: "",
    inwardTime: "",
    expectedDateOfReturn: ""
  });

  const [tableRows, setTableRows] = useState([]);

  const processClosed = recordFound && tableRows.length > 0 && tableRows.every((row) => Number(row.remainQty || 0) <= 0);

  const handleRowChange = (id, field, value) => {
    setTableRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  const getDisplayRemainQty = (row) => {
    const currentRemain = Number(row.remainQty || 0);
    const enteredReceived = Number(row.receivedQuantity || 0);
    if (!enteredReceived) {
      return currentRemain ? currentRemain.toFixed(2) : String(row.remainQty || "0.00");
    }
    return Math.max(currentRemain - enteredReceived, 0).toFixed(2);
  };

  const parseSapDate = (val) => {
    if (!val) return "";
    if (typeof val === "string" && val.startsWith("/Date(")) {
      const match = val.match(/\/Date\(([-\d+]+)(?:[+-]\d+)?\)\//);
      if (match) {
        const millis = parseInt(match[1], 10);
        if (!Number.isNaN(millis)) {
          return new Date(millis).toISOString().split("T")[0];
        }
      }
    }
    if (typeof val === "string" && val.length >= 10) {
      return val.slice(0, 10);
    }
    return "";
  };

  const parseSapTime = (val) => {
    if (!val) return "";
    if (typeof val === "string" && val.startsWith("PT")) {
      const match = val.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (match) {
        const hours = (match[1] || "0").padStart(2, "0");
        const minutes = (match[2] || "0").padStart(2, "0");
        const seconds = (match[3] || "0").padStart(2, "0");
        return `${hours}:${minutes}:${seconds}`;
      }
    }
    if (typeof val === "string" && /^\d{1,2}:\d{2}(:\d{2})?$/.test(val)) {
      return val;
    }
    return val;
  };

  const handleFetchGateEntry = async (entryNumberOverride = gateEntryNumber, options = {}) => {
    const requestedGateEntryNumber = String(entryNumberOverride || "").trim();

    if (!requestedGateEntryNumber) {
      setError("Please enter Gate Entry Number");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    setRecordFound(false);

    try {
      const response = await fetchRgpGateEntryByNumber(requestedGateEntryNumber);

      let record;
      if (response?.data?.d?.results && Array.isArray(response.data.d.results)) {
        if (!response.data.d.results.length) {
          setError("No Gate Entry found with this number");
          setLoading(false);
          return;
        }
        record = response.data.d.results[0];
      } else if (response?.data?.value && Array.isArray(response.data.value)) {
        if (!response.data.value.length) {
          setError("No Gate Entry found with this number");
          setLoading(false);
          return;
        }
        record = response.data.value[0];
      } else if (response?.data?.d) {
        record = response.data.d;
      } else if (response?.data) {
        record = response.data;
      } else {
        setError("Invalid response format from server");
        setLoading(false);
        return;
      }

      if (!record) {
        setError("No Gate Entry found with this number");
        setLoading(false);
        return;
      }

      let displayMode = record.TransportMode || record.ModeOfTransport || "";
      if (displayMode === "By Hand") displayMode = "Hand";
      if (displayMode === "By Road") displayMode = "Truck";

      setFormData({
        plant: record.Plant || "",
        vendor: record.Vendor || "",
        vendorName: record.VendorName || "",
        department: record.Department || "",
        requisitioner: record.Requisitioner || "",
        place: record.Place || "",
        modeOfTransport: displayMode,
        vehicleNumber: record.VehicleNumber || "",
        transporterCode: record.TransporterCode || "",
        transporterName: record.TransporterName || "",
        driverName: record.DriverName || "",
        driverPhoneNumber: record.DriverPhoneNumber || "",
        dlNumber: record.DLNumber || "",
        uom: record.UOM || "",
        approximateValue: record.ApproximateValue || "",
        purpose: record.Purpose || "",
        remarks: record.Remarks || "",
        gateEntryDate: parseSapDate(record.GateEntryDate),
        inwardTime: parseSapTime(record.InwardTime),
        expectedDateOfReturn: record.Expecteddateofreturn || record["d:Expecteddateofreturn"] || ""
      });

      const itemsResponse = await fetchRgpLineItems(requestedGateEntryNumber);
      let items = itemsResponse?.data?.items || itemsResponse?.data?.d?.results || itemsResponse?.data || [];
      if (!Array.isArray(items)) items = [];

      const materials = items
        .map((item, index) => ({
          id: index + 1,
          SAP_UUID: item.SAP_UUID || item.sap_uuid || item.uuid || item["d:SAP_UUID"] || "",
          materialCode: item.Material || item.material || item["d:Material"] || "",
          materialDescription: item.MaterialDescription || item.materialDescription || item["d:MaterialDescription"] || "",
          returnableQuantity: item.ReturnableQty ?? item.returnableQty ?? item["d:ReturnableQty"] ?? "0.00",
          recivedQty: item.RecivedQty ?? item.recivedQty ?? item.ReceivedQty ?? item.receivedQty ?? item["d:RecivedQty"] ?? item["d:ReceivedQty"] ?? "0.00",
          remainQty: item.RemainQty ?? item.remainQty ?? item["d:RemainQty"] ?? item.ReturnableQty ?? item["d:ReturnableQty"] ?? "0.00",
          receivedQuantity: "",
          uom: item.UOM || item.uom || item["d:UOM"] || record.UOM || "",
          approximateValue: item.ApproximateValue ?? item.approximateValue ?? item["d:ApproximateValue"] ?? record.ApproximateValue ?? "",
          remarks: item.Remarks || item.remarks || item["d:Remarks"] || record.Remarks || "",
          purpose: item.Purpose || item.purpose || item["d:Purpose"] || record.Purpose || "",
        }))
        .filter((item) => item.materialCode || item.materialDescription);

      if (materials.length === 0) {
        setError("No materials found in this Gate Entry");
        setLoading(false);
        return;
      }

      setTableRows(materials);
      setRecordFound(true);
      setGateEntryNumber(requestedGateEntryNumber);

      const allClosed = materials.every((item) => Number(item.remainQty || 0) <= 0);
      if (options.successMessage) {
        setSuccess(options.successMessage);
      } else if (allClosed) {
        setSuccess("Gate Entry process is closed. All quantities are received.");
      } else {
        setSuccess("Gate Entry loaded successfully! Please enter Received Quantities.");
      }
    } catch (err) {
      console.error("Failed to fetch gate entry:", err);
      setError(err?.response?.data?.error?.message?.value || err?.message || "Failed to fetch Gate Entry");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (processClosed) {
      setError("Gate Entry process is closed. All quantities are received.");
      return;
    }

    const rowsToReceive = tableRows.filter((row) => Number(row.receivedQuantity || 0) > 0);
    if (!rowsToReceive.length) {
      setError("Please enter at least one Received Quantity");
      return;
    }

    const invalidRow = rowsToReceive.find((row) => Number(row.receivedQuantity || 0) > Number(row.remainQty || 0));
    if (invalidRow) {
      setError(`Received Quantity cannot exceed Remaining Quantity for material ${invalidRow.materialCode}`);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        items: rowsToReceive.map((row) => ({
          SAP_UUID: row.SAP_UUID,
          materialCode: row.materialCode,
          materialDescription: row.materialDescription,
          returnableQuantity: row.returnableQuantity,
          remainQty: row.remainQty,
          receivedQuantity: row.receivedQuantity,
          uom: row.uom,
          approximateValue: row.approximateValue,
          remarks: row.remarks,
          purpose: row.purpose,
        }))
      };

      const response = await receiveRgpGateInItems(gateEntryNumber.trim(), payload);
      const saveMessage = response?.data?.processClosed
        ? "All quantities are received. Gate Entry process is closed."
        : "Received quantities saved successfully!";

      await handleFetchGateEntry(gateEntryNumber.trim(), { successMessage: saveMessage });
    } catch (err) {
      console.error("Failed to save received quantities:", err);
      setError(err?.response?.data?.error?.message?.value || err?.response?.data?.error || err?.message || "Failed to save received quantities");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rgp-container">
      <div className="rgp-header">
        <h2>RGP Gate In</h2>
      </div>

      <div className="action-section" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
        <input
          type="text"
          value={gateEntryNumber}
          onChange={(e) => setGateEntryNumber(e.target.value)}
          className="input-field"
          style={{ width: "160px", flex: "0 0 160px" }}
          placeholder="Gate Entry No"
          disabled={recordFound}
        />
        <button
          type="button"
          onClick={() => handleFetchGateEntry()}
          disabled={loading || !gateEntryNumber || recordFound}
          className="submit-btn"
          style={{ height: "36px", minWidth: "120px", marginBottom: "0" }}
        >
          {loading ? "Loading..." : recordFound ? "Loaded" : "Fetch Entry"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "10px", marginBottom: "10px" }}>
        <div className="form-group" style={{ marginBottom: "0" }}>
          <label className="form-label" style={{ marginBottom: "2px" }}>Plant</label>
          <input type="text" className="form-input" value={formData.plant || ""} readOnly style={{ backgroundColor: "#f0f0f0", marginBottom: "0" }} />
        </div>
        <div className="form-group" style={{ marginBottom: "0" }}>
          <label className="form-label" style={{ marginBottom: "2px" }}>Vendor</label>
          <input type="text" className="form-input" value={formData.vendor || ""} readOnly style={{ backgroundColor: "#f0f0f0", marginBottom: "0" }} />
        </div>
        <div className="form-group" style={{ marginBottom: "0" }}>
          <label className="form-label" style={{ marginBottom: "2px" }}>Vehicle Number</label>
          <input type="text" className="form-input" value={formData.vehicleNumber || ""} readOnly style={{ backgroundColor: "#f0f0f0", marginBottom: "0" }} />
        </div>
        <div className="form-group" style={{ marginBottom: "0" }}>
          <label className="form-label" style={{ marginBottom: "2px" }}>Inward Time</label>
          <input type="text" className="form-input" value={formatTimeToIST(formData.inwardTime || "")} readOnly style={{ backgroundColor: "#f0f0f0", marginBottom: "0" }} />
        </div>
        <div className="form-group" style={{ marginBottom: "0" }}>
          <label className="form-label" style={{ marginBottom: "2px" }}>Expected Date of Return</label>
          <input type="text" className="form-input" value={formatDateToIST(formData.expectedDateOfReturn || "")} readOnly style={{ backgroundColor: "#f0f0f0", marginBottom: "0" }} />
        </div>
      </div>

      {loading && <div className="loading-indicator">Loading...</div>}
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {recordFound && (
        <div className="rgp-entry-details">
          <div className="details-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "12px", marginBottom: "16px" }}>
            <div className="form-group">
              <label className="form-label">Gate Entry Number</label>
              <input type="text" className="form-input" value={gateEntryNumber} readOnly style={{ backgroundColor: "#f0f0f0" }} />
            </div>
            <div className="form-group">
              <label className="form-label">Remarks</label>
              <input type="text" className="form-input" value={formData.remarks || ""} readOnly style={{ backgroundColor: "#f0f0f0" }} />
            </div>
            <div className="form-group">
              <label className="form-label">Requisitioner</label>
              <input type="text" className="form-input" value={formData.requisitioner || ""} readOnly style={{ backgroundColor: "#f0f0f0" }} />
            </div>
            <div className="form-group">
              <label className="form-label">Transport Mode</label>
              <input type="text" className="form-input" value={formData.modeOfTransport || ""} readOnly style={{ backgroundColor: "#f0f0f0" }} />
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <input type="text" className="form-input" value={formData.department || ""} readOnly style={{ backgroundColor: "#f0f0f0" }} />
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
                  <th>Recived Qty</th>
                  <th>Remain Qty</th>
                  <th>Returnable Qty</th>
                  <th>UOM</th>
                  <th>Approx. Value</th>
                  <th>Remarks</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, idx) => (
                  <tr key={row.id || idx}>
                    <td>{idx + 1}</td>
                    <td>{row.materialCode}</td>
                    <td>{row.materialDescription}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.receivedQuantity}
                        onChange={(e) => handleRowChange(row.id, "receivedQuantity", e.target.value)}
                        disabled={processClosed || Number(row.remainQty || 0) <= 0}
                        style={{ width: "80px", textAlign: "right", backgroundColor: processClosed || Number(row.remainQty || 0) <= 0 ? "#f0f0f0" : "#fffbf0", fontWeight: "bold" }}
                      />
                    </td>
                    <td>{getDisplayRemainQty(row)}</td>
                    <td>{row.returnableQuantity}</td>
                    <td>{row.uom}</td>
                    <td>{row.approximateValue}</td>
                    <td>{row.remarks}</td>
                    <td>{row.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
            <button type="button" onClick={handleSave} disabled={saving || processClosed} className="submit-btn">
              {saving ? "Saving..." : "Save Gate In"}
            </button>
            {/* <button
              type="button"
              onClick={() => {
                setFormData({
                  plant: "", vendor: "", vendorName: "", department: "", requisitioner: "", place: "",
                  modeOfTransport: "", vehicleNumber: "", transporterCode: "", transporterName: "",
                  driverName: "", driverPhoneNumber: "", dlNumber: "", uom: "", approximateValue: "",
                  purpose: "", remarks: "", gateEntryDate: "", inwardTime: "", expectedDateOfReturn: ""
                });
                setTableRows([]);
                setGateEntryNumber("");
                setRecordFound(false);
                setError("");
                setSuccess("");
              }}
              className="cancel-btn"
              disabled={saving}
            >
              Reset
            </button>
            <button type="button" onClick={() => navigate("/home/rgp")} className="cancel-btn" disabled={saving}>
              Back
            </button> */}
          </div>
        </div>
      )}
    </div>
  );
}
