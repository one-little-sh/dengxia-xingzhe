// 程序化像素纹理生成：16×16 字符位图 → Phaser 纹理，场景内放大 3 倍渲染。
// 后续可整体替换为真像素素材，场景代码只需换帧名。
import Phaser from 'phaser';
import { Tile } from '../core/types';

/** 调色板：字符 → 颜色 */
const PAL: Record<string, string> = {
  '0': '#070a10', // 最深背景
  '1': '#141a26', // 地板深
  '2': '#232c3d', // 砖
  '3': '#3f4d63', // 石
  'a': '#54627a', // 石亮
  '4': '#c8b98f', // 米白
  '5': '#f0b34a', // 油黄
  '6': '#f8d378', // 亮黄
  '7': '#e2543a', // 红
  '8': '#6e4526', // 木深
  '9': '#a06a3a', // 木浅
  'b': '#8a2f22', // 火深红
  'c': '#3a7a8a', // 幽火外焰（冷青）
  'd': '#7fd4e0', // 幽火主体（冷蓝绿）
  'e': '#d8f6ff', // 幽火内焰（近白）
  'f': '#5a2a6a', // 诅咒外焰（暗紫）
  'g': '#9a4ac8', // 诅咒主体（紫）
  'h': '#e0b0ff', // 诅咒内焰（亮紫）
  'i': '#1a3a3a', // 图腾石碑（暗青）
  'j': '#2f5a5a', // 图腾刻痕（青）
  'k': '#6ab0b0', // 图腾符文亮线（亮青）
  'l': '#8a6a2a', // 抉择门框（暗金）
  'm': '#c8a050', // 抉择门扉（金）
  'n': '#8a6a1a', // 灯币边（暗金）
  'o': '#2a4a2a', // 森林地苔（深绿）
  'p': '#3a5a34', // 森林苔藓亮部（绿）
  'q': '#4a3520', // 树皮（棕）
  'r': '#5a4530', // 树皮亮部
  's': '#7fd4a0', // 符文圈（幽绿）
};

/** 创建画布纹理（键已存在或创建失败时返回 null，调用方直接跳过） */
function mkCanvas(
  scene: Phaser.Scene,
  key: string,
  size: number,
): { tex: Phaser.Textures.CanvasTexture; ctx: CanvasRenderingContext2D } | null {
  if (scene.textures.exists(key)) return null;
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) return null;
  return { tex, ctx: tex.getContext() };
}

