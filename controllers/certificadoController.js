import { pool } from "../db/pool.js";
import { encrypt } from "../utils/crypto.js";
import { SiscomexAuthService } from "../services/SiscomexAuthService.js";
import {
  mensagemErroPfx,
  validarPfxCertificado,
} from "../utils/validarPfx.js";

export async function obterStatusCredencial(req, res) {
  try {
    const userId = req.userId;
    const { rows } = await pool.query(
      `SELECT id, tipo, role_type, updated_at FROM credenciais WHERE user_id = $1`,
      [userId]
    );
    const chave = rows.find((r) => r.tipo === "CHAVE");
    const a1 = rows.find((r) => r.tipo === "A1");
    const atual = chave ?? a1 ?? null;
    if (!atual) {
      return res.json({ existe: false });
    }
    return res.json({
      existe: true,
      id: atual.id,
      tipo: atual.tipo,
      roleType: atual.role_type ?? null,
      atualizadoEm: atual.updated_at,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: "Falha ao consultar credencial." });
  }
}

export async function uploadCertificado(req, res) {
  try {
    const file = req.file;
    const senha = req.body?.senha;
    if (!file?.buffer?.length) {
      return res.status(400).json({ erro: "Envie o arquivo .pfx no campo certificado." });
    }
    if (senha == null || String(senha).trim() === "") {
      return res.status(400).json({ erro: "Informe a senha do certificado no campo senha." });
    }
    const senhaStr = String(senha);

    let cred;
    try {
      cred = validarPfxCertificado(file.buffer, senhaStr);
    } catch (e) {
      const hint = mensagemErroPfx(e);
      return res.status(400).json({
        erro: hint || "Não foi possível validar o certificado .pfx.",
        tecnico: process.env.NODE_ENV === "development" ? String(e?.message) : undefined,
      });
    }

    const userId = req.userId;
    let pfxEnc = null, passphraseEnc = null, keyPemEnc = null, certPemEnc = null;
    if (cred.pfx) {
      pfxEnc = encrypt(cred.pfx.toString("base64"));
      passphraseEnc = encrypt(cred.passphrase);
    } else {
      keyPemEnc = encrypt(cred.keyPem);
      certPemEnc = encrypt(cred.certPem);
    }

    await pool.query(
      `INSERT INTO credenciais (user_id, tipo, pfx_enc, passphrase_enc, key_pem_enc, cert_pem_enc)
       VALUES ($1, 'A1', $2, $3, $4, $5)
       ON CONFLICT (user_id, tipo) DO UPDATE SET
         pfx_enc = EXCLUDED.pfx_enc, passphrase_enc = EXCLUDED.passphrase_enc,
         key_pem_enc = EXCLUDED.key_pem_enc, cert_pem_enc = EXCLUDED.cert_pem_enc,
         updated_at = now()`,
      [userId, pfxEnc, passphraseEnc, keyPemEnc, certPemEnc]
    );

    SiscomexAuthService.limparSessao(userId);
    return res.json({
      ok: true,
      mensagem: "Certificado validado e salvo no banco de dados.",
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: "Falha ao processar certificado." });
  }
}

export async function deleteCredencial(req, res){
  const { rows } = await pool.query(`DELETE FROM credenciais WHERE id = $1 RETURNING id`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ erro: "Credencial não encontrada." });
  res.json({ ok: true });
}
