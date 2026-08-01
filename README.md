# Sales Radar — versão Vercel

Painel que recebe webhooks de vendas de qualquer plataforma (gateway) e
mostra quantidade e valor total de vendas **geradas** e **aprovadas**,
filtráveis por período (hoje, ontem, semana, mês, ou uma data específica).
Tem uma aba separada de **Webhooks** para cadastrar cada gateway (Hotmart,
Kiwify, Stripe, etc) e gerar as URLs específicas de cada um.

Esta versão foi adaptada para rodar na Vercel como funções serverless.

## Por que precisa de um banco de dados (Upstash Redis)

Na Vercel, cada requisição roda numa função que liga, responde, e desliga
— nada fica guardado na memória entre uma chamada e outra, e o disco é
somente leitura. Por isso os dados (gateways cadastrados, notificações
recebidas) precisam ficar em um banco externo. Uso o **Upstash Redis**,
que tem plano gratuito generoso e se conecta em poucos cliques, sem
precisar mexer em código.

## Passo a passo do deploy

**1. Suba o código para o GitHub**
Crie um repositório novo e envie todos os arquivos desta pasta.

**2. Importe o projeto na Vercel**
Em vercel.com → "Add New" → "Project" → selecione o repositório.
Não precisa configurar nada de build (a Vercel detecta o `vercel.json`
automaticamente). Clique em "Deploy".

**3. Adicione o Redis (Upstash)**
No painel do seu projeto na Vercel:
- Vá na aba **Storage**
- Clique em **Create Database** (ou "Browse Marketplace")
- Escolha **Upstash for Redis** (às vezes aparece como "Redis")
- Crie o banco e conecte ao seu projeto quando perguntado

Isso adiciona automaticamente as variáveis de ambiente `KV_REST_API_URL`
e `KV_REST_API_TOKEN` ao projeto — é só isso que o código precisa para
funcionar, nada a configurar manualmente.

**4. Redeploy**
Depois de conectar o Redis, vá na aba **Deployments** e clique em
"Redeploy" no último deploy (as variáveis de ambiente novas só valem a
partir do próximo deploy).

Pronto — acesse a URL que a Vercel te deu (ex: `https://seu-projeto.vercel.app`)
e o painel deve funcionar completo: cadastro de gateway, recebimento de
webhook, estatísticas por período.

## Diferenças em relação à versão de servidor único

- **Sem conexão em tempo real (SSE):** a Vercel não mantém conexões
  abertas por função serverless. O painel agora se atualiza sozinho a
  cada 5 segundos (polling) em vez de receber push instantâneo. A
  diferença na prática é pequena — no máximo alguns segundos de atraso.
- **URLs de webhook mudaram de formato:** antes eram `/webhook/...`,
  agora são `/api/webhook/...` (padrão de rotas da Vercel). Se você já
  tinha cadastrado a URL antiga em alguma plataforma, precisa trocar
  pela nova (a aba Webhooks do painel sempre mostra a URL certa e
  atualizada).

## Testando localmente antes de fazer deploy

Sem Redis configurado, o projeto usa automaticamente um arquivo local em
`data/` como armazenamento — só funciona rodando localmente com o Vercel
CLI (`npm i -g vercel` e depois `vercel dev`), não funciona em produção
na Vercel (lá o disco é somente leitura, por isso o Redis é obrigatório
para o site publicado).

## Segurança (recomendado)

Defina uma variável de ambiente `WEBHOOK_SECRET` no painel da Vercel
(aba Settings → Environment Variables) e adicione `?token=seu-valor` no
final das URLs de webhook cadastradas na plataforma de vendas. Isso
impede que qualquer pessoa que descubra a URL envie notificações falsas.
