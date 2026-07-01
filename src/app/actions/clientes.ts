"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const clienteSchema = z.object({
  razao_social:     z.string().min(2, "Razão social obrigatória"),
  nome_fantasia:    z.string().optional(),
  cnpj:             z.string().optional(),
  segmento:         z.enum(["transformador", "reciclador", "industria", "outro"]),
  porte:            z.enum(["pequeno", "medio", "grande"]),
  status:           z.enum(["prospect", "ativo", "inativo"]),
  pais:             z.string().default("Brasil"),
  estado:           z.string().optional(),
  cidade:           z.string().optional(),
  endereco:         z.string().optional(),
  responsavel_id:   z.string().uuid().optional().nullable(),
  representante_id: z.string().uuid().optional().nullable(),
  // Contato principal
  contato_nome:     z.string().optional(),
  contato_cargo:    z.string().optional(),
  contato_tratamento: z.enum(["sr", "sra", "dr", "dra"]).optional().nullable(),
  contato_telefone: z.string().optional(),
  contato_email:    z.string().email().optional().or(z.literal("")),
  contato_whatsapp: z.string().optional(),
});

export type ClienteFormData = z.infer<typeof clienteSchema>;
export type ClienteFormState = {
  errors?: Partial<Record<keyof ClienteFormData, string[]>>;
  message?: string;
};

export async function criarCliente(
  _prevState: ClienteFormState,
  formData: FormData
): Promise<ClienteFormState> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: "Não autorizado" };

  const raw = {
    razao_social:       formData.get("razao_social"),
    nome_fantasia:      formData.get("nome_fantasia") || undefined,
    cnpj:               formData.get("cnpj") || undefined,
    segmento:           formData.get("segmento"),
    porte:              formData.get("porte"),
    status:             formData.get("status"),
    pais:               formData.get("pais") || "Brasil",
    estado:             formData.get("estado") || undefined,
    cidade:             formData.get("cidade") || undefined,
    endereco:           formData.get("endereco") || undefined,
    responsavel_id:     formData.get("responsavel_id") || null,
    representante_id:   formData.get("representante_id") || null,
    contato_nome:       formData.get("contato_nome") || undefined,
    contato_cargo:      formData.get("contato_cargo") || undefined,
    contato_tratamento: formData.get("contato_tratamento") || null,
    contato_telefone:   formData.get("contato_telefone") || undefined,
    contato_email:      formData.get("contato_email") || undefined,
    contato_whatsapp:   formData.get("contato_whatsapp") || undefined,
  };

  const parsed = clienteSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const d = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: cliente, error } = await sb
    .from("clientes")
    .insert({
      razao_social:     d.razao_social,
      nome_fantasia:    d.nome_fantasia || null,
      cnpj:             d.cnpj || null,
      segmento:         d.segmento,
      porte:            d.porte,
      status:           d.status,
      pais:             d.pais,
      estado:           d.estado || null,
      cidade:           d.cidade || null,
      endereco:         d.endereco || null,
      responsavel_id:   d.responsavel_id || null,
      representante_id: d.representante_id || null,
      criado_por:       user.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { message: "Já existe um cliente com este CNPJ." };
    }
    return { message: "Erro ao salvar cliente. Tente novamente." };
  }

  // Cria contato principal se informado
  if (d.contato_nome) {
    await sb.from("contatos_cliente").insert({
      cliente_id:  cliente.id,
      nome:        d.contato_nome,
      cargo:       d.contato_cargo || null,
      tratamento:  d.contato_tratamento || null,
      telefone:    d.contato_telefone || null,
      email:       d.contato_email || null,
      whatsapp:    d.contato_whatsapp || null,
      principal:   true,
    });
  }

  revalidatePath("/clientes");
  redirect(`/clientes/${cliente.id}`);
}

export async function atualizarStatusCliente(
  clienteId: string,
  novoStatus: "prospect" | "ativo" | "inativo"
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { error } = await supabase
    .from("clientes")
    .update({ status: novoStatus })
    .eq("id", clienteId);

  if (error) throw new Error(error.message);
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/clientes");
}

export async function excluirCliente(clienteId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { error } = await supabase
    .from("clientes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", clienteId);

  if (error) throw new Error(error.message);
  revalidatePath("/clientes");
  redirect("/clientes");
}
