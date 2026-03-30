const express = require("express");
const net = require("net");
const { print, getPrinters } = require("pdf-to-printer");
const fs = require("fs");
const path = require("path");
const os = require("os");


const API_KEY = process.env.PRINTER_API_KEY || "your-strong-secret-key";

// Middleware to check API key
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) {
    return res.status(403).json({ status: "ERROR", message: "Forbidden: Invalid API key" });
  }
  next();
}

const router = express.Router();

// =======================================================
// PRINTER CONFIGURATION
// =======================================================
const PRINTER_IP   = process.env.PRINTER_HOST || "136.233.76.90";
const PRINTER_RAW  = parseInt(process.env.PRINTER_RAW_PORT  || "9100", 10);
const PRINTER_LPR  = parseInt(process.env.PRINTER_LPR_PORT  || "515",  10);
const PRINTER_QUEUE = process.env.PRINTER_QUEUE || "lp";
// Windows printer name (as shown in Control Panel → Devices & Printers).
// Leave blank to use the system default printer.
const PRINTER_NAME = process.env.PRINTER_NAME || "";
const PRINTER_LPR_QUEUES = (process.env.PRINTER_LPR_QUEUES || "")
  .split(",")
  .map((q) => q.trim())
  .filter(Boolean);

function printerLog(message, data) {
  const timestamp = new Date().toISOString();
  if (typeof data === "undefined") {
    console.log(`[PRINTER] ${timestamp} ${message}`);
    return;
  }
  console.log(`[PRINTER] ${timestamp} ${message}`, data);
}

// Check if a TCP port is reachable
function isPortOpen(ip, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.on("connect", () => { socket.destroy(); resolve(true); });
    socket.on("timeout",  () => { socket.destroy(); resolve(false); });
    socket.on("error",    () => { socket.destroy(); resolve(false); });
    socket.connect(port, ip);
  });
}

// Send PDF via RAW / JetDirect (port 9100) — simple TCP write
function sendRaw(buffer, ip, port) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let hasError = false;

    client.setTimeout(5000);

    client.on("connect", () => {
      printerLog("RAW connected, sending buffer", { ip, port, bytes: buffer.length });
      client.write(buffer, (err) => {
        if (err) {
          hasError = true;
          reject(new Error(`RAW write failed: ${err.message}`));
        } else {
          printerLog("RAW buffer written successfully");
        }
      });
    });

    client.on("close", () => {
      if (!hasError) {
        resolve(`RAW print sent to ${ip}:${port}`);
      }
    });

    client.on("error", (err) => {
      hasError = true;
      reject(new Error(`RAW error: ${err.message}`));
    });

    client.on("timeout", () => {
      hasError = true;
      client.destroy();
      reject(new Error("RAW connection timeout"));
    });

    client.connect(port, ip);
  });
}

// Send PDF via LPR (port 515) — Berkeley print protocol (SIMPLIFIED FOR RELIABILITY)
function sendLpr(buffer, ip, port, queue, fileName, lprMode = "l") {
  const safeFile = (fileName || "GateEntrySlip.pdf").replace(/[^a-zA-Z0-9_.-]/g, "_");
  const jobId    = String(Date.now() % 1000).padStart(3, "0");
  const hostTag  = "minera";
  const ctrlFile = `cfA${jobId}${hostTag}`;
  const dataFile = `dfA${jobId}${hostTag}`;
  const mode = ["f", "l"].includes(lprMode) ? lprMode : "l";
  const ctrl     = [`H${hostTag}`, "Pminera", `J${safeFile}`, `${mode}${dataFile}`, `U${dataFile}`, `N${safeFile}`, ""].join("\n");

  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    sock.setTimeout(15000); // Increased timeout
    let hasError = false;

    const writeChunk = (chunk) => new Promise((res, rej) => {
      sock.write(chunk, (e) => {
        if (e) {
          hasError = true;
          rej(e);
        } else {
          res();
        }
      });
    });

    const waitAck = (stage) => new Promise((res, rej) => {
      const onData = (chunk) => {
        cleanup();
        if (chunk && chunk.length > 0 && chunk[0] === 0x00) {
          res();
        } else {
          rej(new Error(`LPR ${stage}: got ack=${chunk ? chunk[0] : 'null'}`));
        }
      };
      const onErr = (e) => { cleanup(); rej(new Error(`LPR ${stage}: ${e.message}`)); };
      const onTmo = ()  => { cleanup(); rej(new Error(`LPR ${stage}: timeout`)); };
      const cleanup = () => { sock.off("data", onData); sock.off("error", onErr); sock.off("timeout", onTmo); };
      
      sock.once("data", onData);
      sock.once("error", onErr);
      sock.once("timeout", onTmo);
    });

    sock.on("error", (err) => {
      hasError = true;
      reject(new Error(`LPR connection error: ${err.message}`));
    });

    sock.on("timeout", () => {
      hasError = true;
      sock.destroy();
      reject(new Error("LPR socket timeout"));
    });

    sock.connect(port, ip, async () => {
      try {
        printerLog("LPR connected", { ip, port, queue });
        
        await writeChunk(Buffer.from(`\x02${queue}\n`));
        await waitAck("job-start");
        
        await writeChunk(Buffer.from(`\x02${Buffer.byteLength(ctrl)} ${ctrlFile}\n`));
        await waitAck("ctrl-hdr");
        
        await writeChunk(Buffer.from(ctrl));
        await writeChunk(Buffer.from([0x00]));
        await waitAck("ctrl-data");
        
        await writeChunk(Buffer.from(`\x03${buffer.length} ${dataFile}\n`));
        await waitAck("data-hdr");
        
        await writeChunk(buffer);
        await writeChunk(Buffer.from([0x00]));
        await waitAck("data-end");
        
        sock.end();
        if (!hasError) {
          printerLog("LPR print completed", { queue, mode, bytes: buffer.length });
          resolve(`LPR print sent to ${ip}:${port} queue=${queue}`);
        }
      } catch (e) {
        if (!hasError) {
          hasError = true;
          sock.destroy();
          reject(e);
        }
      }
    });
  });
}

