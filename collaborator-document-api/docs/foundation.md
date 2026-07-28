# Fundação da API

## Ambiente obrigatório

Copie `.env.example` para `.env` e informe `NODE_ENV`, `PORT`, `MONGODB_URI` e `LOG_LEVEL`. A URI MongoDB deve apontar para um banco e, quando usar `mongodb://`, incluir `replicaSet`.

## Comandos

- `pnpm verify`: validação completa, incluindo cobertura de 90% e smoke com MongoDB real.
- `pnpm test:integration`: integração serial contra um replica set iniciado por Testcontainers.
- `pnpm test:smoke`: build compilado, HTTP e desligamento por `SIGTERM`.
- `docker compose up -d mongodb mongodb-init`: MongoDB local para desenvolvimento.

Em Docker, Testcontainers usa a configuração padrão. Em Podman rootless, exporte `DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock`; a suíte desabilita Ryuk somente nesse modo e encerra o container explicitamente.

## Base para specs

As regras de domínio e aplicação usam `neverthrow` por meio de `src/shared/result.ts`.
Falhas públicas derivam de `DomainFailure` ou `ApplicationFailure`; exceções não representam
falhas de negócio.

Os helpers de `tests/helpers/` fornecem fixtures determinísticas, `FixedClock`, falhas
simuladas e limpeza de banco para que uma nova spec possa iniciar seus testes sem criar
infraestrutura própria.
