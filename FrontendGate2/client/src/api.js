// Fetch Stores & Consumable line items by parentUUID (SAP_UUID)
export function fetchScLineItems(parentUUID) {
  return api.get(`/gateentry/items?parentUUID=${parentUUID}`);
}

// Fetch RGP line items by header UUID (SAP_PARENT_UUID)
export function fetchRgpLineItems(uuid) {
  return api.get(`/rgpprocess/${uuid}/items`);
}

// Fetch NRGP line items by header UUID (SAP_PARENT_UUID)
// Duplicate declaration removed

// Update NRGP ReturnableQty for line items
export function updateNrgpReturnableQty(gateEntryNumber, items) {
  return api.patch(`/nrgpprocess/update-returnableqty/${gateEntryNumber}`, { items });
}
// Fetch vendor details by code or name
export function fetchVendorDetails({ code, name }) {
  const params = new URLSearchParams();
  if (code) params.set('code', code);
  if (name) params.set('name', name);
  return api.get(`/rgpprocess/vendors?${params.toString()}`);
}
import axios from 'axios';
//export const API_BASE = 'https://gateentry.cfapps.in30.hana.ondemand.com/api';
export const API_BASE = 'http://localhost:4600/api';
//export const API_BASE = 'https://gateentry-backend-latest.onrender.com/api';
const API_TIMEOUT_MS = 120000;

const api = axios.create({
  baseURL: API_BASE,
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(cfg => {
  console.log(`>> ${cfg.method?.toUpperCase()} ${cfg.url}`, cfg.data || cfg.params || {});
  return cfg;
});

api.interceptors.response.use(
  r => { console.log('<<', r.status, r.data); return r; },
  err => {
    const status = err?.response?.status;
    const requestUrl = err?.config?.url || '';
    const skipExpected404 = status === 404 && (
      err?.config?.meta?.suppressExpected404 === true ||
      requestUrl.includes('/po-permitnumber/')
    );

    if (!skipExpected404) {
      console.error('API ERR', status, err?.response?.data || err.message);
    }
    return Promise.reject(err);
  }
);

// Gate Entry functions
export function createHeader(payload) { 
  return api.post('/headers', payload); 
}

// Cash Purchase functions


export function fetchNextCashPurchaseGateNumber(year) {
  const params = {};
  if (year) params.year = year;
  const qs = new URLSearchParams(params).toString();
  return api.get(`/cashpurchase/next-gate-entry-number?${qs}`);
}

export function fetchNextGateNumber(year, code) {
  const params = {};
  if (year) params.year = year;
  if (code) params.code = code;
  const qs = new URLSearchParams(params).toString();
  return api.get(`/next-gatenumber?${qs}`);
}

// Material Movement functions
export function createMaterialInward(payload) {
  return api.post('/headers/material/in', payload);
}

export function createMaterialOutward(payload) {
  return api.post('/headers/material/out', payload);
}

export function createWeight(payload) {
  return api.post('/headers/material/in', payload);
}

export function fetchNextMaterialNumber(year, code) {
  const params = {};
  if (year) params.year = year;
  if (code) params.code = code;
  const qs = new URLSearchParams(params).toString();
  return api.get(`/next-materialnumber?${qs}`);
}

// Weight Doc Number - unified function with optional code parameter
export const fetchNextWeightDocNumber = (year, code) => {
  const params = new URLSearchParams();
  if (year) params.set('year', year);
  if (code != null) params.set('code', String(code));
  return api.get(`/next-weightnumber?${params.toString()}`);
};

// Alias for backward compatibility (optional)
export function fetchNextWeightNumber(year, code) {
  return fetchNextWeightDocNumber(year, code);
}

// Gate Entry lookup (used for other modules, not RGP Gate Out)
export const fetchGateEntryByNumber = (gateEntryNumberOrFilter) => {
  let filter;
  if (typeof gateEntryNumberOrFilter === 'string' && gateEntryNumberOrFilter.trim().startsWith('$filter=')) {
    // Use as raw OData filter (e.g., $filter=Status eq 'CANCELLED')
    filter = gateEntryNumberOrFilter + '&$format=json';
  } else {
    // Default: filter by GateEntryNumber
    filter = `$filter=GateEntryNumber eq '${gateEntryNumberOrFilter}'&$format=json`;
  }
  return api.get(`/headers?${filter}`);
};

// RGP-specific fetch by gate entry number (for RGP Gate Out)
// Duplicate removed: fetchRgpGateEntryByNumber

// Vehicle status IN means need to error
export const checkVehicleStatus = (VehicleNumber) => {
  return api.get(`/headers/vehiclestatus/${encodeURIComponent(VehicleNumber)}`);
};

// Update header by UUID or GateEntryNumber (backend supports both)
export const updateHeaderByKey = (key, data) =>
  api.patch(`/headers/${key}`, data);

// Fetch Material Inward by Gate Entry Number
// USE THE CORRECT ENDPOINT - singular "header" not "headers"
export const fetchMaterialInwardByGateNumber = (gateEntryNumber) => {
  // Send as query parameter to the WORKING backend endpoint
  return api.get(`/header/weightdetails?gateEntryNumber=${gateEntryNumber}`);
};

// Update Material Inward (for tare weight capture)
// ALSO FIX THIS - needs to match backend PATCH route
export function updateMaterialInward(uuid, payload) {
  // Clean UI-only fields
  const cleanPayload = { ...payload };
  delete cleanPayload._docType;
  delete cleanPayload.SAP_UUID;
  return api.patch(`/headers/material/${uuid}`, cleanPayload);
}

export const fetchPelletInWeightFromBridge = () => api.get('/pellet-in-weight');
export const fetchTareWeightFromBridge = () => api.get('/pallet-out-weight');
export const fetchGateInWaymentFromBridge = () => api.get('/gate-in-wayment');
export const fetchGateOutWaymentFromBridge = () => api.get('/gate-out-wayment');

export function updateobdMaterialOutward(uuid, payload) {
  // Clean UI-only fields
  const cleanPayload = { ...payload };
  delete cleanPayload._docType;
  delete cleanPayload.SAP_UUID;
  return api.patch(`/headers/material/obd/${uuid}`, cleanPayload);
} 

// Fetch Material Outward by Gate Entry Number (Indicators='O')
export const fetchMaterialOutwardByGateNumber = (gateEntryNumber) => {
  // Send as query parameter - backend will filter for Indicators='O'
  return api.get(`/header/weightdetails/outward?gateEntryNumber=${gateEntryNumber}`);
};


//Fetch details based on Vendor Invoice Number
export const fetchWeightDetailsByVendorInvoiceNumber = (VendorInvoiceNumber, params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      search.set(k, String(v));
    }
  });
  const qs = search.toString();
  return api.get(`/weightdetails/vendorinvoice/${VendorInvoiceNumber}${qs ? `?${qs}` : ''}`);
};

