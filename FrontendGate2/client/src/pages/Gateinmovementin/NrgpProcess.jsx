// import React, { useState, useEffect, useRef } from "react";
// import { useNavigate } from "react-router-dom";
// import axios from "axios";
// import html2pdf from "html2pdf.js";
// import { fetchNextNrgpGateEntryNumber, createNrgpGateEntry, API_BASE }  from "../../api";
// import "./RgpProcess.css";
// import "./CreateHeader.css";

// export default function NrgpProcess() {
//   const navigate = useNavigate();
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");
//   const [showSuccessModal, setShowSuccessModal] = useState(false);
//   const [createdGateEntryNum, setCreatedGateEntryNum] = useState("");
//   const [copied, setCopied] = useState(false);
//   const [savedResponseData, setSavedResponseData] = useState(null);
//   const [printStatus, setPrintStatus] = useState("");
//   const printTriggeredRef = useRef(false);
  
//   // Header fields matching SAP structure
//   const [formData, setFormData] = useState({
//     plant: "",
//     vendor: "",
//     vendorName: "",
//     modeOfTransport: "Select",
//     vehicleNumber: "",
//     transporterCode: "",
//     transporterName: "",
//     driverName: "",
//     driverPhoneNumber: "",
//     dlNumber: "",
//     remarks: ""
//   });

//   // Table rows - NRGP uses Returnable Qty
//   const [tableRows, setTableRows] = useState([
//     {
//       id: 1,
//       type: "M", // M or T
//       materialCode: "",
//       materialDescription: "",
//       returnableQty: "",
//       uom: "",
//       approximateValue: "",
//       remarks: ""
//     }
//   ]);

//   const handleInputChange = (e) => {
//     const { name, value } = e.target;
//     setFormData(prev => ({
//       ...prev,
//       [name]: value
//     }));
//   };

//   const handleRowChange = (id, field, value) => {
//     setTableRows(prev => 
//       prev.map(row => 
//         row.id === id ? { ...row, [field]: value } : row
//       )
//     );
//   };

//   const addRow = () => {
//     const newId = Math.max(...tableRows.map(r => r.id)) + 1;
//     setTableRows([...tableRows, {
//       id: newId,
//       type: "M",
//       materialCode: "",
//       materialDescription: "",
//       returnableQty: "",
//       uom: "",
//       approximateValue: "",
//       remarks: ""
//     }]);
//   };

//   const deleteRow = (id) => {
//     if (tableRows.length > 1) {
//       setTableRows(tableRows.filter(row => row.id !== id));
//     }
//   };

//   const handleCopyGateEntry = () => {
//     navigator.clipboard.writeText(createdGateEntryNum).then(() => {
//       setCopied(true);
//       setTimeout(() => setCopied(false), 2000);
//     }).catch(err => {
//       console.error("Failed to copy:", err);
//     });
//   };

//   const handlePrint = async () => {
//     if (!savedResponseData) return;

//     const getField = (uiKey, responseKey) => {
//       const responseValue = responseKey ? savedResponseData?.[responseKey] : undefined;
//       const uiValue = formData?.[uiKey];
//       return responseValue || uiValue || "-";
//     };

//     let modeValue = getField("modeOfTransport", "ModeOfTransport");
//     if (typeof modeValue !== "string" || modeValue.toLowerCase() === "select" || !modeValue.trim()) {
//       modeValue = "Hand";
//     }

//     const items = Array.isArray(savedResponseData?.tableRows) ? savedResponseData.tableRows : tableRows;
//     const materialRows = items
//       .filter((row) => row.materialCode || row.materialDescription)
//       .map((row, idx) => `
//         <tr>
//           <td style="border:1px solid #000; padding:4px; text-align:center;">${idx + 1}</td>
//           <td style="border:1px solid #000; padding:4px; text-align:center;">${row.type || "-"}</td>
//           <td style="border:1px solid #000; padding:4px; text-align:left;">${row.materialCode || "-"}</td>
//           <td style="border:1px solid #000; padding:4px; text-align:left;">${row.materialDescription || "-"}</td>
//           <td style="border:1px solid #000; padding:4px; text-align:right;">${row.returnableQty || "-"}</td>
//           <td style="border:1px solid #000; padding:4px; text-align:center;">${row.uom || "-"}</td>
//           <td style="border:1px solid #000; padding:4px; text-align:right;">${row.approximateValue || "-"}</td>
//           <td style="border:1px solid #000; padding:4px; text-align:left;">${row.remarks || "-"}</td>
//         </tr>
//       `)
//       .join("");

//     const headerRows = [
//       ["Gate Entry No:", createdGateEntryNum || "-", "Date:", new Date().toLocaleDateString("en-GB")],
//       ["Plant:", getField("plant", "Plant"), "Vendor:", getField("vendor", "Vendor")],
//       ["Vendor Name:", getField("vendorName", "VendorName"), "Mode:", modeValue],
//       ["Vehicle No:", getField("vehicleNumber", "VehicleNumber"), "Transporter:", getField("transporterName", "TransporterName")],
//       ["Driver Name:", getField("driverName", "DriverName"), "Driver Phone:", getField("driverPhoneNumber", "DriverPhoneNumber")],
//       ["DL Number:", getField("dlNumber", "DLNumber"), "Remarks:", getField("remarks", "Remarks")],
//     ];

//     let logoDataUrl = "";
//     try {
//       const logoRes = await fetch("/Minera_Logo.jpg");
//       const logoBlob = await logoRes.blob();
//       logoDataUrl = await new Promise((res) => {
//         const r = new FileReader();
//         r.onloadend = () => res(r.result);
//         r.readAsDataURL(logoBlob);
//       });
//     } catch (_) {}

