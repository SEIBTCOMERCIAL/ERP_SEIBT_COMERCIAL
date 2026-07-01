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

// A4 @ 720 DXA (≈1.27 cm) margins
const A4_W = 11906;
const MARGIN = 720;
const CW = A4_W - 2 * MARGIN; // 10466 DXA

const NAVY = "2C4F79";
const HDR_BG = "DBE5F1";

const singleBorder = (color = "000000") =>
  ({ style: BorderStyle.SINGLE, size: 6, color } as const);

const borders = (c = "000000") => ({
  top: singleBorder(c),
  bottom: singleBorder(c),
  left: singleBorder(c),
  right: singleBorder(c),
});

const noBorders = () => ({
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
});

function run(
  text: string,
  opts: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}
) {
  return new TextRun({
    text,
    font: "Arial",
    size: opts.size ?? 20,
    bold: opts.bold,
    color: opts.color,
    italics: opts.italics,
  });
}

function para(
  children: TextRun[],
  opts: {
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    indent?: { firstLine?: number; left?: number };
    spacing?: { before?: number; after?: number };
  } = {}
) {
  return new Paragraph({ children, ...opts });
}

function blank() {
  return new Paragraph({ children: [run("", { size: 12 })] });
}

function simpleCell(
  text: string,
  width: number,
  opts: {
    bold?: boolean;
    span?: number;
    fill?: string;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    size?: number;
    noBorder?: boolean;
  } = {}
) {
  return new TableCell({
    columnSpan: opts.span,
    borders: opts.noBorder ? noBorders() : borders(),
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    width: { size: width, type: WidthType.DXA },
    children: [
      para([run(text, { bold: opts.bold, size: opts.size ?? 20 })], {
        alignment: opts.align ?? AlignmentType.LEFT,
      }),
    ],
  });
}

