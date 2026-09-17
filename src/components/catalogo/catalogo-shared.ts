import type { SpecCampo } from "@/lib/catalogo/dados";

/**
 * CSS do visual aprovado (folha A4, 4 máquinas por página). Usado tanto na
 * prévia em tela quanto — mais adiante — na geração do PDF, sempre a partir
 * deste único arquivo, pra nunca existir uma versão "tela" e outra "PDF" que
 * possam ficar diferentes com o tempo.
 */
export const CATALOGO_CSS = `
  .catalogo-a4 { width: 794px; height: 1123px; box-sizing: border-box; padding: 40px; display: flex; flex-direction: column; gap: 12px; background: #F4F5F7; font-family: 'IBM Plex Sans', sans-serif; color: #1C2430; }
  .catalogo-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #2E3B4E; padding-bottom: 10px; }
  .catalogo-brand { display: flex; flex-direction: column; gap: 2px; }
  .catalogo-brand .nome { font-family: 'Archivo', sans-serif; font-weight: 800; font-size: 24px; color: #2E3B4E; letter-spacing: 0.5px; }
  .catalogo-brand .tagline { font-size: 9px; letter-spacing: 1.4px; text-transform: uppercase; color: #6B7280; }
  .catalogo-badge-linha { background: #2E3B4E; color: #fff; font-size: 10.5px; font-weight: 700; letter-spacing: 1px; padding: 5px 13px; border-radius: 999px; text-transform: uppercase; white-space: nowrap; }
  .catalogo-blocos { display: flex; flex-direction: column; gap: 10px; flex-grow: 1; }
  .blk { background: #fff; border: 1px solid #E2E5EA; border-radius: 9px; padding: 10px 13px; display: flex; flex-direction: column; gap: 6px; }
  .toprow { display: flex; gap: 11px; align-items: stretch; }
  .photo { width: 108px; height: 80px; flex-shrink: 0; background: #F7F8F9; border: 1px solid #EEF0F2; border-radius: 6px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .photo img { width: 100%; height: 100%; object-fit: contain; padding: 5px; box-sizing: border-box; }
  .photo .sem-foto { font-size: 8px; color: #B0BAC9; text-align: center; padding: 0 6px; }
  .info { flex-grow: 1; display: flex; flex-direction: column; gap: 4px; justify-content: center; }
  .titlerow { display: flex; justify-content: space-between; align-items: baseline; }
  .modelo { font-family: 'Archivo', sans-serif; font-weight: 800; font-size: 14.5px; white-space: nowrap; }
  .motor { background: #E8ECF1; color: #2E3B4E; font-weight: 700; font-size: 9px; padding: 2px 7px; border-radius: 4px; white-space: nowrap; }
  .maqrow { background: #F4F5F7; border-radius: 5px; padding: 4px 8px; display: flex; justify-content: space-between; align-items: center; gap: 6px; }
  .maqrow .lbl { font-size: 8px; letter-spacing: 0.3px; text-transform: uppercase; color: #6B7280; }
  .maqrow .val { font-family: 'Archivo', sans-serif; font-weight: 800; font-size: 11.5px; white-space: nowrap; }
  .pricerow { display: flex; gap: 6px; }
  .pbox { flex: 1; background: #2E3B4E; border-radius: 5px; padding: 4px 8px; color: #fff; }
  .pbox .lbl { font-size: 8px; letter-spacing: 0.3px; text-transform: uppercase; opacity: 0.75; }
  .pbox .val { font-family: 'Archivo', sans-serif; font-weight: 800; font-size: 11.5px; white-space: nowrap; }
  .pbox .sub { font-size: 7.6px; opacity: 0.8; white-space: nowrap; }
  .spectitle { font-size: 8.5px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: #2E3B4E; border-bottom: 1.5px solid #2E3B4E; padding-bottom: 3px; }
  .spectitle.vazio { color: #B0BAC9; border-bottom-color: #ECEDEF; }
  .specgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 16px; }
  .specrow { display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0; border-bottom: 1px solid #ECEDEF; font-size: 9px; }
  .specrow span:first-child { color: #1C2430; }
  .specrow span:last-child { font-weight: 600; }
  .catalogo-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid #E2E5EA; font-size: 10px; color: #9CA3AF; }
`;

/** "R$ 1.234,56" com espaço não-quebrável — sem isso o "R$" quebra de linha
 * sozinho em textos pequenos e em negrito (bug real já visto e corrigido). */
export function formatBRL(v: number | null | undefined): string {
  if (v == null) return "—";
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Soma preço da máquina + painel; "—" se algum dos dois não estiver cadastrado. */
export function formatTotalComPainel(
  precoMaquina: number | null,
  precoPainel: number | null
): string {
  if (precoMaquina == null || precoPainel == null) return "—";
  return formatBRL(precoMaquina + precoPainel);
}

/** Distribui os campos técnicos em 3 colunas, na mesma ordem, pro grid de specs. */
export function dividirEmColunas(campos: SpecCampo[], colunas = 3): SpecCampo[][] {
  if (campos.length === 0) return [];
  const porColuna = Math.ceil(campos.length / colunas);
  const result: SpecCampo[][] = [];
  for (let i = 0; i < colunas; i++) {
    const fatia = campos.slice(i * porColuna, (i + 1) * porColuna);
    if (fatia.length > 0) result.push(fatia);
  }
  return result;
}
