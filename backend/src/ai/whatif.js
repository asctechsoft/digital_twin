'use strict';
const config = require('../config');

const DIRS = ['NS', 'EW', 'NE', 'SW'];
const W = config.OBJECTIVE_WEIGHTS;

const round = (x, d = 4) => parseFloat(x.toFixed(d));
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// ── Chi phí ùn tắc:  J_cong = Σ wᵢ·dᵢ² ───────────────────────────────────────
// Bình phương để phạt nặng hướng nào quá đông; wᵢ ưu tiên hướng chính.
function congestionCost(densities) {
  return DIRS.reduce((s, d) => s + (W[d] || 1) * densities[d] * densities[d], 0);
}

// ── Chi phí thay đổi đèn:  J_chg = λ·Σ (Δuⱼ / scale)² ─────────────────────────
// Phạt việc đổi thời lượng đèn quá mạnh so với hiện tại (tránh giật cục, sốc giao thông).
function changePenalty(candidate, currentSignal) {
  const dns = (candidate.ns - currentSignal.nsGreen) / config.DELTA_U_SCALE;
  const dew = (candidate.ew - currentSignal.ewGreen) / config.DELTA_U_SCALE;
  return config.LAMBDA * (dns * dns + dew * dew);
}

// ── Mô hình dự báo 1 bước (deterministic) ────────────────────────────────────
// Dự báo mật độ tiếp theo nếu áp cấu hình đèn {ns, ew}. Hướng nào được chia
// nhiều thời gian xanh hơn thì mật độ giảm nhiều hơn (xe thoát nhanh hơn).
function predictNextState(densities, signalCfg) {
  const total = signalCfg.ns + signalCfg.ew || 1;
  const nsShare = signalCfg.ns / total;   // tỉ lệ xanh dành cho trục NS
  const ewShare = signalCfg.ew / total;   // tỉ lệ xanh dành cho trục EW
  return {
    NS: round(clamp01(densities.NS * (1 - 0.30 * nsShare))),
    EW: round(clamp01(densities.EW * (1 - 0.30 * ewShare))),
    NE: round(clamp01(densities.NE * (1 - 0.15 * nsShare))),
    SW: round(clamp01(densities.SW * (1 - 0.15 * ewShare))),
  };
}

// ── What-if: thử toàn bộ ứng viên, xếp hạng theo J = J_cong + J_chg ──────────
function runWhatIf(densities, signal) {
  const currentCong = congestionCost(densities);

  const candidates = config.AI_CANDIDATES.map((c, idx) => {
    const simD  = predictNextState(densities, c);
    const jCong = congestionCost(simD);
    const jChg  = changePenalty(c, signal);
    const J     = jCong + jChg;
    return {
      id: idx + 1,
      nsGreen: c.ns,
      ewGreen: c.ew,
      J:           round(J),
      jCongestion: round(jCong),
      jChange:     round(jChg),
      simDensity:  simD,
    };
  });

  // Xếp theo tổng J (đã gồm cả phạt thay đổi) — nhỏ nhất = tốt nhất
  candidates.sort((a, b) => a.J - b.J);

  const best = candidates[0];
  // % cải thiện tính trên chi phí ùn tắc (dễ hiểu cho người dùng)
  const improvement = currentCong > 0
    ? round((currentCong - best.jCongestion) / currentCong * 100, 1)
    : 0;

  return {
    ts: Date.now(),
    weights: W,
    lambda: config.LAMBDA,
    current: { nsGreen: signal.nsGreen, ewGreen: signal.ewGreen, J: round(currentCong) },
    best: { ...best },
    candidates,
    improvement,
    shouldApply: improvement > 5, // chỉ khuyến nghị nếu cải thiện > 5%
  };
}

module.exports = { runWhatIf, congestionCost, changePenalty, predictNextState };
