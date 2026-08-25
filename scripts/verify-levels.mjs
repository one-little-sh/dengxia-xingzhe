// 关卡合法性校验：解析 src/core/levels.ts，验证：
//   1. 行宽一致、恰好一个 F（篝火起点）和一个 E（出口）
//   2. E / 所有 T / 所有 D / K / L 从 F 可达（BFS，含断崖单向规则）
//   3. F→E 最小耗油（Dijkstra，碎地 X 计入 dangerCost，断崖 V 单向）≤ 灯油 + 残烛总回油
//      ——裸耗 > 灯油时给出警告（该关依赖残烛补给才能通关）
// 网格外置：gridFile 指向 levels/<name>.txt（编辑器维护），优先于内联 grid
// 用法：npm run verify
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/core/levels.ts', import.meta.url), 'utf8');
const blocks = [...src.matchAll(/const LEVEL_(\d+): LevelDef = \{([\s\S]*?)\n\};/g)];

if (blocks.length === 0) {
  console.error('未解析到任何关卡，请检查 levels.ts 格式');
  process.exit(1);
}

let failed = false;

for (const [, id, body] of blocks) {
  const oilMatch = body.match(/oil:\s*(\d+)/);
  const dcMatch = body.match(/dangerCost:\s*(\d+)/);
  const toMatch = body.match(/treasureOil:\s*(\d+)/);
  const coMatch = body.match(/curseOil:\s*(\d+)/);
  const gfMatch = body.match(/gridFile:\s*'([^']+)'/);
  if (!oilMatch) {
    console.error(`L${id}: 解析失败`);
    failed = true;
    continue;
  }
  // 网格来源：外置 txt 优先（levels/ 在项目根，即 scripts/ 的上一级）
  // txt 格式：可选头部（oil: N）+ 空行 + 网格——头部 oil 优先于 levels.ts
  let rows;
  let txtOil = null;
  if (gfMatch) {
    const txt = readFileSync(new URL(`../levels/${gfMatch[1]}.txt`, import.meta.url), 'utf8');
    const lines = txt.replace(/\r\n/g, '\n').split('\n');
    const gridLines = [];
    for (const line of lines) {
      const t = line.trim();
      if (t.length === 0) continue;
      // 头部参数行：key: value（网格开始前识别）
      if (gridLines.length === 0 && /^[a-zA-Z]+:\s*\S+$/.test(t)) {
        const m = t.match(/^([a-zA-Z]+):\s*(\S+)$/);
        if (m && m[1] === 'oil') txtOil = Number(m[2]);
        continue;
      }
      gridLines.push(line);
    }
    rows = gridLines;
  } else {
    const gridMatch = body.match(/grid:\s*\[([^\]]+)\]/);
    if (!gridMatch) {
      console.error(`L${id}: 既无 grid 也无有效 gridFile`);
      failed = true;
      continue;
    }
    rows = [...gridMatch[1].matchAll(/'([^']*)'/g)].map(m => m[1]);
  }
  const oil = txtOil !== null && Number.isFinite(txtOil) ? txtOil : Number(oilMatch[1]);
  const dangerCost = dcMatch ? Number(dcMatch[1]) : 2;
  const treasureOil = toMatch ? Number(toMatch[1]) : 0;
  const curseOil = coMatch ? Number(coMatch[1]) : 0;
  const problems = [];
  const warnings = [];

  if (rows.length === 0) {
    console.error(`L${id}: txt 网格为空`);
    failed = true;
    continue;
  }
  const w = rows[0].length;
  if (rows.some(r => r.length !== w)) problems.push(`行宽不一致（应为 ${w}）`);

  let F = null;
  const specials = { E: [], T: [], D: [], X: [], K: [], L: [], V: [], G: [], C: [], R: [], B: [], '$': [], W: [] };
  rows.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch === 'F') { if (F) problems.push('存在多个 F'); F = [c, r]; }
      for (const k of ['E', 'T', 'D', 'X', 'K', 'L', 'V', 'G', 'C', 'R', 'B', '$', 'W']) if (ch === k) specials[k].push([c, r]);
    })
  );
  if (!F) problems.push('缺少 F');
  if (specials.E.length !== 1) problems.push(`E 数量应为 1，实际 ${specials.E.length}`);
  if (specials.K.length < specials.L.length) {
    problems.push(`钥匙 ${specials.K.length} 把 < 锁门 ${specials.L.length} 扇，无法全部开启`);
  }

  // 通行判定：墙不可行；断崖 V 只能从北向南进入，且从 V 不能向北走
  const canPass = (fromCh, toCh, dr) => {
    if (toCh === '#') return false;
    if (toCh === 'V' && dr !== 1) return false;   // 只能向南跳入断崖
    if (fromCh === 'V' && dr === -1) return false; // 断崖上不能向北爬
    return true;
  };

  // BFS 可达性（含断崖单向规则）
  const reach = new Set([F ? F.join(',') : '']);
  if (F) {
    const queue = [F];
    while (queue.length) {
      const [c, r] = queue.shift();
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (nr < 0 || nr >= rows.length || nc < 0 || nc >= w) continue;
        if (!canPass(rows[r][c], rows[nr][nc], dr)) continue;
        const k = `${nc},${nr}`;
        if (reach.has(k)) continue;
        reach.add(k);
        queue.push([nc, nr]);
      }
    }
  }

  for (const [c, r] of specials.E) if (!reach.has(`${c},${r}`)) problems.push(`出口(${c},${r}) 不可达`);
  for (const [c, r] of specials.T) if (!reach.has(`${c},${r}`)) problems.push(`残烛(${c},${r}) 不可达`);
  for (const [c, r] of specials.C) if (!reach.has(`${c},${r}`)) problems.push(`诅咒烛(${c},${r}) 不可达`);
  for (const [c, r] of specials.D) if (!reach.has(`${c},${r}`)) problems.push(`捷径门(${c},${r}) 不可达`);
  for (const [c, r] of specials.K) if (!reach.has(`${c},${r}`)) problems.push(`钥匙(${c},${r}) 不可达`);
  for (const [c, r] of specials.L) if (!reach.has(`${c},${r}`)) problems.push(`锁门(${c},${r}) 不可达`);

  // Dijkstra 最小耗油：进入格的代价 = 1 +（X ? dangerCost : 0）；断崖单向规则同上
  const cost = new Map();
  if (F) {
    cost.set(F.join(','), 0);
    const pq = [[0, F[0], F[1]]];
    const enter = (c, r) => (rows[r][c] === 'X' ? 1 + dangerCost : 1);
    while (pq.length) {
      pq.sort((a, b) => a[0] - b[0]);
      const [d, c, r] = pq.shift();
      if (d > (cost.get(`${c},${r}`) ?? Infinity)) continue;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (nr < 0 || nr >= rows.length || nc < 0 || nc >= w) continue;
        if (!canPass(rows[r][c], rows[nr][nc], dr)) continue;
        const nd = d + enter(nc, nr);
        const k = `${nc},${nr}`;
        if (nd < (cost.get(k) ?? Infinity)) {
          cost.set(k, nd);
          pq.push([nd, nc, nr]);
        }
      }
    }
  }

  const candleTotal = specials.T.length * treasureOil + specials.C.length * curseOil;
  const dE = F && cost.get(specials.E[0].join(','));
  if (dE === undefined) problems.push('E 不可达');
  else if (dE > oil + candleTotal) {
    problems.push(`F→E 裸耗 ${dE} > 灯油 ${oil} + 残烛回油 ${candleTotal}，无法通关`);
  } else if (dE > oil) {
    warnings.push(`裸耗 ${dE} > 灯油 ${oil}，通关依赖残烛补给（+${candleTotal}）`);
  }

  const info = [];
  if (dE !== undefined) info.push(`出口 ${dE} 耗`);
  for (const [c, r] of specials.T) {
    const d = cost.get(`${c},${r}`);
    if (d !== undefined) info.push(`残烛 ${d} 耗`);
  }
  for (const [c, r] of specials.C) {
    const d = cost.get(`${c},${r}`);
    if (d !== undefined) info.push(`诅咒 ${d} 耗`);
  }
  for (const [c, r] of specials.K) {
    const d = cost.get(`${c},${r}`);
    if (d !== undefined) info.push(`钥匙 ${d} 耗`);
  }
  for (const [c, r] of specials.D) {
    const d = cost.get(`${c},${r}`);
    if (d !== undefined) info.push(`门 ${d} 耗`);
  }
  for (const [c, r] of specials.L) {
    const d = cost.get(`${c},${r}`);
    if (d !== undefined) info.push(`锁门 ${d} 耗`);
  }
  if (specials.X.length) info.push(`碎地 ×${specials.X.length}`);
  if (specials.V.length) info.push(`断崖 ×${specials.V.length}`);
  if (specials.G.length) info.push(`幽火 ×${specials.G.length}`);
  if (specials.C.length) info.push(`诅咒烛 ×${specials.C.length}`);
  if (specials.R.length) info.push(`图腾 ×${specials.R.length}`);
  if (specials.B.length) info.push(`抉择门 ×${specials.B.length}`);
  if (specials['$'].length) {
    info.push(`灯币 ×${specials['$'].length}`);
    for (const [c, r] of specials['$']) {
      if (!reach.has(`${c},${r}`)) problems.push(`灯币(${c},${r}) 不可达`);
    }
  }
  // 回程门：可通行校验 + 成对校验（单枚传送无意义）
  if (specials.W.length) {
    info.push(`回程门 ×${specials.W.length}`);
    if (specials.W.length === 1) problems.push('回程门只有 1 枚（无法成对传送）');
    for (const [c, r] of specials.W) {
      if (!reach.has(`${c},${r}`)) problems.push(`回程门(${c},${r}) 不可达`);
    }
  }
  if (specials.K.length || specials.L.length) info.push(`钥 ${specials.K.length}/锁 ${specials.L.length}`);

  const tag = problems.length ? '✗' : '✓';
  const oilLabel = txtOil !== null ? `灯油 ${oil}*` : `灯油 ${oil}`; // * = txt 头部自定义
  console.log(`${tag} L${id}  ${oilLabel}  ${info.join(' · ')}`);
  for (const wn of warnings) console.log(`    ! ${wn}`);
  if (problems.length) {
    failed = true;
    for (const p of problems) console.error(`    - ${p}`);
  }
}

process.exit(failed ? 1 : 0);
