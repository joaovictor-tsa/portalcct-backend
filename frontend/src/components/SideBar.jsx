import { useState } from "react";
import "../styles/SideBar.css";
import { FaSearch, FaClock, FaCog } from "react-icons/fa";
import { RiCertificate2Fill } from "react-icons/ri";
import { FaUsers } from "react-icons/fa6";
import { useAuth } from "../context/AuthContext.jsx";

export default function SideBar() {
  const [isOpen, setIsOpen] = useState(false);
  const { isAdmin, user, logout } = useAuth();

  const toggleSidebar = () => setIsOpen((prev) => !prev);
  const closeSidebar = () => setIsOpen(false);

  return (
    <>
        <button
            type="button"
            aria-label="Abrir menu"
            className={`sidebar-toggle ${isOpen ? "active" : ""}`}
            onClick={toggleSidebar}
        >
            <span className="bar"></span>
            <span className="bar"></span>
            <span className="bar"></span>
        </button>

        {isOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}

        <aside className={`sidebar ${isOpen ? "open" : ""}`}>
            <div className="sidebar-header">
                <img src="/TSA - Logo base.svg" alt="Logo TSA"/>
            </div> <hr/>

            <nav className="sidebar-nav">
                <a href="/consulta" className="sidebar-link">
                    <FaSearch />
                    Consulta
                </a><hr/>
                <a href="/certificate" className="sidebar-link">
                    <RiCertificate2Fill />
                    Certificados
                </a><hr/>
                {isAdmin && (
                    <>
                        <a href="/users" className="sidebar-link">
                            <FaUsers />
                            Usuários
                        </a><hr/>
                    </>
                )}
                <a href="/fila-consulta" className="sidebar-link">
                    <FaClock />
                    Fila de Consultas
                </a><hr/>
                {isAdmin && (
                    <>
                        <a href="/settings" className="sidebar-link">
                            <FaCog />
                            Configurações
                        </a><hr/>
                    </>
                )}
            </nav>

            {/* {user && (
                <div className="sidebar-user">
                    <div className="sidebar-user-avatar">{user.name?.[0]?.toUpperCase() ?? "?"}</div>
                    <div className="sidebar-user-info">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                    </div>
                </div>
            )} */}

            <div className="btnOut">
                <button type="button" className="out" onClick={logout}>
                    Sair
                </button>
            </div>
        </aside>
    </>
  );
}