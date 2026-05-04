
import React, { useState, useEffect, useRef } from "react";

import { useNavigate } from "react-router-dom";
import "./RgpProcess.css";

import axios from 'axios';
import { productSearch, createRgpGateEntry, fetchTransporters, fetchVendorDetails, API_BASE } from '../../api';
import html2pdf from 'html2pdf.js';

export default function RgpProcess() {
                            // Robust row update for material table
                            const handleRowChange = (rowId, fieldOrObject, value) => {
                              setTableRows(prevRows =>
                                prevRows.map(row => {
                                  if (row.id !== rowId) return row;
                                  if (typeof fieldOrObject === "object") {
                                    return { ...row, ...fieldOrObject };
                                  }
                                  return { ...row, [fieldOrObject]: value };
                                })
                              );
                            };
                        // Copy gate entry number to clipboard and show feedback
                        const handleCopyGateEntry = () => {
                          if (createdGateEntryNum) {
                            navigator.clipboard.writeText(createdGateEntryNum)
                              .then(() => {
                                setCopied(true);
                                setTimeout(() => setCopied(false), 1500);
                              })
                              .catch(() => {
                                setCopied(false);
                              });
                          }
                        };
                // Add a new material row
                const addRow = () => {
                  setTableRows(prevRows => [
                    ...prevRows,
                    {
                      id: prevRows.length > 0 ? Math.max(...prevRows.map(r => r.id)) + 1 : 1,
                      type: "M",
                      materialCode: "",
                      materialDescription: "",
                      returnableQuantity: "",
                      uom: "",
                      approximateValue: "",
                      remarks: "",
                      purpose: ""
                    }
                  ]);
                };
        // Generic input change handler for form fields
        const handleInputChange = (e) => {
          const { name, value } = e.target;
          setFormData((prev) => ({ ...prev, [name]: value }));
        };

        const getVendorPlaceValue = (vendor) => {
          if (!vendor) return "";
          return vendor.Full_Address || vendor.FullAddress || vendor.VendorPlace || vendor.address || vendor.city || "";
        };
      // Material code dropdown open/close state
      const [showMaterialDropdownRowId, setShowMaterialDropdownRowId] = useState(null);

      // Close material dropdown on outside click
      useEffect(() => {
        function handleMaterialClick(e) {
          if (!e.target.closest('.material-code-input')) {
            setShowMaterialDropdownRowId(null);
          }
        }
        document.addEventListener('mousedown', handleMaterialClick);
        return () => document.removeEventListener('mousedown', handleMaterialClick);
      }, []);
    // Dropdown open/close state
    const [showTransporterCodeDropdown, setShowTransporterCodeDropdown] = useState(false);
    const [showTransporterNameDropdown, setShowTransporterNameDropdown] = useState(false);

    // Close dropdowns on outside click
    useEffect(() => {
      function handleClick(e) {
        if (!e.target.closest('.form-group')) {
          setShowTransporterCodeDropdown(false);
          setShowTransporterNameDropdown(false);
        }
      }
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }, []);
  const [vendorOptions, setVendorOptions] = useState([]);
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [showVendorNameDropdown, setShowVendorNameDropdown] = useState(false);
  // Debug: log vendor options (must be after useState)
  console.log('Vendor options:', vendorOptions);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdGateEntryNum, setCreatedGateEntryNum] = useState("");
  const [copied, setCopied] = useState(false);
  const [savedResponseData, setSavedResponseData] = useState(null);
  const printTriggeredRef = useRef(false);
  const lastAutoFilledPlaceRef = useRef("");
  const [printStatus, setPrintStatus] = useState("");
  
  // Product/material search state for Plant
  const [plantProductOptions, setPlantProductOptions] = useState([]);
  const [plantSearchTerm, setPlantSearchTerm] = useState("");
  const [plantLoading, setPlantLoading] = useState(false);
  const [plantError, setPlantError] = useState("");
  const [shouldFetchAllPlants, setShouldFetchAllPlants] = useState(false);

  // Product/material search state for Material rows
  const [materialProductOptions, setMaterialProductOptions] = useState([]);
  const [materialSearchTerm, setMaterialSearchTerm] = useState("");
  const [materialLoading, setMaterialLoading] = useState(false);
  const [materialError, setMaterialError] = useState("");
  const [activeRowId, setActiveRowId] = useState(null);

  // Product/material search state for Material Description
  const [materialDescOptions, setMaterialDescOptions] = useState([]);
  const [materialDescSearchTerm, setMaterialDescSearchTerm] = useState("");
  const [materialDescLoading, setMaterialDescLoading] = useState(false);
  const [materialDescError, setMaterialDescError] = useState("");
  const [activeDescRowId, setActiveDescRowId] = useState(null);
  

  // Don't auto-print anymore - only print when user clicks Print button
  // Commenting out automatic print trigger
  // useEffect(() => {
  //   if (showSuccessModal && savedResponseData && !printTriggeredRef.current) {
  //     printTriggeredRef.current = true;
  //     const timer = setTimeout(() => { handlePrint(); }, 500);
  //     return () => clearTimeout(timer);
  //   }
  //   if (!showSuccessModal) {
  //     printTriggeredRef.current = false;
  //   }
  // }, [showSuccessModal, savedResponseData]);

  // Fetch vendor options from backend on mount
  useEffect(() => {
    setLoading(true);
    setError("");
    // Use full backend URL for SAP BTP deployment
        fetch('http://localhost:4600/api/rgpprocess/vendors')
    //  fetch(`https://GateEntry-Production-Server.cfapps.in30.hana.ondemand.com/api/rgpprocess/vendors`)
    //   fetch(`https://GateEntry-QLT.cfapps.in30.hana.ondemand.com/api/rgpprocess/vendors`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch vendor data');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setVendorOptions(data);
          setError("");
        } else {
          setVendorOptions([]);
          setError("No vendor data found. Please check backend or SAP.");
        }
      })
      .catch((err) => {
        setVendorOptions([]);
        setError("Failed to fetch vendor data. Please check backend or SAP.");
        console.error('Vendor fetch error:', err);
      })
      .finally(() => setLoading(false));
  }, []);
  
  // Transporter list state (same as SD screens)
  const [allTransporters, setAllTransporters] = useState([]);
  
  // Header fields matching SAP structure
  const [formData, setFormData] = useState({
    plant: "",
    vendor: "",
    vendorName: "",
    department: "",
    requisitioner: "",
    place: "",
    modeOfTransport: "Select",
    vehicleNumber: "",
    transporterCode: "",
    transporterName: "",
    driverName: "",
    driverPhoneNumber: "",
    dlNumber: "",
    remarks: "",
    gateEntryNum: "",
    expecteddateofreturn: ""
  });

  useEffect(() => {
    const matchedVendor = vendorOptions.find((opt) =>
      (formData.vendor && opt.code === formData.vendor) ||
      (formData.vendorName && opt.name === formData.vendorName)
    );

    if (!matchedVendor) return;

    const fetchedPlace = getVendorPlaceValue(matchedVendor);
    if (!fetchedPlace) return;

    setFormData(prev => {
      if (prev.place && prev.place !== lastAutoFilledPlaceRef.current) {
        return prev;
      }
      if (prev.place === fetchedPlace) {
        lastAutoFilledPlaceRef.current = fetchedPlace;
        return prev;
      }

      lastAutoFilledPlaceRef.current = fetchedPlace;
      return { ...prev, place: fetchedPlace };
    });
  }, [formData.vendor, formData.vendorName, vendorOptions]);

  // Table rows
  const [tableRows, setTableRows] = useState([
    {
      id: 1,
      type: "M", // M or T
      materialCode: "",
      materialDescription: "",
      returnableQuantity: "",
      uom: "",
      approximateValue: "",
      remarks: "",
      purpose: ""
    }
  ]);

  // Fetch product/material options for Plant when search term changes
  useEffect(() => {
    try {
      if (!plantSearchTerm && !shouldFetchAllPlants) {
        setPlantProductOptions([]);
        return;
      }
      setPlantLoading(true);
      setPlantError("");
      const searchQuery = plantSearchTerm || " ";
      productSearch(searchQuery)
        .then(({ data }) => {
          const dataArray = Array.isArray(data) ? data : [];
          const expandedData = [];
          dataArray.forEach(item => {
            const plantCode = item.Plant || item.Product || item.Material || "";
            const plantDesc = item.ProductDescription || item.Description || "";
            if (plantCode && typeof plantCode === "string" && plantCode.includes(',')) {
              const codes = plantCode.split(',').map(c => c.trim());
              const descs = plantDesc && typeof plantDesc === "string" && plantDesc.includes(',') ? plantDesc.split(',').map(d => d.trim()) : [plantDesc];
              codes.forEach((code, idx) => {
                if (code) {
                  expandedData.push({
                    Plant: code,
                    Product: code,
                    Material: code,
                    ProductDescription: descs[idx] || descs[0] || "",
                    Description: descs[idx] || descs[0] || ""
                  });
                }
              });
            } else if (plantCode) {
              expandedData.push(item);
            }
          });
          setPlantProductOptions(expandedData);
        })
        .catch(e => {
          setPlantError(e?.response?.data?.error || e.message || "Failed to fetch products");
          setPlantProductOptions([]);
        })
        .finally(() => {
          setPlantLoading(false);
          setShouldFetchAllPlants(false);
        });
    } catch (err) {
      setPlantError("Unexpected error occurred while fetching plant options.");
      setPlantProductOptions([]);
      setPlantLoading(false);
      setShouldFetchAllPlants(false);
    }
  }, [plantSearchTerm, shouldFetchAllPlants]);

  // Fetch product/material options for Material Code when search term changes
  useEffect(() => {
    if (!materialSearchTerm) {
      setMaterialProductOptions([]);
      return;
    }
    setMaterialLoading(true);
    setMaterialError("");
    productSearch(materialSearchTerm)
      .then(({ data }) => {
        // Expand comma-separated codes/descriptions for robust matching
        const dataArray = Array.isArray(data) ? data : [];
        const expandedData = [];
        dataArray.forEach(item => {
          const code = item.Product || item.Material || "";
          const desc = item.ProductDescription || item.Description || "";
          if (code && typeof code === "string" && code.includes(',')) {
            const codes = code.split(',').map(c => c.trim());
            const descs = desc && typeof desc === "string" && desc.includes(',') ? desc.split(',').map(d => d.trim()) : [desc];
            codes.forEach((c, idx) => {
              if (c) {
                expandedData.push({
                  Product: c,
                  Material: c,
                  ProductDescription: descs[idx] || descs[0] || "",
                  Description: descs[idx] || descs[0] || "",
                  UOM: item.UOM || item.BaseUnit || item.Unit || item.uom || ""
                });
              }
            });
          } else if (code) {
            expandedData.push(item);
          }
        });
        setMaterialProductOptions(expandedData);
      })
      .catch(e => {
        setMaterialError(e?.response?.data?.error || e.message || "Failed to fetch materials");
        setMaterialProductOptions([]);
      })
      .finally(() => setMaterialLoading(false));
  }, [materialSearchTerm]);

  // Fetch product/material options for Material Description when search term changes
  useEffect(() => {
    if (!materialDescSearchTerm) {
      setMaterialDescOptions([]);
      return;
    }
    setMaterialDescLoading(true);
    setMaterialDescError("");
    productSearch(materialDescSearchTerm)
      .then(({ data }) => {
        setMaterialDescOptions(Array.isArray(data) ? data : []);
      })
      .catch(e => {
        setMaterialDescError(e?.response?.data?.error || e.message || "Failed to fetch materials");
        setMaterialDescOptions([]);
      })
      .finally(() => setMaterialDescLoading(false));
  }, [materialDescSearchTerm]);

  // Reliable PDF download using Blob (Stores & Consumable approach)
  const handlePrint = async () => {
    if (!savedResponseData) {
      setPrintStatus("No data to print. Please generate a gate entry first.");
      return;
    }

    try {
      const now = new Date();
      const printDate = now.toLocaleDateString('en-GB');
      const printTime = now.toLocaleTimeString('en-GB');

      // Helper to get field from response or form
      const getField = (key) => {
        const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
        return savedResponseData?.[key] ?? savedResponseData?.[pascalKey] ?? formData[key] ?? '';
      };

      const formatDisplayDate = (value) => {
        if (!value) return '-';

        if (typeof value === 'string') {
          const odataMatch = value.match(/\/Date\((-?\d+)(?:[+-]\d+)?\)\//);
          if (odataMatch) {
            const parsedDate = new Date(Number(odataMatch[1]));
            return Number.isNaN(parsedDate.getTime()) ? value : parsedDate.toLocaleDateString('en-GB');
          }

          const parsedDate = new Date(value);
          if (!Number.isNaN(parsedDate.getTime())) {
            return parsedDate.toLocaleDateString('en-GB');
          }
        }

        if (value instanceof Date && !Number.isNaN(value.getTime())) {
          return value.toLocaleDateString('en-GB');
        }

        return value;
      };

      const formattedExpectedReturn = formatDisplayDate(getField('expecteddateofreturn'));

      // Prepare material rows
      const items = Array.isArray(savedResponseData?.items) ? savedResponseData.items : tableRows;
      const materialRows = items
        .filter(row => row.materialCode || row.materialDescription)
        .map((row, idx) => `
          <tr>
            <td style="border:1px solid #000; padding:4px; text-align:center;">${idx + 1}</td>
            <td style="border:1px solid #000; padding:4px; text-align:center;">${row.type || '-'}</td>
            <td style="border:1px solid #000; padding:4px; text-align:left;">${row.materialCode || '-'}</td>
            <td style="border:1px solid #000; padding:4px; text-align:left; word-break: break-all; white-space: pre-wrap;">${row.materialDescription || '-'}</td>
            <td style="border:1px solid #000; padding:4px; text-align:right;">${row.returnableQuantity || '-'}</td>
            <td style="border:1px solid #000; padding:4px; text-align:center;">${row.uom || '-'}</td>
            <td style="border:1px solid #000; padding:4px; text-align:right;">${row.approximateValue || '-'}</td>
            <td style="border:1px solid #000; padding:4px; text-align:left;">${row.remarks || '-'}</td>
            <td style="border:1px solid #000; padding:4px; text-align:left;">${row.purpose || '-'}</td>
          </tr>
        `).join('');

      // Always use the value shown in the success popup for consistency
      let gateEntryNum = createdGateEntryNum ||
        (savedResponseData && (savedResponseData.gateEntry || savedResponseData.GateEntryNumber)) ||
        formData.gateEntryNum || '-';

      // Try to load logo as base64
      let logoDataUrl = '';
      try {
        const logoRes = await fetch('/Minera_Logo.jpg');
        const logoBlob = await logoRes.blob();
        logoDataUrl = await new Promise((res) => {
          const r = new FileReader();
          r.onloadend = () => res(r.result);
          r.readAsDataURL(logoBlob);
        });
      } catch (_) {}

      // Header rows for slip
      const headerRows = [
        ["Gate Entry No:", gateEntryNum, "Date:", printDate],
        ["Plant:", getField('plant'), "Time:", printTime],
        ["Vendor Code:", getField('vendor'), "Vendor Name:", getField('vendorName')],
        ["Vehicle No:", getField('vehicleNumber'), "Mode of Transport:", getField('modeOfTransport')],
        ["Driver Name:", getField('driverName'), "Department:", getField('department')],
        ["Requisitioner:", getField('requisitioner'), "Place:", getField('place')],
        ["Expected Return:", formattedExpectedReturn, "Remarks:", getField('remarks')],
      ];

      // Build HTML for PDF (Stores & Consumable style)
      const html = `
        <div style="font-family: Arial, sans-serif; color: #000; background: #fff; width: 100%; max-width: 700px; margin: 0 auto; font-size: 10px;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 4px;">
            <div>
              <div style='font-size: 13px; font-weight: bold;'>Minera Steel & Power Pvt Ltd</div>
              <div style='font-size: 9px;'>Yerabanahalli Village, Sandur Taluk, Ballari Dist, Karnataka - 583115</div>
            </div>
            ${logoDataUrl ? `<img src='${logoDataUrl}' alt='Logo' style='height: 28px; width: auto; margin-left: 8px;'/>` : ''}
          </div>
          <div style="text-align:center; font-size:12px; font-weight:bold; margin-bottom: 4px;">RGP Gate Entry Slip</div>
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
                <th style="border:1px solid #000; padding:4px; text-align:center;">Type</th>
                <th style="border:1px solid #000; padding:4px; text-align:left;">Material Code</th>
                <th style="border:1px solid #000; padding:4px; text-align:left;">Material Description</th>
                <th style="border:1px solid #000; padding:4px; text-align:right;">Returnable Qty</th>
                <th style="border:1px solid #000; padding:4px; text-align:center;">UOM</th>
                <th style="border:1px solid #000; padding:4px; text-align:right;">Approx. Value</th>
                <th style="border:1px solid #000; padding:4px; text-align:left;">Remarks</th>
                <th style="border:1px solid #000; padding:4px; text-align:left;">Purpose</th>
              </tr>
            </thead>
            <tbody>
              ${materialRows}
            </tbody>
          </table>

          <div style="display:flex; justify-content:space-between; gap:10px; margin-top:16px; font-size:8.5px; text-align:center;">
            <div style="flex:1;">Prepared by</div>
            <div style="flex:1;">Approved by</div>
            <div style="flex:1;">Received by</div>
            <div style="flex:1;">Security Department</div>
          </div>
        </div>
      `;

      // Use html2pdf.js to generate and download PDF
      const opt = {
        margin: [8, 8, 8, 8],
        filename: `RGP_GateEntry_${gateEntryNum}.pdf`,
        html2canvas: { scale: 1.5, useCORS: true },
        jsPDF: { unit: 'mm', format: [210, 148], orientation: 'portrait', compress: true }, // A5 size
        pagebreak: { mode: 'avoid-all' }
      };

      setPrintStatus("Generating PDF...");
      await html2pdf().from(html).set(opt).save();
      setPrintStatus("PDF downloaded successfully.");
    } catch (err) {
      setPrintStatus("Failed to generate PDF. " + (err?.message || ""));
      console.error("PDF generation error:", err);
    }
  } // Only one closing brace for handlePrint

  // Parse SAP error into user-friendly message
  const parseError = (error) => {
    if (!error) return "An unexpected error occurred. Please try again.";

    // Extract error message from various formats
    let errorMessage = "";

    // Check for response data
    if (error.response) {
      const { data, status } = error.response;

      // Handle XML error responses
      if (typeof data === 'string' && (data.includes('<?xml') || data.includes('<error>'))) {
        const messageMatch = data.match(/<message>(.*?)<\/message>/i);
        if (messageMatch) {
          errorMessage = messageMatch[1];
        } else {
          errorMessage = "SAP system error. Please check your inputs and try again.";
        }
      }
      // Handle JSON error responses
      else if (data?.error) {
        if (typeof data.error === 'string') {
          errorMessage = data.error;
        } else if (data.error.message) {
          errorMessage = data.error.message.value || data.error.message;
        }
      }
      // Handle OData error format
      else if (data?.d?.ErrorMessage) {
        errorMessage = data.d.ErrorMessage;
      }
      // HTTP status based messages
      else if (status === 400) {
        errorMessage = "Invalid data provided. Please check all fields.";
      } else if (status === 401 || status === 403) {
        errorMessage = "Authentication failed. Please check your credentials.";
      } else if (status === 404) {
        errorMessage = "Service not found. Please contact support.";
      } else if (status === 500) {
        errorMessage = "Server error occurred. Please try again later.";
      } else if (status === 503) {
        errorMessage = "Service temporarily unavailable. Please try again.";
      }
    }
    // Network errors
    else if (error.request) {
      errorMessage = "Unable to connect to server. Please check your internet connection.";
    }
    // Other errors
    else if (error.message) {
      errorMessage = error.message;
    }

    // Clean up technical jargon
    errorMessage = errorMessage
      .replace(/OData/gi, "System")
      .replace(/CSRF/gi, "Security token")
      .replace(/HTTP/gi, "Connection");

    return errorMessage || "Failed to create gate entry. Please verify all information and try again.";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setPrintStatus("");
    setShowSuccessModal(false);
    setSavedResponseData(null);
    try {
      // Prepare payload for API
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const inwardTime = `${hh}:${mm}`;
      
      // Map material items to SAP fields (up to 5 items)
      // Note: SAP only has single UOM, ApproximateValue, Purpose fields (not per material)
      const materials = {};
      tableRows.slice(0, 5).forEach((row, index) => {
        const suffix = index === 0 ? '' : (index + 1).toString();
        materials[`Material${suffix}`] = row.materialCode || "";
        materials[`MaterialDescription${suffix}`] = row.materialDescription || "";
        // Add ReturnableQty field to SAP payload
        materials[`ReturnableQty${suffix}`] = row.returnableQuantity || "0.00";
      });
      
      // Get UOM, ApproximateValue, Purpose from FIRST material row only
      const firstRow = tableRows[0] || {};
      materials.UOM = firstRow.uom || "";
      materials.ApproximateValue = firstRow.approximateValue || "0.00";
      materials.Purpose = firstRow.purpose || "";

      // Map user-friendly values to SAP-expected values
      const sapModeOfTransport = formData.modeOfTransport === "Hand" 
        ? "By Hand" 
        : formData.modeOfTransport === "Truck" 
          ? "By Road" 
          : formData.modeOfTransport;

      const payload = {
        Indicator: "R",
        GateEntryDate: today,
        InwardTime: inwardTime,
        FiscalYear: new Date().getFullYear().toString(),
        Plant: formData.plant,
        Vendor: formData.vendor,
        VendorName: formData.vendorName,
        Department: formData.department,
        Requisitioner: formData.requisitioner,
        Place: formData.place,
        VehicleNumber: formData.vehicleNumber || "",
        TransporterCode: formData.transporterCode || "",
        TransporterName: formData.transporterName || "",
        DriverName: formData.driverName || "",
        DriverPhoneNumber: formData.driverPhoneNumber || "",
        DLNumber: formData.dlNumber || "",
        ModeOfTransport: sapModeOfTransport,
        Remarks: formData.remarks,
        Expecteddateofreturn: formData.expecteddateofreturn || null,
        // Do not spread materials here
        tableRows: tableRows // Send all table rows for backend line item storage
      };

      console.log("=== RGP Gate Entry Payload ===");
      console.log("Header Fields:");
      console.log("  Department:", payload.Department);
      console.log("  Requisitioner:", payload.Requisitioner);
      console.log("  Place:", payload.Place);
      console.log("\nSingle Fields (from first material row):");
      console.log("  UOM:", payload.UOM);
      console.log("  ApproximateValue:", payload.ApproximateValue);
      console.log("  Purpose:", payload.Purpose);
      console.log("\nMaterial Rows:");
      tableRows.forEach((row, idx) => {
        console.log(`  Row ${idx + 1}:`, {
          materialCode: row.materialCode,
          materialDescription: row.materialDescription
        });
      });
      console.log("\nComplete Payload:", JSON.stringify(payload, null, 2));

      const { data } = await createRgpGateEntry(payload);
      
      // Extract gate entry number from response
      const gateEntryNum = data?.d?.GateEntryNumber || data?.GateEntryNumber || "Created";
      const responseData = data?.d || data;
      
      // Save response data for print slip
      setSavedResponseData(responseData);
      
      // Show custom success modal
      setCreatedGateEntryNum(gateEntryNum);
      setShowSuccessModal(true);

    } catch (err) {
      console.error("Failed to create RGP gate entry:", err);
      let friendlyError = parseError(err);
      if (typeof friendlyError === 'string' && friendlyError.includes('gateOutPayload')) {
        friendlyError = "Internal error: Gate Out payload referenced in Gate Entry screen. Please contact support.";
      }
      setError(friendlyError);
      setLoading(false);
    }
  };

  return (
    <div className="rgp-container">
      <style>{`
        input::-webkit-calendar-picker-indicator {
          display: none !important;
        }
        input[list]::-webkit-list-button {
          display: none !important;
        }
        input[type="text"][list] {
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
        }
      `}</style>
      <div className="rgp-header">
        <h2>RGP Process - Gate Entry</h2>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="sc-success-overlay">
          <div className="sc-success-modal">
            <div className="sc-success-icon">
              {/* Single tick SVG only! */}
            </div>
            <h2 className="sc-modal-title">RGP Gate Entry Created Successfully!</h2>
            <div className="sc-gate-entry-row">
              <b>Gate Entry Number</b>
              <span>{createdGateEntryNum}</span>
              <button 
                className="sc-copy-btn"
                onClick={handleCopyGateEntry}
                title="Copy Gate Entry Number"
              >📋 Copy</button>
            </div>
            <div className="sc-details-grid">
              <div className="sc-detail-card">
                <b>Plant</b>
                <span>{formData.plant}</span>
              </div>
              <div className="sc-detail-card">
                <b>Vendor</b>
                <span>{formData.vendor}</span>
              </div>
              <div className="sc-detail-card">
                <b>Vehicle Number</b>
                <span>{formData.vehicleNumber}</span>
              </div>
              <div className="sc-detail-card" style={{ gridColumn: 'span 3' }}>
                <b>Date & Time</b>
                <span>{new Date().toLocaleString()}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                className="sc-primary-btn"
                onClick={handlePrint}
                style={{ minWidth: '160px' }}
              >Download Wamnet Slip</button>
              <button
                className="sc-primary-btn"
                onClick={() => setShowSuccessModal(false)}
              >OK</button>
            </div>
            {printStatus && (
              <div
                style={{
                  marginTop: '10px',
                  textAlign: 'center',
                  fontWeight: '600',
                  color: printStatus.toLowerCase().includes('failed') ? '#dc2626' : '#166534'
                }}
              >
                {printStatus}
              </div>
            )}
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
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  name="plant"
                  value={formData.plant}
                  onChange={(e) => {
                    handleInputChange(e);
                    // Don't trigger API call on every keystroke
                  }}
                  onClick={() => {
                    if (plantProductOptions.length === 0) {
                      setPlantSearchTerm(" ");
                      setShouldFetchAllPlants(true);
                    }
                  }}
                  onFocus={() => {
                    if (plantProductOptions.length === 0) {
                      setPlantSearchTerm(" ");
                      setShouldFetchAllPlants(true);
                    }
                  }}
                  autoComplete="off"
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 12px',
                    fontSize: '14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                />
                <svg
                  onClick={() => {
                    if (plantProductOptions.length === 0) {
                      setPlantSearchTerm(" ");
                      setShouldFetchAllPlants(true);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    width: '20px',
                    height: '20px',
                    color: '#6b7280'
                  }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                {plantLoading && <div className="loading-indicator">Loading...</div>}
                {plantError && <div className="error-message" style={{ fontSize: '12px', color: 'red' }}>{plantError}</div>}
                {plantProductOptions.length > 0 && (() => {
                  // Filter options based on search term (case-insensitive)
                  const searchLower = formData.plant.toLowerCase().trim();
                  const filtered = plantProductOptions.filter(opt => {
                    if (!searchLower || searchLower === ' ') return true;
                    const plantCode = (opt.Plant || opt.Product || opt.Material || "").toLowerCase();
                    const plantDesc = (opt.ProductDescription || opt.Description || "").toLowerCase();
                    return plantCode.includes(searchLower) || plantDesc.includes(searchLower);
                  });
                  
                  if (filtered.length === 0) return null;
                  
                  return (
                    <ul className="dropdown-list" style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      backgroundColor: 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      marginTop: '4px',
                      listStyle: 'none',
                      padding: 0,
                      zIndex: 1000,
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}>
                      {filtered.slice(0, 50).map((opt, idx) => {
                        const plantCode = opt.Plant || opt.Product || opt.Material || "";
                        const plantDesc = opt.ProductDescription || opt.Description || "";
                        return (
                          <li
                            key={`${plantCode}-${idx}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setFormData(prev => ({
                                ...prev,
                                plant: plantCode
                              }));
                              setPlantSearchTerm("");
                              setPlantProductOptions([]);
                            }}
                            style={{
                              cursor: "pointer",
                              padding: "10px 12px",
                              borderBottom: '1px solid #f3f4f6',
                              fontSize: '14px',
                              display: 'block'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                          >
                            <div style={{ fontWeight: '600', marginBottom: '2px' }}>
                              {plantCode}
                            </div>
                            {plantDesc && (
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                {plantDesc}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </div>
            </div>

            <div className="form-group">
              <label>Vendor Code</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  name="vendor"
                  value={formData.vendor}
                  onChange={e => {
                    const value = e.target.value;
                    setFormData(prev => ({ ...prev, vendor: value }));
                  }}
                  onClick={() => {
                    if (vendorOptions.length === 0) return;
                    setShowVendorDropdown(true);
                  }}
                  onFocus={() => {
                    if (vendorOptions.length === 0) return;
                    setShowVendorDropdown(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowVendorDropdown(false), 200);
                  }}
                  placeholder="Select Vendor Code"
                  autoComplete="off"
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 12px',
                    fontSize: '14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                />
                <svg
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    width: '20px',
                    height: '20px',
                    color: '#6b7280'
                  }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                {showVendorDropdown && vendorOptions.length > 0 && (() => {
                  const searchLower = formData.vendor.toLowerCase().trim();
                  const filtered = vendorOptions.filter(opt => {
                    if (!searchLower) return true;
                    return (opt.code || '').toLowerCase().includes(searchLower);
                  });
                  if (filtered.length === 0) return null;
                  return (
                    <ul className="dropdown-list" style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      backgroundColor: 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      marginTop: '4px',
                      listStyle: 'none',
                      padding: 0,
                      zIndex: 1000,
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}>
                      {filtered.slice(0, 50).map((opt, idx) => (
                        <li
                          key={opt.code + '-' + idx}
                          onMouseDown={async (e) => {
                            e.preventDefault();
                            const fetchedPlace = getVendorPlaceValue(opt);
                            lastAutoFilledPlaceRef.current = fetchedPlace;
                            setFormData(prev => ({
                              ...prev,
                              vendor: opt.code,
                              vendorName: opt.name,
                              place: fetchedPlace
                            }));
                            setShowVendorDropdown(false);
                            if (opt.code) {
                              try {
                                const { data } = await fetchVendorDetails({ code: opt.code });
                                const vendor = Array.isArray(data)
                                  ? data.find(item => item.code === opt.code)
                                  : data?.vendor;
                                const resolvedPlace = getVendorPlaceValue(vendor);
                                if (vendor) {
                                  lastAutoFilledPlaceRef.current = resolvedPlace || fetchedPlace;
                                  setFormData(prev => ({
                                    ...prev,
                                    vendor: vendor.code || opt.code || '',
                                    vendorName: vendor.name || opt.name || '',
                                    place: resolvedPlace || fetchedPlace || prev.place,
                                  }));
                                }
                              } catch {}
                            }
                          }}
                          style={{
                            cursor: "pointer",
                            padding: "10px 12px",
                            borderBottom: '1px solid #f3f4f6',
                            fontSize: '14px',
                            display: 'block'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                        >
                          <div style={{ fontWeight: '600', marginBottom: '2px' }}>{opt.code}</div>
                          {opt.name && (
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>{opt.name}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>
            </div>

            <div className="form-group">
              <label>Vendor Name</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  name="vendorName"
                  value={formData.vendorName}
                  onChange={e => {
                    const value = e.target.value;
                    setFormData(prev => ({ ...prev, vendorName: value }));
                  }}
                  onClick={() => {
                    if (vendorOptions.length === 0) return;
                    setShowVendorNameDropdown(true);
                  }}
                  onFocus={() => {
                    if (vendorOptions.length === 0) return;
                    setShowVendorNameDropdown(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowVendorNameDropdown(false), 200);
                  }}
                  placeholder="Select Vendor Name"
                  autoComplete="off"
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 12px',
                    fontSize: '14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                />
                <svg
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    width: '20px',
                    height: '20px',
                    color: '#6b7280'
                  }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                {showVendorNameDropdown && vendorOptions.length > 0 && (() => {
                  const searchLower = formData.vendorName.toLowerCase().trim();
                  const filtered = vendorOptions.filter(opt => {
                    if (!searchLower) return true;
                    return (opt.name || '').toLowerCase().includes(searchLower);
                  });
                  if (filtered.length === 0) return null;
                  return (
                    <ul className="dropdown-list" style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      backgroundColor: 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      marginTop: '4px',
                      listStyle: 'none',
                      padding: 0,
                      zIndex: 1000,
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}>
                      {filtered.slice(0, 50).map((opt, idx) => (
                        <li
                          key={opt.code + '-' + idx}
                          onMouseDown={async (e) => {
                            e.preventDefault();
                            const fetchedPlace = getVendorPlaceValue(opt);
                            lastAutoFilledPlaceRef.current = fetchedPlace;
                            setFormData(prev => ({
                              ...prev,
                              vendor: opt.code,
                              vendorName: opt.name,
                              place: fetchedPlace
                            }));
                            setShowVendorNameDropdown(false);
                            if (opt.name) {
                              try {
                                const { data } = await fetchVendorDetails({ name: opt.name });
                                const vendor = Array.isArray(data)
                                  ? data.find(item => item.name === opt.name)
                                  : data?.vendor;
                                const resolvedPlace = getVendorPlaceValue(vendor);
                                if (vendor) {
                                  lastAutoFilledPlaceRef.current = resolvedPlace || fetchedPlace;
                                  setFormData(prev => ({
                                    ...prev,
                                    vendor: vendor.code || opt.code || '',
                                    vendorName: vendor.name || opt.name || '',
                                    place: resolvedPlace || fetchedPlace || prev.place,
                                  }));
                                }
                              } catch {}
                            }
                          }}
                          style={{
                            cursor: "pointer",
                            padding: "10px 12px",
                            borderBottom: '1px solid #f3f4f6',
                            fontSize: '14px',
                            display: 'block'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                        >
                          <div style={{ fontWeight: '600', marginBottom: '2px' }}>{opt.name}</div>
                          {opt.code && (
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>{opt.code}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>
            </div>

            <div className="form-group">
              <label>Department</label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label>Requisitioner</label>
              <input
                type="text"
                name="requisitioner"
                value={formData.requisitioner}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label>Expected Date of Return</label>
              <input
                type="date"
                name="expecteddateofreturn"
                value={formData.expecteddateofreturn}
                onChange={handleInputChange}
              />
            </div>

            {/* Mode of Transport remains here */}


            <div className="form-group">
              <label>Mode of Transport</label>
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
                    pointerEvents: 'auto',
                    cursor: 'pointer',
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

            {/* Place and Remarks/Purpose in one row (half + half) */}
            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Place</label>
                <textarea
                  name="place"
                  value={formData.place}
                  onChange={handleInputChange}
                  placeholder="Auto-fetched from vendor, editable if needed"
                  style={{ minHeight: '48px', resize: 'vertical', width: '100%', fontSize: '14px' }}
                />
              </div>

              <div className="form-group">
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
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      name="transporterCode"
                      value={formData.transporterCode}
                      onChange={e => {
                        setFormData(prev => ({
                          ...prev,
                          transporterCode: e.target.value,
                          transporterName: (allTransporters.find(t => t.TransporterCode === e.target.value)?.TransporterName) || ''
                        }));
                        setShowTransporterCodeDropdown(true);
                      }}
                      onFocus={() => setShowTransporterCodeDropdown(true)}
                      placeholder="Search transporter code"
                      autoComplete="off"
                      style={{
                        width: '100%',
                        padding: '10px 40px 10px 12px',
                        fontSize: '14px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        backgroundColor: 'white',
                        cursor: 'pointer'
                      }}
                    />
                    <svg
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'auto',
                        cursor: 'pointer',
                        width: '20px',
                        height: '20px',
                        color: '#6b7280'
                      }}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      onClick={() => setShowTransporterCodeDropdown(v => !v)}
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                    {showTransporterCodeDropdown && allTransporters.length > 0 && (
                      <ul className="dropdown-list" style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        maxHeight: '200px',
                        overflowY: 'auto',
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        marginTop: '4px',
                        listStyle: 'none',
                        padding: 0,
                        zIndex: 1000,
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                      }}>
                        {allTransporters.filter(t =>
                          !formData.transporterCode || t.TransporterCode.toLowerCase().includes(formData.transporterCode.toLowerCase())
                        ).slice(0, 50).map((t, idx) => (
                          <li
                            key={t.TransporterCode + '-' + idx}
                            onMouseDown={e => {
                              e.preventDefault();
                              setFormData(prev => ({
                                ...prev,
                                transporterCode: t.TransporterCode,
                                transporterName: t.TransporterName
                              }));
                              setShowTransporterCodeDropdown(false);
                            }}
                            style={{
                              cursor: 'pointer',
                              padding: '10px 12px',
                              borderBottom: '1px solid #f3f4f6',
                              fontSize: '14px',
                              display: 'block'
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                          >
                            <div style={{ fontWeight: '600', marginBottom: '2px' }}>{t.TransporterCode}</div>
                            {t.TransporterName && (
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>{t.TransporterName}</div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label>Transporter Name</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      name="transporterName"
                      value={formData.transporterName}
                      onChange={e => {
                        setFormData(prev => ({
                          ...prev,
                          transporterName: e.target.value,
                          transporterCode: (allTransporters.find(t => t.TransporterName === e.target.value)?.TransporterCode) || ''
                        }));
                        setShowTransporterNameDropdown(true);
                      }}
                      onFocus={() => setShowTransporterNameDropdown(true)}
                      placeholder="Search transporter name"
                      autoComplete="off"
                      style={{
                        width: '100%',
                        padding: '10px 40px 10px 12px',
                        fontSize: '14px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        backgroundColor: 'white',
                        cursor: 'pointer'
                      }}
                    />
                    <svg
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'auto',
                        cursor: 'pointer',
                        width: '20px',
                        height: '20px',
                        color: '#6b7280'
                      }}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      onClick={() => setShowTransporterNameDropdown(v => !v)}
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                    {showTransporterNameDropdown && allTransporters.length > 0 && (
                      <ul className="dropdown-list" style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        maxHeight: '200px',
                        overflowY: 'auto',
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        marginTop: '4px',
                        listStyle: 'none',
                        padding: 0,
                        zIndex: 1000,
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                      }}>
                        {allTransporters.filter(t =>
                          !formData.transporterName || t.TransporterName.toLowerCase().includes(formData.transporterName.toLowerCase())
                        ).slice(0, 50).map((t, idx) => (
                          <li
                            key={t.TransporterName + '-' + idx}
                            onMouseDown={e => {
                              e.preventDefault();
                              setFormData(prev => ({
                                ...prev,
                                transporterName: t.TransporterName,
                                transporterCode: t.TransporterCode
                              }));
                              setShowTransporterNameDropdown(false);
                            }}
                            style={{
                              cursor: 'pointer',
                              padding: '10px 12px',
                              borderBottom: '1px solid #f3f4f6',
                              fontSize: '14px',
                              display: 'block'
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                          >
                            <div style={{ fontWeight: '600', marginBottom: '2px' }}>{t.TransporterName}</div>
                            {t.TransporterCode && (
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>{t.TransporterCode}</div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
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

          </div>
        </div>

        {/* Material Table */}
        <div className="table-section">
          <h3>Material Details</h3>
          <div className="table-wrapper" style={{ overflowX: 'auto', width: '100%' }}>
            <table className="rgp-table" style={{ minWidth: '1500px', width: '100%' }}>
              <thead>
                <tr>
                  <th>M</th>
                  <th>T</th>
                  <th>Material Code</th>
                  <th>Material Description</th>
                  <th>Returnable Quantity</th>
                  <th>UOM</th>
                  <th>Approximate Value</th>
                  <th>Remarks</th>
                  <th>Purpose</th>
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
                        onChange={() => {
                          handleRowChange(row.id, "type", "T");
                          handleRowChange(row.id, "materialCode", "");
                        }}
                      />
                    </td>
                    <td style={{ position: 'relative' }}>
                      <div style={{ position: 'relative', width: '100%' }}>
                        <input
                          type="text"
                          value={row.materialCode}
                          onChange={e => {
                            if (row.type !== "T") {
                              handleRowChange(row.id, "materialCode", e.target.value);
                              setMaterialSearchTerm(e.target.value);
                              setActiveRowId(row.id);
                              setShowMaterialDropdownRowId(row.id);
                            }
                          }}
                          onFocus={() => {
                            if (row.type !== "T") {
                              setShowMaterialDropdownRowId(row.id);
                              setActiveRowId(row.id);
                              if (materialProductOptions.length === 0 && !materialSearchTerm) {
                                setMaterialSearchTerm(" ");
                              }
                            }
                          }}
                          onClick={() => {
                            if (row.type !== "T") {
                              setShowMaterialDropdownRowId(row.id);
                              setActiveRowId(row.id);
                              if (materialProductOptions.length === 0 && !materialSearchTerm) {
                                setMaterialSearchTerm(" ");
                              }
                            }
                          }}
                          placeholder="Search Material"
                          autoComplete="off"
                          data-row-id={row.id}
                          className="material-code-input"
                          disabled={row.type === "T"}
                          style={{
                            width: '100%',
                            minWidth: '150px',
                            padding: '8px 30px 8px 8px',
                            backgroundColor: row.type === "T" ? '#f3f4f6' : 'white',
                            cursor: row.type === "T" ? 'not-allowed' : 'text'
                          }}
                        />
                        {row.type !== "T" && (
                          <svg
                            style={{
                              position: 'absolute',
                              right: '8px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              pointerEvents: 'none',
                              width: '16px',
                              height: '16px',
                              color: '#6b7280'
                            }}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        )}
                        {materialLoading && activeRowId === row.id && row.type !== "T" && (
                          <div style={{ fontSize: '10px', color: '#6b7280' }}>Loading...</div>
                        )}
                        {materialProductOptions.length > 0 && showMaterialDropdownRowId === row.id && row.type !== "T" && (() => {
                          // Filter options by code or description (case-insensitive)
                          const searchLower = (row.materialCode || "").toLowerCase().trim();
                          const filtered = materialProductOptions.filter(opt => {
                            if (!searchLower || searchLower === ' ') return true;
                            const code = (opt.Product || opt.Material || "").toLowerCase();
                            const desc = (opt.ProductDescription || opt.Description || "").toLowerCase();
                            return code.includes(searchLower) || desc.includes(searchLower);
                          });
                          if (filtered.length === 0) return null;
                          return (
                            <ul className="dropdown-list" style={{
                              position: 'fixed',
                              top: 'auto',
                              left: 'auto',
                              maxHeight: '200px',
                              overflowY: 'auto',
                              backgroundColor: 'white',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              marginTop: '2px',
                              listStyle: 'none',
                              padding: 0,
                              zIndex: 9999,
                              boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
                              minWidth: '300px'
                            }}>
                              {filtered.slice(0, 10).map((opt, idx) => (
                                <li
                                  key={opt.Product || opt.Material || idx}
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    handleRowChange(row.id, {
                                      materialCode: opt.Product || opt.Material || "",
                                      materialDescription: opt.ProductDescription || opt.Description || opt.description || "",
                                      uom: opt.UOM || opt.BaseUnit || opt.Unit || opt.uom || ""
                                    });
                                    setMaterialSearchTerm("");
                                    setMaterialProductOptions([]);
                                    setActiveRowId(null);
                                    setShowMaterialDropdownRowId(null);
                                  }}
                                  style={{
                                    cursor: "pointer",
                                    padding: "6px 8px",
                                    borderBottom: '1px solid #f3f4f6',
                                    fontSize: '12px'
                                  }}
                                  onMouseEnter={e => e.target.style.backgroundColor = '#f3f4f6'}
                                  onMouseLeave={e => e.target.style.backgroundColor = 'white'}
                                >
                                  <strong>{opt.Product || opt.Material}</strong>
                                  {opt.ProductDescription || opt.Description ? (
                                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                                      {opt.ProductDescription || opt.Description}
                                    </div>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          );
                        })()}
                      </div>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.materialDescription}
                        onChange={(e) => handleRowChange(row.id, "materialDescription", e.target.value)}
                        placeholder="Enter Description"
                        autoComplete="off"
                        style={{
                          width: '100%',
                          minWidth: '200px',
                          padding: '8px'
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={row.returnableQuantity}
                        onChange={(e) => handleRowChange(row.id, "returnableQuantity", e.target.value)}
                        placeholder="Qty"
                        step="0.01"
                        style={{
                          width: '100%',
                          minWidth: '100px',
                          padding: '8px'
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.uom}
                        onChange={(e) => handleRowChange(row.id, "uom", e.target.value)}
                        placeholder="UOM"
                        style={{
                          width: '100%',
                          minWidth: '80px',
                          padding: '8px',
                          fontSize: '14px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px'
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={row.approximateValue}
                        onChange={(e) => handleRowChange(row.id, "approximateValue", e.target.value)}
                        placeholder="Value"
                        step="0.01"
                        style={{
                          width: '100%',
                          minWidth: '120px',
                          padding: '8px'
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.remarks}
                        onChange={(e) => handleRowChange(row.id, "remarks", e.target.value)}
                        placeholder="Remarks"
                        style={{
                          width: '100%',
                          minWidth: '150px',
                          padding: '8px'
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.purpose}
                        onChange={(e) => handleRowChange(row.id, "purpose", e.target.value)}
                        placeholder="Purpose"
                        style={{
                          width: '100%',
                          minWidth: '150px',
                          padding: '8px'
                        }}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => deleteRow(row.id)}
                        className="delete-btn"
                        disabled={tableRows.length === 1}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: tableRows.length === 1 ? '#e5e7eb' : '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: tableRows.length === 1 ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          fontWeight: '500',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (tableRows.length > 1) {
                            e.currentTarget.style.backgroundColor = '#dc2626';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (tableRows.length > 1) {
                            e.currentTarget.style.backgroundColor = '#ef4444';
                          }
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
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