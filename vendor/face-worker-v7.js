// Nhận diện khuôn mặt + 68 điểm mốc, chạy trong worker riêng để không làm đơ giao diện.
// v2 (26/10): thêm "dấu vân mặt" 128 số (FaceRecognitionNet của face-api, MIT) để nhóm ảnh theo người ở màn Lọc ảnh — chỉ tải mô hình
// này (6,4 MB) khi người dùng bấm "Tìm người trong ảnh".
// v3 (31/10 — anh: "1 album có hàng ngàn ảnh và mỗi ảnh có nhiều người khác nhau … giới hạn số lượng khuôn mặt"): "Tìm người" chỉ tính dấu
// vân mặt cho tối đa `max` mặt LỚN nhất mỗi ảnh (mặc định 10), bỏ mặt quá nhỏ (bề ngang < `minW` × bề ngang ảnh) — tìm mặt trước, cắt
// từng mặt đã chọn ra tính riêng, nên ảnh đông người không tốn thời gian cho mặt nhỏ phía xa.
// v4 (02/11 — anh: Làm đẹp da AI trên app iPhone không chạy, Safari chạy): sửa đường dẫn mô hình trên giao thức fr://.
// v5 (03/11 — iPad lag khoảng một phút sau khi cài, chặn riêng worker này là hết): chọn backend theo từng việc (`backend`: cpu | webgl). Trên WebKit ảnh đang chỉnh chạy CPU,
// không dựng WebGL trong worker nên không tranh với bộ vẽ; việc hàng loạt khách tự bấm vẫn dùng WebGL cho nhanh (io/face.ts).
// v6 (13/11 — máy không có card, ANGLE WARP): khi WebGL không dựng được, TensorFlow.js thử backend WASM mà gói không có file .wasm → lỗi 404
// mỗi lần khởi động rồi mới xuống CPU. Gỡ đăng ký backend WASM ngay sau khi nạp: hỏng WebGL thì xuống thẳng CPU (kết quả như cũ).
// v7 (13/11 — bộ thử máy yếu, card Intel UHD 770: tiến trình GPU tăng ~26 MB mỗi ảnh lúc Lọc ảnh soi kỹ, 297 RAW → +4 GB, không trả lại). TensorFlow.js
// (backend WebGL) giữ MỌI texture đã dùng xong để dùng lại cho tensor CÙNG CỠ, và dịch + giữ một bộ shader cho mỗi cỡ tensor mới. Ảnh mỗi máy ảnh một cỡ
// (1600 × 1067, 1600 × 1200, 1600 × 900, dọc / ngang…), mặt mỗi tấm một cỡ → texture (~120 MB mỗi cỡ ảnh mới) và shader (~7 MB + 200–400 ms mỗi cỡ mặt
// mới) chất mãi. Giờ mọi tensor đưa vào mạng chỉ có MỘT cỡ, kết quả y hệt v6 (so 92 ảnh thật, mô hình kỹ + nhanh: cùng số mặt, khung và điểm mốc lệch < 0,01 px):
//  - mô hình kỹ (SSD): ảnh đệm vuông cạnh dài × cạnh dài (điểm đen bên phải / dưới) trước khi đưa vào — đúng cách face-api tự đệm (toBatchTensor(512,
//    false)); khung trả về nhân lại hệ số làm tròn của face-api cho y hệt bản cũ;
//  - 68 điểm mốc: cắt + đệm + thu về 112 × 112 trên CPU (landmarksOf — y hệt phép tính của face-api) thay vì bằng TensorFlow trên GPU;
//  - trả kèm bộ nhớ TensorFlow.js (`mem.gpuMB`): io/face.ts thấy vượt ngân sách (mô hình nhanh của ảnh đang chỉnh nhận ảnh đủ cỡ) thì tắt worker lúc
//    rảnh; TEX_KEEP_MB là chặn cuối. Không đặt chặn thấp: 256 MB thì texture của chính mạng bị xoá rồi tạo lại mỗi lượt, mỗi ảnh chậm gấp đôi.
// Dùng face-api 1.7.15 (MIT, kèm TensorFlow.js — Apache 2.0), xem face-api-1.7.15/THIRD_PARTY.txt.
// Đổi nội dung file này thì phải đổi số phiên bản trong tên (file .js được lưu đệm một năm).
import * as faceapi from './face-api-1.7.15/face-api.esm.js';

