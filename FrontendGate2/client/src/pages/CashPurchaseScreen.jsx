
// import React, { useState, useEffect } from 'react';
// import api from '../api';
// import './CashPurchaseScreen.css';

// const CashPurchaseScreen = () => {
//   const [form, setForm] = useState({
//     GateEntryNumber: '',
//     SAP_Description: '',
//     Indicators: 'CP',
//     GateEntryDate: '',
//     GateOutDate: '',
//     InwardTime: '',
//     OutwardTime: '',
//     SubTransporterName: '',
//     DriverPhoneNumber: '',
//     DLNumber: '',
//     LRGCNumber: '',
//     PermitNumber: '',
//     EWayBill: false,
//     Division: '',
//     Remarks: '',
//     SalesDocument: '',
//     Customer: '',
//     CustomerName: '',
//     PurchaseOrderNumber: '',
//     PurchaseOrderNumber2: '',
//     PurchaseOrderNumber3: '',
//     PurchaseOrderNumber4: '',
//     PurchaseOrderNumber5: '',
//     PurchaseOrderItem: '',
//     PurchaseOrderItem2: '',
//     PurchaseOrderItem3: '',
//     PurchaseOrderItem4: '',
//     PurchaseOrderItem5: '',
//     MaterialDescription: '',
//     MaterialDescription2: '',
//     MaterialDescription3: '',
//     MaterialDescription4: '',
//     MaterialDescription5: '',
//     VendorInvoiceNumber: '',
//     VendorName: '',
//     VendorInvoiceNumber2: '',
//     VendorInvoiceNumber3: '',
//     VendorInvoiceNumber4: '',
//     VendorInvoiceNumber5: '',
//     SAP_CreatedDateTime: '',
//     SAP_CreatedByUser: '',
//     SAP_CreatedByUser_Text: '',
//     SAP_LastChangedDateTime: '',
//     SAP_LastChangedByUser: '',
//     SAP_LastChangedByUser_Text: '',
//     SAP_LifecycleStatus: '',
//     SAP_LifecycleStatus_Text: '',
//     // New fields
//     CashPurchaseApprover: '',
//     PersonName: '',
//     TotalAmount: '0.00',
//     TransportMode: '',
//   });

//   const [loading, setLoading] = useState(false);
//   const [result, setResult] = useState(null);
//   const [error, setError] = useState(null);
//   const [showSuccess, setShowSuccess] = useState(false);
//   const [successData, setSuccessData] = useState(null);
//   const [phoneError, setPhoneError] = useState('');

//   // Table state for items (include all SAP-required fields)
//   const [items, setItems] = useState([
//     {
//       itemNo: 1,
//       description: '',
//       quantity: '',
//       rate: '',
//       amount: '',
//       remarks: '',
//       PurchaseOrderItem: '',
//       Material: '',
//       VendorInvoiceDate: ''
//     }
//   ]);

//   // Calculate and update TotalAmount whenever items change
//   useEffect(() => {
//     const total = items.reduce((sum, item) => {
//       const amt = parseFloat(item.amount) || 0;
//       return sum + amt;
//     }, 0);
//     setForm(f => ({ ...f, TotalAmount: total.toFixed(2) }));
//   }, [items]);

//   /* ================= USER-FRIENDLY ERROR HANDLER ================= */
//   const getUserFriendlyError = (error) => {
//     // If error is already a user-friendly string
//     if (typeof error === 'string' && !error.includes('<') && !error.includes('<?xml')) {
//       return error;
//     }

//     // Check for specific error patterns
//     const errorString = JSON.stringify(error);
//     const errorMessage = error?.response?.data?.error || error?.message || errorString;
    
//     // Network errors
//     if (error?.code === 'ECONNABORTED' || errorMessage.includes('timeout')) {
//       return '⚠️ Request timeout. Please check your internet connection and try again.';
//     }
    
//     if (error?.code === 'ERR_NETWORK' || errorMessage.includes('Network Error')) {
//       return '⚠️ Network error. Please check your internet connection and try again.';
//     }

//     if (error?.response?.status === 500 || errorMessage.includes('500')) {
//       return '⚠️ Server error occurred. Please contact IT support or try again later.';
//     }

//     if (error?.response?.status === 503 || errorMessage.includes('503')) {
//       return '⚠️ Service temporarily unavailable. Please try again in a few minutes.';
//     }

//     // SAP-specific errors
//     if (errorMessage.includes('SAP') || errorMessage.includes('BAPI')) {
//       if (errorMessage.includes('authorization') || errorMessage.includes('Authorization')) {
//         return '⚠️ Access denied. You don\'t have permission to create this entry. Please contact your administrator.';
//       }
//       if (errorMessage.includes('duplicate') || errorMessage.includes('already exists') || errorMessage.includes('same key')) {
//         return '⚠️ This gate entry number already exists in the system. The system will automatically try the next available number. Please try again.';
//       }
//       if (errorMessage.includes('mandatory') || errorMessage.includes('required')) {
//         return '⚠️ Some required fields are missing in SAP. Please ensure all mandatory fields are filled correctly.';
//       }
//       if (errorMessage.includes('invalid') || errorMessage.includes('Invalid')) {
//         return '⚠️ Invalid data provided. Please check all fields and ensure they meet SAP requirements.';
//       }
//       return '⚠️ SAP system error occurred. Please contact IT support with the gate entry details.';
//     }

//     // XML/Parse errors
//     if (errorMessage.includes('<?xml') || errorMessage.includes('<html>') || errorMessage.includes('<!DOCTYPE')) {
//       return '⚠️ System configuration error. Please contact IT support - the server response is invalid.';
//     }

//     if (errorMessage.includes('JSON') || errorMessage.includes('Unexpected token')) {
//       return '⚠️ Data format error. Please contact IT support - unable to process server response.';
//     }

//     // Authentication errors
//     if (error?.response?.status === 401 || errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
//       return '⚠️ Session expired. Please refresh the page and login again.';
//     }

//     if (error?.response?.status === 403 || errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
//       return '⚠️ Access forbidden. You don\'t have permission to perform this action.';
//     }

//     // Validation errors
//     if (error?.response?.status === 400 || errorMessage.includes('400') || errorMessage.includes('Bad Request')) {
//       return '⚠️ Invalid data submitted. Please check all fields and try again.';
//     }

