// DOM overlay UI：灯油条、消息 toast、胜利/失败面板。
// 中文排版走 DOM 而非 Canvas 文本，渲染质量与可维护性更好。
import type { GameSnapshot, LevelDef } from '../core/types';
import type { LevelStats } from '../core/meta';

/** 面板按钮动作：重试本关 / 进入下一关 / 回居所 */
export type PanelAction = 'retry' | 'next' | 'hub';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) =>
  document.querySelector(sel) as T;

export class Overlay {
  private toastTimer: number | null = null;
  private action: PanelAction = 'retry';
  /** 自由选关开关回调（main 注入：切换并重绘面板） */
  onFreeSelectToggle: ((on: boolean) => void) | null = null;

  constructor(onAction: (action: PanelAction) => void) {
    $('#panel-btn').addEventListener('click', () => {
      this.hidePanel();
      onAction(this.action);
    });
    $('#panel-retry-btn').addEventListener('click', () => {
      this.hidePanel();
      onAction('retry');
    });
    $('#panel-hub-btn').addEventListener('click', () => {
      this.hidePanel();
      onAction('hub');
    });
    $('#level-close').addEventListener('click', () => this.hideLevelSelect());
    $('#pulse-btn').addEventListener('click', () => {
      const cb = this.onPulse;
      if (cb) cb();
    });
    $('#lamp-btn').addEventListener('click', () => {
      const cb = this.onLamp;
      if (cb) cb();
    });
  }

  /** 声呐脉冲回调（由 main.ts 注入场景调用） */
  private onPulse: (() => void) | null = null;
  private pulseEnabled = false;

  setPulseHandler(handler: (() => void) | null): void {
    this.onPulse = handler;
  }

  /** 脉冲按钮显隐：本关配置了脉冲机制才显示 */
  setPulseEnabled(enabled: boolean): void {
    this.pulseEnabled = enabled;
    $('#pulse-btn').style.display = enabled ? '' : 'none';
  }

  /** 刷新脉冲按钮可用态（油不足置灰）与文案 */
  updatePulseButton(snap: GameSnapshot, cost: number): void {
    if (!this.pulseEnabled) return;
    const btn = $('#pulse-btn') as HTMLButtonElement;
    btn.disabled = snap.oil < cost;
    btn.textContent = `回声（-${cost} 油）`;
  }

  // ---------- 双灯芯（第八章） ----------

  private onLamp: (() => void) | null = null;
  private lampEnabled = false;

  setLampHandler(handler: (() => void) | null): void {
    this.onLamp = handler;
  }

  /** 灯芯按钮显隐：双灯芯关卡才显示 */
  setLampEnabled(enabled: boolean): void {
    this.lampEnabled = enabled;
    $('#lamp-btn').style.display = enabled ? '' : 'none';
  }

  /** 刷新灯芯按钮文案（当前模式 + 步耗） */
  updateLamp(snap: GameSnapshot): void {
    if (!this.lampEnabled) return;
    const btn = $('#lamp-btn') as HTMLButtonElement;
    if (snap.lampMode === 'bright') {
      btn.textContent = '🕯️ 白芯（2 油/步）';
      btn.classList.remove('dim');
    } else {
      btn.textContent = '· 暗芯（1 油/步）';
      btn.classList.add('dim');
    }
  }

  setLevelName(name: string): void {
    $('#level-name').textContent = name;
  }

  /** 刷新灯油条 */
  updateOil(snap: GameSnapshot): void {
    const fill = $('#oil-fill');
    const ratio = snap.maxOil > 0 ? snap.oil / snap.maxOil : 0;
    fill.style.width = `${Math.round(ratio * 100)}%`;
    fill.classList.toggle('low', snap.oil <= 6);
    $('#oil-num').textContent = String(snap.oil);
  }

