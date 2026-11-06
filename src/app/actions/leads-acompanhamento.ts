"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
const schema = z.object({
 empresa_nome:z.string().trim().min(2), contato_nome:z.string().trim().min(2), contato_telefone:z.string(), contato_email:z.string().email().or(z.literal("")), cidade:z.string(), estado:z.string(),
 canal_entrada:z.enum(["site","whatsapp","email","feira","indicacao","telefone","recorrencia","outro"]), tipo_interesse:z.enum(["maquina","pecas","sistema","servico","mista","exportacao"]), mercado:z.enum(["nacional","exportacao"]), status:z.enum(["novo","encaminhado","em_qualificacao","qualificado","descartado"]), representante_id:z.string().uuid().nullable(), observacoes:z.string().max(10000), motivo_descarte:z.string(), encaminhado_em:z.string().datetime().nullable(), proxima_acao:z.string(), proxima_acao_em:z.string().datetime().nullable()
});
export async function salvarAcompanhamento(id:string|null, dados:unknown) {
 const p=schema.safeParse(dados); if(!p.success) return {error:"Confira empresa, contato, e-mail e datas."}; const d=p.data;
 if(d.status==='encaminhado' && (!d.representante_id || !d.encaminhado_em)) return {error:"Informe representante e data de encaminhamento."};
 if(d.status==='descartado' && !d.motivo_descarte.trim()) return {error:"Informe o motivo do descarte."};
 if(d.status!=='descartado' && (!d.proxima_acao.trim() || !d.proxima_acao_em)) return {error:"Agende a próxima ação."};
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const sb=createClient() as any;
 const {data:{user}}=await sb.auth.getUser(); if(!user) return {error:"Sessão expirada."};
 const {data:perfil}=await sb.from('usuarios').select('perfil').eq('id',user.id).single();
 if(!perfil || !['admin','vendedor_interno'].includes(perfil.perfil)) return {error:"Sem permissão para editar leads."};
 if(id) { const {data:a}=await sb.from('leads').select('status,responsavel_id').eq('id',id).single(); if(!a || a.status==='convertido' || (perfil.perfil!=='admin' && a.responsavel_id!==user.id)) return {error:"Lead indisponível ou convertido."}; }
 const q=id?sb.from('leads').update(d).eq('id',id):sb.from('leads').insert({...d,responsavel_id:user.id});
 const {error}=await q.select('id').single(); if(error) return {error:error.message as string}; revalidatePath('/leads'); return {success:true};
}
export async function converterLead(id:string, cliente:string|null) {
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const sb=createClient() as any;
 const {data,error}=await sb.rpc('converter_lead',{p_lead:id,p_cliente:cliente}); if(error) return {error:error.message as string}; revalidatePath('/leads'); revalidatePath('/clientes'); return {clienteId:data as string};
}
