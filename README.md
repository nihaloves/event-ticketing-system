# Cinema Talkies 🎟️

A web-based ticket booking and verification system developed for **VYVIDH ’26, our college TechFest**.

Cinema Talkies streamlines event ticket booking, manual UPI payment verification, QR ticket generation, and entry validation through a volunteer-facing scanning interface.

## About the Project

Cinema Talkies was built to make event ticketing simpler and more organised during our college TechFest. It provides a digital workflow for customers to book tickets and for volunteers to verify payments and validate tickets at the entrance.

The system separates payment confirmation from ticket validation, helping volunteers verify bookings before allowing entry.

## Features

### Customer Interface
- Book event tickets online.
- Enter attendee details and contact information.
- Calculate ticket prices based on the number of tickets selected.
- View UPI payment instructions and QR code.
- Notify the team after making a payment.
- Check payment status.
- Access ticket QR codes after payment approval.

### Volunteer Interface
- Scan QR codes to validate tickets.
- Verify ticket validity before admitting attendees.
- Prevent duplicate ticket use.
- Access payment verification workflows through protected backend endpoints.

### Backend
- Store booking and ticket information in a database.
- Track payment and ticket status.
- Support payment approval and rejection.
- Protect staff-only operations with authentication.
- Validate ticket scans to prevent repeated entry.

## Tech Stack

| Technology | Purpose |
|---|---|
| React | Customer and volunteer interfaces |
| Vite | Frontend development and builds |
| JavaScript | Application logic |
| Node.js | Backend runtime |
| Express.js | REST API |
| SQLite | Persistent booking and ticket data |
| QR Code | Ticket generation and scanning |
| CSS | User interface styling |
| Render | Application deployment |
| Git & GitHub | Version control and source code management |

## How It Works

1. **Book:** The attendee enters the required details and books tickets.
2. **Pay:** The attendee makes the payment using the provided UPI details.
3. **Notify:** The attendee submits a payment notification through the website.
4. **Verify:** An authorised volunteer checks the actual payment and approves or rejects the booking.
5. **Generate:** Once approved, the ticket QR code becomes available.
6. **Scan:** At the entrance, a volunteer scans the QR code to validate the ticket.
7. **Prevent duplicates:** A successfully used ticket cannot be scanned again for entry.

**Important:** A payment notification is not proof of payment. Approval must be based on verification of the actual transaction.

## Project Structure

```text
cinema-talkies/
├── backend/
│   ├── server.js
│   ├── database.js
│   └── techfest.db
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── index.html
├── volunteer-frontend/
│   ├── src/
│   ├── package.json
│   └── index.html
└── README.md
```

*Note: This is the high-level structure. Generated files, dependencies, and local configuration files may differ.*

## Live Demo

- **Customer Booking:** https://cinema-talkies-frontend.onrender.com
- **Volunteer Interface:** https://cinema-talkies-volunteers.onrender.com
- **Backend API:** https://cinema-talkies-psp7.onrender.com

## Run Locally

### Prerequisites

- Node.js and npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/nihaloves/cinema-talkies.git
cd cinema-talkies
```

### 2. Start the backend

```bash
cd backend
npm install
```

Configure the required environment variables and database settings according to the backend configuration. Then start the server using the script defined in `backend/package.json`, for example:

```bash
npm start
```

### 3. Start the customer frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

### 4. Start the volunteer frontend

Open another terminal:

```bash
cd volunteer-frontend
npm install
npm run dev
```

Use the local URLs printed by Vite in the terminal to open each frontend.

*Note: The exact startup command and required environment variables depend on the scripts and configuration in the project. Ensure the frontend API configuration points to your local backend when testing locally.*

## Security Notes

- Staff-only API routes should remain protected by server-side authentication.
- Never commit passwords, authentication secrets, or private environment files.
- Payment notifications must not automatically approve tickets.
- QR ticket access should be restricted to approved bookings.
- Ticket scanning should validate ticket status on the backend rather than relying only on frontend checks.

## Project Context

**Event:** VYVIDH ’26 – College TechFest  
**Project:** Cinema Talkies  
**Category:** Event Ticketing and Entry Management  
**Purpose:** To simplify ticket booking, payment verification, and event entry for a college event.

## Future Improvements

- Automated payment gateway integration.
- Improved payment verification dashboard.
- Booking analytics and event reports.
- Better error handling and monitoring.
- Automated confirmation notifications.
- Expanded support for multiple events and ticket categories.

## Acknowledgements

Built as a practical software project for our college TechFest, combining frontend development, backend APIs, database management, payment workflows, and QR-based ticket validation.

---

*Cinema Talkies — Making event entry simpler, one ticket at a time.*
