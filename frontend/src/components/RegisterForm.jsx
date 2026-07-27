import { useState, useEffect } from "react";
import client from '../api/client.js';
import { TbCircleLetterXFilled } from "react-icons/tb";
import { toast } from "react-toastify";

export default function RegisterForm({ onClose, id }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() =>{
        if(id){
            client.get(`/users/${id}`)
                .then((res) => {
                    setName(res.data.name);
                    setEmail(res.data.email);
                })
                .catch((error) => {
                    toast.error("Erro ao carregar usuário: " + error.message)
                })
        }
    }, [id])

    async function handleSubmit(e){
        e.preventDefault();
        setLoading(true)
        const data = {
            name: name,
            email: email,
            ...(password ? { password } : {})
        }

        try{
            if(id){
                await client.put(`/users/${id}`, data)
            }
            else{
                await client.post('/users', { ...data, password })
            }
            toast.success("Usuário salvo com sucesso!")
            onClose();
        } catch(error){
            toast.error(`Erro ao salvar usuário: ${error.response?.data?.erro || error.message}`)
        } finally{
            setLoading(false);
        }
    }

    return (
        <div className="modalOverlay">
            <div className="registerForm">
                <div className="box">
                    <div className="formHeader">
                        <div>
                            {id ? (
                                <>
                                    <strong>Atualizar Usuário</strong>
                                    <p className="hint">Atualize as informações do usuário.</p>
                                </>
                            ) : (
                                <>
                                    <strong>Cadastro de Usuários</strong>
                                    <p className="hint">Insira o nome, um e-mail válido e uma senha para cadastrar um usuário.</p>
                                </>
                            )}
                        </div>

                        <div>
                            <button type="button" className="btnFechar" onClick={onClose}>
                                <TbCircleLetterXFilled />
                            </button>
                        </div>
                    </div>

                    <form className="registerForm" onSubmit={handleSubmit}>
                        <input className="input" 
                            type="text" 
                            placeholder="Nome" 
                            value={name} 
                            onChange={(e) => setName(e.target.value)}
                            required />
                        <input 
                            className="input" 
                            type="email" 
                            placeholder="E-mail" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)}
                            required />
                        <input
                            className="input"
                            type="password"
                            placeholder={id ? "Nova senha (deixe em branco para manter)" : "Senha"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required={!id} />
                        <button type="submit" className="btn" disabled={loading}>
                            {loading ? "Salvando..." : "Salvar"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}