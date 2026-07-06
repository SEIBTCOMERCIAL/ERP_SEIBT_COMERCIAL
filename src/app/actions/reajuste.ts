"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ReajusteEquipState = { error?: string; success?: boolean };

export interface ComponenteReajuste {
  campo: "moinho" | "painel_220" | "painel_380";
  coluna: "preco_brl" | "preco_painel_220" | "preco_painel_380";
  preco_anterior: number;
  novo_preco: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("usuarios").select("perfil").eq("id", user.id).single();
  if (data?.perfil !== "admin") return null;
  return user;
}

export async function reajustarEquipamento(
  produtoId: string,
  componentes: ComponenteReajuste[],
  motivo: string,
  dataVigencia: string
): Promise<ReajusteEquipState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const user = await checkAdmin(supabase);
  if (!user) return { error: "Acesso restrito a administradores." };
  if (componentes.length === 0) return { error: "Nenhum componente selecionado." };

  const histRows = componentes.map((c) => ({
    produto_id: produtoId,
    componente: c.campo,
    preco_anterior_brl: c.preco_anterior,
    preco_novo_brl: c.novo_preco,
    percentual_reajuste: c.preco_anterior > 0
      ? Math.round(((c.novo_preco - c.preco_anterior) / c.preco_anterior) * 10000) / 100
      : null,
    motivo,
    data_reajuste: dataVigencia,
    reajustado_por: user.id,
  }));

  const { error: histErr } = await supabase.from("historico_precos").insert(histRows);
  if (histErr) return { error: "Erro ao registrar histórico: " + histErr.message };

  const update: Record<string, number> = {};
  for (const c of componentes) update[c.coluna] = c.novo_preco;

  const { error: updErr } = await supabase.from("produtos").update(update).eq("id", produtoId);
  if (updErr) return { error: "Erro ao atualizar preços: " + updErr.message };

  revalidatePath("/reajuste");
  revalidatePath("/produtos");
  return { success: true };
}

export async function reajustarLote(
  tipo: "linha" | "categoria",
  id: string,
  percentual: number,
  motivo: string,
  dataVigencia: string,
  componentesMaquina: Array<"moinho" | "painel_220" | "painel_380">
): Promise<ReajusteEquipState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const user = await checkAdmin(supabase);
  if (!user) return { error: "Acesso restrito a administradores." };

  const fator = 1 + percentual / 100;
  const histRows: Record<string, unknown>[] = [];

  if (tipo === "categoria") {
    const { data: pecas } = await supabase
      .from("produtos")
      .select("id, preco_brl")
      .eq("categoria_peca_id", id)
      .is("deleted_at", null)
      .eq("ativo", true);

    if (!pecas || pecas.length === 0) return { error: "Nenhuma peça encontrada." };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of pecas as any[]) {
      if (p.preco_brl == null) continue;
      const novoPreco = Math.round(p.preco_brl * fator * 100) / 100;
      histRows.push({
        produto_id: p.id,
        componente: null,
        preco_anterior_brl: p.preco_brl,
        preco_novo_brl: novoPreco,
        percentual_reajuste: percentual,
        motivo,
        data_reajuste: dataVigencia,
        reajustado_por: user.id,
      });
    }

    if (histRows.length > 0) {
      const { error: histErr } = await supabase.from("historico_precos").insert(histRows);
      if (histErr) return { error: "Erro ao registrar histórico: " + histErr.message };

      for (const row of histRows) {
        await supabase.from("produtos")
          .update({ preco_brl: row.preco_novo_brl })
          .eq("id", row.produto_id);
      }
    }
  } else {
    if (componentesMaquina.length === 0) return { error: "Selecione ao menos um componente." };

    const colMap: Record<string, string> = {
      moinho: "preco_brl",
      painel_220: "preco_painel_220",
      painel_380: "preco_painel_380",
    };

    const { data: equips } = await supabase
      .from("produtos")
      .select("id, preco_brl, preco_painel_220, preco_painel_380")
      .eq("categoria", "maquina")
      .eq("linha_id", id)
      .is("deleted_at", null);

    if (!equips || equips.length === 0) return { error: "Nenhum equipamento encontrado." };

    const updates: Record<string, Record<string, number>> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const eq of equips as any[]) {
      updates[eq.id] = {};
      for (const comp of componentesMaquina) {
        const col = colMap[comp];
        const precAtual = eq[col] as number | null;
        if (precAtual == null) continue;
        const novoPreco = Math.round(precAtual * fator * 100) / 100;
        histRows.push({
          produto_id: eq.id,
          componente: comp,
          preco_anterior_brl: precAtual,
          preco_novo_brl: novoPreco,
          percentual_reajuste: percentual,
          motivo,
          data_reajuste: dataVigencia,
          reajustado_por: user.id,
        });
        updates[eq.id][col] = novoPreco;
      }
    }

    if (histRows.length > 0) {
      const { error: histErr } = await supabase.from("historico_precos").insert(histRows);
      if (histErr) return { error: "Erro ao registrar histórico: " + histErr.message };

      for (const [prodId, upd] of Object.entries(updates)) {
        if (Object.keys(upd).length > 0) {
          await supabase.from("produtos").update(upd).eq("id", prodId);
        }
      }
    }
  }

  revalidatePath("/reajuste");
  revalidatePath("/produtos");
  return { success: true };
}
