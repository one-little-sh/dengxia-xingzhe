// 探索场景：渲染格子世界、迷雾、灯光与玩家，驱动回合制移动。
// 架构约束：本场景只读 GameState 并播放动画，所有规则判定都在 GameState 里。
import Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { Tile, Dir, type LevelDef, type MoveEvent } from '../core/types';
import { buildTextures, themeTextures } from '../render/textures';
import { sfx } from '../audio/sfx';
import { LEVELS } from '../core/levels';
import type { Overlay } from '../ui/overlay';

const TILE = 48;        // 渲染尺寸（纹理 16px × 3 倍放大）
const MOVE_MS = 130;    // 单步移动动画时长
const STEP_INTERVAL = 175; // 按住方向连续走的步进间隔
const FOG_MEMORY = 0.62;  // 已探索但不在视野内的迷雾浓度
const FOG_EXIT_HINT = 0.9; // 未探索时出口格迷雾浓度（隐约透光，作引导）

export class ExploreScene extends Phaser.Scene {
  private state!: GameState;
  private overlay!: Overlay;
  private player!: Phaser.GameObjects.Image;
  private playerLight!: Phaser.GameObjects.Image;
  private playerBeard: Phaser.GameObjects.Image | null = null; // 胡须层（着装）
  private playerHat: Phaser.GameObjects.Image | null = null;   // 斗笠层（着装）
  private fog: Phaser.GameObjects.Rectangle[][] = [];
  private chests = new Map<string, Phaser.GameObjects.Image>();
  private doors = new Map<string, Phaser.GameObjects.Image>();
  private keyItems = new Map<string, Phaser.GameObjects.Image>();
  private lockDoors = new Map<string, Phaser.GameObjects.Image>();
  private curseItems = new Map<string, Phaser.GameObjects.Image>();
  private gateItems = new Map<string, Phaser.GameObjects.Image>();
  private coinItems = new Map<string, Phaser.GameObjects.Image>();
  /** 幽火渲染实体（与 GameState.ghosts 顺序一致） */
  private ghostViews: {
    body: Phaser.GameObjects.Image;
    light: Phaser.GameObjects.Image;
  }[] = [];
  private isMoving = false;
  private heldDir: Dir | null = null;
  private nextMoveAt = 0;
  private introShown = true;
  private tutorialLabels: {
    col: number; row: number;
    text: Phaser.GameObjects.Text;
  }[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private qKey!: Phaser.Input.Keyboard.Key;
  private eKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('explore');
  }

