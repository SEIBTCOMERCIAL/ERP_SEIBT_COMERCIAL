"use client";

import { useState } from "react";
import { FileText, FolderOpen } from "lucide-react";

interface Props {
  propostaId: string;
  /** Nome sugerido (padrão "CLIENTE - CIDADE - UF - EQUIPAMENTO - Nº"). */
  nomeArquivo: string;
  checklistCompleto?: boolean;
}

// Janela "Salvar como" do navegador (Chrome/Edge). Em navegadores sem ela, o arquivo
// vai para a pasta de Downloads, como antes.
type JanelaSalvar = (opcoes: {
  suggestedName: string;
  id?: string;
  startIn?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{ createWritable: () => Promise<{ write: (dados: Blob) => Promise<void>; close: () => Promise<void> }> }>;

const TIPO_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function GerarDocxBtn({ propostaId, nomeArquivo, checklistCompleto = true }: Props) {
  const [estado, setEstado] = useState<"livre" | "gerando" | "salvo" | "erro">("livre");
  const [mensagem, setMensagem] = useState("");
  const url = `/api/docx/${propostaId}`;

  const salvarEmPasta = async () => {
    const janela = (window as unknown as { showSaveFilePicker?: JanelaSalvar }).showSaveFilePicker;
    if (!janela) {
      // Navegador sem a janela "Salvar como": baixa normalmente.
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeArquivo;
      a.click();
      return;
    }

    let arquivo;
    try {
      // A janela precisa abrir logo no clique; o Word é gerado depois de escolher a pasta.
      arquivo = await janela({
        suggestedName: nomeArquivo,
        id: "propostas-seibt", // o navegador lembra a última pasta usada
        startIn: "documents",
        types: [{ description: "Documento do Word", accept: { [TIPO_DOCX]: [".docx"] } }],
      });
    } catch {
      return; // cancelou a janela
    }

    setEstado("gerando");
    setMensagem("");
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(await resp.text());
      const conteudo = await resp.blob();
      const escrita = await arquivo.createWritable();
      await escrita.write(conteudo);
      await escrita.close();
      setEstado("salvo");
      setMensagem("Arquivo salvo na pasta escolhida.");
    } catch (e) {
      setEstado("erro");
      setMensagem("Não foi possível gerar o Word: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {!checklistCompleto && (
        <div
          style={{
            fontSize: 11,
            color: "#92400e",
            background: "#fef9c3",
            border: "1px solid #fde047",
            borderRadius: 6,
            padding: "8px 10px",
            lineHeight: 1.4,
          }}
        >
          Checklist técnico incompleto — o .docx será gerado sem os dados da aplicação.
        </div>
      )}
      <button
        type="button"
        onClick={salvarEmPasta}
        disabled={estado === "gerando"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "8px 14px",
          background: "#2C4F79",
          border: "none",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          color: "#fff",
          cursor: estado === "gerando" ? "wait" : "pointer",
          opacity: estado === "gerando" ? 0.7 : 1,
        }}
      >
        <FolderOpen size={14} />
        {estado === "gerando" ? "Gerando Word..." : "Salvar Word (escolher pasta)"}
      </button>
      <a
        href={url}
        download={nomeArquivo}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "#2074B9", textDecoration: "none" }}
      >
        <FileText size={12} />
        Baixar direto na pasta Downloads
      </a>
      {mensagem && (
        <div style={{ fontSize: 11, color: estado === "erro" ? "#dc2626" : "#15803d" }}>{mensagem}</div>
      )}
      <div style={{ fontSize: 10.5, color: "#6b7b8d", wordBreak: "break-word" }}>{nomeArquivo}</div>
    </div>
  );
}
