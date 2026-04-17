import React, { useState, useEffect, useRef } from "react";
//import { userCrenditials } from "./api";
import { userCrenditials } from "./api.js";
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";

import InitialRegistration from  "./pages/Gateinmovementin/InitialReg.jsx";
import CreateHeader from "./pages/Gateinmovementin/CreateHeader.jsx";
import MoveINHome from "./pages/Gateinmovementin/MoveINHome.jsx";
import MoveOutHome from "./pages/GateMovementOut/GateOutHome.jsx";
import Outward from "./pages/Gateinmovementin/Outward.jsx";
import GateOut_Inward from "./pages/GateMovementOut/GateEntryInward_Out.jsx";
import GateOut_Outward from "./pages/GateMovementOut/GateEntryOutward_Out.jsx";

import MaterialINHome from "./pages/MaterialMovementIN/MaterialINHome.jsx";
import MaterialInward from "./pages/MaterialMovementIN/MaterialInward.jsx";
import MaterialOutward from "./pages/MaterialMovementIN/MaterialOutward.jsx";
import MaterialOutHome from "./pages/MaterialMovementOut/MaterialOutHome.jsx";  
import MaterialOut_Inward from "./pages/MaterialMovementOut/MatInward_out.jsx";
import MaterialOut_Outward from "./pages/MaterialMovementOut/MatOutward_out.jsx";

import QRScannerInward from "./pages/QRScanner/QRScanner.jsx";
import QRScannerInwardOut from "./pages/QRScanner/QRScannerout.jsx"; 

import Internal_TransferPosting from "./pages/TransferPosting/emptytruckITP.jsx";
import Loaded_TransferPosting from "./pages/TransferPosting/loadedtruckITP.jsx";
import ITPHome from "./pages/TransferPosting/ITPHome.jsx";
import TruckRegistration from "./pages/TransferPosting/TruckReg.jsx";

import LiveDashBoard from "./pages/Gateinmovementin/LiveDashBoard.jsx";

import StoreConsubale from "./pages/Gateinmovementin/StoreConsubale.jsx";
import StoreConsubaleOut from "./pages/Gateinmovementin/StoreConsubaleOut.jsx";
import StoresConsumableHome from "./pages/Gateinmovementin/StoresConsumableHome.jsx";
import CashPurchaseScreen from "./pages/CashPurchaseScreen.jsx";
import RgpNrgpHome from "./pages/Gateinmovementin/RgpNrgp.jsx";
import RgpProcessHome from "./pages/Gateinmovementin/RgpProcessHome.jsx";
import RgpProcess from "./pages/Gateinmovementin/RgpProcess.jsx";
import RgpGateIn from "./pages/Gateinmovementin/RgpGateIn.jsx";
import RgpGateOut from "./pages/Gateinmovementin/RgpGateOut.jsx";
import NrgpProcess from "./pages/Gateinmovementin/NrgpProcess.jsx";

import CancelGateEntry from "./pages/Gateinmovementin/CancelGateEntry.jsx";
import CancelWeightDocument from "./pages/Gateinmovementin/CancelWeightDocument.jsx";
import ReprintGateEntry from "./pages/Gateinmovementin/ReprintGateEntry.jsx";

import NrgpProcessHome from "./pages/Gateinmovementin/NrgpProcessHome.jsx";
import NrgpOut from "./pages/Gateinmovementin/NrgpOut.jsx";
//GRN Creation
import GrnCreateByGateEntry from "./pages/ZmatGRN/zmatgrn.jsx";
//import Reprint from "./pages/Gateinmovementin/ReprintGateEntry.jsx";
import "./App.css";

// Protected Route Component
// 101 = admin (all access), 102 = mm, 103 = sd
const ProtectedRoute = ({ children, allowedRoles }) => {
  const loggedIn = localStorage.getItem("loggedIn") === "true";
  const roleCode = localStorage.getItem("roleCode");
  if (!loggedIn) return <Navigate to="/" replace />;
  if (roleCode === "101") return children; // admin: allow all
  if (allowedRoles && !allowedRoles.includes(roleCode)) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "red", fontWeight: "bold" }}>
        Your ID is not authorized for this page.
      </div>
    );
  }
  return children;
};

// Home Page Component
const HomePage = () => {
  const navigate = useNavigate();
  
  return (
    <div className="home-container">
      <header
  className="home-header"
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "16px 24px 0 24px"
  }}