  create(): void {
    this.state = new GameState(this.registry.get('level') as LevelDef);
    this.overlay = this.registry.get('overlay') as Overlay;
    this.fog = [];
    this.chests.clear();
    this.doors.clear();
    this.keyItems.clear();
    this.lockDoors.clear();
    this.curseItems.clear();
    this.gateItems.clear();
    this.coinItems.clear();
    this.ghostViews = [];
    this.isMoving = false;
    this.heldDir = null;
    this.nextMoveAt = 0;
    this.introShown = true;

    buildTextures(this);
    this.renderMap();
    this.renderFog();
    this.renderPlayer();
    this.renderGhosts();
    this.setupTutorialLabels();
    this.setupTint();

    this.cursors = this.input.keyboard!.createCursorKeys();
    // 对象形式 addKeys：返回 { up, down, left, right } 键对象
    this.wasd = this.input.keyboard!.addKeys({
      up: 'W', down: 'S', left: 'A', right: 'D',
    }) as unknown as Record<
      'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
    this.spaceKey = this.input.keyboard!.addKey('SPACE');
    this.qKey = this.input.keyboard!.addKey('Q');
    this.eKey = this.input.keyboard!.addKey('E');

    const lv = this.state.level;
    const lvIndex = LEVELS.findIndex(l => l.id === lv.id);
    this.overlay.setLevelName(`${lv.chapterName} · ${lv.levelName}（${lvIndex + 1}/${LEVELS.length}）`);
    this.overlay.updateOil(this.state.getSnapshot());
    this.overlay.updateKeys(this.state.getSnapshot());
    this.overlay.updateCoins(this.state.getSnapshot(), this.bagCoins(), this.bagRelics());
    // 声呐脉冲：第五章起按关卡配置启用
    const pulseOn = lv.pulseCost !== undefined;
    this.overlay.setPulseEnabled(pulseOn);
    if (pulseOn) {
      this.overlay.setPulseHandler(() => { this.triggerPulse(); });
      this.overlay.updatePulseButton(this.state.getSnapshot(), lv.pulseCost ?? 2);
    } else {
      this.overlay.setPulseHandler(null);
    }
    // 双灯芯：第八章起按关卡配置启用（暗芯起步）
    this.overlay.setLampEnabled(lv.dualLamp ?? false);
    if (lv.dualLamp) {
      this.overlay.setLampHandler(() => { this.triggerLampSwitch(); });
      this.overlay.updateLamp(this.state.getSnapshot());
      // 暗芯起步：光晕收缩
      this.playerLight.setDisplaySize(TILE * 3.2, TILE * 3.2).setAlpha(0.55).setTint(0xd0b080);
      this.updateFog(0);
    }
    this.overlay.toast(lv.intro, 0);

    // 篝火/出口的氛围光脉动
    this.tweens.add({
      targets: this.children.list.filter(o => o.getData('flicker')),
      alpha: { from: 0.8, to: 1 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
  }

  /** 外部（虚拟方向键/脉冲按钮）按住某方向 */
  setHeldDir(dir: Dir | null): void {
    this.heldDir = dir;
  }

  /** 切换灯芯：光晕尺寸/色调补间 + 迷雾即时重刷 */
  private doSwitchLamp(): void {
    const ev = this.state.switchLamp();
    if (!ev) return;
    sfx.lampSwitch();
    const bright = this.state.getSnapshot().lampMode === 'bright';
    // 光晕：白芯大而亮，暗芯小而弱
    this.tweens.add({
      targets: this.playerLight,
      displayWidth: bright ? TILE * 7 : TILE * 3.2,
      displayHeight: bright ? TILE * 7 : TILE * 3.2,
      alpha: bright ? 1 : 0.55,
      duration: 320,
      ease: 'Sine.easeInOut',
    });
    this.playerLight.setTint(bright ? 0xfff2d0 : 0xd0b080);
    this.updateFog(280);
    const snap = this.state.getSnapshot();
    this.overlay.updateLamp(snap);
    if (ev.text) this.overlay.toast(ev.text, 2400);
  }

  /** 外部（屏幕按钮）触发灯芯切换 */
  triggerLampSwitch(): void {
    if (this.state.getSnapshot().phase !== 'playing') return;
    this.doSwitchLamp();
  }

  /** 外部（屏幕按钮）触发声呐脉冲；返回是否成功（供按钮状态刷新） */
  triggerPulse(): boolean {
    if (this.state.getSnapshot().phase !== 'playing' || this.isMoving) return false;
    const { result, events } = this.state.pulse();
    if (!result.ok) {
      this.overlay.toast('灯油不够支付这一次回声了。', 2000);
      return false;
    }
    this.overlay.hideToast();
    sfx.pulse();
    this.playPulseAnimation(result.radius);
    this.updateFog(300);
    this.syncGhosts();
    const snap = this.state.getSnapshot();
    this.overlay.updateOil(snap);
    if (this.state.level.pulseCost !== undefined) {
      this.overlay.updatePulseButton(snap, result.cost);
    }
    for (const ev of events) {
      if (ev.type === 'lose') {
        this.time.delayedCall(420, () => this.overlay.showLose());
      }
    }
    return true;
  }

  /** 脉冲扩散光环动画：从玩家中心扩至半径边缘 */
  private playPulseAnimation(radius: number): void {
    const snap = this.state.getSnapshot();
    const cx = snap.playerCol * TILE + TILE / 2;
    const cy = snap.playerRow * TILE + TILE / 2;
    const ring = this.add.circle(cx, cy, 8, 0x8fd6ff, 0.5).setDepth(80).setStrokeStyle(2, 0xbfe9ff, 0.9);
    this.tweens.add({
      targets: ring,
      radius: (radius + 0.5) * TILE,
      alpha: { from: 0.9, to: 0 },
      duration: 520,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });
    this.cameras.main.flash(90, 40, 70, 90);
  }

  update(time: number): void {
    const snap = this.state.getSnapshot();
    if (snap.phase !== 'playing') return;

    // 空格：声呐脉冲（单次触发，不连发）
    const spaceJust = Phaser.Input.Keyboard.JustDown(this.spaceKey);
    if (spaceJust) {
      this.triggerPulse();
      return;
    }

    // Q：切换灯芯（双灯芯关卡）
    if (this.state.level.dualLamp && Phaser.Input.Keyboard.JustDown(this.qKey)) {
      this.doSwitchLamp();
      return;
    }

    // E：退出到居所（本关作废，已入库奖励保留）
    if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
      const cb = this.registry.get('onExitToHub') as (() => void) | undefined;
      if (cb) {
        cb();
        return;
      }
    }

    let dir = this.heldDir;
    if (!dir) {
      if (this.cursors.left.isDown || this.wasd.left.isDown) dir = Dir.Left;
      else if (this.cursors.right.isDown || this.wasd.right.isDown) dir = Dir.Right;
      else if (this.cursors.up.isDown || this.wasd.up.isDown) dir = Dir.Up;
      else if (this.cursors.down.isDown || this.wasd.down.isDown) dir = Dir.Down;
    }
    if (dir && !this.isMoving && time >= this.nextMoveAt) {
      this.doMove(dir);
      this.nextMoveAt = time + STEP_INTERVAL;
    }
  }

  // ---------- 渲染 ----------

  private renderMap(): void {
    const { tiles, rows, cols } = this.state;
    const tex = themeTextures(this.state.level.theme);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = tiles[r][c];
        const x = c * TILE + TILE / 2;
        const y = r * TILE + TILE / 2;

        // 地板打底（物件格先铺地板）
        if (t !== Tile.Wall) {
          this.add.image(x, y, tex.floor).setDisplaySize(TILE, TILE).setDepth(0);
        }

        switch (t) {
          case Tile.Wall:
            this.add.image(x, y, tex.wall).setDisplaySize(TILE, TILE).setDepth(0);
            break;
          case Tile.Bonfire:
            this.addBonfire(x, y);
            break;
          case Tile.Exit: {
            this.add.image(x, y, 'tx-exit').setDisplaySize(TILE, TILE).setDepth(1);
            this.addLight(x, y, 2.4, 0.55).setData('flicker', true).setDepth(4);
            break;
          }
          case Tile.Treasure: {
            const chest = this.add.image(x, y, 'tx-chest').setDisplaySize(TILE, TILE).setDepth(1);
            this.chests.set(`${c},${r}`, chest);
            break;
          }
          case Tile.Door: {
            const door = this.add.image(x, y, 'tx-door').setDisplaySize(TILE, TILE).setDepth(1);
            this.doors.set(`${c},${r}`, door);
            break;
          }
          case Tile.Danger: {
            this.add.image(x, y, 'tx-hazard').setDisplaySize(TILE, TILE).setDepth(1);
            break;
          }
          case Tile.Key: {
            const keyImg = this.add.image(x, y, 'tx-key').setDisplaySize(TILE, TILE).setDepth(1);
            this.keyItems.set(`${c},${r}`, keyImg);
            break;
          }
          case Tile.Locked: {
            const lock = this.add.image(x, y, 'tx-locked').setDisplaySize(TILE, TILE).setDepth(1);
            this.lockDoors.set(`${c},${r}`, lock);
            break;
          }
          case Tile.Ledge: {
            this.add.image(x, y, 'tx-ledge').setDisplaySize(TILE, TILE).setDepth(1);
            break;
          }
          case Tile.Ghost: {
            // 出生点铺地板，实体由 renderGhosts 统一管理
            break;
          }
          case Tile.Curse: {
            const curse = this.add.image(x, y, 'tx-curse').setDisplaySize(TILE, TILE).setDepth(1);
            this.curseItems.set(`${c},${r}`, curse);
            this.add.image(x, y, 'tx-curse-light')
              .setDisplaySize(TILE * 2.2, TILE * 2.2)
              .setAlpha(0.5)
              .setBlendMode(Phaser.BlendModes.ADD)
              .setDepth(4);
            break;
          }
          case Tile.Obelisk: {
            this.add.image(x, y, 'tx-obelisk').setDisplaySize(TILE, TILE).setDepth(1);
            this.add.image(x, y, 'tx-obelisk-light')
              .setDisplaySize(TILE * 2.4, TILE * 2.4)
              .setAlpha(0.6)
              .setBlendMode(Phaser.BlendModes.ADD)
              .setDepth(4);
            break;
          }
          case Tile.Gate: {
            const gate = this.add.image(x, y, 'tx-gate').setDisplaySize(TILE, TILE).setDepth(1);
            this.gateItems.set(`${c},${r}`, gate);
            break;
          }
          case Tile.Coin: {
            const coin = this.add.image(x, y, 'tx-coin').setDisplaySize(TILE, TILE).setDepth(1);
            this.coinItems.set(`${c},${r}`, coin);
            break;
          }
          case Tile.Warp: {
            // 回程门：幽绿符文圈 + 微光 + 慢旋转
            const warp = this.add.image(x, y, 'tx-warp').setDisplaySize(TILE, TILE).setDepth(1);
            this.add.image(x, y, 'tx-warp')
              .setDisplaySize(TILE * 1.4, TILE * 1.4)
              .setAlpha(0.25)
              .setBlendMode(Phaser.BlendModes.ADD)
              .setDepth(4);
            this.tweens.add({
              targets: warp,
              angle: 360,
              duration: 6000,
              repeat: -1,
            });
            break;
          }
          default:
            break;
        }
      }
    }
  }

