"use client";

/** Barra contextual: só aparece com itens selecionados. Fica colada na base da área de rolagem, depois da tabela e da paginação. */
export function BarraSelecao({ texto, filtrados, aoLimpar, aoReajustar, aoIpi, children }: {
  /** Ex.: "3 kits selecionados". */
  texto: string;
  /** Oferece estender a seleção a todos os resultados filtrados (inclusive de outras páginas). */
  filtrados?: { total: number; selecionados: number; aoSelecionarTodos: () => void };
  aoLimpar: () => void;
  aoReajustar: () => void;
  /** Só quando aplicável (navalhas). */
  aoIpi?: () => void;
  children?: React.ReactNode;
}) {
  const secundario = "h-9 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted";
  return (
    <div role="region" aria-label="Ações da seleção" className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-[#edf3fa] px-4 py-2.5 text-sm shadow-md dark:bg-[#2a3c52]">
      <span aria-live="polite" className="mr-auto font-medium text-foreground">
        {texto}
        {filtrados && filtrados.selecionados < filtrados.total && (
          <button type="button" onClick={filtrados.aoSelecionarTodos} className="ml-3 font-normal text-[#2074B9] hover:underline">Selecionar todos os {filtrados.total} filtrados</button>
        )}
        {filtrados && filtrados.selecionados >= filtrados.total && filtrados.total > 1 && <span className="ml-3 font-normal text-muted-foreground">todos os resultados filtrados</span>}
      </span>
      {children}
      <button type="button" onClick={aoLimpar} className={secundario}>Limpar seleção</button>
      {aoIpi && <button type="button" onClick={aoIpi} className={secundario}>Alterar IPI</button>}
      <button type="button" onClick={aoReajustar} className="h-9 rounded-lg bg-[#2C4F79] px-4 text-sm font-semibold text-white hover:bg-[#25415f]">Reajustar selecionados</button>
    </div>
  );
}