//     // Database errors
//     if (errorMessage.includes('database') || errorMessage.includes('Database') || errorMessage.includes('SQL')) {
//       return '⚠️ Database error occurred. Please contact IT support or try again later.';
//     }

//     // Generic fallback
//     if (errorMessage.length > 200 || errorMessage.includes('<')) {
//       return '⚠️ An unexpected error occurred. Please contact IT support for assistance.';
//     }

//     return `⚠️ Error: ${errorMessage}`;
//   };

//   /* ================= NUMBER INPUT VALIDATION ================= */
//   const handleNumberInput = (value) => {
//     // Remove any non-digit characters, spaces, and leading zeros
//     return value.replace(/[^0-9.]/g, '').replace(/\s+/g, '');
//   };

//   /* ================= PHONE NUMBER VALIDATION ================= */
//   const handlePhoneChange = (value) => {
//     const cleaned = value.replace(/[^0-9]/g, '').replace(/\s+/g, '');
//     if (cleaned.length > 10) {
//       setPhoneError('Phone number cannot exceed 10 digits');
//       return;
//     }
//     setPhoneError('');
//     setForm({ ...form, DriverPhoneNumber: cleaned });
//   };

//   // Handle table cell change
//   const handleItemChange = (idx, field, value) => {
//     // For numeric fields, apply number validation
//     let cleanedValue = value;
//     if (field === 'quantity' || field === 'rate' || field === 'amount') {
//       cleanedValue = handleNumberInput(value);
//     }

//     setItems(prev => prev.map((row, i) => {
//       if (i !== idx) return row;
//       // If user edits description, also set Material (for SAP)
//       if (field === 'description') {
//         return { ...row, description: cleanedValue, Material: cleanedValue };
//       }
//       // If user edits VendorInvoiceDate, store as ISO string
//       if (field === 'VendorInvoiceDate') {
//         return { ...row, VendorInvoiceDate: cleanedValue };
//       }
//       return { ...row, [field]: cleanedValue };
//     }));
//   };

//   // Add new row
//   const addItemRow = () => {
//     setItems(prev => [
//       ...prev,
//       {
//         itemNo: prev.length + 1,
//         description: '',
//         quantity: '',
//         rate: '',
//         amount: '',
//         remarks: '',
//         PurchaseOrderItem: '',
//         Material: '',
//         VendorInvoiceDate: ''
//       }
//     ]);
//   };

//   // Remove row
//   const removeItemRow = (idx) => {
//     setItems(prev => prev.filter((_, i) => i !== idx).map((row, i) => ({ ...row, itemNo: i + 1 })));
//   };

//   const handleChange = e => {
//     const { name, value } = e.target;
    
//     // Prevent user from changing GateEntryNumber
//     if (name === 'GateEntryNumber') return;
    
//     // Handle phone number separately with validation
//     if (name === 'DriverPhoneNumber') {
//       handlePhoneChange(value);
//       return;
//     }
    
//     // Prevent manual editing of TotalAmount (now auto-calculated)
//     if (name === 'TotalAmount') {
//       return;
//     }
    
//     setForm({ ...form, [name]: value });
//   };

//   const handleSubmit = async e => {
//     e.preventDefault();

//     // Validate phone number
//     if (form.DriverPhoneNumber && form.DriverPhoneNumber.length !== 10) {
//       setPhoneError('Phone number must be exactly 10 digits');
//       return;
//     }

//     // Validate at least one item with description
//     const validItems = items.filter(item => item.description.trim());
//     if (validItems.length === 0) {
//       setError('Please add at least one item with description');
//       return;
//     }

//     setLoading(true);
//     setError(null);
//     setResult(null);

//     try {
//       // Step 1: Create header only (do not send items)
//       const currentYear = new Date().getFullYear();
//       const yearPrefix = currentYear.toString().slice(-2);

//       // Format times for SAP
//       const updatedForm = {
//         ...form,
//         InwardTime: form.InwardTime ? `${form.InwardTime}:00` : '',
//         OutwardTime: form.OutwardTime ? `${form.OutwardTime}:00` : ''
//       };

//       // Remove items from payload
//       const headerPayload = { ...updatedForm };
//       delete headerPayload.items;

//       // Create header (returns SAP_UUID)
//       const resp = await api.post('/cashpurchase', headerPayload);
//       const gateNumber = resp.data?.GateEntryNumber || resp.data?.d?.GateEntryNumber || resp.data?.d?.YY1_GATEINWARD_OUTWARDDETA?.GateEntryNumber;
//       const parentUUID = resp.data?.SAP_UUID || resp.data?.d?.SAP_UUID;

//       if (!parentUUID) {
//         setError('Header created but SAP_UUID missing. Cannot create line items.');
//         setLoading(false);
//         return;
//       }

//       // Step 2: Add SAP_PARENT_UUID to each item and send all items in one batch
//       const itemsWithParent = validItems.map(item => ({
//         ...item,
//         SAP_PARENT_UUID: parentUUID,
//         PurchaseOrderNumber: form.PurchaseOrderNumber || '',
//         Material: item.Material || item.description || '',
//         MaterialDescription: item.description || '',
//         RecivedQty: String(item.quantity || ''), // SAP expects 'RecivedQty' (typo)
//         VendorInvoiceNumber: form.VendorInvoiceNumber || '',
//         VendorInvoicedate: item.VendorInvoiceDate
//           ? `/Date(${new Date(item.VendorInvoiceDate).getTime()})/`
//           : (form.VendorInvoiceDate ? `/Date(${new Date(form.VendorInvoiceDate).getTime()})/` : null),
//         Rate: String(item.rate || ''),
//         Amount: String(item.amount || ''),
//         Remarks: item.remarks || ''
//       }));

//       // Send all items in one POST (backend supports array)
//       await api.post('/cashpurchase/item', itemsWithParent);

