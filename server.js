import "./loadEnv.js";
import express from "express";
import cors from "cors";
import multer from "multer";
import { login, me } from "./controllers/authController.js";
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
  deleteUser,
} from "./controllers/userController.js";
import { uploadCertificado, obterStatusCredencial, deleteCredencial } from "./controllers/certificadoController.js";
import { definirChaveAcesso, limparChaveAcesso } from "./controllers/acessoChaveController.js";
import {
  consultarHawb,
  consultarMawb,
  consultarResumo,
} from "./controllers/consultaController.js";
import {
  listarFila,
  cancelarItemFila,
} from "./controllers/filaConsultaController.js";
import {
  getConfiguracoes,
  updateConfiguracoes,
} from "./controllers/configuracoesController.js";
import { siscomexConfig } from "./controllers/debugController.js";
import { authMiddleware } from "./middlewares/authMiddleware.js";
import { adminMiddleware } from "./middlewares/adminMiddleware.js";
import { iniciarJobFilaConsulta } from "./jobs/filaConsultaJob.js";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/login", login);
app.get("/api/auth/me", authMiddleware, me);

app.get("/api/users", authMiddleware, listUsers);
app.get("/api/users/:id", authMiddleware, getUser);
app.post("/api/users", authMiddleware, createUser);
app.put("/api/users/:id", authMiddleware, updateUser);
app.patch("/api/users/:id/deactivate", authMiddleware, deactivateUser);
app.delete("/api/users/:id", authMiddleware, deleteUser);

app.get("/api/credenciais/status", authMiddleware, obterStatusCredencial);
app.patch("/api/credenciais/:id/delete", authMiddleware, deleteCredencial);

app.post(
  "/api/certificado",
  authMiddleware,
  upload.single("certificado"),
  uploadCertificado
);

app.post("/api/acesso-chave", authMiddleware, definirChaveAcesso);
app.delete("/api/acesso-chave", authMiddleware, limparChaveAcesso);

app.post("/api/consulta/mawb", authMiddleware, consultarMawb);
app.post("/api/consulta/hawb", authMiddleware, consultarHawb);
app.post("/api/consulta/resumo", authMiddleware, consultarResumo);

app.get("/api/fila-consulta", authMiddleware, listarFila);
app.patch("/api/fila-consulta/:id/cancelar", authMiddleware, cancelarItemFila);

app.get("/api/configuracoes", authMiddleware, adminMiddleware, getConfiguracoes);
app.put("/api/configuracoes", authMiddleware, adminMiddleware, updateConfiguracoes);

app.get("/api/debug/siscomex-config", authMiddleware, siscomexConfig);

const port = Number(process.env.PORT) || 3002;
if (!process.env.JWT_SECRET) {
  console.warn("AVISO: defina JWT_SECRET no .env");
}
if (!process.env.BASE_URL) {
  console.warn("AVISO: defina BASE_URL no .env");
}

app.listen(port, () => {
  console.log(`API em http://localhost:${port}`);
});

iniciarJobFilaConsulta();
