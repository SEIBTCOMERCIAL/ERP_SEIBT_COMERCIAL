# Agente — ERP Comercial SEIBT (retomada: equipamentos, preço, catálogo)

## Papel
Você trabalha com o Lucas (comercial SEIBT) para retomar este ERP, que ficou parado
no meio do desenvolvimento. Ele **não é programador** — veja a seção Comunicação
abaixo antes de escrever qualquer explicação para ele.
Você propõe, constrói e testa. O Lucas decide e aprova. **Nada é publicado/colocado
no ar sem aprovação explícita dele.**

## Status atual (ler isto primeiro, sempre)
Atualizado em 2026-09-17. Este projeto vive só dentro de `ERP_COMERCIAL_SEIBT/` — a
pasta com a planilha de preços antiga foi removida pelo Lucas; **esse trabalho
terminou, o foco agora é 100% o ERP.**

1. **Cadastro de equipamentos e peças** — ✅ pronto e testado ao vivo pelo Lucas
   (criar equipamento, criar peça). Existe um registro fixo chamado **"TESTE"** que
   deve ser reaproveitado sempre que precisar testar algo nessa tela — não criar
   outro.
2. **Ajuste de preço** — ✅ pronto e testado ao vivo pelo Lucas (um item e em lote).
3. **Catálogo em PDF** — 🔶 em construção, fase de desenho visual quase fechada:
   - Decisão de arquitetura (confirmada, ver Regras de negócio abaixo): seção nova
     "Catálogo" no menu lateral; Administrador edita conteúdo e gera o PDF; demais
     usuários só veem e imprimem; preço sempre puxado ao vivo do Reajuste.
   - Visual da página aprovado pelo Lucas: folha A4 com **4 máquinas por página**,
     cada uma com foto, nome do modelo + motor, caixa "Valor da máquina (sem
     painel)", duas caixas de preço NR-12 (220V e 380V — cada uma mostra o total e,
     numa linha menor, o valor do painel separado), e uma tabela com 12
     especificações técnicas. Esse visual foi testado num mockup separado (fora do
     código do ERP, numa página de design) usando dados reais da linha BSC — ainda
     não foi construído dentro do ERP de verdade.
   - Já existe no banco de dados o que essa tela vai precisar, então não é preciso
     criar do zero: campo de foto em `produtos`, tabela `produto_arquivos` (permite
     mais de uma foto/desenho por produto — o Administrador escolhe qual aparece),
     tabela `linhas` (BSC, A2, LRX, MGHS, TPS...) e uma tabela `linha_spec_campos`
     que já tem o modelo dos 12 campos técnicos cadastrado para as linhas BSC, A2 e
     LRX. Os *valores* desses 12 campos por produto ficam em `produtos.specs`
     (coluna jsonb, chave = o nome do campo, ex.: `specs["Bocal de alimentação
     (mm)"] = "300 x 275"`).
   - Melhor ainda: já existe uma tela de admin pronta e funcionando para editar tudo
     isso por equipamento — `src/components/produtos/EquipamentoDetalhe.tsx` (abas
     Especificações / Preço e painéis / Imagens / Desenhos). O Catálogo não precisa
     de uma tela de edição nova do zero; o trabalho real é montar a
     **página impressa/PDF** que junta esses dados já existentes (foto escolhida +
     specs + preço ao vivo) no visual aprovado.
   - Próximo passo: montar a tela real de Catálogo no ERP com esse visual, lendo
     os dados acima.

Ver também `../PRD.md` — visão completa do ERP (todos os módulos, inclusive os que
estão fora de escopo agora). Ele tem uma seção "Foco Atual" no topo que resume o
mesmo escopo combinado abaixo.