//       setSuccessData({
//         gateEntryNumber: gateNumber,
//         time: new Date().toLocaleString(),
//         approver: updatedForm.CashPurchaseApprover,
//         personName: updatedForm.PersonName,
//         totalAmount: updatedForm.TotalAmount,
//         vendorName: updatedForm.VendorName,
//         transportMode: updatedForm.TransportMode,
//         items: validItems
//       });
//       setShowSuccess(true);
//     } catch (err) {
//       // Show SAP error details if present
//       const sapError = err?.response?.data?.sapError;
//       if (sapError) {
//         setError(`⚠️ SAP Error: ${typeof sapError === 'string' ? sapError : JSON.stringify(sapError)}`);
//       } else {
//         setError(getUserFriendlyError(err));
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="cps-page">
//       <div className="cps-container">
//         <div className="cps-title">Cash Purchase Gate Entry</div>
//         <form className="cps-form" onSubmit={handleSubmit} onKeyDown={(e) => {
//           if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.type !== 'submit') {
//             e.preventDefault();
//           }
//         }}>
//           {/* 5 fields per row, grid layout for alignment */}
//           <div className="cps-grid">
//             {/* Row 1 */}
//             <div className="cps-field">
//               <label>Gate Entry Number</label>
//               <input className="cps-input cps-input-readonly" name="GateEntryNumber" value={form.GateEntryNumber} placeholder="Auto-generated on submit" readOnly required tabIndex={-1} />
//             </div>
//             <div className="cps-field">
//               <label>Indicators</label>
//               <input className="cps-input cps-input-readonly" name="Indicators" value={form.Indicators} readOnly tabIndex={-1} />
//             </div>
//             <div className="cps-field">
//               <label>Gate Entry Date</label>
//               <input className="cps-input" name="GateEntryDate" type="date" value={form.GateEntryDate} onChange={handleChange} required />
//             </div>
//             {/* New Fields Row 2 */}
//             <div className="cps-field">
//               <label>Cash Purchase Approver</label>
//               <input className="cps-input" name="CashPurchaseApprover" value={form.CashPurchaseApprover} onChange={handleChange} required />
//             </div>
//             <div className="cps-field">
//               <label>Person Name</label>
//               <input className="cps-input" name="PersonName" value={form.PersonName} onChange={handleChange} required />
//             </div>
//             {/* Total Amount field removed from here, will be shown above the table */}
//             {/* Row 3 */}
//             <div className="cps-field">
//               <label>Remarks</label>
//               <input className="cps-input" name="Remarks" value={form.Remarks} onChange={handleChange} />
//             </div>
//             <div className="cps-field">
//               <label>Vendor Name</label>
//               <input className="cps-input" name="VendorName" value={form.VendorName} onChange={handleChange} />
//             </div>
//             <div className="cps-field">
//               <label>Inward Time</label>
//               <input className="cps-input" name="InwardTime" type="time" value={form.InwardTime} onChange={handleChange} />
//             </div>
//             <div className="cps-field">
//               <label>Mobile Number</label>
//               <input 
//                 className="cps-input"
//                 name="DriverPhoneNumber" 
//                 value={form.DriverPhoneNumber} 
//                 onChange={handleChange}
//                 maxLength="10"
//                 placeholder="10 digits only"
//               />
//               {phoneError && <span className="cps-phone-error">{phoneError}</span>}
//             </div>
//             <div className="cps-field">
//               <label>Vendor Invoice Number</label>
//               <input className="cps-input" name="VendorInvoiceNumber" value={form.VendorInvoiceNumber} onChange={handleChange} />
//             </div>
//             <div className="cps-field">
//               <label>Mode of Transport</label>
//               <select
//                 className="cps-select"
//                 name="TransportMode"
//                 value={form.TransportMode}
//                 onChange={handleChange}
//                 required
//               >
//                 <option value="">Select</option>
//                 <option value="Hand">Hand</option>
//                 <option value="Truck">Truck</option>
//               </select>
//             </div>
//             {/* Fillers for alignment */}
//             <div></div>
//             <div></div>
//             <div></div>
//             <div></div>
//           </div>
//           {/* Total Amount summary above the table */}
//           <div className="cps-total-row">
//             <div className="cps-total-card">
//               Total Amount: ₹{form.TotalAmount}
//             </div>
//           </div>
//           {/* Item Table */}
//           <div className="cps-table-wrap">
//             <table className="cps-table">
//               <thead>
//                 <tr>
//                   <th>Item No</th>
//                   <th>Description</th>
//                   <th>Quantity</th>
//                   <th>Rate</th>
//                   <th>Amount</th>
//                   <th>Remarks</th>
//                   <th></th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {items.map((row, idx) => (
//                   <tr key={idx}>
//                     <td className="cps-table-cell-center">{row.itemNo}</td>
//                     <td>
//                       <input className="cps-table-input" type="text" value={row.description} onChange={e => handleItemChange(idx, 'description', e.target.value)} />
//                     </td>
//                     <td>
//                       <input 
//                         className="cps-table-input-sm"
//                         type="text" 
//                         value={row.quantity} 
//                         onChange={e => handleItemChange(idx, 'quantity', e.target.value)} 
//                         placeholder="0"
//                       />
//                     </td>
//                     <td>
//                       <input 
//                         className="cps-table-input-sm"
//                         type="text" 
//                         value={row.rate} 
//                         onChange={e => handleItemChange(idx, 'rate', e.target.value)} 
//                         placeholder="0.00"
//                       />
//                     </td>
//                     <td>
//                       <input
//                         className="cps-table-input-sm"
//                         type="text"
//                         value={row.amount}
//                         onChange={e => handleItemChange(idx, 'amount', e.target.value)}
//                         placeholder="0.00"
//                       />
//                     </td>
//                     <td>
//                       <input className="cps-table-input" type="text" value={row.remarks} onChange={e => handleItemChange(idx, 'remarks', e.target.value)} />
//                     </td>
//                     <td className="cps-table-cell-center">
//                       {items.length > 1 && (
//                         <button className="cps-remove-btn" type="button" onClick={() => removeItemRow(idx)}>×</button>
//                       )}
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//             <button className="cps-add-row-btn" type="button" onClick={addItemRow}>+ Add Row</button>
//           </div>
//           <button
//             className="cps-submit-btn"
//             type="submit"
//             disabled={loading}
//           >
//             {loading ? 'Creating...' : 'Create'}
//           </button>
//         </form>
//         {loading && <p className="cps-loading">Submitting...</p>}
        
