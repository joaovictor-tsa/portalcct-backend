import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import '../styles/Users.css'
import { FaPlus, FaPencilAlt } from "react-icons/fa";
import { HiArchiveBoxXMark } from "react-icons/hi2";
import { FaCheckCircle } from "react-icons/fa";
import RegisterForm from "../components/RegisterForm";
import client from "../api/client.js";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext.jsx";

export default function Users() {
  const { isAdmin } = useAuth();
  const [modalState, setModalState] = useState({ open: false, id: null });
  const [users, setUsers] = useState([]);

  async function carregarUsuarios() {
    try {
      const res = await client.get("/users");
      setUsers(res.data);
    } catch (error) {
      toast.error("Erro ao carregar usuários: " + error.message);
    }
  }

  async function change(id) {
    try {
      await client.patch(`/users/${id}/change`);
      toast.success("Situação atualizada!");
      carregarUsuarios();
    } catch (error) {
      toast.error("Erro ao desativar usuário: " + error.message);
    }
  }
  
  function fecharModal() {
    setModalState({ open: false, id: null });
    carregarUsuarios();
  }

  useEffect(() => { 
    carregarUsuarios(); 
  }, []);

  if (!isAdmin) {
    return (
      <Layout>
        <div className="usersContainer">
          <div className="box">
            <strong>Acesso restrito</strong>
            <p className="hint">Somente administradores podem acessar os usuários.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="usersContainer">

        <div className="usersHeader">
          <div>
            <strong>Usuários</strong>
            <p className="hint">Gerencie contas e perfis de acesso cadastrados no sistema.</p>
          </div>

          <div>
            <button className="btnCadastro" onClick={() => setModalState({ open: true, id: null })}>
              <FaPlus />
              Cadastro
            </button>
          </div>
        </div>

        <div className="box">
          <div className="tableWrapper">

            <table className="usersTable">
              <thead>
                <tr className="tableTr">
                  <th>Usuário</th>
                  <th>E-mail</th>
                  <th className="thSituation">Situação</th>
                  <th className="thActions">Ações</th>
                </tr>
              </thead>

              <tbody>
                {users.map((u) => (
                  <tr className="tableTr" key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td className={`situation ${u.active ? "active" : "inactive"}`}>
                      <span>• </span>
                      {u.active ? "Ativo" : "Inativo"}
                    </td>
                    <td>
                      <div className="actions">
                        <button className="btnAction edit" title="Editar Usuário" onClick={() => setModalState({ open: true, id: u.id })}>
                          <FaPencilAlt />
                        </button>

                        {u.role == "user" && (
                          u.active ? (
                            <button className="btnAction deactivate" title="Desativar Usuário" onClick={() => change(u.id)}>
                              <HiArchiveBoxXMark />
                            </button>
                          ) : (
                            <button className="btnAction activate" title="Ativar Usuário" onClick={() => change(u.id)}>
                              <FaCheckCircle />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {modalState.open && (
          <RegisterForm
            id={modalState.id}
            onClose={fecharModal}
          />
        )}
      </div>
    </Layout>
  );
}
