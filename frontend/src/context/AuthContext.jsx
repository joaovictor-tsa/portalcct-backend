import { createContext, useContext, useEffect, useState } from "react";
import client, { setAuthToken } from "../api/client.js";

const TOKEN_KEY = "siscomex_app_token";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) setAuthToken(saved);
    return saved;
  });
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      setAuthToken(token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      setAuthToken(null);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    client
      .get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => setUser(null));
  }, [token]);

  function login(newToken) {
    setToken(newToken);
  }

  function logout() {
    setToken(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, isAdmin: user?.role === "admin", login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth precisa ser usado dentro de um AuthProvider");
  }
  return ctx;
}