//     const element = document.createElement("div");
//     element.innerHTML = `
//       <div style="font-family: Arial, sans-serif; color: #000; background: #fff; width: 100%; max-width: 700px; margin: 0 auto; font-size: 10px;">
//         <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 4px;">
//           <div>
//             <div style='font-size: 13px; font-weight: bold;'>Minera Steel &amp; Power Pvt Ltd</div>
//             <div style='font-size: 9px;'>Yerabanahalli Village, Sandur Taluk, Ballari Dist, Karnataka - 583115</div>
//           </div>
//           ${logoDataUrl ? `<img src='${logoDataUrl}' alt='Logo' style='height: 28px; width: auto; margin-left: 8px;'/>` : ""}
//         </div>
//         <div style="text-align:center; font-size:12px; font-weight:bold; margin-bottom: 4px;">NRGP Gate Entry Slip</div>
//         <table style="width:100%; border-collapse:collapse; margin-bottom: 2px; font-size:9px;">
//           ${headerRows
//             .map(
//               (row) => `
//             <tr style="height:18px;">
//               <td style="width:110px; text-align:right; font-weight:bold; padding:2px 2px 2px 0;">${row[0]}</td>
//               <td style="width:90px; text-align:left; padding:2px 8px 2px 8px;">${row[1]}</td>
//               <td style="width:110px; text-align:right; font-weight:bold; padding:2px 2px 2px 0;">${row[2]}</td>
//               <td style="width:90px; text-align:left; padding:2px 8px 2px 8px;">${row[3]}</td>
//             </tr>
//           `
//             )
//             .join("")}
//         </table>
//         <div style="margin-bottom: 2px; font-size:10px;"><b>Material Details</b></div>
//         <table style="width:100%; border:1px solid #000; border-collapse:collapse; font-size:8.5px;">
//           <thead>
//             <tr>
//               <th style="border:1px solid #000; padding:4px; text-align:center;">#</th>
//               <th style="border:1px solid #000; padding:4px; text-align:center;">Type</th>
//               <th style="border:1px solid #000; padding:4px; text-align:left;">Material Code</th>
//               <th style="border:1px solid #000; padding:4px; text-align:left;">Description</th>
//               <th style="border:1px solid #000; padding:4px; text-align:right;">Returnable Qty</th>
//               <th style="border:1px solid #000; padding:4px; text-align:center;">UOM</th>
//               <th style="border:1px solid #000; padding:4px; text-align:right;">Value</th>
//               <th style="border:1px solid #000; padding:4px; text-align:left;">Remarks</th>
//             </tr>
//           </thead>
//           <tbody>
//             ${materialRows}
//           </tbody>
//         </table>
//         <div style="margin-top: 10px; display: flex; justify-content: space-between; font-size: 9px;">
//           <div style="text-align:center; width:32%;">Security Officer<br/>__________</div>
//           <div style="text-align:center; width:32%;">Dept. In-charge<br/>__________</div>
//           <div style="text-align:center; width:32%;">Authorized Sign<br/>__________</div>
//         </div>
//         <div style="margin-top: 4px; text-align:center; font-size:8px;">Generated by Minera Gate Entry System</div>
//       </div>
//     `;

//     const fileName = `NRGP_GateEntry_${createdGateEntryNum || "Slip"}.pdf`;
//     const worker = html2pdf()
//       .from(element)
//       .set({
//         margin: [8, 8, 8, 8],
//         filename: fileName,
//         html2canvas: { scale: 1.5, useCORS: true },
//         jsPDF: { unit: "mm", format: [210, 148], orientation: "portrait", compress: true },
//         pagebreak: { mode: "avoid-all" }
//       });

//     setPrintStatus("Printing slip...");
//     try {
//       const pdfBlob = await worker.outputPdf("blob");
//       const base64 = await new Promise((resolve, reject) => {
//         const reader = new FileReader();
//         reader.onloadend = () => {
//           const full = String(reader.result || "");
//           resolve(full.includes(",") ? full.split(",")[1] : full);
//         };
//         reader.onerror = reject;
//         reader.readAsDataURL(pdfBlob);
//       });
//       await axios.post(`${API_BASE}/printer/print`, { pdfBase64: base64, fileName });
//       setPrintStatus("Print successful");
//     } catch (err) {
//       console.error("Print failed:", err);
//       setPrintStatus("Print failed. Please check printer.");
//     }
//   };


//   // Remove auto-print. Only print when user clicks Print button.

//   // Parse SAP error into user-friendly message
//   const parseError = (error) => {
//     if (!error) return "An unexpected error occurred. Please try again.";

//     // Extract error message from various formats
//       {/* Success Modal */}
//       {showSuccessModal && (
//         <div className="modal-overlay">
//           <div className="success-modal">
//             <div className="success-icon">✓</div>
//             <h3>NRGP Gate Entry Created Successfully!</h3>
//             <div className="gate-entry-info">
//               <label>Gate Entry Number:</label>
//               <div className="gate-number-wrapper">
//                 <div className="gate-number">{createdGateEntryNum}</div>
//                 <button 
//                   className="copy-icon-btn"
//                   onClick={handleCopyGateEntry}
//                   title="Copy to clipboard"
//                   type="button"
//                 >
//                   {copied ? (
//                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                       <polyline points="20 6 9 17 4 12"></polyline>
//                     </svg>
//                   ) : (
//                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                       <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
//                       <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
//                     </svg>
//                   )}
//                 </button>
//               </div>
//             </div>
//             <p className="stores-message">Stores and Consumable</p>
//             <button 
//               className="submit-btn"
//               style={{ marginTop: "10px", marginBottom: "6px" }}
//               onClick={handlePrint}
//               type="button"
//               disabled={!savedResponseData}
//             >
//               Print Gate Entry Slip
//             </button>
//             {printStatus && (
//               <div
//                 style={{
//                   marginTop: "10px",
//                   textAlign: "center",
//                   fontWeight: "600",
//                   color: printStatus.toLowerCase().includes("failed") ? "#dc2626" : "#166534"
//                 }}
//               >
//                 {printStatus}
//               </div>
//             )}
//             <button 
//               className="ok-btn"
//               onClick={() => {
//                 setShowSuccessModal(false);
//                 navigate("/home");
//               }}
//             >
//               OK
//             </button>
//           </div>
//         </div>
//       )}

