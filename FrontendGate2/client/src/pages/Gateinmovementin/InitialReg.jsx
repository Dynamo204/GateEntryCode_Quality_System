import React, { useState, useEffect, useRef } from "react";
import { initialRegistration, fetchInitialRegistrations, updateInitialRegistration, fetchSalesOrderSuggestions, checkVehicleStatus, transporterDetails, sendinitialusermail, fetchsodetails } from "../../api";
import { useLocation } from "react-router-dom";
import "./InitialReg.css";
 
const normalizeSoSuggestions = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }
 
  if (Array.isArray(payload?.items) && payload.items.length > 0) {
    return payload.items;
  }
 
  if (Array.isArray(payload?.headers) && payload.headers.length > 0) {
    return payload.headers;
  }
 
  return [];
};
 
const getSoBalanceQty = (salesOrder = {}) => (
  salesOrder.OpenReqdDelivQtyInOrdQtyUnit
  ?? salesOrder.OpenReqdDelivQtyInBaseUnit
  ?? salesOrder.BalanceQty
  ?? salesOrder.items?.[0]?.OpenReqdDelivQtyInOrdQtyUnit
  ?? salesOrder.items?.[0]?.OpenReqdDelivQtyInBaseUnit
  ?? salesOrder.items?.[0]?.BalanceQty
  ?? salesOrder.headers?.[0]?.OpenReqdDelivQtyInOrdQtyUnit
  ?? salesOrder.headers?.[0]?.OpenReqdDelivQtyInBaseUnit
  ?? salesOrder.headers?.[0]?.BalanceQty
  ?? ""
);
 
