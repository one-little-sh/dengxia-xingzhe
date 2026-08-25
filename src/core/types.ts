// 核心类型定义：纯逻辑层与渲染层共享的数据契约

/** 格子类型 */
export enum Tile {
  Floor = 'floor',   // 地板（可通行）
  Wall = 'wall',     // 墙（不可通行）
  Bonfire = 'bonfire', // 篝火（回满灯油）
  Exit = 'exit',     // 出口（踩上即胜利）
  Treasure = 'treasure', // 宝物（首次踩上拾取）
  Door = 'door',     // 捷径门（踩上传送回篝火）
  Danger = 'danger', // 危险格·碎地（踩上额外扣灯油）
  Key = 'key',       // 钥匙（首次踩上拾取，用于开锁门）
  Locked = 'locked', // 锁门（无钥匙时不可通行；持钥踏入消耗钥匙并打开）
  Ledge = 'ledge',   // 断崖（单向落差：只能从北向南跳下，爬不回去）
  Ghost = 'ghost',   // 幽火出生点（追击者：玩家动一步它走一步；渲染层特殊处理）
  Curse = 'curse',   // 诅咒残烛（回油多但视野半径永久 -1）
  Obelisk = 'obelisk', // 遗忘图腾（半径 2 内已探索格随玩家脚步重新变暗，视野内豁免）
  Gate = 'gate',     // 抉择门（异关预留：踩入后其余抉择门永久封死，选择即承诺）
  Coin = 'coin',     // 灯币（居所货币：拾取入账，通关结算）
  Warp = 'warp',     // 回程门（成对互通：踩入传送到同关另一枚处——魂味电梯捷径）
}

/** 移动方向 */
export enum Dir {
  Up = 'up',
  Down = 'down',
  Left = 'left',
  Right = 'right',
}

/** 关卡定义：手工关与生成器输出共用同一结构 */
export interface LevelDef {
  id: number;
  chapterName: string; // 章节名，如「第一章 · 引灯」
  levelName: string;   // 关卡名，如「初入黑暗」
  intro: string;       // 开局提示（一句话点出本关教学点）
  /** 行优先的字符地图，每个字符对应一种格子：
   *  # 墙 | . 地板 | F 篝火(起点) | E 出口 | T 宝物 | D 捷径门
   *  X 碎地(危险格) | K 钥匙 | L 锁门 | V 断崖(单向落差) | G 幽火出生点
   *  C 诅咒残烛 | R 遗忘图腾 | B 抉择门(异关) | $ 灯币(居所货币) | W 回程门(成对传送) */
  grid: string[];
  /** 网格外置文件（levels/ 目录 txt，编辑器维护）：设置后忽略 grid，仅用于可视化编辑流程 */
  gridFile?: string;
  oil: number;         // 初始灯油
  dangerCost?: number; // 踩上碎地的额外耗油（默认 2）
  treasureOil?: number; // 拾取残烛时回复的灯油（不设则残烛仅为收集品）
  ghostCost?: number;  // 被幽火撞上的灯油损失（默认 4）
  curseOil?: number;    // 拾取诅咒残烛回复的灯油（默认 6）
  curseVisionPenalty?: number; // 每个诅咒残烛的视野半径削减（默认 1）
  pulseCost?: number;   // 声呐脉冲的灯油消耗（第五章，默认 2）
  pulseRadius?: number; // 声呐脉冲的揭示半径（默认 4，穿墙）
  dualLamp?: boolean;   // 双灯芯模式（第八章）：白芯视野 3/步耗 2，暗芯视野 1/步耗 1，Q 键切换
  visionRadius: number; // 满油时的视野半径（格）
  lowOilVision: number; // 低油时的视野半径（格）
  lowOilThreshold: number; // 视野收缩的油量阈值
  tutorial?: boolean;  // 教学关标记：特殊物件被照见时显示旁注标签（仅 L1 使用）
  theme?: string;       // 章节美术主题（forest/bronze/cave/ice/swamp/cursed/mono/relic/abyss；缺省地牢）
  noMemory?: boolean;  // 异关·无梦之夜：视野外不留记忆（回头=全黑）
  hiddenItems?: boolean; // 异关·盲物之厅：物件（烛/钥/锁/门）在记忆态隐形，仅视野内可见
  tint?: string;       // 异关氛围色罩（'#rrggbb'，低透明全屏叠加）
}

/** 一次移动的结果事件，渲染层据此播放动画与提示 */
export interface MoveResult {
  moved: boolean;          // 是否实际移动（撞墙为 false）
  oilChanged: number;      // 灯油变化（移动 -1，踩篝火回满为满值）
  stepTo?: { col: number; row: number }; // 本次移动的落点（传送生效前）
  events: MoveEvent[];     // 触发的事件列表（按顺序）
}

/** 移动触发的具体事件 */
export interface MoveEvent {
  type:
    | 'treasure' | 'shortcut' | 'danger'
    | 'key' | 'unlock' | 'locked'
    | 'caught' | 'ghostNear'
    | 'curse' | 'lampSwitch'
    | 'forget' | 'gateClose'
    | 'coin' | 'warp'
    | 'pulse' | 'pulseFail'
    | 'lowOil' | 'refill' | 'win' | 'lose' | 'blocked';
  text?: string;   // 给玩家的提示文本
  pos?: { col: number; row: number };      // 事件发生格（宝物 / 捷径门 / 碎地 / 钥匙 / 锁门）
  teleport?: { col: number; row: number }; // 传送目标（捷径门 → 篝火）
  closed?: { col: number; row: number }[]; // 抉择门封死的位置列表（渲染层换墙贴图）
}

/** 幽火运行时状态（快照内为只读视图） */
export interface GhostState {
  col: number;
  row: number;
  spawnCol: number;   // 出生点（被抓后打回）
  spawnRow: number;
  stunned: number;    // 剩余眩晕回合数（>0 时为无害虚影，可穿行）
}

/** 声呐脉冲结果 */
export interface PulseResult {
  ok: boolean;         // 是否成功（灯油不足则 false）
  radius: number;      // 本关脉冲半径
  cost: number;        // 本关脉冲耗油
  revealed: number;    // 新揭示的格子数
}

/** 灯芯模式（第八章双灯芯） */
export type LampMode = 'bright' | 'dim';

/** 游戏进行状态 */
export type Phase = 'playing' | 'win' | 'lose';

/** 对外暴露的只读快照（渲染层只读它，不改它） */
export interface GameSnapshot {
  phase: Phase;
  playerCol: number;
  playerRow: number;
  oil: number;
  maxOil: number;
  steps: number;
  treasures: number;      // 已拾取宝物数
  totalTreasures: number;
  curses: number;         // 已拾取诅咒残烛数
  totalCurses: number;    // 本关诅咒残烛总数
  coins: number;          // 本关已拾取灯币数
  totalCoins: number;     // 本关灯币总数
  keys: number;           // 持有钥匙数
  totalKeys: number;      // 本关钥匙总数
  ghosts: readonly GhostState[]; // 幽火列表（含眩晕态）
  explored: ReadonlySet<string>; // 已探索格 "col,row"
  visionRadius: number;   // 当前视野半径
  lampMode: LampMode;     // 当前灯芯模式（非双灯芯关卡恒为 'bright'）
  dualLamp: boolean;      // 本关是否启用双灯芯
}
