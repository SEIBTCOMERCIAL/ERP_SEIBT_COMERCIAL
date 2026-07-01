import type { Perfil } from "@/types/database";

export interface NavItem {
  label: string;
  href: string;
  icon: string; // nome do ícone Lucide
  badge?: number;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  // undefined = visível para todos os perfis autenticados
  visibleFor?: Perfil[];
  requiresConfig?: boolean; // somente pode_configurar = true
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "INÍCIO",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
    ],
  },
  {
    label: "VENDAS",
    items: [
      { label: "Propostas", href: "/propostas", icon: "FileText" },
      { label: "Clientes", href: "/clientes", icon: "Building2" },
      { label: "Agenda", href: "/agenda", icon: "CalendarDays" },
      { label: "Leads", href: "/leads", icon: "UserPlus" },
    ],
  },
  {
    label: "CATÁLOGO",
    items: [
      { label: "Produtos",          href: "/produtos",                    icon: "Package" },
      { label: "Preços",            href: "/precos",                      icon: "Tag" },
      { label: "Proposta Peças",    href: "/propostas/pecas/nova",        icon: "Wrench" },
      { label: "Proposta Máquina",  href: "/propostas/maquinas/nova",     icon: "Settings" },
    ],
  },
  {
    label: "GESTÃO",
    visibleFor: ["admin"],
    items: [
      { label: "Pedidos DEZ",     href: "/pedidos/reconciliar", icon: "ClipboardCheck" },
      { label: "Metas",           href: "/metas",               icon: "Target" },
      { label: "Relatórios",      href: "/relatorios",          icon: "BarChart3" },
      { label: "Representantes",  href: "/representantes",      icon: "UserCheck" },
      { label: "Frete",           href: "/frete",               icon: "Truck" },
    ],
  },
  {
    label: "ENGENHARIA",
    visibleFor: ["admin", "engenharia"],
    items: [
      { label: "Precificação",  href: "/precificacao", icon: "Zap" },
    ],
  },
  {
    label: "SISTEMA",
    visibleFor: ["admin"],
    requiresConfig: true,
    items: [
      { label: "Usuários", href: "/usuarios", icon: "Users" },
      { label: "Configurações", href: "/configuracoes", icon: "Settings" },
      { label: "Auditoria", href: "/auditoria", icon: "Shield" },
    ],
  },
];