/**
 * Update only outward completion fields.
 * uuid: GUID of the header entity
 * payloadExtras: allow extension (e.g. Status flag) if needed
 */
export function updateGateEntryOutward(uuid, payloadExtras = {}) {
  const nowIso = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];
  const hh = String(new Date().getHours()).padStart(2, '0');
  const mm = String(new Date().getMinutes()).padStart(2, '0');
  const ss = String(new Date().getSeconds()).padStart(2, '0');
  const outwardTime = `${hh}:${mm}:${ss}`;

  const body = {
    OutwardTime: outwardTime,
    GateOutDate: today,           // Include if SAP model has this field
    SAP_ModifiedDateTime: nowIso, // If you track modified timestamp
    ...payloadExtras
  };
  return api.patch(`/headers/${uuid}`, body);
}

export function ITPPDFGenerate(id, payload) {
  return api.post(`/headers/${id}/pdf`, payload, { responseType: 'blob' });
}

export function initialRegistration(payload) { 
  return api.post('/initial-registration', payload); 
}


export function fetchsodetails(search) {
  return api.get(`/sodetails?search=${encodeURIComponent(search)}`);
}


///api/transporterdetails/:transporter
export function transporterDetails(search) { 
  return api.get(`/transporterdetails?search=${encodeURIComponent(search)}`); 
}

// Fetch transporter master list for dropdowns
export function fetchTransporters() {
  return api.get('/transporters');
}
// ...existing imports and code...

export function fetchInitialRegistrations(params = {}) {
  // params: { top?: number, search?: string, count?: boolean, $orderby?: string }
  const searchParams = new URLSearchParams();
  if (params.top) searchParams.set('top', String(params.top));
  if (params.search) searchParams.set('search', params.search);
  if (params.count != null) searchParams.set('count', String(!!params.count));
  if (params.$orderby) searchParams.set('$orderby', params.$orderby);
  const qs = searchParams.toString();
  return api.get(`/initial-registrations${qs ? `?${qs}` : ''}`);
}

export function fetchTruckRegistrations(params = {}) {
  // params: { top?: number, search?: string, count?: boolean }
  const searchParams = new URLSearchParams();
  if (params.top) searchParams.set('top', String(params.top));
  if (params.search) searchParams.set('search', params.search);
  if (params.count != null) searchParams.set('count', String(!!params.count));
  const qs = searchParams.toString();
  return api.get(`/truck-registrations${qs ? `?${qs}` : ''}`);
}

// Add PATCH to update Initial Registration (e.g., change Status)
export function updateInitialRegistration(uuid, payload) {
  return api.patch(`/initial-registration/${uuid}`, payload);
}

export function userCrenditials(username, password) {
  return api.post('/user-credentials', { username, password });
}
// Add this export at the end of api.jsx
export function sendEmailNotification(payload) {
  return api.post('/send-notification', payload);
}
// mail to be sent to the user
export function sendinitialusermail(payload) {
  return api.post('/initial/send-notification', payload);
}

// Add this before the export default api line (around line 140):

// Fetch Purchase Order details by PO Number
export function fetchPurchaseOrderByNumber(poNumber) {
  return api.get(`/purchaseorder/${poNumber}`);
}

export function fetchPurchaseOrderSuggestions(search) {
  return api.get(`/po-suggestions?query=${encodeURIComponent(search)}`);
}