/** 字符位图 → 纹理 */
function makeBitmap(scene: Phaser.Scene, key: string, rows: string[]): void {
  const cv = mkCanvas(scene, key, 16);
  if (!cv) return;
  const { ctx } = cv;
  for (let y = 0; y < rows.length && y < 16; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length && x < 16; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const color = PAL[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  cv.tex.refresh();
}

/** 程序化地板 / 墙体（规则图案 + 伪随机噪点，不需要手绘） */
function makeFloor(scene: Phaser.Scene): void {
  const cv = mkCanvas(scene, 'tx-floor', 16);
  if (!cv) return;
  const { ctx } = cv;
  const rnd = new Phaser.Math.RandomDataGenerator(['floor-seed']);
  ctx.fillStyle = PAL['1'];
  ctx.fillRect(0, 0, 16, 16);
  // 噪点石板
  for (let i = 0; i < 26; i++) {
    const x = rnd.between(0, 15);
    const y = rnd.between(0, 15);
    ctx.fillStyle = rnd.frac() < 0.5 ? '#101521' : '#1a2230';
    ctx.fillRect(x, y, 1, 1);
  }
  // 石板缝
  ctx.fillStyle = '#0d1220';
  ctx.fillRect(0, 15, 16, 1);
  ctx.fillRect(15, 0, 1, 16);
  ctx.fillRect(0, 7, 16, 1);
  cv.tex.refresh();
}

function makeWall(scene: Phaser.Scene): void {
  const cv = mkCanvas(scene, 'tx-wall', 16);
  if (!cv) return;
  const { ctx } = cv;
  const rnd = new Phaser.Math.RandomDataGenerator(['wall-seed']);
  ctx.fillStyle = PAL['2'];
  ctx.fillRect(0, 0, 16, 16);
  // 两层交错砖
  const brick = (bx: number, by: number, w: number) => {
    ctx.fillStyle = '#2a3444';
    ctx.fillRect(bx, by, w, 6);
    ctx.fillStyle = '#3f4d63';
    ctx.fillRect(bx, by, w, 1); // 顶棱高光
  };
  brick(0, 0, 7); brick(8, 0, 8);
  brick(0, 8, 3); brick(4, 8, 7); brick(12, 8, 4);
  ctx.fillStyle = '#141a26';
  ctx.fillRect(0, 7, 16, 1);
  ctx.fillRect(0, 15, 16, 1);
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = rnd.frac() < 0.5 ? '#1e2735' : '#33405a';
    ctx.fillRect(rnd.between(0, 15), rnd.between(0, 15), 1, 1);
  }
  cv.tex.refresh();
}

/** 森林主题地板：苔藓草地 */
function makeForestFloor(scene: Phaser.Scene): void {
  const cv = mkCanvas(scene, 'tx-forest-floor', 16);
  if (!cv) return;
  const { ctx } = cv;
  const rnd = new Phaser.Math.RandomDataGenerator(['forest-floor-seed']);
  ctx.fillStyle = PAL['o'];
  ctx.fillRect(0, 0, 16, 16);
  // 草簇与泥点
  for (let i = 0; i < 20; i++) {
    const x = rnd.between(0, 15), y = rnd.between(0, 15);
    ctx.fillStyle = rnd.frac() < 0.55 ? '#243c24' : PAL['p'];
    ctx.fillRect(x, y, 1, rnd.frac() < 0.4 ? 2 : 1);
  }
  // 泥土缝隙
  ctx.fillStyle = '#1e301e';
  ctx.fillRect(0, 15, 16, 1);
  ctx.fillRect(8, 0, 1, 7);
  cv.tex.refresh();
}

/** 森林主题墙：树干（竖纹树皮 + 断枝） */
function makeForestWall(scene: Phaser.Scene): void {
  const cv = mkCanvas(scene, 'tx-forest-wall', 16);
  if (!cv) return;
  const { ctx } = cv;
  const rnd = new Phaser.Math.RandomDataGenerator(['forest-wall-seed']);
  ctx.fillStyle = PAL['q'];
  ctx.fillRect(0, 0, 16, 16);
  // 竖向树皮纹
  for (let x = 0; x < 16; x += 3) {
    ctx.fillStyle = x % 6 === 0 ? '#3a2a18' : PAL['r'];
    ctx.fillRect(x, 0, 1, 16);
  }
  // 断枝节疤
  ctx.fillStyle = '#2a2012';
  ctx.fillRect(3, 5, 3, 2);
  ctx.fillRect(11, 10, 2, 3);
  ctx.fillStyle = '#5a5040';
  ctx.fillRect(3, 5, 3, 1);
  // 苔藓沿树皮
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = rnd.frac() < 0.5 ? PAL['o'] : PAL['p'];
    ctx.fillRect(rnd.between(0, 15), rnd.between(0, 15), 1, 1);
  }
  cv.tex.refresh();
}

/** 玩家：提灯旅人（兜帽剪影 + 身前油灯） */
const BMP_PLAYER = [
  '................',
  '.....44444......',
  '....4222224.....',
  '....42...24.....',
  '....4222224.....',
  '.....42224......',
  '....4222224.....',
  '...422222224....',
  '...4226622 4....',
  '...42.66.224....',
  '...422662224....',
  '....4222224.....',
  '....42...24.....',
  '....42...24.....',
  '...422...224....',
  '................',
];

/** 篝火两帧（火焰摇曳） */
const BMP_BONFIRE_0 = [
  '................',
  '.......5........',
  '......565.......',
  '......765.......',
  '.....76657......',
  '......6656......',
  '.....76667......',
  '.....b665b......',
  '......555.......',
  '....a4a4a4a.....',
  '...a.4.4.4.a....',
  '...a...a...a....',
  '....a.a.a.a.....',
  '................',
  '................',
  '................',
];
const BMP_BONFIRE_1 = [
  '................',
  '................',
  '......56........',
  '......657.......',
  '.....5667.......',
  '.....5665.......',
  '.....76667......',
  '.....b665b......',
  '......555.......',
  '....a4a4a4a.....',
  '...a.4.4.4.a....',
  '...a...a...a....',
  '....a.a.a.a.....',
  '................',
  '................',
  '................',
];

/** 宝箱（未开） */
const BMP_CHEST = [
  '................',
  '................',
  '................',
  '...99999999.....',
  '..9999999999....',
  '..9955555599....',
  '..9556666559....',
  '..9999999999....',
  '..9888888889....',
  '..9888558889....',
  '..9885665889....',
  '..9888558889....',
  '..9888888889....',
  '..9999999999....',
  '................',
  '................',
];

