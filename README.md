# Calculadora de Saúde de Clientes / Risco de Churn

Versão adaptada do sistema original para rodar sem backend/banco de dados
tradicional — os dados ficam salvos no navegador e, opcionalmente,
sincronizados com um arquivo em um repositório GitHub (armazenamento
gratuito, até 1GB, com histórico de versões).

## Como funciona o armazenamento

- **Local (sempre ativo):** os dados ficam no `localStorage` do navegador —
  rápido, funciona offline, mas não sincroniza sozinho entre dispositivos.
- **GitHub (opcional, recomendado):** ao conectar em Admin → "Sincronização
  GitHub", o app passa a ler/gravar um arquivo `data/db.json` dentro do
  repositório que você indicar. Toda alteração no app é enviada
  automaticamente pro GitHub poucos segundos depois, e ao abrir o app em
  qualquer navegador ele já carrega os dados mais recentes de lá.

Sem servidor, sem NextAuth, sem Prisma — o app inteiro é exportado como site
estático (`next build` gera a pasta `out/`), do jeito que a Netlify hospeda
de graça.

## Configurando a sincronização com o GitHub

1. Crie um repositório no GitHub (pode ser privado) — é nele que o arquivo
   `data/db.json` vai morar.
2. Gere um **Personal Access Token (fine-grained)** em
   https://github.com/settings/tokens?type=beta, com acesso limitado a esse
   repositório e permissão "Contents: Read and write".
3. No app, entre como admin e vá em **"Sincronização GitHub"** na barra
   lateral. Informe seu usuário, o nome do repositório, a branch (geralmente
   `main`) e cole o token.

**Sobre o token:** ele fica salvo só no `localStorage` do navegador de quem
configurou — nunca no código do site nem no repositório. Qualquer pessoa com
acesso ao navegador onde ele foi colado consegue ver o token pelo DevTools;
por isso, configure a sincronização só em dispositivos de confiança e use um
token com permissão restrita a esse único repositório.

## Login de teste (dados de exemplo pré-carregados)

- **Admin:** admin@agencia.com / admin123
- **CS (usuário padrão):** cs@agencia.com / cs123456

## Como publicar na Netlify

1. Suba esta pasta para um repositório Git (GitHub/GitLab/Bitbucket), **ou**
   arraste a pasta direto no [Netlify Drop](https://app.netlify.com/drop)
   depois de gerar o build localmente (passo 3).
2. Se for pelo Git: no Netlify, "Add new site" → "Import an existing
   project" → conecte o repositório. As configurações de build já estão no
   `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `out`
3. Se preferir gerar localmente:
   ```bash
   npm install
   npm run build
   ```
   Isso cria a pasta `out/` — é ela que deve ser publicada (no Netlify Drop,
   arraste a pasta `out`).

Não é preciso configurar nenhuma variável de ambiente, banco de dados ou
função serverless — é um site estático puro, mesmo com a sincronização com
GitHub ligada (ela acontece direto do navegador para a API do GitHub).

## Rodando localmente para testar antes de publicar

```bash
npm install
npm run dev
```

Acesse http://localhost:3000.

