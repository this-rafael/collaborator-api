# Débitos de código não produtivo

Registro obrigatório de placeholders, stubs, mocks embutidos na aplicação e
implementações parciais, conforme o princípio VIII da constituição do projeto
(`.specify/memory/constitution.md`).

Mocks e fakes usados somente em testes não entram aqui.

## Open

### 2026-07-29 — `MongoDiscoveryAvailability` não consulta MongoDB

- Path: `src/shared/infrastructure/availability/mongo-discovery-availability.ts` (`MongoDiscoveryAvailability.isAvailable`)
- Tipo: stub
- Motivo: na SPEC-006 o adaptador foi entregue só para fechar a porta `DiscoveryAvailability` e o mapeamento `503 SERVICE_UNAVAILABLE` de `discoverApi`; `isAvailable()` retorna `true` fixo (try/catch morto) e não usa `MongooseService`/ping. O cenário HTTP `DISC-005` força indisponibilidade via `DISCOVERY_TEST_FAILURE` no controller, não via este adaptador. Readiness completo permanece na SPEC-007.
- Critério de conclusão: o adaptador injeta a conexão Mongo existente, verifica disponibilidade real (ex.: estado da conexão ou `ping`), retorna `false` quando a dependência falha, e `DiscoverApiQuery` / `discoverApi` passam a produzir `503` sem flag de teste quando Mongo estiver indisponível.
- Referência: `specs/006-discovery-http-core` (plan storage + research “porta de disponibilidade”; T114; `operationId` `discoverApi`; FR-009 / US3 AC3 / DISC-005)

### 2026-07-29 — `DISCOVERY_TEST_FAILURE` no controller

- Path: `src/controllers/api-root.controller.ts` (`discoverApi`, bloco `NODE_ENV === "test"`)
- Tipo: mock
- Motivo: força 500/503 via env antes de rate limit / query / availability; DISC-005 não passa pelo adaptador real.
- Critério de conclusão: remover o hook; 503 via `DiscoveryAvailability`; 500 via caminho inesperado + filtro global.
- Referência: `discoverApi` / SPEC-006 / DISC-005

### 2026-07-29 — Health incompleto

- Path: `src/controllers/health.controller.ts`
- Tipo: partial
- Motivo: só `GET /health/live` com corpo `{status:"ok"}`; `operationId` publicado fica `live` (não `getLiveness`); sem `GET /health/ready` / 503 Problem Details.
- Critério de conclusão: `@OperationId("getLiveness")`; implementar `getReadiness` com checagem real de dependência e 503 `application/problem+json`.
- Referência: `getLiveness`, `getReadiness` / SPEC-007 (quando existir) / expected OpenAPI

### 2026-07-29 — porta `Clock` sem adaptador de produção

- Path: `src/shared/application/ports/clock.ts`; uso em `src/shared/presentation/http/middlewares/rate-limit.middleware.ts` (`clock?.now() ?? new Date()`)
- Tipo: partial
- Motivo: porta existe; não há `SystemClock` em infra; produção cai no fallback `new Date()`.
- Critério de conclusão: `SystemClock` implementando `Clock`; rate limit (e futuros consumidores) injetam o adaptador sem fallback ad hoc.
- Referência: princípio II (portas/adaptadores); rate limit SPEC-006

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