// chỉ đường dẫn, không kèm giao thức: face-api chỉ biết http:// và https://, gặp fr://localhost/ (app Mac, iPhone) nó gộp dấu / thành fr:/localhost/ nên không tải được mô hình
const MODEL = new URL('./face-api-1.7.15/model', import.meta.url).pathname;
const no = () => { throw new Error('NO_DOM'); };
// worker không có DOM: chỉ dùng OffscreenCanvas và dữ liệu điểm ảnh
faceapi.env.setEnv({
  Canvas: OffscreenCanvas, CanvasRenderingContext2D: OffscreenCanvasRenderingContext2D, Image: class {}, ImageData, Video: class {},
  createCanvasElement: () => new OffscreenCanvas(1, 1), createImageElement: no, createVideoElement: no,
  fetch: self.fetch.bind(self), readFile: no,
});

try { faceapi.tf.removeBackend('wasm'); } catch { /* bản tfjs không có backend wasm */ }
const TEX_KEEP_MB = 1536;
try { faceapi.tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', TEX_KEEP_MB * 1024 * 1024); } catch { /* bản tfjs không có cờ này */ }
const memOf = () => {
  try { const m = faceapi.tf.memory(); return { tensors: m.numTensors, mb: Math.round(m.numBytes / 1048576), gpuMB: m.numBytesInGPUAllocated === undefined ? null : Math.round(m.numBytesInGPUAllocated / 1048576) }; }
  catch { return null; }
};
let backend = '';
async function useBackend(want) {
  if (backend === want) return;
  try { await faceapi.tf.setBackend(want); await faceapi.tf.ready(); backend = want; }
  catch { await faceapi.tf.setBackend('cpu'); await faceapi.tf.ready(); backend = 'cpu'; }
}

let base = null;
function ready() {
  return (base ||= (async () => {
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL);
    return faceapi.tf.getBackend();
  })().catch((e) => { base = null; throw e; })); // mất mạng lúc tải mô hình: lần sau thử lại
}
let ssd = null;
const ssdReady = () => (ssd ||= faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL).catch((e) => { ssd = null; throw e; }));
let rec = null;
const recReady = () => (rec ||= faceapi.nets.faceRecognitionNet.loadFromUri(MODEL).catch((e) => { rec = null; throw e; }));

/**
 * Khuôn mặt + dấu vân mặt (128 số) — mô hình kỹ (SSD) để bắt cả mặt nhỏ trong ảnh đông người. Chỉ `max` mặt lớn nhất, bề ngang ≥ `minW`
 * × bề ngang ảnh: tìm mặt cả ảnh trước, rồi mỗi mặt đã chọn cắt một vùng rộng gấp 2 quanh nó, tìm lại + điểm mốc + dấu vân trên vùng nhỏ đó.
 */
