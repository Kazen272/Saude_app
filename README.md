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
  (abas)/           Hoje, Progresso, Registrar, Fotos, Fontes
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

## Status

- [x] Banco, login e regras de acesso
- [x] Registro de peso, medidas e água
- [x] Cálculos: metabolismo basal, gasto, déficit, média móvel, projeção, recalibração
- [ ] Leitura do Health Connect (relógio e Hevy)
- [ ] Dieta do FatSecret (depende do teste do Health Connect)
- [ ] Gráficos de progresso
- [ ] Fotos de progresso