/** 捷径门（关闭 / 开启透光） */
const BMP_DOOR = [
  '................',
  '..4444444444....',
  '..4222222224....',
  '..4888888884....',
  '..4878787884....',
  '..4888888884....',
  '..4878787884....',
  '..4888888884....',
  '..4878787884....',
  '..48888888 4....',
  '..4888588884....',
  '..4888588884....',
  '..4888888884....',
  '..4222222224....',
  '..4444444444....',
  '................',
];
const BMP_DOOR_OPEN = [
  '................',
  '..4444444444....',
  '..4222222224....',
  '..4666666664....',
  '..4655555564....',
  '..4655555564....',
  '..4655665564....',
  '..4655665564....',
  '..4655555564....',
  '..4655555564....',
  '..4655555564....',
  '..4655555564....',
  '..4655555564....',
  '..4222222224....',
  '..4444444444....',
  '................',
];

/** 出口：下行阶梯，深处透光 */
const BMP_EXIT = [
  '................',
  '................',
  '...222222222....',
  '...200000002....',
  '...205555502....',
  '...205666502....',
  '...205655502....',
  '...205555502....',
  '...a055550a....',
  '...aa5555aa.....',
  '....a0550a......',
  '....aa55aa......',
  '.....aaaa.......',
  '.....a..a.......',
  '....a....a......',
  '................',
];

/** 碎裂之地：暗色地面上的红色裂纹（X 形，中心发亮） */
const BMP_HAZARD = [
  '................',
  '................',
  '..7..........7..',
  '...7..b......7..',
  '....7......b....',
  '.....7....7.....',
  '......7..7......',
  '.......66.......',
  '.......66.......',
  '......7..7......',
  '.....7....7.....',
  '....b.....7.....',
  '...7....b...7...',
  '..7..........7..',
  '................',
  '................',
];

/** 钥匙：铜色古钥横置 */
const BMP_KEY = [
  '................',
  '................',
  '................',
  '....999.........',
  '...9...9........',
  '...9...9........',
  '...9...9999999..',
  '...9...9....6...',
  '....999......6..',
  '............6...',
  '.........9..6...',
  '..........99....',
  '................',
  '................',
  '................',
  '................',
];

/** 诅咒残烛：紫焰烛台（回油多但视野变暗） */
const BMP_CURSE = [
  '................',
  '................',
  '.......h........',
  '......ghg.......',
  '......ggg.......',
  '.....gghgg......',
  '.....gghgg......',
  '......ggg.......',
  '.....f9f9f......',
  '....f88888f.....',
  '....f88888f.....',
  '....f88888f.....',
  '.....99999......',
  '....9.....9.....',
  '................',
  '................',
];

/** 胡须层（叠加在玩家身上：未剃须时显示） */
const BMP_BEARD = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....7777.......',
  '....777777......',
  '....777777......',
  '.....7777.......',
  '................',
  '................',
];