function headerCell(text: string, width: number) {
  return new TableCell({
    borders: borders("FFFFFF"),
    shading: { fill: NAVY, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    width: { size: width, type: WidthType.DXA },
    children: [
      para([run(text, { bold: true, size: 18, color: "FFFFFF" })], {
        alignment: AlignmentType.CENTER,
      }),
    ],
  });
}

function formatMoney(value: number | null | undefined, moeda = "BRL"): string {
  if (value == null) return "-";
  const num = value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return moeda === "USD" ? `USD ${num}` : `R$ ${num}`;
}

export async function GET(
  _req: Request,
  { params }: { params: { propostaId: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: proposta } = await supabase
    .from("propostas")
    .select(
      "id, numero_completo, tipo, moeda, condicao_pagamento, prazo_entrega, validade_proposta, observacoes, cliente_id, responsavel_id, contato_nome, contato_email, contato_telefone"
    )
    .eq("id", params.propostaId)
    .is("deleted_at", null)
    .single();

  if (!proposta) {
    return new Response("Proposta não encontrada", { status: 404 });
  }

  const [
    { data: cliente },
    { data: itens },
    { data: responsavel },
    { data: checklist },
    { data: contatosPrimarios },
  ] = await Promise.all([
    proposta.cliente_id
      ? supabase
          .from("clientes")
          .select("razao_social, cidade, estado, cnpj")
          .eq("id", proposta.cliente_id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from("itens_proposta")
      .select(
        "numero_item, descricao, quantidade, preco_unitario, ipi_pct, desconto_pct, total, observacao, opcional"
      )
      .eq("proposta_id", params.propostaId)
      .order("ordem"),
    proposta.responsavel_id
      ? supabase
          .from("usuarios")
          .select("nome")
          .eq("id", proposta.responsavel_id)
          .single()
      : Promise.resolve({ data: null }),
    proposta.tipo === "maquina"
      ? supabase
          .from("checklist_tecnico")
          .select(
            "segmento_aplicacao, produto_final, material, dimensoes, granulometria, moagem_tipo, forma_abastecimento, producao_horaria_kgh, voltagem"
          )
          .eq("proposta_id", params.propostaId)
          .single()
      : Promise.resolve({ data: null }),
    proposta.cliente_id
      ? supabase
          .from("contatos_cliente")
          .select("nome, telefone, email")
          .eq("cliente_id", proposta.cliente_id)
          .eq("principal", true)
          .limit(1)
      : Promise.resolve({ data: [] }),
  ]);

  const isMaquina = proposta.tipo === "maquina";
  const moeda: string = proposta.moeda ?? "BRL";

  const contatoNome: string =
    proposta.contato_nome ?? contatosPrimarios?.[0]?.nome ?? "";
  const contatoFone: string =
    proposta.contato_telefone ?? contatosPrimarios?.[0]?.telefone ?? "";
  const contatoEmail: string =
    proposta.contato_email ?? contatosPrimarios?.[0]?.email ?? "";

  const todayStr = new Date().toLocaleDateString("pt-BR");

  // Items
  type Item = {
    numero_item: string | null;
    descricao: string;
    quantidade: number;
    preco_unitario: number;
    ipi_pct: number | null;
    desconto_pct: number | null;
    total: number | null;
    observacao: string | null;
    opcional: boolean;
  };
  const allItems: Item[] = (itens ?? []) as Item[];

  const subtotal = allItems.reduce(
    (s, i) => s + i.preco_unitario * i.quantidade,
    0
  );
  const grandTotal = allItems.reduce((s, i) => s + (i.total ?? 0), 0);
  const ipiTotal = grandTotal - subtotal;

  // Column widths for items table (sum = CW = 10466)
  const COL_ITEM = 600;
  const COL_DESC = 5266;
  const COL_QTD = 700;
  const COL_PRECO = 1500;
  const COL_IPI = 600;
  const COL_TOTAL = 1800;
  // Info table half-widths
  const INFO_HALF = Math.floor(CW / 2); // 5233
  const INFO_HALF2 = CW - INFO_HALF; // 5233

  const children: (Paragraph | Table)[] = [];

  // ── 1. TAGLINE HEADER ────────────────────────────────────────────────────
  const tagline = isMaquina
    ? "MÁQUINAS PARA RECICLAGEM E PROCESSAMENTO DE PLÁSTICO, COM GARANTIA DE QUALIDADE, DURABILIDADE, PRODUTIVIDADE E PRECISÃO"
    : "FACAS INDUSTRIAIS PARA MOINHOS PARA PLÁSTICO, PAPEL E MADEIRA, COM GARANTIA DE QUALIDADE, DURABILIDADE, PRODUTIVIDADE, RESISTÊNCIA E PRECISÃO";

  children.push(
    new Table({
      width: { size: CW, type: WidthType.DXA },
      columnWidths: [CW],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: borders(),
              shading: { fill: HDR_BG, type: ShadingType.CLEAR },
              margins: { top: 100, bottom: 100, left: 160, right: 160 },
              children: [
                para([run(tagline, { bold: true, size: 22 })], {
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  children.push(blank());

  // ── 2. INTRO PARAGRAPH ───────────────────────────────────────────────────
  const introText = isMaquina
    ? "De acordo com vossa solicitação, apresentamos a presente proposta de fornecimento de equipamentos para atender à necessidade descrita a seguir:"
    : "Atendendo solicitação, apresentamos à apreciação de V. Sas. proposta de fornecimento do que segue:";

  children.push(
    para([run(introText)], { indent: { firstLine: 720 } })
  );
  children.push(blank());

  // ── 3. INFO TABLE ────────────────────────────────────────────────────────
  children.push(
    new Table({
      width: { size: CW, type: WidthType.DXA },
      columnWidths: [INFO_HALF, INFO_HALF2],
      rows: [
        new TableRow({
          children: [
            simpleCell(
              `PROPOSTA Nº: ${proposta.numero_completo}`,
              INFO_HALF,
              { bold: true }
            ),
            simpleCell(`DATA: ${todayStr}`, INFO_HALF2, { bold: true }),
          ],
        }),
        new TableRow({
          children: [
            simpleCell(
              `CLIENTE: ${cliente?.razao_social ?? "—"}`,
              CW,
              { bold: true, span: 2 }
            ),
          ],
        }),
        new TableRow({
          children: [
            simpleCell(
              `CIDADE: ${cliente?.cidade ?? "—"}`,
              INFO_HALF,
              { bold: true }
            ),
            simpleCell(
              `ESTADO: ${cliente?.estado ?? "—"}`,
              INFO_HALF2,
              { bold: true }
            ),
          ],
        }),
        new TableRow({
          children: [
            simpleCell(`AT.: ${contatoNome}`, INFO_HALF, { bold: true }),
            simpleCell(`FONE: ${contatoFone}`, INFO_HALF2, { bold: true }),
          ],
        }),
        new TableRow({
          children: [
            simpleCell("C/C:", INFO_HALF, { bold: true }),
            simpleCell(
              `E-MAIL: ${contatoEmail}`,
              INFO_HALF2,
              { bold: true }
            ),
          ],
        }),
      ],
    })
  );

  children.push(blank());

  // ── 4. CHECKLIST BLOCK (máquinas only) ───────────────────────────────────
  if (isMaquina && checklist) {
    children.push(
      para([run("Informações sobre o equipamento orçado:", { bold: true })])
    );
    const rows: [string, string][] = [
      ["Segmento de Aplicação", checklist.segmento_aplicacao ?? ""],
      ["Produto Final", checklist.produto_final ?? ""],
      ["Material", checklist.material ?? ""],
      ["Dimensões", checklist.dimensoes ?? ""],
      ["Granulometria", checklist.granulometria ?? ""],
      ["Tipo de Moagem", checklist.moagem_tipo ?? ""],
      ["Forma de Abastecimento", checklist.forma_abastecimento ?? ""],
      [
        "Produção Horária",
        checklist.producao_horaria_kgh
          ? `${checklist.producao_horaria_kgh} kg/h`
          : "",
      ],
      ["Voltagem", checklist.voltagem ?? ""],
    ];
    rows
      .filter(([, v]) => v)
      .forEach(([k, v]) => {
        children.push(
          para(
            [
              run(`${k}: `, { bold: true, size: 19 }),
              run(v, { size: 19 }),
            ],
            { indent: { left: 400 } }
          )
        );
      });
    children.push(blank());
  }

  // ── 5. ITEMS TABLE ───────────────────────────────────────────────────────
  const moedaLabel = moeda === "USD" ? "USD" : "R$";

  const itemRows = [
    new TableRow({
      tableHeader: true,
      children: [
        headerCell("ITEM", COL_ITEM),
        headerCell("DESCRIÇÃO DOS PRODUTOS", COL_DESC),
        headerCell("QTD", COL_QTD),
        headerCell(`PREÇO UNIT. (${moedaLabel})`, COL_PRECO),
        headerCell("IPI (%)", COL_IPI),
        headerCell(`TOTAL (${moedaLabel})`, COL_TOTAL),
      ],
    }),
    ...allItems.map((item, idx) => {
      const descParagraphs: Paragraph[] = [
        para([run(item.descricao, { size: 19 })]),
      ];
      if (item.observacao) {
        descParagraphs.push(
          para([run(item.observacao, { size: 17, color: "555555" })])
        );
      }
      if (item.opcional) {
        descParagraphs.push(
          para([run("(Opcional)", { size: 16, italics: true, color: "888888" })])
        );
      }

      return new TableRow({
        children: [
          simpleCell(String(item.numero_item ?? idx + 1), COL_ITEM, {
            align: AlignmentType.CENTER,
            size: 19,
          }),
          new TableCell({
            borders: borders(),
            verticalAlign: VerticalAlign.TOP,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            width: { size: COL_DESC, type: WidthType.DXA },
            children: descParagraphs,
          }),
          simpleCell(String(item.quantidade), COL_QTD, {
            align: AlignmentType.CENTER,
            size: 19,
          }),
          simpleCell(formatMoney(item.preco_unitario, moeda), COL_PRECO, {
            align: AlignmentType.RIGHT,
            size: 19,
          }),
          simpleCell(
            `${((item.ipi_pct ?? 0) as number).toFixed(2).replace(".", ",")}%`,
            COL_IPI,
            { align: AlignmentType.CENTER, size: 19 }
          ),
          simpleCell(formatMoney(item.total, moeda), COL_TOTAL, {
            align: AlignmentType.RIGHT,
            size: 19,
          }),
        ],
      });
    }),
  ];

  children.push(
    new Table({
      width: { size: CW, type: WidthType.DXA },
      columnWidths: [COL_ITEM, COL_DESC, COL_QTD, COL_PRECO, COL_IPI, COL_TOTAL],
      rows: itemRows,
    })
  );

  // ── 6. TOTALS TABLE ──────────────────────────────────────────────────────
  const SPACER = CW - 2000 - 2000; // 6466
  const LABEL_W = 2000;
  const VAL_W = 2000;

  const totalsData: [string, string, boolean][] = [
    ["SUBTOTAL", formatMoney(subtotal, moeda), false],
    ["TOTAL IPI", formatMoney(ipiTotal, moeda), false],
    ["TOTAL", formatMoney(grandTotal, moeda), true],
  ];

  children.push(
    new Table({
      width: { size: CW, type: WidthType.DXA },
      columnWidths: [SPACER, LABEL_W, VAL_W],
      rows: totalsData.map(([label, value, bold]) =>
        new TableRow({
          children: [
            new TableCell({
              borders: noBorders(),
              width: { size: SPACER, type: WidthType.DXA },
              children: [para([run("")])],
            }),
            new TableCell({
              borders: borders(),
              shading: bold
                ? { fill: HDR_BG, type: ShadingType.CLEAR }
                : undefined,
              width: { size: LABEL_W, type: WidthType.DXA },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [
                para([run(label, { bold, size: 20 })], {
                  alignment: AlignmentType.RIGHT,
                }),
              ],
            }),
            new TableCell({
              borders: borders(),
              shading: bold
                ? { fill: HDR_BG, type: ShadingType.CLEAR }
                : undefined,
              width: { size: VAL_W, type: WidthType.DXA },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [
                para([run(value, { bold, size: 20 })], {
                  alignment: AlignmentType.RIGHT,
                }),
              ],
            }),
          ],
        })
      ),
    })
  );

  children.push(blank());

  // ── 7. OBSERVAÇÕES ───────────────────────────────────────────────────────
  if (proposta.observacoes) {
    children.push(para([run("Observações:", { bold: true })]));
    (proposta.observacoes as string).split("\n").forEach((line: string) => {
      children.push(para([run(line)]));
    });
    children.push(blank());
  }

  // ── 8. GARANTIA ──────────────────────────────────────────────────────────
  children.push(para([run("GARANTIA:", { bold: true })]));

  const garantiaLines = [
    "Garantia de 90 (noventa) dias a contar da emissão da nota fiscal, contra defeitos de fabricação, desde que o item seja usado para o fim a que se destina e observados os cuidados com a manutenção e instalação previstos no manual do produto.",
    "",
    "A GARANTIA NÃO COBRE:",
    "- Utilização inadequada do produto;",
    "- Danos originados por processos inadequados de afiação sem a devida refrigeração e uso de rebolos incompatíveis;",
    "- Queda, acidentes, batidas, exposições a ambientes hostis e força maior;",
    "- Armazenagem inadequada;",
    "- Não observância dos requisitos constantes no manual de instruções;",
    "- Os encargos com transporte de peças ou do produto, bem como os de viagem e estada do pessoal enviado pela SEIBT para reparar o produto.",
  ];

  garantiaLines.forEach((line) => {
    children.push(para([run(line, { size: 18 })]));
  });

  children.push(blank());

  // ── 9. CONDIÇÕES GERAIS ──────────────────────────────────────────────────
  children.push(
    para([run("CONDIÇÕES GERAIS DE FORNECIMENTO", { bold: true })], {
      alignment: AlignmentType.CENTER,
    })
  );
  children.push(blank());

  const conditions: [string, string][] = [
    [
      "CONDIÇÃO DE PAGAMENTO:",
      (proposta.condicao_pagamento as string | null) ?? "A confirmar",
    ],
    [
      "PRAZO DE ENTREGA:",
      (proposta.prazo_entrega as string | null) ?? "A confirmar",
    ],
    [
      "FRETE E SEGURO:",
      "Por conta do comprador. Produto disponível na fábrica da SEIBT em Nova Petrópolis-RS.",
    ],
    [
      "VALIDADE DA PROPOSTA:",
      (proposta.validade_proposta as string | null) ?? "15 dias",
    ],
  ];

  conditions.forEach(([label, value]) => {
    children.push(
      para([run(`${label} `, { bold: true }), run(value)])
    );
  });

  children.push(blank());

  // ── 10. SIGN-OFF ─────────────────────────────────────────────────────────
  children.push(
    para([
      run(
        "Colocamo-nos à disposição para esclarecimentos adicionais que se façam necessários."
      ),
    ])
  );
  children.push(blank());
  children.push(para([run("Atenciosamente,")]));
  children.push(blank());
  children.push(blank());
  children.push(
    para([
      run(
        (responsavel as { nome?: string } | null)?.nome ??
          "Departamento Comercial",
        { bold: true }
      ),
    ])
  );
  children.push(para([run("Departamento Comercial")]));
  children.push(para([run("Seibt Máquinas e Equipamentos")]));

  // ── BUILD DOCUMENT ───────────────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Arial", size: 20 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_W, height: 16838 },
            margin: {
              top: MARGIN,
              right: MARGIN,
              bottom: MARGIN,
              left: MARGIN,
            },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const safeNum = (proposta.numero_completo as string).replace(/\//g, "-");
  const filename = `proposta_${safeNum}.docx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
