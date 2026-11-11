"use server";

import { revalidarPrecos } from "@/lib/revalidar";
import { createClient } from "@/lib/supabase/server";
import { ehComponente, type ComponenteId } from "@/lib/reajuste/regras";
import {
  carregarHistorico, ehUuid, exigirAdmin, gerarPrevia, gravarReajuste, listarItens,
} from "@/lib/reajuste/servidor";
import type {
  PedidoConfirmacao, PedidoLista, PedidoPrevia, RespostaConfirmacao, RespostaHistorico, RespostaLista, RespostaPrevia,
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