  private addBonfire(x: number, y: number): void {
    const img = this.add.image(x, y, 'tx-bonfire-0').setDisplaySize(TILE, TILE).setDepth(1);
    // 两帧火焰切换
    this.time.addEvent({
      delay: 320,
      loop: true,
      callback: () => {
        img.setTexture(img.texture.key === 'tx-bonfire-0' ? 'tx-bonfire-1' : 'tx-bonfire-0');
      },
    });
    this.addLight(x, y, 2.6, 0.7).setData('flicker', true).setDepth(4);
  }

  /** 暖光晕 */
  private addLight(x: number, y: number, scale: number, alpha: number): Phaser.GameObjects.Image {
    return this.add.image(x, y, 'tx-light')
      .setDisplaySize(TILE * scale, TILE * scale)
      .setAlpha(alpha)
      .setBlendMode(Phaser.BlendModes.ADD);
  }

  private renderFog(): void {
    const { rows, cols } = this.state;
    for (let r = 0; r < rows; r++) {
      this.fog[r] = [];
      for (let c = 0; c < cols; c++) {
        this.fog[r][c] = this.add.rectangle(
          c * TILE + TILE / 2, r * TILE + TILE / 2, TILE, TILE, 0x05070b)
          .setDepth(50);
      }
    }
    this.updateFog(0);
  }

