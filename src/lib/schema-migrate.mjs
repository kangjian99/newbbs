import fs from "fs";
import path from "path";

export function splitSql(source) {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function loadMigrations(dir) {
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => ({
      id: file,
      statements: splitSql(fs.readFileSync(path.join(dir, file), "utf8")),
    }));
}
