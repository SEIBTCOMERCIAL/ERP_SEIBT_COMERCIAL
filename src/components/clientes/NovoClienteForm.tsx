"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { Building2, MapPin, User, Users, Loader2, AlertCircle } from "lucide-react";
import { criarCliente, type ClienteFormState } from "@/app/actions/clientes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const ESTADOS_BR = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

interface Props {
  vendedores: { id: string; nome: string }[];
  representantes: { id: string; nome: string; tipo: string }[];
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  iconClass,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  iconClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border">
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", iconClass)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-foreground">{title}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="px-5 py-4 flex flex-col gap-4">{children}</div>
    </div>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-[11px] text-red-600 mt-0.5">{errors[0]}</p>;
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full bg-[#2C4F79] hover:bg-[#1E3A5F] text-white h-9 text-sm"
    >
      {pending ? (
        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
      ) : (
        "Salvar cliente"
      )}
    </Button>
  );
}

export function NovoClienteForm({ vendedores, representantes }: Props) {
  const [state, action] = useFormState<ClienteFormState, FormData>(criarCliente, {});

  return (
    <form action={action} className="flex flex-1 overflow-hidden">
      {/* Coluna principal */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        {state.message && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <p className="text-sm text-red-700">{state.message}</p>
          </div>
        )}

        {/* Dados da Empresa */}
        <SectionCard
          icon={Building2}
          title="Dados da Empresa"
          subtitle="Informações cadastrais"
          iconClass="bg-blue-50 text-[#2074B9]"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="razao_social" className="text-[12px] font-semibold">
              Razão Social <span className="text-red-500">*</span>
            </Label>
            <Input id="razao_social" name="razao_social" placeholder="Nome completo da empresa" className="h-9 text-sm" />
            <FieldError errors={state.errors?.razao_social} />
          </div>

          <Row>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nome_fantasia" className="text-[12px] font-semibold">Nome Fantasia</Label>
              <Input id="nome_fantasia" name="nome_fantasia" placeholder="Nome fantasia" className="h-9 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cnpj" className="text-[12px] font-semibold">CNPJ</Label>
              <Input id="cnpj" name="cnpj" placeholder="00.000.000/0001-00" className="h-9 text-sm font-mono" />
              <FieldError errors={state.errors?.cnpj} />
            </div>
          </Row>

          <Row>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="segmento" className="text-[12px] font-semibold">
                Segmento <span className="text-red-500">*</span>
              </Label>
              <select id="segmento" name="segmento" className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#2074B9]/30">
                <option value="transformador">Transformador</option>
                <option value="reciclador">Reciclador</option>
                <option value="industria">Indústria</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="porte" className="text-[12px] font-semibold">
                Porte <span className="text-red-500">*</span>
              </Label>
              <select id="porte" name="porte" className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#2074B9]/30">
                <option value="pequeno">Pequeno</option>
                <option value="medio">Médio</option>
                <option value="grande">Grande</option>
              </select>
            </div>
          </Row>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status" className="text-[12px] font-semibold">
              Status <span className="text-red-500">*</span>
            </Label>
            <select id="status" name="status" className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#2074B9]/30 max-w-[200px]">
              <option value="prospect">Prospect</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </SectionCard>

        {/* Localização */}
        <SectionCard
          icon={MapPin}
          title="Localização"
          subtitle="Endereço e região"
          iconClass="bg-green-50 text-green-600"
        >
          <Row>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pais" className="text-[12px] font-semibold">País</Label>
              <Input id="pais" name="pais" defaultValue="Brasil" className="h-9 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="estado" className="text-[12px] font-semibold">Estado (UF)</Label>
              <select id="estado" name="estado" className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#2074B9]/30">
                <option value="">— Selecione —</option>
                {ESTADOS_BR.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          </Row>
          <Row>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cidade" className="text-[12px] font-semibold">Cidade</Label>
              <Input id="cidade" name="cidade" placeholder="Cidade" className="h-9 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="endereco" className="text-[12px] font-semibold">Endereço</Label>
              <Input id="endereco" name="endereco" placeholder="Rua, número, bairro" className="h-9 text-sm" />
            </div>
          </Row>
        </SectionCard>

        {/* Contato Principal */}
        <SectionCard
          icon={User}
          title="Contato Principal"
          subtitle="Pessoa de referência para propostas e PDFs"
          iconClass="bg-purple-50 text-purple-600"
        >
          <Row>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contato_nome" className="text-[12px] font-semibold">Nome</Label>
              <Input id="contato_nome" name="contato_nome" placeholder="Nome completo" className="h-9 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contato_cargo" className="text-[12px] font-semibold">Cargo</Label>
              <Input id="contato_cargo" name="contato_cargo" placeholder="Ex: Gerente de Compras" className="h-9 text-sm" />
            </div>
          </Row>
          <Row>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contato_tratamento" className="text-[12px] font-semibold">Tratamento</Label>
              <select id="contato_tratamento" name="contato_tratamento" className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#2074B9]/30">
                <option value="">— (nenhum) —</option>
                <option value="sr">Sr.</option>
                <option value="sra">Sra.</option>
                <option value="dr">Dr.</option>
                <option value="dra">Dra.</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contato_telefone" className="text-[12px] font-semibold">Telefone</Label>
              <Input id="contato_telefone" name="contato_telefone" placeholder="(00) 00000-0000" className="h-9 text-sm" />
            </div>
          </Row>
          <Row>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contato_email" className="text-[12px] font-semibold">E-mail</Label>
              <Input id="contato_email" name="contato_email" type="email" placeholder="email@empresa.com.br" className="h-9 text-sm" />
              <FieldError errors={state.errors?.contato_email} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contato_whatsapp" className="text-[12px] font-semibold">WhatsApp</Label>
              <Input id="contato_whatsapp" name="contato_whatsapp" placeholder="(00) 00000-0000" className="h-9 text-sm" />
            </div>
          </Row>
        </SectionCard>
      </div>

      {/* Sidebar direita */}
      <div className="w-[300px] shrink-0 border-l border-border bg-card overflow-y-auto p-5 flex flex-col gap-5">
        {/* Responsável */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <p className="text-[13px] font-semibold text-foreground">Responsável</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="responsavel_id" className="text-[12px] font-semibold">Vendedor interno</Label>
            <select id="responsavel_id" name="responsavel_id" className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#2074B9]/30 w-full">
              <option value="">— Sem responsável —</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>{v.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Representante */}
        <div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="representante_id" className="text-[12px] font-semibold">Representante</Label>
            <select id="representante_id" name="representante_id" className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#2074B9]/30 w-full">
              <option value="">— Por região (automático) —</option>
              {representantes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome} {r.tipo === "externo" ? "(ext.)" : "(int.)"}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Deixe vazio para usar o representante da região automaticamente.
            </p>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Ações */}
        <div className="flex flex-col gap-2 mt-auto">
          <SubmitButton />
          <Link href="/clientes">
            <Button type="button" variant="outline" className="w-full h-9 text-sm">
              Cancelar
            </Button>
          </Link>
        </div>
      </div>
    </form>
  );
}