>
  <div>
    <h1 style={{ marginBottom: 20 }}>Gate Entry Screen</h1>
    <nav className="main-nav">
      <Link to="/home/livedashboard" className="card-link" style={{ background: 'linear-gradient(135deg, #0061f2 0%, #0040a0 100%)', boxShadow: '0 4px 15px rgba(0,97,242,0.35)' }}>Dashboard</Link>
      <Link to="/home/initial_registration" className="card-link" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 15px rgba(16,185,129,0.35)' }}>Initial Registration</Link>
      <Link to="/home/cancel-gate-entry" className="card-link" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', boxShadow: '0 4px 15px rgba(239,68,68,0.35)' }}>Cancel Gate Entry</Link>
      <Link to="/home/cancel-weight-doc" className="card-link" style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', boxShadow: '0 4px 15px rgba(249,115,22,0.35)' }}>Cancel Weight Doc</Link>
      <Link to="/home/reprint" className="card-link" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', boxShadow: '0 4px 15px rgba(139,92,246,0.35)' }}>Reprint</Link>
    </nav>
  </div>
  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
    <img src="/Minera_Logo.jpg" alt="Minera Logo" style={{ width: "150px" }} />
    <button
      onClick={() => { localStorage.removeItem("loggedIn"); navigate("/"); }}
      className="logout-btn"
    >
      Logout
    </button>
  </div>
</header>

      <main className="home-main">
        <div className="dashboard-cards">
          <div className="card">
            <h3>Gate Entry In</h3>
            <p>Gate movement in</p>
            <Link to="/home/movein" className="card-link">Gate Entry Movement IN</Link>
          </div>
          <div className="card">
            <h3>W B IN ( ZWBIN)</h3>
            <p>Gate Material Details</p>
            <Link to="/home/Materialin" className="card-link">Weighbridge IN ( ZWBIN)</Link>
          </div>
          <div className="card">
            <h3>W B OUT ( ZWBOUT)</h3>
            <p>Gate Material Details</p>
            <Link to="/home/materialout" className="card-link">Weighbridge OUT ( ZWBOUT)</Link>
          </div>
          <div className="card">
            <h3>Gate Entry Out</h3>
            <p>Gate Movement Out Details</p>
            <Link to="/home/moveout" className="card-link">Gate Entry Movement Out</Link>
          </div>
            <div className="card">
              <h3>ZWBIN QR Scanner</h3>
            <p>Inward</p>
              <Link to="/home/qrscanner/inward" className="card-link">ZWBIN QR Scanner</Link>
          </div>
          <div className="card">
              <h3>ZWBOUT QR Scanner</h3>
            <p>Outward</p>
              <Link to="/home/qrscanner/outward" className="card-link">ZWBOUT QR Scanner</Link>
          </div>
          <div className="card">
              <h3>Internal Transfer</h3>
            <p>ITP Details</p>
              <Link to="/home/transferposting" className="card-link">Internal Transfer</Link>
          </div>
                    <div className="card">
                      <h3>Stores and Consumable</h3>
                      <p>Stores and Consumable Details</p>
                      <Link to="/home/storeconsumable" className="card-link">Stores and Consumable</Link>
                    </div>
                    <div className="card">
                      <h3>Cash Purchase</h3>
                      <p>Cash Purchase Details</p>
                      <Link to="/home/cashpurchase" className="card-link">Cash Purchase</Link>
                    </div>
                    <div className="card">
                      <h3>Rgp & NRgp Process</h3>
                      <p>Rgp & NRgp Process</p>
                      <Link to="/home/rgp" className="card-link">Rgp & NRgp Process</Link>
                    </div>
                    <div className="card">
                      <h3>GRN Creation</h3>
                      <p>Create GRN by Gate Entry Number</p>
                      <Link to="/home/grncreate" className="card-link">GRN Creation</Link>
                    </div>
        </div>
      </main>
    </div>
  );
};

