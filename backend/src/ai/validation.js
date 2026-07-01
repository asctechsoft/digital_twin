'use strict';
/**
 * Kiểm định độ trung thực (fidelity) của Digital Twin.
 *
 * Chạy N chu kỳ, mỗi chu kỳ so sánh:
 *   • Mật độ do MÔ HÌNH twin dự báo  (kỳ vọng nhu cầu theo giờ, không nhiễu)
 *   • Mật độ "thực tế" từ sensor giả lập (có nhiễu Gaussian + biến động)
 * rồi tính RMSE / MAE tổng và theo từng hướng.
 *
 * Đây chính là Task "Báo cáo validation — chạy 1000 chu kỳ, tính RMSE".
 */
const config    = require('../config');
const generator = require('../simulator/generator');
const db        = require('../db/timeseries');

const DIRS = ['NS', 'EW', 'NE', 'SW'];
const round = (x, d = 4) => parseFloat(x.toFixed(d));

// Mô hình kỳ vọng của twin (noise-free): base × hệ số giờ
function expectedDensity(dir, hour) {
  const base = config.DIRECTION_BASES[dir] || 0.3;
  const mult = generator.getHourMult(hour);
  return Math.max(0, Math.min(1, base * mult));
}

function runValidation(cycles = 1000) {
  cycles = Math.max(1, Math.min(100000, Math.floor(cycles) || 1000));

  // Kiểm định ở điều kiện bình thường → tạm gỡ sự cố đang bật (nếu có), rồi khôi phục
  const savedIncident    = generator.incident;
  const savedIncidentDir = generator.incidentDir;
  generator.clearIncident();

  const per = {};
  DIRS.forEach(d => { per[d] = { se: 0, ae: 0, n: 0 }; });
  let se = 0, ae = 0, n = 0;

  for (let i = 0; i < cycles; i++) {
    const hour   = i % 24;                    // quét đều toàn bộ 24 giờ
    const actual = generator.generate(hour);  // "thực tế" (có nhiễu)
    for (const d of DIRS) {
      const err = expectedDensity(d, hour) - actual[d];
      const e2  = err * err;
      per[d].se += e2; per[d].ae += Math.abs(err); per[d].n++;
      se += e2;        ae += Math.abs(err);        n++;
    }
  }

  if (savedIncident) generator.setIncident(savedIncident, savedIncidentDir);

  const rmse = Math.sqrt(se / n);
  const mae  = ae / n;
  const perDirection = {};
  DIRS.forEach(d => {
    perDirection[d] = {
      rmse: round(Math.sqrt(per[d].se / per[d].n)),
      mae:  round(per[d].ae / per[d].n),
    };
  });

  const result = {
    ts: Date.now(),
    cycles,
    samples: n,
    rmse: round(rmse),
    mae:  round(mae),
    accuracyPct: round((1 - rmse) * 100, 1), // độ khớp xấp xỉ (%)
    perDirection,
    note: 'RMSE giữa mật độ mô hình twin dự báo và mật độ sensor thực tế (giả lập) trên toàn 24h.',
  };

  // Lưu lại tóm tắt để chấm báo cáo / vẽ biểu đồ về sau
  try {
    db.write('validation', { loc: 'hk01' },
      { rmse: result.rmse, mae: result.mae, cycles: result.cycles, accuracy: result.accuracyPct });
  } catch (_) { /* db chưa init → bỏ qua */ }

  return result;
}

module.exports = { runValidation, expectedDensity };
