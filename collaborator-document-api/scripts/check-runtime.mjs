const minimumNode = [24, 0, 0];
const minimumPnpm = [11, 9, 0];

function parseVersion(value) {
  const match = /v?(\d+)\.(\d+)\.(\d+)/.exec(value ?? "");
  return match ? match.slice(1).map(Number) : undefined;
}

function isAtLeast(actual, minimum) {
  return (
    actual.some((part, index) => (part !== minimum[index] ? part > minimum[index] : false)) ||
    actual.every((part, index) => part === minimum[index])
  );
}

export function validateRuntime({nodeVersion, packageManagerUserAgent}) {
  const issues = [];
  const node = parseVersion(nodeVersion);
  const pnpm = /pnpm\/(\d+\.\d+\.\d+)/.exec(packageManagerUserAgent ?? "")?.[1];
  const pnpmVersion = parseVersion(pnpm);

  if (!node || !isAtLeast(node, minimumNode)) issues.push("Node.js 24.0.0 or newer is required");
  if (!pnpmVersion || !isAtLeast(pnpmVersion, minimumPnpm))
    issues.push("pnpm 11.9.0 or newer is required");
  return issues;
}

const issues = validateRuntime({
  nodeVersion: process.version,
  packageManagerUserAgent: process.env.npm_config_user_agent
});
if (issues.length > 0) {
  process.stderr.write(`${issues.join("; ")}\n`);
  process.exitCode = 1;
}
