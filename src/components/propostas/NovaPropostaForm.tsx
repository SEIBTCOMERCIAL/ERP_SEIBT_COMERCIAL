"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import {
  Cpu, Package, Globe, Wrench, Layers, Building2,
  Loader2, AlertCircle, ChevronRight, Check,
  User, DollarSign, FileText, Tag,
} from "lucide-react";
import { criarProposta, type PropostaFormState } from "@/app/actions/propostas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ── Tipos ────────────────────────────────────────────────────────────────────

const TIPOS = [
  { value: "maquina",    label: "Máquina",    Icon: Cpu,       color: "text-[#2074B9] bg-[#EFF6FF]" },
  { value: "sistema",    label: "Sistema",    Icon: Layers,    color: "text-[#7C3AED] bg-[#EDE9FE]" },
  { value: "exportacao", label: "Exportação", Icon: Globe,     color: "text-[#0891B2] bg-[#ECFEFF]" },
  { value: "pecas",      label: "Peças",      Icon: Package,   color: "text-[#D97706] bg-[#FEF3C7]" },
  { value: "servico",    label: "Serviço",    Icon: Wrench,    color: "text-[#16A34A] bg-[#DCFCE7]" },
  { value: "mista",      label: "Mista",      Icon: Building2, color: "text-[#6B7280] bg-[#F1F5F9]" },
] as const;

// ── Submit ────────────────────────────────────────────────────────────────────

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="bg-[#2C4F79] hover:bg-[#1E3A5F] text-white h-9 px-5 text-[13px] font-semibold gap-2"
    >
      {pending ? (
        <><Loader2 className="h-4 w-4 animate-spin" />Criando...</>
      ) : (
        <>Criar proposta<ChevronRight className="h-4 w-4" /></>
      )}
    </Button>
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────────

const STEPS = ["Tipo e Cliente", "Itens", "Condições", "Revisão"];

