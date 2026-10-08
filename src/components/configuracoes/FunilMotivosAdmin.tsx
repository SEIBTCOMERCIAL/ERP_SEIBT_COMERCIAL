"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { ArrowDown, ArrowUp, Edit2, GitBranch, ListChecks, Plus, ToggleLeft, ToggleRight, Trash2, X } from "lucide-react";
import {
  alternarMotivo,
  atualizarEtapaFunil,
  criarEtapaFunil,
  criarFunil,
  criarMotivo,
  excluirEtapaFunil,
  renomearMotivo,
  reordenarEtapaFunil,
  reordenarMotivo,
  toggleEtapaFunil,
  type EtapaState,
  type MotivoState,
} from "@/app/actions/configuracoes";
import { CATEGORIAS_MOTIVO, TIPOS_ETAPA } from "@/lib/propostas/crm";

const NAV = "#2C4F79";
const BORDER = "#E2E8F0";
const BG = "#F8FAFC";

export interface FunilConfig { id: string; nome: string }
export interface EtapaConfig {
  id: string; funil_id: string; nome: string; cor: string; ordem: number; ativo: boolean;
  tipo?: string | null; exige_proxima_acao?: boolean | null;
}
export interface MotivoConfig { id: string; categoria: string; codigo: string; nome: string; ordem: number; ativo: boolean }

const rotuloCampo = { fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, color: "#374151" };
const entrada = { padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13 };
const botaoMini = { padding: "5px 8px", border: `1px solid ${BORDER}`, borderRadius: 6, background: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 };

function Salvar({ label, pendente }: { label: string; pendente: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ padding: "9px 18px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: pending ? "not-allowed" : "pointer", opacity: pending ? 0.7 : 1 }}>
      {pending ? pendente : label}
    </button>
  );
}

function Cabecalho({ icone, titulo, subtitulo, acao }: { icone: React.ReactNode; titulo: string; subtitulo: string; acao?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, background: BG }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${NAV}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icone}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: NAV }}>{titulo}</div>
          <div style={{ fontSize: 12, color: "#6b7b8d" }}>{subtitulo}</div>
        </div>
      </div>
      {acao}
    </div>
  );
}

function Janela({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 12 }}>
      <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 440, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 0" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: NAV, margin: 0 }}>{titulo}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }} aria-label="Fechar"><X size={18} color="#6b7b8d" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CamposEtapa({ etapa }: { etapa?: EtapaConfig }) {
  const [tipo, setTipo] = useState(etapa?.tipo ?? "intermediaria");
  const ajuda = TIPOS_ETAPA.find((t) => t.value === tipo)?.ajuda;
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={rotuloCampo}>Nome *</label>
        <input type="text" name="nome" required defaultValue={etapa?.nome} placeholder="ex: Proposta enviada" style={entrada} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={rotuloCampo}>Cor</label>
          <input type="color" name="cor" defaultValue={etapa?.cor ?? "#2074B9"} style={{ padding: 2, border: `1px solid ${BORDER}`, borderRadius: 6, height: 36, cursor: "pointer", width: "100%" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={rotuloCampo}>Tipo da etapa</label>
          <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ ...entrada, background: "#fff" }}>
            {TIPOS_ETAPA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>
      {ajuda && <p style={{ fontSize: 12, color: "#6b7b8d", margin: 0 }}>{ajuda}</p>}
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151" }}>
        <input type="checkbox" name="exige_proxima_acao" defaultChecked={Boolean(etapa?.exige_proxima_acao)} style={{ width: 16, height: 16 }} />
        Exigir próxima ação ao mover uma proposta para esta etapa
      </label>
    </>
  );
}

