"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, type NavItem } from "./nav-config";
import type { Perfil } from "@/types/database";
import { getInitials } from "@/lib/utils";

interface SidebarProps {
  usuario: {
    nome: string;
    email: string;
    perfil: Perfil;
    pode_configurar: boolean;
    avatar_url?: string | null;
    paginas_visiveis?: string[] | null;
  };
}

export function Sidebar({ usuario }: SidebarProps) {
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

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-[224px] flex-col bg-[#2C4F79] dark:bg-[#1E3A5F]">
      {/* Logo */}
      <div className="flex h-14 items-center gap-3 px-4 border-b border-white/10">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white font-bold text-sm">
          S
        </div>
        <div className="flex flex-col">
          <span className="text-white font-semibold text-sm leading-none">SEIBT</span>
          <span className="text-white/60 text-[10px] leading-none mt-0.5">ERP Comercial</span>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2">
        {visibleGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="px-3 mb-1 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const Icon = (Icons as any)[item.icon] as React.ComponentType<{ className?: string }>;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all",
                        isActive
                          ? "bg-white/15 text-white"
                          : "text-white/65 hover:bg-white/8 hover:text-white/90"
                      )}
                    >
                      {Icon && <Icon className="h-4 w-4 shrink-0" />}
                      <span>{item.label}</span>
                      {item.badge != null && item.badge > 0 && (
                        <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
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

      {/* Footer — usuário logado */}
      <div className="border-t border-white/10 px-3 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-white text-xs font-semibold">
            {getInitials(usuario.nome)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[13px] font-medium truncate">{usuario.nome}</p>
            <p className="text-white/50 text-[11px] truncate">{usuario.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
