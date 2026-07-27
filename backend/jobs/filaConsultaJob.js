import cron from "node-cron";
import { processarFila } from "../services/filaConsultaService.js";

export function iniciarJobFilaConsulta() {
  const expressao = process.env.FILA_POLL_CRON || "*/10 * * * *";
  cron.schedule(expressao, async () => {
    try {
      await processarFila();
    } catch (e) {
      console.error("[Fila] erro no ciclo de processamento:", e);
    }
  });
  console.log(`[Fila] job agendado (${expressao}).`);
}