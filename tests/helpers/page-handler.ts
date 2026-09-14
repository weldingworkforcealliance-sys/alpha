import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute the page's actual handler with controlled dependencies, without a DOM
// or a second implementation of its control flow.
export function pageHandler<T>(path: string, name: string, context: Record<string, unknown>): T {
  const source = ts.createSourceFile(
    path, readFileSync(join(process.cwd(), path), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX
  );
  let initializer: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) {
      initializer = node.initializer;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!initializer) throw new Error(`Handler ${name} not found in ${path}`);
  const { outputText } = ts.transpileModule(
    `const handler = ${initializer.getText(source)}; handler;`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }
  );
  return runInNewContext(outputText, context) as T;
}

export function pageEffect(path: string, context: Record<string, unknown>): () => void {
  const source = ts.createSourceFile(
    path, readFileSync(join(process.cwd(), path), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX
  );
  let callback: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (!callback && ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect') {
      callback = node.arguments[0];
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!callback) throw new Error(`Initial effect not found in ${path}`);
  const { outputText } = ts.transpileModule(
    `const effect = ${callback.getText(source)}; effect;`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }
  );
  return runInNewContext(outputText, context) as () => void;
}

