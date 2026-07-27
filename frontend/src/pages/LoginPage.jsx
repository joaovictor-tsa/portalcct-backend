import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import client from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/LoginPage.css";

export default function LoginPage() {
  const { token, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  if (token) {
    return <Navigate to="/consulta" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    setLoading(true);
    try {
      const { data } = await client.post("/auth/login", { email, password });
      login(data.token);
      navigate("/consulta");
    } catch (err) {
      setErro(
        err.response?.data?.erro || err.message || "Falha ao entrar."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <div className="card cardLogin">
        <h1 className="title">Acesso</h1>

        <p className="sub">
          Login interno. Depois configure A1 (.pfx) ou Chave de Acesso para
          consultar no Portal Único.
        </p>

        <form onSubmit={handleSubmit}>
          {erro ? <div className="err">{erro}</div> : null}

          <label className="label" htmlFor="email">
            E-mail
          </label>

          <input
            className="input"
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label className="label" htmlFor="password">
            Senha
          </label>

          <input
            className="input"
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}