//         {/* ===== SUCCESS POPUP ===== */}
//         {showSuccess && successData && (
//           <div style={{
//             position: 'fixed',
//             top: 0,
//             left: 0,
//             right: 0,
//             bottom: 0,
//             background: 'rgba(0, 0, 0, 0.5)',
//             display: 'flex',
//             alignItems: 'center',
//             justifyContent: 'center',
//             zIndex: 9999,
//             backdropFilter: 'blur(4px)'
//           }}>
//             <div style={{
//               background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
//               borderRadius: '14px',
//               padding: '16px',
//               width: '460px',
//               maxHeight: '70vh',
//               boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
//               border: '2px solid #10b981',
//               position: 'relative',
//               overflow: 'hidden'
//             }}>
//               {/* Success Icon */}
//               <div style={{
//                 width: '50px',
//                 height: '50px',
//                 background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
//                 borderRadius: '50%',
//                 display: 'flex',
//                 alignItems: 'center',
//                 justifyContent: 'center',
//                 margin: '0 auto 12px',
//                 boxShadow: '0 6px 16px rgba(16, 185, 129, 0.3)'
//               }}>
//                 <span style={{ fontSize: '26px', color: '#fff' }}>✓</span>
//               </div>

//               <h2 style={{
//                 textAlign: 'center',
//                 color: '#059669',
//                 fontSize: '18px',
//                 fontWeight: '700',
//                 margin: '0 0 14px 0',
//                 letterSpacing: '-0.5px'
//               }}>Entry Created Successfully</h2>

//               {/* Gate Entry Number Card */}
//               <div style={{
//                 background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
//                 borderRadius: '10px',
//                 padding: '12px',
//                 marginBottom: '12px',
//                 boxShadow: '0 3px 10px rgba(37, 99, 235, 0.2)',
//                 display: 'flex',
//                 justifyContent: 'space-between',
//                 alignItems: 'center'
//               }}>
//                 <div>
//                   <div style={{ color: '#dbeafe', fontSize: '10px', fontWeight: '600', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Gate Entry Number</div>
//                   <div style={{ color: '#fff', fontSize: '20px', fontWeight: '700', letterSpacing: '1px' }}>{successData.gateEntryNumber}</div>
//                 </div>
//                 <button 
//                   onClick={() => {
//                     navigator.clipboard.writeText(successData.gateEntryNumber);
//                     alert('Gate Entry Number copied!');
//                   }}
//                   style={{
//                     background: 'rgba(255, 255, 255, 0.2)',
//                     border: '1px solid rgba(255, 255, 255, 0.3)',
//                     borderRadius: '8px',
//                     padding: '8px 14px',
//                     color: '#fff',
//                     fontSize: '13px',
//                     fontWeight: '600',
//                     cursor: 'pointer',
//                     transition: 'all 0.2s',
//                     backdropFilter: 'blur(10px)'
//                   }}
//                   onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
//                   onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
//                   title="Copy to clipboard"
//                 >
//                   📋 Copy
//                 </button>
//               </div>

//               {/* Details Grid */}
//               <div style={{
//                 display: 'grid',
//                 gridTemplateColumns: '1fr 1fr 1fr',
//                 gap: '8px',
//                 marginBottom: '12px'
//               }}>
//                 <div style={{ background: '#f9fafb', borderRadius: '6px', padding: '8px' }}>
//                   <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: '600', marginBottom: '3px', textTransform: 'uppercase' }}>Approver</div>
//                   <div style={{ fontSize: '12px', color: '#111827', fontWeight: '600' }}>{successData.approver}</div>
//                 </div>
//                 <div style={{ background: '#f9fafb', borderRadius: '6px', padding: '8px' }}>
//                   <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: '600', marginBottom: '3px', textTransform: 'uppercase' }}>Person</div>
//                   <div style={{ fontSize: '12px', color: '#111827', fontWeight: '600' }}>{successData.personName}</div>
//                 </div>
//                 <div style={{ background: '#f9fafb', borderRadius: '6px', padding: '8px' }}>
//                   <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: '600', marginBottom: '3px', textTransform: 'uppercase' }}>Total Amount</div>
//                   <div style={{ fontSize: '13px', color: '#059669', fontWeight: '700' }}>₹{successData.totalAmount}</div>
//                 </div>
//                 <div style={{ background: '#f9fafb', borderRadius: '6px', padding: '8px' }}>
//                   <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: '600', marginBottom: '3px', textTransform: 'uppercase' }}>Transport</div>
//                   <div style={{ fontSize: '12px', color: '#111827', fontWeight: '600' }}>{successData.transportMode || 'N/A'}</div>
//                 </div>
//                 {successData.vendorName && (
//                   <div style={{ background: '#f9fafb', borderRadius: '6px', padding: '8px' }}>
//                     <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: '600', marginBottom: '3px', textTransform: 'uppercase' }}>Vendor</div>
//                     <div style={{ fontSize: '12px', color: '#111827', fontWeight: '600' }}>{successData.vendorName}</div>
//                   </div>
//                 )}
//                 {successData.time && (
//                   <div style={{ background: '#f9fafb', borderRadius: '6px', padding: '8px' }}>
//                     <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: '600', marginBottom: '3px', textTransform: 'uppercase' }}>Date & Time</div>
//                     <div style={{ fontSize: '12px', color: '#111827', fontWeight: '600' }}>{successData.time}</div>
//                   </div>
//                 )}
//                 {/* Items Display */}
//                 {successData.items && successData.items.length > 0 && successData.items.map((item, idx) => (
//                   <React.Fragment key={idx}>
//                     <div style={{ background: '#f0f9ff', borderRadius: '6px', padding: '8px', gridColumn: 'span 3', border: '1px solid #bae6fd' }}>
//                       <div style={{ fontSize: '9px', color: '#0369a1', fontWeight: '600', marginBottom: '3px', textTransform: 'uppercase' }}>Item #{item.itemNo} - {item.description}</div>
//                       <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: '#0c4a6e', fontWeight: '600' }}>
//                         <span>Qty: {item.quantity}</span>
//                         <span>Rate: ₹{item.rate}</span>
//                         <span style={{ color: '#059669', fontWeight: '700' }}>Amt: ₹{item.amount}</span>
//                         {item.remarks && <span style={{ color: '#7c3aed' }}>Note: {item.remarks}</span>}
//                       </div>
//                     </div>
//                   </React.Fragment>
//                 ))}
//               </div>