  /** 刷新钥匙计数（本关无钥匙时隐藏） */
  updateKeys(snap: GameSnapshot): void {
    const wrap = $('#key-hud');
    if (snap.totalKeys <= 0) {
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = '';
    $('#key-num').textContent = `${snap.keys}`;
  }

  /** 刷新灯币 HUD：本关拾取进度（无灯币的关隐藏）；bagCoins 为居所行囊累计 */
  updateCoins(snap: GameSnapshot, bagCoins: number, bagRelics: number): void {
    const wrap = $('#coin-hud');
    if (snap.totalCoins <= 0) {
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = '';
    $('#coin-num').textContent = `${snap.coins}/${snap.totalCoins}`;
    $('#coin-total').textContent = `（行囊 ${bagCoins} 币 · 遗物 ${bagRelics} 件）`;
  }

  /** 消息 toast（自动消失；传 0 表示常驻直到下次调用） */
  toast(text: string, durationMs = 2600): void {
    const el = $('#toast');
    el.textContent = text;
    el.classList.add('show');
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    if (durationMs > 0) {
      this.toastTimer = window.setTimeout(() => el.classList.remove('show'), durationMs);
    }
  }

  /** 立即隐藏消息 toast */
  hideToast(): void {
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    $('#toast').classList.remove('show');
  }

  /** 胜利面板；hasNext=false 表示当前章节最后一关（章末收束文案）；
   *  isFinal=true 表示整个 LEVELS 的最后一关（阶段性总结文案） */
  showWin(snap: GameSnapshot, level: LevelDef, hasNext: boolean, isFinal = false): void {
    if (isFinal) {
      // 第一阶段终章：旅程未完待续
      this.action = 'retry';
      const miss = snap.totalTreasures - snap.treasures;
      const perfect = snap.totalTreasures > 0 && miss === 0;
      const verdict = snap.totalTreasures > 0
        ? (perfect
          ? '完美引灯 · 黑暗没有留住任何遗物'
          : `黑暗中还留着 ${miss} 件遗物`)
        : '';
      const ending = perfect
        ? '你带着所有的光回来了。\n引灯人的第一阶段，圆满。'
        : '你走完了来时的路。\n有些光，留在了身后的黑暗里。';
      this.setPanel(
        'win',
        '灯下行者 · 归',
        `${ending}\n${this.statLine(snap)}${verdict ? `\n${verdict}` : ''}\n前方的黑暗，还在延伸……`,
        '重走终章',
      );
      return;
    }
    if (hasNext) {
      this.action = 'next';
      this.setPanel('win', '灯火不灭', this.winText(snap, level), '下一关');
    } else {
      this.action = 'retry';
      const miss = snap.totalTreasures - snap.treasures;
      const verdict = snap.totalTreasures > 0
        ? (miss === 0
          ? '完美引灯 · 黑暗没有留住任何遗物'
          : `黑暗中还留着 ${miss} 件遗物`)
        : '';
      this.setPanel(
        'win',
        `${level.chapterName} · 完`,
        `你把这一章的黑暗都走完了。\n${this.statLine(snap)}${verdict ? `\n${verdict}` : ''}\n更多的深渊，正在路上。`,
        '重走此章',
      );
    }
  }

  showLose(): void {
    this.action = 'retry';
    this.setPanel('lose', '灯，熄了', '黑暗里没有脚步声。\n下一次，记得早点回头。', '重燃灯火');
  }

  hidePanel(): void {
    $('#panel').classList.remove('show');
  }

  /** 选关面板：按章节分组；序号用数组位置（异关 id 非连续）；
   *  currentIndex 为当前关卡在数组中的索引；
   *  自由选关开启时全部可选；未开启时仅解锁关可选（其余置灰禁用）；
   *  getStats 返回每关收集统计（图卷上显示 🪙/🕯 收集度，全收集金色） */
  showLevelSelect(
    levels: LevelDef[],
    unlocked: number,
    currentIndex: number,
    onSelect: (index: number) => void,
    getStats?: (levelId: number) => LevelStats | undefined,
    freeSelect = false,
  ): void {
    const grid = $('#level-grid');
    grid.innerHTML = '';

    // 自由选关开关按钮（面板顶部）
    const freeBtn = document.createElement('button');
    freeBtn.id = 'free-select-btn';
    freeBtn.className = freeSelect ? 'on' : '';
    freeBtn.textContent = freeSelect ? '🔓 自由选关：开' : '🔒 开启自由选关';
    freeBtn.addEventListener('click', () => {
      const cb = this.onFreeSelectToggle;
      if (cb) cb(!freeSelect);
    });
    grid.appendChild(freeBtn);
    let lastChapter = '';
    levels.forEach((lv, i) => {
      if (lv.chapterName !== lastChapter) {
        lastChapter = lv.chapterName;
        const head = document.createElement('div');
        head.className = 'chapter-head';
        head.textContent = lv.chapterName;
        grid.appendChild(head);
      }
      const notReached = i >= unlocked;
      const selectable = freeSelect || !notReached;
      const cell = document.createElement('button');
      cell.className = 'level-cell'
        + (notReached ? ' unreached' : '')
        + (i === currentIndex ? ' current' : '');
      cell.disabled = !selectable;
      const name = document.createElement('span');
      name.className = 'level-name';
      name.textContent = notReached
        ? `${i + 1} · ${lv.levelName}（未点亮）`
        : `${i + 1} · ${lv.levelName}`;
      cell.appendChild(name);

      // 收集度：灯币 + 遗物（全收集金色高亮）
      const stats = getStats?.(lv.id);
      if (stats && (stats.totalCoins > 0 || stats.totalRelics > 0)) {
        const parts: string[] = [];
        if (stats.totalCoins > 0) parts.push(`🪙 ${stats.coins}/${stats.totalCoins}`);
        if (stats.totalRelics > 0) parts.push(`🕯 ${stats.relics}/${stats.totalRelics}`);
        const full = stats.coins >= stats.totalCoins && stats.relics >= stats.totalRelics;
        const s = document.createElement('span');
        s.className = 'level-stats' + (full ? ' full' : '');
        s.textContent = parts.join(' · ');
        cell.appendChild(s);
      }

      cell.addEventListener('click', () => {
        this.hideLevelSelect();
        onSelect(i);
      });
      grid.appendChild(cell);
    });
    $('#level-panel').classList.add('show');
  }

  hideLevelSelect(): void {
    $('#level-panel').classList.remove('show');
  }

  private setPanel(
    kind: 'win' | 'lose',
    title: string,
    sub: string,
    btn: string,
    showRetryBtn = true,
  ): void {
    const t = $('#panel-title');
    t.textContent = title;
    t.className = kind;
    $('#panel-sub').textContent = sub;
    $('#panel-btn').textContent = btn;
    // 「重玩此关」独立按钮：胜利面板显示（主按钮可能是「下一关」）；
    // 失败面板隐藏（主按钮本身就是重试）
    ($('#panel-retry-btn') as HTMLButtonElement).style.display =
      kind === 'win' && showRetryBtn ? '' : 'none';
    $('#panel').classList.add('show');
  }

  private winText(snap: GameSnapshot, level: LevelDef): string {
    const lines = [`${level.levelName} · 通过`, this.statLine(snap)];
    if (snap.totalTreasures > 0) {
      if (snap.treasures === snap.totalTreasures) {
        lines.push('完美引灯 · 黑暗没有留住任何遗物');
      } else {
        lines.push(`黑暗中还留着 ${snap.totalTreasures - snap.treasures} 件遗物`);
      }
    }
    lines.push('下一段黑暗，在等你。');
    return lines.join('\n');
  }

  private statLine(snap: GameSnapshot): string {
    const parts = [`走了 ${snap.steps} 步 · 灯油剩 ${snap.oil}`];
    if (snap.totalTreasures > 0) {
      parts.push(`拾得遗物 ${snap.treasures}/${snap.totalTreasures}`);
    }
    return parts.join(' · ');
  }
}
