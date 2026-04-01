
// import React, { useState } from "react";
// import html2pdf from "html2pdf.js";
// import axios from "axios";

// export default function ReprintGateEntry() {

//   const [gateEntryNumber, setGateEntryNumber] = useState("");
//   const [headerData, setHeaderData] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");

//   // 🔹 API CALL
//   const fetchGateWeighmentDetails = (gateEntryNumber) => {
//   return axios.get(`http://localhost:4600/api/weightdetails?gateEntryNumber=${encodeURIComponent(gateEntryNumber)}`);
//   };

//   // 🔹 FORMATTER
//   const f = (val) => {
//     return val === undefined || val === null || val === "" ? "-" : val;
//   };

//   const formatDate = (sapDate) => {
//     if (!sapDate) return "-";
//     const ms = parseInt(sapDate.replace(/\/Date\((\d+)\)\//, "$1"));
//     return new Date(ms).toLocaleDateString("en-GB");
//   };

//   const formatTime = (time) => {
//     if (!time) return "-";
//     return time.replace("PT", "").replace("H", ":").replace("M", ":").replace("S", "");
//   };

//   // ================= FETCH =================
//   const handleFetch = async () => {
//     setLoading(true);
//     setError("");

//     try {
//       const res = await fetchGateWeighmentDetails(gateEntryNumber);

//       const gate = res?.data?.gateEntry;
//       const weight = res?.data?.weighments?.[0];

//       if (!gate) {
//         setError("No Data Found");
//         return;
//       }

//       // 🔥 MERGE
//       const merged = {
//         ...gate,
//         GrossWeight: weight?.GrossWeight || gate.GrossWeight,
//         TareWeight: weight?.TareWeight || gate.TareWeight,
//         NetWeight: weight?.NetWeight || gate.NetWeight,
//         WeightDocNumber: weight?.WeightDocNumber,
//       };

//       setHeaderData(merged);

//     } catch (err) {
//       setError("Fetch failed");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ================= SLIP =================
//   const buildSlipElement = async () => {

//     const now = new Date();
//     const printDate = now.toLocaleDateString("en-GB");
//     const printTime = now.toLocaleTimeString("en-GB");

//     let logo = "";
//     try {
//       const res = await fetch("/Minera_Logo.jpg");
//       const blob = await res.blob();
//       logo = await new Promise(r => {
//         const reader = new FileReader();
//         reader.onloadend = () => r(reader.result);
//         reader.readAsDataURL(blob);
//       });
//     } catch {}

//     const isSD = !!headerData?.SalesDocument;

//     const element = document.createElement("div");

//     element.innerHTML = `
//       <div style="font-family: Arial; padding:10px; font-size:12px;">

//         <div style="display:flex; justify-content:space-between;">
//           <h3>Minera Steel & Power Pvt Ltd</h3>
//           ${logo ? `<img src="${logo}" style="height:40px"/>` : ""}
//         </div>

//         <h4 style="text-align:center;">WEIGHMENT SLIP</h4>

//         <table style="width:100%;">
//           <tr><td>Gate Entry</td><td>${f(headerData.GateEntryNumber)}</td><td>Date</td><td>${printDate}</td></tr>
//           <tr><td>Time</td><td>${printTime}</td><td>Vehicle</td><td>${f(headerData.VehicleNumber)}</td></tr>
//           <tr><td>Transporter</td><td>${f(headerData.TransporterName)}</td><td>Driver</td><td>${f(headerData.DriverName)}</td></tr>
//           <tr><td>Gross</td><td>${f(headerData.GrossWeight)}</td><td>Tare</td><td>${f(headerData.TareWeight)}</td></tr>
//           <tr><td>Net</td><td>${f(headerData.NetWeight)}</td><td></td><td></td></tr>
//         </table>

//         <hr/>

