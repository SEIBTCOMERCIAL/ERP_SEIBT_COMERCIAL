"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { registrarAuditoria } from "./auditoria";

export interface UsuarioFormState {
  error?: string;
  success?: boolean;
  senhaTemporaria?: string;
}

export async function criarUsuario(
  _prev: UsuarioFormState,
  formData: FormData
): Promise<UsuarioFormState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const nome = (formData.get("nome") as string)?.trim();
  const perfil = formData.get("perfil") as string;
  const podeConfigurar = formData.get("pode_configurar") === "true";

  if (!email || !nome || !perfil) return { error: "Email, nome e perfil são obrigatórios." };

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const senha = "Seibt@2026!";

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });

  if (authError) return { error: authError.message };

  const { error: dbError } = await supabase.from("usuarios").insert({
    id: authData.user.id,
    nome,
    email,
    perfil,
    pode_configurar: podeConfigurar,
    ativo: true,
  });

  if (dbError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return { error: dbError.message };
  }

  await registrarAuditoria({
    acao: "criar_usuario",
    entidade: "usuarios",
    entidade_id: authData.user.id,
    entidade_referencia: `${nome} <${email}>`,
  });

  revalidatePath("/usuarios");
  return { success: true, senhaTemporaria: senha };
}

export async function atualizarUsuario(
  _prev: UsuarioFormState,
  formData: FormData
): Promise<UsuarioFormState> {
  const id = formData.get("id") as string;
  const nome = (formData.get("nome") as string)?.trim();
  const perfil = formData.get("perfil") as string;
  const podeConfigurar = formData.get("pode_configurar") === "true";
  const iniciais = (formData.get("iniciais_pdf") as string)?.trim() || null;

  if (!id || !nome || !perfil) return { error: "Dados inválidos." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { error } = await supabase
    .from("usuarios")
    .update({ nome, perfil, pode_configurar: podeConfigurar, iniciais_pdf: iniciais })
    .eq("id", id);

  if (error) return { error: error.message };

  await registrarAuditoria({
    acao: "editar_usuario",
    entidade: "usuarios",
    entidade_id: id,
    entidade_referencia: nome,
  });

  revalidatePath("/usuarios");
  return { success: true };
}

export async function toggleAtivoUsuario(id: string, ativo: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { error } = await supabase
    .from("usuarios")
    .update({ ativo })
    .eq("id", id);

  if (error) return { error: error.message };

  await registrarAuditoria({
    acao: ativo ? "ativar_usuario" : "desativar_usuario",
    entidade: "usuarios",
    entidade_id: id,
  });

  revalidatePath("/usuarios");
  return { success: true };
}

export async function redefinirSenhaUsuario(id: string, email: string) {
  const admin = createAdminClient();

  const { error } = await admin.auth.admin.updateUserById(id, {
    password: "Seibt@2026!",
  });

  if (error) return { error: error.message };

  await registrarAuditoria({
    acao: "redefinir_senha",
    entidade: "usuarios",
    entidade_id: id,
    entidade_referencia: email,
  });

  return { success: true, novaSenha: "Seibt@2026!" };
}
