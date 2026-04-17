
import React, { useState, useEffect } from "react";
import html2pdf from "html2pdf.js";
import axios from "axios";

export default function ReprintGateEntry() {
  const [gateEntryNumber, setGateEntryNumber] = useState("");
  const [headerData, setHeaderData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [allList, setAllList] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [showList, setShowList] = useState(false);

  // ================= LOAD ALL DATA ONCE =================
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    setError("");

    try {
    // const res = await axios.get("http://localhost:4600/api/weightdetails/all");
     // const res = await axios.get("https://GateEntry-Production-Server.cfapps.in30.hana.ondemand.com/api/weightdetails/all");
       const res = await axios.get("https://GateEntry-QLT.cfapps.in30.hana.ondemand.com/api/weightdetails/all");

      const data = Array.isArray(res.data) ? res.data : [];
      setAllList(data);
      setFilteredList(data);
    } catch (err) {
      console.log(err);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // ================= FRONTEND SEARCH =================
const handleSearchChange = (value) => {
  setGateEntryNumber(value);
  setHeaderData(null);
  setError("");

  // ✅ FILTER FROM ALL DATA
  let filtered = allList.filter(item =>
    (item.GateEntryNumber || "")
      .toLowerCase()
      .includes(value.toLowerCase())
  );

  // ✅ SORT LATEST ON TOP
  filtered = filtered.sort((a, b) =>
    (b.GateEntryNumber || "").localeCompare(a.GateEntryNumber || "")
  );

  setFilteredList(filtered);
};
  // ================= SELECT ITEM =================
  const handleSelect = (item) => {
    setGateEntryNumber(item.GateEntryNumber || "");
    setHeaderData(item);
    setShowList(false);
    setError("");
  };

  // ================= FETCH BUTTON LOCAL =================
  const handleFetch = () => {
    if (!gateEntryNumber.trim()) {
      setError("Please enter Gate Entry Number");
      return;
    }

    const selected = allList.find(
      (item) => item.GateEntryNumber === gateEntryNumber
    );

    if (!selected) {
      setHeaderData(null);
      setError("No Data Found");
      return;
    }

    setHeaderData(selected);
    setShowList(false);
    setError("");
  };

  // ================= PDF PRINT =================
const handlePrint = async () => {
  if (!headerData) return;

  const gate = headerData.GateEntryNumber || "";

  // ✅ TYPE BASED ON 3rd DIGIT
  const type =
    gate[2] === "1" ? "SD" :
    gate[2] === "2" ? "PO" : "UNKNOWN";

  const f = (v) => v ?? "";

  // ✅ LOGO LOAD
  let logo = "";
  try {
    const res = await fetch("/Minera_Logo.jpg");
    const blob = await res.blob();

    logo = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.log("Logo load failed");
  }

  // ✅ FORMAT FUNCTIONS
  const formatSAPDate = (sapDate) => {
    if (!sapDate) return "";
    const match = /\/Date\((\d+)\)\//.exec(sapDate);
    if (!match) return sapDate;
    return new Date(parseInt(match[1])).toLocaleDateString("en-GB");
  };

  const formatSAPTime = (sapTime) => {
    if (!sapTime) return "";
    const match = /PT(\d+)H(\d+)M(\d+)S/.exec(sapTime);
    if (!match) return sapTime;
    return `${match[1]}:${match[2]}:${match[3]}`;
  };

  const getShift = (sapTime) => {
    if (!sapTime) return "";
    const match = /PT(\d+)H/.exec(sapTime);
    if (!match) return "";
    const hour = parseInt(match[1]);

    if (hour >= 6 && hour < 12) return "A";
    if (hour >= 12 && hour < 18) return "B";
    return "C";
  };

  const el = document.createElement("div");

  // ================= SD TEMPLATE =================
  const getSDTemplate = () => `
  <div style="font-family:'Times New Roman'; padding:20px; font-size:14px;">

    <div style="display:flex; justify-content:space-between;">
      <div>
        <h2 style="margin:0;">Minera Steel & Power Pvt Ltd</h2>
        <div style="font-size:12px;">Factory Address: Yerabanahalli Village Sandur taluk Ballari dist Pin Code: 583115 Karnataka</div>
      </div>
      ${logo ? `<img src="${logo}" style="height:60px;" />` : ""}
    </div>

    <h3 style="text-align:center;">Weighbridge Ticket</h3>

    <div style="display:flex; justify-content:space-between;">
      <div><b>Date:</b> ${new Date().toLocaleDateString()}</div>
      <div><b>Time:</b> ${new Date().toLocaleTimeString()}</div>
    </div>

    <hr/>

    <div style="display:flex; justify-content:space-between;">

      <table>
        <tr><td><b>Weighment No</b></td><td>: ${f(headerData.WeightDocNumber)}</td></tr>
        <tr><td><b>Gate Entry No</b></td><td>: ${f(headerData.GateEntryNumber)}</td></tr>
        <tr><td><b>Truck Number</b></td><td>: ${f(headerData.VehicleNumber)}</td></tr>
        <tr><td><b>Party Code</b></td><td>: ${f(headerData.Customer)}</td></tr>
        <tr><td><b>Transporter Code</b></td><td>: ${f(headerData.TransporterCode)}</td></tr>
        <tr><td><b>Delivery Note</b></td><td>: ${f(headerData.OutboundDelivery)}</td></tr>
        <tr><td><b>Shift</b></td><td>: ${getShift(headerData.InwardTime)}</td></tr>
      </table>

      <table>
        <tr><td><b>Product Name</b></td><td>: ${f(headerData.MaterialDescription)}</td></tr>
        <tr><td><b>Product Code</b></td><td>: ${f(headerData.Material)}</td></tr>
        <tr><td><b>Party</b></td><td>: ${f(headerData.CustomerName)}</td></tr>
        <tr><td><b>Transporter</b></td><td>: ${f(headerData.TransporterName)}</td></tr>
        <tr><td><b>BillingDocument</b></td><td>: ${f(headerData.BillingDocument)}</td></tr>
        <tr><td><b>Batch</b></td><td>: ${f(headerData.Batch)}</td></tr>
      </table>

    </div>

    <br/>

    <div style="display:flex; justify-content:space-between;">

      <table>
        <tr><td><b>Date In</b></td><td>: ${formatSAPDate(headerData.GateEntryDate)}</td></tr>
        <tr><td><b>Time In</b></td><td>: ${formatSAPTime(headerData.InwardTime)}</td></tr>
      </table>

      <table>
        <tr><td><b>Date Out</b></td><td>: ${formatSAPDate(headerData.GateOutDate)}</td></tr>
        <tr><td><b>Time Out</b></td><td>: ${formatSAPTime(headerData.OutwardTime)}</td></tr>
      </table>

      <table>
        <tr><td><b>Tare</b></td><td>: ${f(headerData.TareWeight)} t</td></tr>
        <tr><td><b>Gross</b></td><td>: ${f(headerData.GrossWeight)} t</td></tr>
        <tr><td><b>Net</b></td><td>: <b>${f(headerData.NetWeight)} t</b></td></tr>
      </table>

    </div>

    <hr/>
    <p style="font-size:12px;">Note: This truck/vehicle weighment transanction includes the driver's weight</p>

  </div>
  `;

  // ================= PO TEMPLATE =================
  const getPOTemplate = () => `
  <div style="font-family:'Times New Roman'; padding:20px; font-size:14px;">

    <div style="display:flex; justify-content:space-between;">
      <div>
        <h2 style="margin:0;">Minera Steel & Power Pvt Ltd</h2>
        <div style="font-size:12px;">Factory Address: Yerabanahalli Village Sandur taluk Ballari dist Pin Code: 583115 Karnataka</div>
      </div>
      ${logo ? `<img src="${logo}" style="height:60px;" />` : ""}
    </div>

    <h3 style="text-align:center;">Weighbridge Ticket</h3>

    <div style="display:flex; justify-content:space-between;">
      <div><b>Date:</b> ${new Date().toLocaleDateString()}</div>
      <div><b>Time:</b> ${new Date().toLocaleTimeString()}</div>
    </div>

    <hr/>

    <div style="display:flex; justify-content:space-between;">

<table>
  <tr><td><b>Weighment No</b></td><td>: ${f(headerData.WeightDocNumber)}</td></tr>
  <tr><td><b>Gate Entry No</b></td><td>: ${f(headerData.GateEntryNumber)}</td></tr>
  <tr><td><b>Truck Number</b></td><td>: ${f(headerData.VehicleNumber)}</td></tr>
  <tr><td><b>Party Code</b></td><td>: ${f(headerData.Vendor)}</td></tr>
  <tr><td><b>Transporter Code</b></td><td>: ${f(headerData.TransporterCode)}</td></tr>

  ${headerData.VendorInvoiceNumber && headerData.VendorInvoiceNumber !== "-" ? `
  <tr><td><b>Challan Number</b></td><td>: ${f(headerData.VendorInvoiceNumber)}</td></tr>
  ` : ''}

  ${headerData.VendorInvoiceNumber2 && headerData.VendorInvoiceNumber2 !== "-" ? `
  <tr><td><b>Challan Number2</b></td><td>: ${f(headerData.VendorInvoiceNumber2)}</td></tr>
  ` : ''}

  ${headerData.VendorInvoiceNumber3 && headerData.VendorInvoiceNumber3 !== "-" ? `
  <tr><td><b>Challan Number3</b></td><td>: ${f(headerData.VendorInvoiceNumber3)}</td></tr>
  ` : ''}

  ${headerData.VendorInvoiceNumber4 && headerData.VendorInvoiceNumber4 !== "-" ? `
  <tr><td><b>Challan Number4</b></td><td>: ${f(headerData.VendorInvoiceNumber4)}</td></tr>
  ` : ''}

  ${headerData.VendorInvoiceNumber5 && headerData.VendorInvoiceNumber5 !== "-" ? `
  <tr><td><b>Challan Number5</b></td><td>: ${f(headerData.VendorInvoiceNumber5)}</td></tr>
  ` : ''}

  ${headerData.VendorInvoiceWeight && headerData.VendorInvoiceWeight !== "0.000" ? `
  <tr><td><b>Challan Weight</b></td><td>: ${f(headerData.VendorInvoiceWeight)}</td></tr>
  ` : ''}

  ${headerData.VendorInvoiceWeight2 && headerData.VendorInvoiceWeight2 !== "0.000" ? `
  <tr><td><b>Challan Weight2</b></td><td>: ${f(headerData.VendorInvoiceWeight2)}</td></tr>
  ` : ''}

  ${headerData.VendorInvoiceWeight3 && headerData.VendorInvoiceWeight3 !== "0.000" ? `
  <tr><td><b>Challan Weight3</b></td><td>: ${f(headerData.VendorInvoiceWeight3)}</td></tr>
  ` : ''}

  ${headerData.VendorInvoiceWeight4 && headerData.VendorInvoiceWeight4 !== "0.000" ? `
  <tr><td><b>Challan Weight4</b></td><td>: ${f(headerData.VendorInvoiceWeight4)}</td></tr>
  ` : ''}

  ${headerData.VendorInvoiceWeight5 && headerData.VendorInvoiceWeight5 !== "0.000" ? `
  <tr><td><b>Challan Weight5</b></td><td>: ${f(headerData.VendorInvoiceWeight5)}</td></tr>
  ` : ''}

  ${headerData.Remarks && headerData.Remarks !== "-" ? `
  <tr><td><b>Miscellaneous</b></td><td>: ${f(headerData.Remarks)}</td></tr>
  ` : ''}
</table>

      <table>
  ${headerData.PurchaseOrderNumber && headerData.PurchaseOrderNumber !== "-" ? `
  <tr><td><b>PO Number</b></td><td>: ${f(headerData.PurchaseOrderNumber)}</td></tr>
  ` : ''}

  ${headerData.PurchaseOrderNumber2 && headerData.PurchaseOrderNumber2 !== "-" ? `
  <tr><td><b>PO Number2</b></td><td>: ${f(headerData.PurchaseOrderNumber2)}</td></tr>
  ` : ''}

  ${headerData.PurchaseOrderNumber3 && headerData.PurchaseOrderNumber3 !== "-" ? `
  <tr><td><b>PO Number3</b></td><td>: ${f(headerData.PurchaseOrderNumber3)}</td></tr>
  ` : ''}

  ${headerData.PurchaseOrderNumber4 && headerData.PurchaseOrderNumber4 !== "-" ? `
  <tr><td><b>PO Number4</b></td><td>: ${f(headerData.PurchaseOrderNumber4)}</td></tr>
  ` : ''}

  ${headerData.PurchaseOrderNumber5 && headerData.PurchaseOrderNumber5 !== "-" ? `
  <tr><td><b>PO Number5</b></td><td>: ${f(headerData.PurchaseOrderNumber5)}</td></tr>
  ` : ''}

  <tr><td><b>Product Name</b></td><td>: ${f(headerData.MaterialDescription)}</td></tr>
  <tr><td><b>Party</b></td><td>: ${f(headerData.VendorName)}</td></tr>
  <tr><td><b>Transporter Name</b></td><td>: ${f(headerData.TransporterName)}</td></tr>

  ${headerData.VendorInvoiceDate && headerData.VendorInvoiceDate !== "-" ? `
  <tr><td><b>Challan Date</b></td><td>: ${formatSAPDate(headerData.VendorInvoiceDate)}</td></tr>
  ` : ''}

  ${headerData.VendorInvoiceDate2 && headerData.VendorInvoiceDate2 !== "-" ? `
  <tr><td><b>Challan Date2</b></td><td>: ${formatSAPDate(headerData.VendorInvoiceDate2)}</td></tr>
  ` : ''}

  ${headerData.VendorInvoiceDate3 && headerData.VendorInvoiceDate3 !== "-" ? `
  <tr><td><b>Challan Date3</b></td><td>: ${formatSAPDate(headerData.VendorInvoiceDate3)}</td></tr>
  ` : ''}

  ${headerData.VendorInvoiceDate4 && headerData.VendorInvoiceDate4 !== "-" ? `
  <tr><td><b>Challan Date4</b></td><td>: ${formatSAPDate(headerData.VendorInvoiceDate4)}</td></tr>
  ` : ''}

  ${headerData.VendorInvoiceDate5 && headerData.VendorInvoiceDate5 !== "-" ? `
  <tr><td><b>Challan Date5</b></td><td>: ${formatSAPDate(headerData.VendorInvoiceDate5)}</td></tr>
  ` : ''}

  ${headerData.SubTransporterName && headerData.SubTransporterName !== "-" ? `
  <tr><td><b>Sub Transporter Name</b></td><td>: ${f(headerData.SubTransporterName)}</td></tr>
  ` : ''}

  <tr><td><b>Shift</b></td><td>: ${getShift(headerData.InwardTime)}</td></tr>
</table>
    </div>

    <br/>

    <div style="display:flex; justify-content:space-between;">

      <table>
        <tr><td><b>Date In</b></td><td>: ${formatSAPDate(headerData.GateEntryDate)}</td></tr>
        <tr><td><b>Time In</b></td><td>: ${formatSAPTime(headerData.InwardTime)}</td></tr>
      </table>

      <table>
        <tr><td><b>Date Out</b></td><td>: ${formatSAPDate(headerData.GateOutDate)}</td></tr>
        <tr><td><b>Time Out</b></td><td>: ${formatSAPTime(headerData.OutwardTime)}</td></tr>
      </table>

      <table>
        <tr><td><b>Tare</b></td><td>: ${f(headerData.TareWeight)} t</td></tr>
        <tr><td><b>Gross</b></td><td>: ${f(headerData.GrossWeight)} t</td></tr>
        <tr><td><b>Net</b></td><td>: <b>${f(headerData.NetWeight)} t</b></td></tr>
      </table>

    </div>

    <hr/>
    <p style="font-size:12px;">Note: This truck/vehicle weighment transanction includes the driver's weight</p>

  </div>
  `;

  // ✅ SELECT TEMPLATE
  let htmlContent = "";

  if (type === "SD") {
    htmlContent = getSDTemplate();
  } else if (type === "PO") {
    htmlContent = getPOTemplate();
  } else {
    alert("Unknown Gate Entry Type");
    return;
  }

  el.innerHTML = htmlContent;

  // ✅ PDF
  html2pdf().set({
    margin: 5,
    html2canvas: { scale: 3 },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  })
  .from(el)
  .save(`Slip_${headerData.GateEntryNumber}.pdf`);
};
  // ================= UI =================
const sortedList = [...filteredList].sort((a, b) =>
  (b.GateEntryNumber || "").localeCompare(a.GateEntryNumber || "")
);

return (
  <div style={styles.container}>

    {/* HEADER */}
    <div style={styles.header}>
      <h2>Weighment Slip Reprint</h2>
    </div>

    {/* SEARCH */}
    <div style={styles.searchBar}>
      <input
        style={styles.input}
        value={gateEntryNumber}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder="Search Gate Entry Number..."
      />
      <button onClick={handleFetch} style={styles.fetchBtn}>
        Fetch
      </button>
    </div>

    {/* MAIN */}
    <div style={styles.main}>

      {/* LEFT PANEL */}
      <div style={styles.leftPanel}>
        <h3>Gate Entries</h3>

        {sortedList.map((item, i) => (
          <div
            key={i}
            style={{
              ...styles.listItem,
              ...(headerData?.GateEntryNumber === item.GateEntryNumber
                ? styles.activeItem
                : {})
            }}
            onClick={() => handleSelect(item)}
            onMouseEnter={(e) => {
              if (headerData?.GateEntryNumber !== item.GateEntryNumber)
                e.currentTarget.style.background = "#e6f0ff";
            }}
            onMouseLeave={(e) => {
              if (headerData?.GateEntryNumber !== item.GateEntryNumber)
                e.currentTarget.style.background = "#fafafa";
            }}
          >
            <b>GateEntryNumber: {item.GateEntryNumber}</b>
            <div style={styles.subText}>
            WeighmentDoc {item.WeightDocNumber} | Vehicle  {item.VehicleNumber} |  BillingDocument  {item.BillingDocument}
            </div>
          </div>
        ))}
      </div>

      {/* RIGHT PANEL */}
      <div style={styles.rightPanel}>

        {headerData ? (
          <>
            <h3>Details</h3>

            <div style={styles.detailsGrid}>
              <p><b>Gate Entry:</b> {headerData.GateEntryNumber}</p>
              <p><b>Vehicle:</b> {headerData.VehicleNumber}</p>
              <p><b>Transporter:</b> {headerData.TransporterCode} - {headerData.TransporterName}</p>
              <p><b>Material:</b> {headerData.MaterialDescription}</p>
              <p><b>Gross:</b> {headerData.GrossWeight}</p>
              <p><b>Tare:</b> {headerData.TareWeight}</p>
              <p><b>Net:</b> {headerData.NetWeight}</p>
            </div>

            {/* TABLE */}
            <h4>Item List</h4>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Billing</th>
                  <th style={styles.th}>Material</th>
                  <th style={styles.th}>PO/OBD</th>
                  <th style={styles.th}>Vendor/Customer</th>
                </tr>
              </thead>
              <tbody>
                {[1,2,3,4,5].map(i => {
                  const bill = headerData[`BillingDocument${i === 1 ? "" : i}`];
                  const desc = headerData[`MaterialDescription${i === 1 ? "" : i}`];
                  const po = headerData[`PurchaseOrderNumber${i === 1 ? "" : i}`]|| headerData[`OutboundDelivery${i === 1 ? "" : i}`];
                  const ven = headerData[`VendorName${i === 1 ? "" : i}`] || headerData[`CustomerName${i === 1 ? "" : i}`];

                  if (!desc && !po) return null;

                  return (
                    <tr key={i}>
                      <td style={styles.td}>{bill}</td>
                      <td style={styles.td}>{desc}</td>
                      <td style={styles.td}>{po}</td>
                      <td style={styles.td}>{ven}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <button style={styles.printBtn} onClick={handlePrint}>
              Print Slip
            </button>
          </>
        ) : (
          <div style={styles.empty}>
            Select a Gate Entry to view details
          </div>
        )}

      </div>
    </div>
  </div>
);
}

// ================= STYLES =================
const styles = {
  container: {
    padding: "20px",
    fontFamily: "Segoe UI, Arial",
    background: "#f4f6f9",
    minHeight: "100vh"
  },

  header: {
    marginBottom: "15px",
    position: "sticky",
    top: 0,
    background: "#f4f6f9",
    padding: "10px 0",
    zIndex: 10
  },

  searchBar: {
    display: "flex",
    gap: "10px",
    marginBottom: "15px"
  },

  input: {
    flex: 1,
    padding: "10px",
    border: "1px solid #ccc",
    borderRadius: "6px"
  },

  fetchBtn: {
    padding: "10px 16px",
    background: "#007bff",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer"
  },

  main: {
    display: "flex",
    height: "75vh"
  },

  leftPanel: {
    width: "30%",
    background: "#fff",
    borderRadius: "8px",
    padding: "10px",
    overflowY: "auto",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
  },

  listItem: {
    padding: "12px",
    borderBottom: "1px solid #eee",
    cursor: "pointer",
    borderRadius: "6px",
    marginBottom: "6px",
    background: "#fafafa",
    transition: "0.2s"
  },

  activeItem: {
    background: "#007bff",
    color: "#fff"
  },

  subText: {
    fontSize: "12px",
    color: "#666"
  },

  rightPanel: {
    width: "70%",
    marginLeft: "15px",
    background: "#fff",
    borderRadius: "8px",
    padding: "15px",
    overflowY: "auto",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
  },

  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginBottom: "15px"
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "10px"
  },

  th: {
    border: "1px solid #ccc",
    padding: "8px",
    background: "#007bff",
    color: "#fff"
  },

  td: {
    border: "1px solid #ccc",
    padding: "8px"
  },

  printBtn: {
    marginTop: "15px",
    padding: "10px",
    background: "green",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    width: "200px",
    cursor: "pointer"
  },

  empty: {
    textAlign: "center",
    color: "#888",
    marginTop: "50px"
  }
};