//     return errorMessage || "Failed to create gate entry. Please verify all information and try again.";
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError("");
//     setPrintStatus("");
    
//     // Comprehensive Validation
//     if (!formData.plant) {
//       setError("Please enter Plant code");
//       return;
//     }

//     if (!formData.vendor) {
//       setError("Please enter Vendor code");
//       return;
//     }

//     if (!formData.modeOfTransport || formData.modeOfTransport === "Select") {
//       setError("Please select Mode of Transport");
//       return;
//     }

//     if (formData.modeOfTransport === "Truck") {
//       if (!formData.vehicleNumber) {
//         setError("Vehicle Number is required for Truck mode");
//         return;
//       }
//       if (!formData.driverName) {
//         setError("Driver Name is required for Truck mode");
//         return;
//       }
//       if (!formData.driverPhoneNumber) {
//         setError("Driver Phone Number is required for Truck mode");
//         return;
//       }
//     }

//     // Validate at least one material row has data
//     const hasValidMaterial = tableRows.some(row => 
//       row.materialCode || row.materialDescription
//     );
//     if (!hasValidMaterial) {
//       setError("Please add at least one material with code or description");
//       return;
//     }

//     setLoading(true);

//     try {
//       // Prepare payload for API
//       const today = new Date().toISOString().split('T')[0];
//       const now = new Date();
//       const hh = String(now.getHours()).padStart(2, '0');
//       const mm = String(now.getMinutes()).padStart(2, '0');
//       const inwardTime = `${hh}:${mm}`;
      

//       // Map user-friendly values to SAP-expected values
//       const sapModeOfTransport = formData.modeOfTransport === "Hand" 
//         ? "By Hand" 
//         : formData.modeOfTransport === "Truck" 
//           ? "By Road" 
//           : formData.modeOfTransport;

//       const payload = {
//         GateEntryDate: today,
//         InwardTime: inwardTime,
//         FiscalYear: new Date().getFullYear().toString(),
//         Plant: formData.plant,
//         Vendor: formData.vendor,
//         VendorName: formData.vendorName,
//         VehicleNumber: formData.vehicleNumber || "",
//         TransporterCode: formData.transporterCode || "",
//         TransporterName: formData.transporterName || "",
//         DriverName: formData.driverName || "",
//         DriverPhoneNumber: formData.driverPhoneNumber || "",
//         DLNumber: formData.dlNumber || "",
//         ModeOfTransport: sapModeOfTransport,
//         Remarks: formData.remarks,
//         tableRows: tableRows.map(row => ({
//           type: row.type,
//           materialCode: row.materialCode,
//           materialDescription: row.materialDescription,
//           returnableQty: row.returnableQty,
//           uom: row.uom,
//           approximateValue: row.approximateValue,
//           remarks: row.remarks
//         }))
//       };

//       console.log("Submitting NRGP Gate Entry:", JSON.stringify(payload, null, 2));

//       const { data } = await createNrgpGateEntry(payload);
      
//       // Extract gate entry number from response
//       const gateEntryNum = data?.d?.GateEntryNumber || data?.GateEntryNumber || "Created";
//       const responseData = data?.d || data;
      
//       // Show custom success modal
//       setCreatedGateEntryNum(gateEntryNum);
//       setSavedResponseData(responseData);
//       setShowSuccessModal(true);
//       setLoading(false);

//     } catch (err) {
//       console.error("Failed to create NRGP gate entry:", err);
//       const friendlyError = parseError(err);
//       setError(friendlyError);
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="rgp-container">
//       <div className="rgp-header">
//         <h2>NRGP Process - Gate Entry</h2>
//       </div>

//       {error && (
//         <div className="error-message">
//           {error}
//         </div>
//       )}

//       {/* Success Modal */}
//       {showSuccessModal && (
//         <div className="modal-overlay">
//           <div className="success-modal">
//             <div className="success-icon">✓</div>
//             <h3>NRGP Gate Entry Created Successfully!</h3>
//             <div className="gate-entry-info">
//               <label>Gate Entry Number:</label>
//               <div className="gate-number-wrapper">
//                 <div className="gate-number">{createdGateEntryNum}</div>
//                 <button 
//                   className="copy-icon-btn"
//                   onClick={handleCopyGateEntry}
//                   title="Copy to clipboard"
//                   type="button"
//                 >
//                   {copied ? (
//                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                       <polyline points="20 6 9 17 4 12"></polyline>
//                     </svg>
//                   ) : (
//                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                       <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
//                       <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
//                     </svg>
//                   )}
//                 </button>
//               </div>
//             </div>
//             <p className="stores-message">Stores and Consumable</p>
//             <button 
//               className="submit-btn"
//               style={{ marginTop: "10px", marginBottom: "6px" }}
//               onClick={handlePrint}
//               type="button"
//               disabled={!savedResponseData}
//             >
//               Print Slip
//             </button>
//             {printStatus && (
//               <div
//                 style={{
//                   marginTop: "10px",
//                   textAlign: "center",
//                   fontWeight: "600",
//                   color: printStatus.toLowerCase().includes("failed") ? "#dc2626" : "#166534"
//                 }}
//               >
//                 {printStatus}
//               </div>
//             )}
//             <button 
//               className="ok-btn"
//               onClick={() => {
//                 setShowSuccessModal(false);
//                 navigate("/home");
//               }}
//             >
//               OK
//             </button>
//           </div>
//         </div>
//       )}

