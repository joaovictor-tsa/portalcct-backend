import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import client from "../api/client.js";
import { toast } from "react-toastify";

const STATUS = {
  pendente: { label: "Aguardando chegada", badge: "badge-warning" },
  recepcionada: { label: "Recepcionada — e-mail enviado", badge: "badge-success" },
  erro: { label: "Erro (limite de tentativas)", badge: "badge-danger" },
  cancelada: { label: "Cancelada", badge: "badge-neutral" },
};

function statusDoItem(it) {
  if (it.status === "pendente" && it.chegada_notificada_em) {
    return { label: "Carga chegou - aguardando recepção", badge: "badge-info" };
  }
  return STATUS[it.status] ?? { label: it.status, badge: "badge-neutral" };
}

export default function FilaConsulta() {
  const [itens, setItens] = useState([]);

  async function carregar() {
    try {
      const res = await client.get("/fila-consulta");
      setItens(res.data);
    } catch (e) {
      toast.error("Erro ao carregar fila: " + e.message);
    }
  }

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 30000);
    return () => clearInterval(intervalo);
  }, []);

  async function cancelar(id) {
    try {
      await client.patch(`/fila-consulta/${id}/cancelar`);
      toast.success("Monitoramento cancelado.");
      carregar();
    } catch (e) {
      toast.error("Erro ao cancelar: " + e.message);
    }
  }

  const statusLabel = {
    aguardando_recepcao: "Aguardando recepção",
    aguardando_chegada: "Aguardando chegada",
    chegada: "Chegou — e-mail enviado",
    erro: "Erro (limite de tentativas)",
    cancelada: "Cancelada",
  };

  const statusCancelavel = ["aguardando_recepcao", "aguardando_chegada"];

  return (
    <Layout>
      <div className="usersContainer">
        <div className="usersHeader">
          <div>
            <strong>Fila de Consultas</strong>
            <p className="hint">
              Documentos que ainda não chegaram entram aqui automaticamente após uma consulta.
              O sistema verifica a cada 10 minutos e avisa por e-mail (para o e-mail do seu cadastro) assim que a carga chegar.
            </p>
          </div>
        </div>

        <div className="box">
          <div className="tableWrapper">
            <table className="usersTable">
              <thead>
                <tr className="tableTr">
                  <th>Tipo</th>
                  <th>Número</th>
                  <th>E-mail de aviso</th>
                  <th>Status</th>
                  <th>Tentativas</th>
                  <th className="thActions">Ações</th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 && (
                  <tr className="tableTr">
                    <td colSpan={6}>Nenhum documento na fila de monitoramento.</td>
                  </tr>
                )}
                {itens.map((it) => {
                  const status = statusDoItem(it);
                  return(
                    <tr className="tableTr" key={it.id}>
                      <td>{it.tipo}</td>
                      <td>{it.numero}</td>
                      <td>{it.email_destino}</td>
                      <td>{status.label}</td>
                      <td className="try">{it.tentativas}</td>
                      <td className="actions">
                        {it.status === "pendente" && (
                          <button className="btnAction deactivate" onClick={() => cancelar(it.id)}>Cancelar</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}