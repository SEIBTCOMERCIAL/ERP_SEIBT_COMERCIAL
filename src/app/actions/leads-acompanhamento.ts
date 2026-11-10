"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { statusDaEtapa, tipoDaEtapa } from "@/lib/leads/etapas";

const CANAIS = ["site", "whatsapp", "email", "feira", "indicacao", "telefone", "recorrencia", "outro"] as const;
const INTERESSES = ["maquina", "pecas", "sistema", "servico", "mista", "exportacao"] as const;

const cadastro = z.object({
  etapa_id: z.string().uuid(),
  empresa_nome: z.string().trim().min(2),
  contato_nome: z.string().trim().min(2),
  contato_telefone: z.string(),
  contato_email: z.string().email().or(z.literal("")),
  cidade: z.string(),
  estado: z.string(),
  canal_entrada: z.enum(CANAIS),
  tipo_interesse: z.enum(INTERESSES),
  mercado: z.enum(["nacional", "exportacao"]),
  representante_id: z.string().uuid().nullable(),
  observacoes: z.string().max(10000),
  motivo_descarte: z.string(),
  encaminhado_em: z.string().datetime().nullable(),
  proxima_acao: z.string(),
  proxima_acao_em: z.string().datetime().nullable(),
});

type Resultado = { error?: string; success?: boolean };

async function sessao() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createClient() as any;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { sb, user: null, perfil: null as string | null };
  const { data: u } = await sb.from("usuarios").select("perfil").eq("id", user.id).single();
  return { sb, user, perfil: (u?.perfil ?? null) as string | null };
}

const podeEditar = (perfil: string | null) => perfil === "admin" || perfil === "vendedor_interno";

export async function salvarAcompanhamento(id: string | null, dados: unknown): Promise<Resultado> {
  const p = cadastro.safeParse(dados);
  if (!p.success) return { error: "Confira empresa, contato, e-mail e datas." };
  const d = p.data;
  const { sb, user, perfil } = await sessao();
  if (!user) return { error: "Sessão expirada." };
  if (!podeEditar(perfil)) return { error: "Sem permissão para editar leads." };

  const { data: etapa } = await sb.from("etapas_lead").select("*").eq("id", d.etapa_id).single();
  if (!etapa) return { error: "Etapa não encontrada." };
  if (tipoDaEtapa(etapa) === "convertido") return { error: "Para converter, use a conversão em cliente." };

  let atual = "novo";
  if (id) {
    const { data: a } = await sb.from("leads").select("status,responsavel_id").eq("id", id).single();
    if (!a || a.status === "convertido" || (perfil !== "admin" && a.responsavel_id !== user.id)) {
      return { error: "Lead indisponível ou convertido." };
    }
    atual = a.status;
  }
  const status = statusDaEtapa(etapa, atual);

  if (status === "encaminhado" && (!d.representante_id || !d.encaminhado_em)) return { error: "Informe representante e data de encaminhamento." };
  if (status === "descartado" && !d.motivo_descarte.trim()) return { error: "Informe o motivo do descarte." };
  if (status !== "descartado" && (!d.proxima_acao.trim() || !d.proxima_acao_em)) return { error: "Agende a próxima ação." };

  const registro = { ...d, status };
  const q = id ? sb.from("leads").update(registro).eq("id", id) : sb.from("leads").insert({ ...registro, responsavel_id: user.id });
  const { error } = await q.select("id").single();
  if (error) return { error: error.message as string };
  revalidatePath("/leads");
  return { success: true };
}

export async function converterLead(id: string, cliente: string | null): Promise<{ error?: string; clienteId?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createClient() as any;
  const { data, error } = await sb.rpc("converter_lead", { p_lead: id, p_cliente: cliente });
  if (error) return { error: error.message as string };
  revalidatePath("/leads");
  revalidatePath("/clientes");
  return { clienteId: data as string };
}

/** Registra um novo acompanhamento (texto, próxima ação e prazo) sem mexer no cadastro nem na etapa. */
export async function acompanharLead(id: string, dados: unknown): Promise<Resultado> {
  const p = z.object({
    observacoes: z.string().trim().min(1).max(10000).optional(),
    proxima_acao: z.string().trim().min(1).optional(),
    proxima_acao_em: z.string().datetime().optional(),
  }).strict().safeParse(dados);
  if (!z.string().uuid().safeParse(id).success || !p.success || !Object.keys(p.data).length) return { error: "Confira os dados do acompanhamento." };
  const { sb, user, perfil } = await sessao();
  if (!user) return { error: "Sessão expirada." };
  const { data: l } = await sb.from("leads").select("status,responsavel_id").eq("id", id).is("deleted_at", null).single();
  if (!l || !podeEditar(perfil) || (perfil !== "admin" && l.responsavel_id !== user.id)) return { error: "Sem permissão para acompanhar este lead." };
  if (l.status === "convertido") return { error: "Este lead já foi convertido. Continue no cliente." };
  const { error } = await sb.from("leads").update(p.data).eq("id", id).select("id").single();
  if (error) return { error: error.message as string };
  revalidatePath("/leads");
  return { success: true };
}

const extras = z.object({
  motivo_descarte: z.string().trim().optional(),
  representante_id: z.string().uuid().optional(),
  encaminhado_em: z.string().datetime().optional(),
  proxima_acao: z.string().trim().optional(),
  proxima_acao_em: z.string().datetime().optional(),
}).strict();

/** Move o lead para outra etapa; o status acompanha o tipo da etapa e os dados obrigatórios são exigidos. */
export async function moverLead(id: string, etapaId: string, dados: unknown = {}): Promise<Resultado> {
  const e = extras.safeParse(dados);
  if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(etapaId).success || !e.success) return { error: "Confira os dados da movimentação." };
  const { sb, user, perfil } = await sessao();
  if (!user) return { error: "Sessão expirada." };
  const { data: l } = await sb.from("leads").select("*").eq("id", id).is("deleted_at", null).single();
  if (!l || !podeEditar(perfil) || (perfil !== "admin" && l.responsavel_id !== user.id)) return { error: "Sem permissão para mover este lead." };
  if (l.status === "convertido") return { error: "Este lead já foi convertido. Continue no cliente." };
  const { data: etapa } = await sb.from("etapas_lead").select("*").eq("id", etapaId).single();
  if (!etapa) return { error: "Etapa não encontrada." };
  if (tipoDaEtapa(etapa) === "convertido") return { error: "Para converter, use a conversão em cliente." };

  const status = statusDaEtapa(etapa, l.status);
  const novo = { ...e.data };
  const rep = novo.representante_id ?? l.representante_id;
  const encaminhadoEm = novo.encaminhado_em ?? l.encaminhado_em;
  const acao = novo.proxima_acao || l.proxima_acao;
  const prazo = novo.proxima_acao_em ?? l.proxima_acao_em;
  const motivo = novo.motivo_descarte || l.motivo_descarte;

  if (status === "encaminhado" && (!rep || !encaminhadoEm)) return { error: "Informe representante e data de encaminhamento." };
  if (status === "descartado" && !motivo?.trim()) return { error: "Informe o motivo do descarte." };
  if (status !== "descartado" && (!acao?.trim() || !prazo)) return { error: "Agende a próxima ação antes de mover o lead." };

  const { error } = await sb.from("leads").update({ ...novo, etapa_id: etapaId, status }).eq("id", id).select("id").single();
  if (error) return { error: error.message as string };
  revalidatePath("/leads");
  return { success: true };
}
