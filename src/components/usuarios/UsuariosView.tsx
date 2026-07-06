"use client";

import { useState, useTransition, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { UserPlus, Edit2, Power, Key, X, CheckCircle2 } from "lucide-react";
import {
  criarUsuario,
  atualizarUsuario,
  toggleAtivoUsuario,
  redefinirSenhaUsuario,
  type UsuarioFormState,
} from "@/app/actions/usuarios";

const NAV = "#2C4F79";
const BORDER = "#E2E8F0";
const BG = "#F8FAFC";
const SUCCESS = "#16A34A";

const PERFIS = [
  { value: "admin", label: "Administrador" },
  { value: "vendedor_interno", label: "Vendedor Interno" },
  { value: "representante", label: "Representante" },
  { value: "engenharia", label: "Engenharia" },
];

const TODAS_PAGINAS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Propostas", href: "/propostas" },
  { label: "Clientes", href: "/clientes" },
  { label: "Agenda", href: "/agenda" },
  { label: "Leads", href: "/leads" },
  { label: "Produtos", href: "/produtos" },
  { label: "Reajuste de Preços", href: "/reajuste" },
  { label: "Proposta Peças", href: "/propostas/pecas/nova" },
  { label: "Proposta Máquina", href: "/propostas/maquinas/nova" },
  { label: "Pedidos DEZ", href: "/pedidos/reconciliar" },
  { label: "Metas", href: "/metas" },
  { label: "Relatórios", href: "/relatorios" },
  { label: "Representantes", href: "/representantes" },
  { label: "Frete", href: "/frete" },
  { label: "Precificação", href: "/precificacao" },
];

const PRESETS: Record<string, string[]> = {
  admin: [],
  vendedor_interno: ["/dashboard", "/propostas", "/clientes", "/agenda", "/leads", "/produtos", "/propostas/pecas/nova", "/propostas/maquinas/nova"],
  representante: ["/dashboard", "/propostas", "/clientes", "/leads", "/propostas/pecas/nova", "/propostas/maquinas/nova"],
  engenharia: ["/dashboard", "/produtos", "/precificacao"],
};

function PaginasCheckboxes({ defaultChecked }: { defaultChecked?: string[] }) {
  const [checked, setChecked] = useState<string[]>(defaultChecked ?? []);
  const [presetPerfil, setPresetPerfil] = useState("vendedor_interno");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, color: "#374151", letterSpacing: "0.04em" }}>
        Páginas visíveis <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: 10 }}>(vazio = padrão do perfil)</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <select
          value={presetPerfil}
          onChange={(e) => setPresetPerfil(e.target.value)}
          style={{ padding: "4px 8px", border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 11 }}
        >
          {PERFIS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <button type="button" onClick={() => setChecked(PRESETS[presetPerfil] ?? [])}
          style={{ padding: "4px 10px", border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 11, cursor: "pointer", background: "#fff", fontWeight: 600 }}>
          Pré-definir
        </button>
        {checked.length > 0 && (
          <button type="button" onClick={() => setChecked([])}
            style={{ padding: "4px 10px", border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 11, cursor: "pointer", background: "#fff", color: "#6b7b8d" }}>
            Limpar
          </button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
        {TODAS_PAGINAS.map((p) => (
          <label key={p.href} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer" }}>
            <input
              type="checkbox"
              name="paginas_visiveis"
              value={p.href}
              checked={checked.includes(p.href)}
              onChange={(e) => setChecked((prev) =>
                e.target.checked ? [...prev, p.href] : prev.filter((x) => x !== p.href)
              )}
            />
            {p.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function perfilLabel(p: string) {
  return PERFIS.find((x) => x.value === p)?.label ?? p;
}

function SaveBtn({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: "9px 20px",
        background: NAV,
        color: "#fff",
        border: "none",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 700,
        cursor: pending ? "not-allowed" : "pointer",
        opacity: pending ? 0.7 : 1,
      }}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, color: "#374151", letterSpacing: "0.04em" }}>
        {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
      </label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder ?? label}
        required={required}
        style={{ padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13 }}
      />
    </div>
  );
}

function CriarForm({ onClose }: { onClose: (refresh?: boolean) => void }) {
  const [state, action] = useFormState<UsuarioFormState, FormData>(criarUsuario, {});

  if (state.success) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <CheckCircle2 size={40} color={SUCCESS} style={{ marginBottom: 14 }} />
        <div style={{ fontWeight: 700, color: NAV, fontSize: 16, marginBottom: 8 }}>Usuário criado!</div>
        <div style={{ fontSize: 13, color: "#6b7b8d", marginBottom: 8 }}>Senha temporária:</div>
        <code style={{ background: BG, border: `1px solid ${BORDER}`, padding: "6px 14px", borderRadius: 6, fontSize: 15, fontWeight: 700, color: NAV, display: "block", marginBottom: 12 }}>
          {state.senhaTemporaria}
        </code>
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 20 }}>
          Comunique a senha ao usuário. Peça para alterar no primeiro acesso.
        </div>
        <button
          onClick={() => onClose(true)}
          style={{ padding: "9px 24px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          Fechar
        </button>
      </div>
    );
  }

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14, padding: 24 }}>
      {state.error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
          {state.error}
        </div>
      )}
      <Field label="Nome completo" name="nome" required />
      <Field label="E-mail" name="email" type="email" required />
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, color: "#374151", letterSpacing: "0.04em" }}>Perfil *</label>
        <select name="perfil" required style={{ padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13 }}>
          {PERFIS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>
      <Field label="Iniciais PDF (2–3 letras)" name="iniciais_pdf" placeholder="ex: LS" />
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
        <input type="checkbox" name="pode_configurar" value="true" />
        Acesso às Configurações do sistema
      </label>
      <PaginasCheckboxes />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 8 }}>
        <button
          type="button"
          onClick={() => onClose()}
          style={{ padding: "9px 20px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "#fff" }}
        >
          Cancelar
        </button>
        <SaveBtn label="Criar usuário" pendingLabel="Criando..." />
      </div>
    </form>
  );
}

interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  pode_configurar: boolean;
  iniciais_pdf: string | null;
  ativo: boolean;
  paginas_visiveis?: string[] | null;
}

function EditarForm({ usuario, onClose }: { usuario: Usuario; onClose: (refresh?: boolean) => void }) {
  const [state, action] = useFormState<UsuarioFormState, FormData>(atualizarUsuario, {});

  useEffect(() => {
    if (state.success) onClose(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14, padding: 24 }}>
      <input type="hidden" name="id" value={usuario.id} />
      {state.error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
          {state.error}
        </div>
      )}
      <Field label="Nome completo" name="nome" required defaultValue={usuario.nome} />
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, color: "#374151", letterSpacing: "0.04em" }}>Perfil *</label>
        <select
          name="perfil"
          required
          defaultValue={usuario.perfil}
          style={{ padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13 }}
        >
          {PERFIS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>
      <Field label="Iniciais PDF" name="iniciais_pdf" defaultValue={usuario.iniciais_pdf ?? ""} placeholder="ex: LS" />
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
        <input type="checkbox" name="pode_configurar" value="true" defaultChecked={usuario.pode_configurar} />
        Acesso às Configurações do sistema
      </label>
      <PaginasCheckboxes defaultChecked={usuario.paginas_visiveis ?? []} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 8 }}>
        <button
          type="button"
          onClick={() => onClose()}
          style={{ padding: "9px 20px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "#fff" }}
        >
          Cancelar
        </button>
        <SaveBtn label="Salvar" pendingLabel="Salvando..." />
      </div>
    </form>
  );
}