  /** 迷雾按探索状态刷新（首次调用立即生效，之后平滑过渡） */
  private updateFog(duration = 220): void {
    const { rows, cols, tiles } = this.state;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let alpha: number;
        if (this.state.inVision(c, r)) alpha = 0;
        else if (this.state.isExplored(c, r)) alpha = FOG_MEMORY;
        else alpha = 1;
        // 出口微光：未探索时也隐约可见，作为黑暗中的引导
        if (tiles[r][c] === Tile.Exit && alpha > FOG_EXIT_HINT) alpha = FOG_EXIT_HINT;
        const rect = this.fog[r][c];
        if (duration <= 0) rect.setAlpha(alpha);
        else this.tweens.add({ targets: rect, alpha, duration });
      }
    }
    this.revealTutorialLabels();
    this.syncItemVisibility();
  }

  /** 异关氛围色罩：低透明全屏叠加（迷雾之上） */
  private setupTint(): void {
    const t = this.state.level.tint;
    if (!t) return;
    const color = parseInt(t.replace('#', ''), 16);
    if (Number.isNaN(color)) return;
    this.add.rectangle(
      this.scale.width / 2, this.scale.height / 2,
      this.scale.width, this.scale.height,
      color, 0.12,
    ).setDepth(90);
  }

  /** 异关·盲物之厅：物件仅在视野内可见（记忆态隐形），随迷雾刷新同步 */
  private syncItemVisibility(): void {
    if (!this.state.level.hiddenItems) return;
    const apply = (map: Map<string, Phaser.GameObjects.Image>) => {
      for (const [k, img] of map) {
        const [c, r] = k.split(',').map(Number);
        img.setVisible(this.state.inVision(c, r));
      }
    };
    apply(this.chests);
    apply(this.keyItems);
    apply(this.lockDoors);
    apply(this.doors);
    apply(this.curseItems);
    apply(this.gateItems);
  }

  /** 教学关：为特殊物件创建旁注标签（初始隐藏，被灯火照见时淡入） */
  private setupTutorialLabels(): void {
    this.tutorialLabels = [];
    if (!this.state.level.tutorial) return;

    // 残烛是否回油由关卡决定，标签文案随之变化
    const texts: Partial<Record<Tile, string>> = {
      [Tile.Bonfire]: '篝火 · 走近回满灯油',
      [Tile.Treasure]: this.state.level.treasureOil
        ? '残烛 · 踏上拾取，回复灯油'
        : '遗物 · 踏上拾取',
      [Tile.Door]: '门 · 踏上回到篝火',
      [Tile.Exit]: '出口 · 踏上即通过',
      [Tile.Danger]: this.state.level.dualLamp
        ? '碎地 · 踏上多耗灯油（Q 键换灯芯）'
        : '碎地 · 踏上多耗灯油',
      [Tile.Key]: '钥匙 · 用来打开锁门',
      [Tile.Locked]: '锁门 · 没有钥匙打不开',
      [Tile.Ledge]: '断崖 · 只能向下跳，回不了头',
      [Tile.Coin]: '灯币 · 岔路上的工钱',
      [Tile.Warp]: '回程门 · 通向另一处',
      [Tile.Ghost]: '幽火 · 会追你，撞上烧灯油',
      [Tile.Curse]: '诅咒残烛 · 回油多，但视野变暗',
      [Tile.Obelisk]: '遗忘图腾 · 走过的记忆会重新变黑',
    };
    const { tiles, rows, cols } = this.state;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const label = texts[tiles[r][c]];
        if (!label) continue;
        // 靠上边缘的物件标签放下方，避免出画布
        const below = r <= 1;
        const text = this.add.text(
          c * TILE + TILE / 2,
          below ? (r + 1) * TILE + 3 : r * TILE - 3,
          label,
          {
            fontFamily: '"Noto Serif SC", "Microsoft YaHei", sans-serif',
            fontSize: '13px',
            color: '#e8dcc0',
            backgroundColor: 'rgba(8,10,16,0.85)',
            padding: { x: 8, y: 4 },
          },
        )
          .setOrigin(0.5, below ? 0 : 1)
          .setAlpha(0)
          .setDepth(60);
        this.tutorialLabels.push({ col: c, row: r, text });
      }
    }
  }

  /** 教学标签：玩家恰好站在物件格上时显示，离开即隐藏（拾取类沿用 fadeout 永久隐藏） */
  private revealTutorialLabels(): void {
    const snap = this.state.getSnapshot();
    for (const item of this.tutorialLabels) {
      const onIt = item.col === snap.playerCol && item.row === snap.playerRow;
      if (onIt && item.text.alpha < 1) {
        // 站上：淡入（已在淡出途中的直接拉回）
        this.tweens.killTweensOf(item.text);
        item.text.setAlpha(1);
      } else if (!onIt && item.text.alpha > 0) {
        // 离开：淡出
        this.tweens.killTweensOf(item.text);
        this.tweens.add({
          targets: item.text,
          alpha: 0,
          duration: 300,
        });
      }
    }
  }

  /** 物件已失去教学意义（拾取/开门）时淡出其标签 */
  private fadeoutTutorialLabel(col: number, row: number): void {
    const item = this.tutorialLabels.find(l => l.col === col && l.row === row);
    if (item) {
      this.tweens.add({ targets: item.text, alpha: 0, duration: 400 });
    }
  }

  /** 行囊累计灯币（含本关暂存） */
  private bagCoins(): number {
    const meta = this.registry.get('meta') as { coins: number; pendingCoins: number } | undefined;
    if (!meta) return 0;
    return meta.coins + (meta.pendingCoins ?? 0);
  }

  /** 行囊累计遗物数（含本关暂存） */
  private bagRelics(): number {
    const meta = this.registry.get('meta') as { relics: unknown[]; pendingRelic: unknown } | undefined;
    if (!meta) return 0;
    return meta.relics.length + (meta.pendingRelic ? 1 : 0);
  }

  /** 着装跟随层（tween 目标集合） */
  private outfitLayers(): Phaser.GameObjects.Image[] {
    return [this.player, this.playerLight,
      ...(this.playerBeard ? [this.playerBeard] : []),
      ...(this.playerHat ? [this.playerHat] : [])];
  }

  private renderPlayer(): void {
    const { playerCol, playerRow } = this.state.getSnapshot();
    const x = playerCol * TILE + TILE / 2;
    const y = playerRow * TILE + TILE / 2;
    this.playerLight = this.addLight(x, y, 5.2, 0.9).setDepth(2);
    this.player = this.add.image(x, y, 'tx-player').setDisplaySize(TILE, TILE).setDepth(3);
    this.applyOutfit(x, y);
  }

  /** 居所着装：按 meta 购买记录叠加胡须/斗笠层与染色的 cloak（随玩家移动需跟随 tween） */
  private applyOutfit(x: number, y: number): void {
    const meta = this.registry.get('meta') as { purchased: Record<string, boolean> } | undefined;
    const bought = (id: string) => meta?.purchased?.[id] === true;

    // 斗篷：青染
    if (bought('cloak')) this.player.setTint(0x7fc8d8);
    // 灯笼：纸灯暖光
    if (bought('lantern')) this.playerLight.setTint(0xfff2d0);
    // 胡须（未剃须时显示）
    if (!bought('shave1')) {
      this.playerBeard = this.add.image(x, y, 'tx-beard').setDisplaySize(TILE, TILE).setDepth(4);
    }
    // 斗笠
    if (bought('hat')) {
      this.playerHat = this.add.image(x, y, 'tx-hat').setDisplaySize(TILE, TILE).setDepth(4);
    }
  }

  /** 幽火实体：自发光（迷雾之上 depth 60）、两帧摇曳、悬浮起伏 */
  private renderGhosts(): void {
    const ghosts = this.state.getSnapshot().ghosts;
    ghosts.forEach(g => {
      const x = g.col * TILE + TILE / 2;
      const y = g.row * TILE + TILE / 2;
      const light = this.add.image(x, y, 'tx-ghost-light')
        .setDisplaySize(TILE * 2.6, TILE * 2.6)
        .setAlpha(0.55)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(58);
      const body = this.add.image(x, y, 'tx-ghost-0')
        .setDisplaySize(TILE, TILE)
        .setDepth(60); // 迷雾(50)之上：永远可见
      // 两帧摇曳
      this.time.addEvent({
        delay: 360,
        loop: true,
        callback: () => {
          body.setTexture(body.texture.key === 'tx-ghost-0' ? 'tx-ghost-1' : 'tx-ghost-0');
        },
      });
      // 悬浮起伏
      this.tweens.add({
        targets: [body, light],
        y: y - 3,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.ghostViews.push({ body, light });
    });
  }

  /** 幽火状态同步：位置补间 + 眩晕半透明 */
  private syncGhosts(): void {
    const ghosts = this.state.getSnapshot().ghosts;
    ghosts.forEach((g, i) => {
      const view = this.ghostViews[i];
      if (!view) return;
      const x = g.col * TILE + TILE / 2;
      const y = g.row * TILE + TILE / 2;
      // 停掉悬浮 tween 的 y 干扰：直接 kill 后重设
      this.tweens.killTweensOf(view.body);
      this.tweens.killTweensOf(view.light);
      view.body.setPosition(x, y);
      view.light.setPosition(x, y);
      const alpha = g.stunned > 0 ? 0.35 : 1;
      view.body.setAlpha(alpha);
      view.light.setAlpha(g.stunned > 0 ? 0.15 : 0.55);
      // 恢复悬浮
      this.tweens.add({
        targets: [view.body, view.light],
        y: y - 3,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  // ---------- 移动与事件 ----------

  private doMove(dir: Dir): void {
    if (this.isMoving) return;
    const result = this.state.move(dir);

    if (!result.moved) {
      // 撞墙/断崖阻挡：轻微顿挫反馈；带文案时提示原因（断崖规则）
      this.bump(dir);
      // 撞锁门是独立的更沉闷响；普通撞墙/断崖是顿音
      if (result.events.some(e => e.type === 'locked')) sfx.locked();
      else sfx.bump();
      const blockEv = result.events.find(e => e.type === 'blocked' && e.text);
      if (blockEv?.text) this.overlay.toast(blockEv.text, 2200);
      return;
    }

    // 脚步声（移动成功）
    sfx.step();

    if (this.introShown) {
      this.introShown = false;
      this.overlay.hideToast(); // 关闭开场常驻提示
    }

    this.isMoving = true;
    const stepTo = result.stepTo!;
    const tx = stepTo.col * TILE + TILE / 2;
    const ty = stepTo.row * TILE + TILE / 2;

    this.tweens.add({
      targets: this.outfitLayers(),
      x: tx,
      y: ty,
      duration: MOVE_MS,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.isMoving = false;
        this.handleEvents(result.events);
        this.syncGhosts();
        const snap = this.state.getSnapshot();
        this.overlay.updateOil(snap);
        this.overlay.updateKeys(snap);
        this.overlay.updateCoins(snap, this.bagCoins(), this.bagRelics());
        if (this.state.level.pulseCost !== undefined) {
          this.overlay.updatePulseButton(snap, this.state.level.pulseCost ?? 2);
        }
      },
    });
    this.updateFog();
  }

  /** 撞墙的视觉反馈 */
  private bump(dir: Dir): void {
    const off: Record<Dir, { x: number; y: number }> = {
      [Dir.Up]: { x: 0, y: -5 },
      [Dir.Down]: { x: 0, y: 5 },
      [Dir.Left]: { x: -5, y: 0 },
      [Dir.Right]: { x: 5, y: 0 },
    };
    const o = off[dir];
    this.tweens.add({
      targets: this.player,
      x: this.player.x + o.x,
      y: this.player.y + o.y,
      duration: 55,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
  }

  private handleEvents(events: MoveEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'treasure': {
          // 宝箱变暗表示已拾取
          sfx.treasure();
          if (ev.pos) {
            const chest = this.chests.get(`${ev.pos.col},${ev.pos.row}`);
            if (chest) {
              chest.setAlpha(0.35).setTint(0x777777);
              this.tweens.add({
                targets: chest,
                scale: { from: 1.15, to: 1 },
                duration: 180,
              });
            }
            this.fadeoutTutorialLabel(ev.pos.col, ev.pos.row);
          }
          if (ev.text) this.overlay.toast(ev.text);
          // 遗物入库回调（main 注入；残烛+3 油由 GameState 处理）
          (this.registry.get('onRelic') as (() => void) | undefined)?.();
          this.overlay.updateCoins(this.state.getSnapshot(), this.bagCoins(), this.bagRelics());
          break;
        }
        case 'shortcut': {
          // 换成开启贴图，再传送回篝火
          if (ev.pos) {
            this.doors.get(`${ev.pos.col},${ev.pos.row}`)?.setTexture('tx-door-open');
            this.fadeoutTutorialLabel(ev.pos.col, ev.pos.row);
          }
          if (ev.teleport) {
            this.teleportTo(ev.teleport.col, ev.teleport.row, ev.text ?? '');
          }
          break;
        }
        case 'danger': {
          // 震屏 + 玩家泛红闪烁；文案只在首次（GameState 控制）
          sfx.danger();
          this.cameras.main.shake(160, 0.006);
          this.player.setTint(0xff6644);
          this.time.delayedCall(260, () => this.player.clearTint());
          if (ev.text) this.overlay.toast(ev.text, 2000);
          break;
        }
        case 'key': {
          // 钥匙拾取：物件淡出
          sfx.key();
          if (ev.pos) {
            const item = this.keyItems.get(`${ev.pos.col},${ev.pos.row}`);
            if (item) {
              this.tweens.add({
                targets: item,
                alpha: 0,
                scale: { from: 1.15, to: 1 },
                duration: 260,
              });
            }
            this.fadeoutTutorialLabel(ev.pos.col, ev.pos.row);
          }
          if (ev.text) this.overlay.toast(ev.text);
          break;
        }
        case 'unlock': {
          sfx.unlock();
          if (ev.pos) {
            const lock = this.lockDoors.get(`${ev.pos.col},${ev.pos.row}`);
            if (lock) {
              lock.setTexture('tx-locked-open');
              this.tweens.add({
                targets: lock,
                scale: { from: 1.08, to: 1 },
                duration: 220,
              });
            }
            this.fadeoutTutorialLabel(ev.pos.col, ev.pos.row);
          }
          if (ev.text) this.overlay.toast(ev.text, 3200);
          break;
        }
        case 'locked': {
          // 无钥撞锁：锁门抖动 + 提示
          if (ev.pos) {
            const lock = this.lockDoors.get(`${ev.pos.col},${ev.pos.row}`);
            if (lock) {
              this.tweens.add({
                targets: lock,
                x: { from: lock.x - 3, to: lock.x },
                duration: 90,
                yoyo: true,
                repeat: 2,
              });
            }
          }
          if (ev.text) this.overlay.toast(ev.text, 2400);
          break;
        }
        case 'caught': {
          // 抓捕：震屏 + 冷色闪光 + 玩家泛青
          sfx.caught();
          this.cameras.main.shake(280, 0.01);
          this.cameras.main.flash(160, 40, 120, 140);
          this.player.setTint(0x7fd4e0);
          this.time.delayedCall(500, () => this.player.clearTint());
          if (ev.text) this.overlay.toast(ev.text, 3000);
          break;
        }
        case 'ghostNear':
          sfx.ghostNear();
          if (ev.text) this.overlay.toast(ev.text, 1800);
          break;
        case 'forget':
          // 首次遗忘：青色微闪提示（迷雾渐暗由 updateFog 自然呈现）
          sfx.forget();
          this.cameras.main.flash(140, 30, 80, 80);
          if (ev.text) this.overlay.toast(ev.text, 3000);
          break;
        case 'gateClose': {
          // 抉择门封死：其余门碎裂成墙，脚下的门透光开启
          sfx.gateClose();
          if (ev.closed) {
            for (const p of ev.closed) {
              const g = this.gateItems.get(`${p.col},${p.row}`);
              if (g) {
                g.setTexture('tx-wall');
                this.tweens.add({
                  targets: g,
                  alpha: { from: 0.3, to: 1 },
                  duration: 350,
                });
              }
            }
          }
          if (ev.pos) {
            const g = this.gateItems.get(`${ev.pos.col},${ev.pos.row}`);
            if (g) g.setTexture('tx-door-open');
          }
          this.cameras.main.shake(220, 0.006);
          this.cameras.main.flash(140, 90, 70, 30);
          if (ev.text) this.overlay.toast(ev.text, 3200);
          break;
        }
        case 'curse': {
          // 诅咒烛拾取：紫闪 + 物件淡出 + 视野收缩的迷雾重刷
          sfx.curse();
          if (ev.pos) {
            const item = this.curseItems.get(`${ev.pos.col},${ev.pos.row}`);
            if (item) {
              this.tweens.add({
                targets: item,
                alpha: 0,
                scale: { from: 1.2, to: 1 },
                duration: 300,
              });
            }
            this.fadeoutTutorialLabel(ev.pos.col, ev.pos.row);
          }
          this.cameras.main.flash(200, 80, 30, 110);
          if (ev.text) this.overlay.toast(ev.text, 3200);
          break;
        }
        case 'coin': {
          // 灯币拾取：金币上飘淡出；入账回调由 main 注入
          sfx.coin();
          if (ev.pos) {
            const coin = this.coinItems.get(`${ev.pos.col},${ev.pos.row}`);
            if (coin) {
              this.tweens.add({
                targets: coin,
                y: coin.y - TILE * 0.6,
                alpha: 0,
                duration: 420,
                ease: 'Sine.easeOut',
                onComplete: () => coin.destroy(),
              });
            }
          }
          (this.registry.get('onCoin') as ((n: number) => void) | undefined)?.(1);
          this.overlay.updateCoins(this.state.getSnapshot(), this.bagCoins(), this.bagRelics());
          if (ev.text) this.overlay.toast(ev.text, 1500);
          break;
        }
        case 'warp': {
          // 回程门传送：符文圈亮起，复用传送动画
          sfx.teleport();
          if (ev.teleport) {
            this.teleportTo(ev.teleport.col, ev.teleport.row, ev.text ?? '');
          }
          break;
        }
        case 'refill':
          sfx.refill();
          if (ev.text) this.overlay.toast(ev.text);
          break;
        case 'lowOil':
          sfx.lowOil();
          if (ev.text) this.overlay.toast(ev.text);
          break;
        case 'lose':
          sfx.lose();
          this.time.delayedCall(420, () => this.overlay.showLose());
          break;
        case 'win': {
          sfx.win();
          const lv = this.state.level;
          const lvIndex = LEVELS.findIndex(l => l.id === lv.id);
          const hasNext = lvIndex < LEVELS.length - 1;
          const isFinal = lvIndex === LEVELS.length - 1;
          this.time.delayedCall(420, () =>
            this.overlay.showWin(this.state.getSnapshot(), lv, hasNext, isFinal));
          break;
        }
        default:
          break;
      }
    }
  }

  /** 捷径门传送：淡出 → 置位 → 淡入 */
  private teleportTo(col: number, row: number, text: string): void {
    this.isMoving = true;
    sfx.teleport();
    const x = col * TILE + TILE / 2;
    const y = row * TILE + TILE / 2;
    const layers = this.outfitLayers();
    this.tweens.add({
      targets: layers,
      alpha: 0,
      duration: 110,
      onComplete: () => {
        for (const l of layers) l.setPosition(x, y);
        this.updateFog(0);
        this.overlay.updateOil(this.state.getSnapshot());
        this.tweens.add({
          targets: layers,
          alpha: 1,
          duration: 160,
          onComplete: () => { this.isMoving = false; },
        });
      },
    });
    if (text) this.overlay.toast(text, 3600);
  }
}
