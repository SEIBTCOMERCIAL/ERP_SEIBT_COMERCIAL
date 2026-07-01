import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle, CalendarDays, ChevronLeft, ChevronRight,
  Clock, Phone, Mail, MessageSquare, Video, MapPin, AlignLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { TemperaturaBadge } from "@/components/propostas/StatusBadge";

export const metadata: Metadata = { title: "Agenda" };

interface SearchParams { m?: string }

const CANAL_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  whatsapp: { label: "WhatsApp",  Icon: MessageSquare, color: "#16A34A" },
  telefone: { label: "Telefone",  Icon: Phone,         color: "#2074B9" },
  email:    { label: "E-mail",    Icon: Mail,           color: "#7C3AED" },
  visita:   { label: "Visita",    Icon: MapPin,         color: "#D97706" },
  video:    { label: "Vídeo",     Icon: Video,          color: "#0891B2" },
  sms:      { label: "SMS",       Icon: AlignLeft,      color: "#6B7280" },
  outro:    { label: "Outro",     Icon: AlignLeft,      color: "#6B7280" },
};

const MES_NOMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function buildMesParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function prevMes(year: number, month: number): string {
  return month === 1 ? buildMesParam(year - 1, 12) : buildMesParam(year, month - 1);
}

function nextMes(year: number, month: number): string {
  return month === 12 ? buildMesParam(year + 1, 1) : buildMesParam(year, month + 1);
}