async function describe(img, max = 10, minW = 0.025) {
  await ready();
  await ssdReady();
  await recReady();
  const W = img.width, H = img.height;
  if (!W || !H || W * H > 6_000_000) throw new Error('SIZE');
  const opt = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
  const t = faceapi.tf.browser.fromPixels(squareOf(img));
  let pick;
  try {
    const dets = await faceapi.detectAllFaces(t, opt);
    pick = dets.filter((d) => d.box.width / W >= minW).sort((a, b) => b.box.area - a.box.area).slice(0, Math.max(1, Math.min(40, max)));
  } finally {
    t.dispose();
  }
  const src = new OffscreenCanvas(W, H);
  src.getContext('2d').putImageData(img, 0, 0);
  const out = [];
  for (const d of pick) {
    const b = d.box, side = Math.max(b.width, b.height) * 2;
    const x0 = Math.max(0, Math.round(b.x + b.width / 2 - side / 2)), y0 = Math.max(0, Math.round(b.y + b.height / 2 - side / 2));
    const x1 = Math.min(W, Math.round(b.x + b.width / 2 + side / 2)), y1 = Math.min(H, Math.round(b.y + b.height / 2 + side / 2));
    const cw = x1 - x0, ch = y1 - y0;
    if (cw < 16 || ch < 16) continue;
    const crop = new OffscreenCanvas(cw, ch);
    crop.getContext('2d').drawImage(src, x0, y0, cw, ch, 0, 0, cw, ch);
    const ct = faceapi.tf.browser.fromPixels(crop.getContext('2d').getImageData(0, 0, cw, ch));
    try {
      const r = await faceapi.detectSingleFace(ct, opt).withFaceLandmarks().withFaceDescriptor();
      if (!r) continue;
      const rb = r.detection.box;
      out.push({ box: [(x0 + rb.x) / W, (y0 + rb.y) / H, rb.width / W, rb.height / H], score: r.detection.score, desc: Array.from(r.descriptor) });
    } finally {
      ct.dispose();
    }
  }
  return out;
}

/** Ảnh đệm thành hình vuông cạnh = cạnh dài, ảnh ở góc trên trái, phần thêm màu đen — như face-api tự đệm cho mô hình SSD. */
function squareOf(img) {
  const W = img.width, H = img.height, S = Math.max(W, H);
  if (W === H) return img;
  const d = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < H; y++) d.set(img.data.subarray(y * W * 4, (y + 1) * W * 4), y * S * 4);
  return new ImageData(d, S, S);
}

const LM = 112;

/**
 * 68 điểm mốc của từng mặt, tính ĐÚNG như face-api (withFaceLandmarks): cắt khung mặt đã kẹp trong ảnh (làm tròn xuống), đệm vuông ở giữa bằng
 * điểm đen, thu về 112 × 112 bằng nội suy song tuyến kiểu TensorFlow cũ (alignCorners = false, halfPixelCenters = false), rồi đổi ngược về toạ độ ảnh.
 * Khác face-api ở một chỗ: cắt + đệm + thu nhỏ làm trên CPU (vài chục nghìn phép tính mỗi mặt), nên đầu vào mạng điểm mốc LUÔN là 112 × 112 — face-api
 * cắt bằng TensorFlow trên GPU, mỗi cỡ mặt một bộ shader mới phải dịch rồi giữ mãi (đo trên card Intel: +~7 MB tiến trình GPU và +200–400 ms mỗi ảnh).
 */