function Stepper() {
  const active = 0; // step 1 = index 0, sempre no modo criação
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => {
        const done   = i < active;
        const isActive = i === active;
        return (
          <div key={i} className="flex items-center">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium",
              isActive ? "text-[#2C4F79] font-semibold" : "text-[#6B7B8D]"
            )}>
              <span className={cn(
                "w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-bold border-2 shrink-0",
                done    ? "bg-[#16A34A] border-[#16A34A] text-white" :
                isActive ? "bg-[#2C4F79] border-[#2C4F79] text-white" :
                           "border-[#E2E8F0] bg-white text-[#6B7B8D]"
              )}>
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {label}
            </div>
            {i < STEPS.length - 1 && (
              <span className={cn("w-6 h-px", done ? "bg-[#16A34A]" : "bg-[#E2E8F0]")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Section header with colored icon ─────────────────────────────────────────

function SectionHeader({
  icon: Icon, label, subtitle, iconClass,
}: {
  icon: React.ElementType;
  label: string;
  subtitle?: string;
  iconClass: string;
}) {
  return (
    <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-3">
      <span className={cn(
        "w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0",
        iconClass
      )}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div>
        <p className="text-[13px] font-semibold text-[#1A1A1A]">{label}</p>
        {subtitle && <p className="text-[11px] text-[#6B7B8D] mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  clientes: Array<{ id: string; razao_social: string }>;
  vendedores: Array<{ id: string; nome: string }>;
  representantes: Array<{ id: string; nome: string }>;
  etapas: Array<{ id: string; nome: string; cor: string }>;
  clientePreSelecionado?: string | null;
  usuarioId: string;
}

export function NovaPropostaForm({
  clientes, vendedores, representantes, etapas, clientePreSelecionado, usuarioId,
}: Props) {
  const [state, action] = useFormState<PropostaFormState, FormData>(criarProposta, {});

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ── Stepper bar ── */}
      <div className="bg-white border-b border-[#E2E8F0] px-7 py-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-[17px] font-bold text-[#1A1A1A] tracking-tight">Nova Proposta</h1>
          <span className="text-[12px] text-[#6B7B8D] bg-[#F8FAFC] border border-[#E2E8F0] rounded-md px-2.5 py-0.5">
            Rascunho
          </span>
        </div>
        <Stepper />
        <div className="flex items-center gap-2">
          <Link href="/propostas">
            <button type="button" className="flex items-center gap-1.5 h-9 px-3.5 bg-white border-[1.5px] border-[#E2E8F0] rounded-lg text-[13px] font-medium text-[#1A1A1A] hover:border-[#CBD5E1] transition-colors">
              Cancelar
            </button>
          </Link>
        </div>
      </div>

      {/* ── Corpo do form ── */}
      <form action={action} className="flex flex-1 overflow-hidden min-h-0">
        {/* Coluna principal */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 bg-[#F8FAFC]">
          {state.message && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <p className="text-[13px] text-red-700">{state.message}</p>
            </div>
          )}

          {/* Tipo de proposta */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
            <SectionHeader
              icon={Tag}
              label="Tipo de proposta"
              subtitle="Selecione a categoria principal"
              iconClass="bg-[#EDE9FE] text-[#7C3AED]"
            />
            <div className="px-5 py-4 grid grid-cols-3 gap-3">
              {TIPOS.map(({ value, label, Icon, color }) => (
                <label key={value} className="cursor-pointer">
                  <input type="radio" name="tipo" value={value} className="sr-only peer" required />
                  <div className={cn(
                    "flex flex-col items-center gap-2.5 rounded-xl border-2 border-[#E2E8F0] p-4",
                    "text-center transition-all hover:border-[#2074B9]/30",
                    "peer-checked:border-[#2074B9] peer-checked:bg-[#EFF6FF]/60"
                  )}>
                    <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", color)}>
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="text-[12px] font-semibold text-[#1A1A1A]">{label}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Cliente */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
            <SectionHeader
              icon={User}
              label="Cliente"
              subtitle="Selecione o cliente ou preencha um contato avulso"
              iconClass="bg-[#DCFCE7] text-[#16A34A]"
            />
            <div className="px-5 py-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12px] font-semibold text-[#1A1A1A]">Cliente cadastrado</Label>
                <select
                  name="cliente_id"
                  defaultValue={clientePreSelecionado ?? ""}
                  className="h-9 w-full rounded-lg border-[1.5px] border-[#E2E8F0] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none focus:border-[#2074B9] transition-colors"
                >
                  <option value="">— Sem cliente vinculado —</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-semibold text-[#1A1A1A]">Nome do contato</Label>
                  <Input name="contato_nome" placeholder="Nome" className="h-9 text-[13px]" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-semibold text-[#1A1A1A]">E-mail</Label>
                  <Input name="contato_email" type="email" placeholder="email@empresa.com.br" className="h-9 text-[13px]" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-semibold text-[#1A1A1A]">Telefone</Label>
                  <Input name="contato_telefone" placeholder="(00) 00000-0000" className="h-9 text-[13px]" />
                </div>
              </div>
            </div>
          </div>

          {/* Condições comerciais */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
            <SectionHeader
              icon={DollarSign}
              label="Condições comerciais"
              subtitle="Moeda, pagamento, prazo e validade"
              iconClass="bg-[#FEF3C7] text-[#D97706]"
            />
            <div className="px-5 py-4 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Moeda: toggle segmentado como no wireframe */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-semibold text-[#1A1A1A]">Moeda</Label>
                  <div className="flex border-[1.5px] border-[#E2E8F0] rounded-lg overflow-hidden h-9">
                    <label className="flex-1 cursor-pointer">
                      <input type="radio" name="moeda" value="BRL" defaultChecked className="sr-only peer" />
                      <span className="flex h-full items-center justify-center text-[12px] font-semibold transition-colors peer-checked:bg-[#2C4F79] peer-checked:text-white text-[#6B7B8D] hover:bg-[#F8FAFC]">
                        R$
                      </span>
                    </label>
                    <label className="flex-1 cursor-pointer border-l border-[#E2E8F0]">
                      <input type="radio" name="moeda" value="USD" className="sr-only peer" />
                      <span className="flex h-full items-center justify-center text-[12px] font-semibold transition-colors peer-checked:bg-[#2C4F79] peer-checked:text-white text-[#6B7B8D] hover:bg-[#F8FAFC]">
                        USD
                      </span>
                    </label>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-semibold text-[#1A1A1A]">Canal de origem</Label>
                  <select name="canal_origem" className="h-9 rounded-lg border-[1.5px] border-[#E2E8F0] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none focus:border-[#2074B9] transition-colors">
                    <option value="">— Selecione —</option>
                    {[
                      ["whatsapp","WhatsApp"], ["email","E-mail"], ["feira","Feira"],
                      ["site","Site"], ["indicacao","Indicação"], ["telefone","Telefone"],
                      ["recorrencia","Recorrência"], ["outro","Outro"],
                    ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-semibold text-[#1A1A1A]">Condição de pagamento</Label>
                  <Input name="condicao_pagamento" placeholder="Ex: 30/60/90 dias" className="h-9 text-[13px]" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-semibold text-[#1A1A1A]">Prazo de entrega</Label>
                  <Input name="prazo_entrega" placeholder="Ex: 90 dias úteis" className="h-9 text-[13px]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-semibold text-[#1A1A1A]">Validade da proposta</Label>
                  <Input name="validade_proposta" type="date" className="h-9 text-[13px]" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12px] font-semibold text-[#1A1A1A]">Observações</Label>
                <textarea
                  name="observacoes"
                  rows={3}
                  placeholder="Observações internas..."
                  className="rounded-lg border-[1.5px] border-[#E2E8F0] bg-white px-3 py-2 text-[13px] text-[#1A1A1A] placeholder:text-[#B0BAC9] outline-none focus:border-[#2074B9] transition-colors resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Sidebar 320px ── */}
        <div className="w-[320px] shrink-0 border-l border-[#E2E8F0] bg-white overflow-y-auto p-5 flex flex-col gap-5">

          {/* Prévia */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#6B7B8D] mb-2.5">Prévia da proposta</p>
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
              <p className="text-[22px] font-bold text-[#2C4F79] font-mono leading-none">—/2026</p>
              <p className="text-[11px] text-[#6B7B8D] mt-1">Rascunho · nova proposta</p>
              <span className="mt-2 inline-block text-[12px] font-semibold text-[#7C3AED] bg-[#EDE9FE] px-2 py-0.5 rounded-md">
                Tipo selecionado
              </span>
            </div>
          </div>

          <div className="h-px bg-[#E2E8F0]" />

          {/* Etapa */}
          {etapas.length > 0 && (
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#6B7B8D] mb-2.5 block">
                Etapa do funil
              </Label>
              <select
                name="etapa_funil_id"
                className="h-9 w-full rounded-lg border-[1.5px] border-[#E2E8F0] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none focus:border-[#2074B9] transition-colors"
              >
                <option value="">— Sem etapa —</option>
                {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
          )}

          <div className="h-px bg-[#E2E8F0]" />

          {/* Responsável */}
          <div>
            <Label className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#6B7B8D] mb-2.5 block">
              Responsável
            </Label>
            <select
              name="responsavel_id"
              defaultValue={usuarioId}
              className="h-9 w-full rounded-lg border-[1.5px] border-[#E2E8F0] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none focus:border-[#2074B9] transition-colors"
            >
              {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
          </div>

          {representantes.length > 0 && (
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#6B7B8D] mb-2.5 block">
                Representante
              </Label>
              <select
                name="representante_id"
                className="h-9 w-full rounded-lg border-[1.5px] border-[#E2E8F0] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none focus:border-[#2074B9] transition-colors"
              >
                <option value="">— Por região —</option>
                {representantes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
          )}

          <div className="h-px bg-[#E2E8F0]" />

          {/* Ações */}
          <div className="flex flex-col gap-2">
            <SubmitBtn />
            <Link href="/propostas">
              <button type="button" className="w-full h-9 rounded-lg border-[1.5px] border-[#E2E8F0] bg-white text-[13px] font-medium text-[#1A1A1A] hover:border-[#CBD5E1] transition-colors">
                Cancelar
              </button>
            </Link>
          </div>

          {/* Info */}
          <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3.5">
            <div className="flex items-start gap-2">
              <FileText className="h-3.5 w-3.5 text-[#2074B9] mt-0.5 shrink-0" />
              <p className="text-[11px] text-[#1D4ED8] leading-relaxed">
                A proposta é criada como <strong>Rascunho</strong>. Adicione itens e gere o PDF quando estiver pronta para envio.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
