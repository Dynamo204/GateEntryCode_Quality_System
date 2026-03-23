import React from "react";
import { useNavigate } from "react-router-dom";
import "./CreateHeader.css";

export default function RgpProcessHome() {
  const navigate = useNavigate();

  return (
    <div className="movein-container">
      <div className="movein-header">
        <h2>RGP Process - Select Operation</h2>
      </div>

      <div className="movein-actions">
          <button onClick={() => navigate("/home/rgp/process/entry")} className="action-button">
            RGP Entry
          </button>
          <button onClick={() => navigate("/home/rgp/process/gate-out")} className="action-button">
            RGP Gate Out
          </button>
          <button onClick={() => navigate("/home/rgp/process/gate-out")} className="action-button">
            RGP Gate In
          </button>
      </div>
    </div>
  );
}