//               {/* Action Button */}
//               <button
//                 onClick={() => {
//                   setShowSuccess(false);
//                   setForm({
//                     ...form,
//                     GateEntryNumber: '',
//                     SAP_Description: '',
//                     Indicators: 'CP',
//                     GateEntryDate: '',
//                     InwardTime: '',
//                     Remarks: '',
//                     VendorName: '',
//                     DriverPhoneNumber: '',
//                     VendorInvoiceNumber: '',
//                     CashPurchaseApprover: '',
//                     PersonName: '',
//                     TotalAmount: '0.00',
//                     TransportMode: ''
//                   });
//                   setItems([{ itemNo: 1, description: '', quantity: '', rate: '', amount: '', remarks: '' }]);
//                   setPhoneError('');
//                   setError(null);
//                 }}
//                 style={{
//                   width: '100%',
//                   background: 'linear-gradient(135deg, #0ced7c 0%, #03262c 100%)',
//                   border: 'none',
//                   borderRadius: '8px',
//                   padding: '11px',
//                   color: '#fff',
//                   fontSize: '14px',
//                   fontWeight: '700',
//                   cursor: 'pointer',
//                   boxShadow: '0 3px 10px rgba(8, 243, 125, 0.3)',
//                   transition: 'all 0.2s',
//                   textTransform: 'uppercase',
//                   letterSpacing: '0.5px'
//                 }}
//                 onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
//                 onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
//               >
//                 OK
//               </button>
//             </div>
//           </div>
//         )}
        
//         {error && typeof error === 'string' && (
//           <div className="cps-error">
//             <strong>Error:</strong> {error}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default CashPurchaseScreen;







 
import React, { useState, useEffect } from 'react';
import api from '../api';
import './CashPurchaseScreen.css';
 
