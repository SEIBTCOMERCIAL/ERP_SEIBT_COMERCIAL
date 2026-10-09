"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sidebar, type SidebarProps } from "./Sidebar";
import { Topbar } from "./Topbar";

const CHAVE_RECOLHIDO = "erp-menu-recolhido";

/**
 * Moldura das telas do ERP. No computador o menu lateral fica fixo e pode ser recolhido (só ícones);
 * em telas menores (notebook pequeno, tablet, celular) ele vira um painel que abre pelo botão ☰.
 */
export function AppShell({ usuario, children }: { usuario: SidebarProps["usuario"]; children: React.ReactNode }) {
  const pathname = usePathname();
  const [recolhido, setRecolhido] = useState(false);
  const [aberto, setAberto] = useState(false);

  // A escolha de recolher fica guardada neste navegador.
  useEffect(() => {
    try { setRecolhido(localStorage.getItem(CHAVE_RECOLHIDO) === "1"); } catch { /* sem armazenamento: menu aberto */ }
  }, []);

  // Ao trocar de página, o painel do celular fecha.
  useEffect(() => { setAberto(false); }, [pathname]);

  const alternarRecolhido = () => {
    setRecolhido((atual) => {
      const novo = !atual;
      try { localStorage.setItem(CHAVE_RECOLHIDO, novo ? "1" : "0"); } catch { /* ignora */ }
      return novo;
    });
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] dark:bg-background">
      <Sidebar
        usuario={usuario}
        recolhido={recolhido}
        aberto={aberto}
        onAlternarRecolhido={alternarRecolhido}
        onFechar={() => setAberto(false)}
      />
      {aberto && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setAberto(false)} aria-hidden />}
      <div className={cn("flex min-w-0 flex-1 flex-col transition-[margin] duration-200", recolhido ? "lg:ml-16" : "lg:ml-[224px]")}>
        <Topbar onAbrirMenu={() => setAberto(true)} />
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
