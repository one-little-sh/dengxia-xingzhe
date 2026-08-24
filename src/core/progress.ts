// 进度持久化：localStorage 记录已解锁的关卡数（1 = 仅第一关）。
// 纯逻辑模块，不依赖 Phaser；隐私模式等异常场景静默降级。

const KEY = 'dengxia-progress-v1';

/** 读取已解锁关卡数，自动夹到 [1, total] */
export function loadUnlocked(total: number): number {
  try {
    const raw = Number(localStorage.getItem(KEY));
    const v = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
    return Math.min(v, total);
  } catch {
    return 1;
  }
}

/** 保存已解锁关卡数（只增不减由调用方保证） */
export function saveUnlocked(count: number): void {
  try {
    localStorage.setItem(KEY, String(count));
  } catch {
    // 忽略：写入失败不影响游玩（本局进度仍在内存中）
  }
}