// Login Page Component
const LoginPage = () => {
  const [user, setUser] = useState("");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await userCrenditials(user, pwd);
      if (data.success && data.user) {
        // Store only ModuleWise as roleCode (101=admin, 102=mm, 103=sd)
        localStorage.setItem("loggedIn", "true");
        localStorage.setItem("roleCode", data.user.ModuleWise || "");
        localStorage.setItem("user", data.user.UserName || "");
        navigate("/home");
      } else {
        setError("Invalid credentials");
      }
    } catch (err) {
      setError("Invalid credential");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
       <img src="/Minera_Logo.jpg" alt="Minera Logo" style={{ width: "120px" }} />
        <h2>Gate Entry System</h2>
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label>Username</label>
            <input 
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="login-btn" disabled={loading}>{loading ? "Logging" : "Login"}</button>
        </form>
      </div>
    </div>
  );
};

// Main App Component
// AutoLogout component to handle inactivity logout
function AutoLogout() {
  const timerRef = useRef();
  const logoutTimer = 20 * 60 * 1000; // 20 minutes
  const navigate = useNavigate();

  // Reset timer on user activity
  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (localStorage.getItem("loggedIn") === "true") {
      timerRef.current = setTimeout(() => {
        localStorage.removeItem("loggedIn");
        localStorage.removeItem("roleCode");
        localStorage.removeItem("user");
        alert("Logged out due to inactivity.");
        navigate("/");
      }, logoutTimer);
    }
  };

  useEffect(() => {
    if (localStorage.getItem("loggedIn") === "true") {
      const events = ["mousemove", "keydown", "mousedown", "touchstart"];
      events.forEach((event) => window.addEventListener(event, resetTimer));
      resetTimer();
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        events.forEach((event) => window.removeEventListener(event, resetTimer));
      };
    }
  }, [localStorage.getItem("loggedIn")]);
  return null;
}





