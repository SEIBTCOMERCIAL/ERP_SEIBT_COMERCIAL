"use server";

// PDF via Railway/Puppeteer foi cancelado.
// Propostas exportadas em .docx via /api/docx/[propostaId].
// Frete folder PDF pendente de decisão futura.

export async function gerarFretePdf(
  freteId: string,
  tipo: "cliente" | "transportadora"
): Promise<{ success?: boolean; url?: string; error?: string }> {
  void freteId;
  void tipo;
  return { error: "Geração de PDF desativada. O frete PDF será implementado em versão futura." };
}
