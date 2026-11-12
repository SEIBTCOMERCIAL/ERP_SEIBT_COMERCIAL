"use server";

import { revalidarPrecos } from "@/lib/revalidar";
import { createClient } from "@/lib/supabase/server";
import { ehComponente, type ComponenteId } from "@/lib/reajuste/regras";
import {
  carregarHistorico, ehUuid, exigirAdmin, gerarPrevia, gravarReajuste, listarItens,
} from "@/lib/reajuste/servidor";
import { definirIpiNavalhas, listarKits, listarPeneiras } from "@/lib/reajuste/kits-servidor";
import type {
  PedidoConfirmacao, PedidoIpi, PedidoKits, PedidoLista, PedidoPrevia, RespostaConfirmacao, RespostaHistorico, RespostaIpi, RespostaKits,
  RespostaLista, RespostaPeneiras, RespostaPrevia,
} from "@/lib/reajuste/tipos";

const NAO_ADMIN = "Acesso restrito a administradores.";
const FALHA = "Não foi possível concluir. Tente novamente.";

export async function listarItensReajuste(pedido: PedidoLista): Promise<RespostaLista> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  if (!(await exigirAdmin(supabase))) return { ok: false, erro: NAO_ADMIN };
  if (pedido.aba !== "maquinas" && pedido.aba !== "pecas") return { ok: false, erro: "Aba inválida." };
  try {
    return await listarItens(supabase, pedido);
  } catch {
    return { ok: false, erro: "Não foi possível carregar os itens. Tente novamente." };
  }
}

export async function preverReajuste(pedido: PedidoPrevia): Promise<RespostaPrevia> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  if (!(await exigirAdmin(supabase))) return { ok: false, erro: NAO_ADMIN };
  try {
    return await gerarPrevia(supabase, pedido);
  } catch {
    return { ok: false, erro: FALHA };
  }
}

export async function confirmarReajuste(pedido: PedidoConfirmacao): Promise<RespostaConfirmacao> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  if (!(await exigirAdmin(supabase))) return { ok: false, tipo: "permissao", erro: NAO_ADMIN };
  try {
    const r = await gravarReajuste(supabase, pedido);
    // Só depois de gravado com sucesso: catálogo, produtos e propostas novas passam a ler os novos preços vigentes.
    // Propostas já emitidas guardam o preço da época (itens_proposta) e não são afetadas.
    if (r.ok) revalidarPrecos();
    return r;
  } catch {
    return { ok: false, tipo: "banco", erro: "Não foi possível gravar o reajuste. Nada foi alterado. Tente novamente." };
  }
}

export async function carregarHistoricoReajuste(produtoId: string, componente: ComponenteId, pagina: number): Promise<RespostaHistorico> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  if (!(await exigirAdmin(supabase))) return { ok: false, erro: NAO_ADMIN };
  if (!ehUuid(produtoId) || !ehComponente(componente)) return { ok: false, erro: "Item inválido." };
  try {
    return await carregarHistorico(supabase, produtoId, componente, pagina);
  } catch {
    return { ok: false, erro: "Não foi possível carregar o histórico." };
  }
}

export async function listarKitsReajuste(pedido: PedidoKits): Promise<RespostaKits> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  if (!(await exigirAdmin(supabase))) return { ok: false, erro: NAO_ADMIN };
  try {
    return await listarKits(supabase, { busca: String(pedido.busca ?? "").slice(0, 80), situacao: pedido.situacao, pagina: Number(pedido.pagina) || 1 });
  } catch {
    return { ok: false, erro: "Não foi possível carregar os kits. Tente novamente." };
  }
}

export async function listarPeneirasReajuste(pedido: { busca: string; situacao: string; pagina: number }): Promise<RespostaPeneiras> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  if (!(await exigirAdmin(supabase))) return { ok: false, erro: NAO_ADMIN };
  try {
    return await listarPeneiras(supabase, { busca: String(pedido.busca ?? "").slice(0, 80), situacao: pedido.situacao, pagina: Number(pedido.pagina) || 1 });
  } catch {
    return { ok: false, erro: "Não foi possível carregar as peneiras. Tente novamente." };
  }
}

/** Altera só o IPI (não é reajuste: o histórico de preços e a data do último reajuste não mudam). */
export async function definirIpiReajuste(pedido: PedidoIpi): Promise<RespostaIpi> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  if (!(await exigirAdmin(supabase))) return { ok: false, tipo: "permissao", erro: NAO_ADMIN };
  try {
    const r = await definirIpiNavalhas(supabase, pedido);
    // Catálogo, Produtos e propostas novas passam a ler o IPI vigente; propostas já emitidas guardam o IPI da época.
    if (r.ok) revalidarPrecos();
    return r;
  } catch {
    return { ok: false, tipo: "banco", erro: "Não foi possível gravar o IPI. Nada foi alterado. Tente novamente." };
  }
}
