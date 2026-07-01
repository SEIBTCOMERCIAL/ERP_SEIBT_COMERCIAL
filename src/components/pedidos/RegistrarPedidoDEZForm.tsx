"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Loader2, AlertCircle, Check } from "lucide-react";
import { registrarPedidoDEZ, type PedidoDEZFormState } from "@/app/actions/pedidos";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-50 text-white text-[13px] font-semibold transition-colors"
    >
      {pending ? (
        <><Loader2 className="h-4 w-4 animate-spin" />Registrando...</>
      ) : (
        <><Check className="h-4 w-4" />Confirmar Pedido e Marcar como Vendida</>
      )}
    </button>
  );
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface Props {
  propostaId: string;
  valorProposta: number | null;
}

export function RegistrarPedidoDEZForm({ propostaId, valorProposta }: Props) {
  const [state, action] = useFormState<PedidoDEZFormState, FormData>(registrarPedidoDEZ, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="proposta_id" value={propostaId} />

      {state.message && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-[12px] text-red-700">{state.message}</p>
        </div>
      )}

      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#6B7B8D] mb-3">Dados do pedido DEZ</p>
        <div className="grid grid-cols-2 gap-3">
          {/* Número DEZ */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-[#1A1A1A]">
              Nº Pedido DEZ <span className="text-[#DC2626]">*</span>
            </label>
            <Input
              name="numero_dez"
              placeholder="Ex: 21.089"
              className={cn("h-9 text-[13px] font-mono", state.errors?.numero_dez && "border-red-400")}
            />
            {state.errors?.numero_dez && (
              <p className="text-[11px] text-red-600">{state.errors.numero_dez[0]}</p>
            )}
          </div>

          {/* Data do pedido */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-[#1A1A1A]">Data do pedido DEZ</label>
            <Input
              name="data_pedido_dez"
              type="date"
              defaultValue={new Date().toISOString().split("T")[0]}
              className="h-9 text-[13px]"
            />
          </div>
        </div>

        {/* Valor fechado */}
        <div className="flex flex-col gap-1.5 mt-3">
          <label className="text-[12px] font-semibold text-[#1A1A1A]">
            Valor fechado no DEZ (R$) <span className="text-[#DC2626]">*</span>
          </label>
          <Input
            name="valor_fechado"
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            className={cn("h-9 text-[13px] font-mono", state.errors?.valor_fechado && "border-red-400")}
          />
          {state.errors?.valor_fechado && (
            <p className="text-[11px] text-red-600">{state.errors.valor_fechado[0]}</p>
          )}
        </div>

        {/* Observações */}
        <div className="flex flex-col gap-1.5 mt-3">
          <label className="text-[12px] font-semibold text-[#1A1A1A]">Observações (opcional)</label>
          <textarea
            name="observacoes"
            rows={2}
            placeholder="Notas internas sobre o pedido..."
            className="rounded-lg border-[1.5px] border-[#E2E8F0] bg-white px-3 py-2 text-[13px] text-[#1A1A1A] placeholder:text-[#B0BAC9] outline-none focus:border-[#2074B9] transition-colors resize-none"
          />
        </div>
      </div>

      {/* Comparativo de valores */}
      {valorProposta != null && (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#6B7B8D" strokeWidth="1.8">
              <circle cx="8" cy="8" r="6" /><path d="M8 7v3M8 5.5v.5" />
            </svg>
            <p className="text-[11px] font-semibold text-[#6B7B8D] uppercase tracking-wide">Comparativo de valores</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-[#6B7B8D] uppercase font-semibold tracking-wide">Proposta</p>
              <p className="text-[13px] font-mono font-semibold text-[#1A1A1A] mt-0.5">{formatBRL(valorProposta)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#6B7B8D] uppercase font-semibold tracking-wide">Fechado DEZ</p>
              <p className="text-[13px] font-mono font-semibold text-[#16A34A] mt-0.5" id="dez-valor-preview">—</p>
            </div>
            <div>
              <p className="text-[10px] text-[#6B7B8D] uppercase font-semibold tracking-wide">Diferença</p>
              <p className="text-[13px] font-mono font-semibold mt-0.5" id="dez-diff-preview">—</p>
            </div>
          </div>
        </div>
      )}

      {/* Caixa de confirmação */}
      <div className="flex items-start gap-2.5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3">
        <Check className="h-4 w-4 text-[#2074B9] shrink-0 mt-0.5" />
        <p className="text-[12px] text-[#1D4ED8] leading-relaxed">
          A proposta será marcada como <strong>Vendida</strong> e vinculada ao pedido DEZ informado.
          Esta ação pode ser desfeita por um Admin.
        </p>
      </div>

      <SubmitBtn />

      {/* Script de atualização ao vivo do comparativo */}
      {valorProposta != null && (
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var valorProp = ${valorProposta};
            var inputValor = document.querySelector('input[name="valor_fechado"]');
            var elDez = document.getElementById('dez-valor-preview');
            var elDiff = document.getElementById('dez-diff-preview');
            if (!inputValor || !elDez || !elDiff) return;
            function fmt(v) {
              return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            }
            inputValor.addEventListener('input', function() {
              var v = parseFloat(this.value);
              if (isNaN(v) || v <= 0) { elDez.textContent = '—'; elDiff.textContent = '—'; elDiff.style.color = ''; return; }
              elDez.textContent = fmt(v);
              var diff = v - valorProp;
              elDiff.textContent = diff === 0 ? 'R$ 0,00' : (diff > 0 ? '+' : '') + fmt(diff);
              elDiff.style.color = diff === 0 ? '#16A34A' : diff > 0 ? '#2074B9' : '#DC2626';
            });
          })();
        ` }} />
      )}
    </form>
  );
}
