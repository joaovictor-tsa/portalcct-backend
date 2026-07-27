import { useEffect, useState } from "react";
import client from "../api/client";
import Layout from "../components/Layout";
import CertificadoForm from "../components/CertificadoForm";
import { toast } from "react-toastify";
import { FaKey } from "react-icons/fa";
import { RiCertificate2Fill } from "react-icons/ri";
import { FaTrashAlt } from "react-icons/fa";

export default function Certificate(){
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);

    async function carregarCredenciais(){
        try{
            const res = await client.get("/credenciais/status");
            setStatus(res.data);
        }catch(err){
            toast.error("Erro ao carregar credenciais: " + err.message);
        }finally{
            setLoading(false);
        }
    }

    async function deletarCredencial(id){
        try {
            await client.patch(`/credenciais/${id}/delete`);
            toast.success("Credencial deletada!.");
            carregarCredenciais();
        } catch (error) {
            toast.error("Erro ao deletar credencial: " + error.message);
        }
    }

    useEffect(() => {
        carregarCredenciais();
    }, []);

    return(
        <>
            <Layout>
                {!loading && !status?.possuiCertificado && !status?.possuiChaveAcesso ? (
                    <CertificadoForm carregarCredenciais={carregarCredenciais}/>
                ) : (
                    <div className="box">
                        <strong>Minhas Credenciais</strong>

                        {status?.possuiCertificado && (
                            <div className="credentialCard">
                                <div className="credentialCardInfo">
                                    <div className="credentialCardIcon">
                                        <RiCertificate2Fill className="credentialIcon cert" />
                                        <strong>Certificado A1</strong>
                                    </div>
                                    <p className="hint">Cadastrado em: {new Date(status.certificado.criadoEm).toLocaleDateString()}</p>
                                    <p className="hint">Última atualização: {new Date(status.certificado.atualizadoEm).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <div className="actions">
                                        <button className="btnAction deactivate" title="Deletar Credencial" onClick={() => deletarCredencial(status.certificado.id)}>
                                            <FaTrashAlt />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {status?.possuiChaveAcesso && (
                            <div className="credentialCard">
                                <div>
                                    <div className="credentialCardInfo">
                                        <div className="credentialCardIcon">
                                            <FaKey className="credentialIcon chave" />
                                            <strong>Chave de Acesso</strong>
                                        </div>
                                        <p className="hint">Perfil: {status.chaveAcesso.roleType}</p>
                                        <p className="hint">Cadastrada em: {new Date(status.chaveAcesso.criadoEm).toLocaleDateString()}</p>
                                    </div>
                                </div>

                                <div>
                                    <div className="actions">
                                        <button className="btnAction deactivate" title="Deletar Credencial" onClick={() => deletarCredencial(status.certificado.id)}>
                                            <FaTrashAlt />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Layout>
        </>
    )
}