import { useState } from "react";
import API_BASE_URL from "./api.js";
import { Routes, Route } from "react-router-dom";
import "./App.css";
import Ticket from "./Ticket.jsx";
import Scanner from "./Scanner.jsx";


const TICKET_PRICE = 20;


function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function getEventDate() {
  const now = new Date();

  const month = now.getMonth();
  const day = now.getDate();

  // October 17 becomes available only after October 15 ends.
  if (month === 9 && day >= 16) {
    return "2026-10-17";
  }

  return "2026-10-15";
}

function formatEventDate(date) {
  const [year, month, day] = date.split("-");

  const dateObject = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );

  return dateObject.toLocaleDateString("en-IN", {
    month: "long",
    day: "numeric",
  });
}

function RegistrationPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [paymentData, setPaymentData] = useState(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const eventDate = getEventDate();
  const totalAmount = TICKET_PRICE * quantity;

  const decreaseQuantity = () => {
    setQuantity((current) => Math.max(1, current - 1));
  };

  const increaseQuantity = () => {
    setQuantity((current) => Math.min(10, current + 1));
  };

  const handleRegister = async (e) => {
  e.preventDefault();
  setMessage("");

  if (!name.trim()) {
    setMessage("Please enter your name.");
    return;
  }

  if (!/^\d{10}$/.test(phone)) {
    setMessage("Please enter a valid 10-digit phone number.");
    return;
  }

  setLoading(true);

  try {
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name.trim(),
        phone,
        quantity,
        eventDate,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message || "Something went wrong.");
      return;
    }

    
const ticket = data.ticket;

setPaymentData({
  ticketId: ticket.ticketId,
  name: ticket.name,
  quantity: ticket.quantity,
  amount: ticket.amount,
});

  } catch (error) {
    console.error(error);
    setMessage("Could not connect to the server.");
  } finally {
    setLoading(false);
  }
};


