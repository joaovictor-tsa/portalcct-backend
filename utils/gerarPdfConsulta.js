import { jsPDF } from "jspdf";

function formatDate(date) {
  if (!date) return "-";
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatDateYYYYMMDD(date) {
  if (!date || date.length !== 8) return "-";
  return `${date.slice(6, 8)}/${date.slice(4, 6)}/${date.slice(0, 4)}`;
}

/** @returns {Buffer} PDF em buffer, pronto para anexar em e-mail */
export function gerarPdfConsulta(json, recintos, unidades) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 40;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 50;

  const checkPageBreak = (spaceNeeded = 20) => {
    if (y + spaceNeeded > pageHeight - 40) { doc.addPage(); y = 50; }
  };

  const drawSectionTitle = (title) => {
    checkPageBreak(30);
    doc.setFillColor(240, 240, 240);
    doc.rect(marginX - 10, y - 14, pageWidth - marginX * 2 + 20, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text(title.toUpperCase(), marginX, y + 2);
    y += 26;
  };

  const drawField = (label, value) => {
    if (value === null || value === undefined || value === "") return;
    checkPageBreak(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`${label}:`, marginX, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20, 20, 20);
    doc.text(String(value), marginX + 130, y);
    y += 16;
  };

  const drawAlertText = (text) => {
    checkPageBreak(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(184, 134, 11);
    const lines = doc.splitTextToSize(String(text), pageWidth - marginX * 2);
    doc.text(lines, marginX, y);
    y += lines.length * 12 + 4;
  };

  const drawEmptyText = () => {
    checkPageBreak(16);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(130, 130, 130);
    doc.text("Nenhum registro encontrado.", marginX, y);
    y += 16;
  };

  const drawStructuredList = (items, itemsKey, recintos) => {
    items.forEach((entry, idx) => {
      checkPageBreak(16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const nomeRecinto = recintos?.[entry.recinto] ?? "Não encontrado";
      doc.text(`Recinto: ${entry.recinto ?? "—"} — ${nomeRecinto}`, marginX, y);
      y += 14;

      const lista = entry[itemsKey] ?? [];
      if (lista.length === 0) {
        checkPageBreak(14);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(130, 130, 130);
        doc.text("Nenhum item registrado.", marginX + 10, y);
        y += 14;
      } else {
        lista.forEach((it) => {
          checkPageBreak(14);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(20, 20, 20);
          const linha = `• ${it.codigo ?? ""} — ${it.descricao ?? ""}`;
          const linhasQuebradas = doc.splitTextToSize(linha, pageWidth - marginX * 2 - 10);
          doc.text(linhasQuebradas, marginX + 10, y);
          y += linhasQuebradas.length * 12 + 2;
        });
      }

      if (entry.observacoesAvarias?.length) {
        checkPageBreak(14);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(90, 90, 90);
        doc.text(`Observações: ${entry.observacoesAvarias.join(", ")}`, marginX + 10, y);
        y += 14;
      }

      if (idx < items.length - 1) y += 6;
    });
  };

  const item = json?.[0];
  if (!item) return Buffer.from(doc.output("arraybuffer"));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text("Relatório de Consulta", marginX, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, marginX, y + 14);
  y += 34;

  drawSectionTitle(`${item.tipo ?? "Consulta"} — ${item.identificacao ?? ""}`);
  drawField("Emissão", formatDate(item.dataEmissao));
  drawField("RUC", item.ruc);
  drawField("Qtd", item.quantidadeVolumesConhecimento);
  drawField("Peso", item.pesoBrutoConhecimento ? `${item.pesoBrutoConhecimento} Kg` : null);
  drawField("CNPJ", item.cnpjResponsavelArquivo);
  drawField("Origem", item.codigoAeroportoOrigemConhecimento);
  drawField("Destino", item.codigoAeroportoDestinoConhecimento);
  if (item.indicadorPartesMadeira === "S") { y += 4; drawAlertText("POSSUI MADEIRA"); }
  y += 10;

  const viagem = item.viagensAssociadas?.[0];
  if (viagem) {
    drawSectionTitle("Viagem Associada");
    drawField("Identificação", viagem.identificacaoViagem);
    drawField("Voo", viagem.identificacaoViagem?.slice(0, 6));
    drawField("Origem", viagem.identificacaoViagem?.slice(-3));
    drawField("Partida", formatDateYYYYMMDD(viagem.identificacaoViagem?.slice(6, 14)));
    drawField("Destino", viagem.aeroportoChegada);
    drawField("Chegada", formatDate(viagem.dataHoraChegadaEfetiva));
    drawField("Termo", viagem.termoEntrada);
    y += 10;
  }

  drawSectionTitle("Bloqueios Ativos");
  if (item.bloqueiosAtivos?.[0]) drawStructuredList(item.bloqueiosAtivos, "bloqueios", recintos);
  else drawEmptyText();
  y += 10;

  const estoque = item.partesEstoque?.[0];
  if (estoque) {
    drawSectionTitle("Situação Atual");
    drawField("Situação", estoque.situacaoAtual);
    drawField("Atualizado em", estoque.dataHoraSituacaoAtual);
    drawField("Qtd", item.quantidadeVolumesConhecimento);
    if (estoque.pesoBrutoEstoque !== null) drawField("Peso", `${estoque.pesoBrutoEstoque} Kg`);
    if (estoque.recintoAduaneiro !== null) {
      drawField("RA", `${estoque.recintoAduaneiro} — ${recintos[estoque.recintoAduaneiro] ?? "Não encontrado"}`);
    }
    drawField("URF", `${estoque.unidadeRfb} — ${unidades[estoque.unidadeRfb] ?? "Não encontrado"}`);
    const situacaoCarregamento =
      estoque.situacaoCarregamento === "NA" ? "Não se aplica"
      : estoque.situacaoCarregamento === "D" ? "Descarregada"
      : estoque.situacaoCarregamento;
    drawField("Situação Carregamento", situacaoCarregamento);
    y += 10;
  }

  drawSectionTitle("Avarias");
  if (item.recepcoesComAvarias?.[0]) drawStructuredList(item.recepcoesComAvarias, "avarias", recintos);
  else drawEmptyText();

  return Buffer.from(doc.output("arraybuffer"));
}