//       <form onSubmit={handleSubmit} className="rgp-form" onKeyDown={(e) => {
//         if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.type !== 'submit') {
//           e.preventDefault();
//         }
//       }}>
//         {/* Header Fields */}
//         <div className="header-section">
//           <h3>Header Information</h3>

//           <div className="form-grid">
//             <div className="form-group">
//               <label>Plant <span className="required"></span></label>
//               <input
//                 type="text"
//                 name="plant"
//                 value={formData.plant}
//                 onChange={handleInputChange}
//               />
//             </div>

//             <div className="form-group">
//               <label>Vendor <span className="required"></span></label>
//               <input
//                 type="text"
//                 name="vendor"
//                 value={formData.vendor}
//                 onChange={handleInputChange}
//               />
//             </div>

//             <div className="form-group">
//               <label>Vendor Name</label>
//               <input
//                 type="text"
//                 name="vendorName"
//                 value={formData.vendorName}
//                 onChange={handleInputChange}
//               />
//             </div>

//             <div className="form-group">
//               <label>Mode of Transport <span className="required"></span></label>
//               <div style={{ position: 'relative' }}>
//                 <select
//                   name="modeOfTransport"
//                   value={formData.modeOfTransport}
//                   onChange={handleInputChange}
//                   style={{
//                     width: '100%',
//                     padding: '10px 40px 10px 12px',
//                     fontSize: '14px',
//                     border: '1px solid #d1d5db',
//                     borderRadius: '6px',
//                     backgroundColor: 'white',
//                     cursor: 'pointer',
//                     appearance: 'none',
//                     WebkitAppearance: 'none',
//                     MozAppearance: 'none'
//                   }}
//                 >
//                   <option value="Select">Select</option>
//                   <option value="Hand">Hand</option>
//                   <option value="Truck">Truck</option>
//                 </select>
//                 <svg
//                   style={{
//                     position: 'absolute',
//                     right: '12px',
//                     top: '50%',
//                     transform: 'translateY(-50%)',
//                     pointerEvents: 'none',
//                     width: '20px',
//                     height: '20px'
//                   }}
//                   fill="none"
//                   stroke="currentColor"
//                   strokeWidth="2"
//                   viewBox="0 0 24 24"
//                 >
//                   <polyline points="6 9 12 15 18 9"></polyline>
//                 </svg>
//               </div>
//             </div>

//             {formData.modeOfTransport === "Truck" && (
//               <>
//                 <div className="form-group">
//                   <label>Vehicle Number</label>
//                   <input
//                     type="text"
//                     name="vehicleNumber"
//                     value={formData.vehicleNumber}
//                     onChange={handleInputChange}
//                   />
//                 </div>

//                 <div className="form-group">
//                   <label>Transporter Code</label>
//                   <input
//                     type="text"
//                     name="transporterCode"
//                     value={formData.transporterCode}
//                     onChange={handleInputChange}
//                   />
//                 </div>

//                 <div className="form-group">
//                   <label>Transporter Name</label>
//                   <input
//                     type="text"
//                     name="transporterName"
//                     value={formData.transporterName}
//                     onChange={handleInputChange}
//                   />
//                 </div>

//                 <div className="form-group">
//                   <label>Driver Name</label>
//                   <input
//                     type="text"
//                     name="driverName"
//                     value={formData.driverName}
//                     onChange={handleInputChange}
//                   />
//                 </div>

//                 <div className="form-group">
//                   <label>Driver Phone Number</label>
//                   <input
//                     type="tel"
//                     name="driverPhoneNumber"
//                     value={formData.driverPhoneNumber}
//                     onChange={handleInputChange}
//                   />
//                 </div>

//                 <div className="form-group">
//                   <label>DL Number</label>
//                   <input
//                     type="text"
//                     name="dlNumber"
//                     value={formData.dlNumber}
//                     onChange={handleInputChange}
//                   />
//                 </div>
//               </>
//             )}

//             <div className="form-group full-width">
//               <label>Remarks / Purpose</label>
//               <input
//                 type="text"
//                 name="remarks"
//                 value={formData.remarks}
//                 onChange={handleInputChange}
//                 placeholder="Enter remarks or purpose"
//               />
//             </div>
//           </div>
//         </div>

