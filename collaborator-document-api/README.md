# Collaborator Document API

Fundação da API (Fase 1): Node.js 24, TypeScript strict/ESM, SWC, Ts.ED v8 + Express, Vitest, Lefthook e MongoDB em replica set.

## Pré-requisitos

- Node.js 24 LTS (ver `.nvmrc`)
- pnpm (via Corepack)
- Docker e Docker Compose

## Setup

```bash
corepack enable
pnpm install
cp .env.example .env
```

## MongoDB (replica set)

```bash
docker compose up -d mongodb mongodb-init
```

O serviço `mongodb-init` inicializa o replica set `rs0` e encerra. O Mongo fica saudável quando o healthcheck passa.

URI padrão:

```text
mongodb://localhost:27017/collaborator_documents?replicaSet=rs0
```

Para subir API + Mongo juntos:

```bash
docker compose --profile full up --build
```

## Desenvolvimento

```bash
pnpm dev
```

Health check:

```bash
curl http://localhost:3000/health/live
```

## Scripts

| Comando                 | Descrição                                 |
| ----------------------- | ----------------------------------------- |
| `pnpm dev`              | Sobe a API em watch mode                  |
| `pnpm build`            | Compila TypeScript com SWC para `dist/`   |
| `pnpm start`            | Executa o build                           |
| `pnpm typecheck`        | Typecheck sem emitir                      |
| `pnpm lint`             | ESLint                                    |
| `pnpm test`             | Vitest                                    |
| `pnpm test:unit`        | Apenas testes unitários                   |
| `pnpm hooks:install`    | Instala os git hooks (Lefthook)           |
| `pnpm hooks:pre-commit` | Executa o pre-commit em todos os arquivos |

## Git hooks (Lefthook)

A configuração ativa fica na **raiz do repositório**: [`lefthook.yml`](../lefthook.yml).

Após `pnpm install` neste pacote, o `prepare` registra o hook `pre-commit`. Em todo commit com arquivos `.ts`/`.js` sob `collaborator-document-api/`, rodam `typecheck`, `lint` e `test:unit`.

Para forçar a execução sem staged files:

```bash
pnpm hooks:pre-commit
```

## Stack desta fase

- Node.js 24 + TypeScript strict + ESM
- SWC (dev, build e Vitest) com suporte a decorators/metadata
- Ts.ED v8 sobre Express
- ESLint, Prettier, Vitest, Lefthook
- Docker Compose com MongoDB replica set (`rs0`)

Domínio, Mongoose, Problem Details e demais diferenciais entram nas fases seguintes do ROADMAP.
