// 元进度（行者的居所）：灯币、遗物库存、衣橱、进度门控消费节点。
// 与关卡进度（progress.ts）平行存储，互不干扰。
// 骨架版：前 6 个节点（第 2/3/4/6/8/10 关解锁）。

const META_KEY = 'dengxia-meta-v1';

/** 消费节点定义：解锁关卡序号（1-based 常规关数）→ 节点 */
export interface UnlockNode {
  id: string;          // 唯一标识
  unlockAt: number;    // 通过第 N 关后解锁（按常规关计数，异关不计）
  kind: 'groom' | 'shop' | 'pawn';
  name: string;        // 节点名（居所按钮文案）
  desc: string;        // 一句话描述
  cost: number;        // 灯币费用（0 = 免费开启）
}

/** 骨架版节点表（按解锁关卡升序） */
export const UNLOCKS: UnlockNode[] = [
  { id: 'shave1', unlockAt: 2, kind: 'groom', name: '剃胡子', desc: '把风尘刮掉一层。', cost: 5 },
  { id: 'pawn', unlockAt: 3, kind: 'pawn', name: '开启当铺', desc: '遗物可以换灯币了。', cost: 0 },
  { id: 'wash1', unlockAt: 4, kind: 'groom', name: '洗头发', desc: '头发重新变得清爽。', cost: 5 },
  { id: 'cloak', unlockAt: 6, kind: 'shop', name: '斗篷·青', desc: '一件青色斗篷。', cost: 8 },
  { id: 'hat', unlockAt: 8, kind: 'shop', name: '帽子·斗笠', desc: '遮雨，也遮黑暗。', cost: 10 },
  { id: 'lantern', unlockAt: 10, kind: 'shop', name: '灯笼·纸灯', desc: '换一盏温润的纸灯。', cost: 12 },
];

/** 遗物档位 → 当价（按所属章常规关序号分档） */
export function relicPrice(regularLevel: number): number {
  if (regularLevel <= 15) return 2;   // 第 1-3 章
  if (regularLevel <= 30) return 3;   // 第 4-6 章
  if (regularLevel <= 45) return 4;   // 第 7-9 章
  return 6;                           // 第 10 章
}

/** 遗物库存条目 */
export interface RelicItem {
  levelId: number;    // 来源关卡 id
  name: string;       // 展示名
  price: number;      // 当价
  sold: boolean;      // 是否已典当
}

/** 每关收集统计（选关图卷展示；重玩保留历史最佳） */
export interface LevelStats {
  coins: number;
  totalCoins: number;
  relics: number;
  totalRelics: number;
}

export interface MetaState {
  coins: number;                  // 灯币余额
  relics: RelicItem[];            // 遗物库存（含已典当，图鉴保留）
  purchased: Record<string, boolean>; // 已消费节点
  levelStats: Record<number, LevelStats>; // 每关最佳收集统计（key=关卡 id）
  /** 本关（当前进行中的关卡）已入账的临时记录：通关时才落库 */
  pendingCoins: number;
  pendingRelic: RelicItem | null;
}

export function createMeta(): MetaState {
  return {
    coins: 0, relics: [], purchased: {}, levelStats: {},
    pendingCoins: 0, pendingRelic: null,
  };
}

/** 读取（损坏/缺失时返回全新状态） */
export function loadMeta(): MetaState {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return createMeta();
    const m = JSON.parse(raw) as MetaState;
    return {
      coins: typeof m.coins === 'number' ? m.coins : 0,
      relics: Array.isArray(m.relics) ? m.relics : [],
      purchased: m.purchased ?? {},
      levelStats: m.levelStats ?? {},
      pendingCoins: 0,
      pendingRelic: null,
    };
  } catch {
    return createMeta();
  }
}

export function saveMeta(meta: MetaState): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify({
      coins: meta.coins,
      relics: meta.relics,
      purchased: meta.purchased,
      levelStats: meta.levelStats,
    }));
  } catch {
    // 写入失败不影响游玩
  }
}

/** 该关灯币/遗物是否已领过（防重玩刷币） */
export function alreadyClaimed(meta: MetaState, levelId: number): boolean {
  if (meta.relics.some(r => r.levelId === levelId)) return true;
  return meta.purchased[`claim-${levelId}`] === true;
}

/** 关卡内拾取灯币（暂存，通关落库） */
export function gainCoins(meta: MetaState, amount: number): void {
  meta.pendingCoins += amount;
}

/** 关卡内拾取遗物（暂存，通关落库） */
export function gainRelic(meta: MetaState, relic: RelicItem): void {
  meta.pendingRelic = relic;
}

/** 通关结算：暂存入账 + 标记本关已领 + 记录收集统计（重玩保留最佳） */
export function commitLevel(meta: MetaState, levelId: number, stats?: LevelStats): void {
  const claimed = alreadyClaimed(meta, levelId);
  if (!claimed) {
    meta.coins += meta.pendingCoins;
    if (meta.pendingRelic) meta.relics.push(meta.pendingRelic);
    meta.purchased[`claim-${levelId}`] = true;
  }
  meta.pendingCoins = 0;
  meta.pendingRelic = null;
  // 收集统计：重玩刷新为历史最佳（首次通关即有；防重玩刷币不影响展示）
  if (stats) {
    const prev = meta.levelStats[levelId];
    meta.levelStats[levelId] = {
      coins: Math.max(prev?.coins ?? 0, stats.coins),
      totalCoins: stats.totalCoins,
      relics: Math.max(prev?.relics ?? 0, stats.relics),
      totalRelics: stats.totalRelics,
    };
  }
  saveMeta(meta);
}

/** 弃关结算：暂存清空（首次奖励保留到下次真正通关） */
export function abortLevel(meta: MetaState): void {
  meta.pendingCoins = 0;
  meta.pendingRelic = null;
}

/** 卖遗物 */
export function sellRelic(meta: MetaState, levelId: number): boolean {
  const relic = meta.relics.find(r => r.levelId === levelId && !r.sold);
  if (!relic) return false;
  relic.sold = true;
  meta.coins += relic.price;
  saveMeta(meta);
  return true;
}

/** 节点是否已解锁（按已通过的最大常规关数） */
export function isNodeUnlocked(node: UnlockNode, clearedRegular: number): boolean {
  return clearedRegular >= node.unlockAt;
}

/** 节点是否已消费（pawn 开启后恒视为已消费） */
export function isNodeDone(meta: MetaState, node: UnlockNode): boolean {
  return meta.purchased[node.id] === true;
}

/** 消费节点（足够则扣币并标记） */
export function buyNode(meta: MetaState, node: UnlockNode): boolean {
  if (isNodeDone(meta, node)) return false;
  if (meta.coins < node.cost) return false;
  meta.coins -= node.cost;
  meta.purchased[node.id] = true;
  saveMeta(meta);
  return true;
}