//         ${
//           isSD
//           ? `
//             <h4>Sales Details</h4>
//             <table border="1" style="width:100%; border-collapse:collapse;">
//               <tr>
//                 <th>Sales</th><th>Customer</th><th>Name</th><th>Material</th><th>Description</th>
//               </tr>
//               <tr>
//                 <td>${f(headerData.SalesDocument)}</td>
//                 <td>${f(headerData.Customer)}</td>
//                 <td>${f(headerData.CustomerName)}</td>
//                 <td>${f(headerData.Material)}</td>
//                 <td>${f(headerData.MaterialDescription)}</td>
//               </tr>
//             </table>
//           `
//           : `
//             <h4>PO Details</h4>
//             <table border="1" style="width:100%; border-collapse:collapse;">
//               <tr>
//                 <th>PO</th><th>Item</th><th>Vendor</th><th>Name</th><th>Material</th>
//               </tr>
//               <tr>
//                 <td>${f(headerData.PurchaseOrderNumber)}</td>
//                 <td>${f(headerData.PurchaseOrderItem)}</td>
//                 <td>${f(headerData.Vendor)}</td>
//                 <td>${f(headerData.VendorName)}</td>
//                 <td>${f(headerData.Material)}</td>
//               </tr>
//             </table>
//           `
//         }

//         <br/>

//         <div style="display:flex; justify-content:space-between;">
//           <div>Security</div>
//           <div>Operator</div>
//           <div>Authorized</div>
//         </div>

//       </div>
//     `;

//     return element;
//   };

//   // ================= PRINT =================
//   const handlePrint = async () => {
//     const el = await buildSlipElement();

//     html2pdf()
//       .set({
//         margin: 5,
//         filename: `Weighment_${headerData.GateEntryNumber}.pdf`,
//         html2canvas: { scale: 2 },
//         jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
//       })
//       .from(el)
//       .save();
//   };

//   // ================= UI =================
//   return (
//     <div style={{ padding: 20 }}>
//       <h2>Reprint Weighment Slip</h2>

//       <input
//         value={gateEntryNumber}
//         onChange={(e) => setGateEntryNumber(e.target.value)}
//         placeholder="Enter Gate Entry Number"
//       />

//       <button onClick={handleFetch}>
//         {loading ? "Loading..." : "Fetch"}
//       </button>

//       {error && <p style={{ color: "red" }}>{error}</p>}

//       {headerData && (
//         <div style={{ marginTop: 20 }}>
//           <button onClick={handlePrint}>Download / Print Slip</button>
//         </div>
//       )}
//     </div>
//   );
// }




import React, { useState } from "react";
import html2pdf from "html2pdf.js";
import axios from "axios";
//import reprint from "ReprintGateEntry.css";

