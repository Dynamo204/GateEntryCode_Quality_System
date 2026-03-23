import React from "react";
import { useNavigate } from "react-router-dom";
import "./CreateHeader.css";

export default function RgpNrgpHome() {
  const navigate = useNavigate();

  return (
    <div className="movein-container">
      <div className="movein-header">
        <h2>RGP & NRGP Process - Select Type</h2>
      </div>

      <div className="movein-actions">
        <button onClick={() => navigate("/home/rgp/process")} className="action-button">
          RGP Process
        </button>
        <button onClick={() => navigate("/home/nrgp/process")} className="action-button">
          NRGP Process
        </button>
      </div>

      <div style={{ marginTop: "20px", textAlign: "center" }}>
        
      </div>
    </div>
  );
}