export default function App() {
  return (
    <Router>
      <AutoLogout />
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        {/* 101 = admin, 102 = mm, 103 = sd */}
        <Route path="/home/initial_registration" element={<ProtectedRoute allowedRoles={["101","102","104"]}><InitialRegistration /></ProtectedRoute>} />
        {/* Gate Entry Home Inward & Outward*/}
        <Route path="/home/movein" element={<ProtectedRoute allowedRoles={["101","102","103","104"]}><MoveINHome /></ProtectedRoute>} />
        <Route path="/home/create" element={<ProtectedRoute allowedRoles={["101","102","104"]}><CreateHeader /></ProtectedRoute>} />
        <Route path="/home/movein/outward" element={<ProtectedRoute allowedRoles={["101","103","104"]}><Outward /></ProtectedRoute>} />
        <Route path="/home/movein/inward" element={<ProtectedRoute allowedRoles={["101","102","104"]}><CreateHeader /></ProtectedRoute>} />
        {/* Weighment1 Home Inward & Outward*/}
        <Route path="/home/materialin" element={<ProtectedRoute allowedRoles={["101","102","103","107"]}><MaterialINHome /></ProtectedRoute>} />
        <Route path="/home/materialinward" element={<ProtectedRoute allowedRoles={["101","102","107"]}><MaterialInward /></ProtectedRoute>} />
        <Route path="/home/materialoutward" element={<ProtectedRoute allowedRoles={["101","103"]}><MaterialOutward /></ProtectedRoute>} />
        {/* Weighment2 Home Inward & Outward*/}
        <Route path="/home/materialout" element={<ProtectedRoute allowedRoles={["101","102","103", "107"]}><MaterialOutHome /></ProtectedRoute>} />
        <Route path="/home/materialout_inward" element={<ProtectedRoute allowedRoles={["101","102","107"]}><MaterialOut_Inward /></ProtectedRoute>} />
        <Route path="/home/materialout_outward" element={<ProtectedRoute allowedRoles={["101","103"]}><MaterialOut_Outward /></ProtectedRoute>} />
        {/* Complete Gate Out Inward&Outward */}
        <Route path="/home/moveout" element={<ProtectedRoute allowedRoles={["101","102","103","104"]}><MoveOutHome /></ProtectedRoute>} />
        <Route path="/home/gateout_inward" element={<ProtectedRoute allowedRoles={["101","102","104"]}><GateOut_Inward /></ProtectedRoute>} />
        <Route path="/home/gateout_outward" element={<ProtectedRoute allowedRoles={["101","103","104"]}><GateOut_Outward /></ProtectedRoute>} />

        {/* QR Scanner Routes Pallet */}
        <Route path="/home/qrscanner/inward" element={<ProtectedRoute allowedRoles={["101","102","107"]}><QRScannerInward /></ProtectedRoute>} />
        <Route path="/home/qrscanner/outward" element={<ProtectedRoute allowedRoles={["101","102","107"]}><QRScannerInwardOut /></ProtectedRoute>} />

        {/* Transfer Posting Routes Pallet */}
        <Route path="/home/transferposting" element={<ProtectedRoute allowedRoles={["101","103","107","108"]}><ITPHome /></ProtectedRoute>} />
        <Route path="/home/truckregistration" element={<ProtectedRoute allowedRoles={["101","103","108"]}><TruckRegistration /></ProtectedRoute>} />
        <Route path="/home/transferposting/itp" element={<ProtectedRoute allowedRoles={["101","103","107"]}><Internal_TransferPosting /></ProtectedRoute>} />
        <Route path="/home/transferposting/loadeditp" element={<ProtectedRoute allowedRoles={["101","103","107"]}><Loaded_TransferPosting /></ProtectedRoute>} />
        

        {/* Stores and Consumable Routes */}
        <Route path="/home/storeconsumable" element={<ProtectedRoute allowedRoles={["101","102","104"]}><StoresConsumableHome /></ProtectedRoute>} />
        <Route path="/stores-consumable-entry" element={<ProtectedRoute allowedRoles={["101","102","104"]}><StoreConsubale /></ProtectedRoute>} />
        <Route path="/stores-consumable-outward" element={<ProtectedRoute allowedRoles={["101","102","104"]}><StoreConsubaleOut /></ProtectedRoute>} />

        <Route path="/gate-entry-outward" element={<ProtectedRoute allowedRoles={["101","103","104"]}><GateOut_Outward /></ProtectedRoute>} />
        <Route path="/home/livedashboard" element={<ProtectedRoute allowedRoles={["101","102","103"]}><LiveDashBoard /></ProtectedRoute>} />

        {/* Cash Purchase and RGP/NRGP Routes */}
                <Route path="/home/cashpurchase" element={<ProtectedRoute allowedRoles={["101","102","104"]}><CashPurchaseScreen /></ProtectedRoute>} />
                {/* RGP/NRGP Home*/}
                <Route path="/home/rgp" element={<ProtectedRoute allowedRoles={["101","102","104","110"]}><RgpNrgpHome /></ProtectedRoute>} />
                {/* RGP/NRGP Two Homes */}
                <Route path="/home/nrgp/process" element={<ProtectedRoute allowedRoles={["101","102","110","104"]}><NrgpProcessHome /></ProtectedRoute>} />
                <Route path="/home/rgp/process" element={<ProtectedRoute allowedRoles={["101","102","110","104"]}><RgpProcessHome /></ProtectedRoute>} />

                <Route path="/home/rgp/process/entry" element={<ProtectedRoute allowedRoles={["101","102","110"]}><RgpProcess /></ProtectedRoute>} />
                <Route path="/home/rgp/process/gate-out" element={<ProtectedRoute allowedRoles={["101","102","104"]}><RgpGateOut /></ProtectedRoute>} />
                <Route path="/home/rgp/process/gate-in" element={<ProtectedRoute allowedRoles={["101","102","104"]}><RgpGateIn /></ProtectedRoute>} />
                <Route path="/home/nrgp/process/entry" element={<ProtectedRoute allowedRoles={["101","102","110"]}><NrgpProcess /></ProtectedRoute>} />
                <Route path="/home/nrgp/process/gate-out" element={<ProtectedRoute allowedRoles={["101","102","104"]}><NrgpOut /></ProtectedRoute>} />


        {/* Cancel Gate Entry */}
        <Route path="/home/cancel-gate-entry" element={<ProtectedRoute allowedRoles={["101","104"]}><CancelGateEntry /></ProtectedRoute>} />
        <Route path="/home/cancel-weight-doc" element={<ProtectedRoute allowedRoles={["101","104"]}><CancelWeightDocument /></ProtectedRoute>} />
        <Route path="/home/reprint" element={<ProtectedRoute allowedRoles={["101","104","107"]}><ReprintGateEntry /></ProtectedRoute>} />
        {/* GRN Creation */}
        <Route path="/home/grncreate" element={<ProtectedRoute allowedRoles={["101","102","110"]}><GrnCreateByGateEntry /></ProtectedRoute>} />


      </Routes>
    </Router>
  );
}


