"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Download, Eye, FileSpreadsheet, FileText, Image as ImageIcon, Loader2, Paperclip, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { excluirAnexo, iniciarUploadAnexo, registrarAnexo } from "@/app/actions/propostas-anexos";
import { formatDateTime } from "@/lib/utils";

export const CATEGORIAS_ANEXO = [
  { value: "pedido_pdf", label: "PDF do pedido" },
  { value: "proposta_externa", label: "Proposta externa" },
  { value: "demonstrativo", label: "Demonstrativo" },
  { value: "foto", label: "Foto" },
  { value: "desenho", label: "Desenho" },
  { value: "documento_tecnico", label: "Documento técnico" },
  { value: "planilha", label: "Planilha" },
  { value: "outro", label: "Outro" },
] as const;

export interface AnexoView {
  id: string;
  categoria: string;
  nome: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  criado_em: string;
  enviado_por_nome: string | null;
  /** Link temporário para ver o arquivo (null se não foi possível gerar). */
  url: string | null;
  podeExcluir: boolean;
}

function tamanhoLegivel(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const ehImagem = (a: { mime_type: string | null; nome: string }) =>
  Boolean(a.mime_type?.startsWith("image/")) || /\.(jpe?g|png|gif|webp|bmp|heic)$/i.test(a.nome);
const ehPdf = (a: { mime_type: string | null; nome: string }) => a.mime_type === "application/pdf" || /\.pdf$/i.test(a.nome);
const ehPlanilha = (a: { nome: string }) => /\.(xlsx?|csv|ods)$/i.test(a.nome);

function categoriaSugerida(file: File) {
  if (file.type.startsWith("image/")) return "foto";
  if (/\.(xlsx?|csv|ods)$/i.test(file.name)) return "planilha";
  if (/\.(dwg|dxf|step|stp)$/i.test(file.name)) return "desenho";
  return "outro";
}

function linkDownload(url: string, nome: string) {
  return `${url}${url.includes("?") ? "&" : "?"}download=${encodeURIComponent(nome)}`;
}

type ItemEnvio = { nome: string; estado: "enviando" | "ok" | "erro"; mensagem?: string };

export function AnexosProposta({
  propostaId, anexos, disponivel,
}: { propostaId: string; anexos: AnexoView[]; disponivel: boolean }) {
  const router = useRouter();
  const entradaArquivo = useRef<HTMLInputElement>(null);
  const entradaCamera = useRef<HTMLInputElement>(null);
  const [categoria, setCategoria] = useState<string>("");
  const [envios, setEnvios] = useState<ItemEnvio[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ampliada, setAmpliada] = useState<AnexoView | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  async function enviar(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setAviso(null);
    const lista = Array.from(arquivos);
    setEnvios(lista.map((f) => ({ nome: f.name, estado: "enviando" as const })));
    const supabase = createClient();
    for (let i = 0; i < lista.length; i++) {
      const file = lista[i];
      const atualiza = (parcial: Partial<ItemEnvio>) => setEnvios((e) => e.map((x, idx) => (idx === i ? { ...x, ...parcial } : x)));
      const auth = await iniciarUploadAnexo(propostaId, file.name, file.size);
      if (auth.error || !auth.path || !auth.token) { atualiza({ estado: "erro", mensagem: auth.error }); continue; }
      const { error: errUpload } = await supabase.storage.from("proposta-anexos").uploadToSignedUrl(auth.path, auth.token, file, { contentType: file.type || undefined });
      if (errUpload) { atualiza({ estado: "erro", mensagem: "Falha no envio: " + errUpload.message }); continue; }
      const reg = await registrarAnexo({
        propostaId, categoria: categoria || categoriaSugerida(file), nome: file.name,
        mimeType: file.type, tamanho: file.size, path: auth.path,
      });
      if (reg.error) atualiza({ estado: "erro", mensagem: reg.error });
      else atualiza({ estado: "ok" });
    }
    if (entradaArquivo.current) entradaArquivo.current.value = "";
    if (entradaCamera.current) entradaCamera.current.value = "";
    router.refresh();
  }

  async function remover(a: AnexoView) {
    if (!window.confirm(`Excluir o arquivo "${a.nome}"?`)) return;
    setExcluindo(a.id);
    const r = await excluirAnexo(a.id);
    setExcluindo(null);
    if (r.error) setAviso(r.error);
    else router.refresh();
  }

  if (!disponivel) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
        Os anexos ficam disponíveis depois da atualização do banco de dados do CRM (arquivo 024).
      </p>
    );
  }

  const fotos = anexos.filter((a) => ehImagem(a) && a.url);
  const outros = anexos.filter((a) => !(ehImagem(a) && a.url));
  const enviando = envios.some((e) => e.estado === "enviando");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:w-56">Tipo do documento
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-[13px] font-normal normal-case tracking-normal text-foreground outline-none focus:border-[#2074B9]">
            <option value="">Detectar automaticamente</option>
            {CATEGORIAS_ANEXO.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <div className="flex flex-1 gap-2">
          <button type="button" disabled={enviando} onClick={() => entradaArquivo.current?.click()} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#2C4F79] px-4 text-[13px] font-semibold text-white hover:bg-[#1E3A5F] disabled:opacity-60 sm:flex-none">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}Anexar arquivos
          </button>
          <button type="button" disabled={enviando} onClick={() => entradaCamera.current?.click()} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 text-[13px] font-medium disabled:opacity-60 sm:flex-none">
            <Camera className="h-4 w-4" />Tirar foto
          </button>
        </div>
        <input ref={entradaArquivo} type="file" multiple className="hidden" onChange={(e) => enviar(e.target.files)} />
        <input ref={entradaCamera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => enviar(e.target.files)} />
      </div>
      <p className="text-[11px] text-muted-foreground">Até 50 MB por arquivo. PDF, fotos, desenhos, planilhas e documentos técnicos.</p>

      {aviso && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-[12px] text-red-700">{aviso}</p>}
      {envios.length > 0 && (
        <ul className="flex flex-col gap-1 text-[12px]">
          {envios.map((e, i) => (
            <li key={i} className={e.estado === "erro" ? "text-red-700" : e.estado === "ok" ? "text-green-700" : "text-muted-foreground"}>
              {e.estado === "enviando" ? "Enviando" : e.estado === "ok" ? "Enviado" : "Não enviado"}: {e.nome}{e.mensagem ? ` — ${e.mensagem}` : ""}
            </li>
          ))}
        </ul>
      )}

      {fotos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {fotos.map((a) => (
            <div key={a.id} className="group relative overflow-hidden rounded-lg border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <button type="button" onClick={() => setAmpliada(a)} className="block aspect-square w-full"><img src={a.url!} alt={a.nome} loading="lazy" className="h-full w-full object-cover" /></button>
              <div className="flex items-center justify-between gap-1 bg-card px-2 py-1.5">
                <span className="truncate text-[11px] text-foreground" title={a.nome}>{a.nome}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <a href={linkDownload(a.url!, a.nome)} className="text-muted-foreground hover:text-[#2074B9]" aria-label="Baixar"><Download className="h-3.5 w-3.5" /></a>
                  {a.podeExcluir && <button type="button" disabled={excluindo === a.id} onClick={() => remover(a)} className="text-muted-foreground hover:text-red-600" aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {outros.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {outros.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                {ehPlanilha(a) ? <FileSpreadsheet className="h-4 w-4" /> : ehImagem(a) ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground" title={a.nome}>{a.nome}</p>
                <p className="text-[11px] text-muted-foreground">
                  {CATEGORIAS_ANEXO.find((c) => c.value === a.categoria)?.label ?? a.categoria} · {tamanhoLegivel(a.tamanho_bytes)} · {formatDateTime(a.criado_em)}{a.enviado_por_nome ? ` · ${a.enviado_por_nome}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {a.url && ehPdf(a) && <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[12px] font-medium hover:border-[#2074B9]"><Eye className="h-3.5 w-3.5" />Ver</a>}
                {a.url && <a href={linkDownload(a.url, a.nome)} className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[12px] font-medium hover:border-[#2074B9]"><Download className="h-3.5 w-3.5" />Baixar</a>}
                {a.podeExcluir && <button type="button" disabled={excluindo === a.id} onClick={() => remover(a)} className="flex h-8 items-center rounded-lg border border-border px-2 text-muted-foreground hover:border-red-300 hover:text-red-600 disabled:opacity-50" aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!anexos.length && !envios.length && <p className="py-4 text-center text-[12px] text-muted-foreground">Nenhum arquivo anexado ainda</p>}

      {ampliada?.url && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-black/85 p-3 sm:p-6" onClick={() => setAmpliada(null)}>
          <div className="mb-2 flex items-center justify-between gap-3 text-white">
            <p className="truncate text-[13px]">{ampliada.nome}</p>
            <div className="flex items-center gap-3">
              <a href={linkDownload(ampliada.url, ampliada.nome)} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-[12px] underline"><Download className="h-4 w-4" />Baixar</a>
              <button type="button" onClick={() => setAmpliada(null)} aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ampliada.url} alt={ampliada.nome} onClick={(e) => e.stopPropagation()} className="m-auto max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}
