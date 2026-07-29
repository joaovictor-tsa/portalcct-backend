import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db/pool.js";
import crypto from "crypto";
import { enviarEmailResetSenha } from "../services/emailService.js";

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

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body ?? {};
    if (!email) {
      return res.status(400).json({ erro: "Informe o e-mail." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const { rows } = await pool.query(
      `SELECT id, email FROM users WHERE email = $1 AND active`,
      [normalizedEmail]
    );
    const user = rows[0];

    const mensagemGenerica = {
      mensagem:
        "Se esse e-mail estiver cadastrado, enviamos um link para redefinir a senha.",
    };

    if (!user) {
      return res.json(mensagemGenerica);
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    await pool.query(
      `UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`,
      [user.id]
    );

    await pool.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    const link = `${process.env.CORS_ORIGIN}/redefinir-senha?token=${token}`;

    await enviarEmailResetSenha({ destinatario: user.email, link });

    return res.json(mensagemGenerica);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: "Falha ao processar solicitação." });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, novaSenha } = req.body ?? {};
    if (!token || !novaSenha) {
      return res.status(400).json({ erro: "Token e nova senha são obrigatórios." });
    }

    const senha = String(novaSenha);
    const errosSenha = [];
    if (senha.length < 8) errosSenha.push("no mínimo 8 caracteres");
    if (!/[A-Z]/.test(senha)) errosSenha.push("uma letra maiúscula");
    if (!/[^A-Za-z0-9]/.test(senha)) errosSenha.push("um caractere especial");

    if (errosSenha.length > 0) {
      return res.status(400).json({
        erro: `A senha precisa ter: ${errosSenha.join(", ")}.`,
      });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const { rows } = await pool.query(
      `SELECT id, user_id FROM password_resets
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [tokenHash]
    );
    const reset = rows[0];

    if (!reset) {
      return res.status(400).json({ erro: "Link inválido ou expirado." });
    }

    const passwordHash = await bcrypt.hash(senha, 10);

    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
      passwordHash,
      reset.user_id,
    ]);

    await pool.query(`UPDATE password_resets SET used_at = now() WHERE id = $1`, [
      reset.id,
    ]);

    return res.json({ mensagem: "Senha redefinida com sucesso." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: "Falha ao redefinir senha." });
  }
}