import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required.");
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost")
    ? false
    : { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users(
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products(
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      description TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders(
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      total_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_items(
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      price_cents INTEGER NOT NULL
    );
  `);

  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM products");
  if (rows[0].n === 0) {
    const seed = [
      ["Nour Abaya","abaya",13900,"Een tijdloze abaya met een rustige, elegante uitstraling. Perfect voor dagelijks gebruik en bijzondere gelegenheden."],
      ["Safa Abaya","abaya",15900,"Een verfijnd silhouet met subtiele details voor een moderne, vrouwelijke look."],
      ["Zahra Takchita","takchita",27900,"Een feestelijke takchita geïnspireerd door Marokkaanse couture en rijke details."],
      ["Marrakech Takchita","takchita",32900,"Een elegante statement piece voor bruiloften, Eid en andere bijzondere momenten."],
      ["Luna Occasion Set","occasion",21900,"Een stijlvolle set voor diners, feestdagen en speciale gelegenheden."],
      ["Sahara Ceinture","accessories",4900,"Een elegante ceintuur om je look persoonlijk af te maken."],
      ["Nour Hijab","accessories",2900,"Een zachte, veelzijdige hijab die mooi combineert met de Luxora collectie."],
      ["Atlas Occasion Abaya","occasion",18900,"Een verfijnde occasion abaya met een luxe uitstraling en tijdloze lijnen."]
    ];
    for (const item of seed) {
      await pool.query(
        "INSERT INTO products(name,category,price_cents,description) VALUES($1,$2,$3,$4)",
        item
      );
    }
  }
}

function auth(req, res, next) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function admin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, service: "luxora-api", database: "connected" });
  } catch {
    res.status(503).json({ ok: false, service: "luxora-api", database: "unavailable" });
  }
});

app.get("/api/products", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id,name,category,price_cents,description FROM products WHERE active=TRUE ORDER BY id DESC"
  );
  res.json(rows);
});

app.post("/api/auth/register", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    return res.status(400).json({
      error: "Use a valid email and a password of at least 8 characters."
    });
  }

  try {
    const hash = bcrypt.hashSync(password, 12);
    const result = await pool.query(
      "INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id,email,role",
      [email, hash]
    );
    const user = result.rows[0];
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user });
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({ error: "An account with that email already exists." });
    }
    res.status(500).json({ error: "Unable to create account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const { rows } = await pool.query(
    "SELECT id,email,password_hash,role FROM users WHERE email=$1",
    [email]
  );
  const row = rows[0];

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const user = { id: row.id, email: row.email, role: row.role };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user });
});

app.get("/api/me", auth, (req, res) => res.json(req.user));

app.post("/api/orders", auth, async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: "Your cart is empty." });

  const normalized = [];
  let total = 0;

  for (const item of items) {
    const productId = Number(item.product_id);
    const quantity = Math.max(1, Math.min(99, Number(item.quantity) || 1));
    const { rows } = await pool.query(
      "SELECT id,price_cents FROM products WHERE id=$1 AND active=TRUE",
      [productId]
    );
    const product = rows[0];
    if (!product) return res.status(400).json({ error: "One or more products are unavailable." });
    total += product.price_cents * quantity;
    normalized.push([product.id, quantity, product.price_cents]);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const order = await client.query(
      "INSERT INTO orders(user_id,total_cents,status) VALUES($1,$2,$3) RETURNING id",
      [req.user.id, total, "pending"]
    );

    for (const [productId, quantity, priceCents] of normalized) {
      await client.query(
        "INSERT INTO order_items(order_id,product_id,quantity,price_cents) VALUES($1,$2,$3,$4)",
        [order.rows[0].id, productId, quantity, priceCents]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({
      order_id: order.rows[0].id,
      total_cents: total,
      status: "pending"
    });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Unable to create order." });
  } finally {
    client.release();
  }
});

app.get("/api/orders", auth, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id,total_cents,status,created_at FROM orders WHERE user_id=$1 ORDER BY id DESC",
    [req.user.id]
  );
  res.json(rows);
});

app.get("/api/admin/orders", auth, admin, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT o.id,o.total_cents,o.status,o.created_at,u.email
    FROM orders o
    LEFT JOIN users u ON u.id=o.user_id
    ORDER BY o.id DESC
  `);
  res.json(rows);
});

app.patch("/api/admin/orders/:id", auth, admin, async (req, res) => {
  const status = String(req.body.status || "");
  const allowed = ["pending","paid","processing","completed","cancelled","refunded"];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  await pool.query("UPDATE orders SET status=$1 WHERE id=$2", [
    status,
    Number(req.params.id)
  ]);
  res.json({ ok: true });
});

app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Velora running on port ${PORT}`));
  })
  .catch((error) => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });
