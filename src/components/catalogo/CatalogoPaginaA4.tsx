import type { MaquinaCatalogo, SpecCampo } from "@/lib/catalogo/tipos";
import { formatBRL, formatTotalComPainel, dividirEmColunas } from "./catalogo-shared";

interface CatalogoPaginaA4Props {
  linhaNome: string;
  maquinas: MaquinaCatalogo[];
  specCampos: SpecCampo[];
  numeroPagina: number;
}

/**
 * Uma folha A4 do catálogo (visual aprovado): até 4 máquinas, cada uma com
 * foto, preço e tabela de especificações técnicas. Componente puro — sem
 * hooks, sem client-side — pra poder ser usado tanto na prévia em tela quanto,
 * mais adiante, na geração do PDF (renderizado pro mesmo HTML nos dois casos).
 */
export function CatalogoPaginaA4({ linhaNome, maquinas, specCampos, numeroPagina }: CatalogoPaginaA4Props) {
  return (
    <div className="catalogo-a4">
      <div className="catalogo-header">
        <div className="catalogo-brand">
          <span className="nome">SEIBT</span>
          <span className="tagline">Soluções para a Indústria do Plástico</span>
        </div>
        <span className="catalogo-badge-linha">Linha {linhaNome}</span>
      </div>

      <div className="catalogo-blocos">
        {maquinas.map((maquina) => (
          <MaquinaBloco key={maquina.id} maquina={maquina} specCampos={specCampos} />
        ))}
      </div>

      <div className="catalogo-footer">
        <span>Linha {linhaNome} · Catálogo de Preços 2026</span>
        <span>www.seibt.com.br · pág. {numeroPagina}</span>
      </div>
    </div>
  );
}

function MaquinaBloco({ maquina, specCampos }: { maquina: MaquinaCatalogo; specCampos: SpecCampo[] }) {
  const colunas = dividirEmColunas(specCampos, 3);

  return (
    <div className="blk">
      <div className="toprow">
        <div className="photo">
          {maquina.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={maquina.fotoUrl} alt={maquina.codigo} />
          ) : (
            <span className="sem-foto">Sem foto selecionada</span>
          )}
        </div>
        <div className="info">
          <div className="titlerow">
            <span className="modelo">{maquina.codigo}</span>
            {maquina.potenciaMotor && <span className="motor">Motor {maquina.potenciaMotor} CV</span>}
          </div>
          <div className="maqrow">
            <span className="lbl">Valor da máquina (sem painel)</span>
            <span className="val">{formatBRL(maquina.precoMaquina)}</span>
          </div>
          <div className="pricerow">
            <div className="pbox">
              <div className="lbl">NR-12 220V</div>
              <div className="val">{formatTotalComPainel(maquina.precoMaquina, maquina.precoPainel220)}</div>
              <div className="sub">Valor Painel NR-12: {formatBRL(maquina.precoPainel220)}</div>
            </div>
            <div className="pbox">
              <div className="lbl">NR-12 380V</div>
              <div className="val">{formatTotalComPainel(maquina.precoMaquina, maquina.precoPainel380)}</div>
              <div className="sub">Valor Painel NR-12: {formatBRL(maquina.precoPainel380)}</div>
            </div>
          </div>
        </div>
      </div>

      {colunas.length > 0 ? (
        <>
          <div className="spectitle">Especificações Técnicas</div>
          <div className="specgrid">
            {colunas.map((coluna, i) => (
              <div key={i}>
                {coluna.map((campo) => (
                  <div className="specrow" key={campo.id}>
                    <span>{campo.nome}</span>
                    <span>{maquina.specs[campo.nome] ?? "—"}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="spectitle vazio">Especificações técnicas não configuradas para esta linha</div>
      )}
    </div>
  );
}
