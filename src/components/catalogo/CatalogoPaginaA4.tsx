import { Camera } from "lucide-react";
import type { MaquinaCatalogo, SpecCampo } from "@/lib/catalogo/tipos";
import { formatBRL, formatTotalComPainel, dividirEmColunas } from "./catalogo-shared";

interface CatalogoPaginaA4Props {
  linhaId: string;
  linhaNome: string;
  maquinas: MaquinaCatalogo[];
  specCampos: SpecCampo[];
  numeroPagina: number;
  /** Só usado na prévia em tela do Administrador — nunca no PDF. */
  onEditarFoto?: (maquina: MaquinaCatalogo, linhaId: string) => void;
}

/**
 * Uma folha A4 do catálogo (visual aprovado): até 4 máquinas, cada uma com
 * foto, preço e tabela de especificações técnicas. Componente puro — sem
 * hooks, sem client-side — pra poder ser usado tanto na prévia em tela quanto,
 * mais adiante, na geração do PDF (renderizado pro mesmo HTML nos dois casos).
 * `onEditarFoto` é a única exceção: quando não é passado (caso do PDF), a
 * página fica exatamente igual, sem nenhum comportamento clicável.
 */
export function CatalogoPaginaA4({ linhaId, linhaNome, maquinas, specCampos, numeroPagina, onEditarFoto }: CatalogoPaginaA4Props) {
  return (
    <div className="catalogo-a4">
      <div className="catalogo-header">
        <div className="catalogo-brand">
          <span className="nome">SEIBT</span>
          <span className="tagline">Soluções para a Indústria do Plástico</span>
        </div>
        <span className="catalogo-badge-linha">{linhaNome}</span>
      </div>

      <div className="catalogo-blocos">
        {maquinas.map((maquina) => (
          <MaquinaBloco key={maquina.id} maquina={maquina} specCampos={specCampos} linhaId={linhaId} onEditarFoto={onEditarFoto} />
        ))}
      </div>

      <div className="catalogo-footer">
        <span>{linhaNome} · Catálogo de Preços 2026</span>
        <span>www.seibt.com.br · pág. {numeroPagina}</span>
      </div>
    </div>
  );
}

function MaquinaBloco({
  maquina,
  specCampos,
  linhaId,
  onEditarFoto,
}: {
  maquina: MaquinaCatalogo;
  specCampos: SpecCampo[];
  linhaId: string;
  onEditarFoto?: (maquina: MaquinaCatalogo, linhaId: string) => void;
}) {
  // Só os campos que este equipamento tem preenchidos: linhas que misturam tipos de
  // máquina (ex.: Moinho para Tubos = MDTS, MHTS e TP) têm fichas diferentes por item.
  const camposComValor = specCampos.filter((c) => String(maquina.specs[c.nome] ?? "").trim() !== "");
  const colunas = dividirEmColunas(camposComValor, 3);
  const editavel = Boolean(onEditarFoto);

  return (
    <div className="blk">
      <div className="toprow">
        <div
          className={`photo${editavel ? " editavel" : ""}`}
          onClick={editavel ? () => onEditarFoto!(maquina, linhaId) : undefined}
          title={editavel ? "Clique para trocar a foto" : undefined}
        >
          {maquina.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={maquina.fotoUrl} alt={maquina.nome} />
          ) : (
            <span className="sem-foto">Sem foto selecionada</span>
          )}
          {editavel && (
            <div className="foto-overlay catalogo-no-print">
              <Camera size={16} color="#fff" />
            </div>
          )}
        </div>
        <div className="info">
          <div className="titlerow">
            <span className={`modelo${maquina.nome.length > 32 ? " longo" : ""}`}>{maquina.nome}</span>
            {maquina.potenciaMotor && <span className="motor">Motor {maquina.potenciaMotor} CV</span>}
          </div>
          <PrecosMaquina maquina={maquina} />
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

/** Bloco de preços conforme o tipo do item (ver TipoPreco). */
function PrecosMaquina({ maquina }: { maquina: MaquinaCatalogo }) {
  if (maquina.tipoPreco === "sem_painel") {
    return (
      <div className="pricerow">
        <div className="pbox unico">
          <div className="lbl">Valor</div>
          <div className="val">{formatBRL(maquina.precoMaquina)}</div>
        </div>
      </div>
    );
  }

  if (maquina.tipoPreco === "por_voltagem") {
    return (
      <div className="pricerow">
        <div className="pbox">
          <div className="lbl">220V</div>
          <div className="val">{formatBRL(maquina.precoPainel220)}</div>
        </div>
        <div className="pbox">
          <div className="lbl">380V</div>
          <div className="val">{formatBRL(maquina.precoPainel380)}</div>
        </div>
      </div>
    );
  }

  // Exaustores: os dois painéis são "compartilhado" (com o moinho) e "dedicado"
  // (exaustor vendido avulso), não 220V/380V.
  const compartilhado = maquina.tipoPreco === "painel_compartilhado";
  const rotulos = compartilhado
    ? { a: "Painel compartilhado", subA: "Painel compartilhado", b: "Painel dedicado (avulso)", subB: "Painel dedicado", maq: "Valor do exaustor (sem painel)" }
    : { a: "NR-12 220V", subA: "Valor Painel NR-12", b: "NR-12 380V", subB: "Valor Painel NR-12", maq: "Valor da máquina (sem painel)" };

  return (
    <>
      <div className="maqrow">
        <span className="lbl">{rotulos.maq}</span>
        <span className="val">{formatBRL(maquina.precoMaquina)}</span>
      </div>
      <div className="pricerow">
        <div className="pbox">
          <div className="lbl">{rotulos.a}</div>
          <div className="val">{formatTotalComPainel(maquina.precoMaquina, maquina.precoPainel220)}</div>
          <div className="sub">{rotulos.subA}: {formatBRL(maquina.precoPainel220)}</div>
        </div>
        <div className="pbox">
          <div className="lbl">{rotulos.b}</div>
          <div className="val">{formatTotalComPainel(maquina.precoMaquina, maquina.precoPainel380)}</div>
          <div className="sub">{rotulos.subB}: {formatBRL(maquina.precoPainel380)}</div>
        </div>
      </div>
    </>
  );
}
