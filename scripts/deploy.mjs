// 部署脚本：npm run build 后把 dist/ 推到 gh-pages 分支（GitHub Pages 发布）。
// 用临时 worktree 避免污染工作区；无需 gh-pages 等额外依赖。
// 用法：npm run deploy（需已配置 origin remote）
import { execSync } from 'node:child_process';
import { rmSync, existsSync, cpSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = resolve(root, '.deploy-tmp');
const run = (cmd, opts = {}) => execSync(cmd, { cwd: root, stdio: 'inherit', ...opts });

try {
  // 1. 构建
  console.log('[deploy] 构建生产包…');
  run('npm run build');

  // 2. 准备临时 worktree（gh-pages 分支）
  if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
  const branches = execSync('git branch --list gh-pages', { cwd: root }).toString().trim();
  if (branches) {
    console.log('[deploy] 更新 gh-pages worktree…');
    run(`git worktree remove --force ${JSON.stringify(tmp)} 2>$null`, { shell: 'cmd.exe' });
    rmSync(tmp, { recursive: true, force: true });
    run(`git worktree add ${JSON.stringify(tmp)} gh-pages`);
  } else {
    console.log('[deploy] 首次创建 gh-pages 分支…');
    mkdirSync(tmp, { recursive: true });
    run(`git worktree add --orphan -b gh-pages ${JSON.stringify(tmp)}`);
  }

  // 3. 拷贝产物（.deploy-tmp 自身排除）
  console.log('[deploy] 同步 dist/ → gh-pages…');
  // 清空 worktree 旧文件（保留 .git）
  for (const f of execSync('ls', { cwd: tmp }).toString().split('\n').filter(Boolean)) {
    if (f === '.git') continue;
    rmSync(resolve(tmp, f), { recursive: true, force: true });
  }
  cpSync(resolve(root, 'dist'), tmp, { recursive: true });

  // 4. 提交并推送
  run('git add -A', { cwd: tmp });
  const hasChange = execSync('git status --porcelain', { cwd: tmp }).toString().trim().length > 0;
  if (!hasChange) {
    console.log('[deploy] 无变化，跳过推送。');
  } else {
    run('git -c user.name="deploy" -c user.email="deploy@local" commit -m "发布：自动部署 dist/"', { cwd: tmp });
    console.log('[deploy] 推送到 origin/gh-pages…');
    run('git push origin gh-pages');
    console.log('[deploy] ✓ 已发布。GitHub Pages 1~2 分钟后生效。');
  }
} finally {
  // 清理 worktree
  try { run(`git worktree remove --force ${JSON.stringify(tmp)}`); } catch { /* 忽略 */ }
  rmSync(tmp, { recursive: true, force: true });
}
