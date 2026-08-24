// 音效模块：Web Audio API 程序化合成（零音频资源，与程序化美术哲学一致）。
// 纯逻辑模块不依赖 Phaser；首次用户手势（居所出发）时 unlock AudioContext。
// 静音开关持久化 localStorage（dengxia-sfx，'1'=开）。

const SFX_KEY = 'dengxia-sfx';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

/** 读取静音状态（默认开声） */
export function isMuted(): boolean {
  return muted;
}

/** 从 localStorage 恢复静音偏好（main 启动时调一次） */
export function restoreMutePref(): void {
  try {
    muted = localStorage.getItem(SFX_KEY) === '0';
  } catch {
    muted = false;
  }
}

/** 切换静音（HUD 按钮） */
export function toggleMute(): boolean {
  muted = !muted;
  try {
    localStorage.setItem(SFX_KEY, muted ? '0' : '1');
  } catch {
    // 忽略
  }
  return muted;
}

/** 用户手势解锁（浏览器自动播放策略）：居所出发/选关点击时调用 */
export function unlock(): void {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

/** 主音量随静音开关即时生效 */
function applyMute(): void {
  if (master && ctx) {
    master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.01);
  }
}

// ---------- 合成原语 ----------

interface ToneOpts {
  freq: number;          // 起始频率
  endFreq?: number;      // 结束频率（滑音）
  type?: OscillatorType; // 波形
  dur?: number;          // 时长（秒）
  gain?: number;         // 相对音量 0~1
  delay?: number;        // 延迟（秒，用于琶音/组合）
}

/** 单音：振荡器 + 起音/衰减包络 */
function tone(o: ToneOpts): void {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + (o.delay ?? 0);
  const dur = o.dur ?? 0.12;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.endFreq), t0 + dur);
  }
  // ADSR 简化版：快起音 + 指数衰减
  const peak = o.gain ?? 0.2;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

interface NoiseOpts {
  dur?: number;
  gain?: number;
  delay?: number;
  lowpass?: number;      // 低通截止（碎裂感 vs 嗡鸣）
  highpass?: number;     // 高通截止
}

