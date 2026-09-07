import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dataDirectory = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

export function loadCollection(filename, fallback) {
  mkdirSync(dataDirectory, { recursive: true });
  const filePath = join(dataDirectory, filename);
  if (!existsSync(filePath)) {
    writeFileSync(filePath, JSON.stringify(fallback, null, 2));
    return fallback;
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function saveCollection(filename, collection) {
  mkdirSync(dataDirectory, { recursive: true });
  writeFileSync(join(dataDirectory, filename), JSON.stringify(collection, null, 2));
}
