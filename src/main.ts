// 应用入口：装配 Phaser 游戏、DOM overlay、居所（hub）与触屏方向键。
// 画布尺寸由关卡网格决定（TILE=48），自适应交给 CSS 等比缩放。
import Phaser from 'phaser';
import { ExploreScene } from './scenes/ExploreScene';
import { Overlay, type PanelAction } from './ui/overlay';
import { Hub } from './ui/hub';
import { LEVELS, gridOf } from './core/levels';
import { loadUnlocked, saveUnlocked, loadFreeSelect, saveFreeSelect } from './core/progress';
import { loadMeta, commitLevel, abortLevel, gainCoins, gainRelic, relicPrice, alreadyClaimed, type MetaState } from './core/meta';
import { sfx, unlock as sfxUnlock, restoreMutePref, toggleMute, onMuteChanged, isMuted } from './audio/sfx';
import { Dir, type GameSnapshot } from './core/types';

const TILE = 48;

let game: Phaser.Game;
let unlocked = loadUnlocked(LEVELS.length);
// 从最新解锁的关卡继续（首次游玩即第一关）
let levelIndex = Math.min(unlocked - 1, LEVELS.length - 1);
/** 本关是否已入账（防重复 commit） */
let levelCommitted = false;

/** 加载并（重）启动指定关卡：更新 registry、按网格尺寸重设画布 */
function startLevel(index: number): void {
  levelIndex = index;
  levelCommitted = false;
  const lv = LEVELS[index];
  game.registry.set('level', lv);
  const grid = gridOf(lv);
  const w = grid[0].length * TILE;
  const h = grid.length * TILE;
  game.scale.resize(w, h);
  const scene = game.scene.getScene('explore');
  if (scene) scene.scene.restart();
}

/** 打开选关面板（自由选关开关状态 + 切换回调统一在此） */
function openLevelSelect(): void {
  overlay.showLevelSelect(
    LEVELS, unlocked, levelIndex,
    i => startLevel(i),
    id => meta.levelStats[id],
    freeSelect,
  );
}

/** 自由选关开关切换：持久化并重绘面板 */
function toggleFreeSelect(on: boolean): void {
  freeSelect = on;
  saveFreeSelect(on);
  openLevelSelect();
}

let freeSelect = loadFreeSelect();

const hub = new Hub(() => {
  // 出发：打开选关面板（行者的图卷，含每关收集度）
  openLevelSelect();
});

const overlay = new Overlay((action: PanelAction) => {
  if (action === 'hub') {
    // 回居所：若刚通关且未入账，先落库本关收益并解锁下一关
    const explore = game.scene.getScene('explore') as
      { state?: { getSnapshot: () => { phase: string } } } | undefined;
    if (!levelCommitted && explore?.state?.getSnapshot().phase === 'win') {
      commitIfPending();
      levelCommitted = true;
      unlocked = Math.min(Math.max(unlocked, levelIndex + 2), LEVELS.length);
      saveUnlocked(unlocked);
    }
    hub.show();
    return;
  }
  if (action === 'next' && levelIndex + 1 < LEVELS.length) {
    // 通过第 levelIndex 关 → 解锁下一关（进度持久化）+ 居所入账 + 回居所
    if (!levelCommitted) {
      commitIfPending();
      levelCommitted = true;
    }
    unlocked = Math.min(Math.max(unlocked, levelIndex + 2), LEVELS.length);
    saveUnlocked(unlocked);
    // 章末（下一关章节不同）或最后一关 → 回居所；否则继续下一关
    const cur = LEVELS[levelIndex];
    const next = LEVELS[levelIndex + 1];
    if (next.chapterName !== cur.chapterName || levelIndex + 1 === LEVELS.length - 1) {
      hub.showAfterClear();
    } else {
      startLevel(levelIndex + 1);
    }
  } else {
    // retry：若刚通关且未入账（玩家选择重玩收集），先落库再重开
    const explore = game.scene.getScene('explore') as
      { state?: { getSnapshot: () => { phase: string } } } | undefined;
    if (!levelCommitted && explore?.state?.getSnapshot().phase === 'win') {
      commitIfPending();
      levelCommitted = true;
      unlocked = Math.min(Math.max(unlocked, levelIndex + 2), LEVELS.length);
      saveUnlocked(unlocked);
    }
    startLevel(levelIndex);
  }
});