const CashPurchaseScreen = () => {
  const [form, setForm] = useState({
    GateEntryNumber: '',
    SAP_Description: '',
    Indicators: 'CP',
    GateEntryDate: '',
    GateOutDate: '',
    InwardTime: '',
    OutwardTime: '',
    SubTransporterName: '',
    DriverPhoneNumber: '',
    DLNumber: '',
    LRGCNumber: '',
    PermitNumber: '',
    EWayBill: false,
    Division: '',
    Remarks: '',
    SalesDocument: '',
    Customer: '',
    CustomerName: '',
    PurchaseOrderNumber: '',
    PurchaseOrderNumber2: '',
    PurchaseOrderNumber3: '',
    PurchaseOrderNumber4: '',
    PurchaseOrderNumber5: '',
    PurchaseOrderItem: '',
    PurchaseOrderItem2: '',
    PurchaseOrderItem3: '',
    PurchaseOrderItem4: '',
    PurchaseOrderItem5: '',
    MaterialDescription: '',
    MaterialDescription2: '',
    MaterialDescription3: '',
    MaterialDescription4: '',
    MaterialDescription5: '',
    VendorInvoiceNumber: '',
    VendorName: '',
    VendorInvoiceNumber2: '',
    VendorInvoiceNumber3: '',
    VendorInvoiceNumber4: '',
    VendorInvoiceNumber5: '',
    SAP_CreatedDateTime: '',
    SAP_CreatedByUser: '',
    SAP_CreatedByUser_Text: '',
    SAP_LastChangedDateTime: '',
    SAP_LastChangedByUser: '',
    SAP_LastChangedByUser_Text: '',
    SAP_LifecycleStatus: '',
    SAP_LifecycleStatus_Text: '',
    // New fields
    CashPurchaseApprover: '',
    PersonName: '',
    TotalAmount: '0.00',
    TransportMode: '',
  });
 
  // Fetch next Cash Purchase Gate Entry Number on mount
  useEffect(() => {
    const fetchNextGateEntryNumber = async () => {
      try {
        const resp = await fetch('/api/cashpurchase/next-number');
        const data = await resp.json();
        if (data.next) {
          setForm(f => ({ ...f, GateEntryNumber: data.next }));
        }
      } catch (err) {
        // Optionally handle error (show message, etc.)
      }
    };
    fetchNextGateEntryNumber();
  }, []);
 
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [phoneError, setPhoneError] = useState('');
 
  // Table state for items (include all SAP-required fields)
  const [items, setItems] = useState([
    {
      itemNo: 1,
      description: '',
      quantity: '',
      rate: '',
      amount: '',
      remarks: '',
      PurchaseOrderItem: '',
      Material: '',
      VendorInvoiceDate: ''
    }
  ]);
 
  // Calculate and update TotalAmount whenever items change
  useEffect(() => {
    const total = items.reduce((sum, item) => {
      const amt = parseFloat(item.amount) || 0;
      return sum + amt;
    }, 0);
    setForm(f => ({ ...f, TotalAmount: total.toFixed(2) }));
  }, [items]);
 
  /* ================= USER-FRIENDLY ERROR HANDLER ================= */
  const getUserFriendlyError = (error) => {
    // If error is already a user-friendly string
    if (typeof error === 'string' && !error.includes('<') && !error.includes('<?xml')) {
      return error;
    }
 
    // Check for specific error patterns
    const errorString = JSON.stringify(error);
    const errorMessage = error?.response?.data?.error || error?.message || errorString;
   
    // Network errors
    if (error?.code === 'ECONNABORTED' || errorMessage.includes('timeout')) {
      return '⚠️ Request timeout. Please check your internet connection and try again.';
    }
   
    if (error?.code === 'ERR_NETWORK' || errorMessage.includes('Network Error')) {
      return '⚠️ Network error. Please check your internet connection and try again.';
    }
 
    if (error?.response?.status === 500 || errorMessage.includes('500')) {
      return '⚠️ Server error occurred. Please contact IT support or try again later.';
    }
 
    if (error?.response?.status === 503 || errorMessage.includes('503')) {
      return '⚠️ Service temporarily unavailable. Please try again in a few minutes.';
    }
 
    // SAP-specific errors
    if (errorMessage.includes('SAP') || errorMessage.includes('BAPI')) {
      if (errorMessage.includes('authorization') || errorMessage.includes('Authorization')) {
        return '⚠️ Access denied. You don\'t have permission to create this entry. Please contact your administrator.';
      }
      if (errorMessage.includes('duplicate') || errorMessage.includes('already exists') || errorMessage.includes('same key')) {
        return '⚠️ This gate entry number already exists in the system. The system will automatically try the next available number. Please try again.';
      }
      if (errorMessage.includes('mandatory') || errorMessage.includes('required')) {
        return '⚠️ Some required fields are missing in SAP. Please ensure all mandatory fields are filled correctly.';
      }
      if (errorMessage.includes('invalid') || errorMessage.includes('Invalid')) {
        return '⚠️ Invalid data provided. Please check all fields and ensure they meet SAP requirements.';
      }
      return '⚠️ SAP system error occurred. Please contact IT support with the gate entry details.';
    }
 
    // XML/Parse errors
    if (errorMessage.includes('<?xml') || errorMessage.includes('<html>') || errorMessage.includes('<!DOCTYPE')) {
      return '⚠️ System configuration error. Please contact IT support - the server response is invalid.';
    }
 
    if (errorMessage.includes('JSON') || errorMessage.includes('Unexpected token')) {
      return '⚠️ Data format error. Please contact IT support - unable to process server response.';
    }
 
    // Authentication errors
    if (error?.response?.status === 401 || errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      return '⚠️ Session expired. Please refresh the page and login again.';
    }
 
    if (error?.response?.status === 403 || errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      return '⚠️ Access forbidden. You don\'t have permission to perform this action.';
    }
 
    // Validation errors
    if (error?.response?.status === 400 || errorMessage.includes('400') || errorMessage.includes('Bad Request')) {
      return '⚠️ Invalid data submitted. Please check all fields and try again.';
    }
 
    // Database errors
    if (errorMessage.includes('database') || errorMessage.includes('Database') || errorMessage.includes('SQL')) {
      return '⚠️ Database error occurred. Please contact IT support or try again later.';
    }
 
    // Generic fallback
    if (errorMessage.length > 200 || errorMessage.includes('<')) {
      return '⚠️ An unexpected error occurred. Please contact IT support for assistance.';
    }
 
    return `⚠️ Error: ${errorMessage}`;
  };
 
  /* ================= NUMBER INPUT VALIDATION ================= */
  const handleNumberInput = (value) => {
    // Remove any non-digit characters, spaces, and leading zeros
    return value.replace(/[^0-9.]/g, '').replace(/\s+/g, '');
  };
 
  /* ================= PHONE NUMBER VALIDATION ================= */
  const handlePhoneChange = (value) => {
    const cleaned = value.replace(/[^0-9]/g, '').replace(/\s+/g, '');
    if (cleaned.length > 10) {
      setPhoneError('Phone number cannot exceed 10 digits');
      return;
    }
    setPhoneError('');
    setForm({ ...form, DriverPhoneNumber: cleaned });
  };
 
  // Handle table cell change
  const handleItemChange = (idx, field, value) => {
    // For numeric fields, apply number validation
    let cleanedValue = value;
    if (field === 'quantity' || field === 'rate' || field === 'amount') {
      cleanedValue = handleNumberInput(value);
    }
 
    setItems(prev => prev.map((row, i) => {
      if (i !== idx) return row;
      // If user edits description, also set Material (for SAP)
      if (field === 'description') {
        return { ...row, description: cleanedValue, Material: cleanedValue };
      }
      // If user edits VendorInvoiceDate, store as ISO string
      if (field === 'VendorInvoiceDate') {
        return { ...row, VendorInvoiceDate: cleanedValue };
      }
      return { ...row, [field]: cleanedValue };
    }));
  };
 
  // Add new row
  const addItemRow = () => {
    setItems(prev => [
      ...prev,
      {
        itemNo: prev.length + 1,
        description: '',
        quantity: '',
        rate: '',
        amount: '',
        remarks: '',
        PurchaseOrderItem: '',
        Material: '',
        VendorInvoiceDate: ''
      }
    ]);
  };
 
  // Remove row
  const removeItemRow = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx).map((row, i) => ({ ...row, itemNo: i + 1 })));
  };
 
  const handleChange = e => {
    const { name, value } = e.target;
   
    // Prevent user from changing GateEntryNumber
    if (name === 'GateEntryNumber') return;
   
    // Handle phone number separately with validation
    if (name === 'DriverPhoneNumber') {
      handlePhoneChange(value);
      return;
    }
   
    // Prevent manual editing of TotalAmount (now auto-calculated)
    if (name === 'TotalAmount') {
      return;
    }
   
    setForm({ ...form, [name]: value });
  };
 
  const handleSubmit = async e => {
    e.preventDefault();
 
    // Validate phone number
    if (form.DriverPhoneNumber && form.DriverPhoneNumber.length !== 10) {
      setPhoneError('Phone number must be exactly 10 digits');
      return;
    }
 
    // Validate at least one item with description
    const validItems = items.filter(item => item.description.trim());
    if (validItems.length === 0) {
      setError('Please add at least one item with description');
      return;
    }
 
    setLoading(true);
    setError(null);
    setResult(null);
 
    try {
      // Step 1: Create header only (do not send items)
      const currentYear = new Date().getFullYear();
      const yearPrefix = currentYear.toString().slice(-2);
 
      // Format times for SAP
      const updatedForm = {
        ...form,
        InwardTime: form.InwardTime ? `${form.InwardTime}:00` : '',
        OutwardTime: form.OutwardTime ? `${form.OutwardTime}:00` : ''
      };
 
      // Remove items from payload
      const headerPayload = { ...updatedForm };
      delete headerPayload.items;
 
      // Create header (returns SAP_UUID)
      const resp = await api.post('/cashpurchase', headerPayload);
      const gateNumber = resp.data?.GateEntryNumber || resp.data?.d?.GateEntryNumber || resp.data?.d?.YY1_GATEINWARD_OUTWARDDETA?.GateEntryNumber;
      const parentUUID = resp.data?.SAP_UUID || resp.data?.d?.SAP_UUID;
 
      if (!parentUUID) {
        setError('Header created but SAP_UUID missing. Cannot create line items.');
        setLoading(false);
        return;
      }
 
      // Step 2: Add SAP_PARENT_UUID to each item and send all items in one batch
      const itemsWithParent = validItems.map(item => ({
        ...item,
        SAP_PARENT_UUID: parentUUID,
        PurchaseOrderNumber: form.PurchaseOrderNumber || '',
        Material: item.Material || item.description || '',
        MaterialDescription: item.description || '',
        RecivedQty: String(item.quantity || ''), // SAP expects 'RecivedQty' (typo)
        VendorInvoiceNumber: form.VendorInvoiceNumber || '',
        VendorInvoicedate: item.VendorInvoiceDate
          ? `/Date(${new Date(item.VendorInvoiceDate).getTime()})/`
          : (form.VendorInvoiceDate ? `/Date(${new Date(form.VendorInvoiceDate).getTime()})/` : null),
        Rate: String(item.rate || ''),
        Amount: String(item.amount || ''),
        Remarks: item.remarks || ''
      }));
 
      // Send all items in one POST (backend supports array)
      await api.post('/cashpurchase/item', itemsWithParent);
 
      setSuccessData({
        gateEntryNumber: gateNumber,
        time: new Date().toLocaleString(),
        approver: updatedForm.CashPurchaseApprover,
        personName: updatedForm.PersonName,
        totalAmount: updatedForm.TotalAmount,
        vendorName: updatedForm.VendorName,
        transportMode: updatedForm.TransportMode,
        items: validItems
      });
      setShowSuccess(true);
    } catch (err) {
      // Show SAP error details if present
      const sapError = err?.response?.data?.sapError;
      if (sapError) {
        setError(`⚠️ SAP Error: ${typeof sapError === 'string' ? sapError : JSON.stringify(sapError)}`);
      } else {
        setError(getUserFriendlyError(err));
      }
    } finally {
      setLoading(false);
    }
  };
 
  return (
    <div className="cps-page">
      <div className="cps-container">
        <div className="cps-title">Cash Purchase Gate Entry</div>
        <form className="cps-form" onSubmit={handleSubmit} onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.type !== 'submit') {
            e.preventDefault();
          }
        }}>
          {/* 5 fields per row, grid layout for alignment */}
          <div className="cps-grid">
            {/* Row 1 */}
            <div className="cps-field">
              <label>Gate Entry Number</label>
              <input className="cps-input cps-input-readonly" name="GateEntryNumber" value={form.GateEntryNumber} placeholder="Auto-generated on submit" readOnly required tabIndex={-1} />
            </div>
            <div className="cps-field">
              <label>Indicators</label>
              <input className="cps-input cps-input-readonly" name="Indicators" value={form.Indicators} readOnly tabIndex={-1} />
            </div>
            <div className="cps-field">
              <label>Gate Entry Date</label>
              <input className="cps-input" name="GateEntryDate" type="date" value={form.GateEntryDate} onChange={handleChange} required />
            </div>
            {/* New Fields Row 2 */}
            <div className="cps-field">
              <label>Cash Purchase Approver</label>
              <input className="cps-input" name="CashPurchaseApprover" value={form.CashPurchaseApprover} onChange={handleChange} required />
            </div>
            <div className="cps-field">
              <label>Person Name</label>
              <input className="cps-input" name="PersonName" value={form.PersonName} onChange={handleChange} required />
            </div>
            {/* Total Amount field removed from here, will be shown above the table */}
            {/* Row 3 */}
            <div className="cps-field">
              <label>Remarks</label>
              <input className="cps-input" name="Remarks" value={form.Remarks} onChange={handleChange} />
            </div>
            <div className="cps-field">
              <label>Vendor Name</label>
              <input className="cps-input" name="VendorName" value={form.VendorName} onChange={handleChange} />
            </div>
            <div className="cps-field">
              <label>Inward Time</label>
              <input className="cps-input" name="InwardTime" type="time" value={form.InwardTime} onChange={handleChange} />
            </div>
            <div className="cps-field">
              <label>Mobile Number</label>
              <input
                className="cps-input"
                name="DriverPhoneNumber"
                value={form.DriverPhoneNumber}
                onChange={handleChange}
                maxLength="10"
                placeholder="10 digits only"
              />
              {phoneError && <span className="cps-phone-error">{phoneError}</span>}
            </div>
            <div className="cps-field">
              <label>Vendor Invoice Number</label>
              <input className="cps-input" name="VendorInvoiceNumber" value={form.VendorInvoiceNumber} onChange={handleChange} />
            </div>
            <div className="cps-field">
              <label>Mode of Transport</label>
              <select
                className="cps-select"
                name="TransportMode"
                value={form.TransportMode}
                onChange={handleChange}
                required
              >
                <option value="">Select</option>
                <option value="Hand">Hand</option>
                <option value="Truck">Truck</option>
              </select>
            </div>
            {/* Fillers for alignment */}
            <div></div>
            <div></div>
            <div></div>
            <div></div>
          </div>
          {/* Total Amount summary above the table */}
          <div className="cps-total-row">
            <div className="cps-total-card">
              Total Amount: ₹{form.TotalAmount}
            </div>
          </div>
          {/* Item Table */}
          <div className="cps-table-wrap">
            <table className="cps-table">
              <thead>
                <tr>
                  <th>Item No</th>
                  <th>Description</th>
                  <th>Quantity</th>
                  <th>Rate</th>
                  <th>Amount</th>
                  <th>Remarks</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => (
                  <tr key={idx}>
                    <td className="cps-table-cell-center">{row.itemNo}</td>
                    <td>
                      <input className="cps-table-input" type="text" value={row.description} onChange={e => handleItemChange(idx, 'description', e.target.value)} />
                    </td>
                    <td>
                      <input
                        className="cps-table-input-sm"
                        type="text"
                        value={row.quantity}
                        onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                        placeholder="0"
                      />
                    </td>
                    <td>
                      <input
                        className="cps-table-input-sm"
                        type="text"
                        value={row.rate}
                        onChange={e => handleItemChange(idx, 'rate', e.target.value)}
                        placeholder="0.00"
                      />
                    </td>
                    <td>
                      <input
                        className="cps-table-input-sm"
                        type="text"
                        value={row.amount}
                        onChange={e => handleItemChange(idx, 'amount', e.target.value)}
                        placeholder="0.00"
                      />
                    </td>
                    <td>
                      <input className="cps-table-input" type="text" value={row.remarks} onChange={e => handleItemChange(idx, 'remarks', e.target.value)} />
                    </td>
                    <td className="cps-table-cell-center">
                      {items.length > 1 && (
                        <button className="cps-remove-btn" type="button" onClick={() => removeItemRow(idx)}>×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="cps-add-row-btn" type="button" onClick={addItemRow}>+ Add Row</button>
          </div>
          <button
            className="cps-submit-btn"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </form>
        {loading && <p className="cps-loading">Submitting...</p>}
       
        {/* ===== SUCCESS POPUP ===== */}
        {showSuccess && successData && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
              borderRadius: '14px',
              padding: '16px',
              width: '460px',
              maxHeight: '70vh',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              border: '2px solid #10b981',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Success Icon */}
              <div style={{
                width: '50px',
                height: '50px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                boxShadow: '0 6px 16px rgba(16, 185, 129, 0.3)'
              }}>
                <span style={{ fontSize: '26px', color: '#fff' }}>✓</span>
              </div>
 
              <h2 style={{
                textAlign: 'center',
                color: '#059669',
                fontSize: '18px',
                fontWeight: '700',
                margin: '0 0 14px 0',
                letterSpacing: '-0.5px'
              }}>Entry Created Successfully</h2>
 
              {/* Gate Entry Number Card */}
              <div style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                borderRadius: '10px',
                padding: '12px',
                marginBottom: '12px',
                boxShadow: '0 3px 10px rgba(37, 99, 235, 0.2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ color: '#dbeafe', fontSize: '10px', fontWeight: '600', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Gate Entry Number</div>
                  <div style={{ color: '#fff', fontSize: '20px', fontWeight: '700', letterSpacing: '1px' }}>{successData.gateEntryNumber}</div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(successData.gateEntryNumber);
                    alert('Gate Entry Number copied!');
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backdropFilter: 'blur(10px)'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                  onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                  title="Copy to clipboard"
                >
                  📋 Copy
                </button>
              </div>
 
              {/* Details Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '8px',
                marginBottom: '12px'
              }}>
                <div style={{ background: '#f9fafb', borderRadius: '6px', padding: '8px' }}>
                  <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: '600', marginBottom: '3px', textTransform: 'uppercase' }}>Approver</div>
                  <div style={{ fontSize: '12px', color: '#111827', fontWeight: '600' }}>{successData.approver}</div>
                </div>
                <div style={{ background: '#f9fafb', borderRadius: '6px', padding: '8px' }}>
                  <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: '600', marginBottom: '3px', textTransform: 'uppercase' }}>Person</div>
                  <div style={{ fontSize: '12px', color: '#111827', fontWeight: '600' }}>{successData.personName}</div>
                </div>
                <div style={{ background: '#f9fafb', borderRadius: '6px', padding: '8px' }}>
                  <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: '600', marginBottom: '3px', textTransform: 'uppercase' }}>Total Amount</div>
                  <div style={{ fontSize: '13px', color: '#059669', fontWeight: '700' }}>₹{successData.totalAmount}</div>
                </div>
                <div style={{ background: '#f9fafb', borderRadius: '6px', padding: '8px' }}>
                  <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: '600', marginBottom: '3px', textTransform: 'uppercase' }}>Transport</div>
                  <div style={{ fontSize: '12px', color: '#111827', fontWeight: '600' }}>{successData.transportMode || 'N/A'}</div>
                </div>
                {successData.vendorName && (
                  <div style={{ background: '#f9fafb', borderRadius: '6px', padding: '8px' }}>
                    <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: '600', marginBottom: '3px', textTransform: 'uppercase' }}>Vendor</div>
                    <div style={{ fontSize: '12px', color: '#111827', fontWeight: '600' }}>{successData.vendorName}</div>
                  </div>
                )}
                {successData.time && (
                  <div style={{ background: '#f9fafb', borderRadius: '6px', padding: '8px' }}>
                    <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: '600', marginBottom: '3px', textTransform: 'uppercase' }}>Date & Time</div>
                    <div style={{ fontSize: '12px', color: '#111827', fontWeight: '600' }}>{successData.time}</div>
                  </div>
                )}
                {/* Items Display */}
                {successData.items && successData.items.length > 0 && successData.items.map((item, idx) => (
                  <React.Fragment key={idx}>
                    <div style={{ background: '#f0f9ff', borderRadius: '6px', padding: '8px', gridColumn: 'span 3', border: '1px solid #bae6fd' }}>
                      <div style={{ fontSize: '9px', color: '#0369a1', fontWeight: '600', marginBottom: '3px', textTransform: 'uppercase' }}>Item #{item.itemNo} - {item.description}</div>
                      <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: '#0c4a6e', fontWeight: '600' }}>
                        <span>Qty: {item.quantity}</span>
                        <span>Rate: ₹{item.rate}</span>
                        <span style={{ color: '#059669', fontWeight: '700' }}>Amt: ₹{item.amount}</span>
                        {item.remarks && <span style={{ color: '#7c3aed' }}>Note: {item.remarks}</span>}
                      </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
 
              {/* Action Button */}
              <button
                onClick={() => {
                  setShowSuccess(false);
                  setForm({
                    ...form,
                    GateEntryNumber: '',
                    SAP_Description: '',
                    Indicators: 'CP',
                    GateEntryDate: '',
                    InwardTime: '',
                    Remarks: '',
                    VendorName: '',
                    DriverPhoneNumber: '',
                    VendorInvoiceNumber: '',
                    CashPurchaseApprover: '',
                    PersonName: '',
                    TotalAmount: '0.00',
                    TransportMode: ''
                  });
                  setItems([{ itemNo: 1, description: '', quantity: '', rate: '', amount: '', remarks: '' }]);
                  setPhoneError('');
                  setError(null);
                }}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #0ced7c 0%, #03262c 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '11px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 3px 10px rgba(8, 243, 125, 0.3)',
                  transition: 'all 0.2s',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
                onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
              >
                OK
              </button>
            </div>
          </div>
        )}
       
        {error && typeof error === 'string' && (
          <div className="cps-error">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    </div>
  );
};
 
export default CashPurchaseScreen;
 
 
 