/** 斗笠层（叠加在玩家头顶：已购 hat 时显示） */
const BMP_HAT = [
  '................',
  '................',
  '......77........',
  '.....7887.......',
  '....788887......',
  '...78888887.....',
  '..7888888887....',
  '.788888888887...',
  '..a...a...a.....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

/** 回程门：幽绿符文圈（成对互通的传送阵） */
const BMP_WARP = [
  '................',
  '................',
  '....ss....ss....',
  '...s..s..s..s...',
  '..s....ss....s..',
  '..s...s..s...s..',
  '.......ss.......',
  '..s..s....s..s..',
  '..s..s....s..s..',
  '.......ss.......',
  '..s...s..s...s..',
  '..s....ss....s..',
  '...s..s..s..s...',
  '....ss....ss....',
  '................',
  '................',
];

/** 灯币：小铜钱（暖金） */
const BMP_COIN = [
  '................',
  '................',
  '................',
  '.....nnnn.......',
  '....n6666n......',
  '...n6m6666n.....',
  '...n6666m6n.....',
  '...n6mmmm6n.....',
  '...n666666n.....',
  '...n6m66m6n.....',
  '....n6666n......',
  '.....nnnn.......',
  '................',
  '................',
  '................',
  '................',
];

/** 抉择门（异关·三门）：暗金双扉，中央竖缝透光 */
const BMP_GATE = [
  '................',
  '..4444444444....',
  '..4llllllll4....',
  '..4666666664....',
  '..4655555564....',
  '..4655mm5564....',
  '..4655mm5564....',
  '..4655mm5564....',
  '..4655mm5564....',
  '..4655mm5564....',
  '..4655mm5564....',
  '..4655mm5564....',
  '..4655555564....',
  '..4666666664....',
  '..4llllllll4....',
  '..4444444444....',
];

/** 遗忘图腾：暗青石碑 + 竖排符文刻痕 */
const BMP_OBELISK = [
  '................',
  '.....iiiiii.....',
  '....ijjjjji.....',
  '....ij.kk.ji....',
  '....ij.kk.ji....',
  '....ijkkkkji....',
  '....ij.kk.ji....',
  '....ijkkkkji....',
  '....ij.kk.ji....',
  '....ijkkkkji....',
  '....ij.kk.ji....',
  '....ijkkkkji....',
  '....ijjjjjji....',
  '.....iiiiii.....',
  '....jj.jj.jj....',
  '................',
];

/** 幽火两帧（冷蓝绿火苗，摇曳）——调色板外用直画 */
const BMP_GHOST_0 = [
  '................',
  '................',
  '................',
  '......cc........',
  '.....cddc.......',
  '.....dedd.......',
  '....cdddec......',
  '....dddded......',
  '...cdddeedc.....',
  '...dddedded.....',
  '...cdeddded.....',
  '....cdeddd......',
  '....cdded.......',
  '.....ced........',
  '......c.........',
  '................',
];
const BMP_GHOST_1 = [
  '................',
  '................',
  '.......cc.......',
  '......cded......',
  '......dddc......',
  '.....cdded......',
  '.....dedddc.....',
  '....cddedde.....',
  '....ddeddded....',
  '...cdeddedd.....',
  '...dddddedd.....',
  '....cddeddd.....',
  '.....cded.......',
  '......ced.......',
  '................',
  '................',
];

/** 断崖：石台边缘（上半是地面，下半是下坠的深渊） */const BMP_LEDGE = [
  '................',
  '................',
  '1111111111111111',
  '1111111111111111',
  'aaaaaaaaaaaaaaaa',
  '1111111111111111',
  '..2..........2..',
  '...2..b......2..',
  '....2..2..b.....',
  '.....2..2.......',
  '......b2..2.....',
  '.....2..2..b....',
  '....b...2..2....',
  '...2........2...',
  '................',
  '................',
];

/** 锁门（关闭）：铁栅 + 锁孔，冷色调 */
const BMP_LOCKED = [
  '................',
  '..4444444444....',
  '..4222222224....',
  '..4aaaaaaaa4....',
  '..4a3a3a3aa4....',
  '..4a3a3a3aa4....',
  '..4a33333aa4....',
  '..4aa333aaa4....',
  '..4aaaaaaaa4....',
  '..4aa3333aa4....',
  '..4aa3a3aaa4....',
  '..4aa3333aa4....',
  '..4aaaaaaaa4....',
  '..4222222224....',
  '..4444444444....',
  '................',
];

/** 锁门（打开）：铁栅升起，透出暖光 */
const BMP_LOCKED_OPEN = [
  '................',
  '..4444444444....',
  '..4222222224....',
  '..4666666664....',
  '..4655555564....',
  '..4655555564....',
  '..4655665564....',
  '..4655665564....',
  '..4655555564....',
  '..4655555564....',
  '..4655555564....',
  '..4655555564....',
  '..4655555564....',
  '..4222222224....',
  '..4444444444....',
  '................',
];

/** 生成全部静态纹理 */
export function buildTextures(scene: Phaser.Scene): void {
  makeFloor(scene);
  makeWall(scene);
  makeForestFloor(scene);
  makeForestWall(scene);
  makeBitmap(scene, 'tx-warp', BMP_WARP);
  makeBitmap(scene, 'tx-player', BMP_PLAYER);
  makeBitmap(scene, 'tx-bonfire-0', BMP_BONFIRE_0);
  makeBitmap(scene, 'tx-bonfire-1', BMP_BONFIRE_1);
  makeBitmap(scene, 'tx-chest', BMP_CHEST);
  makeBitmap(scene, 'tx-door', BMP_DOOR);
  makeBitmap(scene, 'tx-door-open', BMP_DOOR_OPEN);
  makeBitmap(scene, 'tx-exit', BMP_EXIT);
  makeBitmap(scene, 'tx-hazard', BMP_HAZARD);
  makeBitmap(scene, 'tx-key', BMP_KEY);
  makeBitmap(scene, 'tx-locked', BMP_LOCKED);
  makeBitmap(scene, 'tx-locked-open', BMP_LOCKED_OPEN);
  makeBitmap(scene, 'tx-ledge', BMP_LEDGE);
  makeBitmap(scene, 'tx-ghost-0', BMP_GHOST_0);
  makeBitmap(scene, 'tx-ghost-1', BMP_GHOST_1);
  makeBitmap(scene, 'tx-curse', BMP_CURSE);
  makeBitmap(scene, 'tx-obelisk', BMP_OBELISK);
  makeBitmap(scene, 'tx-gate', BMP_GATE);
  makeBitmap(scene, 'tx-coin', BMP_COIN);
  makeBitmap(scene, 'tx-beard', BMP_BEARD);
  makeBitmap(scene, 'tx-hat', BMP_HAT);

  // 图腾冷光晕：径向渐变（暗青）
  const osize = 160;
  const ocv = mkCanvas(scene, 'tx-obelisk-light', osize);
  if (ocv) {
    const grad = ocv.ctx.createRadialGradient(
      osize / 2, osize / 2, osize * 0.05, osize / 2, osize / 2, osize / 2);
    grad.addColorStop(0, 'rgba(106, 176, 176, 0.18)');
    grad.addColorStop(0.5, 'rgba(47, 90, 90, 0.08)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ocv.ctx.fillStyle = grad;
    ocv.ctx.fillRect(0, 0, osize, osize);
    ocv.tex.refresh();
  }

  // 诅咒紫光晕：径向渐变
  const csize = 160;
  const ccv = mkCanvas(scene, 'tx-curse-light', csize);
  if (ccv) {
    const grad = ccv.ctx.createRadialGradient(
      csize / 2, csize / 2, csize * 0.05, csize / 2, csize / 2, csize / 2);
    grad.addColorStop(0, 'rgba(224, 176, 255, 0.25)');
    grad.addColorStop(0.4, 'rgba(154, 74, 200, 0.10)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ccv.ctx.fillStyle = grad;
    ccv.ctx.fillRect(0, 0, csize, csize);
    ccv.tex.refresh();
  }

  // 幽火冷光晕：径向渐变（青蓝色）
  const gsize = 192;
  const gcv = mkCanvas(scene, 'tx-ghost-light', gsize);
  if (gcv) {
    const grad = gcv.ctx.createRadialGradient(
      gsize / 2, gsize / 2, gsize * 0.05, gsize / 2, gsize / 2, gsize / 2);
    grad.addColorStop(0, 'rgba(127, 212, 224, 0.30)');
    grad.addColorStop(0.4, 'rgba(58, 122, 138, 0.12)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    gcv.ctx.fillStyle = grad;
    gcv.ctx.fillRect(0, 0, gsize, gsize);
    gcv.tex.refresh();
  }

  // 光晕：径向渐变（灯火的暖光）
  const size = 256;
  const cv = mkCanvas(scene, 'tx-light', size);
  if (!cv) return;
  const grad = cv.ctx.createRadialGradient(
    size / 2, size / 2, size * 0.06, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(248, 211, 120, 0.34)');
  grad.addColorStop(0.4, 'rgba(240, 179, 74, 0.14)');
  grad.addColorStop(0.75, 'rgba(120, 80, 30, 0.05)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  cv.ctx.fillStyle = grad;
  cv.ctx.fillRect(0, 0, size, size);
  cv.tex.refresh();
}

/** 格子类型 → 基础纹理键（篝火等动画物件由场景特殊处理） */
export function tileTexture(tile: Tile): string {
  switch (tile) {
    case Tile.Wall: return 'tx-wall';
    case Tile.Bonfire: return 'tx-bonfire-0';
    case Tile.Exit: return 'tx-exit';
    case Tile.Treasure: return 'tx-chest';
    case Tile.Door: return 'tx-door';
    case Tile.Danger: return 'tx-hazard';
    case Tile.Key: return 'tx-key';
    case Tile.Locked: return 'tx-locked';
    case Tile.Ledge: return 'tx-ledge';
    case Tile.Curse: return 'tx-curse';
    case Tile.Obelisk: return 'tx-obelisk';
    case Tile.Gate: return 'tx-gate';
    case Tile.Coin: return 'tx-coin';
    case Tile.Warp: return 'tx-warp';
    default: return 'tx-floor';
  }
}

/** 主题 → 地板/墙纹理键（章节美术主题：缺省地牢） */
export function themeTextures(theme?: string): { floor: string; wall: string } {
  if (theme === 'forest') {
    return { floor: 'tx-forest-floor', wall: 'tx-forest-wall' };
  }
  return { floor: 'tx-floor', wall: 'tx-wall' };
}
