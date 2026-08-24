// levels 快照备份：复制 levels/*.txt + src/core/levels.ts → backups/<时间戳>/
// 保留最近 10 份。用法：npm run backup（建议在 verify 全绿后运行）
import { readdirSync, copyFileSync, mkdirSync, rmSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'levels');
const tsFile = resolve(root, 'src/core/levels.ts');
const backupRoot = resolve(root, 'backups');

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dest = resolve(backupRoot, stamp);
mkdirSync(dest, { recursive: true });

// 复制 txt 与 levels.ts
let n = 0;
for (const f of readdirSync(src)) {
  if (f.endsWith('.txt')) {
    copyFileSync(resolve(src, f), resolve(dest, f));
    n++;
  }
}
copyFileSync(tsFile, resolve(dest, 'levels.ts'));
console.log(`已备份 ${n} 个 txt + levels.ts → backups/${stamp}`);

// 只保留最近 10 份
if (existsSync(backupRoot)) {
  const dirs = readdirSync(backupRoot)
    .filter(d => statSync(resolve(backupRoot, d)).isDirectory())
    .sort();
  while (dirs.length > 10) {
    const old = dirs.shift()!;
    rmSync(resolve(backupRoot, old), { recursive: true, force: true });
    console.log(`清理旧备份：${old}`);
  }
}
