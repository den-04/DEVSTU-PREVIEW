// Hạ mức giữ chỗ bộ nhớ WebAssembly của ONNX Runtime trên WebKit (17/11/2026 — báo lỗi #13, app Mac 1.0.44 mở 8 ảnh 4480 × 6720:
// "no available backend found. ERR: [wasm] RangeError: Out of memory" hàng giờ liền, lưu ảnh hỏng). README §23z265.
// ONNX Runtime xin WebAssembly.Memory DÙNG CHUNG với maximum 65536 trang (4 GB). WebKit (Safari, app Mac, iPhone, iPad) phải giữ chỗ trước đủ mức đó
// cho mỗi worker AI; app đang giữ nhiều ảnh, vài worker AI cùng sống thì không còn chỗ → mô hình không khởi động được. Chrome / Edge không giữ chỗ
// trước nên không gặp. Cách sửa như skin-ai-worker-v4 (04/11, README §23z190): xin mức thấp hơn, không được thì thấp nữa; mô hình chạy được với
// maximum nhỏ hơn mức khai báo vì nó chỉ dùng tới phần cần thật.
// Worker nạp file này TRƯỚC thư viện: `import './wasm-mem-cap-v1.js';` ở dòng đầu. Đổi nội dung thì đổi số phiên bản trong tên (lưu đệm một năm).
// Bộ thử (Chrome): ?mc=<số trang> trên đường dẫn worker → ép đúng mức đó (đo mô hình chạy được ở mức thấp nhất của thang); ?mc=0 → tắt.

const RealMemory = WebAssembly.Memory;
const UA = self.navigator?.userAgent || '';
const WEBKIT_ONLY = /AppleWebKit/.test(UA) && !/Chrome|Chromium|CriOS|Edg|FxiOS/.test(UA);
const Q = new URLSearchParams(self.location?.search || '');
const FORCE = Q.has('mc') ? Math.max(0, Number(Q.get('mc')) || 0) : null;
/**
 * Mức giữ chỗ từng worker, theo trang 64 KB: [mức xin trước, mức thấp nhất còn thử]. Đo 17/11 bằng test/e2e-wasm-cap.mjs (Chrome, CPU, cỡ đầu vào LỚN NHẤT app gửi,
 * bộ nhớ thật dùng tới): modnet 644 MB, depth ~970 MB, birefnet 2,3 GB, sam2 794 MB, lama 673 MB (ảnh 2048²), scunet v7 893 MB, giam-nhieu-nhe 195 MB,
 * skin-ai 205 MB, region-ai 432 MB (ô 768). Mức xin trước ≈ dùng tới × 1,4; mức thấp nhất vẫn trên số đo. Thấp hơn nữa thì mô hình hỏng giữa chừng (đo được) — không thử.
 * scunet v6 (ô 512, 16-bit) chạy CPU dùng tới 3,1 GB: không hạ (nó chỉ được chọn khi có WebGPU, lúc đó bộ nhớ WebAssembly nhỏ).
 */
const CAPS = {
  modnet: [16384, 12288], depth: [24576, 16384], birefnet: [49152, 40960], sam2: [20480, 16384], lama: [16384, 12288],
  scunet: [24576, 16384], 'giam-nhieu-nhe': [8192, 8192], 'skin-ai': [8192, 8192], 'region-ai': [12288, 8192],
};
/** Bậc thang giữa hai mức (trang). */
const STEPS = [49152, 40960, 32768, 24576, 20480, 16384, 12288, 8192];
const file = (/\/([a-z0-9-]+-worker-v\d+)\.js/.exec(self.location?.pathname || '') || [])[1] || '';
const name = file.replace(/-worker-v\d+$/, '');
const own = file === 'scunet-worker-v6' ? null : CAPS[name] ?? [16384, 8192];
const caps = FORCE !== null ? (FORCE ? [FORCE] : []) : WEBKIT_ONLY && own ? [own[0], ...STEPS.filter((c) => c < own[0] && c >= own[1])] : [];
/** Bộ nhớ đã tạo (bộ thử đọc mức đã nhận + bộ nhớ thật dùng tới qua worker.evaluate). */
self.__wasmMems = [];

function CappedMemory(d) {
  let m;
  if (!caps.length || !d?.shared || !(d.maximum > caps[caps.length - 1])) m = new RealMemory(d);
  else {
    let last;
    for (const maximum of caps) {
      if (maximum >= d.maximum || maximum < (d.initial || 0)) continue;
      try { m = new RealMemory({ ...d, maximum }); self.__wasmCap = maximum; break; } catch (e) { last = e; }
    }
    // không mức nào nhận: thử mức gốc lần cuối (máy vừa trả bộ nhớ) rồi mới báo lỗi
    if (!m) { try { m = new RealMemory(d); } catch { throw last ?? new RangeError('Out of memory'); } }
  }
  if (self.__wasmMems.length < 8) self.__wasmMems.push(m);
  return m;
}
CappedMemory.prototype = RealMemory.prototype;
WebAssembly.Memory = CappedMemory;
