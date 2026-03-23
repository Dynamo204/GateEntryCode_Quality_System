const express = require("express");
const net = require("net");

const router = express.Router();

// Client Public IP (Weighbridge / Local Server)
const W1_HOST = "192.168.10.22";
const W2_HOST = "192.168.10.23";
const W3_HOST = "192.168.10.22";
const W4_HOST = "192.168.10.23";
const CLIENT_PORT = 2191;

// TCP connection timeout
const TCP_TIMEOUT = 10000;

function readWeightFromClient(host = W3_HOST) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let data = "";

    client.setTimeout(TCP_TIMEOUT);

    client.connect(CLIENT_PORT, host, () => {
      console.log(`[WEIGHBRIDGE] Connected to weighbridge ${host}:${CLIENT_PORT}`);
    });

    client.on("data", (chunk) => {
      data += chunk.toString();
      console.log("[WEIGHBRIDGE] Raw data received:", data);
      client.destroy();
    });

    client.on("close", () => {
      if (data) {
        resolve({ weight: data.trim(), timestamp: new Date().toISOString() });
      } else {
        reject(new Error("No data received from weighbridge"));
      }
    });

    client.on("error", (err) => {
      console.error("[WEIGHBRIDGE] TCP Error:", err.message);
      reject(err);
    });

    client.on("timeout", () => {
      console.error("[WEIGHBRIDGE] TCP Timeout");
      client.destroy();
      reject(new Error("Connection timeout"));
    });
  });
}

// Health check for weighbridge route
router.get("/api/weightbridge/healthhh", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Weighbridge route is running",
  });
});

// Pellet In: inward/gross weighbridge mapped to W3
router.get("/api/pellet-in-weight", async (req, res) => {
  try {
    const weightData = await readWeightFromClient(W3_HOST);
    res.status(200).json({ status: "SUCCESS", data: weightData });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: "Failed to fetch weight data from client",
      error: error?.message || "Unknown error",
    });
  }
});

// Pallet Out: outward/tare weighbridge mapped to W4
router.get("/api/pallet-out-weight", async (req, res) => {
  try {
    const weightData = await readWeightFromClient(W4_HOST);
    res.status(200).json({ status: "SUCCESS", data: weightData });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: "Failed to fetch tare weight data from client",
      error: error?.message || "Unknown error",
    });
  }
});

// Gate In wayment: W1 bridge for specific movement screens
router.get("/api/gate-in-wayment", async (req, res) => {
  try {
    const weightData = await readWeightFromClient(W1_HOST);
    res.status(200).json({ status: "SUCCESS", data: weightData });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: "Failed to fetch gate in wayment data from client",
      error: error?.message || "Unknown error",
    });
  }
});

// Gate Out wayment: W2 bridge for specific movement screens
router.get("/api/gate-out-wayment", async (req, res) => {
  try {
    const weightData = await readWeightFromClient(W2_HOST);
    res.status(200).json({ status: "SUCCESS", data: weightData });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: "Failed to fetch gate out wayment data from client",
      error: error?.message || "Unknown error",
    });
  }
});

// Backward-compatible aliases
router.get("/api/read-weight", async (req, res) => {
  try {
    const weightData = await readWeightFromClient(W3_HOST);
    res.status(200).json({ status: "SUCCESS", data: weightData });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: "Failed to fetch weight data from client",
      error: error?.message || "Unknown error",
    });
  }
});

router.get("/api/read-tare", async (req, res) => {
  try {
    const weightData = await readWeightFromClient(W4_HOST);
    res.status(200).json({ status: "SUCCESS", data: weightData });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: "Failed to fetch tare weight data from client",
      error: error?.message || "Unknown error",
    });
  }
});

// Alias endpoint maintained for compatibility
router.get("/weight", async (req, res) => {
  try {
    const weightData = await readWeightFromClient(W3_HOST);
    res.status(200).json({ status: "SUCCESS", data: weightData });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: "Failed to fetch weight data from client",
      error: error?.message || "Unknown error",
    });
  }
});

module.exports = router;
