import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Assertions follow the real controls, handlers and page views after extraction. */
export function readAdminImplementation() {
  const root = join(process.cwd(), "components", "admin");
  return ["AdminControls.tsx", "useAdminController.tsx", ...readdirSync(join(root, "pages")).map((name) => join("pages", name))]
    .map((file) => readFileSync(join(root, file), "utf8")).join("\n");
}
