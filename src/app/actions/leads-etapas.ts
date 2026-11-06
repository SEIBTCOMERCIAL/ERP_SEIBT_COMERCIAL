"use server";
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
export async function salvarEtapaLead(form:FormData) {
 const p=z.object({nome:z.string().trim().min(1).max(80),ordem:z.coerce.number().int().min(0).max(999),cor:z.string().regex(/^#[0-9a-f]{6}$/i)}).safeParse(Object.fromEntries(form));
 if(!p.success)return {error:'Confira nome, ordem e cor.'};
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const sb=createClient() as any;
 const {data:{user}}=await sb.auth.getUser(); if(!user)return {error:'Sessão expirada.'};
 const {data:u}=await sb.from('usuarios').select('perfil').eq('id',user.id).single(); if(u?.perfil!=='admin')return {error:'Somente administrador pode configurar etapas.'};
 const {error}=await sb.from('etapas_lead').insert(p.data); if(error)return {error:error.message as string};
 revalidatePath('/leads');return {success:true};
}
