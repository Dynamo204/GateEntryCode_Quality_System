import React from "react";
import { useNavigate } from "react-router-dom";
import "./CreateHeader.css";

export default function NrgpProcessHome() {
  const navigate = useNavigate();

  return (
    <div className="movein-container">
      <div className="movein-header">
        <h2>NRGP Process - Select Operation</h2>
      </div>

      <div className="movein-actions">
        <button onClick={() => navigate("/home/nrgp/process/entry")} className="action-button">
          NRGP Entry
        </button>
        <button onClick={() => navigate("/home/nrgp/process/gate-out")} className="action-button">
          NRGP Gate Out
        </button>
      </div>
    </div>
  );
}
