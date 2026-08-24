// 居所（hub）：游戏大厅——小屋背景 + 行者立绘 + 消费节点 + 当铺。
// 纯 DOM/Canvas，与 Phaser 探索场景互斥显示。
import {
  loadMeta, UNLOCKS, isNodeUnlocked, isNodeDone, buyNode, sellRelic,
  type MetaState,
} from '../core/meta';
import { loadUnlocked } from '../core/progress';
import { LEVELS } from '../core/levels';
import { unlock as sfxUnlock, sfx } from '../audio/sfx';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) =>
  document.querySelector(sel) as T;

/** 已通过的最大常规关数（= 解锁进度，异关 id 不计入） */
function clearedRegular(): number {
  return loadUnlocked(LEVELS.length) - 1;
}

export class Hub {
  private meta: MetaState;
  /** 新解锁未查看的节点（发光提示） */
  private seenNodes = new Set<string>();

  constructor(onDepart: (index: number) => void) {
    this.meta = loadMeta();
    $('#hub-depart').addEventListener('click', () => {
      // 出发：继续最新进度关（选关面板会再弹）；用户手势解锁音频
      sfxUnlock();
      this.hide();
      onDepart(Math.min(loadUnlocked(LEVELS.length) - 1, LEVELS.length - 1));
    });
    $('#pawn-close').addEventListener('click', () => {
      $('#pawn-panel').classList.remove('show');
    });
    // 初始化 seenNodes：首启时全部视为已看（不发光）
    for (const n of UNLOCKS) this.seenNodes.add(n.id);
  }

  getMeta(): MetaState { return this.meta; }

  show(): void {
    this.meta = loadMeta();
    this.render();
    $('#hub').classList.add('show');
  }

  hide(): void {
    $('#hub').classList.remove('show');
  }

  /** 通关后回居所（刷新并提示新节点） */
  showAfterClear(): void {
    for (const n of UNLOCKS) {
      if (isNodeUnlocked(n, clearedRegular()) && !this.seenNodes.has(n.id)) {
        // 新解锁节点保持发光直到点击
      }
    }
    this.show();
  }

  /** 标记节点已看（点击时） */
  markSeen(id: string): void {
    this.seenNodes.add(id);
  }

  private render(): void {
    this.drawScene();
    this.renderNodes();
    this.renderPawn();
  }

  // ---------- 立绘合成（canvas 放大像素画） ----------