async function landmarksOf(img, dets) {
  const W = img.width, H = img.height, src = img.data, buf = new Float32Array(LM * LM * 3), out = [];
  for (const det of dets) {
    const b = det.box;   // { x, y, width, height, right, bottom } theo điểm ảnh của `img`
    // Box.clipAtImageBorders(W, H) của face-api: kẹp trong ảnh rồi làm tròn xuống cả x, y, rộng, cao
    const cx = Math.max(b.x, 0), cy = Math.max(b.y, 0);
    const x0 = Math.floor(cx), y0 = Math.floor(cy), w = Math.floor(Math.min(b.right - cx, W - cx)), h = Math.floor(Math.min(b.bottom - cy, H - cy));
    if (!(w > 0 && h > 0)) continue;
    // padToSquare(…, giữa): phần thêm phía sau = làm tròn(nửa chênh lệch), phía trước = phần còn lại
    const m = Math.max(w, h), diff = Math.abs(w - h), before = diff - Math.round(diff * 0.5);
    const offX = h > w ? before : 0, offY = w > h ? before : 0;
    const at = (r, c, ch) => { const sr = r - offY, sc = c - offX; return sr < 0 || sc < 0 || sr >= h || sc >= w ? 0 : src[((y0 + sr) * W + x0 + sc) * 4 + ch]; };
    const k = m / LM;
    for (let r = 0; r < LM; r++) {
      const fr = r * k, r0 = Math.floor(fr), r1 = Math.min(m - 1, Math.ceil(fr)), dr = fr - r0;
      for (let c = 0; c < LM; c++) {
        const fc = c * k, c0 = Math.floor(fc), c1 = Math.min(m - 1, Math.ceil(fc)), dc = fc - c0, o = (r * LM + c) * 3;
        for (let ch = 0; ch < 3; ch++) {
          const tl = at(r0, c0, ch), tr = at(r0, c1, ch), bl = at(r1, c0, ch), br = at(r1, c1, ch);
          const top = tl + (tr - tl) * dc, bot = bl + (br - bl) * dc;
          buf[o + ch] = top + (bot - top) * dr;
        }
      }
    }
    const t = faceapi.tf.tensor4d(buf, [1, LM, LM, 3]);
    let lm;
    try { lm = await faceapi.nets.faceLandmark68Net.detectLandmarks(t); } finally { t.dispose(); }
    // đầu vào đã vuông 112: điểm = tỉ lệ × 112 → về ảnh cắt (bỏ phần đệm như face-api postProcess) → cộng góc khung mặt (chưa kẹp, như face-api)
    const pts = [];
    for (const p of lm.positions) {
      let x = (p.x / LM) * m, y = (p.y / LM) * m;
      if (w < h) x -= (m - w) / 2; else if (h < w) y -= (m - h) / 2;
      pts.push((x + b.x) / W, (y + b.y) / H);
    }
    out.push({ box: [b.x / W, b.y / H, b.width / W, b.height / H], score: det.score, pts });
    if (out.length >= 40) break;
  }
  return out;
}

async function detect(img, thorough) {
  await ready();
  const W = img.width, H = img.height;
  if (!W || !H || W * H > 6_000_000) throw new Error('SIZE');
  // mô hình kỹ: đệm vuông trước (cùng một cỡ texture cho mọi ảnh — xem v7 ở đầu file); toạ độ vẫn chia theo cỡ ảnh thật
  const t = faceapi.tf.browser.fromPixels(thorough ? squareOf(img) : img);
  let dets;
  try {
    let opt;
    if (thorough) { await ssdReady(); opt = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }); }
    else opt = new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.45 });
    dets = await faceapi.detectAllFaces(t, opt);
  } finally {
    t.dispose();
  }
  if (thorough && W !== H) {
    // face-api tự đệm thì đổi khung về ảnh thật qua cỡ đã làm tròn (512 × cạnh / cạnh dài, làm tròn) — lệch ~0,1 %; nhân đúng hệ số đó để khung
    // (và vùng cắt cho điểm mốc) y hệt bản v6
    const S = Math.max(W, H), a = 512 / S, rx = (512 * W) / (Math.round(W * a) * S), ry = (512 * H) / (Math.round(H * a) * S);
    dets = dets.map((d) => {
      const x = d.box.x * rx, y = d.box.y * ry, width = d.box.width * rx, height = d.box.height * ry;
      return { score: d.score, box: { x, y, width, height, right: x + width, bottom: y + height } };
    });
  }
  return landmarksOf(img, dets);
}

self.onmessage = async ({ data }) => {
  const { id, img, thorough, op, max, backend: want } = data;
  try {
    await useBackend(want === 'cpu' ? 'cpu' : 'webgl');
    const t0 = performance.now();
    const faces = op === 'desc' ? await describe(img, typeof max === 'number' ? max : 10) : await detect(img, !!thorough);
    self.postMessage({ id, faces, backend, ms: Math.round(performance.now() - t0), mem: memOf() });
  } catch (e) {
    self.postMessage({ id, error: String((e && e.message) || e) });
  }
};
