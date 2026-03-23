import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../../api";
import html2pdf from "html2pdf.js";
import "./StoresConsumableDashboard.css";

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
    if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
      return '⚠️ This entry already exists in the system. Please check the gate entry number.';
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

export default function StoresConsumable() {
  const today = new Date().toISOString().split("T")[0];

  /* ================= HEADER STATE ================= */
  const [header, setHeader] = useState({
    GateEntryNumber: "",
    Indicators: "SC",
    GateEntryDate: today,
    TransporterMode: "Truck",
    VehicleNumber: "",
    TransporterName: "",
    NetWeight: "",
    // Truck Mode fields
    DriverName: "",
    HelperName: "",
    DriverPhoneNumber: "",
    DLNumber: "",
    // Hand Mode fields
    PersonName: "",
    PersonMobile: "",
    HandInvoiceNumber: "",
    HandInvoiceDate: today,
    EWayBill: false,
    PurchaseOrderNumber: "",
    PurchaseOrderNumber2: "",
    PurchaseOrderNumber3: "",
    PurchaseOrderNumber4: "",
    PurchaseOrderNumber5: "",
  });

  /* ================= PO STATE ================= */
  const [poNumber, setPoNumber] = useState("");
  const [poItems, setPoItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("");

  /* ================= PO AUTOCOMPLETE STATE ================= */
  const [allPoNumbers, setAllPoNumbers] = useState([]);
  const [filteredPoNumbers, setFilteredPoNumbers] = useState([]);
  const [showPoDropdown, setShowPoDropdown] = useState(false);

  /* ================= SUCCESS MODAL ================= */
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [printStatus, setPrintStatus] = useState({ type: "", message: "" });
  const [printError, setPrintError] = useState("");

  /* ================= VALIDATION STATES ================= */
  const [phoneError, setPhoneError] = useState("");
  const [personMobileError, setPersonMobileError] = useState("");

  /* ================= FETCH ALL PO NUMBERS ================= */
  useEffect(() => {
    const fetchAllPoNumbers = async () => {
      try {
        const res = await axios.get(`${API_BASE}/all-po-numbers`);
        setAllPoNumbers(res.data.poNumbers || []);
      } catch (error) {
        console.error('Failed to fetch PO numbers:', error);
      }
    };
    fetchAllPoNumbers();
  }, []);

  /* ================= HANDLE PO NUMBER INPUT CHANGE ================= */
  const handlePoNumberChange = (value) => {
    setPoNumber(value);
    
    if (value.trim() === '') {
      setFilteredPoNumbers([]);
      setShowPoDropdown(false);
      return;
    }

    // Filter PO numbers that include the typed value
    const filtered = allPoNumbers.filter(po => 
      po.toLowerCase().includes(value.toLowerCase())
    );
    
    setFilteredPoNumbers(filtered);
    setShowPoDropdown(filtered.length > 0);
  };

  /* ================= SELECT PO FROM DROPDOWN ================= */
  const selectPoNumber = (po) => {
    setPoNumber(po);
    setShowPoDropdown(false);
    setFilteredPoNumbers([]);
  };

  // Update header PO fields whenever poItems changes
  useEffect(() => {
    const uniquePOs = Array.from(new Set(poItems.map(i => i.PurchaseOrderNumber))).slice(0, 5);
    setHeader(prev => ({
      ...prev,
      PurchaseOrderNumber: uniquePOs[0] || "",
      PurchaseOrderNumber2: uniquePOs[1] || "",
      PurchaseOrderNumber3: uniquePOs[2] || "",
      PurchaseOrderNumber4: uniquePOs[3] || "",
      PurchaseOrderNumber5: uniquePOs[4] || "",
    }));
  }, [poItems]);

  /* ================= FETCH PO ================= */
  const fetchPO = async () => {
    setMsg("");
    setShowPoDropdown(false);

    if (!poNumber.trim()) {
      setMsg("Enter PO Number");
      setMsgType("error");
      return;
    }

    // Check unique PO count before fetching
    const uniquePOs = new Set(poItems.map(i => i.PurchaseOrderNumber));
    if (!uniquePOs.has(poNumber) && uniquePOs.size >= 5) {
      setMsg("Only 5 unique POs are allowed per entry.");
      setMsgType("error");
      return;
    }

    try {
      const res = await axios.get(
        `${API_BASE}/po-details?poNumber=${poNumber}`
      );

      // Add PO number to each item for uniqueness
      const newItems = (res.data.items || []).map((i) => ({
        ...i,
        PurchaseOrderNumber: poNumber,
        EnteredQty: i.EnteredQty || "",
        CalculatedRemain: i.RemainQty,
      }));

      // Prevent duplicates: unique by PurchaseOrderNumber + PurchaseOrderItem
      setPoItems((prev) => {
        const existingKeys = new Set(prev.map(i => `${i.PurchaseOrderNumber}__${i.PurchaseOrderItem}`));
        const filteredNew = newItems.filter(i => !existingKeys.has(`${i.PurchaseOrderNumber}__${i.PurchaseOrderItem}`));
        return [...prev, ...filteredNew];
      });

      setHeader((p) => ({ ...p, PurchaseOrderNumber: poNumber }));
      setMsg(`Fetched ${newItems.length} item(s) for PO ${poNumber}`);
      setMsgType("success");
    } catch (err) {
      setMsg(getUserFriendlyError(err));
      setMsgType("error");
    }
  };

  /* ================= NUMBER INPUT VALIDATION ================= */
  const handleNumberInput = (value) => {
    // Remove any non-digit characters and spaces
    return value.replace(/[^0-9]/g, '');
  };

  /* ================= PHONE NUMBER VALIDATION ================= */
  const handlePhoneChange = (value) => {
    const cleaned = handleNumberInput(value);
    if (cleaned.length > 10) {
      setPhoneError("Phone number cannot exceed 10 digits");
      return;
    }
    setPhoneError("");
    setHeader({ ...header, DriverPhoneNumber: cleaned });
  };

  const handlePersonMobileChange = (value) => {
    const cleaned = handleNumberInput(value);
    if (cleaned.length > 10) {
      setPersonMobileError("Mobile number cannot exceed 10 digits");
      return;
    }
    setPersonMobileError("");
    setHeader({ ...header, PersonMobile: cleaned });
  };

  /* ================= RECEIVE QTY ================= */
  // Uniquely update by both PO number and item number
  const onQtyChange = (poNumber, itemNo, value) => {
    const cleanedValue = handleNumberInput(value);
    const qty = Number(cleanedValue || 0);
    setPoItems((prev) =>
      prev.map((i) =>
        i.PurchaseOrderNumber !== poNumber || i.PurchaseOrderItem !== itemNo
          ? i
          : qty < 0 || qty > i.RemainQty
          ? i
          : {
              ...i,
              EnteredQty: cleanedValue,
              CalculatedRemain: i.RemainQty - qty,
            }
      )
    );
  };

  /* ================= REMOVE ITEM ================= */
  const removeItem = (itemNo) => {
    setPoItems((prev) =>
      prev.filter((i) => i.PurchaseOrderItem !== itemNo)
    );
  };

  /* ================= PDF GENERATION ================= */
  const generatePdfBlob = async (data) => {
    const element = document.createElement('div');
    const now = new Date();
    const printDate = now.toLocaleDateString('en-GB');
    const printTime = now.toLocaleTimeString('en-GB');

    // Pre-fetch logo and convert to base64 so html2canvas can embed it reliably
    let logoDataUrl = '';
    try {
      const logoRes = await fetch('/Minera_Logo.jpg');
      const logoBlob = await logoRes.blob();
      logoDataUrl = await new Promise((res) => {
        const r = new FileReader();
        r.onloadend = () => res(r.result);
        r.readAsDataURL(logoBlob);
      });
    } catch (_) {
      // Logo load failed — continue without it
    }

    const getField = (key) => {
      const value = data[key];
      if (value === undefined || value === null || value === '') {
        return '-';
      }
      return value;
    };

    const formatDateValue = (value) => {
      if (!value || value === '-') {
        return '-';
      }

      if (typeof value === 'string' && value.length >= 10 && value.includes('-')) {
        return value.slice(0, 10);
      }

      const parsedDate = new Date(value);
      if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate.toLocaleDateString('en-GB');
      }

      return value;
    };

    const materialRows = (data.items || [])
      .map((row, idx) => `
        <tr>
          <td style="border:1px solid #000; padding:4px; text-align:center;">${idx + 1}</td>
          <td style="border:1px solid #000; padding:4px; text-align:center;">${row.PurchaseOrderItem || '-'}</td>
          <td style="border:1px solid #000; padding:4px; text-align:left;">${row.Material || '-'}</td>
          <td style="border:1px solid #000; padding:4px; text-align:right;">${row.OrderedQty || '-'}</td>
          <td style="border:1px solid #000; padding:4px; text-align:right;">${row.RemainQty || '-'}</td>
          <td style="border:1px solid #000; padding:4px; text-align:right;">${row.EnteredQty || '-'}</td>
          <td style="border:1px solid #000; padding:4px; text-align:left;">${row.VendorInvoiceNumber || '-'}</td>
          <td style="border:1px solid #000; padding:4px; text-align:center;">${formatDateValue(row.VendorInvoiceDate)}</td>
        </tr>
      `).join('');

    const headerRows = [
      ["Gate Entry No:", getField('gateEntry'), "Date:", printDate],
      ["Purchase Order:", getField('po'), "Print Time:", printTime],
      ["Mode of Transport:", getField('transporterMode'), "Vehicle No:", getField('vehicle')],
      ["Transporter Name:", getField('transporter'), "Net Weight:", getField('netWeight')],
      ["Driver Name:", getField('driverName'), "Helper Name:", getField('helperName')],
      ["Driver Phone:", getField('driverPhone'), "DL Number:", getField('dlNumber')],
      ["Person Name:", getField('personName'), "Person Mobile:", getField('personMobile')],
      ["Invoice No:", getField('handInvoiceNumber'), "Invoice Date:", formatDateValue(getField('handInvoiceDate'))],
      ["E-Way Bill:", getField('eWayBill') ? 'Yes' : 'No', "Status:", 'Created'],
    ];

    element.innerHTML = `
      <div style="font-family: Arial, sans-serif; color: #000; background: #fff; width: 100%; max-width: 700px; margin: 0 auto; font-size: 10px;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 4px;">
          <div>
            <div style='font-size: 13px; font-weight: bold;'>Minera Steel & Power Pvt Ltd</div>
            <div style='font-size: 9px;'>Yerabanahalli Village, Sandur Taluk, Ballari Dist, Karnataka - 583115</div>
          </div>
          ${logoDataUrl ? `<img src='${logoDataUrl}' alt='Logo' style='height: 28px; width: auto; margin-left: 8px;'/>` : ''}
        </div>
        <div style="text-align:center; font-size:12px; font-weight:bold; margin-bottom: 4px;">Stores & Consumable Gate Entry Slip</div>
        <table style="width:100%; border-collapse:collapse; margin-bottom: 2px; font-size:9px;">
          ${headerRows.map(row => `
            <tr style="height:18px;">
              <td style="width:110px; text-align:right; font-weight:bold; padding:2px 2px 2px 0;">${row[0]}</td>
              <td style="width:90px; text-align:left; padding:2px 8px 2px 8px;">${row[1]}</td>
              <td style="width:110px; text-align:right; font-weight:bold; padding:2px 2px 2px 0;">${row[2]}</td>
              <td style="width:90px; text-align:left; padding:2px 8px 2px 8px;">${row[3]}</td>
            </tr>
          `).join('')}
        </table>
        <div style="margin-bottom: 2px; font-size:10px;"><b>Material Details</b></div>
        <table style="width:100%; border:1px solid #000; border-collapse:collapse; font-size:8.5px;">
          <thead>
            <tr>
              <th style="border:1px solid #000; padding:4px; text-align:center;">#</th>
              <th style="border:1px solid #000; padding:4px; text-align:center;">Item</th>
              <th style="border:1px solid #000; padding:4px; text-align:left;">Material</th>
              <th style="border:1px solid #000; padding:4px; text-align:right;">Ordered</th>
              <th style="border:1px solid #000; padding:4px; text-align:right;">Remaining</th>
              <th style="border:1px solid #000; padding:4px; text-align:right;">Received</th>
              <th style="border:1px solid #000; padding:4px; text-align:left;">Vendor Invoice No</th>
              <th style="border:1px solid #000; padding:4px; text-align:center;">Vendor Invoice Date</th>
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

    const worker = html2pdf()
      .from(element)
      .set({
        margin: [8, 8, 8, 8],
        filename: `StoresConsumable_${data.gateEntry || 'Slip'}.pdf`,
        html2canvas: { scale: 1.5, useCORS: true },
        jsPDF: { unit: 'mm', format: [210, 148], orientation: 'portrait', compress: true }, // A5 size (half A4)
        pagebreak: { mode: 'avoid-all' }
      });

    return worker.outputPdf("blob");
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const fullDataUrl = String(reader.result || "");
        const base64 = fullDataUrl.includes(",") ? fullDataUrl.split(",")[1] : fullDataUrl;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const printPdfSlip = async (data) => {
    const pdfBlob = await generatePdfBlob(data);
    const pdfBase64 = await blobToBase64(pdfBlob);

    return axios.post(`${API_BASE}/printer/print`, {
      pdfBase64,
      fileName: `StoresConsumable_${data.gateEntry || 'Slip'}.pdf`,
    });
  };

  const handlePrintSlip = async () => {
    if (!successData) return;

    setPrinting(true);
    setPrintStatus({ type: "", message: "" });

    try {
      const response = await printPdfSlip(successData);

      const successMessage = response?.data?.message || "Printed successfully";
      setPrintStatus({ type: "success", message: successMessage });
    } catch (err) {
      const backendError = err?.response?.data?.error || err?.response?.data?.message || "";
      const backendData = err?.response?.data?.data;
      const suffix = backendData ? ` | ${JSON.stringify(backendData)}` : "";
      const exactError = `${backendError || err?.message || "Print failed"}${suffix}`;
      setPrintStatus({ type: "error", message: exactError });
    } finally {
      setPrinting(false);
    }
  };

  const handleRetryPrint = async () => {
    if (!successData) return;
    setPrinting(true);
    setPrintError("");
    try {
      await printPdfSlip(successData);
      setShowSuccess(true);
      setPrintStatus({ type: "success", message: "Printed successfully" });
    } catch (err) {
      const backendError = err?.response?.data?.error || err?.response?.data?.message || "";
      const backendData = err?.response?.data?.data;
      const suffix = backendData ? ` | ${JSON.stringify(backendData)}` : "";
      const exactError = `${backendError || err?.message || "Print failed"}${suffix}`;
      setPrintError(`Entry ${successData.gateEntry} created, but print failed: ${exactError}`);
    } finally {
      setPrinting(false);
    }
  };

  /* ================= SUBMIT ================= */
  const submit = async () => {
    // Mode-specific validations
    if (header.TransporterMode === "Truck") {
      if (!header.VehicleNumber || !header.TransporterName) {
        alert("Vehicle Number & Transporter Name are required for Truck mode");
        return;
      }
      if (header.DriverPhoneNumber && header.DriverPhoneNumber.length !== 10) {
        alert("Driver Phone Number must be exactly 10 digits");
        return;
      }
    } else if (header.TransporterMode === "Hand") {
      if (!header.PersonName) {
        alert("Name of the Person is required for Hand mode");
        return;
      }
      if (header.PersonMobile && header.PersonMobile.length !== 10) {
        alert("Mobile Number must be exactly 10 digits");
        return;
      }
    }

    const usedItems = poItems.filter((i) => Number(i.EnteredQty) > 0);
    if (!usedItems.length) {
      alert("Enter received quantity for at least one item");
      return;
    }

    setLoading(true);
    try {
      // Fetch gate entry number only when creating entry
      const currentYear = new Date().getFullYear();
      // Use full year and correct endpoint for SC
      const gateNumRes = await axios.get(
        `${API_BASE}/next-gatenumber-SC?year=${currentYear}&code=2`
      );

      const newGateEntryNumber = gateNumRes.data.next;

      // Update header with the new gate entry number and map field names for backend
      // Remove TransporterMode and add TransportMode for backend compatibility
      const { TransporterMode, ...headerWithoutMode } = header;
      const updatedHeader = {
        ...headerWithoutMode,
        GateEntryNumber: newGateEntryNumber,
        TransportMode: TransporterMode // Map TransporterMode to TransportMode for backend
      };

      console.log('Sending to backend:', updatedHeader); // Debug log

      const headerRes = await axios.post(
        `${API_BASE}/sc`,
        updatedHeader
      );

      const parentUUID = headerRes.data.SAP_UUID;

      for (const i of usedItems) {
        await axios.post(`${API_BASE}/gateentry/item`, {
          SAP_PARENT_UUID: parentUUID,
          PurchaseOrderNumber: i.PurchaseOrderNumber,
          PurchaseOrderItem: i.PurchaseOrderItem,
          Material: i.Material,
          MaterialDescription: i.MaterialDescription,
          ReceivedQty: i.EnteredQty,
          RemainQty: i.CalculatedRemain,
          VendorInvoiceNumber: i.VendorInvoiceNumber,
          VendorInvoiceDate: i.VendorInvoiceDate,
        });
      }

      const successPayload = {
        gateEntry: newGateEntryNumber,
        po: usedItems.map(i => i.PurchaseOrderNumber).join(', '), // Show all POs
        transporterMode: header.TransporterMode,
        vehicle: updatedHeader.VehicleNumber,
        transporter: updatedHeader.TransporterName,
        netWeight: updatedHeader.NetWeight,
        driverName: updatedHeader.DriverName,
        helperName: updatedHeader.HelperName,
        driverPhone: updatedHeader.DriverPhoneNumber,
        dlNumber: updatedHeader.DLNumber,
        personName: updatedHeader.PersonName,
        personMobile: updatedHeader.PersonMobile,
        handInvoiceNumber: updatedHeader.HandInvoiceNumber,
        handInvoiceDate: updatedHeader.HandInvoiceDate,
        eWayBill: updatedHeader.EWayBill,
        time: new Date().toLocaleString(),
        items: usedItems,
      };

      // Auto-print; show success modal only after confirmed print
      setPrintError("");
      setPrinting(true);
      try {
        await printPdfSlip(successPayload);
        // Print succeeded — now show success modal
        setSuccessData(successPayload);
        setShowSuccess(true);
        setPrintStatus({ type: "success", message: "Printed successfully" });
      } catch (printErr) {
        const backendError = printErr?.response?.data?.error || printErr?.response?.data?.message || "";
        const backendData = printErr?.response?.data?.data;
        const suffix = backendData ? ` | ${JSON.stringify(backendData)}` : "";
        const exactError = `${backendError || printErr?.message || "Print failed"}${suffix}`;
        setSuccessData(successPayload);
        setPrintError(`Entry ${successPayload.gateEntry} created, but print failed: ${exactError}`);
      } finally {
        setPrinting(false);
      }

      setMsg("");
      setMsgType("");
    } catch (err) {
      alert(getUserFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  /* ================= UI ================= */
  return (
    <div className="sc-dashboard-container" onKeyDown={(e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'submit') {
        e.preventDefault();
      }
    }}>
      <h2 className="sc-title">Create Stores & Consumable Entry</h2>

      {/* ===== HEADER ===== */}
      <section className="sc-header-grid">
        <div className="sc-form-group">
          <label>Gate Entry Number</label>
          <input className="sc-readonly-input" value={header.GateEntryNumber} placeholder="Auto-generated on submit" readOnly />
        </div>

        <div className="sc-form-group">
          <label>Indicators</label>
          <input className="sc-readonly-input" value={header.Indicators} readOnly />
        </div>

        <div className="sc-form-group">
          <label>Transporter Mode</label>
          <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
            <select 
              className="sc-input" 
              value={header.TransporterMode}
              onChange={(e) => setHeader({ ...header, TransporterMode: e.target.value })}
              style={{ width: '100%', paddingRight: '35px', appearance: 'none', cursor: 'pointer' }}
            >
              <option value="Truck">Truck</option>
              <option value="Hand">Hand</option>
            </select>
            <span style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: '#555',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>▼</span>
          </div>
        </div>

        {/* Truck Mode Fields */}
        {header.TransporterMode === "Truck" && (
          <>
            <div className="sc-form-group">
              <label>Vehicle Number</label>
              <input className="sc-input" value={header.VehicleNumber}
                onChange={(e) => setHeader({ ...header, VehicleNumber: e.target.value })} />
            </div>

            <div className="sc-form-group">
              <label>Transporter Name</label>
              <input className="sc-input" value={header.TransporterName}
                onChange={(e) => setHeader({ ...header, TransporterName: e.target.value })} />
            </div>

            <div className="sc-form-group">
              <label>Driver Name</label>
              <input className="sc-input" value={header.DriverName}
                onChange={(e) => setHeader({ ...header, DriverName: e.target.value })} />
            </div>

            <div className="sc-form-group">
              <label>Helper Name</label>
              <input className="sc-input" value={header.HelperName}
                onChange={(e) => setHeader({ ...header, HelperName: e.target.value })} />
            </div>

            <div className="sc-form-group">
              <label>Mobile Number</label>
              <input 
                className="sc-input" 
                value={header.DriverPhoneNumber}
                onChange={(e) => handlePhoneChange(e.target.value)}
                maxLength="10"
                placeholder="10 digits only"
              />
              {phoneError && <span style={{ color: 'red', fontSize: '12px', marginTop: '4px', display: 'block' }}>{phoneError}</span>}
            </div>

            <div className="sc-form-group">
              <label>DL Number</label>
              <input className="sc-input" value={header.DLNumber}
                onChange={(e) => setHeader({ ...header, DLNumber: e.target.value })} />
            </div>
          </>
        )}

        {/* Hand Mode Fields */}
        {header.TransporterMode === "Hand" && (
          <>
            <div className="sc-form-group">
              <label>Name of the Person</label>
              <input className="sc-input" value={header.PersonName}
                onChange={(e) => setHeader({ ...header, PersonName: e.target.value })} />
            </div>

            <div className="sc-form-group">
              <label>Mobile Number</label>
              <input 
                className="sc-input" 
                value={header.PersonMobile}
                onChange={(e) => handlePersonMobileChange(e.target.value)}
                maxLength="10"
                placeholder="10 digits only"
              />
              {personMobileError && <span style={{ color: 'red', fontSize: '12px', marginTop: '4px', display: 'block' }}>{personMobileError}</span>}
            </div>

            <div className="sc-form-group">
              <label>Invoice Number</label>
              <input className="sc-input" value={header.HandInvoiceNumber}
                onChange={(e) => setHeader({ ...header, HandInvoiceNumber: e.target.value })} />
            </div>

            <div className="sc-form-group">
              <label>Invoice Date</label>
              <input className="sc-input" type="date" value={header.HandInvoiceDate}
                onChange={(e) => setHeader({ ...header, HandInvoiceDate: e.target.value })} />
            </div>
          </>
        )}

        {/* Common Fields */}
        <div className="sc-form-group">
          <label>Net Weight</label>
          <input className="sc-input" value={header.NetWeight}
            onChange={(e) => setHeader({ ...header, NetWeight: handleNumberInput(e.target.value) })} />
        </div>

        <div className="sc-form-group sc-checkbox-group">
          <label>E-Way Bill</label>
          <input type="checkbox" checked={header.EWayBill}
            onChange={(e) => setHeader({ ...header, EWayBill: e.target.checked })} />
        </div>
      </section>

      {/* ===== PO FETCH ===== */}
      <section className="sc-form-section">
        <div className="sc-dashboard-form">
          <input 
            className="sc-po-input" 
            placeholder="Enter PO Number"
            value={poNumber} 
            onChange={(e) => handlePoNumberChange(e.target.value)}
            onFocus={(e) => {
              if (e.target.value.trim() && filteredPoNumbers.length > 0) {
                setShowPoDropdown(true);
              }
            }}
            onBlur={() => {
              // Delay closing dropdown to allow click event to fire
              setTimeout(() => setShowPoDropdown(false), 200);
            }}
            autoComplete="off"
          />
          <button className="sc-fetch-btn" onClick={fetchPO}>Fetch PO</button>
          
          {/* PO Number Dropdown */}
          {showPoDropdown && filteredPoNumbers.length > 0 && (
            <div className="sc-po-dropdown">
              {filteredPoNumbers.map((po, index) => (
                <div
                  key={index}
                  className="sc-po-dropdown-item"
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur
                    selectPoNumber(po);
                  }}
                >
                  {po}
                </div>
              ))}
            </div>
          )}
        </div>
        {msg && <div className={`sc-dashboard-message ${msgType}`}>{msg}</div>}
      </section>

      {/* ===== PO TABLE ===== */}
      <table className="sc-dashboard-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Material</th>
            <th>Ordered</th>
            <th>Remaining</th>
            <th>Receive Qty</th>
            <th>Vendor Invoice Number</th>
            <th>Vendor Invoice Date</th>
            <th>Remove</th>
          </tr>
        </thead>
        <tbody>
          {poItems.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ textAlign: "center" }}>No PO Items</td>
            </tr>
          ) : (
            // Group items by PO number
            Object.entries(
              poItems.reduce((acc, item) => {
                const po = item.PurchaseOrderNumber || "";
                if (!acc[po]) acc[po] = [];
                acc[po].push(item);
                return acc;
              }, {})
            ).map(([po, items]) => [
              <tr key={po} className="sc-po-header-row">
                <td colSpan="8" style={{ fontWeight: 'bold', background: '#f5f5f5' }}>PO: {po}</td>
              </tr>,
              ...items.map((i, idx) => (
                <tr key={po + '_' + i.PurchaseOrderItem}>
                  <td>{i.PurchaseOrderItem}</td>
                  <td>{i.Material}</td>
                  <td>{i.OrderedQty}</td>
                  <td>{i.RemainQty}</td>
                  <td>
                    <input 
                      className="sc-qty-input" 
                      type="text" 
                      value={i.EnteredQty}
                      onChange={(e) => onQtyChange(po, i.PurchaseOrderItem, e.target.value)}
                      placeholder="0"
                    />
                  </td>
                  <td>
                    <input
                      className="sc-input"
                      type="text"
                      value={i.VendorInvoiceNumber || ''}
                      onChange={e => {
                        const value = e.target.value;
                        setPoItems(prev => prev.map((item) =>
                          item.PurchaseOrderNumber === po && item.PurchaseOrderItem === i.PurchaseOrderItem
                            ? { ...item, VendorInvoiceNumber: value }
                            : item
                        ));
                      }}
                      placeholder="Invoice No"
                    />
                  </td>
                  <td>
                    <input
                      className="sc-input"
                      type="date"
                      value={i.VendorInvoiceDate ? i.VendorInvoiceDate.slice(0, 10) : ''}
                      onChange={e => {
                        const value = e.target.value;
                        setPoItems(prev => prev.map((item) =>
                          item.PurchaseOrderNumber === po && item.PurchaseOrderItem === i.PurchaseOrderItem
                            ? { ...item, VendorInvoiceDate: value }
                            : item
                        ));
                      }}
                    />
                  </td>
                  <td>
                    <button className="sc-remove-btn"
                      onClick={() => removeItem(i.PurchaseOrderItem)}>✖</button>
                  </td>
                </tr>
              ))
            ])
          )}
        </tbody>
      </table>

      {/* ===== SUBMIT ===== */}
      <div className="sc-form-actions">
        <button className="sc-primary-btn" disabled={loading || printing} onClick={submit}>
          {loading ? (printing ? "Printing..." : "Creating...") : "Create Entry"}
        </button>
      </div>

      {/* ===== PRINT ERROR ===== */}
      {printError && (
        <div style={{ margin: '16px 0', padding: '12px 16px', borderRadius: '8px', background: '#fdecec', color: '#8b1a1a', border: '1px solid #f5c2c7', fontSize: '0.9rem' }}>
          <div>{printError}</div>
          <button
            className="sc-primary-btn"
            style={{ marginTop: '10px' }}
            onClick={handleRetryPrint}
            disabled={printing}
          >
            {printing ? "Retrying..." : "Retry Print"}
          </button>
        </div>
      )}

      {/* ===== SUCCESS POPUP ===== */}
      {showSuccess && (
        <div className="sc-success-overlay">
          <div className="sc-success-modal">
            {/* Success Icon */}
            <div className="sc-success-icon"></div>

            <h2 className="sc-modal-title">Entry Created Successfully</h2>

            {/* Gate Entry Number Card */}
            <div className="sc-gate-entry-row">
              <p>
                <b>Gate Entry Number</b>
                <span>{successData.gateEntry}</span>
              </p>
              <button 
                className="sc-copy-btn"
                onClick={() => {
                  navigator.clipboard.writeText(successData.gateEntry);
                  alert('Gate Entry Number copied!');
                }}
                title="Copy Gate Entry Number"
              >
                📋 Copy
              </button>
            </div>

            {/* Details Grid */}
            <div className="sc-details-grid">
              <div className="sc-detail-card">
                <b>Purchase Order</b>
                <span>{successData.po}</span>
              </div>
              <div className="sc-detail-card">
                <b>Vehicle Number</b>
                <span>{successData.vehicle}</span>
              </div>
              <div className="sc-detail-card" style={{ gridColumn: 'span 3' }}>
                <b>Date & Time</b>
                <span>{successData.time}</span>
              </div>
            </div>

            {/* Items */}
                    {/* Material summary removed as per requirement */}

            {printStatus.message && (
              <div
                style={{
                  margin: '10px 0',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  background: printStatus.type === 'success' ? '#e7f7ed' : '#fdecec',
                  color: printStatus.type === 'success' ? '#0f5132' : '#8b1a1a',
                  border: `1px solid ${printStatus.type === 'success' ? '#b7ebc6' : '#f5c2c7'}`,
                }}
              >
                {printStatus.message}
              </div>
            )}

            <button
              className="sc-primary-btn"
              type="button"
              onClick={handlePrintSlip}
              disabled={printing}
            >
              {printing ? "Printing..." : "Print"}
            </button>

            <button
              className="sc-primary-btn"
              type="button"
              onClick={() => {
                setShowSuccess(false);
                const currentDate = new Date().toISOString().split("T")[0];
                setHeader({
                  GateEntryNumber: "",
                  Indicators: "SC",
                  GateEntryDate: currentDate,
                  TransporterMode: "Truck",
                  VehicleNumber: "",
                  TransporterName: "",
                  NetWeight: "",
                  DriverName: "",
                  HelperName: "",
                  DriverPhoneNumber: "",
                  DLNumber: "",
                  PersonName: "",
                  PersonMobile: "",
                  HandInvoiceNumber: "",
                  HandInvoiceDate: currentDate,
                  EWayBill: false,
                  PurchaseOrderNumber: "",
                });
                setPoNumber("");
                setPoItems([]);
                setMsg("");
                setMsgType("");
                setPhoneError("");
                setPersonMobileError("");
                setPrintStatus({ type: "", message: "" });
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}