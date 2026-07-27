import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx"
import LoginPage from "../pages/LoginPage";
import Consulta from "../pages/Consulta";
import Users from "../pages/Users.jsx";
import Certificate from "../pages/Certificate.jsx";
import FilaConsulta from "../pages/FilaConsulta.jsx";
import Settings from "../pages/Settings.jsx";

function PrivateRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/" replace />;
}

export default function AppRoutes(){
    return(
        <>
            <Routes>
                <Route path='/' element={<LoginPage/>}/>
                <Route
                    path="/consulta"
                    element={
                    <PrivateRoute>
                        <Consulta />
                    </PrivateRoute>
                    }
                />
                <Route
                    path="/certificate"
                    element={
                    <PrivateRoute>
                        <Certificate />
                    </PrivateRoute>
                    }
                />
                <Route
                    path='/users'
                    element={
                        <PrivateRoute>
                            <Users />
                        </PrivateRoute>
                    } />
                <Route
                    path="/fila-consulta"
                    element={
                    <PrivateRoute>
                        <FilaConsulta />
                    </PrivateRoute>
                    }
                />
                <Route
                    path="/settings"
                    element={
                    <PrivateRoute>
                        <Settings />
                    </PrivateRoute>
                    }
                />
            </Routes>
        </>
    )
}