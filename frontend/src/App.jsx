import { useState } from "react";
import API_BASE_URL from "./api.js";
import { Routes, Route, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import "./App.css";
import Ticket from "./Ticket.jsx";


const TICKET_PRICE = 20;
const UPI_ID = "alwintech12@okicici";
const UPI_NAME = "ALWIN SIMON";

function getEventDate() {
  const now = new Date();
  return now.getMonth() === 9 && now.getDate() >= 16
    ? "2026-10-17"
    : "2026-10-15";
}

function formatEventDate(date) {
  const [year, month, day] = date.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day))
    .toLocaleDateString("en-IN", { month: "long", day: "numeric" });
}

function RegistrationPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [paymentData, setPaymentData] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRegistration, setShowRegistration] = useState(false);
  const eventDate = getEventDate();
  const totalAmount = TICKET_PRICE * quantity;

  async function handleRegister(e) {
    e.preventDefault();
    setMessage("");

    if (!name.trim()) return setMessage("Please enter your name.");
    if (!/^\d{10}$/.test(phone))
      return setMessage("Please enter a valid 10-digit phone number.");

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone, quantity, eventDate }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Registration failed.");

      const ticket = data.ticket;
      setPaymentData({
        ticketId: ticket.ticketId,
        name: ticket.name,
        quantity: ticket.quantity,
        amount: ticket.amount,
      });
      setPaymentStatus("PENDING");
    } catch (error) {
      setMessage(error.message || "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }


     async function checkStatus() {
    if (!paymentData?.ticketId) return;
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/tickets/${encodeURIComponent(paymentData.ticketId)}/payment-status`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not check status.");

      const status = String(data.paymentStatus || data.status || "PENDING").toUpperCase();
      setPaymentStatus(status);
      setRejectionReason(data.rejectionReason || data.paymentRejectionReason || "");

      if (status === "PAID") {
        navigate(`/ticket/${encodeURIComponent(paymentData.ticketId)}`);
        return;
      }
      if (status === "REJECTED") {
        setSubmitted(false);
        setMessage(data.rejectionReason || data.paymentRejectionReason ||
          "Payment was rejected. Check the reference and submit it again.");
      } else {
        setMessage("Payment is awaiting volunteer verification.");
      }
    } catch (error) {
      setMessage(error.message || "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  
const upiLink = paymentData
  ? `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(UPI_NAME)}&tr=${encodeURIComponent(paymentData.ticketId)}&tn=${encodeURIComponent(`Cinema Talkies ${paymentData.ticketId}`)}&am=${paymentData.amount}&cu=INR`
  : "#";


  return (
    <div className="page">
      <div className="poster-background" aria-hidden="true">
        <img src="/cinema-talkies-poster.jpeg" alt="" />
      </div>

      {!showRegistration && !paymentData ? (
        <section className="poster-landing">
          <img className="poster-image" src="/cinema-talkies-poster.jpeg"
            alt="Cinema Talkies event poster" />
          <div className="landing-footer">
            <p>VYVIDH '26 · CINEMA TALKIES</p>
            <button className="book-button" type="button"
              onClick={() => setShowRegistration(true)}>
              Book Your Tickets <span>· ₹20</span>
            </button>
            <span className="landing-note">October 15 &amp; 17, 2026 · South Block 003</span>
          </div>
        </section>
      ) : (
        <div className="registration-overlay">
          {!paymentData && (
            <button className="overlay-close" type="button"
              onClick={() => { setShowRegistration(false); setMessage(""); }}>
              <span aria-hidden="true">←</span>
            </button>
          )}

          <main className="registration-container">
            <section className="registration-heading">
              <p className="payment-eyebrow">VYVIDH '26 · CINEMA TALKIES</p>
              <h1>{paymentData ? "Complete your payment." : "Save your seat."}</h1>
              <p>{paymentData
                ? "Pay using UPI, then let us know when you've completed the payment."
                : "Your cinema experience starts here."}</p>
            </section>

            <section className="event-summary">
              <div className="event-item">
                <div>
                  <span className="label">DATE</span>
                  <strong>{formatEventDate(eventDate)}</strong>
                  <small>Event date</small>
                </div>
              </div>
              <div className="event-divider" />
              <div className="event-item">
                <div>
                  <span className="label">TICKET</span>
                  <strong>₹{TICKET_PRICE}</strong>
                  <small>Per person</small>
                </div>
              </div>
            </section>

            {paymentData ? (
              <section className="payment-section">
                <p className="payment-eyebrow">REGISTRATION COMPLETE</p>
                <h2>Pay by UPI</h2>

                <div className="payment-card">
                  <div className="payment-summary">
                    <div><span>NAME</span><strong>{paymentData.name}</strong></div>
                    <div><span>TICKETS</span><strong>{paymentData.quantity}</strong></div>
                    <div><span>TOTAL</span><strong>₹{paymentData.amount}</strong></div>
                  </div>

                  <div className="payment-divider" />
                  <p className="upi-label">UPI ID</p>
                  <p><strong>{UPI_ID}</strong></p>
                  <button type="button" className="secondary-button"
                    onClick={() => navigator.clipboard.writeText(UPI_ID)}>
                    Copy UPI ID
                  </button>

                  <p className="payment-description">
                    Pay the exact amount using UPI. Keep your payment confirmation for verification.
                  </p>

                  
<div className="payment-qr-section">
  <p className="upi-label">SCAN TO PAY</p>

  <div className="payment-qr-frame">
    <QRCodeSVG
      value={upiLink}
      size={240}
      level="M"
      marginSize={2}
      title="Cinema Talkies UPI payment QR"
    />
  </div>

  <p className="payment-description">
  After paying, keep your booking reference for verification.
  Your ticket will be available once a volunteer confirms payment.
</p>

  <button
    type="button"
    className="secondary-button"
    onClick={() => navigator.clipboard.writeText(upiLink)}
  >
    Copy payment link
  </button>
</div>


                  <p className="ticket-reference">Booking reference: {paymentData.ticketId}</p>

                  

                  <button className="secondary-button" type="button"
                    onClick={checkStatus} disabled={loading}>
                    {loading ? "Checking..." : "Check payment status"}
                  </button>

                  <p className="secure-text">
                    Status: {paymentStatus || "PENDING"}
                  </p>
                  {paymentStatus === "REJECTED" && (
                    <p className="message">
                      {rejectionReason || "Payment could not be verified. Please contact a volunteer for assistance."}
                    </p>
                  )}
                  {message && <div className="message">{message}</div>}
                  <p className="secure-text">
                    Your ticket QR becomes available only after a volunteer verifies your payment.
                  </p>
                </div>
              </section>
            ) : (
              <section className="registration">
                <h2>Get your pass</h2>
                <form onSubmit={handleRegister}>
                  <label className="input-card">
                    <span className="input-content">
                      <span className="input-label">NAME</span>
                      <input value={name} onChange={(e) => setName(e.target.value)}
                        required maxLength={100} autoComplete="name"
                        placeholder="Enter your name" />
                    </span>
                  </label>

                  <label className="input-card">
                    <span className="input-content">
                      <span className="input-label">PHONE NUMBER</span>
                      <input type="tel" inputMode="numeric" maxLength={10}
                        placeholder="Enter 10-digit number" value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                        autoComplete="tel" required />
                    </span>
                  </label>

                  <div className="input-card quantity-card">
                    <div className="input-content">
                      <span className="input-label">NUMBER OF TICKETS</span>
                      <span className="quantity-description">₹{TICKET_PRICE} per ticket</span>
                    </div>
                    <div className="quantity-control">
                      <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))}
                        disabled={quantity === 1} aria-label="Decrease ticket count">−</button>
                      <span>{quantity}</span>
                      <button type="button" onClick={() => setQuantity(q => Math.min(10, q + 1))}
                        disabled={quantity === 10} aria-label="Increase ticket count">+</button>
                    </div>
                  </div>

                  <div className="total-row">
                    <span>TOTAL</span><strong>₹{totalAmount}</strong>
                  </div>
                  <button className="continue-button" type="submit" disabled={loading}>
                    <span>{loading ? "Processing..." : "Continue to payment"}</span>
                    {!loading && <span className="arrow">→</span>}
                  </button>
                </form>
                {message && <div className="message">{message}</div>}
              </section>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<RegistrationPage />} />
      <Route path="/ticket/:ticketId" element={<Ticket />} />
    </Routes>
  );
}

export default App;



