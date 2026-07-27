import { pool } from "../db/pool.js";

export async function listarFila(req, res) {
  const { rows } = await pool.query(
    `SELECT * FROM fila_consultas WHERE user_id = $1 ORDER BY criado_em DESC`,
    [req.userId]
  );
  res.json(rows);
}

export async function cancelarItemFila(req, res) {
  const { rows } = await pool.query(
    `DELETE FROM fila_consultas WHERE id = $1 AND user_id = $2 RETURNING id`,
    [req.params.id, req.userId]
  );
  if (!rows[0]) return res.status(404).json({ erro: "Item não encontrado." });
  res.json({ ok: true });
}
