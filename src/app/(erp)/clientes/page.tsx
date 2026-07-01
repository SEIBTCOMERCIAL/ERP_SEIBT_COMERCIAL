import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Building2, Search, Eye, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCNPJ, getInitials } from "@/lib/utils";
import { StatusClienteBadge, SegmentoBadge, ClassBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Clientes" };

interface SearchParams {
  q?: string;
  status?: string;
  segmento?: string;
  porte?: string;
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  // KPIs
  const [{ count: total }, { count: ativos }, { count: prospects }, { count: inativos }] =
    await Promise.all([
      supabase.from("clientes").select("*", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("clientes").select("*", { count: "exact", head: true }).is("deleted_at", null).eq("status", "ativo"),
      supabase.from("clientes").select("*", { count: "exact", head: true }).is("deleted_at", null).eq("status", "prospect"),
      supabase.from("clientes").select("*", { count: "exact", head: true }).is("deleted_at", null).eq("status", "inativo"),
    ]);

  // Listagem com filtros
  let query = supabase
    .from("clientes")
    .select("id, razao_social, nome_fantasia, cnpj, segmento, porte, status, estado, cidade, pais, responsavel_id, atualizado_em")
    .is("deleted_at", null)
    .order("atualizado_em", { ascending: false })
    .limit(50);

  if (searchParams.q) {
    query = query.or(
      `razao_social.ilike.%${searchParams.q}%,nome_fantasia.ilike.%${searchParams.q}%,cnpj.ilike.%${searchParams.q}%`
    );
  }
  if (searchParams.status)   query = query.eq("status", searchParams.status);
  if (searchParams.segmento) query = query.eq("segmento", searchParams.segmento);
  if (searchParams.porte)    query = query.eq("porte", searchParams.porte);

  const { data: clientesRaw } = await query;
  const clientes = (clientesRaw ?? []) as unknown as Array<{
    id: string;
    razao_social: string;
    nome_fantasia: string | null;
    cnpj: string | null;
    segmento: string;
    porte: string;
    status: string;
    estado: string | null;
    cidade: string | null;
    pais: string;
    responsavel_id: string | null;
    atualizado_em: string;
  }>;

  const clienteIds = clientes.map((c) => c.id);

  // Responsáveis e contagem de máquinas em paralelo
  const responsavelIds = Array.from(new Set(clientes.map((c) => c.responsavel_id).filter((id): id is string => !!id)));
  const [responsaveisResult, maquinasResult] = await Promise.all([
    responsavelIds.length
      ? supabase.from("usuarios").select("id, nome").in("id", responsavelIds)
      : Promise.resolve({ data: [] }),
    clienteIds.length
      ? supabase.from("maquinas_cliente").select("cliente_id").in("cliente_id", clienteIds)
      : Promise.resolve({ data: [] }),
  ]);

  const responsaveis = new Map<string, string>(
    ((responsaveisResult.data ?? []) as Array<{ id: string; nome: string }>).map((u) => [u.id, u.nome])
  );
  const maquinasPorCliente = new Map<string, number>();
  ((maquinasResult.data ?? []) as Array<{ cliente_id: string }>).forEach((m) => {
    maquinasPorCliente.set(m.cliente_id, (maquinasPorCliente.get(m.cliente_id) ?? 0) + 1);
  });

  const avatarColors = [
    "bg-[#2C4F79]", "bg-[#2074B9]", "bg-[#7C3AED]",
    "bg-[#16A34A]", "bg-[#D97706]", "bg-[#DC2626]",
  ];

  return (
    <div className="p-6 flex flex-col gap-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total ?? 0} cadastrados</p>
        </div>
        <Link href="/clientes/novo">
          <Button className="bg-[#2C4F79] hover:bg-[#1E3A5F] text-white h-9 text-sm gap-1.5">
            <Plus className="h-4 w-4" />
            Novo Cliente
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3.5">
        {[
          { label: "Total",     value: total ?? 0,     sub: "cadastrados" },
          { label: "Ativos",    value: ativos ?? 0,    sub: "com proposta recente",     color: "text-[#16A34A]" },
          { label: "Prospects", value: prospects ?? 0, sub: "em prospecção",            color: "text-[#D97706]" },
          { label: "Inativos",  value: inativos ?? 0,  sub: "+24 meses sem pedido",     color: "text-[#6B7B8D]" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              {kpi.label}
            </p>
            <p className={`text-2xl font-bold tracking-tight ${kpi.color ?? "text-foreground"}`}>
              {kpi.value}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <form method="get" className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5 flex-wrap">
        <span className="text-[12px] font-semibold text-muted-foreground shrink-0">Filtrar:</span>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            name="q"
            defaultValue={searchParams.q}
            placeholder="Nome ou CNPJ..."
            className="h-8 rounded-lg border border-border bg-background pl-7 pr-3 text-[12px] text-foreground placeholder:text-muted-foreground outline-none focus:border-[#2074B9] w-52 transition-colors"
          />
        </div>

        <select name="status" defaultValue={searchParams.status ?? ""} className="h-8 rounded-lg border border-border bg-background px-2.5 text-[12px] text-foreground outline-none focus:border-[#2074B9] transition-colors">
          <option value="">Todos os status</option>
          <option value="prospect">Prospect</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </select>

        <select name="segmento" defaultValue={searchParams.segmento ?? ""} className="h-8 rounded-lg border border-border bg-background px-2.5 text-[12px] text-foreground outline-none focus:border-[#2074B9] transition-colors">
          <option value="">Todos os segmentos</option>
          <option value="transformador">Transformador</option>
          <option value="reciclador">Reciclador</option>
          <option value="industria">Indústria</option>
          <option value="outro">Outro</option>
        </select>

        <select name="porte" defaultValue={searchParams.porte ?? ""} className="h-8 rounded-lg border border-border bg-background px-2.5 text-[12px] text-foreground outline-none focus:border-[#2074B9] transition-colors">
          <option value="">Todos os portes</option>
          <option value="grande">Grande (A)</option>
          <option value="medio">Médio (B)</option>
          <option value="pequeno">Pequeno (C)</option>
        </select>

        <button type="submit" className="h-8 px-3 rounded-lg bg-[#2C4F79] text-white text-[12px] font-medium hover:bg-[#1E3A5F] transition-colors">
          Filtrar
        </button>
        {(searchParams.q || searchParams.status || searchParams.segmento || searchParams.porte) && (
          <Link href="/clientes" className="h-8 px-3 rounded-lg border border-border bg-card text-[12px] text-muted-foreground hover:text-foreground flex items-center transition-colors">
            Limpar
          </Link>
        )}
      </form>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted/40">
              <th className="px-4 py-2.5 w-9">
                <input type="checkbox" className="w-[14px] h-[14px] accent-[#2C4F79]" />
              </th>
              {["Empresa", "Segmento", "Cidade / UF", "Responsável", "Status", "Class.", "Máquinas"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border whitespace-nowrap">
                  {h}
                </th>
              ))}
              <th className="px-4 py-2.5 border-b border-border w-20" />
            </tr>
          </thead>
          <tbody>
            {!clientes?.length ? (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  <Building2 className="h-8 w-8 mx-auto mb-3 opacity-20" />
                  Nenhum cliente encontrado
                </td>
              </tr>
            ) : (
              clientes.map((c, i) => {
                const initials = getInitials(c.razao_social);
                const color = avatarColors[i % avatarColors.length];
                const responsavelNome = c.responsavel_id ? responsaveis.get(c.responsavel_id) : null;
                const cidadeUF = [c.cidade, c.estado].filter(Boolean).join(" · ") || c.pais;
                const numMaquinas = maquinasPorCliente.get(c.id) ?? 0;

                return (
                  <tr
                    key={c.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <input type="checkbox" className="w-[14px] h-[14px] accent-[#2C4F79]" />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/clientes/${c.id}`} className="flex items-center gap-3">
                        <div className={`h-8 w-8 shrink-0 rounded-lg ${color} flex items-center justify-center text-[11px] font-bold text-white`}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-foreground truncate max-w-[200px]">
                            {c.razao_social}
                          </p>
                          {c.cnpj && (
                            <p className="text-[11px] text-muted-foreground font-mono">
                              {formatCNPJ(c.cnpj)}
                            </p>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <SegmentoBadge segmento={c.segmento} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] text-muted-foreground">{cidadeUF || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] text-foreground">{responsavelNome ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusClienteBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3">
                      <ClassBadge porte={c.porte} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] text-muted-foreground">
                        {numMaquinas > 0 ? `${numMaquinas} máquina${numMaquinas > 1 ? "s" : ""}` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/clientes/${c.id}`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-white hover:bg-muted/40 transition-colors"
                          title="Ver cliente"
                        >
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        </Link>
                        <Link
                          href={`/propostas/nova?cliente_id=${c.id}`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-white hover:bg-muted/40 transition-colors"
                          title="Nova proposta"
                        >
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {(clientes?.length ?? 0) > 0 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <p className="text-[12px] text-muted-foreground">
              Mostrando {clientes?.length} de {total} clientes
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