// Fetch PO details by Permit Number (new endpoint)
export function fetchPurchaseOrderByPermitNumber(permitNumber) {
  return api.get(`/po-permitnumber/${permitNumber}`, {
    // A missing mapping is a common/expected state for many permit numbers.
    validateStatus: (status) => status === 200 || status === 404,
    meta: { suppressExpected404: true },
  });
}

// export function fetchPurchaseOrderSuggestions(search) {
//   return api.get(`/purchaseorders?search=${encodeURIComponent(search)}`);
// }
// Fetch Sales Order details by SO Number
// Fetch SO suggestions by partial number
export function fetchSalesOrderSuggestions(search) {
  return api.get(`/salesorders?search=${encodeURIComponent(search)}`);
}

export function fetchSalesOrderByNumber(soNumber) {
  return api.get(`/salesorders/${soNumber}`);
}
export function fetchSalesOrderDetails(soNumber) {
  return api.get(`/salesorder/${soNumber}`);
}

export function createOutboundDelivery(payload) {
  return api.post('/outbounddelivery', payload);
}

//Version 3: OBD and Material Outward Create
export function createOBDandMaterialOutwardCreate(payload) {
  return api.post('/materialoutward-full', payload);
}

export function updateOutboundDelivery(deliveryDocument, itemNumber, payload) {
  return api.patch(`/outbounddelivery/${deliveryDocument}/items/${itemNumber}`, payload);
}

// export function createGoodsIssue(payload) {
//   return api.post('/goodsissue-and-invoice', payload);
// }
export function createGoodsIssue(payload, options = {}) {
  return api.post('/goodsissue-and-invoice', payload, options);
}

// Add this to your api.js file:
export const fetchGateEntriesByPO = (poNumber) => {
  // Only filter on PurchaseOrderNumber (no suffixes)
  const filter = `$filter=PurchaseOrderNumber eq '${poNumber}'&$top=100`;
  return api.get(`/headers?${filter}`);
};

// RGP Process functions
export function fetchNextRgpGateEntryNumber() {
  return api.get('/rgpprocess/next-gate-entry-number');
}

export function createRgpGateEntry(payload) {
  return api.post('/rgpprocess', payload);
}

export function fetchRgpGateEntryByNumber(gateEntryNumber) {
  return api.get(`/rgpprocess/${gateEntryNumber}`);
}

export function updateRgpGateEntry(uuid, payload) {
  return api.patch(`/rgpprocess/${uuid}`, payload);
}

export function receiveRgpGateInItems(gateEntryNumber, payload) {
  return api.post(`/rgpprocess/${gateEntryNumber}/receive`, payload);
}

export function fetchAllRgpGateEntries() {
  return api.get('/rgpprocess');
}

// NRGP Process functions
export function fetchNextNrgpGateEntryNumber() {
  return api.get('/nrgpprocess/next-gate-entry-number');
}

// Fetch NRGP line items by header UUID (SAP_PARENT_UUID)
export function fetchNrgpLineItems(uuid) {
  return api.get(`/nrgpprocess/${uuid}/items`);
}

// PATCH ReturnableQty for NRGP Gate Out line items
// Duplicate declaration removed

// PATCH ReturnableQty for RGP Gate Out line items
export function updateRgpReturnableQty(gateEntryNumber, items) {
  return api.patch(`/rgpprocess/update-returnableqty/${gateEntryNumber}`, { items });
}
export function createNrgpGateEntry(payload) {
  return api.post('/nrgpprocess', payload);
}

export function fetchNrgpGateEntryByNumber(gateEntryNumber) {
  return api.get(`/nrgpprocess/${gateEntryNumber}`);
}

export function fetchAllNrgpGateEntries() {
  return api.get('/nrgpprocess');
}

export function createCashPurchaseEntry(payload) {
  // Duplicate removed. Only keep the top declaration.
}

export function productSearch(query) {
  return api.get(`/products?search=${encodeURIComponent(query)}`);
}
//grn creation function
export function createGrn(payload) {
  return api.post('/create-grn', payload);
}

//suppler and customer details function
export function fetchSupplierCustomerDetails(search) { 
  return api.get(`/supplier-customer?search=${encodeURIComponent(search)}`); 
}
export function saveRgpGateOut({ header, items }) {
  // Backend expects GateEntryNumber, VehicleStatus, OutwardTime at top-level, not nested in header
  // See rgpprocess.js for reference
    if (!header || !header.GateEntryNumber) throw new Error('Missing GateEntryNumber');
    if (!header.VehicleStatus) throw new Error('Missing VehicleStatus');
    if (!header.OutwardTime) throw new Error('Missing OutwardTime');
    // Ensure ReturnableQty is sent as number
    const cleanItems = Array.isArray(items)
      ? items.map(item => ({ ...item, ReturnableQty: Number(item.ReturnableQty) }))
      : [];
    return api.post('/rgpprocess/gateout', {
      GateEntryNumber: header.GateEntryNumber,
      VehicleStatus: header.VehicleStatus,
      OutwardTime: header.OutwardTime,
      items: cleanItems,
    });
}
export default api;