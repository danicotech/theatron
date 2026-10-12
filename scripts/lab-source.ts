import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Prefer the active design workspace; a standalone clone uses the saved source. */
export function labSource(file: string): string {
  const workspace = '../scrollcraft/builds/lunjian/lab';
  const root =
    process.env.LUNJIAN_SOURCE_ROOT ??
    (existsSync(resolve(workspace, 'lunjian-layout.html')) ? workspace : 'sources/lunjian/lab');
  return resolve(root, file);
}
