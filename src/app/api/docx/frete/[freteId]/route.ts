import { createClient } from "@/lib/supabase/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  VerticalAlign,
} from "docx";

export const dynamic = "force-dynamic";

const A4_W = 11906;
const MARGIN = 720;
const CW = A4_W - 2 * MARGIN; // 10466

const NAVY = "2C4F79";
const HDR_BG = "DBE5F1";

const bdr = (c = "000000") => ({ style: BorderStyle.SINGLE, size: 6, color: c } as const);
const allB = (c = "000000") => ({ top: bdr(c), bottom: bdr(c), left: bdr(c), right: bdr(c) });

const tx = (text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) =>
  new TextRun({ text, font: "Arial", size: opts.size ?? 20, bold: opts.bold, color: opts.color });

const p = (
  children: TextRun[],
  align?: (typeof AlignmentType)[keyof typeof AlignmentType]
) => new Paragraph({ children, alignment: align });

const blank = () => new Paragraph({ children: [tx("", { size: 12 })] });

function row2(
  left: string,
  right: string,
  w1 = Math.floor(CW / 2),
  w2 = CW - Math.floor(CW / 2),
  bold = true
) {
  const cellStyle = {
    borders: allB(),
    verticalAlign: VerticalAlign.CENTER as typeof VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
  };
  return new TableRow({
    children: [
      new TableCell({ ...cellStyle, width: { size: w1, type: WidthType.DXA }, children: [p([tx(left, { bold, size: 19 })])] }),
      new TableCell({ ...cellStyle, width: { size: w2, type: WidthType.DXA }, children: [p([tx(right, { bold, size: 19 })])] }),
    ],
  });
}

function row1(text: string, span = 2, fill?: string) {
  return new TableRow({
    children: [
      new TableCell({
        columnSpan: span,
        borders: allB(),
        shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
        children: [p([tx(text, { bold: true, size: 19 })])],
      }),
    ],
  });
}

function section(titulo: string, conteudo: string | null | undefined) {
  const items: (Paragraph | Table)[] = [];
  items.push(p([tx(titulo, { bold: true, size: 20 })]));
  if (conteudo) {
    conteudo.split("\n").forEach((line) => items.push(p([tx(line, { size: 19 })])));
  } else {
    items.push(p([tx("—", { size: 19, color: "999999" })]));
  }
  return items;
}

export async function GET(
  req: Request,
  { params }: { params: { freteId: string } }
) {
  const tipo = new URL(req.url).searchParams.get("tipo") ?? "cliente";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: frete } = await supabase
    .from("fretes")
    .select("*")
    .eq("id", params.freteId)
    .single();

  if (!frete) return new Response("Frete não encontrado", { status: 404 });

  const todayStr = new Date().toLocaleDateString("pt-BR");
  const tipoLabel = tipo === "transportadora" ? "TRANSPORTADORA" : "CLIENTE";

  const children: (Paragraph | Table)[] = [];

  // ── TAGLINE ───────────────────────────────────────────────────
  children.push(
    new Table({
      width: { size: CW, type: WidthType.DXA },
      columnWidths: [CW],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: allB(),
              shading: { fill: HDR_BG, type: ShadingType.CLEAR },
              margins: { top: 100, bottom: 100, left: 160, right: 160 },
              children: [p([tx("SEIBT MÁQUINAS E EQUIPAMENTOS", { bold: true, size: 22 })], AlignmentType.CENTER)],
            }),
          ],
        }),
      ],
    })
  );

  children.push(blank());

  // ── TÍTULO ────────────────────────────────────────────────────
  children.push(
    p(
      [tx(`FOLDER DE FRETE — ${tipoLabel}`, { bold: true, size: 28, color: NAVY })],
      AlignmentType.CENTER
    )
  );
  children.push(blank());

  // ── CABEÇALHO ─────────────────────────────────────────────────
  const half = Math.floor(CW / 2);
  children.push(
    new Table({
      width: { size: CW, type: WidthType.DXA },
      columnWidths: [half, CW - half],
      rows: [
        row2(`Nº Pedido: ${frete.pedido_numero ?? "—"}`, `Data: ${todayStr}`, half, CW - half),
        ...(tipo === "transportadora" && frete.transportadora
          ? [row2("Transportadora:", frete.transportadora, half, CW - half)]
          : []),
        row2(
          `Tipo de Frete: ${(frete.tipo_frete as string)?.toUpperCase() ?? "CIF"}`,
          frete.tipo_frete === "cif" ? "Por conta do remetente (Seibt)" : "Por conta do destinatário",
          half,
          CW - half
        ),
      ],
    })
  );

  children.push(blank());

  // ── PRODUTO / CARGA ───────────────────────────────────────────
  const dimStr =
    [frete.dimensoes_l, frete.dimensoes_a, frete.dimensoes_p]
      .filter(Boolean)
      .map((v: number) => `${v}m`)
      .join(" × ") || "—";

  const cargoRows = [
    row1("PRODUTO / CARGA", 2, HDR_BG),
    row1(frete.descricao_produto ?? "—"),
    row2(`Peso Bruto: ${frete.peso_bruto_kg ? `${frete.peso_bruto_kg} kg` : "—"}`, `Volume: ${frete.volume_m3 ? `${frete.volume_m3} m³` : "—"}`, half, CW - half, false),
    ...(tipo === "transportadora"
      ? [row2(`Dimensões (L×A×P): ${dimStr}`, "", half, CW - half, false)]
      : []),
  ];

  children.push(
    new Table({
      width: { size: CW, type: WidthType.DXA },
      columnWidths: [half, CW - half],
      rows: cargoRows,
    })
  );

  children.push(blank());

  // ── ENDEREÇOS ────────────────────────────────────────────────
  if (tipo === "transportadora") {
    // Mostra origem + destino completos
    const enderecoRows = [
      row1("ORIGEM", 2, HDR_BG),
      row1(`${frete.cidade_origem ?? "—"} — ${frete.estado_origem ?? "—"}`),
      ...(frete.endereco_origem ? [row1(frete.endereco_origem)] : []),
      row1("DESTINO", 2, HDR_BG),
      row1(`${frete.cidade_destino ?? "—"} — ${frete.estado_destino ?? "—"}`),
      ...(frete.endereco_destino ? [row1(frete.endereco_destino)] : []),
    ];

    children.push(
      new Table({
        width: { size: CW, type: WidthType.DXA },
        columnWidths: [CW],
        rows: enderecoRows,
      })
    );
  } else {
    // Folder cliente: só endereço de entrega
    children.push(...section("ENDEREÇO DE ENTREGA", [
      frete.cidade_destino && `${frete.cidade_destino}${frete.estado_destino ? ` — ${frete.estado_destino}` : ""}`,
      frete.endereco_destino,
    ].filter(Boolean).join("\n") || null));
  }

  // ── OBSERVAÇÕES ───────────────────────────────────────────────
  if (frete.observacoes) {
    children.push(blank());
    children.push(...section("OBSERVAÇÕES", frete.observacoes));
  }

  // ── RODAPÉ ───────────────────────────────────────────────────
  children.push(blank());
  children.push(blank());
  children.push(
    p(
      [tx("Seibt Máquinas e Equipamentos — Nova Petrópolis, RS — Brasil", { size: 16, color: "888888" })],
      AlignmentType.CENTER
    )
  );

  // ── DOCUMENTO ─────────────────────────────────────────────────
  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: A4_W, height: 16838 },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const pedido = (frete.pedido_numero as string | null)?.replace(/\//g, "-") ?? params.freteId.slice(0, 8);
  const filename = `folder_${tipo}_${pedido}.docx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
