// 关卡可视化编辑器：读写 levels/*.txt（游戏数据同源）。
// 校验算法与 scripts/verify-levels.mjs 保持一致（Node 脚本无法直接 import，双份维护）。
import { LEVELS, gridOf } from '../core/levels';

/** FS Access API 的扩展类型（lib.dom 未内置 queryPermission 等） */
interface DirHandleExt extends FileSystemDirectoryHandle {
  queryPermission?: (opts: { mode: 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (opts: { mode: 'readwrite' }) => Promise<PermissionState>;
}
declare global {
  interface Window {
    showDirectoryPicker?: (opts?: { mode?: 'readwrite' | 'read' }) => Promise<FileSystemDirectoryHandle>;
  }
}

// ---------- 字符定义（调色板） ----------
interface CharDef { ch: string; name: string; color: string; }
const CHARS: CharDef[] = [
  { ch: '#', name: '墙', color: '#3f4d63' },
  { ch: '.', name: '地板', color: '#1a2230' },
  { ch: 'F', name: '篝火·起点', color: '#f0b34a' },
  { ch: 'E', name: '出口', color: '#f8d378' },
  { ch: 'T', name: '残烛·遗物', color: '#c8b98f' },
  { ch: 'D', name: '捷径门', color: '#a06a3a' },
  { ch: 'X', name: '碎地·荆棘', color: '#e2543a' },
  { ch: 'K', name: '钥匙', color: '#d8d8e0' },
  { ch: 'L', name: '锁门', color: '#54627a' },
  { ch: 'V', name: '断崖·单向', color: '#8a9a6a' },
  { ch: 'G', name: '幽火', color: '#7fd4e0' },
  { ch: 'C', name: '诅咒残烛', color: '#9a4ac8' },
  { ch: 'R', name: '遗忘图腾', color: '#6ab0b0' },
  { ch: 'W', name: '回程门', color: '#7fd4a0' },
  { ch: '$', name: '灯币', color: '#c8a050' },
  { ch: 'B', name: '抉择门', color: '#c8a050' },
];

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

// ---------- 状态 ----------
let currentIndex = 2; // 默认 L3（数组索引）
let rows: string[] = [];
let brush = '#';
let dirty = false;
let dirHandle: DirHandleExt | null = null;

// ---------- 初始化 ----------
function init(): void {
  const sel = $('#level-select') as HTMLSelectElement;
  LEVELS.forEach((lv, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${i + 1} · ${lv.levelName}${lv.gridFile ? '（已迁移）' : ''}`;
    sel.appendChild(opt);
  });
  sel.value = String(currentIndex);
  sel.addEventListener('change', () => loadLevel(Number(sel.value)));

  buildPalette();

  $('#add-row').addEventListener('click', () => { resize(1, 0); });
  $('#del-row').addEventListener('click', () => { resize(-1, 0); });
  $('#add-col').addEventListener('click', () => { resize(0, 1); });
  $('#del-col').addEventListener('click', () => { resize(0, -1); });
  $('#btn-check').addEventListener('click', runCheck);
  $('#btn-copy').addEventListener('click', copyGrid);
  $('#btn-save').addEventListener('click', saveFile);
  $('#btn-newfile').addEventListener('click', showMigrateText);

  restoreDirHandle();
  loadLevel(currentIndex);
}

function buildPalette(): void {
  const pal = $('#palette');
  pal.innerHTML = '';
  for (const def of CHARS) {
    const btn = document.createElement('button');
    btn.className = 'pal-btn' + (def.ch === brush ? ' active' : '');
    btn.innerHTML = `<span class="ch" style="color:${def.color}">${def.ch}</span><span>${def.name}</span>`;
    btn.addEventListener('click', () => {
      brush = def.ch;
      pal.querySelectorAll('.pal-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    pal.appendChild(btn);
  }
}

function loadLevel(index: number): void {
  currentIndex = index;
  const lv = LEVELS[index];
  rows = gridOf(lv).map(r => r);
  dirty = false;
  const meta = $('#lv-meta');
  meta.innerHTML = `灯油 <b style="color:var(--gold)">${lv.oil}</b> · 视野 ${lv.visionRadius}/${lv.lowOilVision}<br>` +
    `${lv.gridFile ? `网格文件：levels/${lv.gridFile}.txt` : '内联网格（未迁移，保存不生效）'}`;
  $('#cur-level').textContent = `${index + 1} · ${lv.levelName}`;
  render();
  updateDirty();
}

// ---------- 网格渲染与绘制 ----------
function render(): void {
  const grid = $('#grid');
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(${rows[0]?.length ?? 0}, 34px)`;
  const colorOf = (ch: string) => CHARS.find(c => c.ch === ch)?.color ?? '#1a2230';
  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.textContent = ch;
      if (ch !== '.') cell.style.color = colorOf(ch);
      if (ch === '#') cell.style.background = '#232c3d';
      cell.addEventListener('mousedown', e => {
        e.preventDefault();
        paint(c, r, e.button === 2);
      });
      cell.addEventListener('mouseenter', e => {
        if (e.buttons === 1) paint(c, r, false);
        else if (e.buttons === 2) paint(c, r, true);
      });
      cell.addEventListener('contextmenu', e => e.preventDefault());
      grid.appendChild(cell);
    });
  });
}

