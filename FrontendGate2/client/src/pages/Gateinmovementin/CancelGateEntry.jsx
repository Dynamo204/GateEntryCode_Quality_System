import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchGateEntryByNumber, updateHeaderByKey } from "../../api";
import "./CreateHeader.css";
import "./InitialReg.css";


// Format date to DD-MM-YYYY (Indian format)
function formatIndianDate(dateStr) {
  if (!dateStr) return '';
  // Try to parse OData date format or ISO
  let dateObj;
  if (/^\/Date\((\d+)\)\/$/.test(dateStr)) {
    // OData format: /Date(1640995200000)/
    const ms = parseInt(dateStr.match(/^\/Date\((\d+)\)\/$/)[1], 10);
    dateObj = new Date(ms);
  } else {
    dateObj = new Date(dateStr);
  }
  if (isNaN(dateObj)) return dateStr;
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export default function CancelGateEntry() {
  const navigate = useNavigate();
  const currentDate = new Date().toISOString().split('T')[0];

  // State for cancelled gate entries list
  const [cancelledEntries, setCancelledEntries] = useState([]);
  const [cancelledLoading, setCancelledLoading] = useState(false);
  const [cancelledError, setCancelledError] = useState(null);
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'

  // Fetch cancelled gate entries on mount
  useEffect(() => {
    const fetchCancelled = async () => {
      setCancelledLoading(true);
      setCancelledError(null);
      try {
        // Use OData filter to fetch only cancelled entries
        const filter = "$filter=Status eq 'CANCELLED'";
        const resp = await fetchGateEntryByNumber(filter);
        let entries = resp?.data?.d?.results || resp?.data?.value || [];
        if (Array.isArray(entries)) {
          entries = sortEntries(entries, sortOrder);
        }
        setCancelledEntries(Array.isArray(entries) ? entries : []);
      } catch (err) {
        setCancelledError("Failed to fetch cancelled gate entries");
      } finally {
        setCancelledLoading(false);
      }
    };
    fetchCancelled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortOrder]);

  // Sorting function for Gate Entry Number (numeric, like InitialReg)
  function sortEntries(entries, order) {
    return [...entries].sort((a, b) => {
      // Remove non-digits and parse as integer for robust sorting
      const numA = parseInt(String(a.GateEntryNumber).replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(String(b.GateEntryNumber).replace(/\D/g, ''), 10) || 0;
      if (order === 'asc') return numA - numB;
      return numB - numA;
    });
  }

  const [formData, setFormData] = useState({
    GateEntryNumber: "",
    FiscalYear: new Date().getFullYear().toString(),
    Indicators: "",
    VehicleNumber: "",
    Status: "CANCELLED",
    Reason: "",
    CancelledBy: "",
    CancelledDate: currentDate,
  });

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [gateEntryDetails, setGateEntryDetails] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!formData.GateEntryNumber) {
      setError("Please enter Gate Entry Number");
      return;
    }

    setSearching(true);
    setError(null);
    setGateEntryDetails(null);

    try {
      const response = await fetchGateEntryByNumber(formData.GateEntryNumber);
      console.log('[DBG] Gate entry response:', response?.data);
      
      const entries = response?.data?.d?.results || response?.data?.value || [];
      
      if (!Array.isArray(entries) || entries.length === 0) {
        setError(`Gate Entry Number "${formData.GateEntryNumber}" not found`);
        return;
      }

      const entry = entries[0];
      
      // Check if already cancelled
      if (entry.Status === "CANCELLED") {
        setError(`Gate Entry Number "${formData.GateEntryNumber}" is already cancelled. Reason: ${entry.Purpose || "Not specified"}`);
        return;
      }
      
      setGateEntryDetails(entry);
      
      // Pre-fill form data from search result
      setFormData(prev => ({
        ...prev,
        VehicleNumber: entry.VehicleNumber || "",
        Indicators: entry.Indicators || "",
        FiscalYear: entry.FiscalYear || prev.FiscalYear,
      }));
    } catch (err) {
      console.error("Search error:", err);
      setError(err.response?.data?.error?.message?.value || err.response?.data?.error || err.message || "Failed to fetch gate entry details");
    } finally {
      setSearching(false);
    }
  };

  const handleCancel = async (e) => {
    e.preventDefault();

    if (!formData.GateEntryNumber) {
      setError("Please enter Gate Entry Number");
      return;
    }

    if (!formData.Reason || formData.Reason.trim() === "") {
      setError("Please enter cancellation reason");
      return;
    }

    if (!window.confirm(`Are you sure you want to cancel Gate Entry Number ${formData.GateEntryNumber}?`)) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Use GateEntryNumber if available, else fallback to UUID
      const key = gateEntryDetails?.GateEntryNumber || gateEntryDetails?.SAP_UUID || gateEntryDetails?.uuid || gateEntryDetails?.UUID;
      if (!key) {
        console.error('[DBG] Gate entry details:', gateEntryDetails);
        throw new Error("Cannot find gate entry key. Please search for the gate entry first.");
      }
      console.log('[DBG] Using key for cancellation:', key);

      const cancelData = {
        Status: "CANCELLED",
        Purpose: formData.Reason,
        SAP_LastChangedDateTime: new Date().toISOString(),
      };

      const response = await updateHeaderByKey(key, cancelData);

      // Show success popup
      setSuccess(`Gate Entry Number ${formData.GateEntryNumber} has been cancelled successfully!`);

    } catch (err) {
      console.error("Cancel error:", err);
      setError(err.response?.data?.error?.message?.value || err.response?.data?.error || err.message || "Failed to cancel gate entry");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      GateEntryNumber: "",
      FiscalYear: new Date().getFullYear().toString(),
      Indicators: "",
      VehicleNumber: "",
      Status: "CANCELLED",
      Reason: "",
      CancelledBy: "",
      CancelledDate: currentDate,
    });
    setGateEntryDetails(null);
    setError(null);
    setSuccess(null);
  };

  const handleOkClick = () => {
    navigate('/home');
  };

  return (
    <div className="create-header-container initial-reg-wrapper">
      <h2 className="initial-reg-title">Cancel Gate Entry Number</h2>

      {error && (
        <div className="error-message" style={{
          padding: '12px',
          marginBottom: '16px',
          backgroundColor: '#fee2e2',
          border: '2px solid #ef4444',
          borderRadius: '12px',
          color: '#dc2626',
          fontWeight: 500
        }}>
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="success-message" style={{
          marginBottom: 16,
          background: '#e6ffed',
          color: '#256029',
          padding: 12,
          borderRadius: 12,
          fontWeight: 500,
          border: '2px solid #10b981'
        }}>
          ✓ {success}
        </div>
      )}

      <form className="create-header-form" onSubmit={(e) => e.preventDefault()}>
        {/* Search Section */}
        <div className="form-fields-section">
          <div className="form-row-2col">
            <div className="form-group">
              <label htmlFor="GateEntryNumber">Gate Entry Number *</label>
              <input
                type="text"
                id="GateEntryNumber"
                name="GateEntryNumber"
                value={formData.GateEntryNumber}
                onChange={handleChange}
                placeholder="Enter Gate Entry Number"
                required
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching || !formData.GateEntryNumber}
                className="submit-button"
                style={{ width: '100%', margin: 0 }}
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </div>

        {/* Gate Entry Details Section */}
        {gateEntryDetails && (
          <div className="form-fields-section" style={{
            backgroundColor: '#f8fafc',
            padding: '20px',
            borderRadius: '12px',
            border: '2px solid #e2e8f0'
          }}>
            <h3 style={{
              margin: '0 0 16px',
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#1e293b',
              borderBottom: '2px solid #cbd5e1',
              paddingBottom: '8px'
            }}>Gate Entry Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
              <div className="form-group">
                <label>Gate Entry Number</label>
                <input
                  type="text"
                  value={gateEntryDetails.GateEntryNumber || 'N/A'}
                  readOnly
                  style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
                />
              </div>
              <div className="form-group">
                <label>Vehicle Number</label>
                <input
                  type="text"
                  value={gateEntryDetails.VehicleNumber || 'N/A'}
                  readOnly
                  style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
                />
              </div>
              <div className="form-group">
                <label>Indicators</label>
                <input
                  type="text"
                  value={gateEntryDetails.Indicators || 'N/A'}
                  readOnly
                  style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
                />
              </div>
              <div className="form-group">
                <label>Gate Entry Date</label>
                <input
                  type="text"
                  value={gateEntryDetails.GateEntryDate || 'N/A'}
                  readOnly
                  style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
              <div className="form-group">
                <label>Transporter Name</label>
                <input
                  type="text"
                  value={gateEntryDetails.TransporterName || 'N/A'}
                  readOnly
                  style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
                />
              </div>
              <div className="form-group">
                <label>Driver Name</label>
                <input
                  type="text"
                  value={gateEntryDetails.DriverName || 'N/A'}
                  readOnly
                  style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
                />
              </div>
              <div className="form-group">
                <label>Driver Phone Number</label>
                <input
                  type="text"
                  value={gateEntryDetails.DriverPhoneNumber || 'N/A'}
                  readOnly
                  style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
                />
              </div>
              <div className="form-group">
                <label>Vehicle Status</label>
                <input
                  type="text"
                  value={gateEntryDetails.VehicleStatus || 'N/A'}
                  readOnly
                  style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
              <div className="form-group">
                <label>Status</label>
                <input
                  type="text"
                  value={gateEntryDetails.Status || 'N/A'}
                  readOnly
                  style={{
                    backgroundColor: gateEntryDetails.Status === 'CANCELLED' ? '#fee2e2' : '#e2e8f0',
                    cursor: 'not-allowed',
                    fontWeight: 'bold',
                    color: gateEntryDetails.Status === 'CANCELLED' ? '#dc2626' : '#1e293b',
                    border: gateEntryDetails.Status === 'CANCELLED' ? '2px solid #ef4444' : '2px solid #cbd5e1'
                  }}
                />
              </div>
              {gateEntryDetails.PurchaseOrderNumber && (
                <div className="form-group">
                  <label>Purchase Order Number</label>
                  <input
                    type="text"
                    value={gateEntryDetails.PurchaseOrderNumber || 'N/A'}
                    readOnly
                    style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
                  />
                </div>
              )}
              {gateEntryDetails.VendorName && (
                <div className="form-group">
                  <label>Vendor Name</label>
                  <input
                    type="text"
                    value={gateEntryDetails.VendorName || 'N/A'}
                    readOnly
                    style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
                  />
                </div>
              )}
              {gateEntryDetails.MaterialDescription && (
                <div className="form-group">
                  <label>Material Description</label>
                  <input
                    type="text"
                    value={gateEntryDetails.MaterialDescription || 'N/A'}
                    readOnly
                    style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
                  />
                </div>
              )}
            </div>
            {gateEntryDetails.Purpose && (
              <div className="form-group">
                <label style={{ color: '#dc2626', fontWeight: 'bold' }}>Cancellation Reason</label>
                <textarea
                  value={gateEntryDetails.Purpose || 'N/A'}
                  readOnly
                  rows="2"
                  style={{
                    backgroundColor: '#fee2e2',
                    cursor: 'not-allowed',
                    width: '100%',
                    resize: 'none',
                    border: '2px solid #ef4444',
                    color: '#dc2626',
                    fontWeight: 500
                  }}
                />
              </div>
            )}
          </div>
        )}
        {/* Cancellation Reason Section */}
        {gateEntryDetails && (
          <div className="form-fields-section">
            <div className="form-group">
              <label htmlFor="Reason">Cancellation Reason *</label>
              <textarea
                id="Reason"
                name="Reason"
                value={formData.Reason}
                onChange={handleChange}
                placeholder="Enter reason for cancellation"
                rows="3"
                required
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
          </div>
        )}
        {/* Action Buttons */}
        <div className="actions-row">
          {gateEntryDetails && (
            <>
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="submit-button"
                style={{
                  background: loading ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                }}
              >
                {loading ? 'Cancelling...' : 'Cancel Gate Entry'}
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                className="secondary-button"
                style={{
                  background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
                }}
              >
                Reset
              </button>
            </>
          )}

        </div>
      </form>

      {/* Success Popup Modal */}
      {success && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            padding: '32px',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            maxWidth: '500px',
            width: '90%',
            textAlign: 'center',
            animation: 'slideInDown 0.4s ease-out'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#d4edda',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '32px'
            }}>
              ✓
            </div>
            <h3 style={{
              color: '#155724',
              fontSize: '1.5rem',
              fontWeight: 600,
              marginBottom: '16px'
            }}>Cancellation Successful!</h3>
            <p style={{
              color: '#666',
              fontSize: '1rem',
              marginBottom: '8px'
            }}>Gate Entry Number</p>
            <p style={{
              color: '#155724',
              fontSize: '1.75rem',
              fontWeight: 700,
              marginBottom: '24px'
            }}>{formData.GateEntryNumber}</p>
            <p style={{
              color: '#666',
              fontSize: '0.95rem',
              marginBottom: '24px'
            }}>has been cancelled successfully</p>
            <button
              onClick={handleOkClick}
              className="submit-button"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                margin: '0 auto'
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    {/* Cancelled Gate Entries List */}
    <div style={{ marginTop: 40 }}>
      <h2 className="initial-reg-title" style={{ marginBottom: 16 }}>Cancelled Gate Entries</h2>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="secondary-button small"
          style={{ background: '#f1f5f9', color: '#2563eb', border: '1px solid #2563eb', fontWeight: 600 }}
          onClick={() => setSortOrder('asc')}
        >
          Sort Ascending
        </button>
        <button
          type="button"
          className="secondary-button small"
          style={{ background: '#f1f5f9', color: '#2563eb', border: '1px solid #2563eb', fontWeight: 600 }}
          onClick={() => setSortOrder('desc')}
        >
          Sort Descending
        </button>
      </div>
      {cancelledLoading && <div style={{ color: '#2563eb', fontWeight: 500 }}>Loading cancelled entries...</div>}
      {cancelledError && <div style={{ color: '#dc2626', fontWeight: 500 }}>{cancelledError}</div>}
      {!cancelledLoading && !cancelledError && (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 800 }}>
            <thead>
              <tr>
                <th>Gate Entry Number</th>
                <th>Vehicle Number</th>
                <th>Indicators</th>
                <th>Gate Entry Date</th>
                <th>Transporter Name</th>
                <th>Status</th>
                <th>Cancellation Reason</th>
              </tr>
            </thead>
            <tbody>
              {cancelledEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#888' }}>No cancelled gate entries found.</td>
                </tr>
              ) : (
                cancelledEntries.map((entry, idx) => (
                  <tr key={entry.GateEntryNumber || entry.SAP_UUID || idx}>
                    <td>{entry.GateEntryNumber || '-'}</td>
                    <td>{entry.VehicleNumber || '-'}</td>
                    <td>{entry.Indicators || '-'}</td>
                    <td>{formatIndianDate(entry.GateEntryDate) || '-'}</td>
                    <td>{entry.TransporterName || '-'}</td>
                    <td><span style={{ color: '#dc2626', fontWeight: 600 }}>Cancelled</span></td>
                    <td>{entry.Purpose || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </div>
  );
}
