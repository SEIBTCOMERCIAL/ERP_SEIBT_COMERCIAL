import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Login",
};

// Stats estáticos para o painel esquerdo (substituir por dados reais em Fase 2)
const STATS = [
  { label: "Propostas abertas", value: "—" },
  { label: "Fechamentos este mês", value: "—" },
  { label: "Pipeline ativo", value: "—" },
];

export default function LoginPage() {
  return (
    <main className="flex min-h-screen">
      {/* Painel esquerdo — navy brand */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-10 bg-[#2C4F79]">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white font-bold text-lg">
            S
          </div>
          <div>
            <p className="text-white font-semibold text-base leading-none">SEIBT</p>
            <p className="text-white/60 text-[11px] leading-none mt-0.5">Máquinas para Plásticos</p>
          </div>
        </div>

        {/* Descrição */}
        <div>
          <h1 className="text-white text-3xl font-bold leading-snug mb-4">
            ERP Comercial
          </h1>
          <p className="text-white/65 text-[15px] leading-relaxed max-w-sm">
            Plataforma centralizada para gestão de propostas, clientes e pipeline comercial.
          </p>

          {/* Stats */}
          <div className="mt-10 grid grid-cols-3 gap-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="rounded-xl bg-white/8 px-4 py-3">
                <p className="text-white text-xl font-bold">{stat.value}</p>
                <p className="text-white/55 text-[11px] mt-0.5 leading-tight">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé */}
        <p className="text-white/30 text-xs">
          © {new Date().getFullYear()} SEIBT Máquinas para Plásticos
        </p>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-[400px]">
          {/* Logo mobile */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2C4F79] text-white font-bold text-sm">
              S
            </div>
            <span className="text-foreground font-semibold text-base">SEIBT ERP</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              Bem-vindo de volta
            </h2>
            <p className="text-muted-foreground text-sm mt-1.5">
              Acesse sua conta para continuar.
            </p>
          </div>

          <LoginForm />

          <p className="mt-8 text-center text-xs text-muted-foreground">
            ERP Comercial SEIBT · v1.0
          </p>
        </div>
      </div>
    </main>
  );
}