## Escopo combinado (não expandir sem perguntar)
Por enquanto, só três frentes:
1. **Cadastro de equipamentos e peças** (navalhas, peneiras, painéis elétricos).
2. **Ajuste de preço** (por item ou em lote), com histórico.
3. **Catálogo em PDF** — uma seção nova "Catálogo" no menu lateral (ver "Status
   atual" acima e `../PRD.md`).

**Fora do escopo agora:** clientes, leads, propostas/orçamento, metas, frete,
relatórios, auditoria. Esses módulos já existem/estão planejados no projeto (veja
`../DOCUMENTACAO/`), mas ficam para uma fase futura. Não mexa neles a menos que o
Lucas peça.

## Contexto do projeto
- Next.js 14 (App Router) + TypeScript + Supabase (Postgres + Auth), deploy no
  Vercel (projeto `erp-seibt-comercial`). Sem ambiente de teste separado — **existe
  só um banco de dados Supabase**, com dados reais (1.252 produtos já carregados).
  Não existe "banco de testes"; qualquer teste ao vivo mexe no banco de verdade.
- Este projeto tem um histórico de planejamento extenso em `../DOCUMENTACAO/` (9
  documentos) e dois relatórios de bugs/melhorias (`../DOC1_BUGS_CLAUDE_CODE.docx`,
  `../DOC2_MELHORIAS_PRIORIZADAS.docx`). **Parte dessa documentação está
  desatualizada** — ela descreve um fluxo de aprovação de desconto e uma
  reconciliação automática com o sistema DEZ que foram decididos e depois
  descartados em documentos mais novos, e nunca ninguém voltou para atualizar os
  documentos antigos. Não presuma que a documentação bate com o código: **em caso
  de dúvida, o código e o banco de dados reais mandam**, não o documento.
- Geração de PDF já foi tentada e cancelada uma vez (ver `src/app/actions/pdf.ts`
  — tem uma função que só retorna erro, de propósito). A exportação que funciona
  hoje é em `.docx`, não PDF. Isso não é um bug: foi uma decisão consciente na
  época. Estamos retomando o PDF agora, mas para um objetivo mais simples
  (catálogo de preço), não para o objetivo antigo (proposta de cliente completa).

## Comunicação (regra mais importante deste arquivo)
- **Nunca use termos técnicos de programação** ao falar com o Lucas (nomes de
  bibliotecas, "serverless", "RLS", "endpoint", etc.). Se precisar mencionar algo
  técnico, traduza para a consequência prática em uma frase simples.
- **Um assunto por vez.** Não liste várias opções técnicas de uma vez esperando que
  ele escolha — se a escolha for técnica e não afetar o negócio, decida você e
  informe o resultado. Só pergunte quando for uma decisão que só ele pode tomar
  (preço, regra de negócio, prioridade).
- Direto ao ponto: sem introdução, sem repetir o pedido, sem resumo do que já foi
  dito.
- Português, sem enrolação.
- Antes de avançar para o próximo passo do plano combinado, mostre o resultado do
  passo atual (print, link, ou descrição simples do que mudou) e espere confirmação
  — não empilhe vários passos de uma vez sem checar.

## Fluxo de trabalho
1. **Ler antes de mudar.** Antes de alterar qualquer tela/função já existente,
   leia o código relevante e, se possível, teste como está hoje (rodando o projeto)
   antes de mexer.
2. **Testar de verdade antes de dizer "pronto".** Como não há banco de testes,
   teste com cuidado: se precisar criar um registro de teste (equipamento, peça),
   identifique claramente como teste (ex.: nome "TESTE — apagar") e apague depois
   de confirmar que funciona, avisando o Lucas do que foi criado/apagado.
3. **Nunca reajuste preço de verdade nem publique o catálogo sem o Lucas pedir
   explicitamente.** Testes de reajuste devem usar um item de teste ou ser
   revertidos depois, nunca um preço real de catálogo sem aviso.
4. **Deploy/publicação** (subir para o Vercel de produção) só com autorização
   explícita — commits e testes locais não precisam de autorização a cada vez, mas
   publicar para todo mundo ver, sim.

## Regras de negócio confirmadas (não redecidir)
1. **Preço não se digita duas vezes.** O Catálogo mostra o preço ao vivo, puxado de
   onde ele é reajustado — nunca um campo de preço separado e editável dentro do
   Catálogo.
2. **Catálogo com dois níveis de acesso:** Administrador edita conteúdo (fotos,
   descrição, dados técnicos) e gera/imprime o PDF; qualquer outro usuário logado
   só visualiza e imprime — não edita nada.
3. **Geração do PDF é sob demanda**, não um serviço ligado o tempo todo — é uma
   ação rara (só quando o catálogo muda), não precisa ser instantânea.

## Regras pendentes (não decidir sozinho — perguntar ao Lucas quando surgir)
- Qualquer coisa relacionada aos módulos fora do escopo atual (desconto, DEZ,
  clientes, frete) — a documentação tem versões conflitantes entre si; não resolver
  essa contradição por conta própria, só sinalizar se ela aparecer no caminho.
- Quem, além do Administrador, poderá editar o Catálogo no futuro (hoje é só
  Administrador edita, todos os outros só veem).

## Proibições
- Presumir que um documento em `../DOCUMENTACAO/` reflete o estado atual sem
  confirmar no código/banco.
- Reajustar preço real ou gerar/publicar o catálogo oficial sem pedido explícito do
  Lucas.
- Criar dado de teste no banco real sem identificá-lo como teste e sem limpar
  depois.
- Mexer em clientes, leads, propostas, metas, frete ou qualquer outro módulo fora
  do escopo combinado, sem perguntar antes.
- Publicar (deploy) em produção sem autorização explícita.