/** 本关暂存入账（通关时调用；防重玩刷币在 meta 层已处理） */
function commitIfPending(): void {
  // 结算快照：本关收集统计（灯币/遗物），供选关图卷展示
  const explore = game.scene.getScene('explore') as unknown as
    { state?: { getSnapshot: () => GameSnapshot } } | undefined;
  const snap = explore?.state?.getSnapshot();
  const stats = snap ? {
    coins: snap.coins,
    totalCoins: snap.totalCoins,
    relics: snap.treasures,
    totalRelics: snap.totalTreasures,
  } : undefined;
  // 以磁盘最新 meta 为基线（含居所消费），叠加本关暂存——避免覆盖居所购买
  const fresh = loadMeta();
  fresh.pendingCoins = meta.pendingCoins;
  fresh.pendingRelic = meta.pendingRelic;
  commitLevel(fresh, LEVELS[levelIndex].id, stats);
  // 同步回单例（保持 registry 引用不变）
  Object.assign(meta, {
    coins: fresh.coins,
    relics: fresh.relics,
    purchased: fresh.purchased,
    levelStats: fresh.levelStats,
    pendingCoins: 0,
    pendingRelic: null,
  });
}

const first = LEVELS[levelIndex];
game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-root',
  width: gridOf(first)[0].length * TILE,
  height: gridOf(first).length * TILE,
  backgroundColor: '#05070b',
  pixelArt: true,
  scene: [ExploreScene],
});

// 场景 create() 启动前注入依赖
game.registry.set('level', first);
game.registry.set('overlay', overlay);
/** 居所元数据单例（关卡内的暂存都写在这里，通关统一落库） */
const meta: MetaState = loadMeta();
game.registry.set('meta', meta);

// 灯币拾取：暂存（通关落库）
game.registry.set('onCoin', (n: number) => {
  gainCoins(meta, n);
});
// 遗物拾取：暂存（通关落库）
game.registry.set('onRelic', () => {
  const lv = LEVELS[levelIndex];
  if (alreadyClaimed(meta, lv.id)) return;
  gainRelic(meta, {
    levelId: lv.id,
    name: `${lv.levelName} 的遗物`,
    price: relicPrice(lv.id),
    sold: false,
  });
});

// E 键 / HUD 按钮：退出到居所（本关作废）
function exitToHub(): void {
  abortLevel(meta);
  overlay.hidePanel();
  overlay.hideToast();
  overlay.hideLevelSelect();
  hub.show();
}
game.registry.set('onExitToHub', exitToHub);
document.getElementById('hub-btn')?.addEventListener('click', exitToHub);

// 暴露 game 引用（自动化实测用，不影响游戏逻辑）
(window as unknown as Record<string, unknown>).__game = game;

// 选关按钮
document.getElementById('level-btn')?.addEventListener('click', () => {
  sfxUnlock(); // 用户手势：解锁 AudioContext
  openLevelSelect();
});

// 自由选关开关回调（overlay 面板按钮 → 切换并重绘）
overlay.onFreeSelectToggle = on => toggleFreeSelect(on);

// 触屏方向键：按住持续移动，松开即停
document.querySelectorAll<HTMLButtonElement>('#dpad button[data-dir]').forEach(btn => {
  const dir = btn.dataset.dir as Dir;
  const scene = () => game.scene.getScene('explore') as ExploreScene | null;
  const press = (e: PointerEvent) => {
    e.preventDefault();
    scene()?.setHeldDir(dir);
  };
  const release = () => scene()?.setHeldDir(null);
  btn.addEventListener('pointerdown', press);
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointerleave', release);
  btn.addEventListener('pointercancel', release);
});

// 恢复静音偏好（须在静音按钮初始化前）
restoreMutePref();

// 静音按钮：切换并持久化
const muteBtn = document.getElementById('mute-btn');
if (muteBtn) {
  muteBtn.textContent = isMuted() ? '🔇' : '🔊';
  muteBtn.addEventListener('click', () => {
    sfxUnlock();
    const now = toggleMute();
    onMuteChanged();
    muteBtn.textContent = now ? '🔇' : '🔊';
    if (!now) sfx.coin(); // 开声时给一声反馈
  });
}

// 启动直接进居所（hub 制）
hub.show();
