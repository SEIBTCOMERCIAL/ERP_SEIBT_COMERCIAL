"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { hojeSaoPaulo, parseMoeda } from "@/lib/reajuste/regras";
import { revalidarPrecos } from "@/lib/revalidar";
import { carregarProdutosParaPlano, exigirAdmin, gravarReajuste } from "@/lib/reajuste/servidor";

const criarProdutoSchema = z.object({
  codigo:    z.string().min(1, "Código obrigatório"),
  descricao: z.string().min(1, "Descrição obrigatória"),
  categoria: z.enum(["maquina","navalha","peneira","rolamento","parafuso","rotor","inserto","periferico","linha","outro"]),
  linha:     z.string().optional().nullable(),
  preco_brl: z.coerce.number().min(0).optional().nullable(),
  ipi_pct:   z.coerce.number().min(0).default(0),
  ncm:       z.string().optional().nullable(),
});

export type CriarProdutoState = {
  errors?: Partial<Record<string, string[]>>;
  message?: string;
  success?: boolean;
};

export async function criarProduto(
  _prev: CriarProdutoState,
  formData: FormData
): Promise<CriarProdutoState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: "Não autorizado" };

  const raw = {
    codigo:    formData.get("codigo"),
    descricao: formData.get("descricao"),
    categoria: formData.get("categoria"),
    linha:     (formData.get("linha") as string) || null,
    preco_brl: formData.get("preco_brl") || null,
    ipi_pct:   formData.get("ipi_pct") || 0,
    ncm:       (formData.get("ncm") as string) || null,
  };

  const parsed = criarProdutoSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  const { error } = await supabase.from("produtos").insert({
    codigo:           d.codigo,
    descricao:        d.descricao,
    categoria:        d.categoria,
    linha:            d.linha || null,
    preco_brl:        d.preco_brl ?? null,
    ipi_pct:          d.ipi_pct,
    ncm:              d.ncm || null,
    ativo:            true,
    produto_especial: false,
    tem_variantes:    false,
  });

  if (error) return { message: "Erro ao criar produto: " + error.message };

  revalidatePath("/produtos");
  revalidatePath("/precos");
  revalidatePath("/propostas/pecas/nova");

  return { success: true };
}

const reajusteSchema = z.object({
  produto_id:    z.string().uuid(),
  variante_id:   z.string().uuid().optional().nullable(),
  novo_preco:    z.string().min(1, "Informe o novo preço"),
  motivo:        z.enum(["Reajuste anual", "Variação cambial", "Custo matéria-prima", "Outro"]),
  data_vigencia: z.string().optional().nullable(),
});

export type ReajusteFormState = {
  errors?: Partial<Record<string, string[]>>;
  message?: string;
  success?: boolean;
};

/**
 * Reajuste de um produto (tela de Preços). Usa o mesmo núcleo da tela de Reajuste: administrador,
 * preço atual lido do banco, preço e histórico gravados juntos, tudo ou nada.
 * O reajuste vale imediatamente: não aceita data futura nem retroativa.
 */
export async function reajustarPreco(
  _prev: ReajusteFormState,
  formData: FormData
): Promise<ReajusteFormState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  if (!(await exigirAdmin(supabase))) return { message: "Acesso restrito a administradores." };

  const parsed = reajusteSchema.safeParse({
    produto_id:    formData.get("produto_id"),
    variante_id:   formData.get("variante_id") || null,
    novo_preco:    formData.get("novo_preco"),
    motivo:        formData.get("motivo"),
    data_vigencia: formData.get("data_vigencia") || null,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;

  if (d.variante_id) return { message: "Reajuste de variantes não é suportado por esta tela." };
  if (d.data_vigencia && d.data_vigencia !== hojeSaoPaulo()) {
    return { errors: { data_vigencia: ["O reajuste é aplicado na hora. Use a data de hoje."] } };
  }
  const valor = parseMoeda(d.novo_preco);
  if (valor.erro !== undefined) return { errors: { novo_preco: [valor.erro] } };

  const produtos = await carregarProdutosParaPlano(supabase, [d.produto_id]);
  const produto = produtos.get(d.produto_id);
  if (!produto || produto.excluido) return { message: "Produto não encontrado." };
  const componente = produto.tipo === "maquina" ? "moinho" : "peca";
  const atual = produto.preco_brl;
  if (atual === null) return { message: "Este produto não tem preço cadastrado." };

  const r = await gravarReajuste(supabase, {
    chave: crypto.randomUUID(),
    motivo: d.motivo,
    entradas: [{ produto_id: d.produto_id, componente, esperado: atual, novo: valor.valor }],
  });
  if (!r.ok) return { message: r.erro };

  revalidarPrecos();
  return { success: true };
}

export async function atualizarTaxaCambio(
  _prev: ReajusteFormState,
  formData: FormData
): Promise<ReajusteFormState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: "Não autorizado" };

  const taxa = parseFloat(formData.get("taxa") as string);
  if (isNaN(taxa) || taxa <= 0) return { message: "Taxa inválida" };

  const { error } = await supabase
    .from("taxas_cambio")
    .insert({
      moeda: "USD",
      taxa,
      vigente_desde: new Date().toISOString().split("T")[0],
      atualizado_por: user.id,
    });

  if (error) return { message: "Erro ao atualizar taxa: " + error.message };

  revalidatePath("/produtos");
  revalidatePath("/precos");
  revalidatePath("/propostas/pecas/nova");

  return { success: true };
}

export async function registrarMaquina(
  _prev: { success?: boolean; maquinaId?: string; error?: string },
  formData: FormData
): Promise<{ success?: boolean; maquinaId?: string; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado" };

  const cliente_id   = formData.get("cliente_id") as string;
  const modelo       = formData.get("modelo") as string;
  const numero_serie = (formData.get("numero_serie") as string) || null;
  const ano_str      = formData.get("ano_fabricacao") as string;
  const ano_fabricacao = ano_str ? parseInt(ano_str) : null;
  const plaqueta     = formData.get("plaqueta") as File | null;

  let plaqueta_foto_url: string | null = null;

  if (plaqueta && plaqueta.size > 0) {
    const ext = plaqueta.name.split(".").pop() ?? "jpg";
    const path = `${cliente_id}/${Date.now()}.${ext}`;
    const buffer = await plaqueta.arrayBuffer();

    const { error: uploadErr } = await supabase.storage
      .from("plaquetas")
      .upload(path, buffer, { contentType: plaqueta.type, upsert: false });

    if (!uploadErr) {
      const { data: urlData } = supabase.storage.from("plaquetas").getPublicUrl(path);
      plaqueta_foto_url = urlData?.publicUrl ?? null;
    }
  }

  const { data: maquina, error } = await supabase
    .from("maquinas_cliente")
    .insert({
      cliente_id,
      modelo: modelo || null,
      numero_serie,
      ano_fabricacao,
      plaqueta_foto_url,
      registrado_por: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: "Erro ao registrar máquina: " + error.message };

  revalidatePath(`/clientes/${cliente_id}`);

  return { success: true, maquinaId: maquina.id };
}
