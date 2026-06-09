const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { withConnection } = require("../db");
const { rowsToClients } = require("../util");

const router = express.Router();

router.post("/register", async (req, res) => {
  const emailRaw = req.body.email;
  const password = req.body.password;
  const fullName = req.body.full_name || "";

  if (!emailRaw || !password) {
    return res.status(400).json({ error: "email and password required" });
  }

  const email = String(emailRaw).trim().toLowerCase();

  try {
    const hash = bcrypt.hashSync(password, 12);
    const row = await withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO eam_app_user (email, password_hash, full_name)
         VALUES (:email, :hash, :fullName)`,
        { email, hash, fullName },
      );

      const r = await conn.execute(
        `SELECT user_id, email, full_name, created_at FROM eam_app_user WHERE email = :email`,
        { email },
      );
      await conn.commit();
      return rowsToClients(r)[0];
    });

    const token = jwt.sign({ userId: row.user_id, email: row.email }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    res.status(201).json({ user: row, token });
  } catch (err) {
    if (err.errorNum === 1 || String(err.message).includes("unique")) {
      return res.status(409).json({ error: "Email already registered" });
    }
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = req.body.password;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password required" });
  }

  try {
    const data = await withConnection(async (conn) => {
      const r = await conn.execute(
        `SELECT user_id, email, password_hash, full_name, created_at
         FROM eam_app_user WHERE email = :email`,
        { email },
      );
      return rowsToClients(r)[0];
    });

    if (!data || !bcrypt.compareSync(password, data.password_hash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: data.user_id, email: data.email }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    const { password_hash: _omit, ...user } = data;
    res.json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

module.exports = router;
