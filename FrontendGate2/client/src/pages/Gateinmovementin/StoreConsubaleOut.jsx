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
          <div className="scout-inline">
            <input
              className="scout-input"
              value={gateEntryNumber}
              onChange={(e) => setGateEntryNumber(e.target.value)}
              placeholder="Enter Gate Entry Number"
            />
            <button
              className="scout-fetch-btn"
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
                          // Convert OData UTC date to IST and format as dd-MM-yyyy HH:mm:ss
                          const utcDate = new Date(entryData.GateEntryDate);
                          if (isNaN(utcDate)) return "N/A";
                          // IST is UTC+5:30
                          const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
                          const pad = (n) => n.toString().padStart(2, '0');
                          return `${pad(istDate.getDate())}-${pad(istDate.getMonth()+1)}-${istDate.getFullYear()} ${pad(istDate.getHours())}:${pad(istDate.getMinutes())}:${pad(istDate.getSeconds())}`;
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