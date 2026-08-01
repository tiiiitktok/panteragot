# Sales Radar — versão Vercel

Painel que recebe webhooks de vendas de qualquer plataforma (gateway) e
mostra quantidade e valor total de vendas **geradas** e **aprovadas**,
filtráveis por período (hoje, ontem, semana, mês, ou uma data específica).
Tem uma aba separada de **Webhooks** para cadastrar cada gateway (Hotmart,
Kiwify, Stripe, etc) e gerar as URLs específicas de cada um.

Esta versão foi adaptada para rodar na Vercel como funções serverless, e
usa um banco **Postgres** (via integração Supabase) para guardar os dados.

## Por que precisa de um banco de dados

Na Vercel, cada requisição roda numa função que liga, responde, e desliga
— nada fica guardado na memória entre uma chamada e outra, e o disco é
somente leitura. Por isso os dados (gateways cadastrados, notificações
recebidas) precisam ficar em um banco externo.

## Sobre a variável de conexão do banco

O código procura automaticamente, entre as variáveis de ambiente do
projeto, qualquer uma que termine em `_POSTGRES_URL` (ex:
`Roicher_POSTGRES_URL`) ou `_DATABASE_URL`. Isso porque a Vercel prefixa
essas variáveis com o nome do recurso conectado, que varia de projeto
para projeto — assim o código funciona sem precisar editar nada, seja
qual for o prefixo no seu projeto.

Na primeira vez que alguém acessa qualquer rota da API, o código cria
automaticamente (se ainda não existir) uma tabela chamada
`sales_radar_kv` no seu banco Postgres, usada para guardar os gateways e
notificações. Não precisa rodar nenhum SQL manualmente.

## Passo a passo do deploy

**1. Suba o código para o GitHub**
Crie um repositório novo e envie todos os arquivos desta pasta (ou
atualize o repositório existente com estes arquivos).

**2. Confirme que tem um banco Postgres conectado**
No painel do projeto na Vercel → aba **Storage** → deve aparecer um
banco conectado (Supabase, Neon, ou qualquer provedor Postgres). Se
ainda não tiver nenhum, adicione um por ali (o plano gratuito do
Supabase é suficiente).

**3. Redeploy**
Vá na aba **Deployments**, clique nos três pontinhos do deploy mais
recente e escolha **Redeploy** — isso garante que o código novo (e as
variáveis de ambiente do banco) estejam ativos.

Pronto — acesse a URL do seu projeto e o painel deve funcionar completo:
cadastro de gateway, recebimento de webhook, estatísticas por período.

## Diferenças em relação à versão de servidor único

- **Sem conexão em tempo real (SSE):** a Vercel não mantém conexões
  abertas por função serverless. O painel agora se atualiza sozinho a
  cada 5 segundos (polling) em vez de receber push instantâneo.
- **URLs de webhook mudaram de formato:** antes eram `/webhook/...`,
  agora são `/api/webhook/...` (padrão de rotas da Vercel). A aba
  Webhooks do painel sempre mostra a URL certa e atualizada.

## Testando localmente antes de fazer deploy

Sem nenhuma variável de banco no ambiente, o projeto usa automaticamente
um arquivo local em `data/` como armazenamento — só funciona rodando
localmente com o Vercel CLI (`npm i -g vercel` e depois `vercel dev`),
não funciona em produção na Vercel (lá o disco é somente leitura).

## Segurança (recomendado)

Defina uma variável de ambiente `WEBHOOK_SECRET` no painel da Vercel
(aba Settings → Environment Variables) e adicione `?token=seu-valor` no
final das URLs de webhook cadastradas na plataforma de vendas. Isso
impede que qualquer pessoa que descubra a URL envie notificações falsas.
