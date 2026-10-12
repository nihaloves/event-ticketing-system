import { useEffect, useState } from "react";
import API_BASE_URL from "./api.js";
import { useParams } from "react-router-dom";
import "./Ticket.css";

function formatEventDate(date) {
  if (!date) {
    return "Date unavailable";
  }

  const [year, month, day] = date.split("-");

  const dateObject = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );

  return dateObject.toLocaleDateString("en-IN", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function Ticket() {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadTicket = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/tickets/${ticketId}`
        );

        const data = await response.json();

        if (!response.ok) {
          setMessage(data.message || "Could not load ticket.");
          return;
        }

        setTicket(data.ticket);
      } catch (error) {
        console.error(error);
        setMessage("Could not connect to the server.");
      } finally {
        setLoading(false);
      }
    };

    loadTicket();
  }, [ticketId]);

  if (loading) {
    return (
      <div className="ticket-page">
        <p className="ticket-loading">
          Loading your pass...
        </p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="ticket-page">
        <div className="ticket-error">
          <h1>Pass unavailable</h1>
          <p>{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ticket-page">

      <main className="ticket-card">
  <div className="ticket-brand">CINEMA TALKIES</div>

  <p className="ticket-eyebrow">YOUR PASS</p>

  <img
    className="ticket-qr"
    src={`${API_BASE_URL}/tickets/${ticket.ticketId}/qr-image`}
    alt="Cinema Talkies ticket QR code"
  />

  <div className="ticket-details">
    <div>
      <span>DATE</span>
      <strong>{formatEventDate(ticket.eventDate)}</strong>
    </div>

    <div>
      <span>TICKETS</span>
      <strong>{ticket.quantity}</strong>
    </div>

    <div>
      <span>NAME</span>
      <strong>{ticket.name}</strong>
    </div>
  </div>

  <p className="ticket-id">{ticket.ticketId}</p>

  <p className="ticket-instruction">
    Show this QR at the entrance. Once scanned, it cannot be used again.
  </p>

  <button
    className="ticket-save-button"
    type="button"
    onClick={() => window.print()}
  >
    Save ticket
  </button>
</main>

    </div>
  );
}

export default Ticket;