// =======================================================
// PDF PRINT via Windows Print Driver (pdf-to-printer)
// =======================================================
// This is the CORRECT way to print PDFs on Windows.
// The OS driver converts PDF → PCL before sending to the printer,
// so the printer receives exactly what it understands — no garbage pages.
async function printPdfViaDriver(buffer, fileName) {
  const safeName = (fileName || "GateEntrySlip.pdf").replace(/[^a-zA-Z0-9_.-]/g, "_");
  const tempPath = path.join(os.tmpdir(), `minera_${Date.now()}_${safeName}`);

  printerLog("PDF print via Windows driver", { tempPath, bytes: buffer.length, printer: PRINTER_NAME || "(default)" });

  try {
    fs.writeFileSync(tempPath, buffer);
    const options = PRINTER_NAME ? { printer: PRINTER_NAME } : {};
    await print(tempPath, options);
    printerLog("PDF print driver call succeeded");
    return `PDF printed via system driver${PRINTER_NAME ? ` to "${PRINTER_NAME}"` : " (default printer)"}`;
  } finally {
    try { fs.unlinkSync(tempPath); } catch (_) {}
  }
}

// =======================================================
// TEXT PRINT via RAW socket (for plain-text test slips)
// =======================================================
async function printTextViaRaw(buffer, fileName) {
  printerLog("Text print via RAW socket", { ip: PRINTER_IP, port: PRINTER_RAW, bytes: buffer.length });

  const rawOpen = await isPortOpen(PRINTER_IP, PRINTER_RAW);
  if (rawOpen) {
    try {
      return await sendRaw(buffer, PRINTER_IP, PRINTER_RAW);
    } catch (err) {
      printerLog("RAW failed, trying LPR", { error: err.message });
    }
  }

  const lprOpen = await isPortOpen(PRINTER_IP, PRINTER_LPR);
  if (lprOpen) {
    const queueOrder = [PRINTER_QUEUE, ...PRINTER_LPR_QUEUES, "lp", "LPR", "raw", "print"]
      .filter((q, idx, arr) => q && arr.indexOf(q) === idx);
    for (const queue of queueOrder) {
      try {
        return await sendLpr(buffer, PRINTER_IP, PRINTER_LPR, queue, fileName, "f");
      } catch (err) {
        printerLog("LPR attempt failed", { queue, error: err?.message });
      }
    }
    throw new Error("LPR reachable but all queue attempts failed");
  }

  throw new Error(`Printer offline at ${PRINTER_IP} — RAW(${PRINTER_RAW}) and LPR(${PRINTER_LPR}) both unreachable.`);
}

