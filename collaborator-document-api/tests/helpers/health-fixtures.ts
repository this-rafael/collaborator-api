export interface HealthStatus {
  status: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  traceId: string;
}

export const healthStatusFixture: HealthStatus = {status: "ok"};

export const healthProblemDetailsFixture = (
  overrides: Partial<ProblemDetails> = {}
): ProblemDetails => ({
  type: "https://api.example.com/problems/service-unavailable",
  title: "Serviço temporariamente indisponível",
  status: 503,
  detail: "A dependência necessária está temporariamente indisponível.",
  instance: "/health/ready",
  code: "SERVICE_UNAVAILABLE",
  traceId: "01J3Y2QHB8FV4RGY7Y1QXNT2D4",
  ...overrides
});
