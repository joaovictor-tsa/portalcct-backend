import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db/pool.js";

export async function login(req, res) {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ erro: "Informe email e senha." });
    }
    const { rows } = await pool.query(
      `SELECT id, email, password_hash, role, active FROM users WHERE email = $1`,
      [String(email).trim().toLowerCase()]
    );
    const user = rows[0];
    if (!user || !user.active || !(await bcrypt.compare(String(password), user.password_hash))) {
      return res.status(401).json({ erro: "Credenciais inválidas." });
    }
    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );
    return res.json({ token, tipo: "Bearer" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: "Falha no login." });
  }
}

export async function me(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role FROM users WHERE id = $1`,
      [req.userId]
    );
    if (!rows[0]) return res.status(404).json({ erro: "Usuário não encontrado." });
    return res.json(rows[0]);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: "Falha ao obter usuário." });
  }
}
