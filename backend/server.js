const express = require("express");
const cors = require("cors");
const QRCode = require("qrcode");
const db = require("./database");
const crypto = require("crypto");
const UPI_ID = "alwintech12@okicici";
const UPI_NAME = "Cinema Talkies";

require("dotenv").config();
const app = express();

app.use(cors());
app.use(express.json());
// HOME
app.get("/", (req, res) => {
  res.json({
    message: "Cinema Talkies Ticket Server is running!"
  });
});


// REGISTER ATTENDEE
app.post("/register", (req, res) => {
  const { name, phone, quantity, eventDate } = req.body;

  const TICKET_PRICE = 20;

  if (!name || !phone || !quantity || !eventDate) {
    return res.status(400).json({
      success: false,
      message: "Name, phone, ticket quantity and event date are required",
    });
  }

  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid 10-digit phone number",
    });
  }

  const ticketQuantity = Number(quantity);

  if (
    !Number.isInteger(ticketQuantity) ||
    ticketQuantity < 1 ||
    ticketQuantity > 10
  ) {
    return res.status(400).json({
      success: false,
      message: "Ticket quantity must be between 1 and 10",
    });
  }

  if (
  eventDate !== "2026-10-15" &&
  eventDate !== "2026-10-17"
) {
    return res.status(400).json({
      success: false,
      message: "Invalid event date",
    });
  }

  const amount = TICKET_PRICE * ticketQuantity;

  const randomPart = crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase();

  const ticketId = `CT-${randomPart}`;

  try {
    db.prepare(`
      INSERT INTO tickets
      (
        ticket_id,
        name,
        phone,
        quantity,
        amount,
        event_date,
        payment_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      ticketId,
      name.trim(),
      phone,
      ticketQuantity,
      amount,
      eventDate,
      "PENDING"
    );

    res.status(201).json({
      success: true,
      message: "Registration successful",

      ticket: {
          ticketId,
          name: name.trim(),
          phone,
          quantity: ticketQuantity,
          amount,
          eventDate,
          paymentStatus: "PENDING",
          upiId: UPI_ID,
          upiName: UPI_NAME,
        },
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not create registration",
    });
  }
});


/**
 * Volunteer authentication and manual UPI payment review.
 * Payment must be checked in the actual receiving UPI account.
 */
function createStaffToken() {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
    staff: "Authorized TechFest volunteer"
  })).toString("base64url");

  const signature = crypto
    .createHmac("sha256", process.env.STAFF_TOKEN_SECRET)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function requireStaff(req, res, next) {
  const secret = process.env.STAFF_TOKEN_SECRET;
  const header = req.get("authorization") || "";
  const match = header.match(/^Bearer (.+)$/);

  if (!secret || !match) {
    return res.status(401).json({
      success: false,
      message: "Volunteer login required."
    });
  }

  const parts = match[1].split(".");
  if (parts.length !== 2) {
    return res.status(401).json({ success: false, message: "Invalid session." });
  }

  const [payload, signature] = parts;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return res.status(401).json({ success: false, message: "Invalid session." });
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

    if (!session.exp || session.exp <= Math.floor(Date.now() / 1000)) {
      return res.status(401).json({ success: false, message: "Session expired. Log in again." });
    }

    req.staff = session;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid session." });
  }
}

// Volunteer login. Password and signing secret remain on the server.
app.post("/staff/login", (req, res) => {
  const expected = process.env.STAFF_LOGIN_PASSWORD;
  const provided = typeof req.body?.password === "string" ? req.body.password : "";

  if (!expected || !process.env.STAFF_TOKEN_SECRET) {
    return res.status(503).json({
      success: false,
      message: "Volunteer login is not configured."
    });
  }

  const a = Buffer.from(expected);
  const b = Buffer.from(provided);

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ success: false, message: "Incorrect password." });
  }

  return res.json({
    success: true,
    token: createStaffToken(),
    expiresIn: 28800
  });
});

// Customer submits the UPI transaction reference.
// Submission alone never grants access to the ticket QR.
app.post("/tickets/:ticketId/submit-utr", (req, res) => {
  const reference = typeof req.body?.transactionReference === "string"
    ? req.body.transactionReference.trim()
    : "";

  if (reference.length < 6 || reference.length > 100 || !/^[a-zA-Z0-9-]+$/.test(reference)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid transaction reference (6–100 letters, numbers or hyphens)."
    });
  }

  const ticket = db.prepare(
    "SELECT ticket_id, payment_status FROM tickets WHERE ticket_id = ?"
  ).get(req.params.ticketId);

  if (!ticket) {
    return res.status(404).json({ success: false, message: "Booking not found." });
  }

  if (ticket.payment_status === "PAID") {
    return res.status(409).json({ success: false, message: "Payment is already confirmed." });
  }

  try {
    const result = db.prepare(`
      UPDATE tickets
      SET payment_reference = ?,
          payment_status = 'PENDING',
          payment_rejection_reason = NULL,
          payment_submitted_at = ?,
          payment_reviewed_at = NULL,
          payment_reviewed_by = NULL
      WHERE ticket_id = ?
        AND payment_status IN ('PENDING', 'REJECTED')
    `).run(reference, new Date().toISOString(), ticket.ticket_id);

    if (result.changes !== 1) {
      return res.status(409).json({ success: false, message: "Booking status changed. Check its payment status." });
    }

    return res.json({
      success: true,
      message: "Transaction reference submitted for verification.",
      paymentStatus: "PENDING"
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        success: false,
        message: "This transaction reference has already been submitted."
      });
    }

    console.error("UTR submission failed:", error);
    return res.status(500).json({ success: false, message: "Could not submit the reference." });
  }
});

// Customer can check their own booking status using its ticket ID.
app.get("/tickets/:ticketId/payment-status", (req, res) => {
  const ticket = db.prepare(`
    SELECT ticket_id, payment_status, payment_rejection_reason, payment_submitted_at
    FROM tickets WHERE ticket_id = ?
  `).get(req.params.ticketId);

  if (!ticket) {
    return res.status(404).json({ success: false, message: "Booking not found." });
  }

  return res.json({
    success: true,
    ticketId: ticket.ticket_id,
    paymentStatus: ticket.payment_status,
    rejectionReason: ticket.payment_rejection_reason || null,
    submittedAt: ticket.payment_submitted_at || null
  });
});

// Only logged-in volunteers can view pending payment submissions.
app.get("/staff/payments", requireStaff, (req, res) => {
  const payments = db.prepare(`
    SELECT ticket_id, name, phone, quantity, amount, event_date,
           payment_reference, payment_submitted_at
    FROM tickets
    WHERE payment_status = 'PENDING'
      AND payment_reference IS NOT NULL
    ORDER BY payment_submitted_at ASC
  `).all();

  return res.json({ success: true, payments });
});

// Approve only after matching the actual incoming payment in the UPI account.
app.post("/staff/payments/:ticketId/approve", requireStaff, (req, res) => {
  const result = db.prepare(`
    UPDATE tickets
    SET payment_status = 'PAID',
        payment_reviewed_at = ?,
        payment_reviewed_by = ?
    WHERE ticket_id = ?
      AND payment_status = 'PENDING'
      AND payment_reference IS NOT NULL
  `).run(
    new Date().toISOString(),
    req.staff.staff,
    req.params.ticketId
  );

  if (result.changes !== 1) {
    return res.status(409).json({
      success: false,
      message: "Booking is missing, has no UTR, or has already been reviewed."
    });
  }

  return res.json({
    success: true,
    message: "Payment approved. Ticket QR access is now enabled."
  });
});

// Reject a submission with a reason. Customer can submit a corrected UTR later.
app.post("/staff/payments/:ticketId/reject", requireStaff, (req, res) => {
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

  if (!reason || reason.length > 300) {
    return res.status(400).json({
      success: false,
      message: "Provide a rejection reason (maximum 300 characters)."
    });
  }

  const result = db.prepare(`
    UPDATE tickets
    SET payment_status = 'REJECTED',
        payment_rejection_reason = ?,
        payment_reviewed_at = ?,
        payment_reviewed_by = ?
    WHERE ticket_id = ?
      AND payment_status = 'PENDING'
      AND payment_reference IS NOT NULL
  `).run(
    reason,
    new Date().toISOString(),
    req.staff.staff,
    req.params.ticketId
  );

  if (result.changes !== 1) {
    return res.status(409).json({
      success: false,
      message: "Booking is missing, has no UTR, or has already been reviewed."
    });
  }

  return res.json({ success: true, message: "Payment submission rejected." });
});

// Public ticket listing is disabled to protect customer information.
app.get("/tickets", (req, res) => {
  return res.status(404).json({
    success: false,
    message: "Endpoint not available",
  });
});
// SCAN TICKET - FAST ATOMIC ENTRY CHECK
app.post("/tickets/:ticketId/scan", (req, res) => {
  const ticketId = req.params.ticketId;

  const now = new Date().toISOString();

  // One atomic operation:
  // - ticket must exist
  // - payment must be PAID
  // - ticket must not already be used
  // - if all are true, mark it used immediately
  const result = db.prepare(`
    UPDATE tickets
    SET used = 1,
        used_at = ?
    WHERE ticket_id = ?
      AND payment_status = 'PAID'
      AND used = 0
  `).run(now, ticketId);

  if (result.changes === 1) {
    const ticket = db.prepare(`
      SELECT ticket_id, name, quantity, event_date
      FROM tickets
      WHERE ticket_id = ?
    `).get(ticketId);

    return res.json({
      valid: true,
      success: true,
      message: "ENTRY ALLOWED",
      ticketId: ticket.ticket_id,
      name: ticket.name,
      quantity: ticket.quantity,
      eventDate: ticket.event_date,
    });
  }

  // The update failed, so find out why.
  const ticket = db.prepare(`
    SELECT ticket_id, payment_status, used
    FROM tickets
    WHERE ticket_id = ?
  `).get(ticketId);

  if (!ticket) {
    return res.status(404).json({
      valid: false,
      success: false,
      message: "Ticket not found",
    });
  }

  if (ticket.payment_status !== "PAID") {
    return res.status(403).json({
      valid: false,
      success: false,
      message: "Payment not confirmed",
    });
  }

  if (ticket.used) {
    return res.status(409).json({
      valid: false,
      success: false,
      message: "Ticket already used",
    });
  }

  return res.status(400).json({
    valid: false,
    success: false,
    message: "Ticket could not be validated",
  });
});

// Deprecated endpoint disabled. Use the atomic /scan endpoint.
app.post("/tickets/:ticketId/use", (req, res) => {
  return res.status(410).json({
    success: false,
    message: "This endpoint is disabled. Use the scanner endpoint.",
  });
});
// GET TICKET
app.get("/tickets/:ticketId", (req, res) => {
  const ticket = db
    .prepare("SELECT * FROM tickets WHERE ticket_id = ?")
    .get(req.params.ticketId);

  if (!ticket) {
    return res.status(404).json({
      valid: false,
      message: "Ticket not found",
    });
  }

  if (ticket.payment_status !== "PAID") {
    return res.status(403).json({
      valid: false,
      message: "Payment not confirmed",
    });
  }

  res.json({
    valid: true,
    message: "Valid ticket",
    ticket: {
      ticketId: ticket.ticket_id,
      name: ticket.name,
      quantity: ticket.quantity,
      amount: ticket.amount,
      eventDate: ticket.event_date,
      paymentStatus: ticket.payment_status,
      used: Boolean(ticket.used),
    },
  });
});

// QR IMAGE
app.get("/tickets/:ticketId/qr-image", async (req, res) => {
  const ticket = db
    .prepare(
      "SELECT ticket_id, payment_status FROM tickets WHERE ticket_id = ?"
    )
    .get(req.params.ticketId);

  if (!ticket) {
    return res.status(404).json({
      message: "Ticket not found",
    });
  }

  if (ticket.payment_status !== "PAID") {
    return res.status(403).json({
      message: "Payment has not been confirmed yet.",
    });
  }

  try {
    const qrBuffer = await QRCode.toBuffer(ticket.ticket_id, {
      type: "png",
      width: 600,
      margin: 2,
    });

    res.type("png").send(qrBuffer);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not generate QR code.",
    });
  }
});
// START SERVER
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Cinema Talkies server running on http://localhost:${PORT}`);
});






