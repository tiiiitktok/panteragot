# Sales Radar — versão Vercel

Painel multiusuário que recebe webhooks de vendas de qualquer plataforma
(gateway) e mostra quantidade e valor total de vendas **geradas**,
**aprovadas** e **reembolsadas**, filtráveis por período. Cada pessoa cria
sua própria conta (e-mail + senha) e tem seus próprios gateways,
notificações e notificações push — totalmente isolado de outras contas.

Esta versão foi adaptada para rodar na Vercel como funções serverless, e
usa um banco **Postgres** (via integração Supabase) para guardar os dados.

## Contas de usuário

Ao acessar o site pela primeira vez, aparece uma tela de login/cadastro.
Qualquer pessoa pode criar uma conta com e-mail e senha — não tem
aprovação manual nem convite necessário. Cada conta só vê os próprios
gateways e notificações; não existe um jeito de uma conta ver os dados de
outra.

A sessão fica guardada num cookie seguro por 30 dias. Não precisa
configurar nada a mais para isso funcionar — as chaves de segurança usadas
para assinar as sessões são geradas automaticamente na primeira vez que
alguém acessa, do mesmo jeito que as chaves de notificação push.

## Por que precisa de um banco de dados

Na Vercel, cada requisição roda numa função que liga, responde, e desliga
— nada fica guardado na memória entre uma chamada e outra, e o disco é
somente leitura. Por isso os dados (contas, gateways cadastrados,
notificações recebidas) precisam ficar em um banco externo.

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

## Notificações no celular (iPhone e Android)

O painel pode enviar uma notificação push para o celular a cada venda
gerada ou aprovada — funciona depois de adicionar o site à tela de
início, como um app.

**Não precisa configurar nada manualmente**: as chaves necessárias
(VAPID) são geradas automaticamente pelo próprio código na primeira vez
que alguém acessa e ficam guardadas no mesmo banco Postgres.

### Como ativar

**No Android (Chrome):**
1. Abra o site normalmente
2. Um aviso "Ative as notificações" aparece no topo — toque em **ativar
   notificações** e aceite a permissão do navegador
3. Pronto — funciona mesmo sem adicionar à tela de início, mas se quiser
   um ícone de app, use o menu do Chrome → "Adicionar à tela inicial"

**No iPhone (Safari):**
O iOS só permite notificações push para sites que foram **instalados**
como app — não funciona direto no navegador. Passo a passo:
1. Abra o site no Safari
2. Toque no ícone de **Compartilhar** (o quadrado com a seta pra cima)
3. Toque em **"Adicionar à Tela de Início"**
4. Feche o Safari e abra o app pelo ícone que apareceu na tela de início
   (não pelo Safari)
5. Agora sim o aviso "Ative as notificações" aparece — toque nele e
   aceite a permissão

Isso é uma limitação da Apple, não do código — não tem como pular essa
etapa de instalação no iPhone.

### Testando

Depois de ativar, o próprio botão já dispara uma notificação de teste.
Também dá pra testar de novo a qualquer momento usando os botões
"testar venda gerada" / "testar venda aprovada" na aba Webhooks — se as
notificações estiverem ativadas, elas devem aparecer no celular também,
não só no painel.

## Segurança (recomendado)

Defina uma variável de ambiente `WEBHOOK_SECRET` no painel da Vercel
(aba Settings → Environment Variables) e adicione `?token=seu-valor` no
final das URLs de webhook cadastradas na plataforma de vendas. Isso
impede que qualquer pessoa que descubra a URL envie notificações falsas.
