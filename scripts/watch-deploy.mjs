// 自动部署 watcher：监听 levels/*.txt 与 src/core/levels.ts，
// 变更后防抖 1s → npm run verify → 全绿则 npm run deploy；失败则提示不发布。
// 用法：npm run dev:auto（与 vite dev 并行运行）
import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let timer = null;
let deploying = false;
let dirty = false;

function log(msg) {
  console.log(`\x1b[36m[auto-deploy]\x1b[0m ${msg}`);
}

function run(cmd, args) {
  return new Promise(ok => {
    const p = spawn(cmd, args, { cwd: root, shell: true, stdio: 'inherit' });
    p.on('close', code => ok(code === 0));
  });
}

async function deployFlow() {
  if (deploying) { dirty = true; return; }
  deploying = true;
  try {
    log('检测到关卡变更，运行校验…');
    const okVerify = await run('npm', ['run', 'verify']);
    if (!okVerify) {
      log('✗ 校验未通过——不发布。请修复关卡后保存重试。');
      return;
    }
    log('✓ 校验通过，开始构建部署…');
    const okDeploy = await run('npm', ['run', 'deploy']);
    if (okDeploy) log('✓ 部署流程完成。');
    else log('✗ 部署失败（可能是网络/remote 问题），稍后保存重试。');
  } finally {
    deploying = false;
    if (dirty) { dirty = false; setTimeout(deployFlow, 1000); }
  }
}

function queue() {
  clearTimeout(timer);
  timer = setTimeout(deployFlow, 1000); // 防抖：编辑器保存的连续写盘合并为一次
}

// 监听：levels 目录 + levels.ts
watch(resolve(root, 'levels'), () => queue());
watch(resolve(root, 'src/core'), () => queue());
log('watcher 已启动（levels/ 与 src/core/ 变更 → verify → 自动部署到 gh-pages）');
