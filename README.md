# FinancaPerp

## Ledger: importação e normalização (extrato + fatura)

### Regra canônica
- **Entrada**: `amount_normalized > 0`
- **Saída**: `amount_normalized < 0`
- **Transferência interna**: `kind=transfer` e `affects_income_expense=false`
- **Estorno / refund / chargeback**: `kind=refund` e **positivo**
- **Pagamento de fatura**: `kind=transfer` e **nunca despesa**

### Conceitos (tabelas)
- `accounts`: conta (`checking|savings|credit_card`) + `sign_convention` (`natural|inverted`)
- `imports`: lote importado, com `idempotency_key` e `rule_version`
- `raw_transactions`: preserva campos brutos incluindo `amount_raw`
- `ledger_transactions`: normalizadas com `amount_normalized` (com sinal), `kind`, `fingerprint`, `needs_review`, `audit_json`
- `ledger_audit_events`: trilha de auditoria

### Endpoints REST

#### Contas
- `GET /api/accounts`
- `POST /api/accounts`

Body exemplo:

```json
{
  "name": "Itaú CC",
  "type": "checking",
  "connectorId": "generic_csv",
  "signConvention": "natural",
  "currency": "BRL"
}
```

#### Importação
- `POST /api/imports` (multipart `files[]`)
  - campos: `accountId`, `connectorId`, `sourceKind` (`statement|card_invoice`), `ruleVersion?`
- `GET /api/imports`
- `GET /api/imports/:id`
- `GET /api/imports/:id/files`
- `GET /api/imports/:id/raw-transactions`
- `GET /api/imports/:id/ledger-transactions?includeDuplicates=true|false`
- `POST /api/imports/:id/reprocess` (JSON `{ "ruleVersion": "ledger_rules@v1" }`)
- `PATCH /api/ledger-transactions/:id`
- `POST /api/imports/:id/commit` (projeta para `transactions` apenas quando `affects_income_expense=true`)

### UI
Na tela `Transações`, existe o botão **Importar** que chama `POST /api/imports` via `FormData`.

### Desenvolvimento
Criar schema no SQLite:

```bash
npm run db:push
```

Rodar checks e testes:

```bash
npm run check
npm test -- --run
```

