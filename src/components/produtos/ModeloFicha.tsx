"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { criarLinhaSpecCampo, excluirLinhaSpecCampo } from "@/app/actions/produtos-admin";
import { PainelLateral } from "@/components/kanban/PainelLateral";
import { Aviso, botaoLeve, botaoPrimario, campoCls } from "./base";

/** Campos da ficha técnica da linha. Excluir um campo do modelo não apaga os valores já salvos nos equipamentos. */
export function ModeloFicha({ linha, campos, aberto, aoFechar, aoMudou }: {
  linha: { id: string; nome: string }; campos: Array<{ id: string; nome: string }>; aberto: boolean; aoFechar: () => void; aoMudou: () => void;
}) {
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await criarLinhaSpecCampo(linha.id, nome).catch(() => null);
      if (!r) { setErro("Não foi possível salvar. Tente novamente."); return; }
      if (!r.ok) { setErro(r.erro); return; }
      setNome(""); aoMudou();
    });
  }
  function remover(id: string, n: string) {
    if (!confirm(`Remover o campo "${n}" do modelo da linha? Os valores já salvos nos equipamentos continuam guardados.`)) return;
    setErro(null);
    iniciar(async () => {
      const r = await excluirLinhaSpecCampo(linha.id, id).catch(() => null);
      if (!r) { setErro("Não foi possível remover. Tente novamente."); return; }
      if (!r.ok) setErro(r.erro); else aoMudou();
    });
  }

  return (
    <PainelLateral aberto={aberto} aoFechar={aoFechar} titulo={`Ficha técnica — ${linha.nome}`} largura={460}>
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm text-muted-foreground">Estes campos aparecem no cadastro e no catálogo dos equipamentos da linha. A pendência de “ficha incompleta” considera só estes campos.</p>
        {erro && <Aviso>{erro}</Aviso>}
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {campos.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">Nenhum campo configurado.</li>}
          {campos.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">{c.nome}</span>
              <button type="button" className={botaoLeve} disabled={pendente} onClick={() => remover(c.id, c.nome)} aria-label={`Remover ${c.nome}`}><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
        <form onSubmit={adicionar} className="flex gap-2">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Novo campo (ex.: Motor (cv))" maxLength={80} aria-label="Nome do novo campo" className={campoCls} />
          <button type="submit" className={botaoPrimario} disabled={pendente || !nome.trim()}>Adicionar</button>
        </form>
      </div>
    </PainelLateral>
  );
}
