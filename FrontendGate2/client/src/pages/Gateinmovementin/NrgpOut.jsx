import React, { useState } from "react";
import { fetchNrgpGateEntryByNumber, fetchNrgpLineItems, updateNrgpReturnableQty } from "../../api";
import "./CreateHeader.css";
import "./RgpProcess.css";

export default function NrgpOut() {
	const formatToIST = (timeValue) => {
		if (!timeValue) return "";

		// OData V2 date format: /Date(1731398400000)/
		const odataDateMatch = String(timeValue).match(/\/Date\((\d+)\)\//);
		if (odataDateMatch) {
			const dt = new Date(Number(odataDateMatch[1]));
			return dt.toLocaleTimeString("en-IN", {
				timeZone: "Asia/Kolkata",
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				hour12: true,
			}) + " IST";
		}

		// SAP duration format: PT14H27M00S
		if (String(timeValue).startsWith("PT")) {
			const h = Number((String(timeValue).match(/(\d+)H/) || [])[1] || 0);
			const m = Number((String(timeValue).match(/(\d+)M/) || [])[1] || 0);
			const s = Number((String(timeValue).match(/(\d+)S/) || [])[1] || 0);

			// Treat SAP duration as UTC clock time and convert to IST (+05:30)
			const totalSecondsUtc = (h * 3600) + (m * 60) + s;
			const totalSecondsIst = (totalSecondsUtc + (5 * 3600) + (30 * 60)) % (24 * 3600);
			const istH = Math.floor(totalSecondsIst / 3600);
			const istM = Math.floor((totalSecondsIst % 3600) / 60);
			const istS = totalSecondsIst % 60;

			const dt = new Date();
			dt.setHours(istH, istM, istS, 0);
			return dt.toLocaleTimeString("en-IN", {
				timeZone: "Asia/Kolkata",
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				hour12: true,
			}) + " IST";
		}

		return String(timeValue);
	};

	const formatApiError = (errLike) => {
		if (!errLike) return "Unknown error";
		if (typeof errLike === "string") return errLike;
		const messageValue = errLike?.error?.message?.value;
		if (messageValue) return messageValue;
		if (errLike?.message) return errLike.message;
		try {
			return JSON.stringify(errLike);
		} catch {
			return String(errLike);
		}
	};

	// Save NRGP Gate Out
	const handleSave = async () => {
		setLoading(true);
		setError("");
		setSuccess(false);
		try {
			const vehicleStatus = String(entryData?.VehicleStatus || entryData?.['d:VehicleStatus'] || '').toUpperCase();
			if (vehicleStatus === 'OUT') {
				setError('This vehicle was already OUT.');
				setLoading(false);
				return;
			}

			// Only PATCH ReturnableQty for line items
			const patchItems = lineItems.map(item => ({
				SAP_UUID: item.SAP_UUID || item.sap_uuid || item.uuid,
				ReturnableQty: item.ReturnableQty === "" ? null : Number(item.ReturnableQty)
			})).filter(i => i.SAP_UUID);
			if (patchItems.length === 0) {
				setError("No valid line items to update (missing SAP_UUID).");
				setLoading(false);
				return;
			}
			if (patchItems.some(i => i.ReturnableQty == null || Number.isNaN(i.ReturnableQty))) {
				setError("Please enter a valid Returnable Qty for all rows before saving.");
				setLoading(false);
				return;
			}
			// Call PATCH endpoint
			let patchRes;
			try {
				patchRes = await updateNrgpReturnableQty(entryData.GateEntryNumber, patchItems);
			} catch (err) {
				const backendErr = err?.response?.data?.error || err?.message || err;
				setError("Failed to update ReturnableQty: " + formatApiError(backendErr));
				setLoading(false);
				return;
			}
			if (patchRes?.data?.error) {
				setError("Failed to update ReturnableQty: " + formatApiError(patchRes.data.error));
				setLoading(false);
				return;
			}
			if (patchRes?.data?.updated?.some(r => r.status === "error")) {
				const firstErr = patchRes.data.updated.find(r => r.status === "error");
				setError("Failed to update ReturnableQty: " + formatApiError(firstErr?.error));
				setLoading(false);
				return;
			}
			setSuccess(true);
		} catch (err) {
			setError(formatApiError(err));
		}
		setLoading(false);
	};

	const [gateEntryNum, setGateEntryNum] = useState("");
	const [entryData, setEntryData] = useState(null);
	const [lineItems, setLineItems] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);

	// Fetch NRGP entry and line items
	const handleFetch = async () => {
		setLoading(true);
		setError("");
		setSuccess(false);
		setEntryData(null);
		setLineItems([]);
		try {
			const headerRes = await fetchNrgpGateEntryByNumber(gateEntryNum);
			const header = headerRes?.data?.d?.results?.[0] || headerRes?.data || null;
			if (!header) throw new Error("No header found");
			const vehicleStatus = String(header?.VehicleStatus || header?.['d:VehicleStatus'] || '').toUpperCase();
			if (vehicleStatus === 'OUT') {
				setError('This vehicle was already OUT.');
				setLoading(false);
				return;
			}
			setEntryData(header);
			let itemsRes;
			if (header.GateEntryNumber) {
				itemsRes = await fetchNrgpLineItems(header.GateEntryNumber);
			} else if (header.SAP_PARENT_UUID) {
				itemsRes = await fetchNrgpLineItems(header.SAP_PARENT_UUID);
			} else if (header.SAP_UUID) {
				itemsRes = await fetchNrgpLineItems(header.SAP_UUID);
			} else {
				throw new Error("No valid identifier for line item fetch");
			}
			let items = itemsRes?.data?.d?.results || itemsRes?.data?.items || itemsRes?.data || [];
			if (!Array.isArray(items)) items = [];
			items = items.map((item, idx) => ({
				SAP_UUID: item.SAP_UUID || item.sap_uuid || item.uuid || item['d:SAP_UUID'] || item['SAP_UUID'] || item['Guid'] || item['d:Guid'] || "",
				Material: item.Material || item.material || item['d:Material'] || "",
				MaterialDescription: item.MaterialDescription || item.materialDescription || item['d:MaterialDescription'] || "",
				ReturnableQty: item.ReturnableQty ?? item.returnableQty ?? item['d:ReturnableQty'] ?? item.Quantity ?? item.quantity ?? item['d:Quantity'] ?? "",
				UOM: item.UOM || item.uom || item.UnitOfMeasure || item['d:UOM'] || "",
				ApproximateValue: item.ApproximateValue ?? item.approximateValue ?? item.Value ?? item['d:ApproximateValue'] ?? "",
				Remarks: item.Remarks || item.remarks || item['d:Remarks'] || "",
				Purpose: item.Purpose || item.purpose || item['d:Purpose'] || "",
				idx: idx + 1,
			}));
			setLineItems(items);
			if (items.length === 0) setError("No line items found for this entry.");
		} catch (err) {
			setError(err?.message || "Failed to fetch entry or line items.");
		}
		setLoading(false);
	};

	return (
		<div className="rgp-container">
			<div className="rgp-header">
				<h2>NRGP Gate Out</h2>
			</div>
			<div className="action-section" style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px'}}>
				<input
					type="text"
					value={gateEntryNum}
					onChange={e => setGateEntryNum(e.target.value)}
					className="input-field"
					style={{width: '160px', flex: '0 0 160px' }}
				/>
				<button onClick={handleFetch} disabled={loading || !gateEntryNum} className="submit-btn" style={{height: '36px', minWidth: '120px', marginBottom: '0'}}>
					Fetch Entry
				</button>
			</div>
			<div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '10px'}}>
				<div className="form-group" style={{marginBottom: '0'}}>
					<label className="form-label" style={{marginBottom: '2px'}}>Plant</label>
					<input type="text" className="form-input" value={entryData?.Plant || ''} readOnly style={{ backgroundColor: '#f0f0f0', marginBottom: '0' }} />
				</div>
				<div className="form-group" style={{marginBottom: '0'}}>
					<label className="form-label" style={{marginBottom: '2px'}}>Vendor</label>
					<input type="text" className="form-input" value={entryData?.Vendor || ''} readOnly style={{ backgroundColor: '#f0f0f0', marginBottom: '0' }} />
				</div>
				<div className="form-group" style={{marginBottom: '0'}}>
					<label className="form-label" style={{marginBottom: '2px'}}>Vehicle Number</label>
					<input type="text" className="form-input" value={entryData?.VehicleNumber || ''} readOnly style={{ backgroundColor: '#f0f0f0', marginBottom: '0' }} />
				</div>
			</div>
			{loading && <div className="loading-indicator">Loading...</div>}
			{error && <div className="error-message">{error}</div>}
			{entryData && (
				<div className="rgp-entry-details">
					<div className="details-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '16px'}}>
						<div className="form-group">
							<label className="form-label">Inward Time</label>
							<input type="text" className="form-input" value={formatToIST(entryData.InwardTime || entryData['d:InwardTime'])} readOnly style={{ backgroundColor: '#f0f0f0' }} />
						</div>
						<div className="form-group">
							<label className="form-label">Outward Time</label>
							<input type="text" className="form-input" value={formatToIST(entryData.OutwardTime || entryData['d:OutwardTime'])} readOnly style={{ backgroundColor: '#f0f0f0' }} />
						</div>
						<div className="form-group">
							<label className="form-label">Remarks</label>
							<input type="text" className="form-input" value={entryData.Remarks || entryData['d:Remarks'] || ''} readOnly style={{ backgroundColor: '#f0f0f0' }} />
						</div>
						<div className="form-group">
							<label className="form-label">Requisitioner</label>
							<input type="text" className="form-input" value={entryData.Requisitioner || entryData['d:Requisitioner'] || ''} readOnly style={{ backgroundColor: '#f0f0f0' }} />
						</div>
						<div className="form-group">
							<label className="form-label">Transport Mode</label>
							<input type="text" className="form-input" value={entryData.TransportMode || entryData['d:TransportMode'] || ''} readOnly style={{ backgroundColor: '#f0f0f0' }} />
						</div>
						<div className="form-group">
							<label className="form-label">Department</label>
							<input type="text" className="form-input" value={entryData.Department || entryData['d:Department'] || ''} readOnly style={{ backgroundColor: '#f0f0f0' }} />
						</div>
					</div>
					<h3>Line Items</h3>
					<div className="table-section">
						<table className="rgp-table">
							<thead>
								<tr>
									<th>#</th>
									<th>Material Code</th>
									<th>Description</th>
									<th>Returnable Qty</th>
									<th>UOM</th>
									<th>Approx. Value</th>
									<th>Remarks</th>
									<th>Purpose</th>
								</tr>
							</thead>
							<tbody>
								{lineItems.map((item, idx) => (
									<tr key={idx}>
										<td>{idx + 1}</td>
										<td>{item.Material}</td>
										<td>{item.MaterialDescription}</td>
										<td>
											<input
												type="number"
												min="0"
												step="0.01"
												value={item.ReturnableQty}
												onChange={e => {
													const newQty = e.target.value;
													setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, ReturnableQty: newQty } : li));
												}}
												style={{ width: '80px', textAlign: 'right' }}
											/>
										</td>
										<td>{item.UOM}</td>
										<td>{item.ApproximateValue}</td>
										<td>{item.Remarks}</td>
										<td>{item.Purpose}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<button
						onClick={handleSave}
						disabled={loading || String(entryData?.VehicleStatus || entryData?.['d:VehicleStatus'] || '').toUpperCase() === 'OUT'}
						className="submit-btn"
					>
						Save Gate Out
					</button>
					{success && <div className="success-message">Gate Out saved successfully!</div>}
				</div>
			)}
		</div>
	);
}
