# Calculadora de Saúde de Clientes / Risco de Churn

Versão adaptada do sistema original para rodar sem banco de dados
tradicional — os dados ficam salvos no navegador (rápido, funciona offline)
e sincronizados automaticamente com um arquivo num repositório GitHub
(armazenamento gratuito, até 1GB, com histórico de versões).

## Como funciona o armazenamento

- **Local (sempre ativo):** os dados ficam no `localStorage` do navegador.
- **GitHub (automático, configurado uma vez pelo administrador):** o app lê
  e grava um arquivo `data/db.json` dentro do repositório configurado, via
  uma rota de API própria (`/api/data`) que roda como função serverless. Ela
  guarda o token do GitHub em variável de ambiente, então **o token nunca
  chega ao navegador** de quem usa o site — ninguém que abrir o
  "Inspecionar" do navegador consegue vê-lo. Toda alteração no app é enviada
  automaticamente pro GitHub poucos segundos depois, e ao abrir o app em
  qualquer navegador ele já carrega os dados mais recentes de lá, sem
  precisar logar em nada além do próprio app.

Sem NextAuth, sem Prisma — usa Next.js normalmente (não é mais export
estático, já que agora tem uma rota de API), hospedado na Vercel.

## Configurando a sincronização com o GitHub (uma vez só, feito pelo admin)

1. Crie um repositório no GitHub (pode ser privado) — é nele que o arquivo
   `data/db.json` vai morar.
2. Gere um **Personal Access Token (fine-grained)** em
   https://github.com/settings/tokens?type=beta, com acesso limitado a esse
   repositório e permissão "Contents: Read and write".
3. No painel da Vercel, abra o projeto → **Settings → Environment
   Variables** e adicione:
   - `GITHUB_OWNER` — seu usuário do GitHub (ex: `murilolucas-collab`)
   - `GITHUB_REPO` — o nome do repositório (ex: `HealthScore`)
   - `GITHUB_BRANCH` — geralmente `main`
   - `GITHUB_TOKEN` — o token gerado no passo 2
4. Redeploy o projeto (a Vercel pede pra redeployar depois de adicionar
   variáveis de ambiente).

A partir daí, é automático: qualquer pessoa que entra no site já vê os
dados sincronizados, sem precisar configurar nada nem colar token nenhum. A
tela "Sincronização GitHub" no menu vira só um status + botões manuais
("carregar agora" / "salvar agora"), caso precise forçar uma atualização.

**Sem essas variáveis configuradas**, o app continua funcionando normalmente,
só que cada navegador guarda seus próprios dados sem sincronizar com os
demais (mesma limitação de antes).

## Login de teste (dados de exemplo pré-carregados)

- **Admin:** admin@agencia.com / admin123
- **CS (usuário padrão):** cs@agencia.com / cs123456

## Como publicar na Vercel

1. Suba esta pasta para um repositório GitHub.
2. Em https://vercel.com, "Add New..." → "Project" → importe o repositório.
3. A Vercel detecta Next.js sozinha — não precisa mudar nada nas
   configurações de build.
4. Configure as 4 variáveis de ambiente do GitHub (seção acima) antes ou
   depois do primeiro deploy — se adicionar depois, redeploy.

## Rodando localmente para testar antes de publicar

```bash
npm install
npm run dev
```

Acesse http://localhost:3000. Para testar a sincronização localmente,
crie um arquivo `.env.local` na raiz do projeto com as mesmas 4 variáveis
de ambiente (esse arquivo nunca deve ser commitado — já está no
`.gitignore`).
