import React, { useState } from "react";
import { createGrn } from "../../api";

function GrnCreateByGateEntry() {
  const [gateEntryNumbers, setGateEntryNumbers] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");

  const handleCreateGrn = async () => {
    // Accept comma, space, or newline separated numbers
    const numbers = gateEntryNumbers
      .split(/[,\n ]+/)
      .map(s => s.trim())
      .filter(Boolean);
    if (numbers.length === 0) {
      setError("Please enter at least one Gate Entry Number");
      return;
    }

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const res = await createGrn({ gateEntryNumber: numbers });
      if (res.data && Array.isArray(res.data.results)) {
        setResults(res.data.results);
      } else if (res.data && res.data.materialDocument) {
        setResults([{ gateEntryNumber: numbers[0], materialDocument: res.data.materialDocument }]);
      } else {
        setError("Unexpected response from server");
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
        "Failed to create GRN"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #e3f0ff 0%, #f8fbff 100%)' }}>
      <div style={{ maxWidth: 480, width: '100%', background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '32px 28px', margin: '32px 0' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 24, color: '#2a4d8f', fontWeight: 700 }}>Create GRN <span style={{ fontWeight: 400, fontSize: 18 }}>(Multiple Gate Entries)</span></h2>

        <label htmlFor="gateEntryNumbers" style={{ fontWeight: 500, color: '#444', marginBottom: 8, display: 'block' }}>Gate Entry Numbers</label>
        <textarea
          id="gateEntryNumbers"
          rows={4}
          placeholder="Enter Gate Entry Numbers (comma, space, or newline separated)"
          value={gateEntryNumbers}
          onChange={e => setGateEntryNumbers(e.target.value)}
          style={{ width: "100%", padding: 12, borderRadius: 8, border: '1px solid #bcd0ee', fontSize: 16, marginBottom: 18, resize: "vertical", boxSizing: 'border-box' }}
        />

        <button
          onClick={handleCreateGrn}
          disabled={loading}
          style={{
            width: "100%",
            padding: '12px 0',
            background: '#2a4d8f',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 18,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 8px rgba(42,77,143,0.08)',
            marginBottom: 10
          }}
        >
          {loading ? "Creating GRN(s)..." : "Create GRN(s)"}
        </button>

        {error && (
          <div style={{ color: "#d32f2f", background: '#fff4f4', borderRadius: 6, padding: '10px 14px', marginTop: 10, fontWeight: 500 }}>
            ❌ {error}
          </div>
        )}

        {results.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h4 style={{ color: '#2a4d8f', marginBottom: 12 }}>Results:</h4>
            <div style={{ borderRadius: 8, border: '1px solid #e3eaf5', background: '#f6fafd', padding: '16px 12px' }}>
              {results.map((r, idx) => (
                <div key={idx} style={{ marginBottom: 14, paddingBottom: 10, borderBottom: idx < results.length - 1 ? '1px solid #e3eaf5' : 'none' }}>
                  <div style={{ fontWeight: 500, color: '#444' }}>
                    <span style={{ color: '#2a4d8f' }}>Gate Entry:</span> {r.gateEntryNumber}
                  </div>
                  {r.materialDocument ? (
                    <div style={{ color: '#388e3c', fontWeight: 600, marginTop: 4 }}>
                      GRN: {r.materialDocument} {r.year ? <span style={{ color: '#888', fontWeight: 400 }}>(Year: {r.year})</span> : ''}
                    </div>
                  ) : (
                    <div style={{ color: '#d32f2f', fontWeight: 500, marginTop: 4 }}>
                      Error: {r.error || 'Unknown error'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GrnCreateByGateEntry;