const handleRazorpayPayment = async () => {
  if (!paymentData?.ticketId) {
    setMessage("Ticket reference is missing.");
    return;
  }

  setLoading(true);
  setMessage("");

  try {
    const loaded = await loadRazorpayScript();

    if (!loaded) {
      setMessage("Could not load Razorpay. Please try again.");
      setLoading(false);
      return;
    }

    const orderResponse = await fetch(
      `${API_BASE_URL}/tickets/${paymentData.ticketId}/create-order`,
      { method: "POST" }
    );

    const order = await orderResponse.json();

    if (!orderResponse.ok) {
      throw new Error(order.message || "Could not create payment order.");
    }

    const checkout = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: "Cinema Talkies",
      description: `${paymentData.quantity} ticket(s)`,
      order_id: order.orderId,
      

      prefill: {
        name: paymentData.name,
        contact: phone,
      },

      handler: async (payment) => {
        try {
          const verifyResponse = await fetch(
            `${API_BASE_URL}/tickets/${paymentData.ticketId}/verify-payment`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                razorpay_order_id: payment.razorpay_order_id,
                razorpay_payment_id: payment.razorpay_payment_id,
                razorpay_signature: payment.razorpay_signature,
              }),
            }
          );

          const result = await verifyResponse.json();

          if (!verifyResponse.ok) {
            throw new Error(
              result.message || "Payment verification failed."
            );
          }

          if (result.success && result.ticketId) {
            window.location.assign(`/ticket/${result.ticketId}`);
            return;
          }

          throw new Error("Payment has not been verified.");
        } catch (error) {
          setMessage(error.message || "Could not verify payment.");
          setLoading(false);
        }
      },

      modal: {
        ondismiss: () => setLoading(false),
      },

      theme: {
  color: "#7B1835",
  backdrop_color: "#13070B",
},
    });

    checkout.on("payment.failed", (event) => {
      setMessage(
        event.error?.description || "Payment failed. Please try again."
      );
      setLoading(false);
    });

    checkout.open();
  } catch (error) {
    setMessage(error.message || "Could not start payment.");
    setLoading(false);
  }
};

  
return (
  <div className="page">
    <div className="poster-background" aria-hidden="true">
      <img src="/cinema-talkies-poster.jpeg" alt="" />
    </div>

    {!showRegistration && !paymentData ? (
      <section className="poster-landing">
        <img
          className="poster-image"
          src="/cinema-talkies-poster.jpeg"
          alt="Cinema Talkies event poster"
        />

        <div className="landing-footer">
          <p>VYVIDH '26 · CINEMA TALKIES</p>

          <button
            className="book-button"
            type="button"
            onClick={() => setShowRegistration(true)}
          >
            Book Your Tickets <span>· ₹20</span>
          </button>

          <span className="landing-note">
            October 15 &amp; 17, 2026 · South Block 003
          </span>
        </div>
      </section>
    ) : (
      <div className="registration-overlay">
        {!paymentData && (
          <button
            className="overlay-close"
            type="button"
            onClick={() => {
              setShowRegistration(false);
              setMessage("");
            }}
          >
            <span aria-hidden="true">←</span> Back to poster
          </button>
        )}

        <main className="content">
          <section className="booking-heading">
            <p className="booking-eyebrow">
              CINEMA TALKIES · VYVIDH '26
            </p>

            <h1>
              {paymentData
                ? "One step from the screen."
                : "Save your seat."}
            </h1>

            <p>
              {paymentData
                ? "Your reservation is ready. Complete payment to confirm your tickets."
                : "Your cinema experience starts here."}
            </p>
          </section>

          <section className="event-card">
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
              <p className="payment-eyebrow">
                REGISTRATION COMPLETE
              </p>

              <h2>Complete your payment.</h2>

              <p className="payment-description">
                Your pass has been reserved. Please complete the
                payment to confirm your registration.
              </p>

              <div className="payment-card">
                <div className="payment-summary">
                  <div>
                    <span>NAME</span>
                    <strong>{paymentData.name}</strong>
                  </div>

                  <div>
                    <span>TICKETS</span>
                    <strong>{paymentData.quantity}</strong>
                  </div>

                  <div>
                    <span>TOTAL</span>
                    <strong>₹{paymentData.amount}</strong>
                  </div>
                </div>

                <div className="payment-divider" />

                <p className="upi-label">SECURE PAYMENT</p>

                <p className="payment-description">
                  Complete your payment securely through Razorpay.
                </p>

                <button
                  className="continue-button"
                  type="button"
                  onClick={handleRazorpayPayment}
                  disabled={loading}
                >
                  <span>
                    {loading
                      ? "Opening payment..."
                      : `Pay ₹${paymentData.amount} with Razorpay`}
                  </span>

                  {!loading && <span className="arrow">→</span>}
                </button>

                <p className="secure-text">
                  You will proceed to secure payment.
                </p>

                {message && (
                  <div className="message">{message}</div>
                )}
              </div>

              <p className="ticket-reference">
                Ticket reference: {paymentData.ticketId}
              </p>
            </section>
          ) : (
            <section className="registration">
              <h2>Get your pass</h2>

              <form onSubmit={handleRegister}>
                <label className="input-card">
                  <span className="input-content">
                    <span className="input-label">NAME</span>

                    <input
                      type="text"
                      placeholder="Enter your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                    />
                  </span>
                </label>

                <label className="input-card">
                  <span className="input-content">
                    <span className="input-label">
                      PHONE NUMBER
                    </span>

                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength="10"
                      placeholder="Enter 10-digit number"
                      value={phone}
                      onChange={(e) =>
                        setPhone(e.target.value.replace(/\D/g, ""))
                      }
                      autoComplete="tel"
                    />
                  </span>
                </label>

                <div className="input-card quantity-card">
                  <div className="input-content">
                    <span className="input-label">
                      NUMBER OF TICKETS
                    </span>

                    <span className="quantity-description">
                      ₹{TICKET_PRICE} per ticket
                    </span>
                  </div>

                  <div className="quantity-control">
                    <button
                      type="button"
                      onClick={decreaseQuantity}
                      disabled={quantity === 1}
                      aria-label="Decrease ticket count"
                    >
                      −
                    </button>

                    <span>{quantity}</span>

                    <button
                      type="button"
                      onClick={increaseQuantity}
                      disabled={quantity === 10}
                      aria-label="Increase ticket count"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="total-row">
                  <span>TOTAL</span>
                  <strong>₹{totalAmount}</strong>
                </div>

                <button
                  className="continue-button"
                  type="submit"
                  disabled={loading}
                >
                  <span>
                    {loading ? "Processing..." : "Proceed to payment"}
                  </span>

                  {!loading && <span className="arrow">→</span>}
                </button>
              </form>

              {message && (
                <div className="message">{message}</div>
              )}

              <p className="secure-text">
                You will proceed to secure payment.
              </p>
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
<Route path="/scanner" element={<Scanner />} />
    </Routes>
  );
}

export default App;

