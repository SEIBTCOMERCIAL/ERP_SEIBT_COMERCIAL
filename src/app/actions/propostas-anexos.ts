"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AVISO_ESTRUTURA_CRM, faltaEstruturaCrm } from "@/lib/propostas/crm";
import { registrarHistorico, usuarioAtual } from "@/lib/propostas/crm-servidor";

const BUCKET = "proposta-anexos";
const LIMITE_BYTES = 50 * 1024 * 1024;
const CATEGORIAS = ["pedido_pdf", "proposta_externa", "demonstrativo", "foto", "desenho", "documento_tecnico", "planilha", "outro"];
// Arquivos que executam código não entram no sistema.
const EXTENSOES_BLOQUEADAS = new Set(["exe", "bat", "cmd", "com", "msi", "scr", "ps1", "vbs", "js", "jse", "sh", "jar", "dll", "apk", "app", "html", "htm", "svg"]);

function extensaoDe(nome: string) {
  const i = nome.lastIndexOf(".");
  return i >= 0 ? nome.slice(i + 1).toLowerCase() : "";
}

function nomeSeguro(nome: string) {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80) || "arquivo";
}

/** Confere se o usuário enxerga a proposta (a regra de acesso da proposta vale também para os anexos). */
async function podeAcessarProposta(propostaId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const usuario = await usuarioAtual(supabase);
  if (!usuario) return { erro: "Não autorizado." as const };
  const { data } = await supabase.from("propostas").select("id").eq("id", propostaId).is("deleted_at", null).maybeSingle();
  if (!data) return { erro: "Proposta não encontrada ou sem acesso." as const };
  return { supabase, usuario };
}

export interface UploadAutorizado {
  error?: string;
  path?: string;
  token?: string;
}

/** Passo 1 do envio: autoriza e devolve um endereço de envio direto (o arquivo não passa pelo servidor). */
export async function iniciarUploadAnexo(propostaId: string, nomeArquivo: string, tamanho: number): Promise<UploadAutorizado> {
  const acesso = await podeAcessarProposta(propostaId);
  if ("erro" in acesso) return { error: acesso.erro };
  if (!nomeArquivo.trim()) return { error: "Arquivo sem nome." };
  if (tamanho <= 0) return { error: "Arquivo vazio." };
  if (tamanho > LIMITE_BYTES) return { error: "Arquivo muito grande (máximo de 50 MB)." };
  if (EXTENSOES_BLOQUEADAS.has(extensaoDe(nomeArquivo))) return { error: "Este tipo de arquivo não é permitido." };

  const path = `${propostaId}/${randomUUID()}-${nomeSeguro(nomeArquivo)}`;
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    const semBucket = /bucket not found/i.test(error?.message ?? "");
    return { error: semBucket ? AVISO_ESTRUTURA_CRM.replace("022", "024") : "Não foi possível preparar o envio: " + (error?.message ?? "") };
  }
  return { path: data.path, token: data.token };
}

export interface RegistroAnexo {
  propostaId: string;
  categoria: string;
  nome: string;
  mimeType: string;
  tamanho: number;
  path: string;
}

/** Passo 2 do envio: grava os dados do arquivo (nome, tipo, tamanho, quem enviou e quando). */
export async function registrarAnexo(dados: RegistroAnexo): Promise<{ error?: string; success?: boolean }> {
  const acesso = await podeAcessarProposta(dados.propostaId);
  if ("erro" in acesso) return { error: acesso.erro };
  if (!CATEGORIAS.includes(dados.categoria)) return { error: "Escolha o tipo do documento." };
  if (!dados.path.startsWith(`${dados.propostaId}/`)) return { error: "Arquivo inválido." };

  const { supabase, usuario } = acesso;
  const { error } = await supabase.from("proposta_anexos").insert({
    proposta_id: dados.propostaId,
    categoria: dados.categoria,
    nome: dados.nome.slice(0, 200),
    mime_type: dados.mimeType || null,
    tamanho_bytes: dados.tamanho,
    storage_path: dados.path,
    enviado_por: usuario.id,
  });
  if (error) {
    await createAdminClient().storage.from(BUCKET).remove([dados.path]);
    return { error: faltaEstruturaCrm(error) ? AVISO_ESTRUTURA_CRM.replace("022", "024") : error.message };
  }
  await registrarHistorico(supabase, {
    propostaId: dados.propostaId,
    tipo: "anexo",
    descricao: "Anexo adicionado",
    detalhes: { nome: dados.nome, categoria: dados.categoria },
  });
  revalidatePath(`/propostas/${dados.propostaId}`);
  return { success: true };
}

export async function excluirAnexo(anexoId: string): Promise<{ error?: string; success?: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const usuario = await usuarioAtual(supabase);
  if (!usuario) return { error: "Não autorizado." };

  const { data: anexo } = await supabase
    .from("proposta_anexos").select("id, proposta_id, nome, storage_path, enviado_por").eq("id", anexoId).maybeSingle();
  if (!anexo) return { error: "Anexo não encontrado." };
  if (anexo.enviado_por !== usuario.id && usuario.perfil !== "admin") {
    return { error: "Somente quem enviou o arquivo ou o administrador pode excluí-lo." };
  }

  const { error } = await supabase.from("proposta_anexos").delete().eq("id", anexoId);
  if (error) return { error: error.message };
  await createAdminClient().storage.from(BUCKET).remove([anexo.storage_path]);
  await registrarHistorico(supabase, {
    propostaId: anexo.proposta_id,
    tipo: "anexo",
    descricao: "Anexo excluído",
    detalhes: { nome: anexo.nome },
  });
  revalidatePath(`/propostas/${anexo.proposta_id}`);
  return { success: true };
}
