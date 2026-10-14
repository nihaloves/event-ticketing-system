import { useEffect, useState } from "react";
import Scanner from "./Scanner.jsx";
import API_BASE_URL from "./api.js";

const styles = {
  page: { maxWidth: 900, margin: "0 auto", padding: "24px 16px", fontFamily: "Arial, sans-serif", color: "#14213d" },
  panel: { border: "1px solid #dbe3eb", borderRadius: 14, padding: 20, marginTop: 18, background: "#fff" },
  input: { width: "100%", boxSizing: "border-box", padding: 12, border: "1px solid #cbd5e1", borderRadius: 8, marginTop: 6, marginBottom: 14, fontSize: 16 },
  button: { padding: "11px 16px", border: 0, borderRadius: 8, cursor: "pointer", fontWeight: 600 },
  primary: { background: "#0d5c63", color: "#fff" },
  secondary: { background: "#e8eef2", color: "#14213d" },
  muted: { color: "#64748b", fontSize: 14 },
};

export default function App() {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [tab, setTab] = useState("payments");
  const [payments, setPayments] = useState([]);
  const [reasons, setReasons] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  async function login(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/staff/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Login failed.");

      setToken(data.token);
      setPassword("");
      setMessage("Login successful.");
    } catch (error) {
      setMessage(error.message || "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  async function loadPayments() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/staff/payments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Could not load payments.");

      setPayments(data.payments || []);
    } catch (error) {
      setMessage(error.message || "Could not load payments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token && tab === "payments") loadPayments();
  }, [token, tab, refreshKey]);

  async function reviewPayment(ticketId, action) {
    let reason = "";

    if (action === "reject") {
      reason = (reasons[ticketId] || "").trim();
      if (!reason) {
        setMessage(`Enter a rejection reason for ${ticketId}.`);
        return;
      }
    } else if (!window.confirm(
      `Approve payment for ${ticketId}? Confirm that the actual incoming UPI transaction matches first.`
    )) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/staff/payments/${encodeURIComponent(ticketId)}/${action}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(action === "reject" ? { reason } : {}),
        }
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Payment review failed.");

      setMessage(data.message || "Payment reviewed.");
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setMessage(error.message || "Could not review payment.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <main style={styles.page}>
        <p style={{ letterSpacing: 2, fontSize: 12 }}>CINEMA TALKIES · TECHFEST</p>
        <h1>Volunteer login</h1>
        <p style={styles.muted}>Sign in to review UPI payments and validate attendee tickets.</p>

        <form style={styles.panel} onSubmit={login}>
          <label htmlFor="staff-password">Volunteer password</label>
          <input
            id="staff-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            style={styles.input}
          />
          <button type="submit" disabled={loading} style={{ ...styles.button, ...styles.primary }}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
          {message && <p role="status">{message}</p>}
        </form>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <p style={{ letterSpacing: 2, fontSize: 12 }}>CINEMA TALKIES · TECHFEST</p>
      <h1>Volunteer dashboard</h1>
      <p style={styles.muted}>Verify payments before granting entry.</p>

      <nav style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
        <button
          style={{ ...styles.button, ...(tab === "payments" ? styles.primary : styles.secondary) }}
          onClick={() => setTab("payments")}
        >
          Payments
        </button>
        <button
          style={{ ...styles.button, ...(tab === "scanner" ? styles.primary : styles.secondary) }}
          onClick={() => setTab("scanner")}
        >
          Scan Tickets
        </button>
        <button
          style={{ ...styles.button, ...styles.secondary, marginLeft: "auto" }}
          onClick={() => { setToken(""); setPayments([]); setMessage("Signed out."); }}
        >
          Sign out
        </button>
      </nav>

      {message && <p role="status">{message}</p>}

      {tab === "payments" && (
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h2>Pending payments ({payments.length})</h2>
            <button
              style={{ ...styles.button, ...styles.secondary }}
              onClick={() => setRefreshKey((value) => value + 1)}
              disabled={loading}
            >
              Refresh
            </button>
          </div>

          {loading && <p style={styles.muted}>Loading...</p>}
          {!loading && payments.length === 0 && (
            <div style={styles.panel}>No payment submissions are waiting for review.</div>
          )}

          {payments.map((payment) => (
            <article key={payment.ticket_id} style={styles.panel}>
              <h3 style={{ marginTop: 0 }}>{payment.name}</h3>
              <p><strong>Booking:</strong> {payment.ticket_id}</p>
              <p><strong>Phone:</strong> {payment.phone}</p>
              <p><strong>Quantity:</strong> {payment.quantity}</p>
              <p><strong>Amount:</strong> ₹{payment.amount}</p>
              <p><strong>Event date:</strong> {payment.event_date}</p>
              <p><strong>UTR:</strong> {payment.payment_reference}</p>
              <p style={styles.muted}>
                Submitted: {payment.payment_submitted_at
                  ? new Date(payment.payment_submitted_at).toLocaleString()
                  : "Not available"}
              </p>
              <p style={styles.muted}>
                Check the actual incoming transaction in the receiving UPI account before approving.
              </p>

              <label htmlFor={`reason-${payment.ticket_id}`}>Rejection reason</label>
              <input
                id={`reason-${payment.ticket_id}`}
                style={styles.input}
                maxLength={300}
                placeholder="Required only if rejecting"
                value={reasons[payment.ticket_id] || ""}
                onChange={(event) => setReasons((old) => ({
                  ...old, [payment.ticket_id]: event.target.value
                }))}
              />

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  style={{ ...styles.button, ...styles.primary }}
                  disabled={loading}
                  onClick={() => reviewPayment(payment.ticket_id, "approve")}
                >
                  Approve verified payment
                </button>
                <button
                  style={{ ...styles.button, ...styles.secondary }}
                  disabled={loading}
                  onClick={() => reviewPayment(payment.ticket_id, "reject")}
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {tab === "scanner" && <Scanner token={token} />}
    </main>
  );
}
