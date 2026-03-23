import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchRgpGateEntryByNumber, updateRgpGateEntry } from "../../api";
import "./RgpProcess.css";
import "./CreateHeader.css";

export default function RgpGateIn() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [gateEntryNumber, setGateEntryNumber] = useState("");
  const [recordFound, setRecordFound] = useState(false);
  const [sapUuid, setSapUuid] = useState("");
  
  // Header fields - matching RGP Gate Out display
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
    inwardTime: ""
  });

  // Table rows with received quantity
  const [tableRows, setTableRows] = useState([]);

  const handleRowChange = (id, field, value) => {
    setTableRows(prev => 
      prev.map(row => 
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  // Parse SAP date format
  const parseSapDate = (val) => {
    if (!val) return '';
    if (typeof val === 'string' && val.startsWith('/Date(')) {
      const match = val.match(/\/Date\(([-\d+]+)(?:[+-]\d+)?\)\//);
      if (match) {
        const millis = parseInt(match[1], 10);
        if (!Number.isNaN(millis)) {
          return new Date(millis).toISOString().split('T')[0];
        }
      }
    }
    if (typeof val === 'string' && val.length >= 10) {
      return val.slice(0, 10);
    }
    return '';
  };

  // Parse SAP time format (PT15H19M14S) to HH:mm:ss
  const parseSapTime = (val) => {
    if (!val) return '';
    if (typeof val === 'string' && val.startsWith('PT')) {
      const match = val.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (match) {
        const hours = (match[1] || '0').padStart(2, '0');
        const minutes = (match[2] || '0').padStart(2, '0');
        const seconds = (match[3] || '0').padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
      }
    }
    if (typeof val === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(val)) {
      return val;
    }
    return val;
  };

  const handleFetchGateEntry = async () => {
    if (!gateEntryNumber.trim()) {
      setError("Please enter Gate Entry Number");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    setRecordFound(false);

    try {
      const response = await fetchRgpGateEntryByNumber(gateEntryNumber.trim());
      
      // Handle different response formats
      let record;
      if (response?.data?.d?.results && Array.isArray(response.data.d.results)) {
        // OData array format
        if (!response.data.d.results.length) {
          setError("No Gate Entry found with this number");
          setLoading(false);
          return;
        }
        record = response.data.d.results[0];
      } else if (response?.data?.value && Array.isArray(response.data.value)) {
        // JSON array format
        if (!response.data.value.length) {
          setError("No Gate Entry found with this number");
          setLoading(false);
          return;
        }
        record = response.data.value[0];
      } else if (response?.data?.d) {
        // Single OData object
        record = response.data.d;
      } else if (response?.data) {
        // Single JSON object
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
      
      // Extract SAP UUID - check multiple possible field names
      const uuid = record.SAP_UUID || record.ID || record.Guid || record.guid || record.__metadata?.uri?.split("guid'")[1]?.split("'")[0];
      if (!uuid) {
        console.error("Record data:", record);
        setError("Record UUID not found in response");
        setLoading(false);
        return;
      }
      console.log("Extracted UUID:", uuid);
      setSapUuid(uuid);

      // Map mode of transport from SAP to display format
      // SAP stores it as TransportMode, not ModeOfTransport
      let displayMode = record.TransportMode || record.ModeOfTransport || "";
      if (displayMode === "By Hand") displayMode = "Hand";
      if (displayMode === "By Road") displayMode = "Truck";

      // Populate form data with all RGP fields
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
        inwardTime: parseSapTime(record.InwardTime)
      });

      // Build material rows from the record
      const materials = [];
      // First material has no suffix, then Material2, Material3, Material4, Material5
      for (let i = 0; i <= 4; i++) {
        const suffix = i === 0 ? '' : (i + 1).toString();
        const materialCode = record[`Material${suffix}`];
        const materialDescription = record[`MaterialDescription${suffix}`];
        const returnableQty = record[`ReturnableQty${suffix}`] || "";
        const receivedQty = record[`ReceivedQty${suffix}`] || "";
        
        if (materialCode || materialDescription) {
          materials.push({
            id: i + 1,
            materialCode: materialCode || "",
            materialDescription: materialDescription || "",
            returnableQuantity: returnableQty,
            receivedQuantity: receivedQty, // Load existing value or allow user input
            uom: "",
            approximateValue: "",
            remarks: ""
          });
        }
      }

      if (materials.length === 0) {
        setError("No materials found in this Gate Entry");
        setLoading(false);
        return;
      }

      setTableRows(materials);
      setRecordFound(true);
      setSuccess("Gate Entry loaded successfully! Please enter Received Quantities.");

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

    // Validate received quantities
    const hasReceivedQty = tableRows.some(row => row.receivedQuantity && parseFloat(row.receivedQuantity) > 0);
    if (!hasReceivedQty) {
      setError("Please enter at least one Received Quantity");
      return;
    }

    setSaving(true);

    try {
      // Prepare payload with correct SAP field names (ReceivedQty, not ReceivedQuantity)
      const payload = {};
      
      tableRows.forEach((row, index) => {
        const suffix = index === 0 ? '' : (index + 1).toString();
        if (row.receivedQuantity) {
          // SAP field is ReceivedQty (not ReceivedQuantity)
          payload[`ReceivedQty${suffix}`] = row.receivedQuantity;
        }
      });

      console.log("Updating RGP Gate In with payload:", payload);

      // Update the gate entry with received quantities
      await updateRgpGateEntry(sapUuid, payload);
      
      setSuccess("Received quantities saved successfully!");
      
      // Reset after 2 seconds
      setTimeout(() => {
        setFormData({
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
          inwardTime: ""
        });
        setTableRows([]);
        setGateEntryNumber("");
        setRecordFound(false);
        setSapUuid("");
        setSuccess("");
      }, 2000);

    } catch (err) {
      console.error("Failed to save received quantities:", err);
      setError(err?.response?.data?.error?.message?.value || err?.message || "Failed to save received quantities");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rgp-container">
      <div className="rgp-header">
        <h2>RGP Gate In - Receive Materials</h2>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {success && (
        <div className="success-message">
          {success}
        </div>
      )}

      <form onSubmit={handleSave} className="rgp-form">
        {/* Gate Entry Number Search */}
        <div className="header-section">
          <h3>Search Gate Entry</h3>
          <div className="form-grid" style={{ gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
            <div className="form-group">
              <label>Gate Entry Number <span className="required">*</span></label>
              <input
                type="text"
                value={gateEntryNumber}
                onChange={(e) => setGateEntryNumber(e.target.value)}
                placeholder="Enter Gate Entry Number"
                disabled={recordFound}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button 
                type="button" 
                onClick={handleFetchGateEntry} 
                className="submit-btn"
                disabled={loading || recordFound}
                style={{ width: '100%' }}
              >
                {loading ? "Loading..." : recordFound ? "Loaded" : "Fetch Gate Entry"}
              </button>
            </div>
          </div>
        </div>

        {/* Header Information - Read Only */}
        {recordFound && (
          <>
            <div className="header-section">
              <h3>Header Information (Read-Only)</h3>

              <div className="form-grid">
                <div className="form-group">
                  <label>Plant</label>
                  <input
                    type="text"
                    value={formData.plant}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>

                <div className="form-group">
                  <label>Vendor</label>
                  <input
                    type="text"
                    value={formData.vendor}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>

                <div className="form-group">
                  <label>Vendor Name</label>
                  <input
                    type="text"
                    value={formData.vendorName}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>

                <div className="form-group">
                  <label>Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>

                <div className="form-group">
                  <label>Requisitioner</label>
                  <input
                    type="text"
                    value={formData.requisitioner}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>

                <div className="form-group">
                  <label>Place</label>
                  <input
                    type="text"
                    value={formData.place}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>

                <div className="form-group">
                  <label>Mode of Transport</label>
                  <input
                    type="text"
                    value={formData.modeOfTransport}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>

                <div className="form-group">
                  <label>Gate Entry Date</label>
                  <input
                    type="date"
                    value={formData.gateEntryDate}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>

                <div className="form-group">
                  <label>Inward Time</label>
                  <input
                    type="text"
                    value={formData.inwardTime}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>

                <div className="form-group">
                  <label>UOM</label>
                  <input
                    type="text"
                    value={formData.uom}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>

                <div className="form-group">
                  <label>Approximate Value</label>
                  <input
                    type="text"
                    value={formData.approximateValue}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>

                <div className="form-group">
                  <label>Purpose</label>
                  <input
                    type="text"
                    value={formData.purpose}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>

                {formData.modeOfTransport === "Truck" && (
                  <>
                    <div className="form-group">
                      <label>Vehicle Number</label>
                      <input
                        type="text"
                        value={formData.vehicleNumber}
                        readOnly
                        style={{ backgroundColor: '#f0f0f0' }}
                      />
                    </div>

                    <div className="form-group">
                      <label>Transporter Code</label>
                      <input
                        type="text"
                        value={formData.transporterCode}
                        readOnly
                        style={{ backgroundColor: '#f0f0f0' }}
                      />
                    </div>

                    <div className="form-group">
                      <label>Transporter Name</label>
                      <input
                        type="text"
                        value={formData.transporterName}
                        readOnly
                        style={{ backgroundColor: '#f0f0f0' }}
                      />
                    </div>

                    <div className="form-group">
                      <label>Driver Name</label>
                      <input
                        type="text"
                        value={formData.driverName}
                        readOnly
                        style={{ backgroundColor: '#f0f0f0' }}
                      />
                    </div>

                    <div className="form-group">
                      <label>Driver Phone Number</label>
                      <input
                        type="text"
                        value={formData.driverPhoneNumber}
                        readOnly
                        style={{ backgroundColor: '#f0f0f0' }}
                      />
                    </div>

                    <div className="form-group">
                      <label>DL Number</label>
                      <input
                        type="text"
                        value={formData.dlNumber}
                        readOnly
                        style={{ backgroundColor: '#f0f0f0' }}
                      />
                    </div>
                  </>
                )}

                <div className="form-group full-width">
                  <label>Remarks / Purpose</label>
                  <input
                    type="text"
                    value={formData.remarks}
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                  />
                </div>
              </div>
            </div>

            {/* Material Table with Received Quantity */}
            <div className="table-section">
              <h3>Material Details - Enter Received Quantities</h3>
              <div className="table-wrapper">
                <table className="rgp-table">
                  <thead>
                    <tr>
                      <th>Material Code</th>
                      <th>Material Description</th>
                      <th>Returnable Qty</th>
                      <th>Received Qty <span className="required">*</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <input
                            type="text"
                            value={row.materialCode}
                            readOnly
                            style={{ backgroundColor: '#f0f0f0' }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={row.materialDescription}
                            readOnly
                            style={{ backgroundColor: '#f0f0f0' }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={row.returnableQuantity}
                            readOnly
                            style={{ backgroundColor: '#f0f0f0' }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={row.receivedQuantity}
                            onChange={(e) => handleRowChange(row.id, "receivedQuantity", e.target.value)}
                            placeholder="Enter Qty"
                            step="0.01"
                            min="0"
                            style={{ backgroundColor: '#fffbf0', fontWeight: 'bold' }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
              <button type="submit" className="submit-btn" disabled={saving}>
                {saving ? "Saving..." : "Save Received Quantities"}
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setFormData({
                    plant: "",
                    vendor: "",
                    vendorName: "",
                    modeOfTransport: "",
                    vehicleNumber: "",
                    transporterCode: "",
                    transporterName: "",
                    driverName: "",
                    driverPhoneNumber: "",
                    dlNumber: "",
                    remarks: "",
                    gateEntryDate: "",
                    inwardTime: ""
                  });
                  setTableRows([]);
                  setGateEntryNumber("");
                  setRecordFound(false);
                  setSapUuid("");
                  setError("");
                  setSuccess("");
                }} 
                className="cancel-btn"
                disabled={saving}
              >
                Reset
              </button>
              <button 
                type="button" 
                onClick={() => navigate("/home/rgp")} 
                className="cancel-btn"
                disabled={saving}
              >
                Back
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
