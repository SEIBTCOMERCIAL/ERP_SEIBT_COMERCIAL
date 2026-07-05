import { createClient } from "@/lib/supabase/server";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
} from "docx";

const A4_W = 11906;
const MARGIN = 720;
const CW = A4_W - MARGIN * 2;

const NAVY = "2C4F79";
const HDR_BG = "DBE5F1";
const LIGHT_BG = "F8FAFC";

const border = { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" };
const borders = { top: border, bottom: border, left: border, right: border };

const fmt = (v: number | null | undefined) =>
  v != null
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

function hdrCell(text: string, widthDxa: number): TableCell {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders,
    shading: { fill: HDR_BG, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: 18, font: "Calibri", color: NAVY })],
    })],
  });
}

function dataCell(text: string, widthDxa: number, opts: { bold?: boolean; center?: boolean; bg?: string } = {}): TableCell {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders,
    shading: { fill: opts.bg ?? "FFFFFF", type: ShadingType.CLEAR },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text, bold: opts.bold ?? false, size: 18, font: "Calibri" })],
    })],
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function GET(_req: Request, { params }: { params: any }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Não autorizado", { status: 401 });

  const { data: linha } = await supabase
    .from("linhas")
    .select("id, nome")
    .eq("id", params.id)
    .single();

  if (!linha) return new Response("Linha não encontrada", { status: 404 });

  const { data: rawEquip } = await supabase
    .from("produtos")
    .select("id, codigo, descricao, preco_brl, preco_painel_220, preco_painel_380, ncm, specs, status")
    .eq("categoria", "maquina")
    .eq("linha_id", params.id)
    .eq("status", "ativo")
    .is("deleted_at", null)
    .order("codigo");

  const equipamentos: Array<{
    id: string; codigo: string; descricao: string;
    preco_brl: number | null; preco_painel_220: number | null; preco_painel_380: number | null;
    ncm: string | null; specs: Record<string, unknown> | null; status: string;
  }> = rawEquip ?? [];

  // Widths: code 1700, desc 4200, 220v 1600, 380v 1600, ncm 1366
  const colWidths = [1700, 4200, 1600, 1600, 1366];

  const sections: Paragraph[] = [];

  // Title
  sections.push(
    new Paragraph({
      children: [new TextRun({ text: `Catálogo de Equipamentos — Linha ${linha.nome}`, bold: true, size: 28, font: "Calibri", color: NAVY })],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Gerado em: ${new Date().toLocaleDateString("pt-BR")}   ·   ${equipamentos.length} equipamento${equipamentos.length !== 1 ? "s" : ""}`, size: 18, font: "Calibri", color: "6B7B8D" })],
      spacing: { after: 400 },
    }),
  );

  // Price table
  const tableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        hdrCell("Código", colWidths[0]),
        hdrCell("Descrição", colWidths[1]),
        hdrCell("Total 220V", colWidths[2]),
        hdrCell("Total 380V", colWidths[3]),
        hdrCell("NCM", colWidths[4]),
      ],
    }),
    ...equipamentos.map((eq, i) => {
      const bg = i % 2 === 0 ? "FFFFFF" : LIGHT_BG;
      const t220 = (eq.preco_brl ?? 0) + (eq.preco_painel_220 ?? 0);
      const t380 = (eq.preco_brl ?? 0) + (eq.preco_painel_380 ?? 0);
      return new TableRow({
        children: [
          dataCell(eq.codigo, colWidths[0], { bold: true, bg }),
          dataCell(eq.descricao, colWidths[1], { bg }),
          dataCell(eq.preco_painel_220 != null ? fmt(t220) : "—", colWidths[2], { center: true, bg }),
          dataCell(eq.preco_painel_380 != null ? fmt(t380) : "—", colWidths[3], { center: true, bg }),
          dataCell(eq.ncm ?? "—", colWidths[4], { center: true, bg }),
        ],
      });
    }),
  ];

  const table = new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: tableRows,
  });

  // Specs per equipment
  const specsSection: Array<Paragraph | Table> = [];
  for (const eq of equipamentos) {
    if (!eq.specs || Object.keys(eq.specs).length === 0) continue;

    specsSection.push(
      new Paragraph({ children: [], spacing: { before: 400 } }),
      new Paragraph({
        children: [
          new TextRun({ text: `${eq.codigo}`, bold: true, size: 22, font: "Calibri", color: NAVY }),
          new TextRun({ text: `  ${eq.descricao}`, size: 20, font: "Calibri", color: "6B7B8D" }),
        ],
        spacing: { after: 100 },
      }),
    );

    const specEntries = Object.entries(eq.specs);
    const specRows = specEntries.map(([key, value], i) => {
      const bg = i % 2 === 0 ? "FFFFFF" : LIGHT_BG;
      return new TableRow({
        children: [
          dataCell(key, Math.floor(CW / 2), { bg }),
          dataCell(String(value), Math.floor(CW / 2), { bold: true, bg }),
        ],
      });
    });

    specsSection.push(
      new Table({
        width: { size: CW, type: WidthType.DXA },
        columnWidths: [Math.floor(CW / 2), Math.floor(CW / 2)],
        rows: specRows,
      }),
    );
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: A4_W, height: 16838 },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      children: [
        ...sections,
        table,
        new Paragraph({ children: [], spacing: { before: 600 } }),
        new Paragraph({
          children: [new TextRun({ text: "Especificações técnicas por equipamento", bold: true, size: 22, font: "Calibri", color: NAVY })],
          spacing: { after: 100 },
        }),
        ...specsSection,
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const fileName = `Catalogo_${linha.nome.replace(/\s+/g, "_")}.docx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
