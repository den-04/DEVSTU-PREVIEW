// Giảm nhiễu bằng AI (22/10/2026 — README §23z56): mô hình SCUNet bản ảnh thật (Kai Zhang và cộng sự, cszn/KAIR v1.0
// scunet_color_real_psnr.pth, Apache 2.0) chuyển sang ONNX ô cố định 256 × 256, chạy bằng ONNX Runtime Web 1.20.1 (MIT) — ưu tiên
// WebGPU (card màn hình), máy không có WebGPU thì WASM (chậm hơn nhiều). Xem LICENSES/scunet.txt, LICENSES/onnxruntime.txt.
// Trọng số cất dạng fp16 (tools/onnx-fp16-store.py, 38,7 MB thay vì 74 MB), chia 2 phần, tải song song khi dùng lần đầu.
// Đổi nội dung file này thì phải đổi số phiên bản trong tên (file .js được lưu đệm một năm).
// v3 (06/11 — 1.0.14, README §23z196): ONNX Runtime Web 1.31.1 (scunet2/, bản asyncify) + SCUNet tính 16-bit, ô 512 (cần WebGPU có shader-f16; không có thì
// dùng lại v2 / mô hình cũ ở scunet/). Đo: nhanh gấp ~2 (RTX, Intel tích hợp, Mac M3), PSNR ~53 dB so với bản cũ.
// v2 (06/11, README §23z196): `gc` (trang bật trên WebKit) — sau mỗi ô tạo rồi bỏ 128 MB ArrayBuffer cho JavaScriptCore chạy GC trong worker, rồi nhả lượt,
// để bộ đệm GPU ONNX Runtime đã bỏ được trả. Không có bước này, lưu ảnh 24 MP trên Mac phình tới 12–18 GB rồi app bị tắt; có: đỉnh ~5,4 GB, không chậm hơn.
// 12/11 (README §23z217 — dev Bảo: một ảnh, Làm sạch phông / rãnh cười đầy card 8 GB, đứng máy): tham số trên đường dẫn do app đặt theo mức Hiệu năng —
//   ?g=0: KHÔNG dùng card màn hình (mô hình cần nhiều bộ nhớ card hơn phần app được phép → chạy CPU); ?th=N: số luồng CPU cho WASM (tối đa 8).
import * as ort from './scunet2/ort.webgpu.min.mjs';

ort.env.wasm.wasmPaths = new URL('./scunet2/', import.meta.url).href;
const Q_ = new URL(import.meta.url).searchParams;
const GPU_OK = Q_.get('g') !== '0';
ort.env.wasm.numThreads = Q_.get('t') === '1' || !self.crossOriginIsolated ? 1 : Q_.get('th') ? Math.max(1, Math.min(8, Number(Q_.get('th')) || 1)) : Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
ort.env.wasm.proxy = false;

const PARTS = [1, 2].map((i) => new URL(`./scunet2/scunet-f16-512.part${i}.bin`, import.meta.url).href);
const BYTES = 38574124;
const T = 512;

async function loadModel() {
  let got = 0, last = 0;
  const bufs = await Promise.all(PARTS.map(async (u) => {
    const r = await fetch(u);
    if (!r.ok || !r.body) throw new Error('HTTP ' + r.status);
    const rd = r.body.getReader(), chunks = [];
    let n = 0;
    for (;;) {
      const { done, value } = await rd.read();
      if (done) break;
      chunks.push(value); n += value.length; got += value.length;
      const now = performance.now();
      if (now - last > 250) { last = now; self.postMessage({ dl: Math.min(0.999, got / BYTES) }); }
    }
    const b = new Uint8Array(n);
    let o = 0;
    for (const c of chunks) { b.set(c, o); o += c.length; }
    return b;
  }));
  self.postMessage({ dl: 1 });
  const all = new Uint8Array(bufs.reduce((a, b) => a + b.length, 0));
  let o = 0;
  for (const b of bufs) { all.set(b, o); o += b.length; }
  if (all.length !== BYTES) throw new Error('MODEL_SIZE');
  return all;
}

let session = null, backend = '';
const ready = () => (session ||= loadModel().then(async (m) => {
  // WebGPU trước; lỗi (máy / trình duyệt không có) thì WASM
  if (GPU_OK && self.navigator?.gpu) {
    try { const s = await ort.InferenceSession.create(m, { executionProviders: ['webgpu'], graphOptimizationLevel: 'all' }); backend = 'webgpu'; return s; } catch { /* sang WASM */ }
  }
  const s = await ort.InferenceSession.create(m, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  backend = 'wasm';
  return s;
}).catch((e) => { session = null; throw e; }));

// ONNX Runtime WebGPU không chạy hai lượt cùng lúc (lỗi 'Session mismatch'): xếp hàng từng ô
let queue = Promise.resolve();
self.onmessage = ({ data }) => { queue = queue.then(() => handle(data)); };
async function handle(data) {
  const { id, x, gc } = data || {};
  try {
    const s = await ready();
    if (!x) { self.postMessage({ id, backend }); return; }
    if (!(x instanceof Float32Array) || x.length !== 3 * T * T) throw new Error('SIZE');
    const out = (await s.run({ input: new ort.Tensor('float32', x, [1, 3, T, T]) })).output.data;
    if (gc) { for (let i = 0; i < 4; i++) new ArrayBuffer(32 << 20); await new Promise((r) => setTimeout(r)); }
    const y = out instanceof Float32Array ? out : Float32Array.from(out);
    self.postMessage({ id, y, backend }, [y.buffer]);
  } catch (e) {
    self.postMessage({ id, error: String(e?.message || e) });
  }
}
