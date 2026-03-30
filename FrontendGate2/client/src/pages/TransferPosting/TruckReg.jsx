import React, { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
// Simple modal styles (add to your CSS file for better look)
const modalStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(0,0,0,0.3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
};
const modalContentStyle = {
  background: '#fff',
  padding: 32,
  borderRadius: 8,
  minWidth: 320,
  textAlign: 'center',
  boxShadow: '0 2px 16px rgba(0,0,0,0.15)'
};
import { initialRegistration, fetchInitialRegistrations, updateInitialRegistration, fetchSalesOrderSuggestions,productSearch } from "../../api";
import { useLocation } from "react-router-dom";
//import "./InitialReg.css";
 
export default function InitialRegistration() {
  const location = useLocation();
 
  // Always initialize all fields as string or number (never undefined/null)
  const initialFormState = {
    VehicleNumber: "",
    Material: "",
    MaterialDescription: "",
    MaterialGrade: "",
    Plant: "",
    Vendor: "",
    Transporter: "",
    SAP_Description: ""
  };
 
  // Product/material search state (for both Material and Material Description fields)
  const [productOptions, setProductOptions] = useState([]);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [productLoading, setProductLoading] = useState(false);
  const [productError, setProductError] = useState("");
  // Track which field is active for dropdown: 'Material' or 'MaterialDescription'
  const [activeProductField, setActiveProductField] = useState(null);

  // Fetch product/material options when search term changes
  useEffect(() => {
    if (!productSearchTerm) {
      setProductOptions([]);
      return;
    }
    setProductLoading(true);
    setProductError("");
    productSearch(productSearchTerm)
      .then(({ data }) => {
        setProductOptions(Array.isArray(data) ? data : []);
      })
      .catch(e => {
        setProductError(e?.response?.data?.error || e.message || "Failed to fetch products/materials");
        setProductOptions([]);
      })
      .finally(() => setProductLoading(false));
  }, [productSearchTerm]);
 
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  // For success modal and print slip
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastRegData, setLastRegData] = useState(null); // { ...fields, registrationNumber }
 
  // List state
  const [showList, setShowList] = useState(false);
  const [rows, setRows] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [search, setSearch] = useState("");
  const [count, setCount] = useState(null);
 
  // No SO suggestion state needed
 
  // Prefill from navigation state
  useEffect(() => {
    if (location.state?.initialData) {
      setFormData({
        ...initialFormState,
        ...location.state.initialData
      });
    }
  }, [location.state]);
 
  // No SO suggestion effect needed
 
  // No SO suggestion click effect needed
 
  // Handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value === undefined || value === null ? "" : value
    }));
  };
 
