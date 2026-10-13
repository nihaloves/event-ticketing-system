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

const columns = db
  .prepare("PRAGMA table_info(tickets)")
  .all()
  .map((column) => column.name);

const migrations = {
  quantity: "ALTER TABLE tickets ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1",
  amount: "ALTER TABLE tickets ADD COLUMN amount INTEGER NOT NULL DEFAULT 20",
  event_date: "ALTER TABLE tickets ADD COLUMN event_date TEXT NOT NULL DEFAULT '2026-10-15'",
  razorpay_order_id: "ALTER TABLE tickets ADD COLUMN razorpay_order_id TEXT",
  payment_reference: "ALTER TABLE tickets ADD COLUMN payment_reference TEXT",
  payment_rejection_reason: "ALTER TABLE tickets ADD COLUMN payment_rejection_reason TEXT",
  payment_submitted_at: "ALTER TABLE tickets ADD COLUMN payment_submitted_at TEXT",
  payment_reviewed_at: "ALTER TABLE tickets ADD COLUMN payment_reviewed_at TEXT",
  payment_reviewed_by: "ALTER TABLE tickets ADD COLUMN payment_reviewed_by TEXT"
};

for (const [column, sql] of Object.entries(migrations)) {
  if (!columns.includes(column)) {
    db.exec(sql);
  }
}

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_payment_reference
  ON tickets(lower(trim(payment_reference)))
  WHERE payment_reference IS NOT NULL
`);

if (process.env.NODE_ENV !== "production") {
  const existingTicket = db
    .prepare("SELECT ticket_id FROM tickets WHERE ticket_id = ?")
    .get("CT-DEMO001");

  if (!existingTicket) {
    db.prepare(`
      INSERT INTO tickets
      (ticket_id, name, phone, quantity, amount, event_date, payment_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      "CT-DEMO001", "Demo User", "9999999999",
      1, 20, "2026-10-15", "PAID"
    );
  }
}

module.exports = db;