  private drawScene(): void {
    const cv = $('#hub-canvas') as HTMLCanvasElement;
    const ctx = cv.getContext('2d')!;
    const W = cv.width, H = cv.height;
    ctx.imageSmoothingEnabled = false;

    // 背景：小屋内景（暗色墙 + 地板 + 壁炉暖光）
    ctx.fillStyle = '#10151f';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#171f2e';
    ctx.fillRect(0, 0, W, 64);
    // 地板
    ctx.fillStyle = '#1c2434';
    ctx.fillRect(0, 64, W, H - 64);
    // 壁炉（右上）暖光
    const grad = ctx.createRadialGradient(130, 30, 4, 130, 30, 60);
    grad.addColorStop(0, 'rgba(240,179,74,.5)');
    grad.addColorStop(1, 'rgba(240,179,74,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(60, 0, 140, 80);
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(122, 18, 16, 20);
    ctx.fillStyle = '#f0b34a';
    ctx.fillRect(125, 24, 10, 12);

    // 行者立绘（中央，放大 6 倍）
    const px = 6;
    const originX = Math.floor(W / 2 - 8 * px / 2);
    const originY = 78 - 16 * px;  // 底对齐地板
    const put = (gx: number, gy: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(originX + gx * px / 2, originY + gy * px / 2, px / 2, px / 2);
    };
    // 简化立绘：居所用 12×16 独立绘制（比游戏内 16×16 更精细的半身像）
    // 身体：斗篷（已购 cloak 则青色）
    const cloakColor = this.meta.purchased['cloak'] ? '#3a7a8a' : '#2a2a3a';
    const body = [
      '....####....',
      '...######...',
      '..########..',
      '.##########.',
      '.###....###.',
      '.###....###.',
      '.##########.',
      '.##########.',
      '..########..',
      '...######...',
      '....####....',
    ];
    body.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '#') put(x, y + 5, cloakColor);
    }));
    // 头部
    const head = [
      '..3333..',
      '.333333.',
      '.333333.',
      '..3333..',
    ];
    head.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '3') put(x + 2, y + 1, '#c8b98f');
    }));
    // 斗笠（已购 hat）
    if (this.meta.purchased['hat']) {
      const hat = [
        '...77...',
        '..7887..',
        '.788887.',
        '78888887',
      ];
      hat.forEach((row, y) => [...row].forEach((ch, x) => {
        const c = ch === '7' ? '#6e4526' : '#a06a3a';
        if (ch !== '.') put(x + 2, y, c);
      }));
    } else if (!this.meta.purchased['wash1']) {
      // 乱发（未洗头）
      const hair = [
        '..2222..',
        '.222222.',
      ];
      hair.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '2') put(x + 2, y, '#1a1a22');
      }));
    }
    // 胡须（未剃须）
    if (!this.meta.purchased['shave1']) {
      const beard = [
        '.777777.',
        '..7777..',
      ];
      beard.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '7') put(x + 2, y + 4, '#3a3026');
      }));
    }
    // 灯笼（右手）：
    const lanternPaper = this.meta.purchased['lantern'];
    const lampX = 12, lampY = 8;
    ctx.fillStyle = lanternPaper ? '#e8dcc0' : '#8a6a3a';
    ctx.fillRect(originX + lampX * px / 2, originY + lampY * px / 2, px, px * 1.5);
    const lg = ctx.createRadialGradient(
      originX + lampX * px / 2 + px / 2, originY + lampY * px / 2 + px, 2,
      originX + lampX * px / 2 + px / 2, originY + lampY * px / 2 + px, 40);
    lg.addColorStop(0, lanternPaper ? 'rgba(248,211,120,.55)' : 'rgba(240,179,74,.35)');
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, W, H);
  }

  // ---------- 消费节点 ----------

  private renderNodes(): void {
    const wrap = $('#hub-nodes');
    wrap.innerHTML = '';
    const cleared = clearedRegular();
    let anyNew = false;

    for (const node of UNLOCKS) {
      const unlocked = isNodeUnlocked(node, cleared);
      if (!unlocked) continue;
      const done = isNodeDone(this.meta, node);
      const isNew = !done && !this.seenNodes.has(node.id);
      if (isNew) anyNew = true;

      const btn = document.createElement('button');
      btn.className = 'hub-node' + (done ? ' done' : '') + (isNew ? ' new' : '');
      if (node.kind === 'pawn') {
        // 当铺节点：点击开当铺抽屉
        btn.textContent = done ? `当铺 · ${this.meta.relics.filter(r => !r.sold).length} 件可当` : `开启当铺（通过第 ${node.unlockAt} 关解锁）`;
        if (done) {
          btn.addEventListener('click', () => {
            $('#pawn-panel').classList.toggle('show');
          });
        }
      } else {
        btn.textContent = done
          ? `${node.name} ✓`
          : `${node.name}（${node.cost} 币）`;
        btn.disabled = done || this.meta.coins < node.cost;
        btn.addEventListener('click', () => {
          if (buyNode(this.meta, node)) {
            sfx.refill(); // 整备完成：温暖琶音
            this.markSeen(node.id);
            this.render();
          }
        });
      }
      wrap.appendChild(btn);
    }

    if (!anyNew) {
      // 全部已看：清掉 new 标记残留
      this.seenNodes = new Set(UNLOCKS.map(n => n.id));
    }
    $('#hub-coins').textContent = `🪙 ${this.meta.coins}`;
  }

  // ---------- 当铺 ----------

  private renderPawn(): void {
    const list = $('#pawn-list');
    list.innerHTML = '';
    if (!isNodeDone(this.meta, UNLOCKS.find(n => n.id === 'pawn')!)) {
      $('#pawn-panel').classList.remove('show');
      return;
    }
    const relics = this.meta.relics;
    if (relics.length === 0) {
      list.innerHTML = '<div class="pawn-item"><span>行囊空空——去黑暗里找些遗物吧。</span></div>';
      return;
    }
    for (const relic of relics) {
      const item = document.createElement('div');
      item.className = 'pawn-item';
      if (relic.sold) {
        item.innerHTML = `<span>${relic.name}（第 ${relic.levelId} 关）</span><span class="sold-tag">已典当 +${relic.price}</span>`;
      } else {
        const btn = document.createElement('button');
        btn.className = 'sell-btn';
        btn.textContent = `当 ${relic.price} 币`;
        btn.addEventListener('click', () => {
          if (sellRelic(this.meta, relic.levelId)) {
            sfx.coin(); // 典当入账：叮
            this.render();
          }
        });
        const label = document.createElement('span');
        label.textContent = `${relic.name}（第 ${relic.levelId} 关）`;
        item.append(label, btn);
      }
      list.appendChild(item);
    }
  }
}
