"use client";

import { useState, useTransition } from "react";
import { criarEquipamento } from "@/app/actions/produtos-admin";
import { rotulosPainel } from "@/lib/produtos/painel";
import { Aviso, areaCls, botaoPrimario, botaoSecundario, Campo, campoCls, Modal } from "./base";
import { CampoMoeda, CampoTexto } from "./campos";

/** Cadastro de equipamento novo. Os preços informados aqui são o preço inicial (ficam no histórico); depois só mudam pelo Reajuste. */
export function FormEquipamento({ linha, camposFicha, aoFechar, aoCriado }: {
  linha: { id: string; nome: string }; camposFicha: string[]; aoFechar: () => void; aoCriado: (id: string) => void;
}) {
  const rot = rotulosPainel(linha.nome);
  const [d, setD] = useState({ codigo: "", ncm: "", descricao: "", potencia: "", descPainel: "", preco: "", p220: "", p380: "", consulta: false });
  const [specs, setSpecs] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const mudou = Object.values(d).some((v) => v !== "" && v !== false) || Object.values(specs).some(Boolean);
  const set = (k: keyof typeof d) => (v: string) => setD((a) => ({ ...a, [k]: v }));

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      try {
        const r = await criarEquipamento(linha.id, {
          codigo: d.codigo, descricao: d.descricao, descricaoPainel: d.descPainel, potenciaMotor: d.potencia, ncm: d.ncm,
          precoBrl: d.preco, preco220: d.p220, preco380: d.p380, solicitarEngenharia: d.consulta,
        }, Object.fromEntries(Object.entries(specs).filter(([, v]) => v.trim() !== "")));
        if (!r.ok) setErro(r.erro); else aoCriado(r.id);
      } catch { setErro("Não foi possível salvar. Seus dados foram mantidos; tente novamente."); }
    });
  }

  return (
    <Modal titulo={`Novo equipamento — ${linha.nome}`} aoFechar={() => { if (!mudou || confirm("Descartar o cadastro em andamento?")) aoFechar(); }} bloqueado={pendente} largura="max-w-2xl">
      <form onSubmit={enviar} className="flex flex-col gap-4 p-5">
        {erro && <Aviso>{erro}</Aviso>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Código / nome (título do card)" obrigatorio><CampoTexto valor={d.codigo} aoMudar={set("codigo")} required maxLength={120} placeholder="ex.: MGHS 500 A2 30 CV" /></Campo>
          <Campo rotulo="NCM"><CampoTexto valor={d.ncm} aoMudar={set("ncm")} maxLength={20} placeholder="ex.: 84779000" /></Campo>
        </div>
        <Campo rotulo="Descrição (texto usado no orçamento)" obrigatorio>
          <textarea value={d.descricao} onChange={(e) => set("descricao")(e.target.value)} required rows={3} className={areaCls} />
        </Campo>
        <Campo rotulo="Potência do motor"><CampoTexto valor={d.potencia} aoMudar={set("potencia")} maxLength={60} placeholder="ex.: 15 cv" /></Campo>

        <fieldset className="rounded-lg border border-border p-3">
          <legend className="px-1 text-xs font-semibold text-muted-foreground">Preço inicial (R$)</legend>
          <p className="mb-2 text-xs text-muted-foreground">Fica registrado no histórico como preço inicial. Depois de cadastrado, só muda pelo Reajuste de preços. Deixe em branco o que não existe.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Máquina"><CampoMoeda valor={d.preco} aoMudar={set("preco")} rotulo="Preço da máquina" /></Campo>
            <Campo rotulo={rot.p220}><CampoMoeda valor={d.p220} aoMudar={set("p220")} rotulo={`Preço ${rot.p220}`} /></Campo>
            <Campo rotulo={rot.p380}><CampoMoeda valor={d.p380} aoMudar={set("p380")} rotulo={`Preço ${rot.p380}`} /></Campo>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" className="h-4 w-4" checked={d.consulta} onChange={(e) => setD((a) => ({ ...a, consulta: e.target.checked }))} />
            Preço sob consulta (solicitar com a Engenharia)
          </label>
        </fieldset>

        <Campo rotulo={`Descrição do painel (usada para ${rot.usoDescricao})`}>
          <textarea value={d.descPainel} onChange={(e) => set("descPainel")(e.target.value)} rows={2} className={areaCls} />
        </Campo>

        {camposFicha.length > 0 && (
          <fieldset className="rounded-lg border border-border p-3">
            <legend className="px-1 text-xs font-semibold text-muted-foreground">Ficha técnica (campos desta linha)</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {camposFicha.map((c) => (
                <Campo key={c} rotulo={c}><input value={specs[c] ?? ""} onChange={(e) => setSpecs((s) => ({ ...s, [c]: e.target.value }))} maxLength={200} className={campoCls} /></Campo>
              ))}
            </div>
          </fieldset>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <button type="button" className={botaoSecundario} disabled={pendente} onClick={() => { if (!mudou || confirm("Descartar o cadastro em andamento?")) aoFechar(); }}>Cancelar</button>
          <button type="submit" className={botaoPrimario} disabled={pendente}>{pendente ? "Salvando…" : "Cadastrar equipamento"}</button>
        </div>
      </form>
    </Modal>
  );
}
