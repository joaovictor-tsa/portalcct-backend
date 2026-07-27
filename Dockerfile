# ---- imagem final: backend Node servindo API + frontend estático ----
FROM node:20-alpine
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

ENV NODE_ENV=production
EXPOSE 3002
CMD ["node", "server.js"]
