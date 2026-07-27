import { pool } from "../db/pool.js";

const CHAVES = ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from"];

export async function getConfiguracoes(req, res) {
  const { rows } = await pool.query(
    `SELECT chave, valor FROM configuracoes WHERE chave = ANY($1)`,
    [CHAVES]
  );
  const mapa = Object.fromEntries(rows.map((r) => [r.chave, r.valor]));
  res.json({
    smtp_host: mapa.smtp_host || "",
    smtp_port: mapa.smtp_port || "",
    smtp_user: mapa.smtp_user || "",
    smtp_pass: mapa.smtp_pass ? "••••••••" : "",
    smtp_from: mapa.smtp_from || "",
  });
}

export async function updateConfiguracoes(req, res) {
  const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from } = req.body ?? {};
  const entradas = [
    ["smtp_host", smtp_host],
    ["smtp_port", smtp_port],
    ["smtp_user", smtp_user],
    ["smtp_from", smtp_from],
  ];
  if (smtp_pass && smtp_pass !== "••••••••") {
    entradas.push(["smtp_pass", smtp_pass]);
  }

  try {
    for (const [chave, valor] of entradas) {
      if (valor === undefined) continue;
      await pool.query(
        `INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES ($1, $2, now())
         ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = now()`,
        [chave, String(valor)]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Falha ao salvar configurações." });
  }
}
