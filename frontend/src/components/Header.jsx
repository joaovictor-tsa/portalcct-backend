import SideBar from "./SideBar"
import { useAuth } from "../context/AuthContext.jsx"
import '../styles/Header.css'
import { FaUserCircle } from "react-icons/fa";

export default function Header(){
    const { logout, user } = useAuth();

    return(
        <header className="header">
            <SideBar />
            <span className="brand">Consulta MAWB / HAWB — Portal Único</span>
            <div className="userHeader">
                <FaUserCircle />
                {user && (
                    <span>{user.name}</span>
                )}
            </div>
        </header>
    )
}