function paint(col: number, row: number, erase: boolean): void {
  const ch = erase ? '.' : brush;
  if (rows[row][col] === ch) return;
  rows[row] = rows[row].slice(0, col) + ch + rows[row].slice(col + 1);
  dirty = true;
  updateDirty();
  // 局部刷新该格
  const grid = $('#grid');
  const cell = grid.children[row * (rows[0].length) + col] as HTMLElement;
  if (cell) {
    cell.textContent = ch;
    cell.style.color = ch === '.' ? '' : (CHARS.find(c => c.ch === ch)?.color ?? '');
    cell.style.background = ch === '#' ? '#232c3d' : '';
  }
  liveCheck();
}

function resize(dr: number, dc: number): void {
  if (dr > 0) rows.push('.'.repeat(rows[0]?.length ?? 10));
  if (dr < 0 && rows.length > 3) rows.pop();
  const w = rows[0]?.length ?? 10;
  if (dc > 0) rows = rows.map(r => r + '.');
  if (dc < 0 && w > 5) rows = rows.map(r => r.slice(0, -1));
  dirty = true;
  updateDirty();
  render();
  liveCheck();
}

function updateDirty(): void {
  const el = $('#dirty-status');
  el.textContent = dirty ? '● 未保存' : '';
  el.className = 'status' + (dirty ? ' err' : '');
}

// ---------- 校验（与 verify 脚本同算法） ----------
interface CheckIssue { level: 'ok' | 'warn' | 'bad'; text: string; }

function check(): CheckIssue[] {
  const lv = LEVELS[currentIndex];
  const issues: CheckIssue[] = [];
  const w = rows[0]?.length ?? 0;
  if (rows.some(r => r.length !== w)) {
    issues.push({ level: 'bad', text: `行宽不一致（应为 ${w}）` });
  }
  let F: [number, number] | null = null;
  const sp: Record<string, [number, number][]> = {};
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === 'F') { if (F) issues.push({ level: 'bad', text: '存在多个 F' }); F = [c, r]; }
    (sp[ch] ??= []).push([c, r]);
  }));
  if (!F) { issues.push({ level: 'bad', text: '缺少 F（篝火起点）' }); return issues; }
  if ((sp['E'] ?? []).length !== 1) issues.push({ level: 'bad', text: `E 数量应为 1，实际 ${(sp['E'] ?? []).length}` });
  if ((sp['W'] ?? []).length === 1) issues.push({ level: 'bad', text: '回程门只有 1 枚（无法成对传送）' });
  if ((sp['K'] ?? []).length < (sp['L'] ?? []).length) issues.push({ level: 'bad', text: '钥匙数少于锁门数' });

  // BFS 可达（断崖单向）
  const canPass = (from: string, to: string, dr: number) =>
    to !== '#' && !(to === 'V' && dr !== 1) && !(from === 'V' && dr === -1);
  const reach = new Set<string>([`${F[0]},${F[1]}`]);
  const queue: [number, number][] = [F];
  while (queue.length) {
    const [c, r] = queue.shift()!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nc = c + dc, nr = r + dr;
      if (nr < 0 || nr >= rows.length || nc < 0 || nc >= w) continue;
      if (!canPass(rows[r][c], rows[nr][nc], dr)) continue;
      const k = `${nc},${nr}`;
      if (reach.has(k)) continue;
      reach.add(k);
      queue.push([nc, nr]);
    }
  }
  for (const [label, arr] of [['出口', sp['E'] ?? []], ['残烛', sp['T'] ?? []], ['钥匙', sp['K'] ?? []],
    ['捷径门', sp['D'] ?? []], ['灯币', sp['$'] ?? []], ['回程门', sp['W'] ?? []]] as const) {
    for (const [c, r] of arr) {
      if (!reach.has(`${c},${r}`)) issues.push({ level: 'bad', text: `${label}(${c},${r}) 不可达` });
    }
  }

  // Dijkstra 最小耗油
  const dangerCost = lv.dangerCost ?? 2;
  const cost = new Map<string, number>([[`${F[0]},${F[1]}`, 0]]);
  const pq: [number, number, number][] = [[0, F[0], F[1]]];
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0]);
    const [d, c, r] = pq.shift()!;
    if (d > (cost.get(`${c},${r}`) ?? Infinity)) continue;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nc = c + dc, nr = r + dr;
      if (nr < 0 || nr >= rows.length || nc < 0 || nc >= w) continue;
      if (!canPass(rows[r][c], rows[nr][nc], dr)) continue;
      const nd = d + (rows[nr][nc] === 'X' ? 1 + dangerCost : 1);
      const k = `${nc},${nr}`;
      if (nd < (cost.get(k) ?? Infinity)) { cost.set(k, nd); pq.push([nd, nc, nr]); }
    }
  }
  const E = (sp['E'] ?? [])[0];
  const dE = E ? cost.get(`${E[0]},${E[1]}`) : undefined;
  if (dE === undefined) issues.push({ level: 'bad', text: '出口不可达' });
  else {
    const candle = (sp['T'] ?? []).length * (lv.treasureOil ?? 0) + (sp['C'] ?? []).length * (lv.curseOil ?? 0);
    if (dE > lv.oil + candle) issues.push({ level: 'bad', text: `F→E 裸耗 ${dE} > 灯油 ${lv.oil} + 烛回油 ${candle}，无法通关` });
    else {
      const spare = lv.oil - dE;
      issues.push({ level: 'ok', text: `硬走余量 ${spare} 油（${spare <= 2 ? '符合极限哲学' : '偏宽松，建议收紧油量'}）` });
      if (dE > lv.oil) issues.push({ level: 'warn', text: `裸耗 ${dE} > 灯油 ${lv.oil}，通关依赖烛补给` });
    }
  }
  return issues;
}