function FormEtapa({ funilId, etapa, onClose }: { funilId: string; etapa?: EtapaConfig; onClose: () => void }) {
  const router = useRouter();
  const [state, action] = useFormState<EtapaState, FormData>(etapa ? atualizarEtapaFunil : criarEtapaFunil, {});
  useEffect(() => {
    if (state.success) { router.refresh(); onClose(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12, padding: 20 }}>
      {etapa ? <input type="hidden" name="id" value={etapa.id} /> : <input type="hidden" name="funil_id" value={funilId} />}
      {state.error && <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#dc2626" }}>{state.error}</div>}
      <CamposEtapa etapa={etapa} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
        <button type="button" onClick={onClose} style={{ padding: "8px 16px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, cursor: "pointer", background: "#fff" }}>Cancelar</button>
        <Salvar label={etapa ? "Salvar" : "Criar etapa"} pendente="Salvando..." />
      </div>
    </form>
  );
}

function FormFunil({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [state, action] = useFormState<EtapaState, FormData>(criarFunil, {});
  useEffect(() => {
    if (state.success) { router.refresh(); onClose(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12, padding: 20 }}>
      {state.error && <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#dc2626" }}>{state.error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={rotuloCampo}>Nome do funil *</label>
        <input type="text" name="nome" required placeholder="ex: Funil Comercial" style={entrada} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button type="button" onClick={onClose} style={{ padding: "8px 16px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, cursor: "pointer", background: "#fff" }}>Cancelar</button>
        <Salvar label="Criar funil" pendente="Criando..." />
      </div>
    </form>
  );
}

export function FunilSection({ funis, etapas, ehAdmin, estruturaPendente }: { funis: FunilConfig[]; etapas: EtapaConfig[]; ehAdmin: boolean; estruturaPendente: boolean }) {
  const router = useRouter();
  const [funilId, setFunilId] = useState(funis[0]?.id ?? "");
  const [modal, setModal] = useState<{ tipo: "etapa"; etapa?: EtapaConfig } | { tipo: "funil" } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const lista = etapas.filter((e) => e.funil_id === funilId).sort((a, b) => a.ordem - b.ordem);
  const rotuloTipo = (t?: string | null) => TIPOS_ETAPA.find((x) => x.value === (t ?? "intermediaria"))?.label ?? "Intermediária";

  function executar(fn: () => Promise<{ error?: string } | undefined>) {
    setAviso(null);
    startTransition(async () => {
      const r = await fn();
      if (r?.error) setAviso(r.error);
      else router.refresh();
    });
  }

  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
      <Cabecalho
        icone={<GitBranch size={16} color={NAV} />}
        titulo="Funil de vendas"
        subtitulo={ehAdmin ? "Etapas do Kanban de propostas — somente o administrador altera" : "Etapas do Kanban de propostas (somente leitura)"}
        acao={ehAdmin ? (
          funis.length === 0
            ? <button onClick={() => setModal({ tipo: "funil" })} style={{ ...botaoMini, padding: "7px 14px", fontWeight: 600 }}><Plus size={13} /> Criar funil</button>
            : <button onClick={() => setModal({ tipo: "etapa" })} style={{ ...botaoMini, padding: "7px 14px", background: NAV, color: "#fff", border: "none", fontWeight: 700 }}><Plus size={13} /> Nova etapa</button>
        ) : undefined}
      />
      {estruturaPendente && (
        <div style={{ margin: 16, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400e" }}>
          Tipo de etapa, regra de próxima ação e propostas organizadas por etapa dependem da atualização do banco de dados do CRM (arquivo 024).
        </div>
      )}
      {aviso && <div style={{ margin: 16, background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>{aviso}</div>}

      {funis.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", fontSize: 13, color: "#9ca3af" }}>Nenhum funil criado. {ehAdmin ? "Crie o primeiro funil para gerenciar as etapas." : "O administrador precisa criar o funil."}</div>
      ) : (
        <>
          {funis.length > 1 && (
            <div style={{ padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {funis.map((f) => (
                <button key={f.id} onClick={() => setFunilId(f.id)} style={{ padding: "6px 14px", border: `2px solid ${funilId === f.id ? NAV : BORDER}`, borderRadius: 8, background: funilId === f.id ? NAV : "#fff", color: funilId === f.id ? "#fff" : "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{f.nome}</button>
              ))}
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}>
                  {["Etapa", "Tipo", "Próxima ação", "Status", ...(ehAdmin ? ["Ações"] : [])].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7b8d", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((e, i) => (
                  <tr key={e.id} style={{ borderBottom: `1px solid ${BORDER}`, opacity: e.ativo ? 1 : 0.55 }}>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: e.cor, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{e.nome}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#374151" }}>{rotuloTipo(e.tipo)}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: e.exige_proxima_acao ? "#b45309" : "#9ca3af", fontWeight: e.exige_proxima_acao ? 700 : 400 }}>{e.exige_proxima_acao ? "Obrigatória" : "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: e.ativo ? "#dcfce7" : "#f3f4f6", color: e.ativo ? "#15803d" : "#6b7b8d" }}>{e.ativo ? "Ativa" : "Inativa"}</span>
                    </td>
                    {ehAdmin && (
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button disabled={pendente || i === 0} onClick={() => executar(() => reordenarEtapaFunil(e.id, "subir"))} style={{ ...botaoMini, opacity: i === 0 ? 0.4 : 1 }} aria-label="Subir"><ArrowUp size={12} /></button>
                          <button disabled={pendente || i === lista.length - 1} onClick={() => executar(() => reordenarEtapaFunil(e.id, "descer"))} style={{ ...botaoMini, opacity: i === lista.length - 1 ? 0.4 : 1 }} aria-label="Descer"><ArrowDown size={12} /></button>
                          <button onClick={() => setModal({ tipo: "etapa", etapa: e })} style={botaoMini}><Edit2 size={12} /> Editar</button>
                          <button disabled={pendente} onClick={() => executar(() => toggleEtapaFunil(e.id, !e.ativo))} style={{ ...botaoMini, color: e.ativo ? "#d97706" : "#16A34A" }}>
                            {e.ativo ? <ToggleLeft size={12} /> : <ToggleRight size={12} />}{e.ativo ? "Desativar" : "Ativar"}
                          </button>
                          <button disabled={pendente} onClick={() => { if (confirm(`Excluir a etapa "${e.nome}"?`)) executar(() => excluirEtapaFunil(e.id)); }} style={{ ...botaoMini, border: "1px solid #fca5a5", color: "#dc2626" }} aria-label="Excluir"><Trash2 size={12} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {lista.length === 0 && <tr><td colSpan={5} style={{ padding: 30, textAlign: "center", fontSize: 13, color: "#9ca3af" }}>Nenhuma etapa cadastrada.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "12px 20px", fontSize: 12, color: "#6b7b8d", borderTop: `1px solid ${BORDER}` }}>
            Etapas do tipo <strong>Ganho</strong>, <strong>Perda</strong> e <strong>Congelamento</strong> também mudam o status da proposta ao receber um card. Propostas nunca ficam sem etapa: uma etapa com propostas só pode ser desativada.
          </div>
        </>
      )}

      {modal?.tipo === "etapa" && (
        <Janela titulo={modal.etapa ? "Editar etapa" : "Nova etapa"} onClose={() => setModal(null)}>
          <FormEtapa funilId={funilId} etapa={modal.etapa} onClose={() => setModal(null)} />
        </Janela>
      )}
      {modal?.tipo === "funil" && <Janela titulo="Novo funil" onClose={() => setModal(null)}><FormFunil onClose={() => setModal(null)} /></Janela>}
    </div>
  );
}

function NovoMotivo({ categoria }: { categoria: string }) {
  const router = useRouter();
  const [state, action] = useFormState<MotivoState, FormData>(criarMotivo, {});
  const [chave, setChave] = useState(0);
  useEffect(() => {
    if (state.success) { router.refresh(); setChave((c) => c + 1); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);
  return (
    <form key={chave} action={action} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
      <input type="hidden" name="categoria" value={categoria} />
      <input name="nome" required placeholder="Novo motivo..." style={{ ...entrada, flex: 1, minWidth: 180 }} />
      <Salvar label="Adicionar" pendente="Adicionando..." />
      {state.error && <span style={{ flexBasis: "100%", fontSize: 12, color: "#dc2626" }}>{state.error}</span>}
    </form>
  );
}

function LinhaMotivo({ motivo, primeiro, ultimo, ehAdmin }: { motivo: MotivoConfig; primeiro: boolean; ultimo: boolean; ehAdmin: boolean }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(motivo.nome);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function executar(fn: () => Promise<{ error?: string } | undefined>, aoTerminar?: () => void) {
    setErro(null);
    startTransition(async () => {
      const r = await fn();
      if (r?.error) setErro(r.error);
      else { aoTerminar?.(); router.refresh(); }
    });
  }

  return (
    <li style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 0", borderBottom: `1px solid ${BORDER}`, opacity: motivo.ativo ? 1 : 0.55 }}>
      {editando ? (
        <input value={nome} onChange={(e) => setNome(e.target.value)} style={{ ...entrada, flex: 1, minWidth: 180 }} />
      ) : (
        <span style={{ flex: 1, minWidth: 160, fontSize: 13, color: "#1a1a1a" }}>{motivo.nome}{!motivo.ativo && <em style={{ marginLeft: 6, fontSize: 11, color: "#6b7b8d" }}>(inativo)</em>}</span>
      )}
      {ehAdmin && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {editando ? (
            <>
              <button disabled={pendente} onClick={() => executar(() => renomearMotivo(motivo.id, nome), () => setEditando(false))} style={{ ...botaoMini, background: NAV, color: "#fff", border: "none" }}>Salvar</button>
              <button onClick={() => { setEditando(false); setNome(motivo.nome); }} style={botaoMini}>Cancelar</button>
            </>
          ) : (
            <>
              <button disabled={pendente || primeiro} onClick={() => executar(() => reordenarMotivo(motivo.id, "subir"))} style={{ ...botaoMini, opacity: primeiro ? 0.4 : 1 }} aria-label="Subir"><ArrowUp size={12} /></button>
              <button disabled={pendente || ultimo} onClick={() => executar(() => reordenarMotivo(motivo.id, "descer"))} style={{ ...botaoMini, opacity: ultimo ? 0.4 : 1 }} aria-label="Descer"><ArrowDown size={12} /></button>
              <button onClick={() => setEditando(true)} style={botaoMini}><Edit2 size={12} /> Editar</button>
              <button disabled={pendente} onClick={() => executar(() => alternarMotivo(motivo.id, !motivo.ativo))} style={{ ...botaoMini, color: motivo.ativo ? "#d97706" : "#16A34A" }}>{motivo.ativo ? "Desativar" : "Ativar"}</button>
            </>
          )}
        </div>
      )}
      {erro && <span style={{ flexBasis: "100%", fontSize: 12, color: "#dc2626" }}>{erro}</span>}
    </li>
  );
}

export function MotivosSection({ motivos, ehAdmin, estruturaPendente }: { motivos: MotivoConfig[]; ehAdmin: boolean; estruturaPendente: boolean }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
      <Cabecalho
        icone={<ListChecks size={16} color={NAV} />}
        titulo="Motivos padrão"
        subtitulo={ehAdmin ? "Listas usadas ao perder, congelar ou marcar uma proposta como complementar" : "Listas de motivos (somente leitura)"}
      />
      {estruturaPendente ? (
        <div style={{ margin: 16, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400e" }}>
          As listas de motivos ficam editáveis depois da atualização do banco de dados do CRM (arquivo 024). Até lá, valem os motivos padrão do sistema.
        </div>
      ) : (
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 22 }}>
          {CATEGORIAS_MOTIVO.map((cat) => {
            const lista = motivos.filter((m) => m.categoria === cat.value).sort((a, b) => a.ordem - b.ordem);
            return (
              <div key={cat.value}>
                <div style={{ fontWeight: 700, fontSize: 13, color: NAV }}>{cat.label}</div>
                <div style={{ fontSize: 12, color: "#6b7b8d", marginBottom: 6 }}>{cat.descricao}</div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: `1px solid ${BORDER}` }}>
                  {lista.map((m, i) => <LinhaMotivo key={m.id} motivo={m} primeiro={i === 0} ultimo={i === lista.length - 1} ehAdmin={ehAdmin} />)}
                </ul>
                {ehAdmin && <NovoMotivo categoria={cat.value} />}
              </div>
            );
          })}
          <p style={{ fontSize: 12, color: "#6b7b8d", margin: 0 }}>Motivos já usados em propostas não são apagados: ao desativar, ele só deixa de aparecer para novas escolhas e continua no histórico.</p>
        </div>
      )}
    </div>
  );
}
