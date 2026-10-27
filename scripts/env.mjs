import fs from "fs";
import path from "path";

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function loadLocalEnv() {
  loadEnv(path.join(process.cwd(), ".env.local"));
  loadEnv(path.join(process.cwd(), ".env"));
}

export function normalizePostgresUrl(url) {
  const parsed = new URL(url);
  const mode = parsed.searchParams.get("sslmode");
  if (!mode || mode === "require" || mode === "prefer" || mode === "verify-ca") {
    parsed.searchParams.set("sslmode", "verify-full");
  }
  return parsed.toString();
}
