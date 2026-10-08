"use client";

import type { Mercado, Papel } from "@/lib/propostas/crm";

export interface OrganizacaoComercialValor {
  mercado: Mercado;
  pais_destino: string;
  papel: Papel;
  proposta_principal_id: string;
}

export const ORGANIZACAO_PADRAO: OrganizacaoComercialValor = {
  mercado: "nacional",
  pais_destino: "",
  papel: "principal",
  proposta_principal_id: "",
};

/** Erro de preenchimento, ou null quando está tudo certo. */
export function validarOrganizacao(v: OrganizacaoComercialValor): string | null {
  if (v.mercado === "exportacao" && !v.pais_destino.trim()) return "Informe o país de destino da exportação.";
  if (v.papel === "complementar" && !v.proposta_principal_id) return "Selecione a proposta principal deste negócio.";
  return null;
}

const rotulo = "text-[10px] font-semibold uppercase tracking-wide text-[#6B7B8D]";
const campo = "h-9 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none focus:border-[#2074B9]";

/**
 * Mercado (Nacional/Exportação + país) e classificação (Principal/Complementar + proposta
 * principal do mesmo cliente). Usado nas telas de proposta de Máquina e de Peças.
 */
export function OrganizacaoComercialCampos({
  valor,
  onChange,
  clienteId,
  propostasPrincipais,
}: {
  valor: OrganizacaoComercialValor;
  onChange: (v: OrganizacaoComercialValor) => void;
  clienteId: string | null;
  propostasPrincipais: Array<{ id: string; numero_completo: string; cliente_id: string | null }>;
}) {
  const doCliente = propostasPrincipais.filter((p) => clienteId && p.cliente_id === clienteId);
  const set = (parcial: Partial<OrganizacaoComercialValor>) => onChange({ ...valor, ...parcial });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1">
        <span className={rotulo}>Mercado *</span>
        <select value={valor.mercado} onChange={(e) => set({ mercado: e.target.value as Mercado })} className={campo}>
          <option value="nacional">Nacional</option>
          <option value="exportacao">Exportação</option>
        </select>
      </label>
      {valor.mercado === "exportacao" ? (
        <label className="flex flex-col gap-1">
          <span className={rotulo}>País de destino *</span>
          <input value={valor.pais_destino} onChange={(e) => set({ pais_destino: e.target.value })} placeholder="Ex.: Argentina" className={campo} />
        </label>
      ) : <div className="max-sm:hidden" />}
      <label className="flex flex-col gap-1">
        <span className={rotulo}>Classificação *</span>
        <select
          value={valor.papel}
          onChange={(e) => set({ papel: e.target.value as Papel, proposta_principal_id: "" })}
          className={campo}
        >
          <option value="principal">Principal</option>
          <option value="complementar">Complementar (alternativa de outra proposta)</option>
        </select>
      </label>
      {valor.papel === "complementar" && (
        <label className="flex flex-col gap-1">
          <span className={rotulo}>Proposta principal deste negócio *</span>
          <select
            value={valor.proposta_principal_id}
            onChange={(e) => set({ proposta_principal_id: e.target.value })}
            className={campo}
          >
            <option value="">{doCliente.length ? "Selecione..." : "Nenhuma proposta aberta deste cliente"}</option>
            {doCliente.map((p) => <option key={p.id} value={p.id}>{p.numero_completo}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
