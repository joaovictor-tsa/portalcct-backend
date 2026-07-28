import { pool } from "../db/pool.js";
import { encrypt } from "../utils/crypto.js";
import { SiscomexAuthService } from "../services/SiscomexAuthService.js";

export async function definirChaveAcesso(req, res) {
  try {
    const { clientId, clientSecret, roleType } = req.body ?? {};
    const cid = String(clientId ?? "").trim();
    const csec = String(clientSecret ?? "").trim();
    const role = String(roleType ?? "").trim();
    if (!cid) return res.status(400).json({ erro: "Informe Client-Id." });
    if (!csec) return res.status(400).json({ erro: "Informe Client-Secret." });
    if (!role) return res.status(400).json({ erro: "Informe Role-Type (ex.: TRANSPORT)." });

    const userId = req.userId;
    SiscomexAuthService.limparSessao(userId);

    await pool.query(
      `INSERT INTO credenciais (user_id, tipo, client_id_enc, client_secret_enc, role_type)
       VALUES ($1, 'CHAVE', $2, $3, $4)
       ON CONFLICT (user_id, tipo) DO UPDATE SET
         client_id_enc = EXCLUDED.client_id_enc, client_secret_enc = EXCLUDED.client_secret_enc,
         role_type = EXCLUDED.role_type, updated_at = now()`,
      [userId, encrypt(cid), encrypt(csec), role]
    );

    return res.json({ ok: true, mensagem: "Chave de acesso salva no banco de dados." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: "Falha ao salvar chave de acesso." });
  }
}

export async function limparChaveAcesso(req, res) {
  try {
    const userId = req.userId;
    SiscomexAuthService.limparSessao(userId);
    await pool.query(`DELETE FROM credenciais WHERE user_id = $1 AND tipo = 'CHAVE'`, [userId]);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: "Falha ao limpar chave de acesso." });
  }
}
