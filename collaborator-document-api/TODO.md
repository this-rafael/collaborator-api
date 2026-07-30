# Débitos de código não produtivo

Registro obrigatório de placeholders, stubs, mocks embutidos na aplicação e
implementações parciais, conforme o princípio VIII da constituição do projeto
(`.specify/memory/constitution.md`).

Mocks e fakes usados somente em testes não entram aqui.

## Open

### 2026-07-29 — `MongoDiscoveryAvailability` não consulta MongoDB

- Path: `src/shared/infrastructure/availability/mongo-discovery-availability.ts` (`MongoDiscoveryAvailability.isAvailable`)
- Tipo: stub
- Motivo: na SPEC-006 o adaptador foi entregue só para fechar a porta `DiscoveryAvailability` e o mapeamento `503 SERVICE_UNAVAILABLE` de `discoverApi`; `isAvailable()` retorna `true` fixo e não usa `MongooseService`/ping. O cenário HTTP `DISC-005` força indisponibilidade via `DISCOVERY_TEST_FAILURE` no controller, não via este adaptador.
- Critério de conclusão: o adaptador injeta a conexão Mongo existente, verifica disponibilidade real (ex.: estado da conexão ou `ping`), retorna `false` quando a dependência falha, e `DiscoverApiQuery` / `discoverApi` passam a produzir `503` sem flag de teste quando Mongo estiver indisponível.
- Referência: `specs/006-discovery-http-core` (plan storage + research “porta de disponibilidade”; T114; `operationId` `discoverApi`; FR-009 / US3 AC3 / DISC-005)

### 2026-07-29 — `DISCOVERY_TEST_FAILURE` no controller

- Path: `src/controllers/api-root.controller.ts` (`discoverApi`, bloco `NODE_ENV === "test"`)
- Tipo: mock
- Motivo: força 500/503 via env antes de rate limit / query / availability; DISC-005 não passa pelo adaptador real.
- Critério de conclusão: remover o hook; 503 via `DiscoveryAvailability`; 500 via caminho inesperado + filtro global.
- Referência: `discoverApi` / SPEC-006 / DISC-005

### 2026-07-30 — `HEALTH_TEST_READINESS` no health path

- Path: `src/controllers/health.controller.ts` (`ready`); `src/shared/infrastructure/availability/mongo-readiness-check.ts` (`isReady`)
- Tipo: mock
- Motivo: sob `NODE_ENV === "test"`, `HEALTH_TEST_READINESS` força 200/503 sem passar exclusivamente pelo ping Mongo de produção.
- Critério de conclusão: remover os hooks de env; testes de readiness controlam disponibilidade via stub/`ReadinessCheck` substituível ou falha real da dependência.
- Referência: `getReadiness` / SPEC-007

### 2026-07-30 — `discoverApi` rate limit sem `Clock` injetado

- Path: `src/controllers/api-root.controller.ts` (`RateLimitMiddleware` de `discoverApi`)
- Tipo: partial
- Motivo: `SystemClock` existe e é injetado nos rate limits de collaborators/document-types; o limiter de `discoverApi` ainda omite `clock` e cai no fallback `new Date()` dentro de `RateLimitMiddleware`.
- Critério de conclusão: `discoverApi` injeta `SystemClock` (ou `Clock`) sem depender do fallback ad hoc.
- Referência: princípio II; rate limit SPEC-006

<!--
Formato de entrada:

### YYYY-MM-DD — título curto

- Path: `src/...`
- Tipo: placeholder | stub | mock | partial
- Motivo: por que não foi produtivo nesta entrega
- Critério de conclusão: o que substitui o débito
- Referência: spec / feature / operationId / tarefa (quando existir)
-->

## Done

### 2026-07-29 — Health incompleto

- Path: `src/controllers/health.controller.ts`
- Tipo: partial
- Resolvido em: 2026-07-30
- Evidência: `@OperationId("getLiveness")` / `@OperationId("getReadiness")`; `GET /health/live` e `GET /health/ready`; readiness com `MongoReadinessCheck` (ping) e 503 `application/problem+json`.
- Referência: SPEC-007

### 2026-07-29 — porta `Clock` sem adaptador de produção

- Path: `src/shared/application/ports/clock.ts`; `src/shared/infrastructure/time/system-clock.ts`
- Tipo: partial
- Resolvido em: 2026-07-30
- Evidência: `SystemClock` implementa `Clock` e é injetado em collaborators/document-types (use cases e rate limit). Residual de wiring em `discoverApi` permanece em Open.
- Referência: princípio II; SPEC-006 / módulos 008+