//         {/* Material Table */}
//         <div className="table-section">
//           <h3>Material Details</h3>
//           <div className="table-wrapper">
//             <table className="rgp-table">
//               <thead>
//                 <tr>
//                   <th>M</th>
//                   <th>T</th>
//                   <th>Material Code</th>
//                   <th>Material Description</th>
//                   <th>Returnable Qty</th>
//                   <th>UOM</th>
//                   <th>Approximate Value</th>
//                   <th>Remarks</th>
//                   <th>Action</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {tableRows.map((row) => (
//                   <tr key={row.id}>
//                     <td>
//                       <input
//                         type="radio"
//                         name={`type-${row.id}`}
//                         checked={row.type === "M"}
//                         onChange={() => handleRowChange(row.id, "type", "M")}
//                       />
//                     </td>
//                     <td>
//                       <input
//                         type="radio"
//                         name={`type-${row.id}`}
//                         checked={row.type === "T"}
//                         onChange={() => handleRowChange(row.id, "type", "T")}
//                       />
//                     </td>
//                     <td>
//                       <input
//                         type="text"
//                         value={row.materialCode}
//                         onChange={(e) => handleRowChange(row.id, "materialCode", e.target.value)}
//                         placeholder="Material Code"
//                       />
//                     </td>
//                     <td>
//                       <input
//                         type="text"
//                         value={row.materialDescription}
//                         onChange={(e) => handleRowChange(row.id, "materialDescription", e.target.value)}
//                         placeholder="Description"
//                       />
//                     </td>
//                     <td>
//                       <input
//                         type="number"
//                         value={row.returnableQty}
//                         onChange={(e) => handleRowChange(row.id, "returnableQty", e.target.value)}
//                         placeholder="Returnable Qty"
//                         step="0.01"
//                       />
//                     </td>
//                     <td>
//                       <input
//                         type="text"
//                         value={row.uom}
//                         onChange={(e) => handleRowChange(row.id, "uom", e.target.value)}
//                         placeholder="UOM"
//                       />
//                     </td>
//                     <td>
//                       <input
//                         type="number"
//                         value={row.approximateValue}
//                         onChange={(e) => handleRowChange(row.id, "approximateValue", e.target.value)}
//                         placeholder="Value"
//                         step="0.01"
//                       />
//                     </td>
//                     <td>
//                       <input
//                         type="text"
//                         value={row.remarks}
//                         onChange={(e) => handleRowChange(row.id, "remarks", e.target.value)}
//                         placeholder="Remarks"
//                       />
//                     </td>
//                     <td>
//                       <button
//                         type="button"
//                         onClick={() => deleteRow(row.id)}
//                         className="delete-btn"
//                         disabled={tableRows.length === 1}
//                       >
//                         🗑️
//                       </button>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//           <button type="button" onClick={addRow} className="add-row-btn">
//             + Add Row
//           </button>
//         </div>

//         {/* Action Buttons */}
//         <div className="action-buttons">
//           <button type="submit" className="submit-btn" disabled={loading}>
//             {loading ? "Creating..." : "Generate Gate Entry"}
//           </button>
//           <button 
//             type="button" 
//             onClick={() => navigate("/home/rgp")} 
//             className="cancel-btn"
//             disabled={loading}
//           >
//             Cancel
//           </button>
//         </div>
//       </form>
//     </div>
//   );
// }








import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import html2pdf from "html2pdf.js";
import { fetchNextNrgpGateEntryNumber, createNrgpGateEntry, API_BASE }  from "../../api";
import "./RgpProcess.css";
import "./CreateHeader.css";
 