export default function InitialRegistration() {
  // RemainingQty state
  const [remainingQty, setRemainingQty] = useState(null);
  // Track available qty for validation
  const [availableQty, setAvailableQty] = useState(null);
  const location = useLocation();
 
  // Always initialize all fields as string or number (never undefined/null)
  const initialFormState = {
    RegistrationNumber: "",
    Indicators: "IR",
    SalesDocument2: "",
    Material: "",
    Customer: "",
    ExpectedQty: "",
    VehicleNumber: "",
    Transporter: "",
    SAP_Description: ""
  };
 
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
 
  // View state management
  const [currentView, setCurrentView] = useState("registration"); // "registration", "cancelTrip", "registeredList", "cancelledList"
 
  // Cancel Trip state
  const [cancelTripRegNum, setCancelTripRegNum] = useState("");
  const [cancellingTrip, setCancellingTrip] = useState(false);
 
  // List state
  const [showList, setShowList] = useState(false);
  const [rows, setRows] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [search, setSearch] = useState("");
  const [count, setCount] = useState(null);
 
  // SO Suggestion state
  const [soSuggestions, setSoSuggestions] = useState([]);
  const [showSoSuggestions, setShowSoSuggestions] = useState(false);
  const soInputRef = useRef();
 
  // Transporter autocomplete state
  const [transporterSuggestions, setTransporterSuggestions] = useState([]);
  const [showTransporterSuggestions, setShowTransporterSuggestions] = useState(false);
  const transporterInputRef = useRef();
 
  // Fetch transporter suggestions as user types
  useEffect(() => {
    const fetchTransporterSuggestions = async () => {
      const val = (formData.Transporter || '').trim().toLowerCase();
      if (val.length < 2) {
        setTransporterSuggestions([]);
        setShowTransporterSuggestions(false);
        return;
      }
      try {
        const res = await transporterDetails(val);
        console.log('Transporter suggestions response:', res.data);
        let suggestions = [];
        if (Array.isArray(res.data)) {
          suggestions = res.data;
        } else if (Array.isArray(res.data?.results)) {
          suggestions = res.data.results;
        } else if (Array.isArray(res.data?.items)) {
          suggestions = res.data.items;
        } else if (Array.isArray(res.data?.headers)) {
          suggestions = res.data.headers;
        }
        // Filter on frontend for strictness
        console.log('Raw transporter suggestions:', suggestions);
        const filtered = suggestions.filter(t =>
          (t.TransporterName || '').toLowerCase().includes(val) ||
          (t.TransporterCode || '').toLowerCase().includes(val) ||
          (t.Transporter || '').toLowerCase().includes(val)
        );
        // Deduplicate by name+code
        const unique = [];
        const seen = new Set();
        for (const t of filtered) {
          const key = (t.TransporterName || '') + (t.TransporterCode || '');
          if (!seen.has(key)) {
            unique.push(t);
            seen.add(key);
          }
        }
        setTransporterSuggestions(unique);
        setShowTransporterSuggestions(true);
      } catch (error) {
        setTransporterSuggestions([]);
        setShowTransporterSuggestions(false);
      }
    };
    fetchTransporterSuggestions();
  }, [formData.Transporter]);
 
  // Hide transporter suggestions on outside click
  useEffect(() => {
    function handleClick(e) {
      if (transporterInputRef.current && !transporterInputRef.current.contains(e.target)) {
        setShowTransporterSuggestions(false);
      }
    }
    if (showTransporterSuggestions) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [showTransporterSuggestions]);
 
  // When a transporter is selected from suggestions
  const handleSelectTransporter = (transporter) => {
    setFormData(prev => ({
      ...prev,
      Transporter: transporter.TransporterName || transporter.TransporterCode || transporter.Transporter || '',
      TransporterCode: transporter.TransporterCode || '',
      TransporterEmail: transporter.Email || transporter.TransporterEmail || '',
    }));
    setShowTransporterSuggestions(false);
  };
  // SO suggestion effect (fixed async/await usage)
  useEffect(() => {
    const fetchSOData = async () => {
      const val = (formData.SalesDocument2 || "").trim();
      if (val.length < 2) {
        setSoSuggestions([]);
        setShowSoSuggestions(false);
        setRemainingQty(null);
        setAvailableQty(null);
        return;
      }
      try {
        // Fetch SO suggestions
        const res = await fetchsodetails(val);
        console.log('Fetch SO details response:', res.data);
        const suggestions = normalizeSoSuggestions(res.data);
        const updatedSuggestions = suggestions.map((s) => {
          const balanceQty = getSoBalanceQty(s);
          return {
            ...s,
            RemainingQty: balanceQty
          };
        });
        setSoSuggestions(updatedSuggestions);
        // For the currently selected SO, set available qty
        if (formData.SalesDocument2 === val && updatedSuggestions.length > 0) {
          const currentSO = updatedSuggestions.find(s =>
            (s.SalesDocument2 || s.SalesOrder || s.SalesDocument) === val
          );
          if (currentSO) {
            const available = currentSO.RemainingQty !== undefined
              ? currentSO.RemainingQty
              : getSoBalanceQty(currentSO);
            setAvailableQty(available);
            setRemainingQty(available);
          }
        }
        setShowSoSuggestions(true);
      } catch (error) {
        console.error("Error fetching SO suggestions:", error);
        setSoSuggestions([]);
      }
    };
    fetchSOData();
  }, [formData.SalesDocument2]);
 
  // Hide suggestions on outside click
  useEffect(() => {
    function handleClick(e) {
      if (soInputRef.current && !soInputRef.current.contains(e.target)) {
        setShowSoSuggestions(false);
      }
    }
    if (showSoSuggestions) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showSoSuggestions]);
 
  // Handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    // If transporter is changed, clear TransporterEmail
    if (name === 'Transporter') {
      setFormData(prev => ({
        ...prev,
        [name]: value === undefined || value === null ? '' : value,
        TransporterEmail: ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value === undefined || value === null ? '' : value
      }));
    }
  };
 
  // Separate validation and submission function
  const validateAndSubmit = async (e) => {
    // Validate expected quantity
    const expectedQtyNum = parseFloat(formData.ExpectedQty);
    if (isNaN(expectedQtyNum) || expectedQtyNum <= 0) {
      alert("Expected Quantity must be a positive number");
      return;
    }
 
    // Validate against available quantity
    if (availableQty !== null && availableQty <= 0) {
      alert("Registration not allowed: SO is fully registered (Remaining Qty is zero)");
      return;
    }
 
    if (formData.ExpectedQty && availableQty !== null && expectedQtyNum > Number(availableQty)) {
      alert(`Expected Quantity (${expectedQtyNum}) cannot exceed available quantity (${availableQty})`);
      return;
    }
 
    // Proceed with actual submission
    await performRegistration(e);
  };
 
  const performRegistration = async (e) => {
    setSubmitting(true);
    setSuccessMsg("");
   
    try {
      // Format ExpectedQty properly for SAP - try different approaches
      const expectedQtyValue = parseFloat(formData.ExpectedQty) || 0;
     
      // Create payload with proper formatting
      // NOTE: RegistrationNumber is auto-generated on the backend, don't send it from frontend
      const payload = {
        Indicators: formData.Indicators || "IR",
        SalesDocument2: formData.SalesDocument2 || "",
        VehicleNumber: formData.VehicleNumber || "",
        Transporter: formData.Transporter || "",
        SAP_Description: formData.SAP_Description || "",
        Status: "01",
        // Try sending as string with 2 decimal places first (most common SAP requirement)
        ExpectedQty: expectedQtyValue.toFixed(2),
        Customer: formData.Customer || "",
        Material: formData.Material || ""
      };
     
      console.log("Submitting registration payload:", payload);
      console.log("JSON payload:", JSON.stringify(payload));
     
      const res = await initialRegistration(payload);
     
      // Get generated fields from backend response
      const salesDocNum = res?.data?.SalesDocument ||
                         res?.data?.d?.SalesDocument ||
                         "N/A";
      const regNumber = res?.data?.RegistrationNumber ||
                       res?.data?.registrationNumber ||
                       res?.data?.d?.RegistrationNumber ||
                       "N/A";
     
      // Parse to remove leading zeros for display
      const displaySalesDoc = salesDocNum === "N/A" ? "N/A" : String(parseInt(salesDocNum, 10));
      const displayRegNum = regNumber === "N/A" ? "N/A" : String(parseInt(regNumber, 10));
     
      setSuccessMsg(`✅ Initial Registration Successful!\n` +
                    `S.NO: ${displaySalesDoc}\n` +
                    `Sales Order: ${formData.SalesDocument2}\n` +
                    `Vehicle: ${formData.VehicleNumber}\n` +
                    `Registration Number: ${displayRegNum}\n` +
                    `Quantity: ${formData.ExpectedQty}`);
 
      // Send mail to transporter (if email present)
      if (formData.TransporterEmail) {
        try {
          await sendinitialusermail({
            registrationNumber: regNumber,
            vehicleNumber: formData.VehicleNumber,
            grossWeight: formData.ExpectedQty,
            transporterNumber: formData.Transporter,
            date: new Date().toLocaleDateString(),
            transporterEmail: formData.TransporterEmail
          });
        } catch (mailErr) {
          console.error('Failed to send registration email:', mailErr);
        }
      }
 
      // Reset form but keep SO for multiple entries
      setFormData({
        ...initialFormState,
        SalesDocument2: formData.SalesDocument2, // Keep SO number
        ExpectedQty: "" // Clear for manual entry
      });
 
      setRemainingQty(null);
      setAvailableQty(null);
 
      // Refresh list if shown
      if (showList) {
        loadList({ search });
      }
     
    } catch (error) {
      console.error("Registration error details:", error);
      console.error("Error response:", error.response?.data);
     
      // Check for specific ExpectedQty error
      if (error.response?.data?.error?.message?.value?.includes("ExpectedQty") ||
          error.response?.data?.error?.message?.value?.includes("property 'ExpectedQty'")) {
        // Try alternative payload format
        const shouldRetry = window.confirm(
          `SAP Field Error: ${error.response.data.error.message.value}\n\n` +
          "Try sending with different format?"
        );
       
        if (shouldRetry) {
          await retryWithAlternativeFormat();
          return;
        }
      }
     
      const errorMsg = error?.response?.data?.error?.message?.value ||
                      error?.response?.data?.error?.message ||
                      error?.response?.data?.message ||
                      error.message ||
                      "Registration failed. Please check the data and try again.";
      alert(`Registration Failed: ${errorMsg}`);
    } finally {
      setSubmitting(false);
    }
  };
 
  const retryWithAlternativeFormat = async () => {
    try {
      const expectedQtyValue = parseFloat(formData.ExpectedQty) || 0;
     
      // Try alternative 1: Send as number without formatting
      const payload1 = {
        Indicators: formData.Indicators || "IR",
        SalesDocument2: formData.SalesDocument2 || "",
        VehicleNumber: formData.VehicleNumber || "",
        Transporter: formData.Transporter || "",
        SAP_Description: formData.SAP_Description || "",
        Status: "01",
        ExpectedQty: expectedQtyValue // Send as raw number
      };
     
      console.log("Retry with alternative payload 1:", payload1);
     
      const res = await initialRegistration(payload1);
     
      // Get generated fields from backend response
      const salesDocNum = res?.data?.SalesDocument ||
                         res?.data?.d?.SalesDocument ||
                         "N/A";
      const regNumber = res?.data?.RegistrationNumber ||
                       res?.data?.registrationNumber ||
                       res?.data?.d?.RegistrationNumber ||
                       "N/A";
     
      // Parse to remove leading zeros for display
      const displaySalesDoc = salesDocNum === "N/A" ? "N/A" : String(parseInt(salesDocNum, 10));
      const displayRegNum = regNumber === "N/A" ? "N/A" : String(parseInt(regNumber, 10));
     
      setSuccessMsg(`✅ Initial Registration Successful! (Retry)\n` +
                    `S.NO: ${displaySalesDoc}\n` +
                    `Sales Order: ${formData.SalesDocument2}\n` +
                    `Vehicle: ${formData.VehicleNumber}\n` +
                    `Registration Number: ${displayRegNum}\n` +
                    `Quantity: ${formData.ExpectedQty}`);
     
      // Reset form
      setFormData({
        ...initialFormState,
        SalesDocument2: formData.SalesDocument2,
        ExpectedQty: ""
      });
     
      setRemainingQty(null);
      setAvailableQty(null);
     
    } catch (retryError) {
      console.error("Retry also failed:", retryError);
      alert(`Retry also failed: ${retryError.response?.data?.error?.message?.value || retryError.message}`);
    }
  };
 
  const handleInitialRegistration = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
   
    const vehicleNumber = formData.VehicleNumber?.trim();
    if (!vehicleNumber || vehicleNumber === "") {
      alert("Please enter a Vehicle Number.");
      return;
    }
 
    try {
      console.log("Checking vehicle status for:", vehicleNumber);
     
      // First, check if vehicle exists and is IN
      const resp = await checkVehicleStatus(vehicleNumber);
      console.log("Vehicle status response:", resp.data);
     
      // Check different response formats
      let isVehicleIn = false;
     
      // If response is an array
      if (Array.isArray(resp.data)) {
        isVehicleIn = resp.data.some(vehicle =>
          (vehicle.VehicleStatus || "").toUpperCase() === "IN"
        );
      }
      // If response is object with results array
      else if (resp.data?.results && Array.isArray(resp.data.results)) {
        isVehicleIn = resp.data.results.some(vehicle =>
          (vehicle.VehicleStatus || "").toUpperCase() === "IN"
        );
      }
      // If response is object with d.results (OData format)
      else if (resp.data?.d?.results && Array.isArray(resp.data.d.results)) {
        isVehicleIn = resp.data.d.results.some(vehicle =>
          (vehicle.VehicleStatus || "").toUpperCase() === "IN"
        );
      }
      // If response is a single vehicle object
      else if (resp.data?.VehicleStatus) {
        isVehicleIn = resp.data.VehicleStatus.toUpperCase() === "IN";
      }
     
      console.log("Is vehicle IN?", isVehicleIn);
     
      if (isVehicleIn) {
        alert(`Vehicle ${vehicleNumber} is currently INSIDE the premises.
               Please complete departure before new registration.`);
        return;
      }
     
      console.log("Vehicle is OUT or not found, proceeding with validation...");
     
      // Proceed with validation and registration
      await validateAndSubmit(e);
     
    } catch (error) {
      console.error("Vehicle status check error:", error);
     
      // If 404 (vehicle not found), that's OK - proceed
      if (error.response?.status === 404) {
        console.log("Vehicle not found (404), proceeding with registration");
        await validateAndSubmit(e);
        return;
      }
     
      // For other errors, ask user
      const proceed = window.confirm(
        `Unable to verify vehicle status (${error.message}).\n\n` +
        "Vehicle might already be inside.\n" +
        "Do you want to proceed anyway?"
      );
     
      if (proceed) {
        await validateAndSubmit(e);
      }
    }
  };
 
  const handleSubmit = async (e) => {
    e.preventDefault();
   
    // Call the vehicle check first
    await handleInitialRegistration(e);
  };
 
  const loadList = async ({ search: s = "", statusFilter = "01" } = {}) => {
    setListLoading(true);
    setListError("");
    try {
      const { data } = await fetchInitialRegistrations({
        top: 250,
        search: s,
        count: true,
        orderby: 'SAP_CreatedDateTime desc' // Request sorted data from backend
      });
      let results = data?.d?.results || [];
     
      // Filter by status
      results = results.filter(r => r.Status === statusFilter);
     
      // Sort by SAP_CreatedDateTime in descending order (most recent first)
      results = results.sort((a, b) => {
        // Parse SAP date format: /Date(1769691210442+0000)/
        const parseDate = (sapDate) => {
          if (!sapDate) return 0;
          const match = sapDate.match(/\/Date\((\d+)([+-]\d+)?\)\//);
          return match ? parseInt(match[1]) : 0;
        };
       
        const timeA = parseDate(a.SAP_CreatedDateTime);
        const timeB = parseDate(b.SAP_CreatedDateTime);
       
        // Sort by timestamp descending (newest first)
        if (timeB !== timeA) {
          return timeB - timeA;
        }
       
        // Fallback to SalesDocument (S.NO) if dates are same or missing
        const salesDocA = parseInt(a.SalesDocument) || 0;
        const salesDocB = parseInt(b.SalesDocument) || 0;
        return salesDocB - salesDocA;
      });
     
      console.log('[DBG] Fetched registrations:', results.length);
      console.log('[DBG] First 5 entries (newest first):',
        results.slice(0, 5).map(r => `S.NO: ${r.SalesDocument}, SO: ${r.SalesDocument2} (${r.SAP_CreatedDateTime})`).join(', '));
      setRows(results);
      setCount(data?.d?.__count ?? results.length);
    } catch (e) {
      console.error('[DBG] Load list error:', e);
      setListError(e?.response?.data?.error || e.message || "Failed to load registrations");
    } finally {
      setListLoading(false);
    }
  };
 
  const toggleList = () => {
    const next = !showList;
    setShowList(next);
    if (next) {
      loadList({ search, statusFilter: "01" });
    }
  };
 
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const statusFilter = currentView === "registeredList" ? "01" : "02";
    loadList({ search, statusFilter });
  };
 
  const handleReset = () => {
    setSearch("");
    const statusFilter = currentView === "registeredList" ? "01" : "02";
    loadList({ search: "", statusFilter });
  };
 
  // Handle Cancel Trip submission
  const handleCancelTrip = async (e) => {
    e.preventDefault();
   
    if (!cancelTripRegNum.trim()) {
      alert("Please enter a Registration Number");
      return;
    }
 
    setCancellingTrip(true);
   
    try {
      // Find the registration by Registration Number
      const { data } = await fetchInitialRegistrations({
        top: 100,
        search: cancelTripRegNum.trim()
      });
     
      const results = data?.d?.results || [];
     
      // Find matching registration (parse both sides to handle zero-padding)
      const registration = results.find(r => {
        const regNum = r.RegistrationNumber ? String(parseInt(r.RegistrationNumber, 10)) : "";
        const searchNum = String(parseInt(cancelTripRegNum.trim(), 10));
        return regNum === searchNum;
      });
     
      if (!registration) {
        alert(`No registration found with Registration Number: ${cancelTripRegNum}`);
        return;
      }
     
      if (registration.Status === "02") {
        alert("This trip is already cancelled");
        return;
      }
     
      // Update status to cancelled
      await updateInitialRegistration(registration.SAP_UUID, {
        Status: "02"
      });
     
      setSuccessMsg(`✅ Trip Cancelled Successfully!\nRegistration Number: ${cancelTripRegNum}\nVehicle: ${registration.VehicleNumber || 'N/A'}`);
     
      // Reset form
      setCancelTripRegNum("");
     
      // Switch back to registration view after 2 seconds
      setTimeout(() => {
        setCurrentView("registration");
        setSuccessMsg("");
      }, 2000);
     
    } catch (error) {
      console.error("Cancel trip error:", error);
      alert(`Failed to cancel trip: ${error?.response?.data?.error?.message?.value || error.message}`);
    } finally {
      setCancellingTrip(false);
    }
  };
 
  // Handler to cancel/update a registration to "Failed"
  const handleCancelRegistration = async (uuid, currentStatus) => {
    if (!uuid) {
      alert("Cannot update: missing UUID");
      return;
    }
    if (currentStatus === "02" || currentStatus === "Failed") {
      alert("This registration is already marked as Failed");
      return;
    }
    if (!window.confirm("Mark this registration as Failed?")) return;
    try {
      await updateInitialRegistration(uuid, { Status: "02" });
      alert("Registration marked as Failed");
      const statusFilter = currentView === "registeredList" ? "01" : "02";
      loadList({ search, statusFilter });
    } catch (e) {
      console.error("Cancel error:", e);
      alert("Failed to update status: " + (e?.response?.data?.error || e.message));
    }
  };
 
  return (
    <div className="create-header-container initial-reg-wrapper">
      {!showList && <h2 className="initial-reg-title">Initial Registration</h2>}
      {successMsg && (
        <div className="success-message" style={{marginBottom: 16, background: '#e6ffed', color: '#256029', padding: 12, borderRadius: 6, fontWeight: 500}}>
          {successMsg.split('\n').map((line, idx) => {
            // Highlight Registration Number line with colorful styling
            if (line.includes('Registration Number:')) {
              const parts = line.split(':');
              const regNum = parts[1]?.trim();
              return (
                <div key={idx} style={{ fontSize: '1.1em', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, color: '#000' }}>{parts[0]}:</span>
                  <span style={{
                    color: '#2563eb',
                    fontWeight: 700,
                    marginLeft: 6,
                    fontSize: '1.15em',
                    textShadow: '0 0 10px rgba(37, 99, 235, 0.3)'
                  }}>
                    {regNum}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(regNum);
                      const btn = document.getElementById('copy-reg-btn');
                      if (btn) {
                        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                        setTimeout(() => {
                          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
                        }, 1500);
                      }
                    }}
                    id="copy-reg-btn"
                    style={{
                      background: 'transparent',
                      color: '#2563eb',
                      border: '1px solid #2563eb',
                      borderRadius: 4,
                      padding: '6px 8px',
                      fontSize: '0.9em',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onMouseOver={(e) => {
                      e.target.style.background = '#eff6ff';
                      e.target.style.borderColor = '#1d4ed8';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.background = 'transparent';
                      e.target.style.borderColor = '#2563eb';
                    }}
                    title="Copy to clipboard"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
              );
            }
            return <div key={idx}>{line}</div>;
          })}
        </div>
      )}
     
      {/* Registration Form */}
      {currentView === "registration" && (
      <form onSubmit={handleSubmit} className="create-header-form">
        {/* Fields Section */}
        <div className="form-fields-section">
          <div className="form-row-4col">
            <div className="form-group" ref={soInputRef} style={{ position: "relative" }}>
              <label>Sales Order (SO Number)</label>
              <input
                type="text"
                name="SalesDocument2"
                value={formData.SalesDocument2 || ""}
                onChange={handleChange}
                autoComplete="off"
                required
                placeholder="Enter SO number"
                onFocus={() => {
                  if (formData.SalesDocument2?.length >= 2) {
                    setShowSoSuggestions(true);
                  }
                }}
              />
              {availableQty !== null && (
                <div style={{
                  marginTop: 4,
                  fontSize: "0.9em",
                  color: availableQty > 0 ? "#256029" : "#c10000",
                  fontWeight: 500
                }}>
                  Available Quantity: {availableQty}
                  {availableQty <= 0 && " (SO fully consumed)"}
                </div>
              )}
              {showSoSuggestions && soSuggestions.length > 0 && (
                <ul className="so-suggestion-list">
                  {soSuggestions.map((s, i) => {
                    const firstItem = s.items?.[0] || {};
                    const soNumber = s.SalesDocument2 || s.SalesOrder || s.SalesDocument || "N/A";
                    const customer = s.Customer || firstItem.Customer || "";
                    const customerName = s.CustomerName || firstItem.CustomerName || "";
                    const material = s.Material || s.Product || firstItem.Material || firstItem.Product || "";
                    const materialDesc = s.MaterialDescription || s.ProductDescription || firstItem.MaterialDescription || firstItem.ProductDescription || firstItem.SalesDocumentItemText || "";
                    const itemNumber = s.SalesDocumentItem || firstItem.SalesDocumentItem || "";
                    const itemText = s.SalesDocumentItemText || firstItem.SalesDocumentItemText || materialDesc;
                    const orderQty = s.OrderQuantity || firstItem.OrderQuantity || "";
                    const orderUnit = s.OrderQuantityUnit || firstItem.OrderQuantityUnit || firstItem.BaseUnit || "";
                    const balanceQty = s.RemainingQty !== undefined ? s.RemainingQty : getSoBalanceQty(s);
                    return (
                      <li
                        key={soNumber + "_" + i}
                        onClick={() => {
                          setFormData(f => ({
                            ...f,
                            SalesDocument2: soNumber,
                            Customer: customer,
                            CustomerName: customerName,
                            Material: material,
                            MaterialDescription: materialDesc,
                            BalanceQty: balanceQty
                          }));
                          setShowSoSuggestions(false);
                          setAvailableQty(balanceQty);
                          setRemainingQty(balanceQty);
                        }}
                      >
                        <div className="so-suggestion-card">
                          <div className="so-suggestion-title">Sales Order: {soNumber}</div>
                          <div className="so-suggestion-meta">
                            {itemNumber && <span>Item: {itemNumber}</span>}
                            {customer && <span>Customer: {customer}</span>}
                            {customerName && <span>Name: {customerName}</span>}
                          </div>
                          <div className="so-suggestion-meta">
                            {material && <span>Material: {material}</span>}
                            {itemText && <span>Description: {itemText}</span>}
                          </div>
                          <div className="so-suggestion-meta">
                            {orderQty && <span>Order Qty: {orderQty}{orderUnit ? ` ${orderUnit}` : ""}</span>}
                            {balanceQty !== undefined && balanceQty !== "" && <span>Balance Qty: {balanceQty}{orderUnit ? ` ${orderUnit}` : ""}</span>}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="form-group">
              <label>Expected Quantity</label>
              <input
                type="number"
                name="ExpectedQty"
                value={formData.ExpectedQty || ""}
                onChange={handleChange}
                required
                step="0.01"
                min="0.01"
                max={availableQty || undefined}
                placeholder={availableQty ? `Max: ${availableQty}` : "Enter quantity"}
              />
              {formData.ExpectedQty && (
                <div style={{ marginTop: 4 }}>
                  {Number(formData.ExpectedQty) <= 0 ? (
                    <span style={{ color: 'red', fontWeight: 500 }}>
                      ❌ Quantity must be greater than 0
                    </span>
                  ) : availableQty !== null && Number(formData.ExpectedQty) > availableQty ? (
                    <span style={{ color: 'red', fontWeight: 500 }}>
                      ❌ Cannot exceed available quantity ({availableQty})
                    </span>
                  ) : availableQty !== null ? (
                    <span style={{ color: '#256029', fontWeight: 500 }}>
                      ✓ Within available limit
                    </span>
                  ) : null}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Vehicle Number</label>
              <input
                type="text"
                name="VehicleNumber"
                value={formData.VehicleNumber || ""}
                onChange={handleChange}
                required
                placeholder="e.g. MH12AB1234"
              />
            </div>
            <div className="form-group" ref={transporterInputRef} style={{ position: "relative" }}>
              <label>Transporter</label>
              <input
                type="text"
                name="Transporter"
                value={formData.Transporter || ""}
                onChange={handleChange}
                required
                autoComplete="off"
                placeholder="Enter transporter name/code"
                onFocus={() => {
                  if ((formData.Transporter || "").length >= 2) {
                    setShowTransporterSuggestions(true);
                  }
                }}
              />
              {showTransporterSuggestions && transporterSuggestions.length > 0 && (
                <ul className="so-suggestion-list" style={{ zIndex: 10, maxHeight: 200, overflowY: 'auto' }}>
                  {transporterSuggestions.map((t, i) => (
                    <li
                      key={(t.TransporterCode || t.Transporter || t.TransporterName || 'trans') + '_' + i}
                      onClick={() => handleSelectTransporter(t)}
                    >
                      <div>
                        <strong>{t.TransporterCode || t.Transporter}</strong>
                        {t.TransporterName && <span style={{marginLeft:8}}>{t.TransporterName}</span>}
                        {t.Email && <span style={{marginLeft:8, color:'#888'}}>{t.Email}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
 
        {/* Remarks Section */}
        <div className="remarks-section">
          <label>Remarks</label>
          <textarea
            name="SAP_Description"
            value={formData.SAP_Description || ""}
            onChange={handleChange}
            placeholder="Enter any additional remarks or notes here..."
          />
        </div>
 
        {/* Buttons Section */}
        <div className="actions-row" style={{ flexDirection: 'column', gap: 12 }}>
          {/* Row 1: Registration and Cancel Trip - Blue */}
          <div style={{ display: 'flex', gap: 12, width: '100%', justifyContent: 'center' }}>
            <button
              type="submit"
              className="submit-button"
              disabled={submitting ||
                       (availableQty !== null && availableQty <= 0) ||
                       !formData.VehicleNumber ||
                       !formData.SalesDocument2 ||
                       !formData.ExpectedQty ||
                       !formData.Transporter}
              style={{ flex: 1, background: '#2563eb' }}
            >
              {submitting ? "Submitting..." : "Register Vehicle"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setCurrentView("cancelTrip");
                setSuccessMsg("");
              }}
              style={{ flex: 1, background: '#2563eb', color: 'white', border: 'none' }}
            >
              Cancel Trip
            </button>
          </div>
         
          {/* Row 2: View Details - Green */}
          <div style={{ display: 'flex', gap: 12, width: '100%', justifyContent: 'center' }}>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setCurrentView("registeredList");
                setShowList(true);
                loadList({ search: "", statusFilter: "01" });
              }}
              style={{ flex: 1, background: '#16a34a', color: 'white', border: 'none' }}
            >
              View Registered Details
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setCurrentView("cancelledList");
                setShowList(true);
                loadList({ search: "", statusFilter: "02" });
              }}
              style={{ flex: 1, background: '#16a34a', color: 'white', border: 'none' }}
            >
              View Cancelled Details
            </button>
          </div>
        </div>
      </form>
      )}
 
      {/* Cancel Trip Form */}
      {currentView === "cancelTrip" && (
        <form onSubmit={handleCancelTrip} className="create-header-form">
          <div className="form-fields-section">
            <div className="form-row-2col">
              <div className="form-group">
                <label>Registration Number</label>
                <input
                  type="text"
                  value={cancelTripRegNum}
                  onChange={(e) => setCancelTripRegNum(e.target.value)}
                  required
                  placeholder="Enter Registration Number to cancel"
                  autoFocus
                />
              </div>
            </div>
          </div>
 
          <div className="actions-row">
            <button
              type="submit"
              className="submit-button"
              disabled={cancellingTrip || !cancelTripRegNum.trim()}
              style={{ background: '#dc2626' }}
            >
              {cancellingTrip ? "Cancelling..." : "Cancel Trip"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setCurrentView("registration");
                setCancelTripRegNum("");
                setSuccessMsg("");
              }}
            >
              Back to Registration
            </button>
          </div>
        </form>
      )}
     
      {showList && (
        <div className="registration-list-panel">
          <h3 className="panel-title">
            {currentView === "registeredList" ? "Registered Entries" : "Cancelled Trip Details"}
          </h3>
          <form onSubmit={handleSearchSubmit} className="search-bar">
            <input
              type="text"
              placeholder="Search S.NO / Sales Order / Vehicle / Transporter / Remarks..."
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
            <button
              type="button"
              className="secondary-button small"
              onClick={() => {
                setShowList(false);
                setCurrentView("registration");
                setSearch("");
              }}
            >
              Back to Registration
            </button>
          </form>
          {/* Sort Buttons */}
          <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
            <button
              type="button"
              className="secondary-button small"
              style={{ background: '#f1f5f9', color: '#2563eb', border: '1px solid #2563eb', fontWeight: 600 }}
              onClick={() => {
                // Sort ascending by Registration Number
                const sorted = [...rows].sort((a, b) => {
                  const aNum = parseInt(a.RegistrationNumber, 10) || 0;
                  const bNum = parseInt(b.RegistrationNumber, 10) || 0;
                  return aNum - bNum;
                });
                setRows(sorted);
              }}
            >
              Sort Ascending
            </button>
            <button
              type="button"
              className="secondary-button small"
              style={{ background: '#f1f5f9', color: '#2563eb', border: '1px solid #2563eb', fontWeight: 600 }}
              onClick={() => {
                // Sort descending by Registration Number
                const sorted = [...rows].sort((a, b) => {
                  const aNum = parseInt(a.RegistrationNumber, 10) || 0;
                  const bNum = parseInt(b.RegistrationNumber, 10) || 0;
                  return bNum - aNum;
                });
                setRows(sorted);
              }}
            >
              Sort Descending
            </button>
          </div>
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
                  <th>S.NO</th>
                  <th>Registration Number</th>
                  <th>Sales Order</th>
                  <th>Expected Qty</th>
                  <th>Vehicle</th>
                  <th>Transporter</th>
                  <th>Remarks</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  // Parse to remove leading zeros for display
                  const displaySalesDoc = r.SalesDocument ? String(parseInt(r.SalesDocument, 10)) : "-";
                  const displayRegNum = r.RegistrationNumber ? String(parseInt(r.RegistrationNumber, 10)) : "-";
                 
                  return (
                  <tr key={r.SAP_UUID || r.SalesDocument2 || i}>
                    <td><strong>{displaySalesDoc}</strong></td>
                    <td><span style={{ color: '#2563eb', fontWeight: 600 }}>{displayRegNum}</span></td>
                    <td>{r.SalesDocument2 || "-"}</td>
                    <td>{r.ExpectedQty || "-"}</td>
                    <td>{r.VehicleNumber || "-"}</td>
                    <td>{r.Transporter || "-"}</td>
                    <td>{r.SAP_Description || "-"}</td>
                    <td>
                      <span className={`status-badge status-${(r.Status || 'Success').toLowerCase()}`}>
                        {r.Status === "02" ? "Cancelled" : (r.Status_Text || "Success")}
                      </span>
                    </td>
                    <td>
                      {currentView === "registeredList" && r.Status !== "02" && (
                        <button
                          type="button"
                          className="cancel-button"
                          onClick={() => handleCancelRegistration(r.SAP_UUID, r.Status)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })}
                {!listLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="empty-row">
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