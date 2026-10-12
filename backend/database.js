const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "techfest.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    amount INTEGER NOT NULL DEFAULT 20,
    event_date TEXT NOT NULL DEFAULT '2026-10-15',
    payment_status TEXT NOT NULL DEFAULT 'PENDING',
    used INTEGER NOT NULL DEFAULT 0,
    used_at TEXT
  )
`);

/*
  Add new columns to an existing database.

  These commands are only needed because the database
  was originally created before quantity, amount and
  event_date existed.
*/

const columns = db
  .prepare("PRAGMA table_info(tickets)")
  .all()
  .map((column) => column.name);

if (!columns.includes("quantity")) {
  db.exec(`
    ALTER TABLE tickets
    ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1
  `);
}

if (!columns.includes("amount")) {
  db.exec(`
    ALTER TABLE tickets
    ADD COLUMN amount INTEGER NOT NULL DEFAULT 20
  `);
}

if (!columns.includes("event_date")) {
  db.exec(`
    ALTER TABLE tickets
    ADD COLUMN event_date TEXT NOT NULL DEFAULT '2026-10-16'
  `);
}

if (!columns.includes("razorpay_order_id")) {
  db.exec(`
    ALTER TABLE tickets
    ADD COLUMN razorpay_order_id TEXT
  `);
}


/*
  Create a demo ticket only in development.
  Production must never create a fake paid ticket.
*/

if (process.env.NODE_ENV !== "production") {
  const existingTicket = db
    .prepare("SELECT * FROM tickets WHERE ticket_id = ?")
    .get("CT-DEMO001");

  if (!existingTicket) {
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
      "CT-DEMO001",
      "Demo User",
      "9999999999",
      1,
      20,
      "2026-10-15",
      "PAID"
    );
  }
}
module.exports = db;

