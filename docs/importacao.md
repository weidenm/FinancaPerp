# Importação de extratos e faturas

Este documento registra o desenho acordado (brainstorming — foco em **qualidade**, **preview/guardrails** e confirmação para formatos ambíguos) e o comportamento implementado na **Fase 1**.

## Objetivos

- Priorizar **dados corretos** na lista de transações em detrimento de “aceitar qualquer ficheiro sem critério”.
- Formatos **tabular estruturados** (CSV, XLSX, OFX) geram candidatos a lançamentos; formatos **apenas texto** (PDF digital, TXT, imagem via OCR) não devem simular movimentos válidos nem dar commit automático enganador.
- Evitar gravação silenciosa de ruído (ex.: linha única com valor `0` e data artificial).

## Interface: revisão do ledger

- Menu **Importações** (`#/importacoes`): lista dos lotes recentes com estado (`parsed`, `needs_review`, `committed`).
- Ao abrir um lote (`#/importacoes/:id`): tabela do ledger com data, descrição, valores, **tipo** (`kind`), interruptor **R/D** (`affectsIncomeExpense`), badges de revisão/duplicata.
- Ações: **Reprocessar** (recalcula o ledger a partir do bruto com as regras atuais), **Gravar na lista** (`POST .../commit`).

## Classificação (regras v1) e OFX

- **PIX / TED / DOC** na descrição **não** são mais tratados como transferência interna só pela palavra-chave; lançamentos típicos de extrato (pagamentos a terceiros) passam a **entrar no fluxo receita/despesa** (`kind: other` por omissão em conta corrente), permitindo que o **commit** os projete para `transactions`.
- Transferência interna continua associada a padrões explícitos na descrição (ex.: “TRANSFERENCIA ENTRE CONTAS”) ou a `TRNTYPE` **XFER** no OFX.
- **PAYMENT** no código OFX só conta como pagamento de fatura quando é exactamente o código `PAYMENT` (deixou de usar `includes`, para reduzir falsos positivos).

## Pipeline

1. **Upload** → Multer (memória, limite ~25 MB por ficheiro).
2. **Parse** → [`server/import/parser.ts`](../server/import/parser.ts): extrai texto ou linhas conforme o tipo.
3. **Mapeamento** → [`server/import/mappers/`](../server/import/mappers/index.ts): converte `RawDocument[]` em `RawTxnCandidate[]`.
4. **Normalização** → [`server/domain/ledger/normalizer.ts`](../server/domain/ledger/normalizer.ts): `amount_normalized`, `kind`, `fingerprint`, `needs_review`, etc.
5. **Persistência** → `raw_transactions` + `ledger_transactions`; estado do import (`parsed` | `needs_review`).
6. **Commit** → [`server/infra/ledgerRepo.ts`](../server/infra/ledgerRepo.ts) — apenas linhas com `affects_income_expense=true` e valor absoluto > ~0; zeros são ignorados na projeção para `transactions`.

## Matriz de formatos

| Fonte     | Parse                         | Candidatos                    | Notas |
|-----------|-------------------------------|-------------------------------|--------|
| CSV       | Texto; UTF-8 com fallback Latin-1 | Múltiplos (`genericCsv`)      | Delimitador e datas heurísticos |
| XLSX      | Primeira folha                | Múltiplos (`genericXlsx`)     | Melhorias futuras: escolha de folha |
| OFX       | Texto; mesmo fallback encoding | Múltiplos (`genericOfx`)      | |
| PDF       | Texto extraído (`pdf-parse`)  | **Um** placeholder `UNMAPPED_TEXT` | Sem split tabular na v1 |
| TXT       | Texto                         | Idem                          | |
| Imagem    | OCR `tesseract`, `por`        | Idem                          | |

## Placeholder `UNMAPPED_TEXT`

Para PDF / TXT / imagem, sem template por instituição, o sistema gera **um** candidato sintético com:

- `transactionCode`: `UNMAPPED_TEXT`
- `amountRaw`: `"0"`
- `metadata.note`: `unmapped_text_document`
- Trecho do texto em `descriptionRaw` (limitado)

Na normalização:

- `needsReview`: **sempre true**
- `confidence`: **0.05**
- `audit.unmappedDocument`: **true**

Isto evita tratar o resultado como “lançamento válido” só porque `0` é um número parseável.

## Resposta da API após `POST /api/imports`

Além de `importId`, `status`, `idempotencyKey` e `counts`, o servidor pode enviar:

| Campo | Significado |
|-------|-------------|
| `warnings` | Lista de avisos em PT-BR (ex.: texto não tabular). |
| `autoCommitRecommended` | `false` quando **todos** os candidatos são `UNMAPPED_TEXT`; caso contrário `true`. |

O mesmo par aparece em:

- Resposta **idempotente** (import já existente com a mesma chave).
- `POST /api/imports/:id/reprocess`.

### Comportamento da UI (Transações)

Se `autoCommitRecommended === false`, o cliente **não** chama `POST /api/imports/:id/commit` automaticamente; mostra toast com o ID do import e o primeiro aviso.

## Encoding (CSV, TXT, OFX)

Decodificação: UTF-8 primeiro; se o texto contiver o carácter de substituição U+FFFD (bytes inválidos em UTF-8), aplicar-se-á **fallback Latin-1** — comum em exports brasileiros antigos.

Implementação: [`server/import/parser.ts`](../server/import/parser.ts) (`decodeTextBuffer`).

## Decisões registadas (decision log)

| Decisão | Motivo |
|---------|--------|
| Separar “extrair texto” de “tabularizar lançamentos” | PDF/imagem exigem passo extra ou revisão humana. |
| Não fazer commit automático quando só há `UNMAPPED_TEXT` | Evita mensagens falsas de sucesso e lista sem dados reais. |
| Manter dados no ledger/raw mesmo sem commit | Permite API futura / reprocessamento sem perder o texto extraído. |
| Conectores por banco em fase posterior | Custo de manutenção alto até o fluxo genérico estar estável. |

## Roadmap sugerido (não implementado)

- Seleção ou heurística de **folha XLSX** com mais linhas numéricas.
- Extração de **tabela** de PDF digital (layout).
- **Ecrã de revisão** do ledger no cliente (hoje só endpoints REST).
- Templates opcionais por instituição, atrás de bandeira ou configuração.

## Ficheiros relevantes

- Parser: `server/import/parser.ts`
- Preview meta (`warnings`, `autoCommitRecommended`): `server/import/importPreview.ts`
- Mappers: `server/import/mappers/index.ts`, `genericCsv.ts`, `genericXlsx.ts`, `genericOfx.ts`
- Rotas: `server/api/imports.ts`
- Normalizador: `server/domain/ledger/normalizer.ts`
- UI importação: `client/src/pages/transacoes.tsx`

## Testes

- `server/domain/ledger/normalizer.test.ts` — `UNMAPPED_TEXT` exige revisão e baixa confiança.
- `server/api/imports.int.test.ts` — import só TXT → `autoCommitRecommended: false`, `needs_review`, commit com `created: 0`.
