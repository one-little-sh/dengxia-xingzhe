// 手工关卡数据（L1–L50）。
// 设计原则见 docs/level-design.md；每关一个教学点。
// 校验：npm run verify（BFS+Dijkstra，网格读 levels/*.txt，参数在本文件）。
// 网格外置：levels/<N>.txt（可视化编辑器维护）——txt 修改后 Vite HMR 热更新。
import { Tile, type LevelDef } from './types';

/** levels/ 目录的 txt 网格（文件名如 L3.txt）；启动时收集，新增 txt 需重启 dev */
const gridFiles = import.meta.glob('../../levels/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** txt 解析结果：可选参数头部（oil: N）+ 网格行。头部以空行与网格分隔 */
export interface TxtLevelData {
  oil?: number;      // 编辑器自定义灯油（未写头部则 undefined）
  grid: string[];
}

/** 解析 txt 内容：兼容「纯网格」与「头部参数 + 空行 + 网格」两种格式 */
export function parseLevelTxt(raw: string): TxtLevelData {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const data: TxtLevelData = { grid: [] };
  let gridStarted = false;
  for (const line of lines) {
    const t = line.trim();
    if (t.length === 0) {
      if (gridStarted) continue; // 网格尾部空行
      continue;                  // 头部与网格之间的空行
    }
    // 头部行：key: value（仅网格开始前识别）
    if (!gridStarted && /^[a-zA-Z]+:\s*\S+$/.test(t)) {
      const m = t.match(/^([a-zA-Z]+):\s*(\S+)$/)!;
      if (m[1] === 'oil') {
        const n = Number(m[2]);
        if (Number.isFinite(n) && n > 0) data.oil = Math.floor(n);
      }
      continue;
    }
    gridStarted = true;
    data.grid.push(line);
  }
  return data;
}

/** 按文件名（不含扩展名）取外置网格；无则返回 null */
export function loadGridFile(name: string): string[] | null {
  const raw = gridFiles[`../../levels/${name}.txt`];
  if (!raw) return null;
  const { grid } = parseLevelTxt(raw);
  return grid.length > 0 ? grid : null;
}

/** 取外置 txt 完整数据（含自定义 oil）；无则返回 null */
function loadLevelTxt(name: string): TxtLevelData | null {
  const raw = gridFiles[`../../levels/${name}.txt`];
  if (!raw) return null;
  const data = parseLevelTxt(raw);
  return data.grid.length > 0 ? data : null;
}

/** 解析关卡网格：gridFile 优先（外置 txt），否则内联 grid */
export function gridOf(level: LevelDef): string[] {
  if (level.gridFile) {
    const g = loadGridFile(level.gridFile);
    if (g) return g;
  }
  return level.grid;
}

/** 关卡初始灯油：编辑器写入 txt 头部的 oil 优先，否则用 levels.ts 的 level.oil */
export function levelOil(level: LevelDef): number {
  if (level.gridFile) {
    const data = loadLevelTxt(level.gridFile);
    if (data?.oil !== undefined) return data.oil;
  }
  return level.oil;
}

/** 字符地图转格子矩阵 */
export function parseGrid(rows: string[]): Tile[][] {
  return rows.map(row =>
    row.split('').map(ch => {
      switch (ch) {
        case '#': return Tile.Wall;
        case 'F': return Tile.Bonfire;
        case 'E': return Tile.Exit;
        case 'T': return Tile.Treasure;
        case 'D': return Tile.Door;
        case 'X': return Tile.Danger;
        case 'K': return Tile.Key;
        case 'L': return Tile.Locked;
        case 'V': return Tile.Ledge;
        case 'G': return Tile.Ghost;
        case 'C': return Tile.Curse;
        case 'R': return Tile.Obelisk;
        case 'B': return Tile.Gate;
        case '$': return Tile.Coin;
        case 'W': return Tile.Warp;
        default: return Tile.Floor;
      }
    })
  );
}

const LEVEL_1: LevelDef = {
  id: 1,
  chapterName: '第一章 · 引灯',
  levelName: '初入黑暗',
  intro: '提灯入暗。找到深处的出口——灯油有限。',
  oil: 16,
  lowOilThreshold: 6,
  visionRadius: 2,
  lowOilVision: 1,
  tutorial: true,
  grid: [],
  gridFile: 'L1',
};

const LEVEL_2: LevelDef = {
  id: 2,
  chapterName: '第一章 · 引灯',
  levelName: '回头路',
  intro: '灯暗了不要慌——回到篝火旁，火光会重新灌满你的灯。',
  oil: 14,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L2',
};

const LEVEL_3: LevelDef = {
  id: 3,
  chapterName: '第一章 · 引灯',
  levelName: '残烛与门',
  intro: '深处的岔路尽头藏着残烛，还有一扇回头的门。',
  oil: 16,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L3',
};

const LEVEL_4: LevelDef = {
  id: 4,
  chapterName: '第一章 · 引灯',
  levelName: '深处的门',
  intro: '往深处去。井底的门，是灯枯之前唯一的退路。',
  oil: 9,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L4',
};

const LEVEL_5: LevelDef = {
  id: 5,
  chapterName: '第一章 · 引灯',
  levelName: '引灯人之心',
  intro: '引灯人的最后一课：灯、火、门，与回头路。',
  oil: 14,
  lowOilThreshold: 6,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L5',
};

const LEVEL_6: LevelDef = {
  id: 6,
  chapterName: '第二章 · 岔路',
  levelName: '荆棘林',
  intro: '林间小径被荆棘封住了。踩过去，灯会多耗一滴油。',
  theme: 'forest',
  tint: '#2a4a2a',
  oil: 11,
  dangerCost: 2,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  tutorial: true,
  grid: [],
  gridFile: 'L6',
};

const LEVEL_7: LevelDef = {
  id: 7,
  chapterName: '第二章 · 岔路',
  levelName: '荆棘回廊',
  intro: '回廊很长，灯油很紧。数着步子走。',
  theme: 'forest',
  tint: '#2a4a2a',
  oil: 13,
  dangerCost: 2,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L7',
};

const LEVEL_8: LevelDef = {
  id: 8,
  chapterName: '第二章 · 岔路',
  levelName: '两盏残烛',
  intro: '路旁垂着两盏残烛。取走它们，灯油会回来一些。',
  theme: 'forest',
  tint: '#2a4a2a',
  oil: 14,
  dangerCost: 2,
  treasureOil: 3,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L8',
};

const LEVEL_9: LevelDef = {
  id: 9,
  chapterName: '第二章 · 岔路',
  levelName: '双径',
  intro: '一条险，一条远。选你的路。',
  theme: 'forest',
  tint: '#2a4a2a',
  oil: 13,
  dangerCost: 2,
  treasureOil: 3,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L9',
};

const LEVEL_10: LevelDef = {
  id: 10,
  chapterName: '第二章 · 岔路',
  levelName: '岔路之心',
  intro: '岔路的尽头：灯、火、门，与碎裂之地。',
  theme: 'forest',
  tint: '#2a4a2a',
  oil: 13,
  dangerCost: 2,
  treasureOil: 3,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L10',
};

const LEVEL_11: LevelDef = {
  id: 11,
  chapterName: '第三章 · 门与钥',
  levelName: '锁',
  intro: '前方的门上了锁。黑暗里，总有一把钥匙在等门。',
  oil: 14,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  tutorial: true,
  grid: [],
  gridFile: 'L11',
  theme: 'bronze',
  tint: '#3a3428',
};

const LEVEL_12: LevelDef = {
  id: 12,
  chapterName: '第三章 · 门与钥',
  levelName: '双钥',
  intro: '两把钥匙，两扇锁。开哪扇门，就是选哪条路。',
  oil: 13,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L12',
  theme: 'bronze',
  tint: '#3a3428',
};

const LEVEL_13: LevelDef = {
  id: 13,
  chapterName: '第三章 · 门与钥',
  levelName: '长廊的门',
  intro: '长廊尽头的门，是回家最近的路。',
  oil: 14,
  dangerCost: 2,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L13',
  theme: 'bronze',
  tint: '#3a3428',
};

const LEVEL_14: LevelDef = {
  id: 14,
  chapterName: '第三章 · 门与钥',
  levelName: '深井之钥',
  intro: '钥匙在深井底。碎地与门，是它的守卫。',
  oil: 11,
  dangerCost: 2,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L14',
  theme: 'bronze',
  tint: '#3a3428',
};

const LEVEL_15: LevelDef = {
  id: 15,
  chapterName: '第三章 · 门与钥',
  levelName: '门与钥之心',
  intro: '取钥、开锁、穿过碎地，直达终点。',
  oil: 23,
  dangerCost: 2,
  treasureOil: 3,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L15',
  theme: 'bronze',
  tint: '#3a3428',
};

const LEVEL_16: LevelDef = {
  id: 16,
  chapterName: '第四章 · 坠落',
  levelName: '断崖',
  intro: '断崖只能跳下去，爬不回来。跳之前，想清楚。',
  oil: 10,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  tutorial: true,
  grid: [],
  gridFile: 'L16',
  theme: 'cave',
  tint: '#2a221c',
};

const LEVEL_17: LevelDef = {
  id: 17,
  chapterName: '第四章 · 坠落',
  levelName: '认赔',
  intro: '两个落点，两种命运。跳下去之前，看清脚下。',
  oil: 11,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L17',
  theme: 'cave',
  tint: '#2a221c',
};

const LEVEL_18: LevelDef = {
  id: 18,
  chapterName: '第四章 · 坠落',
  levelName: '竖井',
  intro: '表面是碎地，井底是残烛。深与浅，痛与甜。',
  oil: 13,
  dangerCost: 2,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L18',
  theme: 'cave',
  tint: '#2a221c',
};

const LEVEL_19: LevelDef = {
  id: 19,
  chapterName: '第四章 · 坠落',
  levelName: '深浅',
  intro: '一边深，一边浅。深处的烛，要用疼来换。',
  oil: 14,
  dangerCost: 2,
  treasureOil: 3,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L19',
  theme: 'cave',
  tint: '#2a221c',
};

const LEVEL_20: LevelDef = {
  id: 20,
  chapterName: '第四章 · 坠落',
  levelName: '坠落之心',
  intro: '门锁着，钥匙在井底。跳下去，才有路。',
  oil: 15,
  dangerCost: 2,
  treasureOil: 3,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L20',
  theme: 'cave',
  tint: '#2a221c',
};

const LEVEL_21: LevelDef = {
  id: 21,
  chapterName: '第五章 · 回声',
  levelName: '初闻回声',
  intro: '空格键发出声呐——花 2 滴灯油，听见 4 格内的黑暗。',
  oil: 10,
  treasureOil: 3,
  pulseCost: 2,
  pulseRadius: 4,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  tutorial: true,
  grid: [],
  gridFile: 'L21',
  theme: 'ice',
  tint: '#2a4a6a',
};

const LEVEL_22: LevelDef = {
  id: 22,
  chapterName: '第五章 · 回声',
  levelName: '盲域',
  intro: '三条路，两条埋着碎地。听，再走。',
  oil: 16,
  pulseCost: 2,
  pulseRadius: 4,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L22',
  theme: 'ice',
  tint: '#2a4a6a',
};

const LEVEL_23: LevelDef = {
  id: 23,
  chapterName: '第五章 · 回声',
  levelName: '寻钥',
  intro: '六个竖井，一把钥匙。别用脚去猜——用回声。',
  oil: 19,
  treasureOil: 3,
  pulseCost: 2,
  pulseRadius: 4,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L23',
  theme: 'ice',
  tint: '#2a4a6a',
};

const LEVEL_24: LevelDef = {
  id: 24,
  chapterName: '第五章 · 回声',
  levelName: '先见',
  intro: '两个落点，一生一死。跳下去之前，先听。',
  oil: 12,
  treasureOil: 3,
  pulseCost: 2,
  pulseRadius: 4,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L24',
  theme: 'ice',
  tint: '#2a4a6a',
};

const LEVEL_25: LevelDef = {
  id: 25,
  chapterName: '第五章 · 回声',
  levelName: '回声之心',
  intro: '回声会告诉你钥匙在哪。剩下的路，用脚。',
  oil: 19,
  treasureOil: 3,
  pulseCost: 2,
  pulseRadius: 4,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L25',
  theme: 'ice',
  tint: '#2a4a6a',
};

const LEVEL_26: LevelDef = {
  id: 26,
  chapterName: '第六章 · 幽火',
  levelName: '幽火初现',
  intro: '那团冷火在追你。你动，它才动——撞上会烧掉灯油。',
  oil: 16,
  treasureOil: 3,
  ghostCost: 4,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  tutorial: true,
  grid: [],
  gridFile: 'L26',
  theme: 'swamp',
  tint: '#2a4a3a',
};

const LEVEL_27: LevelDef = {
  id: 27,
  chapterName: '第六章 · 幽火',
  levelName: '亡命长廊',
  intro: '火在身后。别停。',
  oil: 15,
  treasureOil: 3,
  ghostCost: 4,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L27',
  theme: 'swamp',
  tint: '#2a4a3a',
};

const LEVEL_28: LevelDef = {
  id: 28,
  chapterName: '第六章 · 幽火',
  levelName: '双火',
  intro: '两团火。让它们撞在一起，你就赢了半步。',
  oil: 16,
  treasureOil: 3,
  ghostCost: 4,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L28',
  theme: 'swamp',
  tint: '#2a4a3a',
};

const LEVEL_29: LevelDef = {
  id: 29,
  chapterName: '第六章 · 幽火',
  levelName: '崖与火',
  intro: '幽火不越断崖。声呐能把它震成虚影。',
  oil: 16,
  treasureOil: 3,
  ghostCost: 4,
  pulseCost: 2,
  pulseRadius: 4,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L29',
  theme: 'swamp',
  tint: '#2a4a3a',
};

const LEVEL_30: LevelDef = {
  id: 30,
  chapterName: '第六章 · 幽火',
  levelName: '幽火之心',
  intro: '钥匙在火守的深袋里。震住它，进出要快。',
  oil: 20,
  treasureOil: 3,
  ghostCost: 4,
  pulseCost: 2,
  pulseRadius: 4,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L30',
  theme: 'swamp',
  tint: '#2a4a3a',
};

const LEVEL_31: LevelDef = {
  id: 31,
  chapterName: '第七章 · 诅咒',
  levelName: '诅咒之烛',
  intro: '紫色的烛回油更多——但每捡一盏，世界就暗一圈。',
  oil: 8,
  treasureOil: 3,
  curseOil: 6,
  curseVisionPenalty: 1,
  lowOilThreshold: 3,
  visionRadius: 3,
  lowOilVision: 1,
  tutorial: true,
  grid: [],
  gridFile: 'L31',
  theme: 'cursed',
  tint: '#3a2a5a',
};

const LEVEL_32: LevelDef = {
  id: 32,
  chapterName: '第七章 · 诅咒',
  levelName: '你需要它',
  intro: '这一关，你迟早需要那盏紫烛。',
  oil: 12,
  treasureOil: 3,
  curseOil: 6,
  curseVisionPenalty: 1,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L32',
  theme: 'cursed',
  tint: '#3a2a5a',
};

const LEVEL_33: LevelDef = {
  id: 33,
  chapterName: '第七章 · 诅咒',
  levelName: '贪婪',
  intro: '三盏紫烛。全拿走，或者只拿一盏——或者，一盏都别碰。',
  oil: 13,
  treasureOil: 3,
  curseOil: 6,
  curseVisionPenalty: 1,
  lowOilThreshold: 4,
  visionRadius: 3,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L33',
  theme: 'cursed',
  tint: '#3a2a5a',
};

const LEVEL_34: LevelDef = {
  id: 34,
  chapterName: '第七章 · 诅咒',
  levelName: '暗里听声',
  intro: '吃了紫烛，就用耳朵看路。',
  oil: 14,
  treasureOil: 3,
  curseOil: 6,
  curseVisionPenalty: 1,
  pulseCost: 2,
  pulseRadius: 4,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L34',
  theme: 'cursed',
  tint: '#3a2a5a',
};

const LEVEL_35: LevelDef = {
  id: 35,
  chapterName: '第七章 · 诅咒',
  levelName: '诅咒之心',
  intro: '紫焰、冷火、铁锁。各取所需，各付其价。',
  oil: 15,
  treasureOil: 3,
  ghostCost: 4,
  curseOil: 6,
  curseVisionPenalty: 1,
  pulseCost: 2,
  pulseRadius: 4,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L35',
  theme: 'cursed',
  tint: '#3a2a5a',
};

const LEVEL_36: LevelDef = {
  id: 36,
  chapterName: '第八章 · 双灯',
  levelName: '双灯芯',
  intro: 'Q 键换芯：白芯看得远、烧得凶；暗芯摸黑走、省着用。',
  oil: 14,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  tutorial: true,
  dualLamp: true,
  grid: [],
  gridFile: 'L36',
  theme: 'mono',
  tint: '#3a3d42',
};

const LEVEL_37: LevelDef = {
  id: 37,
  chapterName: '第八章 · 双灯',
  levelName: '长夜',
  intro: '油刚好够走到出口。多看一眼，就少走一步。',
  oil: 18,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  dualLamp: true,
  grid: [],
  gridFile: 'L37',
  theme: 'mono',
  tint: '#3a3d42',
};

const LEVEL_38: LevelDef = {
  id: 38,
  chapterName: '第八章 · 双灯',
  levelName: '灯下黑',
  intro: '先亮眼看全，再摸黑捡烛。',
  oil: 16,
  treasureOil: 3,
  curseOil: 6,
  curseVisionPenalty: 1,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  dualLamp: true,
  grid: [],
  gridFile: 'L38',
  theme: 'mono',
  tint: '#3a3d42',
};

const LEVEL_39: LevelDef = {
  id: 39,
  chapterName: '第八章 · 双灯',
  levelName: '灯与火',
  intro: '暗芯看得见火，看不见路。白芯反过来。',
  oil: 18,
  treasureOil: 3,
  ghostCost: 4,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  dualLamp: true,
  grid: [],
  gridFile: 'L39',
  theme: 'mono',
  tint: '#3a3d42',
};

const LEVEL_40: LevelDef = {
  id: 40,
  chapterName: '第八章 · 双灯',
  levelName: '双灯之心',
  intro: '这一关油管够。够不够，取决于你怎么烧。',
  oil: 22,
  treasureOil: 3,
  curseOil: 6,
  curseVisionPenalty: 1,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  dualLamp: true,
  grid: [],
  gridFile: 'L40',
  theme: 'mono',
  tint: '#3a3d42',
};

const LEVEL_41: LevelDef = {
  id: 41,
  chapterName: '第九章 · 遗忘',
  levelName: '初次遗忘',
  intro: '石碑会吃掉你走过的记忆。眼前的光还在——背后的路，已经黑了。',
  oil: 14,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  tutorial: true,
  grid: [],
  gridFile: 'L41',
  theme: 'relic',
  tint: '#4a4030',
};

const LEVEL_42: LevelDef = {
  id: 42,
  chapterName: '第九章 · 遗忘',
  levelName: '回头是黑',
  intro: '看过的路会消失。用脑子记，别用眼睛。',
  oil: 15,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L42',
  theme: 'relic',
  tint: '#4a4030',
};

const LEVEL_43: LevelDef = {
  id: 43,
  chapterName: '第九章 · 遗忘',
  levelName: '记忆走廊',
  intro: '五盏烛，一把钥，全在遗忘里。你的地图，只剩你的脑子。',
  oil: 16,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L43',
  theme: 'relic',
  tint: '#4a4030',
};

const LEVEL_44: LevelDef = {
  id: 44,
  chapterName: '第九章 · 遗忘',
  levelName: '灯与忆',
  intro: '碎地看过就忘。回声和白芯，一个买情报，一个买光。',
  oil: 18,
  dangerCost: 2,
  pulseCost: 2,
  pulseRadius: 4,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  dualLamp: true,
  grid: [],
  gridFile: 'L44',
  theme: 'relic',
  tint: '#4a4030',
};

const LEVEL_45: LevelDef = {
  id: 45,
  chapterName: '第九章 · 遗忘',
  levelName: '遗忘之心',
  intro: '四座石碑吃掉了地图。剩下的路，都在你心里。',
  oil: 22,
  dangerCost: 2,
  treasureOil: 3,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L45',
  theme: 'relic',
  tint: '#4a4030',
};

const LEVEL_46: LevelDef = {
  id: 46,
  chapterName: '第十章 · 归途',
  levelName: '归途启程',
  intro: '往回走。来时的路，一样要付账。',
  oil: 18,
  dangerCost: 2,
  treasureOil: 3,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L46',
  theme: 'abyss',
  tint: '#4a2620',
};

const LEVEL_47: LevelDef = {
  id: 47,
  chapterName: '第十章 · 归途',
  levelName: '万象回廊',
  intro: '这一路学过的一切，都在这条回廊里。',
  oil: 20,
  treasureOil: 3,
  ghostCost: 4,
  curseOil: 6,
  curseVisionPenalty: 1,
  pulseCost: 2,
  pulseRadius: 4,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L47',
  theme: 'abyss',
  tint: '#4a2620',
};

const LEVEL_48: LevelDef = {
  id: 48,
  chapterName: '第十章 · 归途',
  levelName: '深渊集市',
  intro: '深渊也在做买卖。三盏紫烛，各有所值。',
  oil: 20,
  treasureOil: 3,
  curseOil: 6,
  curseVisionPenalty: 1,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L48',
  theme: 'abyss',
  tint: '#4a2620',
};

const LEVEL_49: LevelDef = {
  id: 49,
  chapterName: '第十章 · 归途',
  levelName: '归途风暴',
  intro: '没有回声，没有退路。只剩你和这片黑暗。',
  oil: 22,
  dangerCost: 2,
  treasureOil: 3,
  ghostCost: 4,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L49',
  theme: 'abyss',
  tint: '#4a2620',
};

const LEVEL_50: LevelDef = {
  id: 50,
  chapterName: '第十章 · 归途',
  levelName: '灯下行者',
  intro: '第一阶段最后一程。带着所有光回来。',
  oil: 30,
  dangerCost: 2,
  treasureOil: 3,
  ghostCost: 4,
  curseOil: 6,
  curseVisionPenalty: 1,
  pulseCost: 2,
  pulseRadius: 4,
  lowOilThreshold: 6,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L50',
  theme: 'abyss',
  tint: '#4a2620',
};

/** 当前已实现的关卡序列（每章一个美术主题；异关机制保留代码未启用） */
export const LEVELS: LevelDef[] = [
  LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5,
  LEVEL_6, LEVEL_7, LEVEL_8, LEVEL_9, LEVEL_10,
  LEVEL_11, LEVEL_12, LEVEL_13, LEVEL_14, LEVEL_15,
  LEVEL_16, LEVEL_17, LEVEL_18, LEVEL_19, LEVEL_20,
  LEVEL_21, LEVEL_22, LEVEL_23, LEVEL_24, LEVEL_25,
  LEVEL_26, LEVEL_27, LEVEL_28, LEVEL_29, LEVEL_30,
  LEVEL_31, LEVEL_32, LEVEL_33, LEVEL_34, LEVEL_35,
  LEVEL_36, LEVEL_37, LEVEL_38, LEVEL_39, LEVEL_40,
  LEVEL_41, LEVEL_42, LEVEL_43, LEVEL_44, LEVEL_45,
  LEVEL_46, LEVEL_47, LEVEL_48, LEVEL_49, LEVEL_50,
];
