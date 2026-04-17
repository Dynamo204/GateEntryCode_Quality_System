import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE, fetchScLineItems } from "../../api";
import axios from "axios";
import "./StoreConsubaleOut.css";

export default function StoreConsubaleOut() {

  const navigate = useNavigate();

  const [gateEntryNumber, setGateEntryNumber] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [entryData, setEntryData] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [fetchError, setFetchError] = useState("");
  const [success, setSuccess] = useState(false);
  const [outwardDate, setOutwardDate] = useState(new Date().toISOString().split("T")[0]);

  const parseSapDateToIso = (rawDate) => {
    if (!rawDate) return "";

    if (typeof rawDate === "string") {
      const match = rawDate.match(/\/Date\((\d+)\)\//);
      if (match) {
        const date = new Date(Number(match[1]));
        if (!Number.isNaN(date.getTime())) return date.toISOString().split("T")[0];
      }
      if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) return rawDate.slice(0, 10);
    }

    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().split("T")[0];
  };

  const handleFetch = async () => {

    setLoading(true);
    setFetchError("");
    setEntryData(null);
    setLineItems([]);

    try {

      const resp = await axios.get(
        `${API_BASE}/headers?$filter=GateEntryNumber eq '${gateEntryNumber}'&$format=json`
      );

      const header = resp?.data?.d?.results?.[0];

      if (!header) throw new Error("No entry found");

      setEntryData(header);
      setVehicleNumber(header.VehicleNumber || "");
      setRemarks(header.Remarks || "");
      setOutwardDate(parseSapDateToIso(header.GateOutDate) || new Date().toISOString().split("T")[0]);

      let itemsRes;

      if (header.SAP_UUID) {
        itemsRes = await fetchScLineItems(header.SAP_UUID);
      } else if (header.SAP_PARENT_UUID) {
        itemsRes = await fetchScLineItems(header.SAP_PARENT_UUID);
      }

      let items =
        itemsRes?.data?.items ||
        itemsRes?.data?.d?.results ||
        itemsRes?.data ||
        [];

      if (!Array.isArray(items)) items = [];

      setLineItems(items);

    } catch (err) {
      setFetchError(err.message || "Failed to fetch data");
    }

    setLoading(false);
  };

  const vendorDisplay = Array.from(new Set(lineItems.map(item => item.Vendor).filter(Boolean))).join(", ") || entryData?.Vendor || "N/A";
  const vendorNameDisplay = Array.from(new Set(lineItems.map(item => item.VendorName).filter(Boolean))).join(", ") || entryData?.VendorName || "N/A";

  const handleSubmit = async (e) => {

    e.preventDefault();
    setLoading(true);

    try {
      // Format OutwardTime as PT00H00M00S for header
      const now = new Date();
      const pad = (n) => n.toString().padStart(2, '0');
      const outwardTime = `PT${pad(now.getHours())}H${pad(now.getMinutes())}M${pad(now.getSeconds())}S`;
      const payload = {
        GateEntryNumber: gateEntryNumber,
        VehicleNumber: vehicleNumber,
        Remarks: remarks,
        Indicators: "SC_OUT",
        GateOutDate: outwardDate,
        OutwardTime: outwardTime,
        VehicleStatus: "OUT", // Set status to OUT when submitting
      };
      const response = await axios.post(`${API_BASE}/sc-out`, payload);
      if (response.data && response.data.status === "Header updated") {
        setSuccess(true);
      } else {
        setSuccess(false);
        alert("Failed to update header: " + (response.data?.error || "Unknown error"));
      }
    } catch (err) {
      setSuccess(false);
      alert("Failed to submit entry: " + (err.response?.data?.error || err.message));
    }
    setLoading(false);
  };

  return (
    <div className="scout-dashboard-container">
      <div className="scout-dashboard-form">
        {/* <button className="scout-back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button> */}
        <h2 className="scout-title">
          Stores & Consumable Gate Out Entry
        </h2>
        {/* Gate Entry */}
        <div className="scout-section">
          <h3>Gate Entry Number</h3>
          <div className="scout-inline scout-entry-search">
            <input
              className="scout-input scout-gate-entry-input"
              value={gateEntryNumber}
              onChange={(e) => setGateEntryNumber(e.target.value)}
              placeholder="Type Gate Entry Number here"
            />
            <button
              className="scout-fetch-btn scout-gate-entry-btn"
              onClick={handleFetch}
            >
              {loading ? "Fetching..." : "Fetch Entry Details"}
            </button>
          </div>
          {fetchError && (
            <p className="scout-error">{fetchError}</p>
          )}
        </div>
        {/* Header */}
        {entryData && (
          <div className="scout-section">
            <h3>Header Details</h3>
            <div className="scout-header-grid">
              <div>
                <label>Gate Entry Date</label>
                <input
                  className="scout-input"
                  readOnly
                  value={
                    entryData.GateEntryDate
                      ? (() => {
                          const rawDate = entryData.GateEntryDate;
                          let parsedDate;

                          // Support SAP OData V2 format: /Date(1742668800000)/
                          if (typeof rawDate === "string") {
                            const match = rawDate.match(/\/Date\((\d+)\)\//);
                            parsedDate = match ? new Date(Number(match[1])) : new Date(rawDate);
                          } else {
                            parsedDate = new Date(rawDate);
                          }

                          if (Number.isNaN(parsedDate.getTime())) return "N/A";

                          return parsedDate
                            .toLocaleString("en-GB", {
                              timeZone: "Asia/Kolkata",
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                              hour12: false,
                            })
                            .replace(",", "");
                        })()
                      : "N/A"
                  }
                />
              </div>
              <div>
                <label>Vehicle Number</label>
                <input
                  className="scout-input"
                  readOnly
                  value={entryData.VehicleNumber || "N/A"}
                />
              </div>
              <div>
                <label>Vendor</label>
                <input
                  className="scout-input"
                  readOnly
                  value={vendorDisplay}
                />
              </div>
              <div>
                <label>Vendor Name</label>
                <input
                  className="scout-input"
                  readOnly
                  value={vendorNameDisplay}
                />
              </div>
              <div>
                <label>Outward Date</label>
                <input
                  className="scout-input"
                  type="date"
                  value={outwardDate}
                  onChange={(e) => setOutwardDate(e.target.value)}
                />
              </div>
              <div>
                <label>Transporter Name</label>
                <input
                  className="scout-input"
                  readOnly
                  value={entryData.TransporterName || "N/A"}
                />
              </div>
              <div>
                <label>Driver Name</label>
                <input
                  className="scout-input"
                  readOnly
                  value={entryData.DriverName || "N/A"}
                />
              </div>
              <div>
                <label>Helper Name</label>
                <input
                  className="scout-input"
                  readOnly
                  value={entryData.HelperName || "N/A"}
                />
              </div>
              <div>
                <label>Driver Phone</label>
                <input
                  className="scout-input"
                  readOnly
                  value={entryData.DriverPhoneNumber || "N/A"}
                />
              </div>
              <div>
                <label>DL Number</label>
                <input
                  className="scout-input"
                  readOnly
                  value={entryData.DLNumber || "N/A"}
                />
              </div>
              <div>
                <label>Net Weight</label>
                <input
                  className="scout-input"
                  readOnly
                  value={entryData.NetWeight || "N/A"}
                />
              </div>
            </div>
          </div>
        )}
        {/* Line Items */}
        {lineItems.length > 0 && (
          <div className="scout-section">
            {/* Vehicle Number and Remarks above table */}
            <div className="scout-inline" style={{ marginBottom: 8 }}>
              <div>
                <label style={{ fontWeight: 600, color: '#1976d2' }}>Vehicle Number</label>
                <input
                  className="scout-input"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  style={{ minWidth: 120 }}
                />
              </div>
              <div>
                <label style={{ fontWeight: 600, color: '#1976d2' }}>Remarks</label>
                <input
                  className="scout-input"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  style={{ minWidth: 120 }}
                />
              </div>
            </div>
            <h3>Line Items</h3>
            <table className="scout-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>PO Number</th>
                  <th>PO Item</th>
                  <th>Material</th>
                  <th>Description</th>
                  <th>Remaining</th>
                  <th>ReceivedQty</th>
                  <th>BalanceQty</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>{item.PurchaseOrderNumber}</td>
                    <td>{item.PurchaseOrderItem}</td>
                    <td>{item.Material}</td>
                    <td>{item.MaterialDescription}</td>
                    <td>{item.RemainQty}</td>
                    <td>{item.RecivedQty || item.ReceivedQty || ''}</td>
                    <td>{item.BalanceQty || item.RemainQty || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Vehicle and Remarks fields moved above table */}
        {/* Submit */}
        <div style={{ textAlign: "center" }}>
          <button
            className="scout-primary-btn"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Submitting..." : "Submit Outward Entry"}
          </button>
          {success && (
            <div style={{ color: 'green', marginTop: 12, fontWeight: 600 }}>
              Outward Entry saved successfully!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}