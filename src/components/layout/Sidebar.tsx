"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import { ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, type NavItem } from "./nav-config";
import type { Perfil } from "@/types/database";
import { getInitials } from "@/lib/utils";

export interface SidebarProps {
  usuario: {
    nome: string;
    email: string;
    perfil: Perfil;
    pode_configurar: boolean;
    avatar_url?: string | null;
    paginas_visiveis?: string[] | null;
  };
  /** Computador: menu recolhido, só com os ícones. */
  recolhido?: boolean;
  /** Telas menores: painel aberto pelo botão ☰. */
  aberto?: boolean;
  onAlternarRecolhido?: () => void;
  onFechar?: () => void;
}

export function Sidebar({ usuario, recolhido = false, aberto = false, onAlternarRecolhido, onFechar }: SidebarProps) {
  const pathname = usePathname();
  const pv = usuario.paginas_visiveis ?? [];

  const visibleGroups = NAV_GROUPS
    .filter((group) => {
      if (group.requiresConfig && !usuario.pode_configurar) return false;
      if (group.visibleFor && !group.visibleFor.includes(usuario.perfil)) return false;
      if (pv.length > 0) return group.items.some((item: NavItem) => pv.includes(item.href));
      return true;
    })
    .map((group) => ({
      ...group,
      items: pv.length > 0 ? group.items.filter((item: NavItem) => pv.includes(item.href)) : group.items,
    }));

  // No modo recolhido (só no computador) os textos somem e ficam os ícones.
  const soNoAberto = recolhido ? "lg:hidden" : "";

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[224px] flex-col bg-[#2C4F79] transition-[transform,width] duration-200 dark:bg-[#1E3A5F]",
        aberto ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        "lg:translate-x-0 lg:shadow-none",
        recolhido ? "lg:w-16" : "lg:w-[224px]"
      )}
      aria-label="Menu principal"
    >
      {/* Logo */}
      <div className={cn("flex h-14 items-center gap-3 border-b border-white/10 px-4", recolhido && "lg:justify-center lg:px-0")}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-sm font-bold text-white">
          S
        </div>
        <div className={cn("flex flex-1 flex-col", soNoAberto)}>
          <span className="text-sm font-semibold leading-none text-white">SEIBT</span>
          <span className="mt-0.5 text-[10px] leading-none text-white/60">ERP Comercial</span>
        </div>
        <button type="button" onClick={onFechar} className="rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Fechar menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navegação */}
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 py-3">
        {visibleGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className={cn("mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/40", soNoAberto)}>
              {group.label}
            </p>
            {recolhido && <div className="mx-2 mb-1 hidden border-t border-white/10 lg:block" aria-hidden />}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const Icon = (Icons as any)[item.icon] as React.ComponentType<{ className?: string }>;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onFechar}
                      title={recolhido ? item.label : undefined}
                      className={cn(
                        "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all",
                        recolhido && "lg:justify-center lg:px-0",
                        isActive
                          ? "bg-white/15 text-white"
                          : "text-white/65 hover:bg-white/8 hover:text-white/90"
                      )}
                    >
                      {Icon && <Icon className="h-4 w-4 shrink-0" />}
                      <span className={soNoAberto}>{item.label}</span>
                      {item.badge != null && item.badge > 0 && (
                        <span className={cn(
                          "ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white",
                          recolhido && "lg:absolute lg:right-1 lg:top-1 lg:ml-0"
                        )}>
                          {item.badge > 9 ? "9+" : item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Recolher / expandir (só no computador) */}
      {onAlternarRecolhido && (
        <div className="hidden border-t border-white/10 px-2 py-2 lg:block">
          <button
            type="button"
            onClick={onAlternarRecolhido}
            title={recolhido ? "Expandir menu" : "Recolher menu"}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium text-white/65 transition-colors hover:bg-white/8 hover:text-white",
              recolhido && "justify-center px-0"
            )}
          >
            {recolhido ? <ChevronsRight className="h-4 w-4 shrink-0" /> : <ChevronsLeft className="h-4 w-4 shrink-0" />}
            {!recolhido && <span>Recolher menu</span>}
          </button>
        </div>
      )}

      {/* Footer — usuário logado */}
      <div className={cn("border-t border-white/10 px-3 py-3", recolhido && "lg:px-0")}>
        <div className={cn("flex items-center gap-2.5", recolhido && "lg:justify-center")} title={recolhido ? `${usuario.nome} — ${usuario.email}` : undefined}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-semibold text-white">
            {getInitials(usuario.nome)}
          </div>
          <div className={cn("min-w-0 flex-1", soNoAberto)}>
            <p className="truncate text-[13px] font-medium text-white">{usuario.nome}</p>
            <p className="truncate text-[11px] text-white/50">{usuario.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
