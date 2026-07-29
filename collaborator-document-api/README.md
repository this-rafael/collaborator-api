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

Discovery e contrato HTTP:

```bash
curl -i -H 'Accept: application/hal+json' http://localhost:3000/api/v1
curl http://localhost:3000/openapi.json
```

`GET /api/v1` publica a representação HAL de descoberta, ETag semântico e Problem Details para falhas. O OpenAPI é gerado pelos decorators Ts.ED e contém `discoverApi` e a rota não funcional `GET /health/live`; health não recebe HAL, ETag ou rate limit da descoberta.

O rate limit inicial é local à instância: `RATE_LIMIT_GET` consultas por `RATE_LIMIT_WINDOW_MS` milissegundos por IP e operação. Em implantação com múltiplas réplicas, os contadores não são compartilhados.

## Scripts

| Comando                 | Descrição                                    |
| ----------------------- | -------------------------------------------- |
| `pnpm dev`              | Sobe a API em watch mode                     |
| `pnpm build`            | Compila TypeScript com SWC para `dist/`      |
| `pnpm start`            | Executa o build                              |
| `pnpm typecheck`        | Typecheck sem emitir                         |
| `pnpm lint`             | ESLint                                       |
| `pnpm test`             | Vitest                                       |
| `pnpm test:unit`        | Apenas testes unitários                      |
| `pnpm hooks:install`    | Instala os git hooks (Lefthook)              |
| `pnpm hooks:pre-commit` | Executa o pre-commit em todos os arquivos    |
| `pnpm docs:api`         | Gera documentação TypeDoc em `docs/typedoc/` |
| `pnpm sonar:up`         | Sobe SonarQube (Compose profile `quality`)   |
| `pnpm sonar:scan`       | Cobertura LCOV + análise Sonar Scanner       |

## Qualidade

### TypeDoc

Gera a documentação de API a partir de `src/`:

```bash
pnpm docs:api
```

Saída em `docs/typedoc/` (gitignored). Abra `docs/typedoc/index.html` no navegador.

### SonarQube

SonarQube Community roda sob demanda no profile Compose `quality` (não sobe com o Mongo padrão). UI: [http://localhost:9000](http://localhost:9000).

```bash
pnpm sonar:up
```

No primeiro acesso, o login padrão é `admin` / `admin` (o Sonar exige trocar a senha; use pelo menos 12 caracteres). Crie um token de usuário em **My Account → Security** e defina no `.env`:

```text
SONAR_TOKEN=<seu-token>
```

Com Sonar UP e o token configurado:

```bash
pnpm sonar:scan
```

Isso roda `test:coverage` (gera `coverage/lcov.info`), espera o status `UP` e executa o scanner one-shot. O scan só completa se a suíte de testes passar (cobertura LCOV) e o `SONAR_TOKEN` estiver definido.

**Nota:** o Community Edition pode exigir memória/host suficientes (tipicamente ≥2 GB livres para o container). Se o container falhar ao subir por OOM ou limites do Docker, ajuste recursos do daemon ou use um host com mais RAM. Em Podman com SELinux, o volume do scanner usa `:Z`. Imagens usam FQIN (`docker.io/...`) para short-name enforcement. Sonar **não** entra no Lefthook/pre-commit.

## Git hooks (Lefthook)

A configuração ativa fica na **raiz do repositório**: [`lefthook.yml`](../lefthook.yml).

Após `pnpm install` neste pacote, o `prepare` registra o hook `pre-commit`. Em todo commit com arquivos sob `collaborator-document-api/`, o Prettier formata os staged files (`--write` + re-stage) e, em seguida, rodam em paralelo `typecheck`, `lint` e `test:unit`.

Para forçar a execução sem staged files:

```bash
pnpm hooks:pre-commit
```

## Stack desta fase

- Node.js 24 + TypeScript strict + ESM
- SWC (dev, build e Vitest) com suporte a decorators/metadata
- Ts.ED v8 sobre Express
- ESLint, Prettier, Vitest, Lefthook
- TypeDoc (`pnpm docs:api`)
- SonarQube Community + Scanner (Compose profile `quality`)
- Docker Compose com MongoDB replica set (`rs0`)

Domínio, Mongoose, Problem Details e demais diferenciais entram nas fases seguintes do ROADMAP.
