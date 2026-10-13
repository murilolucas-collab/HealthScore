# HealthScore

Aplicação Next.js para acompanhar a saúde de clientes e calcular risco de churn.

## Executar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. Os dados iniciais são carregados de `data/db.json` e,
depois do primeiro acesso, ficam salvos no navegador.

## Sincronização com GitHub

Para persistir os dados em um repositório, configure no ambiente de produção:

```text
GITHUB_OWNER=seu-usuario
GITHUB_REPO=seu-repositorio
GITHUB_BRANCH=main
GITHUB_TOKEN=seu-token-com-permissao-contents
```

O token deve ser criado como segredo do provedor de hospedagem e nunca commitado.
