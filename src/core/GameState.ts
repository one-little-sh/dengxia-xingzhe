// 游戏核心状态机：纯逻辑，不依赖 Phaser。
// 架构约束：渲染层只读 snapshot 与事件，不反向修改状态；
// 后续地图生成器与 AI 叙事层也只作用于这一层。
import { Tile, Dir, type LevelDef, type MoveResult, type MoveEvent, type PulseResult, type GhostState, type LampMode, type GameSnapshot, type Phase } from './types';
import { parseGrid, gridOf, levelOil } from './levels';

const DIR_DELTA: Record<Dir, { col: number; row: number }> = {
  [Dir.Up]: { col: 0, row: -1 },
  [Dir.Down]: { col: 0, row: 1 },
  [Dir.Left]: { col: -1, row: 0 },
  [Dir.Right]: { col: 1, row: 0 },
};

const key = (col: number, row: number) => `${col},${row}`;

export class GameState {
  readonly level: LevelDef;
  readonly tiles: Tile[][];
  readonly rows: number;
  readonly cols: number;

  private playerCol: number;
  private playerRow: number;
  private oil: number;
  private maxOil: number;   // 本关油量上限（编辑器 txt 头部 oil 优先）
  private steps = 0;
  private treasureCount = 0;
  private totalTreasures: number;
  private curseCount = 0;
  private totalCurses: number;
  private takenTreasures = new Set<string>();
  private takenCoins = new Set<string>();
  private coinCount = 0;
  private totalCoins: number;
  private takenKeys = new Set<string>();
  private openedLocks = new Set<string>(); // 已解锁的锁门（保持通行状态）
  private keysHeld = 0;
  private totalKeys: number;
  private openedDoors = new Set<string>(); // 已开启的捷径门（保持通行状态）
  private ghosts: GhostState[] = [];       // 幽火实体（出生点来自地图 G）
  private explored = new Set<string>();
  private phase: Phase = 'playing';
  private lowOilWarned = false;
  private dangerWarned = false;
  private ghostNearWarned = false;         // 贴身警告（离开后重置）
  private lampMode: LampMode = 'dim';      // 双灯芯：暗芯起步（续航优先）
  private obelisks: { col: number; row: number }[] = []; // 遗忘图腾
  private forgetWarned = false;            // 首次遗忘提示

