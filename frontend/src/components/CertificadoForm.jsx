import { useState } from "react";
import client from "../api/client.js";
import '../styles/Certificate.css'
import { toast } from "react-toastify";

export default function CertificadoForm({ onUploaded, carregarCredenciais }) {
  const [modo, setModo] = useState("a1"); // a1 | chave
  const [senha, setSenha] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [roleType, setRoleType] = useState("TRANSPORT");
  const [msg, setMsg] = useState(null);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setMsg(null);
    setErro("");
    setLoading(true);
    try {
      if (modo === "a1") {
        if (!arquivo) {
          setErro("Selecione o arquivo .pfx.");
          setLoading(false);
          return;
        }
        const fd = new FormData();
        fd.append("certificado", arquivo);
        fd.append("senha", senha);
        await client.post("/certificado", fd);
        setSenha("");
        setArquivo(null);
        toast.success("Certificado aceito.");
        carregarCredenciais();
      } else {
        const body = {
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          roleType: roleType.trim(),
        };
        await client.post("/acesso-chave", body);
        setClientId("");
        setClientSecret("");
        toast.success("Chave de acesso salva.");
        carregarCredenciais();
      }
      onUploaded?.();
    } catch (err) {
      const d = err.response?.data;
      const extra = d?.tecnico ? ` (${d.tecnico})` : "";
      setErro((d?.erro || err.message || "Falha no envio.") + extra);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="box">
      <strong>Credencial Portal Único</strong>

      <p className="hint">
        Escolha A1 (.pfx) ou autenticação por Chave de Acesso.
      </p>

      <div className="row row-bottom">
        <div className="field">
          <label className="label" htmlFor="modo">
            Modo
          </label>

          <select
            id="modo"
            value={modo}
            onChange={(e) => {
              setErro("");
              setMsg(null);
              setModo(e.target.value);
            }}
            className="input"
          >
            <option value="a1">A1 (.pfx + senha)</option>
            <option value="chave">
              Chave de Acesso (Client-Id/Client-Secret)
            </option>
          </select>
        </div>
      </div>

      <form onSubmit={enviar}>
        <div className="row">
          {modo === "a1" ? (
            <>
              <div className="field">
                <label className="label" htmlFor="pfx">
                  Arquivo .pfx
                </label>

                <input
                  id="pfx"
                  type="file"
                  accept=".pfx,.p12"
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                  className="input"
                />
              </div>

              <div className="field">
                <label className="label" htmlFor="cert-senha">
                  Senha do certificado
                </label>

                <input
                  id="cert-senha"
                  type="password"
                  autoComplete="off"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="input"
                />
              </div>
            </>
          ) : (
            <>
              <div className="field">
                <label className="label" htmlFor="client-id">
                  Client-Id
                </label>

                <input
                  id="client-id"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="input"
                  autoComplete="off"
                  placeholder="Client-Id"
                />
              </div>

              <div className="field">
                <label className="label" htmlFor="client-secret">
                  Client-Secret
                </label>

                <input
                  id="client-secret"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className="input"
                  autoComplete="off"
                  placeholder="Client-Secret"
                />
              </div>

              <div className="field">
                <label className="label" htmlFor="role-type">
                  Role-Type
                </label>

                <select
                  id="role-type"
                  value={roleType}
                  onChange={(e) => setRoleType(e.target.value)}
                  className="input"
                >
                  <option value="TRANSPORT">
                    TRANSPORT (Transportador)
                  </option>
                  <option value="IMPEXP">
                    IMPEXP (Declarante)
                  </option>
                  <option value="DEPOSIT">
                    DEPOSIT (Depositário)
                  </option>
                  <option value="OPERPORT">
                    OPERPORT (Operador Portuário)
                  </option>
                  <option value="AGEREMESS">
                    AGEREMESS (Remessa Expressa/Correio)
                  </option>
                  <option value="TERCEIROS">
                    TERCEIROS (Outros Intervenientes)
                  </option>
                </select>
              </div>
            </>
          )}

          <button
            type="submit"
            className="btn"
            disabled={loading}
          >
            {loading ? "Enviando..." : "Salvar credencial"}
          </button>
        </div>

        {erro && <div className="err">{erro}</div>}
        {msg && <div className="ok">{msg}</div>}
      </form>
    </div>
  );
}