// GET /api/printer/health — connectivity check
router.get("/api/printer/health", async (req, res) => {
  try {
    printerLog("Health check initiated");

    // List Windows printers visible to the driver
    let windowsPrinters = [];
    try {
      windowsPrinters = await getPrinters();
    } catch (_) {}

    const rawOnline = await isPortOpen(PRINTER_IP, PRINTER_RAW);
    const lprOnline = await isPortOpen(PRINTER_IP, PRINTER_LPR);

    const anyOnline = rawOnline || lprOnline || windowsPrinters.length > 0;
    const status = anyOnline ? "HEALTHY" : "OFFLINE";

    printerLog("Health check result", { status, ip: PRINTER_IP, windowsPrinters: windowsPrinters.map(p => p.name) });

    res.status(anyOnline ? 200 : 503).json({
      status,
      message: anyOnline
        ? "Printer system is reachable"
        : `Printer ${PRINTER_IP} is OFFLINE`,
      ip: PRINTER_IP,
      configuredPrinterName: PRINTER_NAME || "(default — first available Windows printer)",
      windowsPrinters: windowsPrinters.map(p => p.name),
      socketPorts: [
        { port: PRINTER_RAW, protocol: "RAW (JetDirect)", online: rawOnline },
        { port: PRINTER_LPR, protocol: "LPR (Berkeley)",  online: lprOnline },
      ],
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    printerLog("Health check error", { error: error?.message });
    res.status(500).json({ status: "ERROR", message: "Health check failed", error: error?.message });
  }
});

// POST /api/printer/print — print PDF (base64) or plain text
router.post("/api/printer/print", requireApiKey, async (req, res) => {
  const requestId = Date.now();
  
  try {
    const { pdfBase64, slipText, fileName } = req.body || {};
    const requestedFileName = fileName || "GateEntrySlip.pdf";

    printerLog(`[REQ-${requestId}] Print request received`, {
      fileName: requestedFileName,
      hasPdf: !!pdfBase64,
      hasText: !!slipText,
      printer: { ip: PRINTER_IP, rawPort: PRINTER_RAW, lprPort: PRINTER_LPR }
    });

    // Validate input
    const hasPdf = typeof pdfBase64 === "string" && pdfBase64.trim().length > 0;
    const hasSlipText = typeof slipText === "string" && slipText.trim().length > 0;

    if (!hasPdf && !hasSlipText) {
      printerLog(`[REQ-${requestId}] Invalid input: no content`, {});
      return res.status(400).json({
        status: "ERROR",
        message: "Print failed: No content provided",
        error: "Both pdfBase64 and slipText are empty. Please provide at least one.",
      });
    }

    // -------------------------------------------------------
    // PDF → Windows print driver (correct — 1 clean page)
    // Text → RAW socket (plain text, e.g. test prints)
    // -------------------------------------------------------
    if (hasPdf) {
      let pdfBuffer;
      try {
        const normalizedBase64 = pdfBase64.includes(",") ? pdfBase64.split(",").pop() : pdfBase64;
        pdfBuffer = Buffer.from(normalizedBase64, "base64");
        if (!pdfBuffer || pdfBuffer.length === 0) {
          printerLog(`[REQ-${requestId}] PDF decode failed: empty buffer`, {});
          return res.status(400).json({
            status: "ERROR",
            message: "Print failed: Invalid PDF data",
            error: "PDF base64 decoded to empty buffer. Check PDF encoding.",
          });
        }
        printerLog(`[REQ-${requestId}] PDF buffer decoded`, { bytes: pdfBuffer.length });
      } catch (decodeErr) {
        printerLog(`[REQ-${requestId}] Base64 decode error`, { error: decodeErr.message });
        return res.status(400).json({
          status: "ERROR",
          message: "Print failed: PDF decode error",
          error: `Invalid base64 PDF data: ${decodeErr.message}`,
        });
      }

      try {
        const message = await printPdfViaDriver(pdfBuffer, requestedFileName);
        printerLog(`[REQ-${requestId}] PDF print successful`, { message });
        return res.status(200).json({
          status: "SUCCESS",
          message: message,
          data: {
            fileName: requestedFileName,
            bytes: pdfBuffer.length,
            type: "pdf",
            printedAt: new Date().toISOString(),
          },
        });
      } catch (printErr) {
        printerLog(`[REQ-${requestId}] PDF print failed`, { error: printErr?.message });
        return res.status(503).json({
          status: "ERROR",
          message: "PDF print failed",
          error: printErr?.message || "Unable to print PDF. Check printer is set as default or set PRINTER_NAME env variable.",
        });
      }
    }

    // Plain text path (only for slipText)
    const normalizedText = slipText.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
    const textBuffer = Buffer.from(`${normalizedText}\r\n\r\n\f`, "utf8");
    printerLog(`[REQ-${requestId}] Text buffer prepared`, { bytes: textBuffer.length });

    try {
      const message = await printTextViaRaw(textBuffer, requestedFileName);
      printerLog(`[REQ-${requestId}] Text print successful`, { message });
      return res.status(200).json({
        status: "SUCCESS",
        message: message,
        data: {
          fileName: requestedFileName,
          bytes: textBuffer.length,
          type: "text",
          printedAt: new Date().toISOString(),
        },
      });
    } catch (printErr) {
      printerLog(`[REQ-${requestId}] Text print failed`, { error: printErr?.message });
      return res.status(503).json({
        status: "ERROR",
        message: "Print failed: Printer unreachable",
        error: printErr?.message || "Unable to send data to printer. Check printer connection.",
      });
    }
  } catch (error) {
    printerLog(`[REQ-${requestId}] Unhandled error`, { error: error?.message });
    res.status(500).json({
      status: "ERROR",
      message: "Print request failed",
      error: error?.message || "Internal server error",
    });
  }
});

// POST /api/printer/test-text — direct plain text printer test
router.post("/api/printer/test-text", requireApiKey, async (req, res) => {
  const requestId = Date.now();
  
  try {
    printerLog(`[TEST-${requestId}] Test print initiated`);
    
    const bodyText = [
      "====================================",
      "   MINERA PRINTER TEST",
      "====================================",
      `Time: ${new Date().toISOString()}`,
      "",
      "If you see this on paper,",
      "the printer is working correctly!",
      "",
      "====================================",
      "Test completed successfully",
      "====================================",
    ].join("\r\n");

    const buffer = Buffer.from(`${bodyText}\r\n\r\n\f`, "utf8");
    
    printerLog(`[TEST-${requestId}] Test buffer ready`, { bytes: buffer.length });
    
    const message = await printTextViaRaw(buffer, "Minera_Printer_Test.txt");

    printerLog(`[TEST-${requestId}] Test print successful`, { message });
    
    res.status(200).json({
      status: "SUCCESS",
      message: message,
      data: {
        bytes: buffer.length,
        type: "text",
        testCompletedAt: new Date().toISOString(),
        instruction: "Check the printer tray for the test slip. If you see it, your printer is working correctly.",
      },
    });
  } catch (error) {
    printerLog(`[TEST-${requestId}] Test print failed`, { error: error?.message });
    res.status(503).json({
      status: "ERROR",
      message: "Test print failed",
      error: error?.message || "Unable to send test to printer",
      troubleshooting: "1. Check printer power is on\n2. Check network cable is connected\n3. Verify printer IP is " + PRINTER_IP + "\n4. Check firewall rules allow ports " + PRINTER_RAW + " (RAW) and " + PRINTER_LPR + " (LPR)",
    });
  }
});

// GET /api/printer/diagnostics — comprehensive diagnostics
router.get("/api/printer/diagnostics", async (req, res) => {
  try {
    printerLog("Diagnostics check initiated");
    
    const rawOpen = await isPortOpen(PRINTER_IP, PRINTER_RAW);
    const lprOpen = await isPortOpen(PRINTER_IP, PRINTER_LPR);
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      printerIP: PRINTER_IP,
      connectivity: {
        raw: { port: PRINTER_RAW, protocol: "JetDirect", reachable: rawOpen },
        lpr: { port: PRINTER_LPR, protocol: "Berkeley LPR", reachable: lprOpen },
        anyReachable: rawOpen || lprOpen,
      },
      configuration: {
        rawPort: PRINTER_RAW,
        lprPort: PRINTER_LPR,
        queue: PRINTER_QUEUE,
        lprQueues: PRINTER_LPR_QUEUES,
      },
      requirements: {
        raw: "Use this for PDF files (fastest)",
        lpr: "Use this for text or as fallback for PDF",
      },
      troubleshooting: !rawOpen && !lprOpen ? [
        "❌ PRINTER IS OFFLINE",
        "",
        "1. Check printer power - is it turned on?",
        "2. Check network cable - is it connected?",
        "3. Verify IP address - is it " + PRINTER_IP + "?",
        "4. Try ping: ping " + PRINTER_IP,
        "5. Check firewall - ports " + PRINTER_RAW + " and " + PRINTER_LPR + " must be open",
        "6. Reboot printer and try again",
        "",
        "Support: Contact IT with printer IP and this message",
      ] : rawOpen ? [
        "✅ PRINTER ONLINE",
        "RAW port is reachable - PDF printing should work",
      ] : [
        "⚠️ PRINTER PARTIALLY ONLINE",
        "LPR port is reachable - text printing should work, but RAW is down",
      ],
    };
    
    printerLog("Diagnostics result", diagnostics);
    
    res.status(200).json(diagnostics);
  } catch (error) {
    printerLog("Diagnostics error", { error: error?.message });
    res.status(500).json({
      status: "ERROR",
      message: "Diagnostics failed",
      error: error?.message,
    });
  }
});

module.exports = router;
