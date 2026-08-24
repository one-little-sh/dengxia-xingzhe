// 手工关卡数据（L1–L50）。
// 设计原则见 docs/level-design.md；每关一个教学点。
// 校验：npm run verify（BFS+Dijkstra，网格读 levels/*.txt，参数在本文件）。
// 网格外置：levels/<N>.txt（可视化编辑器维护）——txt 修改后 Vite HMR 热更新。
import { Tile, type LevelDef } from './types';

/** levels/ 目录的 txt 网格（文件名如 L3.txt）；启动时收集，新增 txt 需重启 dev */
const gridFiles = import.meta.glob('../../levels/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** 按文件名（不含扩展名）取外置网格；无则返回 null */
export function loadGridFile(name: string): string[] | null {
  const raw = gridFiles[`../../levels/${name}.txt`];
  if (!raw) return null;
  const lines = raw.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim().length > 0);
  return lines.length > 0 ? lines : null;
}

/** 解析关卡网格：gridFile 优先（外置 txt），否则内联 grid */
export function gridOf(level: LevelDef): string[] {
  if (level.gridFile) {
    const g = loadGridFile(level.gridFile);
    if (g) return g;
  }
  return level.grid;
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
  oil: 14,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  tutorial: true,
  grid: [],
  gridFile: 'L11',
};

const LEVEL_12: LevelDef = {
  id: 12,
  chapterName: '第三章 · 门与钥',
  levelName: '双钥',
  oil: 13,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L12',
};

const LEVEL_13: LevelDef = {
  id: 13,
  chapterName: '第三章 · 门与钥',
  levelName: '长廊的门',
  oil: 14,
  dangerCost: 2,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L13',
};

const LEVEL_14: LevelDef = {
  id: 14,
  chapterName: '第三章 · 门与钥',
  levelName: '深井之钥',
  oil: 11,
  dangerCost: 2,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L14',
};

const LEVEL_15: LevelDef = {
  id: 15,
  chapterName: '第三章 · 门与钥',
  levelName: '门与钥之心',
  oil: 23,
  dangerCost: 2,
  treasureOil: 3,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L15',
};

const LEVEL_16: LevelDef = {
  id: 16,
  chapterName: '第四章 · 坠落',
  levelName: '断崖',
  oil: 10,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  tutorial: true,
  grid: [],
  gridFile: 'L16',
};

const LEVEL_17: LevelDef = {
  id: 17,
  chapterName: '第四章 · 坠落',
  levelName: '认赔',
  oil: 11,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L17',
};

const LEVEL_18: LevelDef = {
  id: 18,
  chapterName: '第四章 · 坠落',
  levelName: '竖井',
  oil: 13,
  dangerCost: 2,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L18',
};

const LEVEL_19: LevelDef = {
  id: 19,
  chapterName: '第四章 · 坠落',
  levelName: '深浅',
  oil: 14,
  dangerCost: 2,
  treasureOil: 3,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L19',
};

const LEVEL_20: LevelDef = {
  id: 20,
  chapterName: '第四章 · 坠落',
  levelName: '坠落之心',
  oil: 15,
  dangerCost: 2,
  treasureOil: 3,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L20',
};

const LEVEL_21: LevelDef = {
  id: 21,
  chapterName: '第五章 · 回声',
  levelName: '初闻回声',
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
};

const LEVEL_22: LevelDef = {
  id: 22,
  chapterName: '第五章 · 回声',
  levelName: '盲域',
  oil: 16,
  pulseCost: 2,
  pulseRadius: 4,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L22',
};

const LEVEL_23: LevelDef = {
  id: 23,
  chapterName: '第五章 · 回声',
  levelName: '寻钥',
  oil: 19,
  treasureOil: 3,
  pulseCost: 2,
  pulseRadius: 4,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L23',
};

const LEVEL_24: LevelDef = {
  id: 24,
  chapterName: '第五章 · 回声',
  levelName: '先见',
  oil: 12,
  treasureOil: 3,
  pulseCost: 2,
  pulseRadius: 4,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L24',
};

const LEVEL_25: LevelDef = {
  id: 25,
  chapterName: '第五章 · 回声',
  levelName: '回声之心',
  oil: 19,
  treasureOil: 3,
  pulseCost: 2,
  pulseRadius: 4,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L25',
};

const LEVEL_26: LevelDef = {
  id: 26,
  chapterName: '第六章 · 幽火',
  levelName: '幽火初现',
  oil: 16,
  treasureOil: 3,
  ghostCost: 4,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  tutorial: true,
  grid: [],
  gridFile: 'L26',
};

const LEVEL_27: LevelDef = {
  id: 27,
  chapterName: '第六章 · 幽火',
  levelName: '亡命长廊',
  oil: 15,
  treasureOil: 3,
  ghostCost: 4,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L27',
};