export function UsuariosView({ initialUsuarios }: { initialUsuarios: Usuario[] }) {
  const [usuarios, setUsuarios] = useState(initialUsuarios);
  const [modal, setModal] = useState<{ type: "criar" } | { type: "editar"; usuario: Usuario } | null>(null);
  const [resetResult, setResetResult] = useState<{ senha: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function closeModal(refresh?: boolean) {
    setModal(null);
    if (refresh) window.location.reload();
  }

  function handleToggle(u: Usuario) {
    startTransition(async () => {
      const res = await toggleAtivoUsuario(u.id, !u.ativo);
      if (res?.error) {
        showToast(`Erro: ${res.error}`);
      } else {
        setUsuarios((prev) => prev.map((x) => (x.id === u.id ? { ...x, ativo: !u.ativo } : x)));
        showToast(u.ativo ? "Usuário desativado." : "Usuário ativado.");
      }
    });
  }

  function handleReset(u: Usuario) {
    startTransition(async () => {
      const res = await redefinirSenhaUsuario(u.id, u.email);
      if (res?.error) {
        showToast(`Erro: ${res.error}`);
      } else {
        setResetResult({ senha: res.novaSenha ?? "Seibt@2026!" });
      }
    });
  }

  const sorted = [...usuarios].sort((a, b) => (a.ativo === b.ativo ? 0 : a.ativo ? -1 : 1));

  function initials(u: Usuario) {
    if (u.iniciais_pdf) return u.iniciais_pdf.toUpperCase();
    return u.nome.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  }

  return (
    <div style={{ padding: 24, maxWidth: 1040, margin: "0 auto" }}>
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, background: NAV, color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          {toast}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: NAV, margin: 0 }}>Usuários</h1>
          <p style={{ fontSize: 13, color: "#6b7b8d", marginTop: 4 }}>
            {usuarios.filter((u) => u.ativo).length} ativo{usuarios.filter((u) => u.ativo).length !== 1 ? "s" : ""} · {usuarios.length} total
          </p>
        </div>
        <button
          onClick={() => setModal({ type: "criar" })}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 18px", background: NAV, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          <UserPlus size={15} /> Novo Usuário
        </button>
      </div>

      {resetResult && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, color: "#15803d", fontSize: 13, marginBottom: 4 }}>Senha redefinida!</div>
            <div style={{ fontSize: 13 }}>Nova senha temporária: <code style={{ background: "#dcfce7", padding: "2px 10px", borderRadius: 4, fontWeight: 700 }}>{resetResult.senha}</code></div>
          </div>
          <button onClick={() => setResetResult(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <X size={16} color="#6b7b8d" />
          </button>
        </div>
      )}

      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}>
              {["Usuário", "E-mail", "Perfil", "Configurações", "Situação", "Ações"].map((h) => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7b8d", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((u, i) => (
              <tr
                key={u.id}
                style={{ borderBottom: i < sorted.length - 1 ? `1px solid ${BORDER}` : "none", opacity: u.ativo ? 1 : 0.55 }}
              >
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: `${NAV}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: NAV, flexShrink: 0 }}>
                      {initials(u)}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "#1a1a1a" }}>{u.nome}</span>
                  </div>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "#6b7b8d" }}>{u.email}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${NAV}14`, color: NAV }}>
                    {perfilLabel(u.perfil)}
                  </span>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: u.pode_configurar ? SUCCESS : "#9ca3af", fontWeight: u.pode_configurar ? 600 : 400 }}>
                  {u.pode_configurar ? "Sim" : "Não"}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: u.ativo ? "#dcfce7" : "#f3f4f6", color: u.ativo ? "#15803d" : "#6b7b8d" }}>
                    {u.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => setModal({ type: "editar", usuario: u })}
                      style={{ padding: "5px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
                    >
                      <Edit2 size={12} /> Editar
                    </button>
                    <button
                      onClick={() => handleToggle(u)}
                      disabled={isPending}
                      style={{ padding: "5px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: u.ativo ? "#dc2626" : SUCCESS }}
                    >
                      <Power size={12} /> {u.ativo ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      onClick={() => handleReset(u)}
                      disabled={isPending}
                      style={{ padding: "5px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#d97706" }}
                    >
                      <Key size={12} /> Senha
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: "center", fontSize: 13, color: "#9ca3af" }}>Nenhum usuário cadastrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, width: 480, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 0" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: NAV, margin: 0 }}>
                {modal.type === "criar" ? "Novo Usuário" : "Editar Usuário"}
              </h2>
              <button onClick={() => closeModal()} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} color="#6b7b8d" />
              </button>
            </div>
            {modal.type === "criar" && <CriarForm onClose={closeModal} />}
            {modal.type === "editar" && <EditarForm usuario={modal.usuario} onClose={closeModal} />}
          </div>
        </div>
      )}
    </div>
  );
}
