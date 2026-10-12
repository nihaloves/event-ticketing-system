const express = require("express");
const cors = require("cors");
const QRCode = require("qrcode");
const db = require("./database");
const crypto = require("crypto");
const UPI_ID = "niharikathilak-1@okicici";
const UPI_NAME = "Cinema Talkies";

require("dotenv").config();
const Razorpay = require("razorpay");

const app = express();

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  throw new Error("Razorpay environment variables are missing.");
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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
 * CREATE RAZORPAY ORDER
 * Amount is taken from our database, not trusted from the frontend.
 */
app.post("/tickets/:ticketId/create-order", async (req, res) => {
  try {
    const ticket = db
      .prepare("SELECT * FROM tickets WHERE ticket_id = ?")
      .get(req.params.ticketId);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (ticket.payment_status === "PAID") {
      return res.status(409).json({
        success: false,
        message: "This ticket is already paid.",
      });
    }

    // Reuse the existing order if one has already been created.
    if (ticket.razorpay_order_id) {
      return res.json({
        success: true,
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: ticket.razorpay_order_id,
        ticketId: ticket.ticket_id,
        amount: ticket.amount * 100,
        currency: "INR",
      });
    }

    const order = await razorpay.orders.create({
      amount: ticket.amount * 100,
      currency: "INR",
      receipt: ticket.ticket_id,
      notes: {
        ticketId: ticket.ticket_id,
        eventDate: ticket.event_date,
      },
    });

    db.prepare(`
      UPDATE tickets
      SET razorpay_order_id = ?
      WHERE ticket_id = ?
        AND payment_status != 'PAID'
    `).run(order.id, ticket.ticket_id);

    return res.status(201).json({
      success: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      ticketId: ticket.ticket_id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("Razorpay order creation failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not create payment order.",
    });
  }
});


/**
 * VERIFY RAZORPAY PAYMENT
 * A ticket becomes PAID only after server-side verification.
 */
app.post("/tickets/:ticketId/verify-payment", async (req, res) => {
  console.log("Registering Razorpay verification route");
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment verification details are missing.",
      });
    }

    const ticket = db
      .prepare("SELECT * FROM tickets WHERE ticket_id = ?")
      .get(req.params.ticketId);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found.",
      });
    }

    // Make repeated verification requests safe.
    if (ticket.payment_status === "PAID") {
      return res.json({
        success: true,
        message: "Payment already verified.",
        ticketId: ticket.ticket_id,
      });
    }

    // The order must belong to this ticket.
    if (
      !ticket.razorpay_order_id ||
      ticket.razorpay_order_id !== razorpay_order_id
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment order does not match this ticket.",
      });
    }

    // Verify Razorpay's checkout signature using the server secret.
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const receivedBuffer = Buffer.from(razorpay_signature, "hex");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature.",
      });
    }

    // Independently check the payment with Razorpay.
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (
      payment.order_id !== ticket.razorpay_order_id ||
      payment.amount !== ticket.amount * 100 ||
      payment.currency !== "INR"
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment details do not match the ticket.",
      });
    }

    // Do not issue a ticket for an unpaid or merely authorized payment.
    if (payment.status !== "captured") {
      return res.status(409).json({
        success: false,
        message:
          "Payment is not captured yet. Please wait and try again.",
      });
    }

    // Atomic update: never overwrite a ticket that has already been paid.
    const result = db.prepare(`
      UPDATE tickets
      SET payment_status = 'PAID'
      WHERE ticket_id = ?
        AND razorpay_order_id = ?
        AND payment_status = 'PENDING'
    `).run(ticket.ticket_id, razorpay_order_id);

    if (result.changes !== 1) {
      const latestTicket = db
        .prepare("SELECT payment_status FROM tickets WHERE ticket_id = ?")
        .get(ticket.ticket_id);

      if (latestTicket?.payment_status === "PAID") {
        return res.json({
          success: true,
          message: "Payment already verified.",
          ticketId: ticket.ticket_id,
        });
      }

      return res.status(409).json({
        success: false,
        message: "Ticket status changed. Please check the booking.",
      });
    }

    return res.json({
      success: true,
      message: "Payment verified successfully.",
      ticketId: ticket.ticket_id,
    });
  } catch (error) {
    console.error(
      "Payment verification failed:",
      error.error?.description || error.message
    );

    return res.status(500).json({
      success: false,
      message: "Could not verify payment. Please try again.",
    });
  }
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