/** 噪声 burst：碎地/火焰/风声 */
function noise(o: NoiseOpts): void {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + (o.delay ?? 0);
  const dur = o.dur ?? 0.1;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  const peak = o.gain ?? 0.15;
  g.gain.setValueAtTime(peak, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node: AudioNode = src;
  if (o.lowpass) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = o.lowpass;
    node.connect(lp);
    node = lp;
  }
  if (o.highpass) {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = o.highpass;
    node.connect(hp);
    node = hp;
  }
  node.connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

// ---------- 事件音效（挂接点对应 ExploreScene 各动作） ----------

export const sfx = {
  /** 脚步：低频短 tick，随机变调防机械感 */
  step(): void {
    tone({
      freq: 110 + Math.random() * 30,
      type: 'triangle',
      dur: 0.06,
      gain: 0.07,
    });
    noise({ dur: 0.03, gain: 0.03, highpass: 2000 });
  },

  /** 撞墙/阻挡：闷响顿音 */
  bump(): void {
    tone({ freq: 90, endFreq: 60, type: 'square', dur: 0.08, gain: 0.1 });
  },

  /** 撞锁门：更沉的金属闷响 */
  locked(): void {
    tone({ freq: 140, endFreq: 90, type: 'square', dur: 0.1, gain: 0.12 });
    tone({ freq: 70, dur: 0.12, gain: 0.1, delay: 0.02 });
  },

  /** 灯币：金属「叮」双音上滑 */
  coin(): void {
    tone({ freq: 1200, endFreq: 1800, type: 'sine', dur: 0.09, gain: 0.14 });
    tone({ freq: 2400, type: 'sine', dur: 0.07, gain: 0.08, delay: 0.05 });
  },

  /** 残烛/遗物：柔和三音琶音（暖） */
  treasure(): void {
    tone({ freq: 523, type: 'sine', dur: 0.1, gain: 0.12 });
    tone({ freq: 659, type: 'sine', dur: 0.1, gain: 0.12, delay: 0.07 });
    tone({ freq: 784, type: 'sine', dur: 0.16, gain: 0.12, delay: 0.14 });
  },

  /** 钥匙：金属轻响（短方波） */
  key(): void {
    tone({ freq: 1600, type: 'square', dur: 0.05, gain: 0.08 });
    tone({ freq: 2100, type: 'square', dur: 0.06, gain: 0.06, delay: 0.06 });
  },

  /** 开锁：两段「咔-哒」 */
  unlock(): void {
    tone({ freq: 900, type: 'square', dur: 0.04, gain: 0.1 });
    tone({ freq: 500, type: 'square', dur: 0.07, gain: 0.12, delay: 0.08 });
  },

  /** 捷径门传送：嗖（滑音）+ 落地叮 */
  teleport(): void {
    tone({ freq: 300, endFreq: 1400, type: 'sine', dur: 0.22, gain: 0.1 });
    tone({ freq: 880, type: 'sine', dur: 0.1, gain: 0.1, delay: 0.24 });
  },

  /** 碎地：噪声碎裂 + 重低音（配震屏） */
  danger(): void {
    noise({ dur: 0.18, gain: 0.2, lowpass: 3000 });
    tone({ freq: 70, endFreq: 45, type: 'triangle', dur: 0.2, gain: 0.22 });
  },

  /** 幽火抓捕：冷感低鸣降调 + 重震（配红闪） */
  caught(): void {
    tone({ freq: 220, endFreq: 60, type: 'sawtooth', dur: 0.4, gain: 0.2 });
    noise({ dur: 0.25, gain: 0.15, lowpass: 900 });
  },

  /** 幽火贴身：极短气声提示 */
  ghostNear(): void {
    noise({ dur: 0.12, gain: 0.06, highpass: 4000 });
    tone({ freq: 1800, endFreq: 1400, type: 'sine', dur: 0.1, gain: 0.05 });
  },

  /** 声呐脉冲：扩散滑音（低→高渐弱，配光环） */
  pulse(): void {
    tone({ freq: 300, endFreq: 1600, type: 'sine', dur: 0.5, gain: 0.13 });
    tone({ freq: 450, endFreq: 2400, type: 'sine', dur: 0.5, gain: 0.06, delay: 0.04 });
  },

  /** 灯芯切换：拨片「啪嗒」 */
  lampSwitch(): void {
    tone({ freq: 700, type: 'square', dur: 0.03, gain: 0.1 });
    tone({ freq: 400, type: 'square', dur: 0.05, gain: 0.1, delay: 0.05 });
  },

  /** 遗忘触发：石碑低沉嗡鸣（配青闪） */
  forget(): void {
    tone({ freq: 130, endFreq: 90, type: 'triangle', dur: 0.6, gain: 0.12 });
    tone({ freq: 137, type: 'triangle', dur: 0.6, gain: 0.08, delay: 0.02 }); // 微差拍频
  },

  /** 抉择门封死：石门轰（配震屏金闪） */
  gateClose(): void {
    tone({ freq: 60, endFreq: 35, type: 'triangle', dur: 0.45, gain: 0.25 });
    noise({ dur: 0.35, gain: 0.18, lowpass: 600 });
  },

  /** 诅咒烛：不和谐微降调（紫焰的「不对劲」） */
  curse(): void {
    tone({ freq: 700, endFreq: 620, type: 'sine', dur: 0.3, gain: 0.12 });
    tone({ freq: 740, endFreq: 655, type: 'sine', dur: 0.3, gain: 0.08, delay: 0.03 });
  },

  /** 篝火回满：温暖上行琶音 */
  refill(): void {
    tone({ freq: 392, type: 'sine', dur: 0.1, gain: 0.12 });
    tone({ freq: 494, type: 'sine', dur: 0.1, gain: 0.12, delay: 0.06 });
    tone({ freq: 587, type: 'sine', dur: 0.1, gain: 0.12, delay: 0.12 });
    tone({ freq: 784, type: 'sine', dur: 0.2, gain: 0.12, delay: 0.18 });
  },

  /** 低油警告：灯芯抖动的弱颤音 */
  lowOil(): void {
    tone({ freq: 620, endFreq: 580, type: 'sine', dur: 0.14, gain: 0.09 });
    tone({ freq: 620, endFreq: 580, type: 'sine', dur: 0.14, gain: 0.09, delay: 0.16 });
  },

  /** 胜利：克制的小调上行三音（魂味不热闹） */
  win(): void {
    tone({ freq: 440, type: 'sine', dur: 0.14, gain: 0.14 });
    tone({ freq: 523, type: 'sine', dur: 0.14, gain: 0.14, delay: 0.12 });
    tone({ freq: 659, type: 'sine', dur: 0.3, gain: 0.15, delay: 0.24 });
  },

  /** 失败：下行两音渐熄 */
  lose(): void {
    tone({ freq: 330, type: 'sine', dur: 0.25, gain: 0.14 });
    tone({ freq: 220, endFreq: 110, type: 'sine', dur: 0.7, gain: 0.14, delay: 0.28 });
  },

  /** 拾遗物入库（居所当铺卖出的「叮」也复用 coin） */
  relic(): void {
    tone({ freq: 880, type: 'sine', dur: 0.1, gain: 0.1 });
    tone({ freq: 1175, type: 'sine', dur: 0.14, gain: 0.1, delay: 0.08 });
  },
};

/** HUD 静音按钮点击后调用（同步主音量） */
export function onMuteChanged(): void {
  applyMute();
}
