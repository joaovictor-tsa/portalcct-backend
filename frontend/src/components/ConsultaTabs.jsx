import { useState, useEffect } from "react";
import client from "../api/client.js";
import generatePDF from "./generatePdf.jsx";
import '../styles/ConsultaTabs.css';

const tabBtn = (active) => ({
  padding: "0.5rem 1rem",
  border: "none",
  borderBottom: active ? "none" : "1px solid white",
  borderRadius: "8px 8px 0 0",
  background: active ? "white" : "var(--surface)",
  color: active ? "black": "var(--text)",
  cursor: "pointer",
  fontWeight: 400,
  marginBottom: "-1px",
});

const styles = {
  panel: {
    borderRadius: "0 var(--radius) var(--radius) var(--radius)",
    padding: "1.25rem",
    background: "white",
    boxShadow: "5px 5px 5px 1px #b4b4b4",
  },
  row: { display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", padding: "0.5em" },
  input: {
    flex: "1 1 220px",
    padding: "0.6rem 0.75rem",
    borderRadius: "8px",
    border: "none",
    background: "var(--bg)",
    color: "black",
  },
  btn: {
    padding: "0.6rem 1.25rem",
    border: "none",
    borderRadius: "8px",
    background: "var(--surface)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  err: { color: "var(--danger)", marginTop: "0.75rem" },
  tabs: { display: "flex", gap: "0.25rem", alignItems: "flex-end" },
};

export default function ConsultaTabs() {
  const [aba, setAba] = useState("mawb");
  const [numero, setNumero] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [dataEmissao, setDataEmissao] = useState("");
  const [json, setJson] = useState(null);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [unidades, setUnidades] = useState({});
  const [recintos, setRecintos] = useState({});

  async function consultar() {
    setErro("");
    setJson("");
    setLoading(true);
    try {
      const path = aba === "mawb" ? "/consulta/mawb" : "/consulta/hawb";
      const body = { numero: numero.trim() };
      const cnpjDigits = cnpj.replace(/\D/g, "");
      if (cnpjDigits.length === 14) body.cnpjResponsavel = cnpjDigits;
      if (/^\d{4}-\d{2}-\d{2}$/.test(dataEmissao.trim())) {
        body.dataEmissao = dataEmissao.trim();
      }
      const { data } = await client.post(path, body);
      setJson(data.resultado ?? data);
      console.log(JSON.stringify(data.resultado ?? data, null, 2));
    } catch (err) {
      const d = err.response?.data;
      setErro(
        d?.erro ||
          d?.detalhe ||
          err.message ||
          "Erro na consulta."
      );
      setJson(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetch("/unidades.csv")
      .then((res) => res.text())
      .then((texto) => {
        const linhas = texto.trim().split("\n");

        const mapa = {};

        // ignora o cabeçalho
        linhas.slice(1).forEach((linha) => {
          const [codigo, descricao] = linha.split(",");
          mapa[codigo.trim()] = descricao.trim();
        });

        setUnidades(mapa);
      });
  }, []);

  useEffect(() => {
    fetch("/RecintoAduaneiro.csv")
      .then((res) => res.text())
      .then((texto) => {
        const linhas = texto.trim().split("\n");

        const mapa = {};

        linhas.slice(1).forEach((linha) => {
          const [codigo, descricao] = linha.split(",");
          mapa[codigo.trim()] = descricao.trim();
        });

        setRecintos(mapa);
      });
  }, []);

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateYYYYMMDD = (date) => {
    if (!date || date.length !== 8) return "-";

    return `${date.slice(6, 8)}/${date.slice(4, 6)}/${date.slice(0, 4)}`;
  };

  return (
    <div>
      <div style={styles.tabs}>
        <button
          type="button"
          style={tabBtn(aba === "mawb")}
          onClick={() => setAba("mawb")}
        >
          MAWB
        </button>
        <button
          type="button"
          style={tabBtn(aba === "hawb")}
          onClick={() => setAba("hawb")}
        >
          HAWB
        </button>
      </div>
      
      <div style={styles.panel}>
        <div style={styles.row}>
          <input
            placeholder="numeroConhecimento (ex.: 43NQKMM8KNT)"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            style={styles.input}
          />
          <button
            type="button"
            style={styles.btn}
            onClick={consultar}
            disabled={loading}
          >
            {loading ? "Consultando…" : "Consultar"}
          </button>
        </div>
        {erro ? <div style={styles.err}>{erro}</div> : null}
        {json ? (
          <div className="consultaContainer">
            <div className="consultaGrid">
              <section className="card cardConsulta">
                <header className="cardHeader">
                  <h3>{json?.[0]?.tipo}</h3>
                  <span className="cardHeaderSub">{json?.[0]?.identificacao}</span>
                </header>

                <div className="fieldGrid">
                  <div className="field">
                    <span className="fieldLabel">Emissão</span>
                    <span className="fieldValue">{formatDate(json?.[0]?.dataEmissao)}</span>
                  </div>
                  <div className="field">
                    <span className="fieldLabel">RUC</span>
                    <span className="fieldValue">{json?.[0]?.ruc}</span>
                  </div>
                  <div className="field">
                    <span className="fieldLabel">Qtd</span>
                    <span className="fieldValue">{json?.[0]?.quantidadeVolumesConhecimento}</span>
                  </div>
                  <div className="field">
                    <span className="fieldLabel">Peso</span>
                    <span className="fieldValue">{json?.[0]?.pesoBrutoConhecimento} Kg</span>
                  </div>
                  <div className="field">
                    <span className="fieldLabel">CNPJ</span>
                    <span className="fieldValue">{json?.[0]?.cnpjResponsavelArquivo}</span>
                  </div>
                  <div className="field">
                    <span className="fieldLabel">Origem</span>
                    <span className="fieldValue">{json?.[0]?.codigoAeroportoOrigemConhecimento}</span>
                  </div>
                  <div className="field">
                    <span className="fieldLabel">Destino</span>
                    <span className="fieldValue">{json?.[0]?.codigoAeroportoDestinoConhecimento}</span>
                  </div>
                </div>

                {json?.[0]?.indicadorPartesMadeira === "S" && (
                  <span className="badge badgeWarning">Possui madeira</span>
                )}
              </section>

              <section className="card cardViagem">
                <header className="cardHeader">
                  <h3>Viagem associada</h3>
                  <span className="cardHeaderSub">
                    {json?.[0]?.viagensAssociadas?.[0]?.identificacaoViagem}
                  </span>
                </header>

                <div className="fieldGrid">
                  <div className="field">
                    <span className="fieldLabel">Voo</span>
                    <span className="fieldValue">
                      {json?.[0]?.viagensAssociadas?.[0]?.identificacaoViagem?.slice(0, 6)}
                    </span>
                  </div>
                  <div className="field">
                    <span className="fieldLabel">Origem</span>
                    <span className="fieldValue">
                      {json?.[0]?.viagensAssociadas?.[0]?.identificacaoViagem?.slice(-3)}
                    </span>
                  </div>
                  <div className="field">
                    <span className="fieldLabel">Partida</span>
                    <span className="fieldValue">
                      {formatDateYYYYMMDD(
                        json?.[0]?.viagensAssociadas?.[0]?.identificacaoViagem?.slice(6, 14)
                      )}
                    </span>
                  </div>
                  <div className="field">
                    <span className="fieldLabel">Destino</span>
                    <span className="fieldValue">
                      {json?.[0]?.viagensAssociadas?.[0]?.aeroportoChegada}
                    </span>
                  </div>
                  <div className="field">
                    <span className="fieldLabel">Chegada</span>
                    <span className="fieldValue">
                      {formatDate(json?.[0]?.viagensAssociadas?.[0]?.dataHoraChegadaEfetiva)}
                    </span>
                  </div>
                  <div className="field">
                    <span className="fieldLabel">Termo</span>
                    <span className="fieldValue">
                      {json?.[0]?.viagensAssociadas?.[0]?.termoEntrada}
                    </span>
                  </div>
                </div>
              </section>

              <section className={`card ${json?.[0]?.bloqueiosAtivos?.length ? "cardAlert" : ""}`}>
                <header className="cardHeader">
                  <h3>Bloqueios ativos</h3>
                </header>
                {json?.[0]?.bloqueiosAtivos?.length ? (
                  json[0].bloqueiosAtivos.map((b, i) => (
                    <div key={i} className="cardText cardTextAlert">
                      <p><strong>{b.tipoBloqueio}</strong></p>
                      <p className="cardMeta">
                        Alcance: {b.alcanceBloqueio} • Desde: {b.dataHoraBloqueio}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="cardText cardTextEmpty">Nenhum registro encontrado.</p>
                )}
              </section>

              <section className="card cardSituacao">
                <header className="cardHeader">
                  <h3>Situação atual</h3>
                  <span className="badge badgeInfo">
                    {json?.[0]?.partesEstoque?.[0]?.situacaoAtual}
                  </span>
                </header>

                <div className="fieldGrid">
                  <div className="field fieldWide">
                    <span className="fieldLabel">Atualizado em</span>
                    <span className="fieldValue">
                      {json?.[0]?.partesEstoque?.[0]?.dataHoraSituacaoAtual}
                    </span>
                  </div>
                  <div className="field">
                    <span className="fieldLabel">Qtd</span>
                    <span className="fieldValue">
                      {json?.[0]?.quantidadeVolumesConhecimento}
                    </span>
                  </div>
                  {json?.[0]?.partesEstoque?.[0]?.pesoBrutoEstoque !== null && (
                    <div className="field">
                      <span className="fieldLabel">Peso</span>
                      <span className="fieldValue">
                        {json?.[0]?.partesEstoque?.[0]?.pesoBrutoEstoque} Kg
                      </span>
                    </div>
                  )}
                  {json?.[0]?.partesEstoque?.[0]?.recintoAduaneiro !== null && (
                    <div className="field fieldWide">
                      <span className="fieldLabel">RA</span>
                      <span className="fieldValue">
                        {json?.[0]?.partesEstoque?.[0]?.recintoAduaneiro} -{" "}
                        {recintos[json?.[0]?.partesEstoque?.[0]?.recintoAduaneiro] ?? "Não encontrado"}
                      </span>
                    </div>
                  )}
                  <div className="field fieldWide">
                    <span className="fieldLabel">URF</span>
                    <span className="fieldValue">
                      {json?.[0]?.partesEstoque?.[0]?.unidadeRfb} -{" "}
                      {unidades[json?.[0]?.partesEstoque?.[0]?.unidadeRfb] ?? "Não encontrado"}
                    </span>
                  </div>
                  <div className="field fieldWide">
                    <span className="fieldLabel">Situação carregamento</span>
                    <span className="fieldValue">
                      {json?.[0]?.partesEstoque?.[0]?.situacaoCarregamento === "NA"
                        ? "Não se aplica"
                        : json?.[0]?.partesEstoque?.[0]?.situacaoCarregamento === "D"
                        ? "Descarregada"
                        : json?.[0]?.partesEstoque?.[0]?.situacaoCarregamento}
                    </span>
                  </div>
                  {json?.[0]?.partesEstoque?.[0]?.placa && (
                    <div className="field fieldWide">
                      <span className="fieldLabel">Placa</span>
                      <span className="fieldValue">
                        {json?.[0]?.partesEstoque?.[0]?.placa}
                      </span>
                    </div>
                  )}
                </div>
              </section>

              <section className={`card ${json?.[0]?.recepcoesComAvarias?.[0] ? "cardAlert" : ""}`}>
                <header className="cardHeader">
                  <h3>Avarias</h3>
                </header>
                {json?.[0]?.recepcoesComAvarias?.[0] ? (
                  json[0].recepcoesComAvarias.map((av, i) => (
                    <div key={i} className="cardText cardTextAlert">
                      <p>Recinto: {av.recinto ?? "-"} - {recintos[av.recinto] ?? "Não encontrado"}</p>
                      {av.avarias?.length > 0 && (
                        <ul>
                          {av.avarias.map((a, j) => (
                            <li key={j}>{a.codigo} - {a.descricao}</li>
                          ))}
                        </ul>
                      )}
                      {av.observacoesAvarias?.length > 0 && (
                        <p>
                          Obs: {av.observacoesAvarias.map((o, k) =>
                            typeof o === "string" ? o : JSON.stringify(o)
                          ).join("; ")}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="cardText cardTextEmpty">Nenhum registro encontrado.</p>
                )}
              </section>
            </div>

            <div className="consultaActions">
              <button
                type="button"
                className="btnExportarPdf"
                onClick={() =>
                  generatePDF(json, recintos, unidades, formatDate, formatDateYYYYMMDD)
                }
              >
                Baixar PDF
              </button>
            </div>
          </div>
        ) : (
          !erro && (
            <p className="resultPlaceholder">
              O resultado aparecerá aqui.
            </p>
          )
        )}
      </div>
    </div>
  );
}