const handleSubmit = async (e) => {
  e.preventDefault();
  setSubmitting(true);
  try {
    const payload = { ...formData }; // Do NOT set Status here
    const resp = await initialRegistration(payload);
    // Try to get registration number from response
    const regNum = resp?.data?.RegistrationNumber || resp?.data?.SalesDocument || resp?.data?.registrationNumber || resp?.data?.regNum || "";
    setLastRegData({ ...payload, registrationNumber: regNum });
    setShowSuccess(true);
    setFormData(initialFormState);
    if (showList) loadList({ search });
  } catch (error) {
    console.error("Initial Registration Error:", error);
    alert("Initial Registration Failed. Please try again.");
  } finally {
    setSubmitting(false);
  }
};
  // PDF Download slip handler
  const handlePrintSlip = () => {
    if (!lastRegData) return;
    const doc = new jsPDF();
    // Draw border and background
    doc.setDrawColor(180);
    doc.setLineWidth(0.5);
    doc.setFillColor(245, 245, 245); // light gray
    doc.rect(10, 10, 190, 120, 'FD'); // x, y, w, h, style: Fill & Draw

    // Title
    let y = 24;
    doc.setFontSize(20);
    doc.setFont(undefined, "bold");
    doc.text("Truck Registration Slip", 105, y, { align: "center" });
    y += 10;
    // Section line
    doc.setDrawColor(200);
    doc.line(20, y, 190, y);
    y += 8;

    // Details (two columns)
    doc.setFontSize(12);
    const leftFields = [
      { label: 'Registration Number', value: lastRegData.registrationNumber },
      { label: 'Truck Number', value: lastRegData.VehicleNumber },
      { label: 'Material Code', value: lastRegData.Material },
      { label: 'Material Description', value: lastRegData.MaterialDescription },
    ];
    const rightFields = [
      { label: 'Material Grade', value: lastRegData.MaterialGrade },
      { label: 'Plant', value: lastRegData.Plant },
      { label: 'Vendor', value: lastRegData.Vendor },
      { label: 'Transporter', value: lastRegData.Transporter },
    ];
    const leftX = 24;
    const rightX = 110;
    let rowY = y;
    const rowHeight = 11;
    for (let i = 0; i < 4; i++) {
      // Left column
      doc.setFont(undefined, "bold");
      doc.text(leftFields[i].label + ":", leftX, rowY);
      doc.setFont(undefined, "normal");
      doc.text(String(leftFields[i].value || '-'), leftX + 48, rowY);
      // Right column
      doc.setFont(undefined, "bold");
      doc.text(rightFields[i].label + ":", rightX, rowY);
      doc.setFont(undefined, "normal");
      doc.text(String(rightFields[i].value || '-'), rightX + 38, rowY);
      rowY += rowHeight;
    }

    // Section line before remarks
    rowY += 2;
    doc.setDrawColor(220);
    doc.line(20, rowY, 190, rowY);
    rowY += 8;

    // Remarks (full width)
    doc.setFont(undefined, "bold");
    doc.text("Remarks:", leftX, rowY);
    doc.setFont(undefined, "normal");
    doc.text(String(lastRegData.SAP_Description || '-'), leftX + 28, rowY);
    rowY += rowHeight + 2;

    // Footer line
    doc.setDrawColor(220);
    doc.line(20, rowY, 190, rowY);
    rowY += 8;
    // Footer
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.setFont(undefined, "normal");
    doc.text(`Generated on ${new Date().toLocaleString()}`, leftX, rowY);
    doc.save(`TruckRegistrationSlip_${lastRegData.registrationNumber || ''}.pdf`);
  };
 
  const loadList = async ({ search: s = "" } = {}) => {
    setListLoading(true);
    setListError("");
    try {
      const { data } = await fetchInitialRegistrations({
        top: 50,
        search: s,
        count: true
      });
      const results = data?.d?.results || [];
      setRows(results);
      setCount(data?.d?.__count ?? results.length);
    } catch (e) {
      setListError(e?.response?.data?.error || e.message || "Failed to load registrations");
    } finally {
      setListLoading(false);
    }
  };
 
  const toggleList = () => {
    const next = !showList;
    setShowList(next);
    if (next) {
      loadList({ search });
    }
  };
 
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadList({ search });
  };
 
  const handleReset = () => {
    setSearch("");
    loadList({ search: "" });
  };
 
  // Handler to cancel/update a registration to "Failed"
  const handleCancelRegistration = async (uuid, currentStatus) => {
    if (!uuid) {
      alert("Cannot update: missing UUID");
      return;
    }
    if (currentStatus === "Failed") {
      alert("This registration is already marked as Failed");
      return;
    }
    if (!window.confirm("Mark this registration as Failed?")) return;
    try {
      await updateInitialRegistration(uuid, { Status: "Failed" });
      alert("Registration marked as Failed");
      loadList({ search });
    } catch (e) {
      console.error("Cancel error:", e);
      alert("Failed to update status: " + (e?.response?.data?.error || e.message));
    }
  };
 
  return (
    <div className="create-header-container initial-reg-wrapper">
      <h2>Truck Registration for Internal Transfer Posting</h2>
      {/* Success Modal */}
      {showSuccess && lastRegData && (
        <div style={modalStyle}>
          <div style={modalContentStyle}>
            <h2>Registration Successful</h2>
            <div style={{ margin: '18px 0', fontSize: 18 }}>
              Registration Number:<br />
              <span style={{ fontWeight: 600, fontSize: 22 }}>{lastRegData.registrationNumber || '-'}</span>
            </div>
            <button
              style={{ margin: '12px 0', padding: '8px 18px', fontSize: 16, background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              onClick={handlePrintSlip}
            >
              Download Print Slip
            </button>
            <br />
            <button
              style={{ marginTop: 8, padding: '6px 16px', fontSize: 15, background: '#eee', color: '#333', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              onClick={() => setShowSuccess(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="create-header-truckreg" onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.type !== 'submit') {
          e.preventDefault();
        }
      }}>
        <div className="form-row-2col">
          <div className="form-group" style={{ position: 'relative' }}>
            <label>Truck Number</label>
            <input
              type="text"
              name="VehicleNumber"
              value={formData.VehicleNumber || ""}
              onChange={handleChange}
              autoComplete="off"
              required
            />
          </div>
          <div className="form-group">
            <label>Material Code</label>
            <input
              type="text"
              name="Material"
              value={formData.Material || ""}
              onChange={e => {
                handleChange(e);
                setProductSearchTerm(e.target.value);
                setActiveProductField('Material');
              }}
              required
              autoComplete="off"
              onFocus={() => setActiveProductField('Material')}
            />
            {/* Dropdown for product/material search */}
            {productLoading && activeProductField === 'Material' && <div className="loading-indicator">Loading...</div>}
            {productError && activeProductField === 'Material' && <div className="error-message">{productError}</div>}
            {productOptions.length > 0 && activeProductField === 'Material' && (
              <ul
                className="dropdown-list"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  width: '100%',
                  zIndex: 10,
                  background: '#fff',
                  border: '1px solid #ccc',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                }}
              >
                {productOptions.slice(0, 10).map((opt, idx) => (
                  <li
                    key={opt.Product || opt.Material || idx}
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        Material: opt.Product || opt.Material || "",
                        MaterialDescription: opt.ProductDescription || opt.Description || opt.description || ""
                      }));
                      setProductSearchTerm("");
                      setProductOptions([]);
                      setActiveProductField(null);
                    }}
                    style={{ cursor: "pointer", padding: "4px 8px" }}
                  >
                    {opt.Product || opt.Material} - {opt.ProductDescription || opt.Description || opt.description || ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="form-row-2col">
          <div className="form-group" style={{ position: 'relative' }}>
            <label>Material Description</label>
            <input
              type="text"
              name="MaterialDescription"
              value={formData.MaterialDescription || ""}
              onChange={e => {
                handleChange(e);
                setProductSearchTerm(e.target.value);
                setActiveProductField('MaterialDescription');
              }}
              required
              autoComplete="off"
              onFocus={() => setActiveProductField('MaterialDescription')}
            />
            {/* Dropdown for product/material search by description */}
            {productLoading && activeProductField === 'MaterialDescription' && <div className="loading-indicator">Loading...</div>}
            {productError && activeProductField === 'MaterialDescription' && <div className="error-message">{productError}</div>}
            {productOptions.length > 0 && activeProductField === 'MaterialDescription' && (
              <ul
                className="dropdown-list"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  width: '100%',
                  zIndex: 10,
                  background: '#fff',
                  border: '1px solid #ccc',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                }}
              >
                {productOptions.slice(0, 10).map((opt, idx) => (
                  <li
                    key={opt.Product || opt.Material || idx}
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        Material: opt.Product || opt.Material || "",
                        MaterialDescription: opt.ProductDescription || opt.Description || opt.description || ""
                      }));
                      setProductSearchTerm("");
                      setProductOptions([]);
                      setActiveProductField(null);
                    }}
                    style={{ cursor: "pointer", padding: "4px 8px" }}
                  >
                    {opt.Product || opt.Material} - {opt.ProductDescription || opt.Description || opt.description || ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="form-group">
            <label>Material Grade</label>
            <input
              type="text"
              name="MaterialGrade"
              value={formData.MaterialGrade || ""}
              onChange={handleChange}
              required
            />
          </div>
        </div>
        <div className="form-row-2col">
          <div className="form-group">
            <label>Plant Details</label>
            <input
              type="text"
              name="Plant"
              value={formData.Plant || ""}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Vendor</label>
            <input
              type="text"
              name="Vendor"
              value={formData.Vendor || ""}
              onChange={handleChange}
              required
            />
          </div>
        </div>
              {/* <div className="form-row-2col">
          <div className="form-group">
            <label>Transporter</label>
            <input
              type="text"
              name="Transporter"
              value={formData.Transporter || ""}
              onChange={handleChange}
              required
            />
         
        </div>
          <div className="form-group">
            <label>Vehicle Number</label>
            <input
              type="text"
              name="VehicleNumber"
              value={formData.VehicleNumber || ""}
              onChange={handleChange}
              required
            />
            </div>
        </div> */}
          <div className="form-group">
            <label>Remarks</label>
            <input
              type="text"
              name="SAP_Description"
              value={formData.SAP_Description || ""}
              onChange={handleChange}
            />
     
       
          {/* <div className="form-group">
            <label>Transporter</label>
            <input
              type="text"
              name="Transporter"
              value={formData.Transporter || ""}
              onChange={handleChange}
              required
            />
          </div> */}
        </div>
        {/* <div className="form-group">
          <label>Remarks</label>
          <input
            type="text"
            name="SAP_Description"
            value={formData.SAP_Description || ""}
            onChange={handleChange}
          />
        </div> */}
        <div className="actions-row">
          <button
            type="submit"
            className="submit-button"
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={toggleList}
          >
            {showList ? "Hide Register Details" : "Register Details"}
          </button>
        </div>
      </form>
      {showList && (
        <div className="registration-list-panel">
          <h3 className="panel-title">Registered Entries</h3>
          <form onSubmit={handleSearchSubmit} className="search-bar" onKeyDown={(e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.type !== 'submit') {
              e.preventDefault();
            }
          }}>
            <input
              type="text"
              placeholder="Search Sales Doc / Vehicle / Transporter / Remarks..."
              value={search || ""}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="submit-button small">
              Search
            </button>
            <button
              type="button"
              className="secondary-button small"
              onClick={handleReset}
            >
              Reset
            </button>
          </form>
          {listLoading && <div className="loading-indicator">Loading...</div>}
          {listError && (
            <div className="error-message" style={{ marginBottom: 12 }}>
              {listError}
            </div>
          )}
          {count != null && !listLoading && (
            <div className="count-text">Total: {count}</div>
          )}
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Truck Number</th>
                  <th>Material</th>
                  <th>Material Description</th>
                  <th>Material Grade</th>
                  <th>Plant</th>
                  <th>Vendor</th>
                  <th>Transporter</th>
                  <th>Remarks</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.SAP_UUID || r.SalesDocument2 || i}>
                    <td>{r.VehicleNumber || "-"}</td>
                    <td>{r.Material || "-"}</td>
                    <td>{r.MaterialDescription || "-"}</td>
                    <td>{r.MaterialGrade || "-"}</td>
                    <td>{r.Plant || "-"}</td>
                    <td>{r.Vendor || "-"}</td>
                    <td>{r.Transporter || "-"}</td>
                    <td>{r.SAP_Description || "-"}</td>
                    <td>
                      <span className={`status-badge status-${(r.Status || 'Success').toLowerCase()}`}>
                        {r.Status || "Success"}
                      </span>
                    </td>
                    <td>
                      {r.Status !== "Failed" && (
                        <button
                          type="button"
                          className="cancel-button"
                          onClick={() => handleCancelRegistration(r.SAP_UUID, r.Status)}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!listLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-row">
                      No records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
 