  constructor(level: LevelDef) {
    this.level = level;
    this.tiles = parseGrid(gridOf(level));
    this.rows = this.tiles.length;
    this.cols = this.tiles[0].length;

    // 找起点（篝火）、统计宝物/钥匙/诅咒烛数、收集幽火出生点
    let startCol = 0, startRow = 0;
    let treasures = 0;
    let keys = 0;
    let curses = 0;
    let coins = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const t = this.tiles[r][c];
        if (t === Tile.Bonfire) { startCol = c; startRow = r; }
        if (t === Tile.Treasure) treasures++;
        if (t === Tile.Key) keys++;
        if (t === Tile.Curse) curses++;
        if (t === Tile.Coin) coins++;
        if (t === Tile.Obelisk) {
          this.obelisks.push({ col: c, row: r });
        }
        if (t === Tile.Ghost) {
          this.ghosts.push({ col: c, row: r, spawnCol: c, spawnRow: r, stunned: 0 });
        }
      }
    }
    this.playerCol = startCol;
    this.playerRow = startRow;
    this.maxOil = levelOil(level);
    this.oil = this.maxOil;
    this.totalTreasures = treasures;
    this.totalKeys = keys;
    this.totalCurses = curses;
    this.totalCoins = coins;
    this.refreshVision();
  }

  /** 当前视野半径：双灯芯按模式（白 3 / 暗 1）；否则低油收缩 + 诅咒削减（保底 1） */
  get visionRadius(): number {
    if (this.level.dualLamp) {
      return this.lampMode === 'bright' ? 3 : 1;
    }
    const penalty = this.curseCount * (this.level.curseVisionPenalty ?? 1);
    const base = this.oil <= this.level.lowOilThreshold
      ? this.level.lowOilVision
      : this.level.visionRadius;
    return Math.max(1, base - penalty);
  }

  /** 切换灯芯（双灯芯关卡，任意时刻免费）；返回事件 */
  switchLamp(): MoveEvent | null {
    if (!this.level.dualLamp || this.phase !== 'playing') return null;
    this.lampMode = this.lampMode === 'bright' ? 'dim' : 'bright';
    this.refreshVision();
    return {
      type: 'lampSwitch',
      text: this.lampMode === 'bright'
        ? '白芯亮起——视野开阔，但每一步烧两滴油。'
        : '暗芯低燃——世界缩成一圈微光，省着走。',
    };
  }

  /** 尝试朝方向移动一格，返回结果事件（渲染层据此播放动画） */
  move(dir: Dir): MoveResult {
    const result: MoveResult = { moved: false, oilChanged: 0, events: [] };
    if (this.phase !== 'playing') return result;

    const d = DIR_DELTA[dir];
    const nc = this.playerCol + d.col;
    const nr = this.playerRow + d.row;
    const target = (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows)
      ? this.tiles[nr][nc] : Tile.Wall;

    // 越界或墙：不可通行
    if (target === Tile.Wall) {
      result.events.push({ type: 'blocked' });
      return result;
    }

    // 断崖单向规则①：断崖只能从正北进入（向南跳下）
    if (target === Tile.Ledge && dir !== Dir.Down) {
      result.events.push({
        type: 'blocked',
        pos: { col: nc, row: nr },
        text: '石壁太陡——落下去，就上不来了。',
      });
      return result;
    }

    // 断崖单向规则②：站在断崖上不能向北爬
    if (this.tiles[this.playerRow][this.playerCol] === Tile.Ledge && dir === Dir.Up) {
      result.events.push({
        type: 'blocked',
        text: '崖壁垂直如削。这条路，只能向下。',
      });
      return result;
    }

    // 锁门且无钥匙：不可通行
    if (target === Tile.Locked && !this.isLockOpen(nc, nr) && this.keysHeld === 0) {
      result.events.push({
        type: 'locked',
        pos: { col: nc, row: nr },
        text: '门锁着。黑暗深处，该有一把钥匙。',
      });
      return result;
    }

    // 移动成功：步耗按灯芯模式计（双灯芯白芯 2 油 / 其余 1 油）
    result.moved = true;
    this.playerCol = nc;
    this.playerRow = nr;
    this.steps++;
    const tile = this.tiles[nr][nc];
    const stepCost = this.level.dualLamp && this.lampMode === 'bright' ? 2 : 1;
    this.oil = Math.max(0, this.oil - stepCost);
    result.oilChanged = -stepCost;
    result.stepTo = { col: nc, row: nr };
    this.refreshVision();

    // 碎裂之地：额外耗油（dangerCost，默认 2）；首次附文案，之后仅反馈
    if (tile === Tile.Danger) {
      const extra = this.level.dangerCost ?? 2;
      this.oil = Math.max(0, this.oil - extra);
      result.oilChanged -= extra;
      const ev: MoveEvent = { type: 'danger', pos: { col: nc, row: nr } };
      if (!this.dangerWarned) {
        this.dangerWarned = true;
        ev.text = '碎裂之地——灯火猛地一颤，油洒了几滴。';
      }
      result.events.push(ev);
    }

    // 拾取残烛（首次踩上）：treasureOil 关卡中回复灯油（上限为满）
    if (tile === Tile.Treasure && !this.takenTreasures.has(key(nc, nr))) {
      this.takenTreasures.add(key(nc, nr));
      this.treasureCount++;
      const gain = this.level.treasureOil ?? 0;
      if (gain > 0) {
        this.oil = Math.min(this.maxOil, this.oil + gain);
        // 回油越过低油阈值后允许下次再警告
        if (this.oil > this.level.lowOilThreshold) this.lowOilWarned = false;
        result.events.push({
          type: 'treasure',
          pos: { col: nc, row: nr },
          text: `残烛入灯，火光稳了几分。（灯油 +${gain}）`,
        });
      } else {
        result.events.push({
          type: 'treasure',
          pos: { col: nc, row: nr },
          text: '拾起一截残烛——它曾也照亮过某个人的路。',
        });
      }
    }

    // 灯币（首次踩上）：居所货币，通关结算入账
    if (tile === Tile.Coin && !this.takenCoins.has(key(nc, nr))) {
      this.takenCoins.add(key(nc, nr));
      this.coinCount++;
      result.events.push({
        type: 'coin',
        pos: { col: nc, row: nr },
        text: '拾起一枚灯币，叮的一声落进行囊。',
      });
    }

    // 拾取钥匙（首次踩上）
    if (tile === Tile.Key && !this.takenKeys.has(key(nc, nr))) {
      this.takenKeys.add(key(nc, nr));
      this.keysHeld++;
      result.events.push({
        type: 'key',
        pos: { col: nc, row: nr },
        text: '一把冰凉的钥匙。某处的锁，应声轻响。',
      });
    }

    // 诅咒残烛（首次踩上）：回油多，但视野半径永久 -1（计入全收集）
    if (tile === Tile.Curse && !this.takenTreasures.has(key(nc, nr))) {
      this.takenTreasures.add(key(nc, nr)); // 诅咒烛计入收集统计
      this.curseCount++;
      const gain = this.level.curseOil ?? 6;
      this.oil = Math.min(this.maxOil, this.oil + gain);
      if (this.oil > this.level.lowOilThreshold) this.lowOilWarned = false;
      const radius = this.visionRadius;
      result.events.push({
        type: 'curse',
        pos: { col: nc, row: nr },
        text: `紫焰入灯——灯油 +${gain}，可世界暗了一圈。（视野 ${radius}）`,
      });
    }

    // 锁门：持钥踏入 → 消耗钥匙并打开
    if (tile === Tile.Locked && !this.isLockOpen(nc, nr)) {
      this.keysHeld--;
      this.openedLocks.add(key(nc, nr));
      result.events.push({
        type: 'unlock',
        pos: { col: nc, row: nr },
        text: '钥匙转动，锁簧弹开——门开了。',
      });
    }

    // 捷径门：开启并一步传回篝火
    if (tile === Tile.Door) {
      const bonfire = this.findBonfire();
      if (bonfire) {
        this.openedDoors.add(key(nc, nr));
        this.playerCol = bonfire.col;
        this.playerRow = bonfire.row;
        result.events.push({
          type: 'shortcut',
          pos: { col: nc, row: nr },
          text: '「咔哒——」门闩落下。\n一条直通篝火的小路，从黑暗里亮了起来。',
          teleport: bonfire,
        });
        this.refreshVision();
      }
    }

    // 回程门（成对互通）：踩入传送到同关另一枚处——魂味电梯捷径
    if (tile === Tile.Warp) {
      // 找另一枚 W（已踩的这枚是 (nc,nr)）
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (this.tiles[r][c] === Tile.Warp && !(c === nc && r === nr)) {
            this.playerCol = c;
            this.playerRow = r;
            result.events.push({
              type: 'warp',
              pos: { col: nc, row: nr },
              teleport: { col: c, row: r },
              text: '符文圈亮起——你被送到了另一处。',
            });
            this.refreshVision();
            r = this.rows; // 跳出外层
            break;
          }
        }
      }
    }

    // 抉择门（异关）：踏入即封死其余抉择门——选择即承诺
    if (tile === Tile.Gate) {
      const closed: { col: number; row: number }[] = [];
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (this.tiles[r][c] === Tile.Gate && !(c === nc && r === nr)) {
            this.tiles[r][c] = Tile.Wall;
            closed.push({ col: c, row: r });
          }
        }
      }
      if (closed.length > 0) {
        result.events.push({
          type: 'gateClose',
          pos: { col: nc, row: nr },
          closed,
          text: '门在你身后合拢——其余的路，消失了。',
        });
      }
    }

    // 踩上篝火：回满灯油
    if (this.tiles[this.playerRow][this.playerCol] === Tile.Bonfire) {
      if (this.oil < this.maxOil) {
        this.oil = this.maxOil;
        result.oilChanged = this.maxOil;
        result.events.push({ type: 'refill', text: '灯芯在火光里重新饱满了。' });
        this.lowOilWarned = false;
        this.refreshVision();
      }
    }

    // 低油警告（每次进入低油区间只提醒一次；2 油消耗可能跳过阈值，用 <=）
    if (this.oil <= this.level.lowOilThreshold && !this.lowOilWarned) {
      this.lowOilWarned = true;
      result.events.push({
        type: 'lowOil',
        text: '灯光开始发抖，视野正在收窄……',
      });
    }

    // 无梦之夜（异关）：视野外不留记忆——explored 仅保留当前视野
    if (this.level.noMemory) {
      this.explored = new Set();
      this.refreshVision();
    }

    // 踩上出口：胜利（优先于灯枯与幽火——冲进出口的瞬间没人抓得住你）
    if (this.tiles[this.playerRow][this.playerCol] === Tile.Exit) {
      this.phase = 'win';
      result.events.push({ type: 'win' });
      return result;
    }

    // 遗忘图腾：走过的记忆随脚步重新变暗（视野内豁免）
    if (this.obelisks.length > 0) {
      const forgot = this.applyForgetting();
      if (forgot > 0 && !this.forgetWarned) {
        this.forgetWarned = true;
        result.events.push({
          type: 'forget',
          text: '石碑嗡鸣——你身后的黑暗，重新合拢了。',
        });
      }
    }

    // 幽火回合：玩家动一步，幽火走一步
    if (this.ghosts.length > 0) {
      const ghostEvents = this.ghostTurn();
      result.events.push(...ghostEvents);
      // 幽火把油烧干：失败
      if (this.oil <= 0) {
        this.phase = 'lose';
        result.events.push({ type: 'lose', text: '幽火掠过，灯芯烧到了尽头。\n黑暗合拢如水。' });
        return result;
      }
    }

    // 灯枯：失败
    if (this.oil <= 0) {
      this.phase = 'lose';
      result.events.push({
        type: 'lose',
        text: '灯，熄了。\n黑暗合拢如水。',
      });
      return result;
    }

    return result;
  }

  /**
   * 声呐脉冲：消耗灯油，以玩家为中心把半径内格子标记为已探索（穿墙，声音无阻）。
   * 揭示的是「记忆态」情报（地形/物件位置），不点亮当前视野。
   */
  pulse(): { result: PulseResult; events: MoveEvent[] } {
    const cost = this.level.pulseCost ?? 2;
    const radius = this.level.pulseRadius ?? 4;
    const events: MoveEvent[] = [];

    if (this.phase !== 'playing' || this.oil < cost) {
      return { result: { ok: false, radius, cost, revealed: 0 }, events };
    }

    // 扣油并揭示半径内未探索格
    this.oil -= cost;
    let revealed = 0;
    for (let r = this.playerRow - radius; r <= this.playerRow + radius; r++) {
      for (let c = this.playerCol - radius; c <= this.playerCol + radius; c++) {
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) continue;
        if (!this.explored.has(key(c, r))) {
          this.explored.add(key(c, r));
          revealed++;
        }
      }
    }
    events.push({ type: 'pulse' });

    // 声呐震慑：半径内的活跃幽火眩晕 2 回合（眩晕中为无害虚影，可穿行）
    for (const g of this.ghosts) {
      if (g.stunned === 0 &&
          Math.max(Math.abs(g.col - this.playerCol), Math.abs(g.row - this.playerRow)) <= radius) {
        g.stunned = 2;
      }
    }

    // 灯枯判定（脉冲可能耗尽最后一滴）
    if (this.oil <= 0) {
      this.phase = 'lose';
      events.push({ type: 'lose', text: '回声散尽，灯也熄了。\n黑暗合拢如水。' });
    }

    return { result: { ok: true, radius, cost, revealed }, events };
  }

  // ---------- 遗忘图腾 ----------

  /**
   * 遗忘：以每个图腾为中心、切比雪夫半径 2 内的已探索格移除（重新变暗）。
   * 当前视野内豁免（眼前有光，暗的是背影）。返回被遗忘的格子数。
   */
  private applyForgetting(): number {
    let forgot = 0;
    for (const ob of this.obelisks) {
      for (let r = ob.row - 2; r <= ob.row + 2; r++) {
        for (let c = ob.col - 2; c <= ob.col + 2; c++) {
          if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) continue;
          const k = key(c, r);
          if (!this.explored.has(k)) continue;
          if (this.inVision(c, r)) continue; // 视野内豁免
          this.explored.delete(k);
          forgot++;
        }
      }
    }
    return forgot;
  }

  // ---------- 幽火（追击者） ----------

  /**
   * 幽火回合：玩家刚移动完。顺序：先判玩家踩上眩晕火（无事件），
   * 再逐火行动（眩晕递减 / BFS 追一步），再判抓捕与贴身。
   */
  private ghostTurn(): MoveEvent[] {
    const events: MoveEvent[] = [];

    for (const g of this.ghosts) {
      if (g.stunned > 0) {
        g.stunned--;
        continue;
      }
      // BFS 沿最短路向玩家走一步（幽火不越断崖、不穿关闭的锁门、不与其他火叠格）
      const step = this.ghostStepToward(g);
      if (step) { g.col = step.col; g.row = step.row; }

      // 幽火踏上玩家：抓捕
      if (g.col === this.playerCol && g.row === this.playerRow) {
        const ev = this.catchPlayer(g);
        if (ev) events.push(ev);
      }
    }

    // 玩家踩上活跃幽火（本回合玩家先动，可能迎面撞上）——在 ghostStep 前判定过位置，
    // 这里统一兜底：同格即抓
    for (const g of this.ghosts) {
      if (g.stunned === 0 && g.col === this.playerCol && g.row === this.playerRow) {
        const ev = this.catchPlayer(g);
        if (ev) events.push(ev);
      }
    }

    // 贴身警告（相邻且活跃）
    const near = this.ghosts.some(g =>
      g.stunned === 0 &&
      Math.max(Math.abs(g.col - this.playerCol), Math.abs(g.row - this.playerRow)) === 1);
    if (near && !this.ghostNearWarned) {
      this.ghostNearWarned = true;
      events.push({ type: 'ghostNear', text: '幽火贴得很近——冷焰灼着后颈。' });
    } else if (!near) {
      this.ghostNearWarned = false;
    }

    return events;
  }

  /** 抓捕：灯油 -ghostCost，幽火打回出生点并眩晕 2 回合；油枯时返回 lose 事件 */
  private catchPlayer(g: GhostState): MoveEvent | null {
    const cost = this.level.ghostCost ?? 4;
    this.oil = Math.max(0, this.oil - cost);
    g.col = g.spawnCol;
    g.row = g.spawnRow;
    g.stunned = 2;
    const ev: MoveEvent = {
      type: 'caught',
      text: `幽火撞进灯焰——冷焰撕下了一片光。（灯油 -${cost}）`,
    };
    if (this.oil <= 0) {
      ev.text = `幽火撞进灯焰，灯，熄了。（灯油 -${cost}）`;
    }
    return ev;
  }

  /** 幽火 BFS 向玩家走一步（断崖=墙、关闭锁门=墙、其他幽火占位=墙） */
  private ghostStepToward(g: GhostState): { col: number; row: number } | null {
    if (g.col === this.playerCol && g.row === this.playerRow) return null;

    // BFS：以幽火为源，玩家为目标；返回幽火的下一步
    const blocked = new Set<string>(
      this.ghosts.filter(o => o !== g && o.stunned === 0).map(o => key(o.col, o.row)));
    const prev = new Map<string, string>();
    const dist = new Map<string, number>([[key(g.col, g.row), 0]]);
    const queue: [number, number][] = [[g.col, g.row]];
    let found: string | null = null;

    while (queue.length && !found) {
      const [c, r] = queue.shift()!;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nc >= this.cols || nr < 0 || nr >= this.rows) continue;
        const t = this.tiles[nr][nc];
        if (t === Tile.Wall || t === Tile.Ledge) continue; // 幽火不越断崖
        if (t === Tile.Locked && !this.isLockOpen(nc, nr)) continue;
        const k = key(nc, nr);
        if (dist.has(k)) continue;
        if (blocked.has(k) && !(nc === this.playerCol && nr === this.playerRow)) continue;
        dist.set(k, dist.get(key(c, r))! + 1);
        prev.set(k, key(c, r));
        if (nc === this.playerCol && nr === this.playerRow) { found = k; break; }
        queue.push([nc, nr]);
      }
    }
    if (!found) return null;

    // 回溯到幽火的第一步
    let cur = found;
    while (prev.get(cur) !== key(g.col, g.row)) {
      cur = prev.get(cur)!;
    }
    const [c, r] = cur.split(',').map(Number);
    return { col: c, row: r };
  }

  /** 某格是否在当前视野内（曼哈顿距离，切比雪夫更像火光；用切比雪夫） */
  inVision(col: number, row: number): boolean {
    const dist = Math.max(Math.abs(col - this.playerCol), Math.abs(row - this.playerRow));
    return dist <= this.visionRadius;
  }

  isExplored(col: number, row: number): boolean {
    return this.explored.has(key(col, row));
  }

  isDoorOpen(col: number, row: number): boolean {
    return this.openedDoors.has(key(col, row));
  }

  isTreasureTaken(col: number, row: number): boolean {
    return this.takenTreasures.has(key(col, row));
  }

  isLockOpen(col: number, row: number): boolean {
    return this.openedLocks.has(key(col, row));
  }

  isKeyTaken(col: number, row: number): boolean {
    return this.takenKeys.has(key(col, row));
  }

  isCoinTaken(col: number, row: number): boolean {
    return this.takenCoins.has(key(col, row));
  }

  getSnapshot(): GameSnapshot {
    return {
      phase: this.phase,
      playerCol: this.playerCol,
      playerRow: this.playerRow,
      oil: this.oil,
      maxOil: this.maxOil,
      steps: this.steps,
      treasures: this.treasureCount,
      totalTreasures: this.totalTreasures,
      curses: this.curseCount,
      totalCurses: this.totalCurses,
      coins: this.coinCount,
      totalCoins: this.totalCoins,
      keys: this.keysHeld,
      totalKeys: this.totalKeys,
      ghosts: this.ghosts.map(g => ({ ...g })),
      explored: this.explored,
      visionRadius: this.visionRadius,
      lampMode: this.lampMode,
      dualLamp: this.level.dualLamp ?? false,
    };
  }

  /** 以玩家为中心刷新已探索集合 */
  private refreshVision(): void {
    for (let r = this.playerRow - this.visionRadius; r <= this.playerRow + this.visionRadius; r++) {
      for (let c = this.playerCol - this.visionRadius; c <= this.playerCol + this.visionRadius; c++) {
        if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
          this.explored.add(key(c, r));
        }
      }
    }
  }

  private findBonfire(): { col: number; row: number } | null {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.tiles[r][c] === Tile.Bonfire) return { col: c, row: r };
      }
    }
    return null;
  }
}