export default function ReprintGateEntry() {

  const [gateEntryNumber, setGateEntryNumber] = useState("");
  const [headerData, setHeaderData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ================= API =================
  const fetchGateWeighmentDetails = (gateEntryNumber) => {
    return axios.get(
      `https://GateEntry-Production-Server.cfapps.in30.hana.ondemand.com/api/weightdetails?gateEntryNumber=${encodeURIComponent(gateEntryNumber)}`
    );
  };

  // ================= HELPERS =================
  const f = (val) => val || "-";

  const formatDate = (sapDate) => {
    if (!sapDate) return "-";
    const ms = parseInt(sapDate.replace(/\/Date\((\d+)\)\//, "$1"));
    return new Date(ms).toLocaleDateString("en-GB");
  };

  // ================= FETCH =================
  const handleFetch = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetchGateWeighmentDetails(gateEntryNumber);

      const gate = res?.data?.gateEntry;
      const weight = res?.data?.weighments?.[0];

      if (!gate) {
        setError("No Data Found");
        return;
      }

      const merged = {
        ...gate,
        GrossWeight: weight?.GrossWeight || gate.GrossWeight,
        TareWeight: weight?.TareWeight || gate.TareWeight,
        NetWeight: weight?.NetWeight || gate.NetWeight,
        WeightDocNumber: weight?.WeightDocNumber,
      };

      setHeaderData(merged);

    } catch (err) {
      setError("Fetch failed");
    } finally {
      setLoading(false);
    }
  };

  // ================= SLIP =================
  const buildSlipElement = async () => {
    const now = new Date();
    const printDate = now.toLocaleDateString("en-GB");
    const printTime = now.toLocaleTimeString("en-GB");

    const prefix = String(headerData?.GateEntryNumber || "").slice(0, 3);
    const isSD = prefix === "261"; // Sales
    const isPO = prefix === "262"; // Purchase

    // Fetch Minera logo as base64
    let logo = "";
    try {
      const res = await fetch("/Minera_Logo.jpg");
      const blob = await res.blob();
      logo = await new Promise(r => {
        const reader = new FileReader();
        reader.onloadend = () => r(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch {}

    const element = document.createElement("div");

    element.innerHTML = `
      <div style="font-family: Arial; padding:15px; font-size:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">Minera Steel & Power Pvt Ltd</h3>
          ${logo ? `<img src="${logo}" style="height:40px; margin-left:10px;"/>` : ""}
        </div>
        <h4 style="text-align:center;">WEIGHMENT SLIP</h4>

        <table style="width:100%; margin-top:10px;">
          <tr>
            <td><b>Gate Entry</b></td><td>${f(headerData.GateEntryNumber)}</td>
            <td><b>Date</b></td><td>${printDate}</td>
          </tr>
          <tr>
            <td><b>Time</b></td><td>${printTime}</td>
            <td><b>Vehicle</b></td><td>${f(headerData.VehicleNumber)}</td>
          </tr>
          <tr>
            <td><b>Transporter</b></td><td>${f(headerData.TransporterName)}</td>
            <td><b>Driver</b></td><td>${f(headerData.DriverName)}</td>
          </tr>
          <tr>
            <td><b>Gross</b></td><td>${f(headerData.GrossWeight)}</td>
            <td><b>Tare</b></td><td>${f(headerData.TareWeight)}</td>
          </tr>
          <tr>
            <td><b>Net</b></td><td>${f(headerData.NetWeight)}</td>
            <td></td><td></td>
          </tr>
        </table>

        <hr/>

        ${
          isSD
            ? `
              <h4>Sales Details</h4>
              <table border="1" style="width:100%; border-collapse:collapse;">
                <tr>
                  <th>Sales Doc</th>
                  <th>Customer</th>
                  <th>Customer Name</th>
                  <th>Material</th>
                  <th>Description</th>
                </tr>
                <tr>
                  <td>${f(headerData.SalesDocument)}</td>
                  <td>${f(headerData.Customer)}</td>
                  <td>${f(headerData.CustomerName)}</td>
                  <td>${f(headerData.Material)}</td>
                  <td>${f(headerData.MaterialDescription)}</td>
                </tr>
              </table>
            `
            : isPO
            ? `
              <h4>Purchase Order Details</h4>
              <table border="1" style="width:100%; border-collapse:collapse;">
                <tr>
                  <th>PO Number</th>
                  <th>Item</th>
                  <th>Vendor</th>
                  <th>Vendor Name</th>
                  <th>Material</th>
                  <th>Plant</th>
                </tr>
                <tr>
                  <td>${f(headerData.PurchaseOrderNumber)}</td>
                  <td>${f(headerData.PurchaseOrderItem)}</td>
                  <td>${f(headerData.Vendor)}</td>
                  <td>${f(headerData.VendorName)}</td>
                  <td>${f(headerData.Material)}</td>
                  <td>${f(headerData.Plant)}</td>
                </tr>
              </table>

              <br/>

              <table style="width:100%;">
                <tr>
                  <td><b>Permit No</b></td><td>${f(headerData.PermitNumber)}</td>
                  <td><b>LR No</b></td><td>${f(headerData.LRGCNumber)}</td>
                </tr>
              </table>
            `
            : `<p>No format available</p>`
        }

        <br/><br/>

        <div style="display:flex; justify-content:space-between;">
          <div>Security Officer</div>
          <div>Weigh Bridge Operator</div>
          <div>Authorized Sign</div>
        </div>

      </div>
    `;

    return element;
  };

  // ================= PRINT =================
  const handlePrint = async () => {
    const el = await buildSlipElement();

    html2pdf()
      .set({
        margin: 5,
        filename: `Weighment_${headerData.GateEntryNumber}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      })
      .from(el)
      .save();
  };

  // ================= UI =================
  return (
    <div className="reprint-page">
      <div className="reprint-header">
        <h2>Reprint Weighment Slip</h2>
        <a href="/" className="reprint-back-btn">&larr; Back</a>
      </div>

      <div className="reprint-card">
        <form onSubmit={e => { e.preventDefault(); handleFetch(); }}>
          <div className="reprint-form-fields">
            <label htmlFor="gateEntryNumber" className="reprint-form-label">Gate Entry Number</label>
            <div className="reprint-form-row">
              <input
                id="gateEntryNumber"
                value={gateEntryNumber}
                onChange={e => setGateEntryNumber(e.target.value)}
                placeholder="Enter Gate Entry Number"
                className="reprint-input"
                autoFocus
              />
              <button
                className="reprint-primary-btn"
                type="submit"
                disabled={loading || !gateEntryNumber.trim()}
              >
                {loading ? 'Loading...' : 'Fetch'}
              </button>
            </div>
            {error && <div className="reprint-error">{error}</div>}
          </div>
        </form>
      </div>

      {headerData && (
        <div className="reprint-card result">
          <div className="reprint-result-head">
            <h3 className="reprint-result-title">Result</h3>
            <div className="reprint-cta-group">
              <button className="reprint-secondary-btn" onClick={handlePrint}>Download / Print Slip</button>
            </div>
          </div>
          <div className="reprint-grid">
            <div className="reprint-grid-item"><span className="reprint-grid-label">Gate Entry</span><span className="reprint-grid-value">{headerData.GateEntryNumber || '-'}</span></div>
            <div className="reprint-grid-item"><span className="reprint-grid-label">Vehicle</span><span className="reprint-grid-value">{headerData.VehicleNumber || '-'}</span></div>
            <div className="reprint-grid-item"><span className="reprint-grid-label">Date</span><span className="reprint-grid-value">{headerData.GateEntryDate ? formatDate(headerData.GateEntryDate) : '-'}</span></div>
            <div className="reprint-grid-item"><span className="reprint-grid-label">Transporter</span><span className="reprint-grid-value">{headerData.TransporterName || '-'}</span></div>
            <div className="reprint-grid-item"><span className="reprint-grid-label">Driver</span><span className="reprint-grid-value">{headerData.DriverName || '-'}</span></div>
            <div className="reprint-grid-item"><span className="reprint-grid-label">Gross Weight</span><span className="reprint-grid-value">{headerData.GrossWeight || '-'}</span></div>
            <div className="reprint-grid-item"><span className="reprint-grid-label">Tare Weight</span><span className="reprint-grid-value">{headerData.TareWeight || '-'}</span></div>
            <div className="reprint-grid-item"><span className="reprint-grid-label">Net Weight</span><span className="reprint-grid-value">{headerData.NetWeight || '-'}</span></div>
            <div className="reprint-grid-item"><span className="reprint-grid-label">Permit No</span><span className="reprint-grid-value">{headerData.PermitNumber || '-'}</span></div>
            <div className="reprint-grid-item"><span className="reprint-grid-label">LR/GC No</span><span className="reprint-grid-value">{headerData.LRGCNumber || '-'}</span></div>
          </div>

          {/* Table for PO or Sales details */}
          <div className="reprint-table-wrap">
            {headerData.PurchaseOrderNumber ? (
              <>
                <h4 className="reprint-table-title">Purchase Order Details</h4>
                <table className="reprint-table">
                  <thead>
                    <tr>
                      <th>PO Number</th>
                      <th>Item</th>
                      <th>Vendor</th>
                      <th>Vendor Name</th>
                      <th>Material</th>
                      <th>Plant</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{headerData.PurchaseOrderNumber || '-'}</td>
                      <td>{headerData.PurchaseOrderItem || '-'}</td>
                      <td>{headerData.Vendor || '-'}</td>
                      <td>{headerData.VendorName || '-'}</td>
                      <td>{headerData.Material || '-'}</td>
                      <td>{headerData.Plant || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </>
            ) : headerData.SalesDocument ? (
              <>
                <h4 className="reprint-table-title">Sales Details</h4>
                <table className="reprint-table">
                  <thead>
                    <tr>
                      <th>Sales Doc</th>
                      <th>Customer</th>
                      <th>Customer Name</th>
                      <th>Material</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{headerData.SalesDocument || '-'}</td>
                      <td>{headerData.Customer || '-'}</td>
                      <td>{headerData.CustomerName || '-'}</td>
                      <td>{headerData.Material || '-'}</td>
                      <td>{headerData.MaterialDescription || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}