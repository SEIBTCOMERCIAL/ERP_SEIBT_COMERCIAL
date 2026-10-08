"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { CheckCircle2, Copy, Hash, Loader2 } from "lucide-react";
import { gerarNumeroProposta, type GerarNumeroState } from "@/app/actions/propostas";
import { TIPOS_PROPOSTA } from "@/lib/propostas/crm";
import { OrganizacaoComercialCampos, ORGANIZACAO_PADRAO, validarOrganizacao, type OrganizacaoComercialValor } from "./OrganizacaoComercialCampos";

interface ClienteOpcao { id: string; razao_social: string; cnpj: string | null; cidade: string | null; estado: string | null }

const campo = "h-10 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-[#2074B9]";
const rotulo = "flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

const CANAIS = [
  ["whatsapp", "WhatsApp"], ["email", "E-mail"], ["feira", "Feira"], ["site", "Site"],
  ["indicacao", "Indicação"], ["telefone", "Telefone"], ["recorrencia", "Recorrência"], ["outro", "Outro"],
];

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#2C4F79] px-5 text-[14px] font-semibold text-white hover:bg-[#1E3A5F] disabled:opacity-60 sm:w-auto">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hash className="h-4 w-4" />}
      Gerar número
    </button>
  );
}

export function GerarNumeroForm({
  clientes, propostasPrincipais, representantes, clientePreSelecionado,
}: {
  clientes: ClienteOpcao[];
  propostasPrincipais: Array<{ id: string; numero_completo: string; cliente_id: string | null }>;
  representantes: Array<{ id: string; nome: string }>;
  clientePreSelecionado: string | null;
}) {
  const [estado, action] = useFormState<GerarNumeroState, FormData>(gerarNumeroProposta, {});
  const [busca, setBusca] = useState("");
  const [clienteId, setClienteId] = useState(clientePreSelecionado ?? "");
  const [organizacao, setOrganizacao] = useState<OrganizacaoComercialValor>(ORGANIZACAO_PADRAO);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [rodada, setRodada] = useState(0);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const digitos = busca.replace(/\D/g, "");
    const lista = termo
      ? clientes.filter((c) =>
          c.razao_social.toLocaleLowerCase("pt-BR").includes(termo) ||
          (digitos.length >= 3 && (c.cnpj ?? "").replace(/\D/g, "").includes(digitos)) ||
          (c.cidade ?? "").toLocaleLowerCase("pt-BR").includes(termo))
      : clientes;
    const selecionado = clientes.find((c) => c.id === clienteId);
    const cortada = lista.slice(0, 100);
    return selecionado && !cortada.some((c) => c.id === selecionado.id) ? [selecionado, ...cortada] : cortada;
  }, [busca, clientes, clienteId]);

  if (estado.sucesso) {
    const { id, numero } = estado.sucesso;
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center sm:p-8">
        <CheckCircle2 className="h-10 w-10 text-green-600" />
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Número gerado</p>
          <p className="mt-1 font-mono text-[34px] font-bold tracking-tight text-foreground">{numero}</p>
        </div>
        <p className="text-[13px] text-muted-foreground">O cartão já está no funil. Monte a proposta fora do ERP e depois anexe o arquivo na página da proposta.</p>
        <button
          type="button"
          onClick={() => { navigator.clipboard?.writeText(numero).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); }).catch(() => undefined); }}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[12px] font-medium"
        >
          <Copy className="h-3.5 w-3.5" />{copiado ? "Copiado" : "Copiar número"}
        </button>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href={`/propostas/${id}`} className="flex h-10 items-center justify-center rounded-lg bg-[#2C4F79] px-4 text-[13px] font-semibold text-white">Abrir proposta</Link>
          <Link href="/propostas" className="flex h-10 items-center justify-center rounded-lg border border-border px-4 text-[13px] font-medium">Ver no funil</Link>
          <a href="/propostas/gerar-numero" className="flex h-10 items-center justify-center rounded-lg border border-border px-4 text-[13px] font-medium">Gerar outro</a>
        </div>
      </div>
    );
  }

  return (
    <form
      key={rodada}
      action={(formData) => {
        const erro = !clienteId ? "Selecione o cliente." : validarOrganizacao(organizacao);
        if (erro) { setErroLocal(erro); return; }
        setErroLocal(null);
        action(formData);
      }}
      className="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-xl border border-border bg-card p-4 sm:p-6"
      onReset={() => setRodada((r) => r + 1)}
    >
      <input type="hidden" name="cliente_id" value={clienteId} />
      <input type="hidden" name="mercado" value={organizacao.mercado} />
      <input type="hidden" name="pais_destino" value={organizacao.pais_destino} />
      <input type="hidden" name="papel" value={organizacao.papel} />
      <input type="hidden" name="proposta_principal_id" value={organizacao.proposta_principal_id} />
      <input type="hidden" name="representante_id" value={organizacao.representante_id} />

      {(erroLocal || estado.message) && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">{erroLocal ?? estado.message}</p>
      )}

      <div className="flex flex-col gap-2">
        <span className={rotulo}>Cliente *</span>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, CNPJ ou cidade..." className={campo} />
        <select value={clienteId} onChange={(e) => { setClienteId(e.target.value); setOrganizacao((o) => ({ ...o, proposta_principal_id: "" })); }} size={Math.min(6, Math.max(2, filtrados.length + 1))} className="w-full rounded-lg border border-border bg-background p-1 text-[13px] outline-none focus:border-[#2074B9]">
          <option value="" disabled>{filtrados.length ? "Escolha o cliente" : "Nenhum cliente encontrado"}</option>
          {filtrados.map((c) => (
            <option key={c.id} value={c.id}>{c.razao_social}{c.cidade ? ` · ${c.cidade}${c.estado ? `/${c.estado}` : ""}` : ""}</option>
          ))}
        </select>
        {clientes.length > 100 && !busca && <p className="text-[11px] text-muted-foreground">Mostrando os primeiros 100 de {clientes.length} clientes — use a busca para achar os demais.</p>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className={rotulo}>Tipo da proposta *
          <select name="tipo" required defaultValue="" className={campo}>
            <option value="" disabled>Selecione...</option>
            {TIPOS_PROPOSTA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className={rotulo}>Moeda
          <select name="moeda" defaultValue="BRL" className={campo}>
            <option value="BRL">Real (BRL)</option>
            <option value="USD">Dólar (USD)</option>
          </select>
        </label>
        <label className={rotulo}>Origem do contato
          <select name="canal_origem" defaultValue="" className={campo}>
            <option value="">Não informada</option>
            {CANAIS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-border p-3 sm:p-4">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Mercado e classificação</p>
        <OrganizacaoComercialCampos valor={organizacao} onChange={setOrganizacao} clienteId={clienteId || null} propostasPrincipais={propostasPrincipais} representantes={representantes} />
      </div>

      <label className={rotulo}>Produto ou descrição inicial *
        <textarea name="descricao_livre" required rows={3} placeholder="Ex.: Moinho MGHS 1200 A2 com painel 380V" className="rounded-lg border border-border bg-background p-3 text-[13px] font-normal normal-case tracking-normal text-foreground outline-none focus:border-[#2074B9]" />
      </label>

      <div className="flex justify-end"><Enviar /></div>
    </form>
  );
}