const LEVEL_28: LevelDef = {
  id: 28,
  chapterName: '第六章 · 幽火',
  levelName: '双火',
  oil: 16,
  treasureOil: 3,
  ghostCost: 4,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L28',
};

const LEVEL_29: LevelDef = {
  id: 29,
  chapterName: '第六章 · 幽火',
  levelName: '崖与火',
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
};

const LEVEL_30: LevelDef = {
  id: 30,
  chapterName: '第六章 · 幽火',
  levelName: '幽火之心',
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
};

const LEVEL_31: LevelDef = {
  id: 31,
  chapterName: '第七章 · 诅咒',
  levelName: '诅咒之烛',
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
};

const LEVEL_32: LevelDef = {
  id: 32,
  chapterName: '第七章 · 诅咒',
  levelName: '你需要它',
  oil: 12,
  treasureOil: 3,
  curseOil: 6,
  curseVisionPenalty: 1,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L32',
};

const LEVEL_33: LevelDef = {
  id: 33,
  chapterName: '第七章 · 诅咒',
  levelName: '贪婪',
  oil: 13,
  treasureOil: 3,
  curseOil: 6,
  curseVisionPenalty: 1,
  lowOilThreshold: 4,
  visionRadius: 3,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L33',
};

const LEVEL_34: LevelDef = {
  id: 34,
  chapterName: '第七章 · 诅咒',
  levelName: '暗里听声',
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
};

const LEVEL_35: LevelDef = {
  id: 35,
  chapterName: '第七章 · 诅咒',
  levelName: '诅咒之心',
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
};

const LEVEL_36: LevelDef = {
  id: 36,
  chapterName: '第八章 · 双灯',
  levelName: '双灯芯',
  oil: 14,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  tutorial: true,
  dualLamp: true,
  grid: [],
  gridFile: 'L36',
};

const LEVEL_37: LevelDef = {
  id: 37,
  chapterName: '第八章 · 双灯',
  levelName: '长夜',
  oil: 18,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  dualLamp: true,
  grid: [],
  gridFile: 'L37',
};

const LEVEL_38: LevelDef = {
  id: 38,
  chapterName: '第八章 · 双灯',
  levelName: '灯下黑',
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
};

const LEVEL_39: LevelDef = {
  id: 39,
  chapterName: '第八章 · 双灯',
  levelName: '灯与火',
  oil: 18,
  treasureOil: 3,
  ghostCost: 4,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  dualLamp: true,
  grid: [],
  gridFile: 'L39',
};

const LEVEL_40: LevelDef = {
  id: 40,
  chapterName: '第八章 · 双灯',
  levelName: '双灯之心',
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
};

const LEVEL_41: LevelDef = {
  id: 41,
  chapterName: '第九章 · 遗忘',
  levelName: '初次遗忘',
  oil: 14,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  tutorial: true,
  grid: [],
  gridFile: 'L41',
};

const LEVEL_42: LevelDef = {
  id: 42,
  chapterName: '第九章 · 遗忘',
  levelName: '回头是黑',
  oil: 15,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L42',
};

const LEVEL_43: LevelDef = {
  id: 43,
  chapterName: '第九章 · 遗忘',
  levelName: '记忆走廊',
  oil: 16,
  treasureOil: 3,
  lowOilThreshold: 4,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L43',
};

const LEVEL_44: LevelDef = {
  id: 44,
  chapterName: '第九章 · 遗忘',
  levelName: '灯与忆',
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
};

const LEVEL_45: LevelDef = {
  id: 45,
  chapterName: '第九章 · 遗忘',
  levelName: '遗忘之心',
  oil: 22,
  dangerCost: 2,
  treasureOil: 3,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L45',
};

const LEVEL_46: LevelDef = {
  id: 46,
  chapterName: '第十章 · 归途',
  levelName: '归途启程',
  oil: 18,
  dangerCost: 2,
  treasureOil: 3,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L46',
};

const LEVEL_47: LevelDef = {
  id: 47,
  chapterName: '第十章 · 归途',
  levelName: '万象回廊',
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
};

const LEVEL_48: LevelDef = {
  id: 48,
  chapterName: '第十章 · 归途',
  levelName: '深渊集市',
  oil: 20,
  treasureOil: 3,
  curseOil: 6,
  curseVisionPenalty: 1,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L48',
};

const LEVEL_49: LevelDef = {
  id: 49,
  chapterName: '第十章 · 归途',
  levelName: '归途风暴',
  oil: 22,
  dangerCost: 2,
  treasureOil: 3,
  ghostCost: 4,
  lowOilThreshold: 5,
  visionRadius: 2,
  lowOilVision: 1,
  grid: [],
  gridFile: 'L49',
};

const LEVEL_50: LevelDef = {
  id: 50,
  chapterName: '第十章 · 归途',
  levelName: '灯下行者',
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
