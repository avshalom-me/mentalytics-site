import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

// A Next.js route file may export only its HTTP handlers and the route segment
// config. Anything else - usually a helper that another route imports - fails
// `next build --webpack` at the type check, on the guard Next generates for each
// route (createTypeGuardFile in next/dist/build/webpack/plugins/next-types-plugin;
// the names below are that guard's list).
//
// Nothing else sees it, which is why it is checked here, on every push:
// - the Vercel build (Turbopack) and `tsc --noEmit` do not generate that guard;
// - the webpack build misses exactly the case that matters. A route module that
//   other routes import sits in a shared chunk, and Next writes guards only for
//   named route chunks. cron/weekly-report exported runReport to three routes
//   that way, unnoticed, until the report moved to app/lib/admin-report.ts.
const ROUTE_EXPORTS = new Set([
  "GET", "HEAD", "OPTIONS", "POST", "PUT", "DELETE", "PATCH",
  "config", "generateStaticParams", "unstable_prefetch", "revalidate", "dynamic",
  "dynamicParams", "fetchCache", "preferredRegion", "runtime", "maxDuration",
]);

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? routeFiles(join(dir, e.name)) : /^route\.[jt]sx?$/.test(e.name) ? [join(dir, e.name)] : [],
  );
}

function boundNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((el) => (ts.isOmittedExpression(el) ? [] : boundNames(el.name)));
}

// The names a module exports as values. Read from the syntax tree and not line
// by line: these files hold long template literals (email HTML, LLM prompts)
// where a line may well start with "export", and one statement can export
// several names. Types and interfaces are erased at build time, so they are not
// part of the contract; a name in an `export { ... }` list counts as a value
// unless the list says `type`.
function valueExports(file: string, source: string): string[] {
  const names = new Set<string>();
  const has = (st: ts.Statement, kind: ts.SyntaxKind) =>
    ts.canHaveModifiers(st) && (ts.getModifiers(st) ?? []).some((m) => m.kind === kind);

  for (const st of ts.createSourceFile(file, source, ts.ScriptTarget.Latest).statements) {
    if (ts.isExportAssignment(st)) {
      names.add("default");
    } else if (ts.isExportDeclaration(st)) {
      if (st.isTypeOnly) continue;
      const list = st.exportClause;
      // `export * from` hands on whatever the other module exports, today and later.
      if (!list) names.add("export *");
      else if (ts.isNamespaceExport(list)) names.add(list.name.text);
      else for (const el of list.elements) if (!el.isTypeOnly) names.add(el.name.text);
    } else if (has(st, ts.SyntaxKind.ExportKeyword) && !ts.isInterfaceDeclaration(st) && !ts.isTypeAliasDeclaration(st)) {
      if (has(st, ts.SyntaxKind.DefaultKeyword)) names.add("default");
      else if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) for (const n of boundNames(d.name)) names.add(n);
      else names.add((st as ts.DeclarationStatement).name?.text ?? "?");
    }
  }
  return [...names];
}

describe("route files", () => {
  it("export only their HTTP handlers and the segment config", () => {
    const files = routeFiles("app");
    expect(files.length, "no route files found under app/").toBeGreaterThan(0);
    // utf8 text, not a grep: app/api/ads-sync/route.ts holds NUL bytes inside
    // string literals, so grep and ripgrep skip it as a binary file.
    const offenders = files.flatMap((file) =>
      valueExports(file, readFileSync(file, "utf8"))
        .filter((name) => !ROUTE_EXPORTS.has(name))
        .map((name) => `${file.replace(/\\/g, "/")}: ${name}`),
    );
    expect(offenders, "a route file may export only its handlers and the segment config - shared code goes to app/lib").toEqual([]);
  });
});

describe("valueExports", () => {
  it("sees every way a module can export a value", () => {
    const source = `
      export const dynamic = "force-dynamic", maxDuration = 300;
      export async function GET() {}
      export function helper() {}
      export const run = () => helper();
      export const { a, b: [c] } = settings;
      export class Thing {}
      export enum Kind { A }
      const local = 1;
      export { local, local as alias };
      export { other } from "./other";
      export * as everything from "./other";
    `;
    expect(valueExports("route.ts", source)).toEqual([
      "dynamic", "maxDuration", "GET", "helper", "run", "a", "c", "Thing", "Kind", "local", "alias", "other", "everything",
    ]);
    expect(valueExports("route.ts", "export default function handler() {}")).toEqual(["default"]);
    expect(valueExports("route.ts", "const handler = () => {};\nexport default handler;")).toEqual(["default"]);
    expect(valueExports("route.ts", 'export * from "./other";')).toEqual(["export *"]);
  });

  it("leaves types alone", () => {
    const source = `
      export type ReportType = "weekly" | "monthly";
      export interface Result { ok: boolean }
      export type { Other } from "./other";
      export { type Another } from "./other";
      type Local = string;
      export type { Local };
    `;
    expect(valueExports("route.ts", source)).toEqual([]);
  });

  it("is not misled by text that only looks like an export, or by a NUL byte in a string", () => {
    const source = [
      "// export function inLineComment() {}",
      "/*",
      "export const inBlockComment = 1;",
      "*/",
      "const html = `",
      "export const inTemplate = 1;",
      "`;",
      'const separator = "a\0b";',
      "export async function POST() {}",
    ].join("\n");
    expect(valueExports("route.ts", source)).toEqual(["POST"]);
  });
});