function liveCheck(): void { /* 轻量：绘制时只清结果区 */
  $('#check-result').textContent = '网格已修改——点击「校验本关」查看结果。';
}

function runCheck(): void {
  const box = $('#check-result');
  const issues = check();
  box.innerHTML = issues.map(i => `<span class="${i.level}">${i.level === 'ok' ? '✓' : i.level === 'warn' ? '!' : '✗'} ${i.text}</span>`).join('\n')
    || '<span class="ok">✓ 全部通过</span>';
}

// ---------- 保存（FS Access API） ----------
function gridText(): string {
  return rows.join('\n') + '\n';
}

async function saveFile(): Promise<void> {
  const lv = LEVELS[currentIndex];
  if (!lv.gridFile) {
    $('#check-result').innerHTML = '<span class="warn">本关未迁移为 txt——点「迁移本关为 txt」生成文本交给 AI 合入。</span>';
    return;
  }
  try {
    if (!dirHandle) {
      dirHandle = (await window.showDirectoryPicker?.({ mode: 'readwrite' })) ?? null;
      if (!dirHandle) throw new Error('浏览器不支持文件系统访问');
      await rememberDirHandle(dirHandle);
    } else if (dirHandle.queryPermission) {
      // 授权可能过期：请求续期
      const p = await dirHandle.queryPermission({ mode: 'readwrite' });
      if (p !== 'granted' && dirHandle.requestPermission) {
        await dirHandle.requestPermission({ mode: 'readwrite' });
      }
    }
    const fh = await dirHandle.getFileHandle(`${lv.gridFile}.txt`, { create: true });
    const w = await fh.createWritable();
    await w.write(gridText());
    await w.close();
    dirty = false;
    updateDirty();
    $('#check-result').innerHTML = `<span class="ok">✓ 已保存到 levels/${lv.gridFile}.txt——游戏页面将热更新。</span>`;
  } catch (e) {
    $('#check-result').innerHTML = `<span class="bad">保存失败：${String(e)}<br>可用「复制网格文本」手动粘贴到 txt。</span>`;
  }
}

async function copyGrid(): Promise<void> {
  try {
    await navigator.clipboard.writeText(gridText());
    $('#check-result').innerHTML = '<span class="ok">✓ 网格文本已复制到剪贴板。</span>';
  } catch {
    $('#check-result').textContent = gridText();
  }
}

function showMigrateText(): void {
  const lv = LEVELS[currentIndex];
  $('#check-result').innerHTML =
    `<span class="warn">在 levels.ts 中给 LEVEL_${lv.id} 设置 gridFile: 'L${lv.id}'（grid 可清空），并新建文件 levels/L${lv.id}.txt 内容如下（已复制）：</span>\n<code>${gridText().replace(/\n/g, '<br>')}</code>`;
  void navigator.clipboard.writeText(gridText()).catch(() => undefined);
}

// ---------- 目录授权记忆（IndexedDB） ----------
const DB_NAME = 'dengxia-editor';
const STORE = 'handles';

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function rememberDirHandle(h: DirHandleExt): Promise<void> {
  try {
    const db = await idb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(h, 'levels-dir');
  } catch { /* 授权记忆失败不影响功能 */ }
}

async function restoreDirHandle(): Promise<void> {
  try {
    const db = await idb();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('levels-dir');
    req.onsuccess = () => {
      const h = req.result as DirHandleExt | undefined;
      if (h) {
        // 权限可能已过期：静默验证，失败则下次保存时重新授权
        if (h.queryPermission) {
          void h.queryPermission({ mode: 'readwrite' }).then(p => {
            if (p === 'granted') dirHandle = h;
          }).catch(() => undefined);
        } else {
          dirHandle = h;
        }
      }
    };
  } catch { /* 无 */ }
}

init();
