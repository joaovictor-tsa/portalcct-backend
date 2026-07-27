import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import client from "../api/client.js";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext.jsx";

export default function Settings() {
  const { isAdmin } = useAuth();
  const [form, setForm] = useState({
    smtp_host: "",
    smtp_port: "",
    smtp_user: "",
    smtp_pass: "",
    smtp_from: "",
  });
  const [loading, setLoading] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    client
      .get("/configuracoes")
      .then((res) => setForm(res.data))
      .catch((e) => toast.error("Erro ao carregar configurações: " + e.message))
      .finally(() => setCarregando(false));
  }, [isAdmin]);

  function setCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function salvar(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await client.put("/configuracoes", form);
      toast.success("Configurações salvas com sucesso!");
    } catch (err) {
      toast.error(err.response?.data?.erro || "Erro ao salvar configurações.");
    } finally {
      setLoading(false);
    }
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="usersContainer">
          <div className="box">
            <strong>Acesso restrito</strong>
            <p className="hint">Somente administradores podem acessar as configurações.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="usersContainer settings">
        <div className="usersContent">
          <div className="usersHeader">
            <div>
              <strong>Configurações</strong>
              <p className="hint">
                Dados de envio de e-mail (SMTP) usados para avisar quando uma carga da fila for recepcionada.
              </p>
            </div>
          </div>

          <div className="box">
            {carregando ? (
              <p>Carregando...</p>
            ) : (
              <form onSubmit={salvar} style={{ display: "flex", flexDirection: "column" }}>
                <div className="inputField">
                  <label className="label">Host SMTP</label>
                  <input
                    className="input"
                    value={form.smtp_host}
                    onChange={(e) => setCampo("smtp_host", e.target.value)}
                    placeholder="smtp.seudominio.com"
                  />
                </div>
                <div className="inputField">
                  <label className="label">Porta</label>
                  <input
                    className="input"
                    value={form.smtp_port}
                    onChange={(e) => setCampo("smtp_port", e.target.value)}
                    placeholder="587"
                  />
                </div>
                <div className="inputField">
                  <label className="label">Usuário</label>
                  <input
                    className="input"
                    value={form.smtp_user}
                    onChange={(e) => setCampo("smtp_user", e.target.value)}
                    placeholder="notificacoes@seudominio.com"
                  />
                </div>
                <div className="inputField">
                  <label className="label">Senha</label>
                  <input
                    className="input"
                    type="password"
                    value={form.smtp_pass}
                    onChange={(e) => setCampo("smtp_pass", e.target.value)}
                    placeholder="Deixe em branco para manter a atual"
                    autoComplete="off"
                  />
                </div>
                <div className="inputField">
                  <label className="label">Remetente (From)</label>
                  <input
                    className="input"
                    value={form.smtp_from}
                    onChange={(e) => setCampo("smtp_from", e.target.value)}
                    placeholder='"CCT Notificações" <notificacoes@seudominio.com>'
                  />
                </div>
                <button type="submit" className="btn" disabled={loading}>
                  {loading ? "Salvando..." : "Salvar"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
