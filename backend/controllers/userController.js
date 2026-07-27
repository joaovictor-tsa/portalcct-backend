import bcrypt from "bcryptjs";
import { pool } from "../db/pool.js";

export async function listUsers(req, res) {
  const { rows } = await pool.query(
    `SELECT id, name, email, role, active, created_at FROM users ORDER BY created_at DESC`
  );
  res.json(rows);
}

export async function getUser(req, res) {
  const { rows } = await pool.query(
    `SELECT id, name, email, role, active FROM users WHERE id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ erro: "Usuário não encontrado." });
  res.json(rows[0]);
}

export async function createUser(req, res) {
  const { name, email, password, role } = req.body ?? {};
  if (!name || !email || !password) {
    return res.status(400).json({ erro: "Informe nome, e-mail e senha." });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, active`,
      [name, email.trim().toLowerCase(), passwordHash, role || "user"]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ erro: "E-mail já cadastrado." });
    console.error(e);
    res.status(500).json({ erro: "Falha ao criar usuário." });
  }
}

export async function updateUser(req, res) {
  const { id } = req.params;
  const { name, email, password, role, active } = req.body ?? {};
  const campos = [];
  const valores = [];
  let i = 1;

  if (name) { campos.push(`name = $${i++}`); valores.push(name); }
  if (email) { campos.push(`email = $${i++}`); valores.push(email.trim().toLowerCase()); }
  if (role) { campos.push(`role = $${i++}`); valores.push(role); }
  if (typeof active === "boolean") { campos.push(`active = $${i++}`); valores.push(active); }
  if (password) { campos.push(`password_hash = $${i++}`); valores.push(await bcrypt.hash(password, 12)); }
  campos.push(`updated_at = now()`);

  valores.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE users SET ${campos.join(", ")} WHERE id = $${i} RETURNING id, name, email, role, active`,
      valores
    );
    if (!rows[0]) return res.status(404).json({ erro: "Usuário não encontrado." });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Falha ao atualizar usuário." });
  }
}

export async function deactivateUser(req, res) {
  const { rows } = await pool.query(
    `UPDATE users SET active = false, updated_at = now() WHERE id = $1 RETURNING id`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ erro: "Usuário não encontrado." });
  res.json({ ok: true });
}

export async function deleteUser(req, res) {
  const { rows } = await pool.query(`DELETE FROM users WHERE id = $1 RETURNING id`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ erro: "Usuário não encontrado." });
  res.json({ ok: true });
}
