import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseCsv(caminho) {
  const conteudo = fs.readFileSync(caminho, "utf8");
  const linhas = conteudo.split(/\r?\n/).filter(Boolean);
  const mapa = {};
  linhas.slice(1).forEach((linha) => {
    const match = linha.match(/^([^,]+),(?:"([^"]*)"|([^,]*))/);
    if (!match) return;
    const codigo = match[1].trim();
    const descricao = (match[2] ?? match[3] ?? "").trim();
    mapa[codigo] = descricao;
  });
  return mapa;
}

export const recintos = parseCsv(path.join(__dirname, "../data/RecintoAduaneiro.csv"));
export const unidades = parseCsv(path.join(__dirname, "../data/unidades.csv"));