export default function NrgpProcess() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdGateEntryNum, setCreatedGateEntryNum] = useState("");
  const [copied, setCopied] = useState(false);
  const [savedResponseData, setSavedResponseData] = useState(null);
  const [printStatus, setPrintStatus] = useState("");
  const printTriggeredRef = useRef(false);
 
  // Header fields matching SAP structure
  const [formData, setFormData] = useState({
    plant: "",
    vendor: "",
    vendorName: "",
    modeOfTransport: "Select",
    vehicleNumber: "",
    transporterCode: "",
    transporterName: "",
    driverName: "",
    driverPhoneNumber: "",
    dlNumber: "",
    remarks: ""
  });
 
  // Table rows - NRGP uses Returnable Qty
  const [tableRows, setTableRows] = useState([
    {
      id: 1,
      type: "M", // M or T
      materialCode: "",
      materialDescription: "",
      returnableQty: "",
      uom: "",
      approximateValue: "",
      remarks: ""
    }
  ]);
 
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
 
  const handleRowChange = (id, field, value) => {
    setTableRows(prev =>
      prev.map(row =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };
 
  const addRow = () => {
    const newId = Math.max(...tableRows.map(r => r.id)) + 1;
    setTableRows([...tableRows, {
      id: newId,
      type: "M",
      materialCode: "",
      materialDescription: "",
      returnableQty: "",
      uom: "",
      approximateValue: "",
      remarks: ""
    }]);
  };
 
  const deleteRow = (id) => {
    if (tableRows.length > 1) {
      setTableRows(tableRows.filter(row => row.id !== id));
    }
  };
 
  const handleCopyGateEntry = () => {
    navigator.clipboard.writeText(createdGateEntryNum).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error("Failed to copy:", err);
    });
  };
 
  const handlePrint = async () => {
    if (!savedResponseData) return;
 
    const getField = (uiKey, responseKey) => {
      const responseValue = responseKey ? savedResponseData?.[responseKey] : undefined;
      const uiValue = formData?.[uiKey];
      return responseValue || uiValue || "-";
    };
 
    let modeValue = getField("modeOfTransport", "ModeOfTransport");
    if (typeof modeValue !== "string" || modeValue.toLowerCase() === "select" || !modeValue.trim()) {
      modeValue = "Hand";
    }
 
    const items = Array.isArray(savedResponseData?.tableRows) ? savedResponseData.tableRows : tableRows;
    const materialRows = items
      .filter((row) => row.materialCode || row.materialDescription)
      .map((row, idx) => `
        <tr>
          <td style="border:1px solid #000; padding:4px; text-align:center;">${idx + 1}</td>
          <td style="border:1px solid #000; padding:4px; text-align:center;">${row.type || "-"}</td>
          <td style="border:1px solid #000; padding:4px; text-align:left;">${row.materialCode || "-"}</td>
          <td style="border:1px solid #000; padding:4px; text-align:left;">${row.materialDescription || "-"}</td>
          <td style="border:1px solid #000; padding:4px; text-align:right;">${row.returnableQty || "-"}</td>
          <td style="border:1px solid #000; padding:4px; text-align:center;">${row.uom || "-"}</td>
          <td style="border:1px solid #000; padding:4px; text-align:right;">${row.approximateValue || "-"}</td>
          <td style="border:1px solid #000; padding:4px; text-align:left;">${row.remarks || "-"}</td>
        </tr>
      `)
      .join("");
 
    const headerRows = [
      ["Gate Entry No:", createdGateEntryNum || "-", "Date:", new Date().toLocaleDateString("en-GB")],
      ["Plant:", getField("plant", "Plant"), "Vendor:", getField("vendor", "Vendor")],
      ["Vendor Name:", getField("vendorName", "VendorName"), "Mode:", modeValue],
      ["Vehicle No:", getField("vehicleNumber", "VehicleNumber"), "Transporter:", getField("transporterName", "TransporterName")],
      ["Driver Name:", getField("driverName", "DriverName"), "Driver Phone:", getField("driverPhoneNumber", "DriverPhoneNumber")],
      ["DL Number:", getField("dlNumber", "DLNumber"), "Remarks:", getField("remarks", "Remarks")],
    ];
 
    let logoDataUrl = "";
    try {
      const logoRes = await fetch("/Minera_Logo.jpg");
      const logoBlob = await logoRes.blob();
      logoDataUrl = await new Promise((res) => {
        const r = new FileReader();
        r.onloadend = () => res(r.result);
        r.readAsDataURL(logoBlob);
      });
    } catch (_) {}
 
    const element = document.createElement("div");
    element.innerHTML = `
      <div style="font-family: Arial, sans-serif; color: #000; background: #fff; width: 100%; max-width: 700px; margin: 0 auto; font-size: 10px;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 4px;">
          <div>
            <div style='font-size: 13px; font-weight: bold;'>Minera Steel &amp; Power Pvt Ltd</div>
            <div style='font-size: 9px;'>Yerabanahalli Village, Sandur Taluk, Ballari Dist, Karnataka - 583115</div>
          </div>
          ${logoDataUrl ? `<img src='${logoDataUrl}' alt='Logo' style='height: 28px; width: auto; margin-left: 8px;'/>` : ""}
        </div>
        <div style="text-align:center; font-size:12px; font-weight:bold; margin-bottom: 4px;">NRGP Gate Entry Slip</div>
        <table style="width:100%; border-collapse:collapse; margin-bottom: 2px; font-size:9px;">
          ${headerRows
            .map(
              (row) => `
            <tr style="height:18px;">
              <td style="width:110px; text-align:right; font-weight:bold; padding:2px 2px 2px 0;">${row[0]}</td>
              <td style="width:90px; text-align:left; padding:2px 8px 2px 8px;">${row[1]}</td>
              <td style="width:110px; text-align:right; font-weight:bold; padding:2px 2px 2px 0;">${row[2]}</td>
              <td style="width:90px; text-align:left; padding:2px 8px 2px 8px;">${row[3]}</td>
            </tr>
          `
            )
            .join("")}
        </table>
        <div style="margin-bottom: 2px; font-size:10px;"><b>Material Details</b></div>
        <table style="width:100%; border:1px solid #000; border-collapse:collapse; font-size:8.5px;">
          <thead>
            <tr>
              <th style="border:1px solid #000; padding:4px; text-align:center;">#</th>
              <th style="border:1px solid #000; padding:4px; text-align:center;">Type</th>
              <th style="border:1px solid #000; padding:4px; text-align:left;">Material Code</th>
              <th style="border:1px solid #000; padding:4px; text-align:left;">Description</th>
              <th style="border:1px solid #000; padding:4px; text-align:right;">Returnable Qty</th>
              <th style="border:1px solid #000; padding:4px; text-align:center;">UOM</th>
              <th style="border:1px solid #000; padding:4px; text-align:right;">Value</th>
              <th style="border:1px solid #000; padding:4px; text-align:left;">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${materialRows}
          </tbody>
        </table>
        <div style="margin-top: 10px; display: flex; justify-content: space-between; font-size: 9px;">
          <div style="text-align:center; width:32%;">Security Officer<br/>__________</div>
          <div style="text-align:center; width:32%;">Dept. In-charge<br/>__________</div>
          <div style="text-align:center; width:32%;">Authorized Sign<br/>__________</div>
        </div>
        <div style="margin-top: 4px; text-align:center; font-size:8px;">Generated by Minera Gate Entry System</div>
      </div>
    `;
 
    const fileName = `NRGP_GateEntry_${createdGateEntryNum || "Slip"}.pdf`;
    const worker = html2pdf()
      .from(element)
      .set({
        margin: [8, 8, 8, 8],
        filename: fileName,
        html2canvas: { scale: 1.5, useCORS: true },
        jsPDF: { unit: "mm", format: [210, 148], orientation: "portrait", compress: true },
        pagebreak: { mode: "avoid-all" }
      });
 
    setPrintStatus("Printing slip...");
    try {
      const pdfBlob = await worker.outputPdf("blob");
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const full = String(reader.result || "");
          resolve(full.includes(",") ? full.split(",")[1] : full);
        };
        reader.onerror = reject;
        reader.readAsDataURL(pdfBlob);
      });
      await axios.post(`${API_BASE}/printer/print`, { pdfBase64: base64, fileName });
      setPrintStatus("Print successful");
    } catch (err) {
      console.error("Print failed:", err);
      setPrintStatus("Print failed. Please check printer.");
    }
  };
 
 
  // Remove auto-print. Only print when user clicks Print button.
 
  // Parse SAP error into user-friendly message
  const parseError = (error) => {
    if (!error) return "An unexpected error occurred. Please try again.";
 
    // Extract error message from various formats
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="modal-overlay">
          <div className="success-modal">
            <div className="success-icon">✓</div>
            <h3>NRGP Gate Entry Created Successfully!</h3>
            <div className="gate-entry-info">
              <label>Gate Entry Number:</label>
              <div className="gate-number-wrapper">
                <div className="gate-number">{createdGateEntryNum}</div>
                <button
                  className="copy-icon-btn"
                  onClick={handleCopyGateEntry}
                  title="Copy to clipboard"
                  type="button"
                >
                  {copied ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <p className="stores-message">Stores and Consumable</p>
            <button
              className="submit-btn"
              style={{ marginTop: "10px", marginBottom: "6px" }}
              onClick={handlePrint}
              type="button"
              disabled={!savedResponseData}
            >
              Print Gate Entry Slip
            </button>
            {printStatus && (
              <div
                style={{
                  marginTop: "10px",
                  textAlign: "center",
                  fontWeight: "600",
                  color: printStatus.toLowerCase().includes("failed") ? "#dc2626" : "#166534"
                }}
              >
                {printStatus}
              </div>
            )}
            <button
              className="ok-btn"
              onClick={() => {
                setShowSuccessModal(false);
                navigate("/home");
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
 
    return errorMessage || "Failed to create gate entry. Please verify all information and try again.";
  };
 
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setPrintStatus("");
   
    // Comprehensive Validation
    if (!formData.plant) {
      setError("Please enter Plant code");
      return;
    }
 
    if (!formData.vendor) {
      setError("Please enter Vendor code");
      return;
    }
 
    if (!formData.modeOfTransport || formData.modeOfTransport === "Select") {
      setError("Please select Mode of Transport");
      return;
    }
 
    if (formData.modeOfTransport === "Truck") {
      if (!formData.vehicleNumber) {
        setError("Vehicle Number is required for Truck mode");
        return;
      }
      if (!formData.driverName) {
        setError("Driver Name is required for Truck mode");
        return;
      }
      if (!formData.driverPhoneNumber) {
        setError("Driver Phone Number is required for Truck mode");
        return;
      }
    }
 
    // Validate at least one material row has data
    const hasValidMaterial = tableRows.some(row =>
      row.materialCode || row.materialDescription
    );
    if (!hasValidMaterial) {
      setError("Please add at least one material with code or description");
      return;
    }
 
    setLoading(true);
 
    try {
      // Prepare payload for API
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const inwardTime = `${hh}:${mm}`;
     
 
      // Map user-friendly values to SAP-expected values
      const sapModeOfTransport = formData.modeOfTransport === "Hand"
        ? "By Hand"
        : formData.modeOfTransport === "Truck"
          ? "By Road"
          : formData.modeOfTransport;
 
      const payload = {
        GateEntryDate: today,
        InwardTime: inwardTime,
        FiscalYear: new Date().getFullYear().toString(),
        Plant: formData.plant,
        Vendor: formData.vendor,
        VendorName: formData.vendorName,
        VehicleNumber: formData.vehicleNumber || "",
        TransporterCode: formData.transporterCode || "",
        TransporterName: formData.transporterName || "",
        DriverName: formData.driverName || "",
        DriverPhoneNumber: formData.driverPhoneNumber || "",
        DLNumber: formData.dlNumber || "",
        ModeOfTransport: sapModeOfTransport,
        Remarks: formData.remarks,
        tableRows: tableRows.map(row => ({
          type: row.type,
          materialCode: row.materialCode,
          materialDescription: row.materialDescription,
          returnableQty: row.returnableQty,
          uom: row.uom,
          approximateValue: row.approximateValue,
          remarks: row.remarks
        }))
      };
 
      console.log("Submitting NRGP Gate Entry:", JSON.stringify(payload, null, 2));
 
      const { data } = await createNrgpGateEntry(payload);
     
      // Extract gate entry number from response
      const gateEntryNum = data?.d?.GateEntryNumber || data?.GateEntryNumber || "Created";
      const responseData = data?.d || data;
     
      // Show custom success modal
      setCreatedGateEntryNum(gateEntryNum);
      setSavedResponseData(responseData);
      setShowSuccessModal(true);
      setLoading(false);
 
    } catch (err) {
      console.error("Failed to create NRGP gate entry:", err);
      const friendlyError = parseError(err);
      setError(friendlyError);
      setLoading(false);
    }
  };
 
  return (
    <div className="rgp-container">
      <div className="rgp-header">
        <h2>NRGP Process - Gate Entry</h2>
      </div>
 
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
 
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="modal-overlay">
          <div className="success-modal">
            <div className="success-icon">✓</div>
            <h3>NRGP Gate Entry Created Successfully!</h3>
            <div className="gate-entry-info">
              <label>Gate Entry Number:</label>
              <div className="gate-number-wrapper">
                <div className="gate-number">{createdGateEntryNum}</div>
                <button
                  className="copy-icon-btn"
                  onClick={handleCopyGateEntry}
                  title="Copy to clipboard"
                  type="button"
                >
                  {copied ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <p className="stores-message">Stores and Consumable</p>
            <button
              className="submit-btn"
              style={{ marginTop: "10px", marginBottom: "6px" }}
              onClick={handlePrint}
              type="button"
              disabled={!savedResponseData}
            >
              Print Slip
            </button>
            {printStatus && (
              <div
                style={{
                  marginTop: "10px",
                  textAlign: "center",
                  fontWeight: "600",
                  color: printStatus.toLowerCase().includes("failed") ? "#dc2626" : "#166534"
                }}
              >
                {printStatus}
              </div>
            )}
            <button
              className="ok-btn"
              onClick={() => {
                setShowSuccessModal(false);
                navigate("/home");
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
 
      <form onSubmit={handleSubmit} className="rgp-form" onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.type !== 'submit') {
          e.preventDefault();
        }
      }}>
        {/* Header Fields */}
        <div className="header-section">
          <h3>Header Information</h3>
 
          <div className="form-grid">
            <div className="form-group">
              <label>Plant <span className="required"></span></label>
              <input
                type="text"
                name="plant"
                value={formData.plant}
                onChange={handleInputChange}
              />
            </div>
 
            <div className="form-group">
              <label>Vendor <span className="required"></span></label>
              <input
                type="text"
                name="vendor"
                value={formData.vendor}
                onChange={handleInputChange}
              />
            </div>
 
            <div className="form-group">
              <label>Vendor Name</label>
              <input
                type="text"
                name="vendorName"
                value={formData.vendorName}
                onChange={handleInputChange}
              />
            </div>
 
            <div className="form-group">
              <label>Mode of Transport <span className="required"></span></label>
              <div style={{ position: 'relative' }}>
                <select
                  name="modeOfTransport"
                  value={formData.modeOfTransport}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 12px',
                    fontSize: '14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none'
                  }}
                >
                  <option value="Select">Select</option>
                  <option value="Hand">Hand</option>
                  <option value="Truck">Truck</option>
                </select>
                <svg
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    width: '20px',
                    height: '20px'
                  }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>
 
            {formData.modeOfTransport === "Truck" && (
              <>
                <div className="form-group">
                  <label>Vehicle Number</label>
                  <input
                    type="text"
                    name="vehicleNumber"
                    value={formData.vehicleNumber}
                    onChange={handleInputChange}
                  />
                </div>
 
                <div className="form-group">
                  <label>Transporter Code</label>
                  <input
                    type="text"
                    name="transporterCode"
                    value={formData.transporterCode}
                    onChange={handleInputChange}
                  />
                </div>
 
                <div className="form-group">
                  <label>Transporter Name</label>
                  <input
                    type="text"
                    name="transporterName"
                    value={formData.transporterName}
                    onChange={handleInputChange}
                  />
                </div>
 
                <div className="form-group">
                  <label>Driver Name</label>
                  <input
                    type="text"
                    name="driverName"
                    value={formData.driverName}
                    onChange={handleInputChange}
                  />
                </div>
 
                <div className="form-group">
                  <label>Driver Phone Number</label>
                  <input
                    type="tel"
                    name="driverPhoneNumber"
                    value={formData.driverPhoneNumber}
                    onChange={handleInputChange}
                  />
                </div>
 
                <div className="form-group">
                  <label>DL Number</label>
                  <input
                    type="text"
                    name="dlNumber"
                    value={formData.dlNumber}
                    onChange={handleInputChange}
                  />
                </div>
              </>
            )}
 
            <div className="form-group full-width">
              <label>Remarks / Purpose</label>
              <input
                type="text"
                name="remarks"
                value={formData.remarks}
                onChange={handleInputChange}
                placeholder="Enter remarks or purpose"
              />
            </div>
          </div>
        </div>
 
        {/* Material Table */}
        <div className="table-section">
          <h3>Material Details</h3>
          <div className="table-wrapper">
            <table className="rgp-table">
              <thead>
                <tr>
                  <th>M</th>
                  <th>T</th>
                  <th>Material Code</th>
                  <th>Material Description</th>
                  <th>Returnable Qty</th>
                  <th>UOM</th>
                  <th>Approximate Value</th>
                  <th>Remarks</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="radio"
                        name={`type-${row.id}`}
                        checked={row.type === "M"}
                        onChange={() => handleRowChange(row.id, "type", "M")}
                      />
                    </td>
                    <td>
                      <input
                        type="radio"
                        name={`type-${row.id}`}
                        checked={row.type === "T"}
                        onChange={() => handleRowChange(row.id, "type", "T")}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.materialCode}
                        onChange={(e) => handleRowChange(row.id, "materialCode", e.target.value)}
                        placeholder="Material Code"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.materialDescription}
                        onChange={(e) => handleRowChange(row.id, "materialDescription", e.target.value)}
                        placeholder="Description"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={row.returnableQty}
                        onChange={(e) => handleRowChange(row.id, "returnableQty", e.target.value)}
                        placeholder="Returnable Qty"
                        step="0.01"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.uom}
                        onChange={(e) => handleRowChange(row.id, "uom", e.target.value)}
                        placeholder="UOM"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={row.approximateValue}
                        onChange={(e) => handleRowChange(row.id, "approximateValue", e.target.value)}
                        placeholder="Value"
                        step="0.01"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.remarks}
                        onChange={(e) => handleRowChange(row.id, "remarks", e.target.value)}
                        placeholder="Remarks"
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => deleteRow(row.id)}
                        className="delete-btn"
                        disabled={tableRows.length === 1}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addRow} className="add-row-btn">
            + Add Row
          </button>
        </div>
 
        {/* Action Buttons */}
        <div className="action-buttons">
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Creating..." : "Generate Gate Entry"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/home/rgp")}
            className="cancel-btn"
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
 
 