"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, X } from "lucide-react";

interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string | null;
  lida: boolean;
  link: string | null;
  criado_em: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/notificacoes")
      .then((r) => r.json())
      .then((data) => {
        setNotificacoes(data.notificacoes ?? []);
        setNaoLidas(data.naoLidas ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function marcarLida(id: string) {
    await fetch(`/api/notificacoes/${id}/lida`, { method: "PATCH" }).catch(() => {});
    setNotificacoes((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
    setNaoLidas((prev) => Math.max(0, prev - 1));
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: 36,
          height: 36,
          border: "none",
          background: "none",
          borderRadius: 8,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
        title="Notificações"
      >
        <Bell size={18} color="#374151" />
        {naoLidas > 0 && (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              minWidth: 16,
              height: 16,
              background: "#dc2626",
              borderRadius: 8,
              fontSize: 10,
              fontWeight: 700,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
            }}
          >
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 360,
            background: "#fff",
            border: "1px solid #E2E8F0",
            borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              borderBottom: "1px solid #E2E8F0",
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 14, color: "#2C4F79" }}>
              Notificações{naoLidas > 0 ? ` (${naoLidas})` : ""}
            </span>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", lineHeight: 0 }}>
              <X size={15} color="#9ca3af" />
            </button>
          </div>

          <div style={{ maxHeight: 420, overflow: "auto" }}>
            {notificacoes.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "#9ca3af" }}>
                Nenhuma notificação
              </div>
            ) : (
              notificacoes.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    marcarLida(n.id);
                    if (n.link) window.location.href = n.link;
                    else setOpen(false);
                  }}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #E2E8F0",
                    cursor: "pointer",
                    background: n.lida ? "#fff" : "#f0f7ff",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: n.lida ? "transparent" : "#2074B9",
                      marginTop: 5,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: n.lida ? 400 : 700,
                        color: "#1a1a1a",
                        marginBottom: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      {n.titulo}
                    </div>
                    {n.corpo && (
                      <div style={{ fontSize: 12, color: "#6b7b8d", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                        {n.corpo}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      {new Date(n.criado_em).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ padding: "10px 16px", borderTop: "1px solid #E2E8F0", textAlign: "center" }}>
            <a href="/notificacoes" style={{ fontSize: 12, color: "#2074B9", fontWeight: 600, textDecoration: "none" }}>
              Ver todas as notificações
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