export default async function AgendaPage({ searchParams }: { searchParams: SearchParams }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  // Parse mês exibido no calendário
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  if (searchParams.m && /^\d{4}-\d{2}$/.test(searchParams.m)) {
    const [y, m] = searchParams.m.split("-").map(Number);
    year = y; month = m;
  }

  const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastOfMonth  = new Date(year, month, 0).toISOString().split("T")[0];

  // Thresholds para alertas
  const sevenDaysAgo    = new Date(Date.now() - 7  * 86400000).toISOString();
  const fifteenDaysAgo  = new Date(Date.now() - 15 * 86400000).toISOString();
  const sevenDaysAhead  = new Date(Date.now() + 7  * 86400000).toISOString().split("T")[0];

  const [
    { data: hojeFups,  count: hojeCount  },
    { data: semanaFups },
    { data: calFups    },
    { data: alert7     },
    { data: alert15    },
  ] = await Promise.all([
    // Follow-ups agendados para HOJE
    supabase
      .from("followups")
      .select("id, data_contato, canal, motivo, descricao, temperatura, proxima_acao_tipo, proxima_acao_data, proposta_id", { count: "exact" })
      .eq("proxima_acao_data", todayStr)
      .order("criado_em"),

    // Próximos 7 dias (excluindo hoje)
    supabase
      .from("followups")
      .select("id, data_contato, canal, motivo, proxima_acao_data, proxima_acao_tipo, proposta_id")
      .gt("proxima_acao_data", todayStr)
      .lte("proxima_acao_data", sevenDaysAhead)
      .order("proxima_acao_data"),

    // Follow-ups do mês exibido (para calendário)
    supabase
      .from("followups")
      .select("proxima_acao_data")
      .gte("proxima_acao_data", firstOfMonth)
      .lte("proxima_acao_data", lastOfMonth),

    // Alertas: propostas sem movimentação 7-14 dias
    supabase
      .from("propostas")
      .select("id, numero_completo, atualizado_em, responsavel_id, cliente_id")
      .is("deleted_at", null)
      .not("status", "in", '("vendida","perdida","desistencia")')
      .lt("atualizado_em",  sevenDaysAgo)
      .gte("atualizado_em", fifteenDaysAgo)
      .order("atualizado_em")
      .limit(10),

    // Alertas: propostas sem movimentação 15+ dias
    supabase
      .from("propostas")
      .select("id, numero_completo, atualizado_em, responsavel_id, cliente_id")
      .is("deleted_at", null)
      .not("status", "in", '("vendida","perdida","desistencia")')
      .lt("atualizado_em", fifteenDaysAgo)
      .order("atualizado_em")
      .limit(10),
  ]);

  // Busca nomes das propostas relacionadas nos follow-ups
  const allFupPropostaIds = Array.from(new Set([
    ...(hojeFups  ?? []).map((f: { proposta_id: string }) => f.proposta_id),
    ...(semanaFups ?? []).map((f: { proposta_id: string }) => f.proposta_id),
  ].filter(Boolean)));

  const allAlertClienteIds = Array.from(new Set([
    ...(alert7  ?? []).map((p: { cliente_id: string | null }) => p.cliente_id),
    ...(alert15 ?? []).map((p: { cliente_id: string | null }) => p.cliente_id),
  ].filter((id): id is string => !!id)));

  const [{ data: fupPropostasR }, { data: alertClientesR }] = await Promise.all([
    allFupPropostaIds.length
      ? supabase.from("propostas").select("id, numero_completo, cliente_id").in("id", allFupPropostaIds)
      : { data: [] },
    allAlertClienteIds.length
      ? supabase.from("clientes").select("id, razao_social").in("id", allAlertClienteIds)
      : { data: [] },
  ]);

  const propostaMap = new Map<string, { numero_completo: string; cliente_id: string | null }>(
    (fupPropostasR ?? []).map((p: { id: string; numero_completo: string; cliente_id: string | null }) => [p.id, p])
  );
  const clienteMap = new Map<string, string>(
    (alertClientesR ?? []).map((c: { id: string; razao_social: string }) => [c.id, c.razao_social])
  );

  // ── Calendário ──────────────────────────────────────────────────────────
  const diasComAtividade = new Set(
    (calFups ?? [])
      .map((f: { proxima_acao_data: string | null }) => {
        if (!f.proxima_acao_data) return null;
        return parseInt(f.proxima_acao_data.split("-")[2]);
      })
      .filter((d: number | null): d is number => d !== null)
  );

  const firstDate   = new Date(year, month - 1, 1);
  const totalDays   = new Date(year, month, 0).getDate();
  const startDow    = (firstDate.getDay() + 6) % 7; // 0=Mon
  const cells: Array<number | null> = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const todayDay = now.getFullYear() === year && now.getMonth() + 1 === month ? now.getDate() : -1;

  // ── Semana: agrupar por dia ──────────────────────────────────────────────
  const semanaByDay = new Map<string, typeof semanaFups>();
  for (const f of (semanaFups ?? [])) {
    if (!f.proxima_acao_data) continue;
    const day = f.proxima_acao_data as string;
    if (!semanaByDay.has(day)) semanaByDay.set(day, []);
    semanaByDay.get(day)!.push(f);
  }

  const a7  = (alert7  ?? []) as Array<{ id: string; numero_completo: string; atualizado_em: string; cliente_id: string | null }>;
  const a15 = (alert15 ?? []) as Array<{ id: string; numero_completo: string; atualizado_em: string; cliente_id: string | null }>;

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <div className="bg-card border-b border-border px-7 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground">Agenda</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hojeCount != null && hojeCount > 0 && (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-3 py-1">
              <Clock className="h-3 w-3" />
              {hojeCount} hoje
            </span>
          )}
          {(a7.length + a15.length) > 0 && (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
              <AlertTriangle className="h-3 w-3" />
              {a7.length + a15.length} sem movimentação
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

        {/* ── ALERTAS ── */}
        {(a15.length > 0 || a7.length > 0) && (
          <div className="flex flex-col gap-3">
            <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Alertas</p>

            {a15.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-red-200 bg-red-100/60">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                  <p className="text-[12px] font-bold text-red-700">Sem movimentação há 15+ dias ({a15.length})</p>
                </div>
                <div className="divide-y divide-red-200">
                  {a15.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                      <Link href={`/propostas/${p.id}`} className="font-mono text-[12px] font-bold text-red-700 hover:underline shrink-0">
                        {p.numero_completo}
                      </Link>
                      {p.cliente_id && (
                        <span className="text-[12px] text-red-600">{clienteMap.get(p.cliente_id) ?? ""}</span>
                      )}
                      <span className="ml-auto text-[11px] text-red-500">
                        Último contato: {formatDate(p.atualizado_em)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {a7.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200 bg-amber-100/60">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  <p className="text-[12px] font-bold text-amber-700">Sem movimentação há 7-14 dias ({a7.length})</p>
                </div>
                <div className="divide-y divide-amber-200">
                  {a7.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                      <Link href={`/propostas/${p.id}`} className="font-mono text-[12px] font-bold text-amber-700 hover:underline shrink-0">
                        {p.numero_completo}
                      </Link>
                      {p.cliente_id && (
                        <span className="text-[12px] text-amber-700">{clienteMap.get(p.cliente_id) ?? ""}</span>
                      )}
                      <span className="ml-auto text-[11px] text-amber-600">
                        Último contato: {formatDate(p.atualizado_em)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CORPO: lista + calendário ── */}
        <div className="flex gap-5 items-start">

          {/* Coluna esquerda: Hoje + Esta semana */}
          <div className="flex-1 flex flex-col gap-4">

            {/* Hoje */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
                <Clock className="h-3.5 w-3.5 text-[#2074B9]" />
                <p className="text-[13px] font-semibold text-foreground">
                  Hoje
                  {(hojeCount ?? 0) > 0 && (
                    <span className="ml-2 text-[10px] font-bold bg-[#2074B9]/10 text-[#2074B9] border border-[#2074B9]/20 px-1.5 py-0.5 rounded-full">
                      {hojeCount}
                    </span>
                  )}
                </p>
              </div>
              {(hojeFups ?? []).length === 0 ? (
                <p className="px-5 py-6 text-[12px] text-muted-foreground text-center">
                  Nenhuma ação agendada para hoje
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {(hojeFups as Array<{
                    id: string; canal: string; motivo: string | null;
                    descricao: string | null; temperatura: string | null;
                    proxima_acao_tipo: string | null; proposta_id: string;
                  }>).map((f) => {
                    const meta = CANAL_META[f.canal] ?? CANAL_META.outro;
                    const prop = propostaMap.get(f.proposta_id);
                    return (
                      <div key={f.id} className="flex gap-3 px-5 py-3">
                        <div
                          className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                          style={{ backgroundColor: `${meta.color}18` }}
                        >
                          <meta.Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {prop && (
                              <Link href={`/propostas/${f.proposta_id}`} className="font-mono text-[12px] font-bold text-[#2074B9] hover:underline">
                                {prop.numero_completo}
                              </Link>
                            )}
                            {f.proxima_acao_tipo && (
                              <span className="text-[11px] font-semibold text-foreground">{f.proxima_acao_tipo}</span>
                            )}
                            {f.temperatura && <TemperaturaBadge temperatura={f.temperatura} />}
                          </div>
                          {f.motivo && <p className="text-[12px] text-muted-foreground mt-0.5">{f.motivo}</p>}
                          {f.descricao && <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{f.descricao}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Esta semana */}
            {semanaByDay.size > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[13px] font-semibold text-foreground">Próximos 7 dias</p>
                </div>
                <div className="divide-y divide-border">
                  {Array.from(semanaByDay.entries()).map(([day, fups]) => (
                    <div key={day} className="px-5 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                        {new Date(day + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" })}
                      </p>
                      <div className="flex flex-col gap-2">
                        {(fups as Array<{
                          id: string; canal: string; motivo: string | null;
                          proxima_acao_tipo: string | null; proposta_id: string;
                        }>).map((f) => {
                          const meta = CANAL_META[f.canal] ?? CANAL_META.outro;
                          const prop = propostaMap.get(f.proposta_id);
                          return (
                            <div key={f.id} className="flex items-center gap-2.5">
                              <div
                                className="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${meta.color}18` }}
                              >
                                <meta.Icon className="h-3 w-3" style={{ color: meta.color }} />
                              </div>
                              <div className="flex items-center gap-1.5 min-w-0">
                                {prop && (
                                  <Link href={`/propostas/${f.proposta_id}`} className="font-mono text-[12px] font-bold text-[#2074B9] hover:underline shrink-0">
                                    {prop.numero_completo}
                                  </Link>
                                )}
                                {f.proxima_acao_tipo && (
                                  <span className="text-[12px] text-foreground truncate">— {f.proxima_acao_tipo}</span>
                                )}
                                {f.motivo && !f.proxima_acao_tipo && (
                                  <span className="text-[12px] text-muted-foreground truncate">{f.motivo}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Calendário */}
          <div className="w-[288px] shrink-0 bg-card border border-border rounded-xl overflow-hidden">
            {/* Navegação */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <Link
                href={`/agenda?m=${prevMes(year, month)}`}
                className="h-7 w-7 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <p className="text-[13px] font-bold text-foreground">
                {MES_NOMES[month - 1]} {year}
              </p>
              <Link
                href={`/agenda?m=${nextMes(year, month)}`}
                className="h-7 w-7 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Grid */}
            <div className="p-3">
              {/* Cabeçalho dias da semana */}
              <div className="grid grid-cols-7 mb-1">
                {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
                  <div key={i} className="h-8 flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                    {d}
                  </div>
                ))}
              </div>
              {/* Células */}
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((day, i) => {
                  const hasActivity = day !== null && diasComAtividade.has(day);
                  const isToday = day === todayDay;
                  return (
                    <div
                      key={i}
                      className={`h-8 flex flex-col items-center justify-center rounded-lg text-[12px] relative ${
                        day === null ? "" :
                        isToday ? "bg-[#2C4F79] text-white font-bold" :
                        "hover:bg-muted text-foreground cursor-default"
                      }`}
                    >
                      {day !== null && (
                        <>
                          <span>{day}</span>
                          {hasActivity && !isToday && (
                            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#2074B9]" />
                          )}
                          {hasActivity && isToday && (
                            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legenda */}
            <div className="px-4 pb-3 flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#2C4F79] inline-block" />
                Hoje
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2074B9] inline-block" />
                Atividade agendada
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
