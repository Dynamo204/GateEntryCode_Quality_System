import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "../../api";
import "./CreateHeader.css";
import "./InitialReg.css";

// Format date to DD-MM-YYYY (Indian format)
function formatIndianDate(dateStr) {
  if (!dateStr) return '';
  let dateObj;
  // Match /Date(1774424002904+0000)/ or /Date(1774424002904)/
  if (/^\/Date\((\d+)[+\-]\d{4}\)\/$/.test(dateStr) || /^\/Date\((\d+)\)\/$/.test(dateStr)) {
    const ms = parseInt(dateStr.match(/\d+/)[0], 10);
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

export default function CancelWeightDocument() {
  const navigate = useNavigate();
  const currentDate = new Date().toISOString().split('T')[0];

  // State for cancelled weight documents list
  const [cancelledDocs, setCancelledDocs] = useState([]);
  const [cancelledLoading, setCancelledLoading] = useState(false);
  const [cancelledError, setCancelledError] = useState(null);
  const [sortOrder, setSortOrder] = useState('desc');

  // Fetch cancelled weight documents on mount
  useEffect(() => {
    const fetchCancelled = async () => {
      setCancelledLoading(true);
      setCancelledError(null);
      try {
        const filter = "$filter=Status eq 'Cancelled'";
        const resp = await axios.get(
          `${API_BASE}/weightdocs?${filter}&$format=json`
        );
        let docs = resp?.data?.d?.results || resp?.data?.value || [];
        if (Array.isArray(docs)) {
          docs = sortDocs(docs, sortOrder);
        }
        setCancelledDocs(Array.isArray(docs) ? docs : []);
      } catch (err) {
        setCancelledError("Failed to fetch cancelled weight documents");
      } finally {
        setCancelledLoading(false);
      }
    };
    fetchCancelled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortOrder]);

  function sortDocs(docs, order) {
    return [...docs].sort((a, b) => {
      const numA = parseInt(String(a.WeightDocNumber).replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(String(b.WeightDocNumber).replace(/\D/g, ''), 10) || 0;
      if (order === 'asc') return numA - numB;
      return numB - numA;
    });
  }

  const [formData, setFormData] = useState({
    WeightDocNumber: "",
    FiscalYear: new Date().getFullYear().toString(),
    Status: "Cancelled",
    Reason: "",
    CancelledDate: currentDate,
  });

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [weightDocDetails, setWeightDocDetails] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!formData.WeightDocNumber) {
      setError("Please enter Weight Document Number");
      return;
    }

    setSearching(true);
    setError(null);
    setWeightDocDetails(null);

    try {
      const response = await axios.get(
        `${API_BASE}/weightdocs?$filter=WeightDocNumber eq '${formData.WeightDocNumber}'&$format=json`
      );
      
      const docs = response?.data?.d?.results || response?.data?.value || [];
      
      if (!Array.isArray(docs) || docs.length === 0) {
        setError(`Weight Document Number "${formData.WeightDocNumber}" not found`);
        return;
      }

      const doc = docs[0];
      
      // Check if already cancelled
      if (doc.Status === "Cancelled") {
        setError(`Weight Document Number "${formData.WeightDocNumber}" is already cancelled.`);
        return;
      }
      
      setWeightDocDetails(doc);
      
      setFormData(prev => ({
        ...prev,
        FiscalYear: doc.FiscalYear || prev.FiscalYear,
      }));
    } catch (err) {
      console.error("Search error:", err);
      setError(err.response?.data?.error?.message?.value || err.response?.data?.error || err.message || "Failed to fetch weight document details");
    } finally {
      setSearching(false);
    }
  };

  const handleCancel = async (e) => {
    e.preventDefault();

    if (!formData.WeightDocNumber) {
      setError("Please enter Weight Document Number");
      return;
    }

    if (!formData.Reason || formData.Reason.trim() === "") {
      setError("Please enter cancellation reason");
      return;
    }

    if (!window.confirm(`Are you sure you want to cancel Weight Document Number ${formData.WeightDocNumber}?`)) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const key = weightDocDetails?.WeightDocNumber || weightDocDetails?.SAP_UUID || weightDocDetails?.uuid || weightDocDetails?.UUID;
      if (!key) {
        console.error('[DBG] Weight doc details:', weightDocDetails);
        throw new Error("Cannot find weight document key. Please search for the document first.");
      }

      const cancelData = {
        Status: "Cancelled",
        PurposeofCancellation: formData.Reason,
        SAP_LastChangedDateTime: new Date().toISOString(),
      };

      await axios.patch(`${API_BASE}/weightdocs/${key}`, cancelData);

      setSuccess(`Weight Document Number ${formData.WeightDocNumber} has been cancelled successfully!`);

    } catch (err) {
      console.error("Cancel error:", err);
      setError(err.response?.data?.error?.message?.value || err.response?.data?.error || err.message || "Failed to cancel weight document");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      WeightDocNumber: "",
      FiscalYear: new Date().getFullYear().toString(),
      Status: "Cancelled",
      Reason: "",
      CancelledDate: currentDate,
    });
    setWeightDocDetails(null);
    setError(null);
    setSuccess(null);
  };

  const handleOkClick = () => {
    navigate('/home');
  };

  return (
    <div className="create-header-container initial-reg-wrapper">
      <h2 className="initial-reg-title">Cancel Weight Document Number</h2>

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
              <label htmlFor="WeightDocNumber">Weight Document Number *</label>
              <input
                type="text"
                id="WeightDocNumber"
                name="WeightDocNumber"
                value={formData.WeightDocNumber}
                onChange={handleChange}
                placeholder="Enter Weight Document Number"
                required
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching || !formData.WeightDocNumber}
                className="submit-button"
                style={{ width: '100%', margin: 0 }}
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </div>

        {/* Weight Document Details Section */}
        {weightDocDetails && (
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
            }}>Weight Document Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
              <div className="form-group">
                <label>Weight Doc Number</label>
                <input
                  type="text"
                  value={weightDocDetails.WeightDocNumber || 'N/A'}
                  readOnly
                  style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
                />
              </div>
              <div className="form-group">
                <label>Fiscal Year</label>
                <input
                  type="text"
                  value={weightDocDetails.FiscalYear || 'N/A'}
                  readOnly
                  style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
                />
              </div>
              <div className="form-group">
                <label>Gate Entry Number</label>
                <input
                  type="text"
                  value={weightDocDetails.GateEntryNumber || 'N/A'}
                  readOnly
                  style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
                />
              </div>
              <div className="form-group">
                <label>Truck Number</label>
                <input
                  type="text"
                  value={weightDocDetails.TruckNumber || 'N/A'}
                  readOnly
                  style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
                />
              </div>
              <div className="form-group">
                <label>Material</label>
                <input
                  type="text"
                  value={weightDocDetails.MaterialDescription || 'N/A'}
                  readOnly
                  style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
                />
              </div>
              <div className="form-group">
                <label>Gross Weight</label>
                <input
                  type="text"
                  value={weightDocDetails.GrossWeight || 'N/A'}
                  readOnly
                  style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
                />
              </div>
              <div className="form-group">
                <label>Net Weight</label>
                <input
                  type="text"
                  value={weightDocDetails.NetWeight || 'N/A'}
                  readOnly
                  style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <input
                  type="text"
                  value={weightDocDetails.Status || 'N/A'}
                  readOnly
                  style={{
                    backgroundColor: weightDocDetails.Status === 'Cancelled' ? '#fee2e2' : '#e2e8f0',
                    cursor: 'not-allowed',
                    fontWeight: 'bold',
                    color: weightDocDetails.Status === 'Cancelled' ? '#dc2626' : '#1e293b',
                    border: weightDocDetails.Status === 'Cancelled' ? '2px solid #ef4444' : '2px solid #cbd5e1'
                  }}
                />
              </div>
              <div className="form-group">
                <label>Purpose of Cancellation</label>
                <input
                  type="text"
                  value={weightDocDetails.PurposeofCancellation || 'N/A'}
                  readOnly
                  style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Cancellation Reason Section */}
        {weightDocDetails && (
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
          {weightDocDetails && (
            <>
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="submit-button"
                style={{
                  background: loading
                    ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
                    : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                }}
              >
                {loading ? 'Cancelling...' : 'Cancel Weight Document'}
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
            <p style={{ color: '#666', fontSize: '1rem', marginBottom: '8px' }}>Weight Document Number</p>
            <p style={{
              color: '#155724',
              fontSize: '1.75rem',
              fontWeight: 700,
              marginBottom: '24px'
            }}>{formData.WeightDocNumber}</p>
            <p style={{ color: '#666', fontSize: '0.95rem', marginBottom: '24px' }}>has been cancelled successfully</p>
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

      {/* Cancelled Weight Documents List */}
      <div style={{ marginTop: 40 }}>
        <h2 className="initial-reg-title" style={{ marginBottom: 16 }}>Cancelled Weight Documents</h2>
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
        {cancelledLoading && <div style={{ color: '#2563eb', fontWeight: 500 }}>Loading cancelled documents...</div>}
        {cancelledError && <div style={{ color: '#dc2626', fontWeight: 500 }}>{cancelledError}</div>}
        {!cancelledLoading && !cancelledError && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Weight Doc #</th>
                  <th>Gate Entry #</th>
                  <th>Truck #</th>
                  <th>Material</th>
                  <th>Net Weight</th>
                  <th>Status</th>
                  <th>Cancellation Reason</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {cancelledDocs.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: '#888' }}>No cancelled weight documents found.</td>
                  </tr>
                ) : (
                  cancelledDocs.map((doc, idx) => (
                    <tr key={doc.WeightDocNumber || doc.SAP_UUID || idx}>
                      <td>{doc.WeightDocNumber || '-'}</td>
                      <td>{doc.GateEntryNumber || '-'}</td>
                      <td>{doc.TruckNumber || '-'}</td>
                      <td>{doc.MaterialDescription || '-'}</td>
                      <td>{doc.NetWeight || '-'}</td>
                      <td><span style={{ color: '#dc2626', fontWeight: 600 }}>Cancelled</span></td>
                      <td>{doc.PurposeofCancellation || '-'}</td>
                      <td>{formatIndianDate(doc.SAP_LastChangedDateTime || doc.SAP_CreatedDateTime)}</td>
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
