export function adminMiddleware(req, res, next) {
  if (req.userRole !== "admin") {
    return res.status(403).json({ erro: "Acesso restrito a administradores." });
  }
  next();
}
