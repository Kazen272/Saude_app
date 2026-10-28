# Saúde

App Android pessoal que centraliza treino (Hevy), dieta (FatSecret), dados do relógio (Zepp / Mi Fitness) e peso, e calcula gasto, déficit e projeção da meta.

## Stack

- **App:** Expo SDK 58 + Expo Router (TypeScript), em `src/app/`
- **Backend:** Supabase (Postgres, Auth, Storage), projeto `saude-app` em São Paulo
- **Banco:** migrações em `supabase/migrations/`; cada pessoa só acessa os próprios dados (RLS)

## Estrutura

```
src/app/            telas (cada arquivo é uma rota)
  login.tsx         entrar / criar conta
  (protegido)/      tudo que exige login
    (abas)/         Hoje, Progresso, Registrar, Fotos, Mais
    sono, relatorio, lembretes/, exames/
src/components/     componentes visuais
src/lib/            Supabase, cálculos, leitura e gravação de dados
supabase/migrations SQL aplicado no banco
```

## Comandos

```bash
npm install
npm test           # testes dos cálculos
npm run typecheck  # checagem de tipos
npx expo start     # servidor de desenvolvimento
```

## Gerar o APK

Pelo site do Expo (projeto ligado a este repositório): **Builds → Build from GitHub**, plataforma Android, perfil **preview**. O APK fica disponível para baixar e instalar no celular.

## Atualizações pelo ar

O app usa EAS Update (canal `preview`). A cada envio para a `main`, o workflow
`.eas/workflows/atualizacao-pelo-ar.yml` publica o código novo, e os APKs
instalados baixam a atualização ao abrir o app.

Só vale para mudanças de código JavaScript. Ao adicionar ou atualizar uma
biblioteca nativa, a impressão digital (`runtimeVersion: fingerprint`) muda e é
preciso gerar um APK novo.

## Status

- [x] Banco, login e regras de acesso
- [x] Registro de peso, medidas e água
- [x] Cálculos: metabolismo basal, gasto, déficit, média móvel, projeção, recalibração
- [x] Leitura do Health Connect: passos, calorias, FC de repouso, sono, treinos, nutrição e peso (últimos 28 dias)
- [ ] Dieta do FatSecret: entra pelo Health Connect se o FatSecret gravar nutrição lá (a confirmar no celular)
- [x] Gráficos de progresso: peso com média, meta e projeção; déficit diário; resumo da semana; previsto × real
- [x] Fotos de progresso: câmera ou galeria, pasta privada, comparativo antes × agora e linha do tempo
- [x] Sono: registro manual (deitou/acordou/qualidade), média, horário médio e regularidade
- [x] Check-in diário: energia, fome e humor, com alerta de déficit agressivo
- [x] Lembretes com recorrência: horários fixos ou a cada X tempo, por dia da semana; abrem a tela certa
- [x] Relatório de domingo: semana × semana anterior, o que melhorou e piorou
- [x] Exames de sangue: laudo anexado, valores digitados, faixa do laboratório ou referência por idade e sexo, histórico por marcador
- [x] Usabilidade: primeiro acesso guiado, peso digitável, registro em dias passados, histórico com apagar/corrigir, check-in compacto, desfazer água, seletores de data e hora
- [x] Informações: balanço parcial + ontem completo, projeção em faixa, frescor dos dados do relógio, proteína e macros, aviso de ritmo, cintura ÷ altura, tendências de 8 semanas (treinos, passos, FC de repouso)
- [ ] Leitura automática do laudo (no celular ou por IA)

## Configuração do Supabase (uma vez)

Para o link de confirmação do e-mail abrir o app: **Authentication → URL Configuration → Redirect URLs**, adicionar `saudeapp://**`.
