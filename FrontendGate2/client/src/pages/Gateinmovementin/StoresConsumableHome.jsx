import React from "react";
import { useNavigate } from "react-router-dom";
import "./StoresConsumableHome.css";

export default function StoresConsumableHome() {
  const navigate = useNavigate();

  return (
    <div className="stores-consumable-home-container">
      <div className="stores-consumable-home-header">
        <h2 className="stores-consumable-home-title">Stores & Consumable - Select Operation</h2>
      </div>

      <div className="stores-consumable-home-content">
        <div className="stores-consumable-home-cards">
          <div 
            className="stores-consumable-home-card"
            onClick={() => navigate("/stores-consumable-entry")}
          >
            <h2 className="stores-consumable-home-card-title">Stores & Consumable Entry</h2>
          </div>

          <div 
            className="stores-consumable-home-card"
            onClick={() => navigate("/stores-consumable-outward")}
          >
            <h2 className="stores-consumable-home-card-title">Stores & Consumable Out</h2>
          </div>
        </div>
      </div>

    </div>
  );
}
