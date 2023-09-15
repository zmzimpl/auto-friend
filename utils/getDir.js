import path from "path";
import { fileURLToPath } from "url";

export const getDir = (file) =>
  path.resolve(fileURLToPath(import.meta.url), "../..", file);
