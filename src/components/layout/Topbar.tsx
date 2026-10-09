"use client";

import { Menu, Search, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notificacoes/NotificationBell";

interface TopbarProps {
  className?: string;
  /** Telas menores: abre o menu lateral. */
  onAbrirMenu?: () => void;
}

export function Topbar({ className, onAbrirMenu }: TopbarProps) {
  const { theme, setTheme } = useTheme();

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-background px-3 sm:px-6",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
      {/* Menu (telas menores) */}
      {onAbrirMenu && (
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 lg:hidden" onClick={onAbrirMenu} title="Abrir menu">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Abrir menu</span>
        </Button>
      )}

      {/* Busca universal */}
      <button
        className="flex h-9 w-9 items-center justify-center gap-2 rounded-lg border border-border bg-muted/50 text-sm text-muted-foreground transition-colors hover:bg-muted sm:w-64 sm:justify-start sm:px-3"
        onClick={() => {
          // TODO: Fase 1 — abre Ctrl+K (implementar em Fase 2)
        }}
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden flex-1 text-left sm:inline">Buscar...</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-background px-1.5 text-[10px] font-medium text-muted-foreground">
          <span>⌘</span>K
        </kbd>
      </button>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1">
        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={theme === "dark" ? "Modo claro" : "Modo escuro"}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Alternar tema</span>
        </Button>

        {/* Notificações */}
        <NotificationBell />
      </div>
    </header>
  );
}
