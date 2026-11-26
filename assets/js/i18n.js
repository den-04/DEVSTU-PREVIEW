// DEVSTU Website — Bilingual Vietnamese / English (VI <-> EN) Switcher
(function () {
  'use strict';

  var STORAGE_KEY = 'devstu_lang';
  var listeners = [];
  var textEntries = null;
  var htmlEntries = null;
  var attrEntries = null;
  var origTitle = document.title;
  var metaDescEl = document.querySelector('meta[name="description"]');
  var origMetaDesc = metaDescEl ? metaDescEl.getAttribute('content') || '' : '';

  // Bilingual URL route pairs (VI <-> EN)
  var ROUTES = [
    ['/', '/en/'],
    ['/bang-gia/', '/en/pricing/'],
    ['/tai-xuong/', '/en/download/'],
    ['/gioi-thieu/', '/en/about/'],
    ['/chinh-sach/', '/en/policies/'],
    ['/chinh-sach/bao-mat/', '/en/policies/privacy/'],
    ['/chinh-sach/dieu-khoan/', '/en/policies/terms/'],
    ['/chinh-sach/cookie/', '/en/policies/cookies/'],
    ['/chinh-sach/thanh-toan-hoan-tien/', '/en/policies/refunds/'],
    ['/chinh-sach/giay-phep/', '/en/policies/licenses/'],
    ['/blog/', '/en/blog/'],
    ['/blog/anh-dang-facebook-bi-lech-mau/', '/en/blog/photos-look-different-on-facebook/'],
    ['/dang-nhap/', '/en/login/'],
    ['/don-hang/', '/en/orders/']
  ];

  var VI_TO_EN = {};
  var EN_TO_VI = {};
  for (var rIdx = 0; rIdx < ROUTES.length; rIdx++) {
    var viPath = ROUTES[rIdx][0];
    var enPath = ROUTES[rIdx][1];
    var viNoSlash = viPath === '/' ? '/' : viPath.replace(/\/+$/, '');
    var enNoSlash = enPath.replace(/\/+$/, '');
    VI_TO_EN[viPath] = enPath;
    VI_TO_EN[viNoSlash] = enPath;
    EN_TO_VI[enPath] = viPath;
    EN_TO_VI[enNoSlash] = viPath;
  }

  function normPath(p) {
    if (!p) return '/';
    p = p.replace(/\/index\.html$/i, '/');
    if (p.length > 1 && p.charAt(p.length - 1) !== '/') return p + '/';
    return p;
  }

  function mapPathname(pathname, targetLang) {
    var np = normPath(pathname);
    if (targetLang === 'en') {
      return VI_TO_EN[np] || (EN_TO_VI[np] ? np : null);
    }
    return EN_TO_VI[np] || (VI_TO_EN[np] ? np : null);
  }

  function rewriteHref(rawHref, targetLang) {
    if (!rawHref) return rawHref;
    if (/^(mailto:|tel:|javascript:|#)/i.test(rawHref)) return rawHref;
    if (/^https?:\/\//i.test(rawHref)) return rawHref;
    if (rawHref.charAt(0) !== '/') return rawHref;
    var hashIdx = rawHref.indexOf('#');
    var hash = hashIdx >= 0 ? rawHref.slice(hashIdx) : '';
    var beforeHash = hashIdx >= 0 ? rawHref.slice(0, hashIdx) : rawHref;
    var qIdx = beforeHash.indexOf('?');
    var query = qIdx >= 0 ? beforeHash.slice(qIdx) : '';
    var pathPart = qIdx >= 0 ? beforeHash.slice(0, qIdx) : beforeHash;
    var mapped = mapPathname(pathPart, targetLang);
    if (!mapped) return rawHref;
    return mapped + query + hash;
  }

  function rewriteLinks(lang) {
    document.querySelectorAll('a[href]').forEach(function (a) {
      var raw = a.getAttribute('href');
      var next = rewriteHref(raw, lang);
      if (next !== raw) a.setAttribute('href', next);
    });
  }

  function syncBrowserUrl(lang) {
    try {
      if (!window.history || typeof window.history.replaceState !== 'function') return;
      if (window.location.protocol === 'file:') return;
      var curPath = window.location.pathname || '/';
      var mapped = mapPathname(curPath, lang);
      if (!mapped) return;
      var params = new URLSearchParams(window.location.search);
      params.delete('lang');
      var qs = params.toString();
      var nextUrl = mapped + (qs ? '?' + qs : '') + (window.location.hash || '');
      var curUrl = curPath + window.location.search + (window.location.hash || '');
      if (nextUrl !== curUrl) {
        window.history.replaceState({ lang: lang }, '', nextUrl);
      }
    } catch (_) { }
  }

  function isEnglishUrl() {
    try {
      var p = window.location.pathname || '/';
      return p === '/en' || p.indexOf('/en/') === 0;
    } catch (_) {
      return false;
    }
  }

  function norm(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  // Page titles & descriptions
  var TITLE_MAP = {
    'DEVSTU · Chỉnh ảnh hàng loạt & Retouch Studio bằng AI trên thiết bị': 'DEVSTU · On-Device AI Batch Photo Editing & Studio Retouching',
    'Tải DEVSTU cho Windows & Kiểm tra cấu hình máy': 'Download DEVSTU for Windows & Hardware Benchmark',
    'Bảng giá DEVSTU · Standard, Pro STU Ultra & Studio Max': 'DEVSTU Pricing · Standard, Pro STU Ultra & Studio Max',
    'Giới thiệu DEVSTU · Kiến trúc Tauri v2, Rust SIMD & 7 mô hình AI Offline': 'About DEVSTU · Tauri v2, Rust SIMD & 7 Offline AI Models',
    'Chính sách bảo mật & Điều khoản · DEVSTU': 'Privacy Policy & Terms · DEVSTU',
    'Chính sách | DEVSTU': 'Policies | DEVSTU',
    'Chính sách bảo mật | DEVSTU': 'Privacy Policy | DEVSTU',
    'Điều khoản sử dụng | DEVSTU': 'Terms of Use | DEVSTU',
    'Chính sách cookie | DEVSTU': 'Cookie Policy | DEVSTU',
    'Thanh toán và hoàn tiền | DEVSTU': 'Payment & Refunds | DEVSTU',
    'Giấy phép phần mềm | DEVSTU': 'Software Licenses | DEVSTU',
    'Blog · Mẹo chỉnh ảnh & quản lý màu sắc | DEVSTU': 'Blog · Photo Editing & Color Management | DEVSTU',
    'Ảnh đăng Facebook bị lệch màu: nguyên nhân và cách sửa | DEVSTU': 'Why Photos Look Different on Facebook: Causes & Fix | DEVSTU',
    'Đăng nhập tài khoản · DEVSTU': 'Sign In · DEVSTU',
    'Lịch sử đơn hàng & Kho Key · DEVSTU': 'Order History & Key Vault · DEVSTU',
    '404 · Không tìm thấy trang | DEVSTU': '404 · Page Not Found | DEVSTU'
  };

  var META_MAP = {
    'DEVSTU — Bộ ứng dụng chỉnh ảnh AI chạy trực tiếp trên máy (Offline / On-Device): làm đẹp da U-Net, lọc ảnh, 111 bộ màu Oklab, RAW 16-bit, STU Ultra Max Rust SIMD & WebGPU.':
      'DEVSTU — On-Device / Offline AI photo editing suite: U-Net skin retouching, AI culling, 111 Oklab color looks, 16-bit RAW, STU Ultra Max Rust SIMD & WebGPU.',
    'Tải ứng dụng chỉnh ảnh AI DEVSTU Desktop (Tauri v2 · Rust SIMD + WebGPU) cho Windows 10/11 và kiểm tra tốc độ GPU/CPU trực tiếp trên trình duyệt.':
      'Download DEVSTU Desktop AI Photo Suite (Tauri v2 · Rust SIMD + WebGPU) for Windows 10/11 and benchmark your GPU/CPU directly in your browser.',
    'Bảng giá DEVSTU AI Photo Retouching Suite: Miễn phí bắt đầu, không tính credit theo từng tấm ảnh, hỗ trợ dùng offline trên Desktop.':
      'DEVSTU AI Photo Retouching Suite pricing: Free to start, zero per-photo export credits, 100% offline desktop workflow.',
    'Tìm hiểu về DEVSTU AI Photo Retouching Suite phát triển bởi ducdoan-04 tại Đà Nẵng: kiến trúc Tauri v2, Rust SIMD, ONNX WebGPU và 7 hệ mô hình AI chạy trực tiếp trên thiết bị.':
      'Learn about DEVSTU AI Photo Retouching Suite built by ducdoan-04 in Da Nang: Tauri v2 architecture, Rust SIMD, ONNX WebGPU, and 7 on-device AI model families.',
    'Cách DEVSTU xử lý dữ liệu, điều khoản sử dụng, chính sách cookie, thanh toán hoàn tiền và giấy phép phần mềm mã nguồn mở.':
      'How DEVSTU handles data, terms of use, cookie policy, payment & refunds, and open-source software licenses.',
    'DEVSTU chỉnh ảnh ngay trên máy bạn, không tải ảnh lên máy chủ. Trang này nói rõ dữ liệu nào được lưu, lưu ở đâu và quyền của bạn.':
      'DEVSTU processes photos locally on your PC and never uploads them. Learn what data is stored, where, and your rights.',
    'Điều khoản khi dùng website và ứng dụng chỉnh ảnh AI DEVSTU Desktop: quyền với ảnh của bạn, cách dùng hợp lệ và giới hạn trách nhiệm.':
      'Terms for using the DEVSTU website and Desktop AI photo editor: your photo rights, acceptable use, and liability limits.',
    'Website DEVSTU không cài cookie quảng cáo hay theo dõi bên thứ ba; chỉ dùng lưu trữ cục bộ tối giản cho ngôn ngữ và tuỳ chọn của bạn.':
      'The DEVSTU website uses zero advertising or third-party tracking cookies; only minimal local storage for language and preferences.',
    'Thông tin gói DEVSTU Standard, Pro · STU Ultra, Studio Max, cách thanh toán một lần không tự gia hạn và chính sách hỗ trợ hoàn tiền.':
      'DEVSTU Standard, Pro · STU Ultra, and Studio Max plans, one-time non-recurring payment details, and refund policy.',
    'Danh sách thư viện mã nguồn mở, mô hình AI và phông chữ mà DEVSTU Desktop Suite đang dùng, kèm tên tác giả và giấy phép của từng thành phần.':
      'Open-source libraries, AI models, and fonts powering DEVSTU Desktop Suite along with their authors and licenses.',
    'Mẹo chỉnh ảnh, quản lý màu sắc sRGB/Oklab và quy trình hậu kỳ AI nhanh trên DEVSTU Desktop.':
      'Photo editing tips, sRGB/Oklab color management, and fast AI post-production workflows in DEVSTU Desktop.',
    'Vì sao ảnh chỉnh đẹp trong Photoshop, Camera Raw lên Facebook, Zalo lại nhợt, da xám? Cài đặt đúng khi xuất ảnh sRGB và công cụ kiểm tra miễn phí trên thiết bị.':
      'Why do photos edited in Photoshop or Camera Raw look dull and gray on Facebook? Correct sRGB export settings plus a free on-device color profile checker.',
    'Đăng nhập tài khoản DEVSTU để thanh toán VietQR tự động, lưu lịch sử đơn hàng và nhận mã Key kích hoạt phần mềm.':
      'Sign in to DEVSTU for automatic VietQR checkout, saved order history, and standalone activation Keys.',
    'Xem lại toàn bộ lịch sử đơn hàng VietQR và mã Key kích hoạt DEVSTU đã mua theo tài khoản của bạn.':
      'Review your VietQR order history and retrieve purchased DEVSTU activation Keys saved to your account.'
  };

  // Specific elements containing mixed inline tags (<code>, <strong>, <a>), matched by normalized textContent so browser attribute serialization can never break matching
  var HTML_SELECTORS = 'p, dd, li, td';
  var HTML_MAP = {
    'Tích hợp sẵn 6 mạng thần kinh chuyên biệt ngay trên máy: mịn da giữ vân lỗ chân lông (da-retouch-v1), làm mờ rãnh cười (ranh-cuoi-v1), đánh khối 3D (tao-khoi-v1), da toàn thân cổ/tay/vai (da-than-v1), phẳng nếp quần áo và gọn tóc con.':
      'Includes 6 dedicated on-device neural networks: texture-preserving skin smoothing (<code>da-retouch-v1</code>), smile-line softening (<code>ranh-cuoi-v1</code>), 3D contouring (<code>tao-khoi-v1</code>), body skin for neck/arms/shoulders (<code>da-than-v1</code>), clothing de-wrinkling, and stray-hair cleanup.',
    'Hỗ trợ nhập trực tiếp file .xmp, .lrtemplate và LUT .cube từ Photoshop, DaVinci.':
      'Directly imports <code>.xmp</code>, <code>.lrtemplate</code>, and 3D <code>.cube</code> LUTs from Lightroom, Photoshop, and DaVinci Resolve.',
    'Tích hợp đồng thời LaMa Inpainting, Depth Anything v2, BiRefNet và LK Magic Pro Sky Segmentation ngay trong bộ cài offline — bấm chuyển 4 tab bên trái và kéo thử thanh so sánh.':
      'Bundles <strong>LaMa Inpainting</strong>, <strong>Depth Anything v2</strong>, <strong>BiRefNet</strong>, and <strong>LK Magic Pro Sky Segmentation</strong> right inside the offline installer — switch the 4 tabs on the left and drag the slider.',
    'Tích hợp LibRaw v1.6.0 (Wasm) và libheif v1.23.5 đọc trực tiếp ảnh RAW từ Sony ARW, Canon CR2/CR3, Nikon NEF, Fujifilm RAF, DNG và HEIC iPhone ngay trên client, bảo toàn dải sáng 16-bit.':
      'Powered by <strong>LibRaw v1.6.0 (Wasm)</strong> and <strong>libheif v1.23.5</strong> to decode Sony ARW, Canon CR2/CR3, Nikon NEF, Fujifilm RAF, DNG, and iPhone HEIC directly on-device with full 16-bit dynamic range.',
    'Tải toàn bộ gói cài đặt kèm thư mục vendor/ AI models trực tiếp từ Google Drive':
      'Download the complete installer package with the offline <code>vendor/</code> AI models folder directly from Google Drive',
    'Cần hỗ trợ cài đặt? Liên hệ ducdoan04.work@gmail.com':
      'Need installation help? Contact <a href="mailto:ducdoan04.work@gmail.com">ducdoan04.work@gmail.com</a>',
    'Nếu trình duyệt chưa tự mở tab mới, bấm trực tiếp vào đây: Mở thư mục tải DEVSTU trên Google Drive →':
      'If your browser did not open a new tab automatically, click directly here: <a href="https://drive.google.com/drive/folders/1wb_3PVQC3E1NNf6-V95L05esmXixaX0Y?usp=sharing" target="_blank" rel="noopener noreferrer"><strong>Open DEVSTU Download Folder on Google Drive →</strong></a>',
    'Đảm bảo giữ nguyên tệp DEVSTU.exe cùng các thư mục vendor/, assets/, icons/, fonts/ và cache_t/.':
      'Keep <code>DEVSTU.exe</code> together with the <code>vendor/</code>, <code>assets/</code>, <code>icons/</code>, <code>fonts/</code>, and <code>cache_t/</code> folders intact.',
    'Bấm Thông tin thêm (More info) → Vẫn chạy (Run anyway). Ứng dụng không yêu cầu quyền Administrator.':
      'Click <strong>More info</strong> → <strong>Run anyway</strong>. The app does not require Administrator privileges.',
    'Liên hệ kích hoạt bản quyền / hoá đơn studio qua email ducdoan04.work@gmail.com.':
      'Contact <a href="mailto:ducdoan04.work@gmail.com">ducdoan04.work@gmail.com</a> for license activation or studio invoices.',
    'Thanh toán tự động qua VietQR sẽ cấp ngay mã Key riêng (không tự kích hoạt vào tài khoản) và lưu lại trong Lịch sử đơn hàng. Hỗ trợ: ducdoan04.work@gmail.com.':
      'Automatic VietQR payment immediately issues a standalone Key (never auto-activated) and saves it to your Order History. Support: <a href="mailto:ducdoan04.work@gmail.com">ducdoan04.work@gmail.com</a>.',
    'Bộ ứng dụng xử lý và phục dựng ảnh chuyên nghiệp chạy hoàn toàn trên thiết bị (On-Device / Offline Suite), được xây dựng bởi ducdoan-04 tại Đà Nẵng, Việt Nam.':
      'A professional photo editing and retouching suite running 100% on-device (Offline Suite), built by <strong>ducdoan-04</strong> in Da Nang, Vietnam.',
    'Gồm da-retouch-v1, ranh-cuoi-v1, tao-khoi-v1, da-than-v1, ao-retouch-v1, toc-retouch-v1 kết hợp MediaPipe 478 điểm mốc khuôn mặt.':
      'Includes <code>da-retouch-v1</code>, <code>ranh-cuoi-v1</code>, <code>tao-khoi-v1</code>, <code>da-than-v1</code>, <code>ao-retouch-v1</code>, and <code>toc-retouch-v1</code> paired with MediaPipe 478-point facial landmarks.',
    'Tác giả: ducdoan-04 · Đà Nẵng, Việt Nam · Email: ducdoan04.work@gmail.com':
      'Author: <strong>ducdoan-04</strong> · Da Nang, Vietnam · Email: <a href="mailto:ducdoan04.work@gmail.com">ducdoan04.work@gmail.com</a>',
    'DEVSTU — AI Photo Retouching Suite · Đà Nẵng, Việt Nam · ducdoan04.work@gmail.com':
      'DEVSTU — AI Photo Retouching Suite · Da Nang, Vietnam · <a href="mailto:ducdoan04.work@gmail.com">ducdoan04.work@gmail.com</a>',

    // Policy pages mixed-HTML blocks
    'DEVSTU là bộ ứng dụng chỉnh ảnh AI chạy trực tiếp trên máy tính (Desktop Suite). Điều quan trọng nhất trong chính sách này: ảnh của bạn không rời khỏi máy bạn. Mọi bước giải mã RAW 16-bit, chỉnh màu Oklab, làm đẹp da U-Net, xoá vật thể LaMa, tách nền BiRefNet và xuất ảnh đều chạy cục bộ trên chính phần cứng của bạn, không có ảnh nào được gửi lên máy chủ của chúng tôi hay của bất kỳ bên thứ ba nào.':
      'DEVSTU is an on-device AI photo editing Desktop Suite. The most important rule in this policy: <strong>your photos never leave your computer</strong>. Every step — 16-bit RAW decoding, Oklab color grading, U-Net skin retouching, LaMa object removal, BiRefNet matting, and exporting — runs locally on your hardware with zero uploads to our servers or any third party.',
    'Chính sách này áp dụng cho website giới thiệu DEVSTU và ứng dụng máy tính DEVSTU Desktop Suite, do ducdoan-04 xây dựng và vận hành tại Đà Nẵng, Việt Nam.':
      'This policy applies to the DEVSTU website and DEVSTU Desktop Suite, built and operated by <strong>ducdoan-04</strong> in Da Nang, Vietnam.',
    'Bên quản lý và chịu trách nhiệm về dữ liệu: DEVSTU · ducdoan-04 (Đà Nẵng, Việt Nam). Liên hệ về quyền riêng tư qua email: ducdoan04.work@gmail.com.':
      'Data controller: <strong>DEVSTU · ducdoan-04</strong> (Da Nang, Vietnam). Privacy inquiries: <a href="mailto:ducdoan04.work@gmail.com">ducdoan04.work@gmail.com</a>.',
    'Mọi thông số chỉnh sửa, công thức đồng bộ buổi chụp, bộ màu, preset Lightroom .xmp, LUT .cube hay logo studio bạn thêm vào.':
      'Your edits, batch sync recipes, color looks, Lightroom <code>.xmp</code> presets, <code>.cube</code> LUTs, or studio watermarks.',
    'Họ tên, số điện thoại hay danh bạ. Bản Standard dùng trực tiếp trên máy không cần tạo tài khoản.':
      'Your full name, phone number, or contacts. The Standard edition runs directly on your PC with <strong>no account required</strong>.',
    'Để DEVSTU chạy hoàn toàn offline và mở lại nhanh các buổi chụp gần đây, ứng dụng lưu dữ liệu ngay trên ổ cứng và bộ nhớ cục bộ WebView2 trên máy bạn:':
      'To work 100% offline and reopen recent shoots instantly, DEVSTU stores data <strong>directly on your local drive and WebView2 storage</strong>:',
    'Thư mục cache_t/ và bộ nhớ tạm: lưu ảnh xem trước (thumbnail), trạng thái thông số chỉnh sửa và mặt nạ AI đã tính để bạn không phải chờ tính lại.':
      'The <code>cache_t/</code> folder and local cache: stores preview thumbnails, adjustment states, and computed AI masks so you never wait for recomputation.',
    'Thư mục vendor/, assets/, fonts/: lưu sẵn trọng số 7 hệ mô hình AI (BiRefNet, LaMa, Depth Anything v2, MediaPipe, MODNet, SCUNet, U-Net Skin AI) để dùng được khi ngắt mạng hoàn toàn.':
      'The <code>vendor/</code>, <code>assets/</code>, and <code>fonts/</code> folders: store all 7 offline AI model families (BiRefNet, LaMa, Depth Anything v2, MediaPipe, MODNet, SCUNet, U-Net Skin AI) for full offline use.',
    'Chúng tôi không bao giờ yêu cầu, nhìn thấy hay lưu số thẻ ngân hàng, mã OTP hay thông tin đăng nhập tài khoản ngân hàng của bạn. Chi tiết xem tại Thanh toán và hoàn tiền.':
      '<strong>We never ask for, see, or store your card numbers, OTP codes, or banking credentials.</strong> See <a href="/chinh-sach/thanh-toan-hoan-tien/">Payment &amp; Refunds</a> for details.',
    'Trình duyệt chỉ lưu lựa chọn ngôn ngữ (devstu_lang) và tuỳ chọn cookie của bạn (devstu_cookie_prefs). Chi tiết xem tại Chính sách cookie.':
      'Your browser only stores your language choice (<code>devstu_lang</code>) and cookie preferences (<code>devstu_cookie_prefs</code>). See our <a href="/chinh-sach/cookie/">Cookie Policy</a>.',
    'Khi bạn gửi email hỗ trợ kỹ thuật, góp ý hoặc yêu cầu bản quyền tới ducdoan04.work@gmail.com, chúng tôi chỉ dùng địa chỉ email và nội dung bạn gửi để phản hồi và giải quyết yêu cầu của bạn. Vui lòng không đính kèm ảnh riêng tư của khách hàng nếu không thật sự cần thiết.':
      'When you email <a href="mailto:ducdoan04.work@gmail.com">ducdoan04.work@gmail.com</a> for technical support, feedback, or licensing, we only use your email and message to respond. Please avoid attaching private client photos unless necessary.',
    'Bạn có quyền yêu cầu kiểm tra, chỉnh sửa hoặc xoá hoàn toàn thông tin liên hệ hay hồ sơ hỗ trợ của mình bất cứ lúc nào bằng cách gửi email tới ducdoan04.work@gmail.com. Chúng tôi sẽ xác nhận và xử lý trong vòng 7 ngày làm việc.':
      'You may request to review, correct, or permanently delete your contact or support records at any time by emailing <a href="mailto:ducdoan04.work@gmail.com">ducdoan04.work@gmail.com</a>. We confirm and complete requests within 7 business days.',

    'Khi truy cập website giới thiệu DEVSTU hoặc tải xuống và sử dụng ứng dụng DEVSTU Desktop Suite (gọi chung là "DEVSTU"), bạn đồng ý với các điều khoản dưới đây. DEVSTU do ducdoan-04 xây dựng và vận hành tại Đà Nẵng, Việt Nam.':
      'By visiting the DEVSTU website or downloading and using DEVSTU Desktop Suite ("DEVSTU"), you agree to these terms. DEVSTU is built and operated by <strong>ducdoan-04</strong> in Da Nang, Vietnam.',
    'Bạn giữ 100% quyền sở hữu và quyền thương mại với mọi bức ảnh bạn mở và xuất ra từ DEVSTU (ảnh cưới, chân dung, in ấn, bàn giao khách hàng). Chúng tôi không nhận, không lưu và không có bất kỳ quyền nào với ảnh của bạn — mọi xử lý diễn ra ngay trên máy tính của bạn (xem Chính sách bảo mật).':
      'You retain 100% ownership and commercial rights to every photo you open and export in DEVSTU (weddings, portraits, print, client delivery). We never receive, store, or claim rights over your photos — all processing runs locally on your PC (see <a href="/chinh-sach/bao-mat/">Privacy Policy</a>).',
    '111 bộ màu DEVSTU Studio, giao diện, tên gọi và biểu tượng DEVSTU thuộc quyền sở hữu của chúng tôi; bạn được toàn quyền dùng các bộ màu đó cho ảnh cá nhân và ảnh thương mại. Ứng dụng tích hợp một số thư viện và mô hình AI mã nguồn mở theo giấy phép riêng — xem chi tiết tại Giấy phép phần mềm.':
      'The 111 DEVSTU Studio looks, interface, name, and logo belong to us; you are free to use them on personal and commercial photos. DEVSTU integrates open-source libraries and AI models under their respective licenses — see <a href="/chinh-sach/giay-phep/">Software Licenses</a>.',
    'Các thư viện và mô hình mã nguồn mở đi kèm vẫn tuân theo giấy phép gốc tương ứng (xem Giấy phép phần mềm).':
      'Included open-source libraries and AI models remain governed by their original licenses (see <a href="/chinh-sach/giay-phep/">Software Licenses</a>).',
    'Bản Standard (Miễn phí) cho phép tải về sử dụng trực tiếp mà không cần tài khoản. Các tính năng AI nâng cao, STU Ultra và God Mode thuộc gói Pro · STU Ultra và Studio Max; giá, phương thức thanh toán và hoàn tiền được nêu rõ ở trang Thanh toán và hoàn tiền. Chúng tôi có thể bổ sung, cải tiến hoặc điều chỉnh tính năng trong các bản cập nhật tương lai.':
      'The Standard (Free) edition runs directly without an account. Advanced AI tools, STU Ultra, and God Mode are included in Pro · STU Ultra and Studio Max; pricing, payment, and refund rules are detailed on <a href="/chinh-sach/thanh-toan-hoan-tien/">Payment &amp; Refunds</a>. We may add, improve, or adjust features in future updates.',
    'DEVSTU được cung cấp theo nguyên trạng ("as is"). Chúng tôi nỗ lực tối ưu hiệu năng và độ ổn định, nhưng không thể bảo đảm phần mềm hoàn toàn không phát sinh lỗi trên mọi cấu hình phần cứng. Vì ảnh và dự án nằm hoàn toàn trên máy bạn, hãy luôn sao lưu bản ảnh gốc; chúng tôi không chịu trách nhiệm với tổn thất dữ liệu do lỗi ổ cứng, hệ điều hành hoặc thao tác xoá nhầm trong phạm vi pháp luật cho phép.':
      'DEVSTU is provided "as is". While we strive for speed and reliability, we cannot guarantee zero bugs on every hardware configuration. Because photos and projects live solely on your PC, <strong>always keep backups of your originals</strong>; we are not liable for data loss caused by drive failure, OS issues, or accidental deletion to the fullest extent permitted by law.',
    'Mọi câu hỏi về điều khoản sử dụng vui lòng gửi về email ducdoan04.work@gmail.com.':
      'For questions about these terms, please email <a href="mailto:ducdoan04.work@gmail.com">ducdoan04.work@gmail.com</a>.',

    'Website giới thiệu DEVSTU không có cookie quảng cáo, không nhúng Facebook Pixel, không có nút theo dõi mạng xã hội và không tải phông chữ từ máy chủ bên thứ ba. Bạn có thể xem và thay đổi tuỳ chọn lưu trữ bất cứ lúc nào bằng nút "Cài đặt cookie" ở chân trang hoặc ngay dưới đây.':
      'The DEVSTU website has <strong>zero advertising cookies</strong>, no Meta Pixel, no social tracking buttons, and no third-party font servers. You can review or update your storage preferences anytime via <strong>"Cookie Settings"</strong> in the footer or below.',
    'Website chỉ dùng bộ nhớ cục bộ tối giản (localStorage) ngay trên trình duyệt của bạn, hoàn toàn không gửi ra máy chủ:':
      'This website only uses minimal browser local storage (<code>localStorage</code>) on your device and never transmits it to any server:',
    'devstu_lang: ghi nhớ ngôn ngữ hiển thị bạn đã chọn (VI hoặc EN) để giữ nguyên khi bạn chuyển trang.':
      '<code>devstu_lang</code>: remembers your selected display language (<strong>VI</strong> or <strong>EN</strong>) across pages.',
    'devstu_cookie_prefs: ghi nhớ lựa chọn quyền riêng tư mà bạn đã lưu trong hộp thoại Cài đặt cookie.':
      '<code>devstu_cookie_prefs</code>: remembers the privacy preference you saved in the <strong>Cookie Settings</strong> dialog.',
    'Tuỳ chọn hiệu năng luôn tắt mặc định khi bạn mới truy cập website.':
      'Performance preferences are always <strong>off by default</strong> when you first visit the website.',
    'Bạn có thể bật hoặc tắt bất cứ lúc nào bằng nút Cài đặt cookie. Tuỳ chọn này không bao giờ thu thập ảnh, tệp tin hay dữ liệu định danh cá nhân.':
      'You can toggle it anytime via <strong>Cookie Settings</strong>. It never collects photos, files, or personally identifiable data.',
    'Ứng dụng máy tính DEVSTU (Tauri v2): lưu trạng thái dự án đang chỉnh, ảnh xem trước, bộ màu .xmp / .cube bạn nhập và trọng số AI cục bộ trong thư mục cài đặt và bộ nhớ WebView2 để mở lại nhanh và chạy 100% khi không có mạng.':
      '<strong>DEVSTU Desktop App (Tauri v2):</strong> stores active project states, preview thumbnails, imported <code>.xmp</code> / <code>.cube</code> looks, and AI weights locally in the app directory and WebView2 storage for fast reopen and 100% offline execution.',
    'Không có cookie theo dõi trong ứng dụng: máy chủ HTTP nội bộ viết bằng Rust chỉ lắng nghe cục bộ trên máy bạn (localhost) và không truyền dữ liệu ra Internet. Chi tiết xem tại Chính sách bảo mật.':
      '<strong>No tracking cookies in the app:</strong> the embedded Rust HTTP server listens strictly on <code>localhost</code> and never sends data online. See our <a href="/chinh-sach/bao-mat/">Privacy Policy</a>.',
    'Bạn có thể xoá toàn bộ dữ liệu trang web bất cứ lúc nào trong phần cài đặt của trình duyệt (Xoá cookie và dữ liệu trang web). Với ứng dụng DEVSTU Desktop, bạn có thể xoá thư mục cache_t/ khi muốn dọn bộ nhớ đệm ảnh xem trước.':
      'You can clear all website data anytime in your browser settings (Clear cookies and site data). For DEVSTU Desktop, you can delete the <code>cache_t/</code> folder whenever you want to clear cached preview thumbnails.',

    'Bản Standard (Miễn phí) của DEVSTU không yêu cầu tạo tài khoản và không thu phí. Bạn có thể tải xuống trực tiếp và kiểm tra độ mượt của phần cứng bằng công cụ đo GPU/CPU trên trang Tải xuống trước khi quyết định nâng cấp.':
      'DEVSTU Standard (Free) requires no account and costs nothing. You can <a href="/tai-xuong/">download it directly</a> and benchmark your GPU/CPU on the Download page before deciding to upgrade.',
    'Chi tiết quyền lợi và giá của từng gói được công bố minh bạch tại trang Bảng giá.':
      'Full plan features and transparent prices are listed on the <a href="/bang-gia/">Pricing</a> page.',
    'Không tính credit theo tấm ảnh: bạn xuất bao nhiêu ảnh tuỳ thích bằng phần cứng máy tính của mình.':
      '<strong>Zero per-photo export credits:</strong> export as many photos as you want using your own PC hardware.',
    'Mỗi lần mua là một lần thanh toán duy nhất. DEVSTU không tự gia hạn, không tự trừ tiền; với gói 1 năm (365 ngày), khi hết hạn ứng dụng quay về bản Standard và ảnh của bạn vẫn nằm nguyên trên máy.':
      'Each purchase is a single payment. DEVSTU <strong>never auto-renews or auto-charges</strong>; when a 1-Year (365-day) license expires, the app simply returns to Standard and your local photos remain untouched.',
    'Liên hệ đăng ký gói Pro · STU Ultra hoặc Studio Max qua email chính thức ducdoan04.work@gmail.com để nhận hướng dẫn chuyển khoản ngân hàng / mã VietQR và kích hoạt bản quyền.':
      'Contact <a href="mailto:ducdoan04.work@gmail.com">ducdoan04.work@gmail.com</a> to purchase Pro · STU Ultra or Studio Max, receive bank transfer / VietQR instructions, and activate your license.',
    'Nếu chuyển sai nội dung, sai số tiền hoặc chưa nhận được xác nhận kích hoạt sau khi chuyển khoản, hãy gửi kèm ảnh biên lai tới ducdoan04.work@gmail.com để được kiểm tra và hỗ trợ ngay.':
      'If you transferred with the wrong memo/amount or have not received activation confirmation, email your transfer receipt to <a href="mailto:ducdoan04.work@gmail.com">ducdoan04.work@gmail.com</a> for prompt assistance.',
    'Chúng tôi khuyến khích bạn tải bản Standard và chạy thử công cụ Kiểm tra máy này trước khi nâng cấp. Trong trường hợp đã thanh toán:':
      'We encourage trying the free Standard edition and running <a href="/tai-xuong/#cau-hinh">Benchmark this PC</a> before upgrading. After purchase:',
    'Hoàn tiền 100% trong vòng 7 ngày nếu ứng dụng DEVSTU không thể khởi chạy hoặc phát sinh lỗi nghiêm trọng trên máy tính đáp ứng cấu hình tối thiểu mà đội ngũ kỹ thuật không thể khắc phục.':
      '<strong>100% refund within 7 days</strong> if DEVSTU fails to launch or suffers a critical issue on a PC meeting minimum specs that our technical team cannot resolve.',
    'Để gửi yêu cầu, vui lòng viết email tới ducdoan04.work@gmail.com, ghi rõ:':
      'To request a refund, please email <a href="mailto:ducdoan04.work@gmail.com">ducdoan04.work@gmail.com</a> with:',
    'DEVSTU chỉ tiếp nhận yêu cầu kích hoạt và hỗ trợ qua địa chỉ chính thức ducdoan04.work@gmail.com và liên kết tải tại website này. Nếu phát hiện kênh giả mạo, vui lòng báo ngay cho chúng tôi.':
      'DEVSTU only handles license activation and support via our official email <a href="mailto:ducdoan04.work@gmail.com">ducdoan04.work@gmail.com</a> and official links on this site. Please report any impersonation immediately.',
    'Mọi câu hỏi về thanh toán và hoá đơn studio: ducdoan04.work@gmail.com.':
      'Questions about payments or studio invoices: <a href="mailto:ducdoan04.work@gmail.com">ducdoan04.work@gmail.com</a>.',

    'DEVSTU Desktop Suite được xây dựng trên nền nhiều thư viện mã nguồn mở và mô hình AI nghiên cứu uy tín. Xin gửi lời cảm ơn tới cộng đồng các tác giả. Toàn văn giấy phép được lưu kèm trong thư mục LICENSES/ của bộ cài ứng dụng.':
      'DEVSTU Desktop Suite is built on respected open-source libraries and research AI models. We thank all original authors. Full license texts are bundled inside the <code>LICENSES/</code> folder of the installer.',
    '6 mô hình U-Net Skin AI (da-retouch-v1, ranh-cuoi-v1, tao-khoi-v1, da-than-v1, ao-retouch-v1, toc-retouch-v1)':
      '6 U-Net Skin AI Models (<code>da-retouch-v1</code>, <code>ranh-cuoi-v1</code>, <code>tao-khoi-v1</code>, <code>da-than-v1</code>, <code>ao-retouch-v1</code>, <code>toc-retouch-v1</code>)',
    'Các thư viện LGPL được nạp độc lập dưới dạng mô-đun .wasm mà không sửa đổi mã nguồn gốc; người dùng có quyền thay thế bằng phiên bản tương thích cùng giao diện.':
      'LGPL libraries are loaded dynamically as unmodified <code>.wasm</code> modules; users retain the right to replace them with interface-compatible builds.',
    'Tải trực tiếp file 3D LUT .cube (17×17×17) hoặc lấy link devstu.vercel.app/?m=... để nhập vào DEVSTU, Lightroom, Photoshop & DaVinci.':
      'Download 3D LUT <code>.cube</code> (17×17×17) files directly or grab a <code>devstu.vercel.app/?m=...</code> link for DEVSTU, Lightroom, Photoshop &amp; DaVinci.',

    // Blog article: Facebook color shift mixed-HTML blocks
    'Chỉnh xong trong Photoshop thì màu đẹp, da hồng hào. Lưu ra, đăng lên Facebook hay gửi qua Zalo thì ảnh nhợt hẳn đi, da xám, màu xanh đỏ kém rực. Đây là lỗi rất hay gặp, và trong phần lớn trường hợp không phải do Facebook, mà do hồ sơ màu của file khi được lưu.':
      'Your photo looks vibrant with healthy skin tones in Photoshop, yet once uploaded to Facebook or sent over Zalo it turns <strong>dull, muted, and grayish</strong>. This is a very common issue — and most of the time it is <strong>not Facebook’s fault</strong>, but the color profile saved inside the file.',
    'Mỗi file ảnh có thể kèm một hồ sơ màu (ICC color profile) cho biết các giá trị RGB trong file tương ứng với màu gì. Hai hồ sơ hay gặp nhất:':
      'Every image file can embed an <strong>ICC color profile</strong> telling apps what its RGB numbers actually mean. The two most common profiles are:',
    'sRGB — hệ màu chuẩn của web, điện thoại, Facebook, Zalo và hầu hết trình duyệt.':
      '<strong>sRGB</strong> — the universal standard for the web, smartphones, Facebook, Zalo, and most browsers.',
    'Adobe RGB (và ProPhoto RGB, Display P3) — dải màu rộng hơn, thường là mặc định khi mở ảnh RAW trong Camera Raw hoặc Photoshop.':
      '<strong>Adobe RGB</strong> (plus <strong>ProPhoto RGB</strong> and <strong>Display P3</strong>) — wider gamuts often set as defaults in Camera Raw or Photoshop.',
    'Photoshop và DEVSTU đọc đúng hồ sơ màu, nên ảnh Adobe RGB vẫn hiện rực rỡ trong phần mềm. Nhưng nhiều nền tảng mạng xã hội hoặc trình xem ảnh bỏ qua hồ sơ màu và hiểu mọi giá trị như sRGB. Cùng một con số RGB, đọc theo sRGB thì độ bão hoà thấp hơn — khiến ảnh trông nhợt và da xám đi rõ rệt.':
      'Photoshop and DEVSTU <strong>read color profiles properly</strong>, so Adobe RGB images look vivid inside them. However, many social platforms and viewers <strong>strip or ignore the profile</strong> and interpret raw numbers as sRGB — making the same numbers appear dull and desaturated.',
    'Ảnh để Adobe RGB / ProPhoto RGB mà không chuyển sang sRGB khi xuất.':
      '<strong>Exporting in Adobe RGB / ProPhoto RGB without converting to sRGB.</strong>',
    'Lưu mà bỏ tích "Embed Color Profile" — file mất thẻ hồ sơ, mọi nơi đều đọc như sRGB kể cả trên máy của bạn.':
      '<strong>Unchecking "Embed Color Profile"</strong> — the file loses its tag and every viewer reads it as sRGB.',
    'Máy ảnh để chế độ Adobe RGB, dùng thẳng file JPEG: máy ảnh chỉ ghi nhãn trong EXIF (Uncalibrated) mà không nhúng hồ sơ ICC.':
      '<strong>Camera set to Adobe RGB using straight-out-of-camera JPEGs:</strong> cameras only flag EXIF as Uncalibrated without embedding an ICC profile.',
    'Nhúng nhầm hồ sơ màu của màn hình (file hồ sơ do thiết bị cân màu tạo ra) thay vì hồ sơ chuẩn sRGB.':
      '<strong>Accidentally embedding your monitor calibration profile</strong> instead of standard sRGB.',
    'Ảnh để CMYK (bản chuẩn bị in) đem đăng trực tiếp lên mạng xã hội.':
      '<strong>Uploading CMYK print files</strong> directly to social media.',
    'Cách chắc chắn nhất: trước khi lưu, vào Edit → Convert to Profile…, ở Destination Space chọn sRGB IEC61966-2.1, Intent để Relative Colorimetric, tích Use Black Point Compensation, bấm OK.':
      '<strong>Most reliable method:</strong> before saving, go to <strong>Edit → Convert to Profile…</strong>, set <strong>Destination Space</strong> to <strong>sRGB IEC61966-2.1</strong>, Intent to <strong>Relative Colorimetric</strong>, check <strong>Use Black Point Compensation</strong>, and click OK.',
    'Lưu ý: luôn dùng Convert to Profile, không dùng Assign Profile. Assign chỉ đổi nhãn hồ sơ mà không tính lại giá trị pixel — màu sẽ bị lệch ngay lập tức.':
      'Note: always use <strong>Convert to Profile</strong>, never <strong>Assign Profile</strong>. Assign only renames the tag without recalculating pixel values — causing immediate color shifts.',
    'File → Export → Export As…: tích Convert to sRGB và Embed Color Profile.':
      '<strong>File → Export → Export As…</strong>: check both <strong>Convert to sRGB</strong> and <strong>Embed Color Profile</strong>.',
    'Save for Web (Legacy): tích Convert to sRGB và Embed Color Profile.':
      '<strong>Save for Web (Legacy)</strong>: check <strong>Convert to sRGB</strong> and <strong>Embed Color Profile</strong>.',
    'Save As / Save a Copy → JPEG: tích Embed Color Profile: sRGB IEC61966-2.1 (trên Windows là ô ICC Profile).':
      '<strong>Save As / Save a Copy → JPEG</strong>: check <strong>Embed Color Profile: sRGB IEC61966-2.1</strong> (labeled <strong>ICC Profile</strong> on Windows).',
    'Nếu bạn chủ yếu chỉnh ảnh để đăng mạng và giao khách xem điện thoại, có thể đặt luôn hệ màu làm việc là sRGB: Edit → Color Settings → Working Spaces → RGB: sRGB IEC61966-2.1.':
      'If you edit mainly for web and mobile delivery, set your working space directly to sRGB: <strong>Edit → Color Settings → Working Spaces → RGB: sRGB IEC61966-2.1</strong>.',
    'Camera Raw: bấm vào dòng thông số ở giữa mép dưới cửa sổ (dạng "Adobe RGB (1998) – 16 bit – …") để mở Workflow Options. Chọn Color Space: sRGB IEC61966-2.1, Bit Depth: 8 bits/channel nếu ảnh chỉ để đăng web. Nếu muốn giữ 16-bit dải rộng để retouch tiếp thì nhớ đổi sang sRGB ở bước xuất cuối cùng.':
      '<strong>Camera Raw:</strong> click the workflow link at the bottom center (e.g., "Adobe RGB (1998) – 16 bit – …") to open <strong>Workflow Options</strong>. Choose <strong>Color Space: sRGB IEC61966-2.1</strong> and <strong>8 bits/channel</strong> for web delivery. If you keep 16-bit wide gamut for retouching, convert to sRGB on final export.',
    'Lightroom Classic: trong hộp thoại Export, mục File Settings, chọn Color Space: sRGB.':
      '<strong>Lightroom Classic:</strong> in the <strong>Export</strong> dialog under <strong>File Settings</strong>, choose <strong>Color Space: sRGB</strong>.',
    'DEVSTU Desktop: toàn bộ pipeline chỉnh màu xử lý bên trong không gian màu đồng nhất Oklab / OKLCH để bảo toàn sắc da, và tự động ánh xạ chuẩn về sRGB khi xuất JPEG/PNG nên ảnh đăng Facebook, Zalo giữ nguyên độ tươi và tông da như lúc chỉnh.':
      '<strong>DEVSTU Desktop:</strong> the entire color pipeline processes internally in perceptual <strong>Oklab / OKLCH</strong> to protect skin tones and automatically maps cleanly to <strong>sRGB</strong> on JPEG/PNG export — so Facebook and Zalo uploads match your screen.',
    'Kể cả khi file đã chuẩn sRGB, Facebook vẫn nén lại JPEG và tự thu nhỏ ảnh độ phân giải quá lớn. Để ảnh giữ độ nét tốt nhất:':
      'Even with proper sRGB files, Facebook still <strong>recompresses JPEGs</strong> and <strong>downscales</strong> oversized photos. For sharpest results:',
    'Xuất cạnh dài đúng 2048 px (Facebook giữ nguyên kích thước này, không tự resize lại).':
      'Export with a long edge of exactly <strong>2048 px</strong> (Facebook preserves this dimension without resizing).',
    'Xuất JPEG chất lượng cao (khoảng 85–92%), tránh nén quá thấp trước khi đăng.':
      'Export high-quality JPEG (around <strong>85–92%</strong>) instead of over-compressing beforehand.',
    'Khi đăng từ điện thoại, bật tuỳ chọn tải ảnh chất lượng cao (HD) trong cài đặt ứng dụng Facebook.':
      'When uploading from mobile, enable <strong>Upload photos in HD</strong> in the Facebook app settings.',
    'Nếu file đã chuẩn sRGB và đúng 2048 px nhưng vẫn thấy hơi khác trên máy khác, nguyên nhân thường nằm ở màn hình người xem: màn hình chưa cân màu, điện thoại đang bật Night Shift / True Tone / chế độ bảo vệ mắt, hoặc độ sáng màn hình khác nhau. Không file nào sửa được cài đặt màn hình người xem — việc quan trọng nhất là xuất đúng chuẩn sRGB để ảnh hiển thị đồng đều nhất ở mọi nơi.':
      'If a proper 2048 px sRGB file still looks slightly different on another device, the cause is usually the <strong>viewer’s screen</strong>: uncalibrated displays, active <strong>Night Shift / True Tone / eye-comfort modes</strong>, or brightness differences. No file can override a viewer’s display settings — exporting clean <strong>sRGB</strong> gives the most consistent result everywhere.',
    'Với máy tính làm việc của bạn, nên cân màu màn hình bằng thiết bị đo màu để màu sắc lúc retouch luôn chính xác.':
      'On your own editing workstation, <strong>calibrate your monitor with a hardware colorimeter</strong> so what you see while retouching is trustworthy.',
    'Kéo hoặc chọn ảnh JPEG/PNG đã xuất vào khung dưới đây để kiểm tra trực tiếp ICC Profile, phát hiện ảnh đang ở Adobe RGB / Display P3 / CMYK hoặc vượt cỡ 2048 px, và xuất nhanh bản chuẩn sRGB. Ảnh xử lý 100% trên trình duyệt của bạn, không tải lên bất kỳ máy chủ nào.':
      'Drop or choose your exported JPEG/PNG below to inspect its <strong>ICC Profile</strong> directly, detect Adobe RGB / Display P3 / CMYK or oversized dimensions above 2048 px, and export a clean <strong>sRGB</strong> copy. <strong>100% processed locally in your browser — zero server uploads.</strong>'
  };

  // Exact text-node dictionary covering every page
  var TEXT_MAP = {
    // Navigation & Chrome
    'Bỏ qua, tới nội dung chính': 'Skip to main content',
    'Tính năng': 'Features',
    'AI Retouch': 'AI Retouch',
    'Bảng giá': 'Pricing',
    'Tải xuống': 'Download',
    'Giới thiệu': 'About',
    'Chính sách': 'Privacy',
    'Tải app': 'Download',
    'Ngôn ngữ': 'Language',
    'Phát triển bởi': 'Built by',
    'Tiếng Việt · Đà Nẵng, Việt Nam': 'English · Da Nang, Vietnam',
    'Làm đẹp da AI': 'AI Skin Retouch',
    'Cách dùng': 'How it works',
    'Công nghệ AI': 'AI Technology',
    'LaMa Xoá vật thể': 'LaMa Object Erase',
    'Depth Anything v2 Bokeh': 'Depth Anything v2 Bokeh',
    'U-Net Skin AI & STU Ultra': 'U-Net Skin AI & STU Ultra',
    'Kiến trúc Rust + WebGPU': 'Rust + WebGPU Architecture',
    'Kiểm tra cấu hình máy': 'Check your hardware',
    'Thông tin': 'Information',
    'Giới thiệu DEVSTU': 'About DEVSTU',
    'Chính sách bảo mật': 'Privacy Policy',
    'Điều khoản sử dụng': 'Terms of Use',
    'Chính sách cookie': 'Cookie Policy',
    'Thanh toán và hoàn tiền': 'Payment & Refunds',
    'Giấy phép phần mềm': 'Software License',
    'Cài đặt cookie': 'Cookie Settings',
    'Điều khoản & Giấy phép': 'Terms & License',
    'Câu hỏi thường gặp': 'FAQ',
    'Liên hệ': 'Contact',
    'Tác giả: ducdoan-04': 'Author: ducdoan-04',
    'Hỗ trợ cài đặt Windows': 'Windows Setup Support',
    '© 2026 DEVSTU. Ảnh của bạn luôn được xử lý cục bộ trên thiết bị của bạn.':
      '© 2026 DEVSTU. Your photos are always processed locally on your device.',
    '© 2026 DEVSTU. Ảnh của bạn luôn được xử lý cục bộ trên thiết bị của bạn. Lightroom là thương hiệu của Adobe, Evoto là thương hiệu của chủ sở hữu Evoto; DEVSTU hoạt động độc lập và không liên kết với các hãng này.':
      '© 2026 DEVSTU. Your photos are always processed locally on your device. Lightroom is a trademark of Adobe and Evoto is a trademark of its respective owner; DEVSTU is independent and not affiliated with them.',

    // Homepage — Hero
    'Chỉnh ảnh hàng loạt,': 'Batch photo editing,',
    'retouch studio bằng AI.': 'studio retouching with AI.',
    'Lọc ảnh hỏng, làm đẹp da mặt & cơ thể bằng AI U-Net, 111 bộ màu thông minh, chế độ STU Ultra Max Rust SIMD & WebGPU. Ảnh xử lý 100% trên máy bạn.':
      'Smart culling, face & body U-Net AI skin retouching, 111 smart color looks, STU Ultra Max Rust SIMD & WebGPU. 100% on-device processing.',
    'Tải app DEVSTU': 'Download DEVSTU',
    'Xem bảng giá': 'View pricing',
    'Ứng dụng Desktop Tauri v2 cho Windows 10, 11 (Rust Embedded Server + WebGPU). Chạy offline hoàn toàn, không tốn credit theo tấm, ảnh không rời máy.':
      'Desktop Tauri v2 app for Windows 10 & 11 (Rust Embedded Server + WebGPU). Fully offline, zero per-photo credits, your photos never leave your PC.',
    'Đơn giản': 'Simple',
    'Xuất ảnh': 'Export',
    'Ảnh gốc': 'Original',
    'Sau khi chỉnh': 'Edited',
    'Ảnh 1 / 8': 'Photo 1 / 8',
    'So sánh': 'Compare',
    'Máy đã chỉnh giúp': 'Auto-edited for you',
    'Chỉnh giúp tôi': 'Auto-edit for me',
    'Cân bằng sáng, màu Oklab và làm đẹp da tức thì. Bấm lại để về gốc.':
      'Instant exposure balance, Oklab color & AI skin retouch. Click again to revert.',
    'Bộ màu DEVSTU Studio': 'DEVSTU Studio Looks',
    '111 bộ': '111 looks',
    'Chiều muộn ấm nắng': 'Golden Sunset',
    'Hàn Quốc sáng': 'Korean Bright',
    'Cổ điển': 'Classic Film',
    'Trong trẻo': 'Clean Crisp',
    'Giữ màu gốc': 'Keep original color',
    'Sáng và màu Oklab': 'Oklab Light & Color',
    'Độ sáng': 'Exposure',
    'Màu ấm lạnh': 'White Balance',
    'Tương phản': 'Contrast',
    'sáng hơn nhẹ': 'slightly brighter',
    'cân bằng tự nhiên': 'natural balance',
    'rõ chi tiết': 'crisp detail',
    '8 ảnh · đã chỉnh 1': '8 photos · 1 edited',
    'Đồng bộ sang 7 ảnh': 'Sync to 7 photos',
    'Bấm thử ngay trên khung app: kéo đường so sánh, đổi 4 bộ màu, rồi bấm Đồng bộ cả buổi chụp.':
      'Try right in the preview: drag the comparison slider, switch 4 color looks, then click Sync to apply across the whole shoot.',
    'Mô phỏng trực tiếp luồng chỉnh màu Oklab & đồng bộ hàng loạt trên DEVSTU Desktop Suite.':
      'Interactive simulation of Oklab color grading & batch sync inside DEVSTU Desktop Suite.',

    // Homepage — Section 2 (AI Skin)
    'Làm đẹp da mặt AI (da-retouch-v1)': 'AI Face Skin Retouch (da-retouch-v1)',
    'Kéo thử thanh từ 0 tới 100 để xem khả năng giữ lỗ chân lông và nét mắt, môi, tóc nguyên bản.':
      'Drag from 0 to 100 to see how pore texture, eyes, lips, and hair stay naturally crisp.',
    'Làm đẹp da mặt & cơ thể bằng bộ 6 mô hình U-Net AI.':
      'Face & body retouching with 6 dedicated U-Net AI models.',
    'Kéo từng thanh độc lập 0–100: tự nhiên cho ảnh phóng sự hoặc chuẩn beauty studio':
      'Independent 0–100 sliders: natural for documentary shoots or polished for beauty studios',
    'Bảo toàn 100% chi tiết mắt, hàng mi, môi, sợi tóc nhờ phân vùng MediaPipe 478 điểm':
      'Preserves 100% of eye, eyelash, lip, and hair detail via 478-point MediaPipe segmentation',
    'Chạy hoàn toàn offline qua ONNX Runtime WebGPU & Rust SIMD, không cần internet':
      'Runs 100% offline via ONNX Runtime WebGPU & Rust SIMD — no internet required',
    'Tối ưu phần cứng WebGPU & WASM SIMD trên Desktop': 'Hardware-accelerated WebGPU & WASM SIMD on Desktop',
    'Tải DEVSTU cho Windows': 'Download DEVSTU for Windows',

    // Homepage — Section 3 (Culling)
    'Lọc ảnh hàng loạt trong vài phút.': 'Cull an entire shoot in minutes.',
    'Kéo cả thư mục buổi chụp vào DEVSTU. Hệ thống tự phân tích và đánh dấu tấm trùng, nhoè, rung tay, nét trượt, quá sáng và người nhắm mắt để bạn duyệt nhanh nhất.':
      'Drop an entire shoot folder into DEVSTU. AI automatically flags duplicates, motion blur, missed focus, overexposure, and closed eyes for rapid review.',
    '· 8 tấm mẫu · AI phát hiện 3 tấm lỗi': '· 8 sample photos · AI flagged 3 issues',
    'Tất cả (8)': 'All (8)',
    'Ảnh đạt (5)': 'Keepers (5)',
    'Đánh dấu lỗi (3)': 'Flagged (3)',
    'Nét mắt OK': 'Eye Sharp',
    'Rung / Nhoè': 'Motion Blur',
    'Quá sáng': 'Overexposed',
    'Đạt chuẩn': 'Keeper',
    'Trùng loạt': 'Duplicate',
    'Ảnh trùng trong loạt chụp': 'Burst duplicates',
    'Nhoè, rung tay': 'Blur & camera shake',
    'Nét trượt khỏi mặt': 'Missed face focus',
    'Quá sáng / quá tối': 'Over / underexposed',
    'Người nhắm mắt': 'Closed eyes',
    'Đánh sao 1–5 bằng phím số': '1–5 star rating hotkeys',
    'Máy chỉ gắn thẻ gợi ý, quyết định giữ hay xoá hoàn toàn thuộc về bạn. Hỗ trợ giữ nguyên xếp hạng sao khi mở từ Lightroom hoặc Bridge.':
      'AI only suggests flags — you always decide what to keep or discard. Preserves star ratings when opening folders from Lightroom or Bridge.',

    // Homepage — Section 4 (Portrait & STU Ultra)
    'Retouch chân dung tự động & STU Ultra.': 'Auto portrait retouching & STU Ultra.',
    'MediaPipe Face Mesh 478 điểm kết hợp Rust SIMD Engine giúp khoanh mụn, tách tần số (Frequency Separation), đánh khối 3D Dodge & Burn và trang điểm nhẹ chỉ bằng vài thanh kéo.':
      '478-point MediaPipe Face Mesh paired with the Rust SIMD Engine handles blemish removal, Frequency Separation, 3D Dodge & Burn, and subtle makeup with effortless sliders.',
    'Chỉnh da & khuôn mặt': 'Skin & Face Retouch',
    'Xoá mụn, đốm tàn nhang, bóng dầu': 'Remove blemishes, spots & oily shine',
    'Tách tần số giữ vân da tự nhiên': 'Frequency separation keeping natural pores',
    'Mờ quầng thâm, bọng mắt, rãnh cười': 'Soften dark circles, eye bags & smile lines',
    'Đánh khối 3D & Dodge & Burn': '3D contouring & Dodge & Burn',
    'STU Ultra & Salon AI': 'STU Ultra & Salon AI',
    'Bóp mặt V-line, thon mũi, nâng gò má': 'V-line jaw, nose slimming & cheek lift',
    'Sáng mắt, giảm tia đỏ, trắng răng': 'Brighten eyes, reduce redness & whiten teeth',
    'Gọn tóc con & 13 màu nhuộm tóc Salon': 'Stray-hair cleanup & 13 Salon hair dyes',
    'Làm phẳng nếp nhăn quần áo, sạch phông': 'De-wrinkle clothing & clean studio backdrops',
    'Sau retouch': 'Retouched',
    'Tự cân sáng, làm đều sắc da, tách tần số giữ chi tiết và làm sáng vùng mắt tự nhiên.':
      'Auto-balanced lighting, even skin tone, texture-safe frequency separation, and natural eye brightening.',
    'Chỉnh khuôn mặt & Dodge/Burn': 'Face Sculpt & Dodge/Burn',
    'Định vị 478 mốc giải phẫu khuôn mặt để chỉnh nhẹ mắt, mũi, hàm, nụ cười mà vẫn giữ đúng thần thái.':
      'Tracks 478 anatomical landmarks to refine eyes, nose, jawline, and smile while keeping natural expression.',
    'Xóa phông Depth Anything v2': 'Depth Anything v2 Bokeh',
    'Tách chủ thể 1024×1024 giữ từng sợi tóc kết hợp bản đồ độ sâu trường ảnh để tạo bokeh mượt như ống kính khẩu lớn.':
      '1024×1024 hair-accurate subject matting paired with depth maps for creamy fast-aperture optical bokeh.',
    'Nhuộm tóc Salon AI & Gọn tóc con': 'AI Salon Hair Dye & Flyaway Fix',
    '13 tone màu nhuộm salon (Trà lạnh, Nâu tây, Hồng Sakura, Xanh đen...) tự bám vùng tóc, giữ bóng mượt tự nhiên.':
      '13 salon hair shades (Cold Tea, Ash Brown, Sakura Pink, Midnight Blue...) conforming naturally to hair shine.',

    // Homepage — Section 5 (Smart Presets)
    'Gợi ý cho tấm này': 'Suggested for this shot',
    '111 bộ màu': '111 color looks',
    'Chiều muộn': 'Golden Sunset',
    '98% hợp': '98% match',
    '95% hợp': '95% match',
    'Film cổ điển': 'Classic Film',
    '92% hợp': '92% match',
    '96% hợp': '96% match',
    'Không gian màu Oklab / OKLCH': 'Oklab / OKLCH Color Space',
    'Hỗ trợ .XMP · .CUBE': 'Supports .XMP · .CUBE',
    'Preset thông minh, mô phỏng màu mẫu chuẩn xác.': 'Smart presets & accurate reference color matching.',
    'Hệ thống phân tích ánh sáng, sắc da và độ tương phản từng ảnh trong không gian màu Oklab / OKLCH, đề xuất ngay bộ màu hợp nhất trong 111 LUT tích hợp và cho phép học màu từ ảnh mẫu (Color Match AI).':
      'Analyzes lighting, skin tone, and contrast per photo in Oklab / OKLCH color space, recommends the best match from 111 built-in LUTs, and transfers color from any reference photo (Color Match AI).',
    '111 bộ màu & LK Color Ref': '111 Looks & LK Color Ref',
    'Đủ phong cách ảnh cưới, studio trắng/đen, ngoại cảnh, áo dài, bầu nghệ thuật và film điện ảnh.':
      'Covers weddings, B&W studio, outdoor, Ao Dai, maternity, and cinematic film grades.',
    'Tự thích ứng ánh sáng': 'Adaptive lighting match',
    'Cân bằng trắng (Temp/Tint) và phơi sáng theo từng khung hình để cả buổi chụp ra cùng một chất màu.':
      'Adapts white balance (Temp/Tint) and exposure per frame so the entire shoot shares one cohesive look.',
    'Bảo vệ sắc da tự nhiên': 'Natural skin-tone protection',
    'Đổi tông nền xanh lá, bầu trời, kiến trúc mà da chủ thể vẫn giữ sắc hồng hào chân thật.':
      'Shift foliage, sky, and architecture hues while keeping subject skin tones clean and true-to-life.',
    'Nhập Preset Lightroom & LUT': 'Import Lightroom Presets & LUTs',
    'Cùng một tấm ảnh với 4 bộ màu tiêu biểu:': 'The same photo graded with 4 signature looks:',
    'Nhập link bộ màu': 'Open a look link',
    'Xem bộ màu': 'Preview look',
    'Thử nhanh link mẫu:': 'Try a sample link:',
    'Kho 8 LUT miễn phí (.CUBE & Link ?m=)': '8 Free 3D LUTs (.CUBE & ?m= Links)',
    'Chân dung': 'Portrait',
    'Cưới & Ngoại cảnh': 'Wedding & Outdoor',
    'Film & Đen trắng': 'Film & B&W',
    'Chiều ấm nắng': 'Warm Afternoon',
    'Nắng vàng dịu nhẹ, giữ sắc da ấm tự nhiên cho ảnh cưới & ngoại cảnh hoàng hôn.':
      'Soft golden sunlight preserving warm natural skin tones for weddings & sunset shoots.',
    'Tương phản mềm, trong sáng, bảo vệ sắc da mịn nhẹ chuẩn studio Hàn Quốc.':
      'Soft airy contrast with delicate skin-tone protection in Korean studio style.',
    'Da trắng hồng': 'Bright Rosy Skin',
    'Nâng sáng da nhẹ nhàng, thêm ánh hồng tươi tắn cho chân dung & beauty.':
      'Gentle skin lift with a fresh rosy glow for portraits & beauty shoots.',
    'Cưới nhẹ nhàng': 'Soft Wedding',
    'Tông sáng thanh lịch, giảm gắt vùng tối, hợp phóng sự cưới & váy trắng.':
      'Clean bright tone with lifted shadows tailored for wedding documentary & white gowns.',
    'Độ bão hoà trầm ấm, vùng tối nâng nhẹ như chất film màu hoài cổ.':
      'Warm muted saturation and lifted blacks inspired by classic analog color film.',
    'Màu sắc trung thực, độ nổi khối rõ ràng, phù hợp đa số buổi chụp ban ngày.':
      'True-to-life color with crisp depth, versatile across daylight sessions.',
    'Biển xanh': 'Blue Sea',
    'Đẩy sắc lam ngọc mặt biển và bầu trời mà vẫn bảo toàn sắc da tự nhiên.':
      'Enhances turquoise ocean and sky tones while keeping skin tones clean and natural.',
    'Đen trắng mềm': 'Soft B&W',
    'Chuyển sắc xám mượt theo kênh da, giàu cảm xúc cho chân dung nghệ thuật.':
      'Smooth skin-weighted monochrome tones for expressive fine-art portraits.',
    'Tải .CUBE': 'Get .CUBE',
    'Link ?m=': '?m= Link',

    // Homepage — Section 6 (Batch Sync)
    'Chỉnh một tấm, cả buổi đẹp theo.': 'Edit one photo, sync the entire shoot.',
    'Đồng bộ toàn bộ thông số màu, làm đẹp da AI, thay phông và cắt khung sang hàng trăm ảnh chỉ bằng một cú bấm. Mỗi tấm vẫn tự bù sáng riêng theo điều kiện chụp thực tế.':
      'Sync color grading, AI skin retouching, backdrop replacement, and crop across hundreds of photos in one click — while each frame auto-compensates for its own exposure.',
    'Bấm vào từng tấm ảnh để bật / tắt chỉnh sửa.': 'Click any photo below to toggle its edit on or off.',
    'Công thức AI theo 10 thể loại ảnh, một chạm': 'One-tap AI recipes for 10 photography genres',
    'Cưới': 'Wedding',
    'Kỷ yếu': 'Yearbook',
    'Studio': 'Studio',
    'Ngoại cảnh': 'Outdoor',
    'Sản phẩm': 'Product',
    'Phong cảnh': 'Landscape',
    'Đường phố': 'Street',
    'Newborn': 'Newborn',
    'Trẻ em': 'Kids',
    'Gia đình': 'Family',
    'Khớp sáng và sắc độ cả loạt theo một tấm mẫu': 'Match exposure & color across a whole batch from one key frame',
    'Phân loại đối tượng AI (Nữ, Nam, Trẻ em, Người lớn tuổi)': 'AI subject grouping (Female, Male, Kids, Seniors)',
    'Thay phông ảnh thẻ / Studio 1 chạm (LK model_29 + BGFusion)': '1-click ID / Studio backdrop replacement (LK model_29 + BGFusion)',
    'Xuất hàng loạt tốc độ cao (JPEG, PNG, TIFF 16-bit), đóng logo': 'High-speed batch export (JPEG, PNG, 16-bit TIFF) with watermark',
    'Nhớ bộ ảnh làm việc gần đây ngay trên ổ cứng Desktop': 'Remembers recent local desktop sessions automatically',

    // Homepage — Section 7 (Pro Toolkit & 4-in-1 AI Tools)
    'Đủ công cụ như Lightroom & Evoto.': 'Complete pro toolkit — Lightroom-grade & Evoto.',
    'Từ chế độ Đơn giản cho người mới tới Pro, God Mode và STU Ultra Max chạy nhân Rust SIMD & Evoto cho studio ảnh chuyên nghiệp.':
      'Scale smoothly from Simple mode for beginners to Pro, God Mode, and STU Ultra Max powered by Rust SIMD & Evoto for commercial studios.',
    'Sáng tối & Cân trắng': 'Light & White Balance',
    'Phơi sáng (Exposure)': 'Exposure',
    'Vùng sáng (Highlights)': 'Highlights',
    'Vùng tối (Shadows)': 'Shadows',
    'Nhiệt độ màu (Temp)': 'Color Temp',
    'HSL 8 kênh màu': '8-Channel HSL',
    'Sắc da (Cam · Độ sáng)': 'Skin Tone (Orange · Lum)',
    'Tán lá (Xanh lá · Sắc độ)': 'Foliage (Green · Hue)',
    'Mịn da giữ lỗ chân lông': 'Texture-Safe Skin Smooth',
    'Xoá mụn & vết thâm': 'Blemish & Spot Removal',
    'Đánh khối 3D Dodge & Burn': '3D Dodge & Burn',
    'Mờ rãnh cười & quầng thâm': 'Smile Lines & Dark Circles',
    'Nền, Quần áo & Khử nhiễu': 'Backdrop, Clothing & Denoise',
    'Làm phẳng nếp nhăn áo': 'Clothing De-wrinkle',
    'Xóa phông Depth v2': 'Depth v2 Bokeh',
    'Khử nhiễu SCUNet AI': 'SCUNet AI Denoise',
    'Cuộn cột công cụ bên phải để xem thêm': 'Scroll the right inspector panel to see more tools',
    'Sáng & màu Oklab': 'Oklab Light & Color',
    'Phơi sáng, tương phản, vùng sáng/tối': 'Exposure, contrast, highlights & shadows',
    'Nhiệt độ màu Kelvin, ống hút cân trắng': 'Kelvin temperature & white-balance eyedropper',
    'Độ tươi (Vibrance) & bão hoà màu': 'Perceptual vibrance & saturation',
    'Khử sương mù (Dehaze), Clarity': 'Dehaze & local clarity',
    'Màu nâng cao': 'Advanced Color',
    'Đường cong RGB & từng kênh Đỏ/Lục/Lam': 'RGB & individual Red/Green/Blue tone curves',
    'HSL 8 dải màu độc lập': '8 independent HSL color channels',
    'Color Grading 3 vùng sáng/giữa/tối': '3-way Color Grading (Shadows/Midtones/Highlights)',
    'Mô phỏng màu ảnh mẫu (Color Match)': 'Reference photo Color Match AI',
    'Chi tiết & Ống kính': 'Detail & Optics',
    'Khử nhiễu ISO cao SCUNet AI': 'SCUNet AI high-ISO denoising',
    'Tăng nét thông minh, tạo hạt Film': 'Smart sharpening & organic film grain',
    'Sửa méo ống kính, xoá viền tím': 'Lens distortion & chromatic aberration fix',
    'Cắt bố cục, căn thẳng trục mắt tự động': 'Crop & auto eye-level straightening',
    'Mặt nạ AI & Cục bộ': 'AI Masking & Local',
    'BiRefNet tách chủ thể 1024px giữ sợi tóc': 'BiRefNet 1024px hair-accurate subject cutout',
    'Mặt nạ tự động: người, da, tóc, trời, cỏ, nước': 'Auto masks: person, skin, hair, sky, foliage, water',
    'Thay phông ảnh thẻ / studio (model_29)': 'Studio & ID backdrop swap (model_29)',
    'Cọ Dodge & Burn, tách tần số God Mode': 'Dodge & Burn & Frequency Separation God Mode',
    'Xoá vật thể (LaMa)': 'Object Erase (LaMa)',
    'Xoá phông (Depth v2)': 'AI Bokeh (Depth v2)',
    'Thay trời AI': 'AI Sky Swap',
    'Màu mặt nước': 'Water Tone AI',
    'Trước': 'Before',
    'Sau AI': 'After AI',
    'LaMa Inpainting 512×512: Tô lên vật thừa, AI tái tạo nền cát và sóng biển liền mạch ngay trên máy.':
      'LaMa Inpainting 512×512: Paint over unwanted objects and AI seamlessly reconstructs sand and ocean waves on-device.',
    'Xoá vật thể, xoá phông, thay trời & chỉnh nước AI.': 'AI object erase, bokeh, sky swap & water grading.',
    'Giải mã RAW 16-bit & HEIC gốc': 'Native 16-bit RAW & HEIC decoding',
    'God Mode & STU Ultra Max cho retoucher': 'God Mode & STU Ultra Max for high-end retouchers',
    'Cọ vá da tách tần số, cọ đánh khối theo vùng sáng tối, bút Wacom có lực ấn, lớp màu Selective Color / Gradient Map và toàn bộ pipeline Rust SIMD siêu tốc.':
      'Frequency separation healing brush, luminance-aware Dodge & Burn, pressure-sensitive Wacom support, Selective Color / Gradient Map, and the ultra-fast Rust SIMD pipeline.',

    // Homepage — Section 8 (3 Steps)
    'Ba bước là xong cả bộ ảnh.': 'Three steps to finish a full gallery.',
    'Mở ảnh lẻ hoặc cả thư mục RAW': 'Open single photos or an entire RAW folder',
    'Kéo thả hàng trăm ảnh Sony, Canon, Nikon, Fuji, HEIC hoặc JPEG vào DEVSTU. Ảnh hiển thị tức thì nhờ bộ giải mã đa luồng.':
      'Drag and drop hundreds of Sony, Canon, Nikon, Fuji, HEIC, or JPEG files into DEVSTU for instant multi-threaded previews.',
    'Chỉnh 1 tấm & xử lý AI tự động': 'Edit one frame & run on-device AI',
    'Bấm Chỉnh giúp tôi, kéo thanh Làm đẹp da U-Net, chọn 1 trong 111 bộ màu rồi đồng bộ toàn buổi chụp.':
      'Click Auto-edit, dial in U-Net Skin AI, pick from 111 looks, and sync across the entire shoot.',
    'Xuất ảnh độ phân giải cao': 'Export at full resolution',
    'Lưu thẳng vào thư mục trên ổ cứng với định dạng JPEG, PNG hoặc TIFF 16-bit, kèm khung và logo studio.':
      'Save directly to your local drive in JPEG, PNG, or 16-bit TIFF with optional frames and studio watermark.',
    'Xem kiến trúc công nghệ': 'Explore tech architecture',
    'Màn hình hướng dẫn quy trình 3 bước tích hợp ngay trên màn khởi động DEVSTU Desktop.':
      'Built-in 3-step onboarding screen right on the DEVSTU Desktop launch splash.',

    // Homepage — Section 9 (Comparison Table)
    'So với Lightroom và Evoto.': 'Compared with Lightroom & Evoto.',
    'DEVSTU gộp sức mạnh chỉnh màu hàng loạt của Lightroom và retouch AI chân dung của Evoto vào một ứng dụng Desktop chạy offline, không tính credit theo từng tấm ảnh.':
      'DEVSTU combines Lightroom-class batch color grading and Evoto-class AI portrait retouching into one offline desktop app with zero per-photo export credits.',
    'Chi phí xuất ảnh': 'Export cost',
    'Không tính credit theo ảnh': 'Zero per-photo export credits',
    'Thuê bao Adobe hằng tháng': 'Monthly Adobe subscription',
    'Tính credit trên từng tấm xuất ra': 'Charges credits per exported photo',
    'Xử lý AI': 'AI Processing',
    '100% On-Device (WebGPU + Rust SIMD)': '100% On-Device (WebGPU + Rust SIMD)',
    'AI cục bộ / Cloud tuỳ công cụ': 'Local / Cloud depending on tool',
    'Phụ thuộc máy chủ Cloud & mạng': 'Requires Cloud servers & internet',
    'Quyền riêng tư': 'Privacy',
    'Ảnh ở nguyên máy, chạy được khi mất mạng': 'Photos stay on your PC, works offline',
    'Classic giữ máy; bản CC lên mây': 'Classic local; CC syncs to cloud',
    'Tải ảnh lên server để xử lý': 'Uploads photos to remote servers',
    'Retouch chân dung': 'Portrait Retouch',
    '6 mô hình U-Net + STU Ultra + Tóc Salon': '6 U-Net models + STU Ultra + Salon Hair',
    'Cần chuyển sang Photoshop': 'Requires round-tripping to Photoshop',
    'Mạnh, nhưng tốn phí mỗi lần xuất': 'Strong, but paid per exported image',
    'Dung lượng nền': 'Footprint',
    'Nhân Rust Tauri v2 siêu nhẹ (<10MB RAM server)': 'Lightweight Rust Tauri v2 (<10MB RAM server)',
    'Cài bộ Creative Cloud nặng': 'Heavy Creative Cloud installation',
    'App desktop + phụ thuộc mạng': 'Desktop app + network dependent',
    'Hợp với DEVSTU khi': 'Choose DEVSTU when you',
    'Cần lọc ảnh, chỉnh màu RAW và retouch da AI trong cùng một quy trình nhanh.':
      'Need culling, RAW color grading, and AI skin retouching in one fast workflow.',
    'Chụp cưới, kỷ yếu, studio, sự kiện số lượng lớn — không muốn tốn tiền theo từng ảnh.':
      'Shoot high-volume weddings, yearbooks, studio, or events without paying per export.',
    'Muốn xử lý ảnh hoàn toàn offline, bảo mật tuyệt đối dữ liệu khách hàng.':
      'Want 100% offline processing with strict client photo confidentiality.',
    'Vẫn nên dùng Lightroom / Photoshop khi': 'Stick with Lightroom / Photoshop when you',
    'Cần quản lý kho ảnh nhiều năm theo Catalog, bản đồ GPS và từ khoá phức tạp.':
      'Need multi-year DAM catalogs, GPS map views, and complex keyword hierarchies.',
    'Cần ghép đồ hoạ manipulation nhiều layer nâng cao hoặc quy trình in CMYK chuyên biệt.':
      'Need multi-layer graphic compositing or specialized CMYK print prepress workflows.',

    // Homepage — Section 10 (Privacy)
    'Ảnh của bạn không': 'Your photos never',
    'rời khỏi máy.': 'leave your PC.',
    'Mọi phép tính — từ giải mã RAW 16-bit, không gian màu Oklab tới toàn bộ 7 hệ mô hình AI (BiRefNet, LaMa, Depth Anything v2, MediaPipe, MODNet, SCUNet, U-Net Skin AI) — đều chạy trực tiếp trên GPU & CPU của máy bạn.':
      'Every computation — from 16-bit RAW decoding and Oklab color math to all 7 AI model families (BiRefNet, LaMa, Depth Anything v2, MediaPipe, MODNet, SCUNet, U-Net Skin AI) — runs locally on your GPU & CPU.',
    'Định dạng hỗ trợ': 'Supported formats',
    'JPEG, PNG, HEIC/HEIF (libheif), WebP, TIFF và RAW 16-bit của Sony, Canon, Nikon, Fujifilm, Olympus, Panasonic, DNG (LibRaw).':
      'JPEG, PNG, HEIC/HEIF (libheif), WebP, TIFF, and 16-bit RAW from Sony, Canon, Nikon, Fujifilm, Olympus, Panasonic, and DNG (LibRaw).',
    'Kiến trúc siêu nhẹ': 'Lightweight architecture',
    'Tauri v2 + Rust Embedded Server (<10MB RAM) + Rust SIMD Worker + ONNX Runtime WebGPU / WASM SIMD.':
      'Tauri v2 + Rust Embedded Server (<10MB RAM) + Rust SIMD Worker + ONNX Runtime WebGPU / WASM SIMD.',
    'An toàn tuyệt đối': 'Absolute privacy',
    'Không tải ảnh gốc lên bất kỳ máy chủ bên thứ ba nào. Ngắt kết nối Internet vẫn chỉnh màu và retouch AI đầy đủ.':
      'Never uploads original images to any third-party server. Disconnect from the internet and keep full AI retouching & grading.',

    // Homepage — Section 11 (Pricing preview)
    'Bắt đầu dễ dàng, không phí theo ảnh.': 'Start free, zero per-photo fees.',
    'Miễn phí (Standard)': 'Free (Standard)',
    'Trải nghiệm đầy đủ công cụ cốt lõi': 'Experience all core editing tools',
    'Chỉnh ảnh RAW 16-bit & HEIC trên thiết bị': 'On-device 16-bit RAW & HEIC editing',
    'Sáng tối Oklab, Đường cong RGB, 8 kênh HSL': 'Oklab light/color, RGB curves, 8-channel HSL',
    'Chỉnh giúp tôi & 10 thể loại ảnh một chạm': 'Auto-edit & 10 one-tap genre recipes',
    'Xoá mụn, làm mịn da cơ bản, thêm LUT .cube': 'Basic blemish/skin retouch & .cube LUT import',
    'Tải bản dùng thử': 'Download free edition',
    'Mở khoá trọn bộ AI Offline & không giới hạn xuất ảnh': 'Unlock full Offline AI & unlimited exports',
    'Không giới hạn số lượng ảnh & xuất hàng loạt siêu tốc': 'Unlimited photos & high-speed batch export',
    'Trọn bộ 6 mô hình U-Net Skin AI (Mặt, Rãnh cười, Khối 3D, Cơ thể, Áo, Tóc)': 'All 6 U-Net Skin AI models (Face, Smile Lines, 3D Contour, Body, Clothes, Hair)',
    'Toàn bộ 111 bộ màu Studio & nhập Preset Lightroom (.xmp)': 'All 111 Studio Looks & Lightroom (.xmp) preset import',
    'BiRefNet 1024px, LaMa Xoá vật thể, Depth v2 Bokeh, SCUNet Khử nhiễu': 'BiRefNet 1024px, LaMa Erase, Depth v2 Bokeh, SCUNet Denoise',
    'Chế độ STU Ultra (Rust SIMD), God Mode & Nhuộm tóc Salon AI': 'STU Ultra (Rust SIMD), God Mode & Salon AI Hair Dye',
    'Xem bảng giá chi tiết': 'View full pricing',
    'So sánh chi tiết các gói': 'Compare all plans in detail',
    'Kiểm tra cấu hình máy của bạn': 'Benchmark your hardware',

    // Homepage — Section 12 (FAQ)
    'DEVSTU chạy offline hoàn toàn có đúng không?': 'Does DEVSTU really run 100% offline?',
    'Đúng. DEVSTU được đóng gói bằng Tauri v2 cùng máy chủ nội bộ viết bằng Rust và toàn bộ trọng số mô hình AI (BiRefNet, LaMa, Depth Anything v2, MediaPipe, SCUNet, U-Net Skin AI) lưu ngay trên máy tính. Ảnh của bạn không bao giờ được gửi lên mạng.':
      'Yes. DEVSTU is packaged with Tauri v2, an embedded Rust local server, and all AI model weights (BiRefNet, LaMa, Depth Anything v2, MediaPipe, SCUNet, U-Net Skin AI) stored locally on your machine. Your photos are never sent online.',
    'DEVSTU đọc được những định dạng ảnh nào?': 'Which image formats does DEVSTU support?',
    'Đọc trực tiếp JPEG, PNG, WebP, TIFF, HEIC/HEIF từ iPhone (qua libheif) và file RAW 16-bit của Sony (ARW), Canon (CR2/CR3), Nikon (NEF), Fujifilm (RAF), Olympus (ORF), Panasonic (RW2) và DNG (qua LibRaw v1.6.0).':
      'Reads JPEG, PNG, WebP, TIFF, iPhone HEIC/HEIF (via libheif), and 16-bit RAW from Sony (ARW), Canon (CR2/CR3), Nikon (NEF), Fujifilm (RAF), Olympus (ORF), Panasonic (RW2), and DNG (via LibRaw v1.6.0).',
    'Chế độ STU Ultra và STU Ultra Max có gì đặc biệt?': 'What makes STU Ultra and STU Ultra Max special?',
    'STU Ultra kết hợp nhân xử lý Rust SIMD đa luồng cho tách tần số, Dodge & Burn, 8 kênh HSL, làm phẳng quần áo và nhuộm tóc 13 màu Salon. STU Ultra Max tích hợp thêm LK Magic Pro (model_29 tách tóc & thay phông studio, tách bầu trời, mô phỏng màu mẫu).':
      'STU Ultra pairs multi-threaded Rust SIMD with Frequency Separation, Dodge & Burn, 8-channel HSL, clothing de-wrinkling, and 13 Salon hair colors. STU Ultra Max adds LK Magic Pro (model_29 studio hair cutout & backdrop swap, sky segmentation, reference color matching).',
    'Máy tính cấu hình thế nào để chạy mượt DEVSTU?': 'What hardware specs are recommended for DEVSTU?',
    'Máy Windows 10/11 có CPU 6 luồng trở lên, RAM 16 GB và SSD đã chỉnh RAW mượt mà. Nếu dùng nhiều công cụ AI nặng như BiRefNet, LaMa, SCUNet, card đồ hoạ rời hỗ trợ WebGPU (từ RTX 3060 / 8 GB VRAM) sẽ tăng tốc gấp nhiều lần. Bạn có thể đo thử ngay ở trang Tải xuống.':
      'A Windows 10/11 PC with a 6+ thread CPU, 16 GB RAM, and SSD handles RAW editing smoothly. For heavy AI tools like BiRefNet, LaMa, and SCUNet, a WebGPU discrete GPU (RTX 3060 / 8 GB VRAM or higher) speeds things up dramatically. You can benchmark your PC on the Download page.',
    'Có nhập được preset Lightroom (.xmp) và LUT (.cube) không?': 'Can I import Lightroom (.xmp) presets and (.cube) LUTs?',
    'Có. DEVSTU hỗ trợ nhập trực tiếp preset Lightroom (.xmp, .lrtemplate) và LUT 3D (.cube) xuất từ Photoshop, Lightroom hay DaVinci Resolve, kết hợp với 111 bộ màu có sẵn.':
      'Yes. DEVSTU directly imports Lightroom presets (.xmp, .lrtemplate) and 3D LUTs (.cube) from Photoshop, Lightroom, or DaVinci Resolve alongside 111 built-in looks.',

    // Homepage — Section 13 (Final CTA)
    'Sẵn sàng nâng tốc quy trình hậu kỳ.': 'Ready to accelerate your post-production.',
    'Tải DEVSTU Desktop Suite cho Windows để trải nghiệm trọn bộ công cụ AI ngay trên máy của bạn.':
      'Download DEVSTU Desktop Suite for Windows and experience the full on-device AI toolkit today.',
    'Ảnh nằm nguyên trên máy bạn, xử lý 100% offline không tải lên máy chủ':
      'Your photos stay on your PC — 100% offline processing with zero server uploads',

    // Download Page (/tai-xuong/)
    'Tải DEVSTU Desktop': 'Download DEVSTU Desktop',
    'Đóng gói bằng Rust Tauri v2, tích hợp sẵn bộ công cụ AI chạy offline 100% (BiRefNet, LaMa, Depth v2, MediaPipe, SCUNet, U-Net Skin AI) và Rust SIMD Engine.':
      'Packaged with Rust Tauri v2, bundling 100% offline AI models (BiRefNet, LaMa, Depth v2, MediaPipe, SCUNet, U-Net Skin AI) and the Rust SIMD Engine.',
    'Hợp với máy này': 'Recommended for this PC',
    'Windows 10, 11 (64-bit) · Tauri v2 + WebView2 + Rust SIMD + WebGPU':
      'Windows 10, 11 (64-bit) · Tauri v2 + WebView2 + Rust SIMD + WebGPU',
    'Google Drive · DEVSTU.exe v1.0.0 · Chạy trực tiếp offline':
      'Google Drive · DEVSTU.exe v1.0.0 · Runs 100% offline',
    'Trọn bộ Offline & AI Models': 'Complete Offline Suite & AI Models',
    'Mở thư mục tải Google Drive': 'Open Google Drive Folder',
    'Hướng dẫn tải & cài đặt DEVSTU': 'DEVSTU Download & Setup Guide',
    'Đang mở thư mục tải DEVSTU trên Google Drive…': 'Opening DEVSTU download folder on Google Drive…',
    'Giải nén thư mục DEVSTU': 'Extract the DEVSTU folder',
    'Nếu Windows SmartScreen hiện cảnh báo': 'If Windows SmartScreen shows a warning',
    'Khởi chạy & sử dụng offline 100%': 'Launch & edit 100% offline',
    'Màn khởi động tự nạp máy chủ Rust nội bộ (<10MB RAM) trong 5 giây và mở ngay giao diện chính ở chế độ WebGPU.':
      'The splash screen boots the embedded Rust local server (<10MB RAM) in ~5 seconds and opens directly in WebGPU mode.',
    'Cấu hình máy': 'System Requirements',
    'DEVSTU tận dụng WebGPU, WebGL 2 và Rust SIMD đa luồng. Bấm nút bên dưới để đo trực tiếp hiệu năng GPU và CPU của máy bạn ngay trên trình duyệt.':
      'DEVSTU leverages WebGPU, WebGL 2, and multi-threaded Rust SIMD. Click below to benchmark your GPU and CPU right inside your browser.',
    'Kiểm tra máy này': 'Benchmark this PC',
    'Hệ điều hành': 'Operating System',
    'Windows 10 / 11 (64-bit), tích hợp Microsoft Edge WebView2 (có sẵn trên Windows 11).':
      'Windows 10 / 11 (64-bit) with Microsoft Edge WebView2 (pre-installed on Windows 11).',
    'Cấu hình tối thiểu': 'Minimum',
    'CPU 4 luồng, RAM 8 GB, card đồ hoạ tích hợp hỗ trợ WebGL 2. Chỉnh RAW & màu Oklab ổn định; mô hình AI chạy qua WASM SIMD.':
      '4-thread CPU, 8 GB RAM, integrated GPU with WebGL 2. Smooth RAW & Oklab grading; AI runs via WASM SIMD.',
    'Khuyên dùng (Mượt mà)': 'Recommended',
    'CPU từ 6 luồng, RAM 16 GB, ổ cứng SSD NVMe, card đồ hoạ tích hợp đời mới hoặc card rời. Kéo thanh trượt, tách tần số và đồng bộ hàng trăm ảnh mượt tức thì.':
      '6+ thread CPU, 16 GB RAM, NVMe SSD, modern integrated or discrete GPU. Effortless sliders, frequency separation, and batch syncing.',
    'Tối ưu AI tốc độ cao': 'Optimal AI Speed',
    'Card đồ hoạ rời hỗ trợ WebGPU (NVIDIA RTX 3060 / 4060 trở lên, VRAM ≥ 8 GB), RAM 16–32 GB cho tốc độ BiRefNet, LaMa, SCUNet và U-Net Skin AI dưới 1 giây.':
      'WebGPU discrete GPU (NVIDIA RTX 3060 / 4060+, ≥ 8 GB VRAM) and 16–32 GB RAM for sub-second BiRefNet, LaMa, SCUNet, and U-Net Skin AI.',
    'Dung lượng ổ đĩa': 'Disk Space',
    'Khoảng 500 MB – 1.2 GB cho trọn bộ mô hình AI chạy offline (không cần tải lại khi mất mạng).':
      'Approx. 500 MB – 1.2 GB for the full offline AI model bundle (no re-downloads required when offline).',

    // Pricing Page (/bang-gia/)
    'Bảng giá DEVSTU': 'DEVSTU Pricing',
    'Bắt đầu miễn phí, không giới hạn tốc độ xử lý phần cứng của bạn. Không tính credit theo từng tấm xuất ra, không tự trừ tiền gia hạn.':
      'Start for free with full hardware speed. Zero per-photo export credits, zero surprise auto-renewals.',
    '1 năm': '1 Year',
    'Vĩnh viễn': 'Lifetime',
    'Dùng mãi': 'Pay once',
    'đ': 'VND',
    'Standard (Miễn phí)': 'Standard (Free)',
    'mãi mãi': 'forever',
    'Không cần tài khoản, dùng trực tiếp trên máy.': 'No account needed — runs directly on your PC.',
    'Mở & chỉnh ảnh RAW 16-bit (LibRaw), HEIC': 'Open & edit 16-bit RAW (LibRaw) & HEIC',
    'Đường cong RGB, 8 kênh HSL, Oklab Color': 'RGB Curves, 8-Channel HSL, Oklab Color',
    'Làm mịn da, xoá mụn cơ bản, thêm LUT .cube': 'Basic skin smoothing, blemish removal & .cube LUTs',
    'Tải DEVSTU': 'Download DEVSTU',
    'Khuyên dùng': 'Recommended',
    '365 ngày · không tự gia hạn': '365 days · no auto-renewal',
    'trả một lần, dùng vĩnh viễn': 'one-time payment, lifetime use',
    'Trọn bộ retouch AI cho nhiếp ảnh gia & studio.': 'Complete AI retouching suite for photographers & studios.',
    'Không giới hạn số lượng ảnh & xuất hàng loạt': 'Unlimited photos & high-speed batch exports',
    'Lọc ảnh hàng loạt AI (trùng, nhoè, nhắm mắt)': 'AI batch culling (duplicates, blur, closed eyes)',
    '111 bộ màu Studio & nhập preset Lightroom .xmp': '111 Studio Looks & Lightroom .xmp preset import',
    'LaMa Xoá vật thể, Depth v2 Bokeh, SCUNet Khử nhiễu': 'LaMa Object Erase, Depth v2 Bokeh, SCUNet Denoise',
    'Chế độ STU Ultra (Rust SIMD) & 13 màu tóc Salon': 'STU Ultra (Rust SIMD) & 13 Salon hair colors',
    'Tải & kích hoạt Pro': 'Download & Activate Pro',
    'Mua ngay qua VietQR (Nhận Key)': 'Buy via VietQR (Get Key)',
    'Lịch sử đơn hàng & Kho Key của tôi': 'My Orders & Purchased Keys',
    'Toàn bộ đơn VietQR và mã Key đã mua được lưu theo tài khoản để bạn copy lại hoặc báo hỗ trợ nếu gặp lỗi thanh toán.':
      'All your VietQR orders and purchased Keys are saved to your account so you can copy them anytime or request support if anything goes wrong.',
    'Làm mới': 'Refresh',
    'Đăng nhập tài khoản DEVSTU': 'Sign in to DEVSTU',
    'Đăng nhập để lưu lịch sử đơn hàng & nhận mã Key kích hoạt ngay cả khi bạn lỡ đóng trình duyệt.':
      'Sign in to save your order history and retrieve your activation Key anytime — even if you close this tab.',
    'Tiếp tục với Google': 'Continue with Google',
    'hoặc dùng Gmail': 'or use Email',
    'Mã OTP 6 số': '6-digit OTP',
    'Mật khẩu': 'Password',
    'Mã OTP 6 số (gửi qua Email)': '6-digit OTP code (sent via Email)',
    'Gửi mã OTP': 'Send OTP',
    'Xác nhận OTP': 'Verify OTP',
    'Thanh toán VietQR · Nhận mã Key': 'VietQR Checkout · Get Activation Key',
    '365 ngày · ưu tiên hỗ trợ': '365 days · priority support',
    'Dành cho retoucher hi-end & studio quy mô lớn.': 'Built for high-end retouchers & commercial studios.',
    'Toàn bộ tính năng Pro · STU Ultra': 'Everything in Pro · STU Ultra',
    'STU Ultra Max (LK Magic Pro model_29 + BGFusion)': 'STU Ultra Max (LK Magic Pro model_29 + BGFusion)',
    'Thay phông ảnh thẻ / studio & tách trời cao cấp': 'Studio / ID backdrop swap & pro sky replacement',
    'God Mode: cọ tách tần số, Dodge & Burn 3 vùng, bút Wacom': 'God Mode: Frequency Separation brush, 3-zone Dodge & Burn, Wacom',
    'Xuất TIFF/PNG 16-bit & hỗ trợ cài đặt trực tiếp': '16-bit TIFF/PNG export & direct setup assistance',
    'Liên hệ Studio Max': 'Contact for Studio Max',
    'So sánh chi tiết các gói': 'Detailed plan comparison',
    'Đọc RAW 16-bit (LibRaw) & HEIC': '16-bit RAW (LibRaw) & HEIC',
    'Có': 'Included',
    'Không giới hạn ảnh xuất & Đồng bộ hàng loạt': 'Unlimited exports & Batch Sync',
    'Tối đa 10 ảnh/lượt': 'Up to 10 photos/batch',
    'Không giới hạn': 'Unlimited',
    '6 mô hình U-Net Skin AI (da mặt, cơ thể, áo, tóc)': '6 U-Net Skin AI models (face, body, clothes, hair)',
    'Cơ bản': 'Basic',
    'Đầy đủ 6 mô hình': 'All 6 models',
    '111 bộ màu & Nhập Preset Lightroom .xmp': '111 Looks & Lightroom .xmp Import',
    '10 bộ + .cube': '10 looks + .cube',
    '111 bộ + .xmp + .cube': '111 looks + .xmp + .cube',
    '111 bộ + Color Match AI': '111 looks + Color Match AI',
    'BiRefNet 1024px, LaMa, Depth v2, SCUNet': 'BiRefNet 1024px, LaMa, Depth v2, SCUNet',
    'Đầy đủ': 'Full access',
    'Đầy đủ + LK model_29': 'Full + LK model_29',
    'STU Ultra (Rust SIMD) & 13 màu tóc Salon': 'STU Ultra (Rust SIMD) & 13 Salon Hair Colors',
    'God Mode (Wacom, Tách tần số, TIFF 16-bit)': 'God Mode (Wacom, Freq. Separation, 16-bit TIFF)',
    'Xử lý 100% Offline trên máy, không tải lên cloud': '100% Offline on-device, zero cloud uploads',

    // About Page (/gioi-thieu/)
    'Về dự án DEVSTU': 'About Project DEVSTU',
    '“Làm sao xử lý trọn bộ ảnh cưới, chân dung RAW 16-bit bằng AI chất lượng studio mà không phải tải ảnh lên mây hay trả credit cho từng tấm xuất ra?”':
      '“How do you process an entire wedding or 16-bit RAW portrait gallery with studio-grade AI — without uploading client photos to the cloud or paying per-export credits?”',
    'Kiến trúc Công nghệ & 7 hệ mô hình AI': 'Technology Stack & 7 AI Model Families',
    'Đóng gói native siêu nhẹ tích hợp Edge WebView2, máy chủ HTTP nội bộ viết bằng Rust (<10 MB RAM) hỗ trợ đầy đủ COOP/COEP cho SharedArrayBuffer & WebGPU.':
      'Ultra-light native wrapper with Edge WebView2 and an embedded Rust HTTP server (<10 MB RAM) serving COOP/COEP headers for SharedArrayBuffer & WebGPU.',
    'Nhân xử lý ảnh đa luồng SIMD cho STU Ultra kết hợp đường ống màu chuẩn công nghiệp Oklab/OKLCH, đường cong RGB, 8 kênh HSL và 111 LUT.':
      'Multi-threaded Rust SIMD imaging engine for STU Ultra paired with an Oklab/OKLCH color pipeline, RGB curves, 8-channel HSL, and 111 LUTs.',
    'Giải mã trực tiếp tệp RAW Sony ARW, Canon CR2/CR3, Nikon NEF, Fuji RAF và HEIC iPhone ngay trên máy client bằng WebAssembly.':
      'Decodes Sony ARW, Canon CR2/CR3, Nikon NEF, Fuji RAF, and iPhone HEIC directly on-device via WebAssembly.',
    'Tách nền và chọn chủ thể độ phân giải cao 1024×1024 giữ từng sợi tóc bay, cùng chế độ tách nhanh 6.6 MB cho ảnh thẻ & studio.':
      'High-resolution 1024×1024 subject matting preserving fine hair strands, plus a fast 6.6 MB mode for ID & studio backdrops.',
    'LaMa Inpainting xoá vật thể 512×512, Depth Anything v2 tạo bản đồ độ sâu bokeh quang học, và SCUNet khử nhiễu ISO cao ảnh RAW.':
      'LaMa 512×512 object inpainting, Depth Anything v2 optical bokeh depth maps, and SCUNet high-ISO RAW denoising.',
    '6 mô hình U-Net Skin AI & MediaPipe': '6 U-Net Skin AI Models & MediaPipe',
    'Liên hệ & hợp tác': 'Contact & Collaboration',
    'Về trang chủ': 'Back to Home',

    // Policy Hub & 5 Dedicated Policy Pages (/chinh-sach/*)
    'Cách DEVSTU xử lý dữ liệu, điều khoản sử dụng và các thông tin pháp lý khác.':
      'How DEVSTU handles data, terms of use, and other legal information.',
    'DEVSTU chỉnh ảnh ngay trên máy bạn, không tải ảnh lên máy chủ. Trang này nói rõ dữ liệu nào được lưu, lưu ở đâu và quyền của bạn.':
      'DEVSTU edits photos locally on your PC without uploading them. Learn what data is stored, where, and your rights.',
    'Điều khoản khi dùng website và ứng dụng DEVSTU Desktop: quyền với ảnh của bạn, cách dùng hợp lệ và giới hạn trách nhiệm.':
      'Terms for using the DEVSTU website and Desktop app: your photo rights, acceptable use, and liability limits.',
    'Website DEVSTU không có cookie quảng cáo hay theo dõi bên thứ ba; chỉ lưu tuỳ chọn ngôn ngữ và cookie cục bộ trong trình duyệt của bạn.':
      'The DEVSTU website has no advertising or third-party tracking cookies; it only stores your language and cookie choice locally.',
    'Thông tin các gói DEVSTU Standard, Pro · STU Ultra, Studio Max, cách thanh toán một lần không tự gia hạn và quy trình xem xét hoàn tiền.':
      'Details on DEVSTU Standard, Pro · STU Ultra, and Studio Max plans, one-time non-recurring payment, and refund process.',
    'Danh sách thư viện mã nguồn mở, mô hình AI và phông chữ mà DEVSTU đang dùng, kèm tên tác giả và giấy phép của từng thành phần.':
      'Open-source libraries, AI models, and fonts used in DEVSTU along with their authors and licenses.',
    'Mở bảng tuỳ chọn lưu trữ cục bộ và quản lý quyền riêng tư trên trình duyệt của bạn bất cứ lúc nào.':
      'Open local storage preferences and manage your browser privacy settings anytime.',
    'Cập nhật lần cuối: 21/11/2026': 'Last updated: Nov 21, 2026',
    'Trong bài này': 'On this page',
    'Các chính sách khác': 'Other policies',
    'Mở Cài đặt cookie': 'Open Cookie Settings',

    // Privacy Policy (/chinh-sach/bao-mat/)
    'Ai chịu trách nhiệm về dữ liệu': 'Who is responsible for data',
    'Dữ liệu chúng tôi KHÔNG thu thập': 'Data we DO NOT collect',
    'Ảnh gốc, file RAW 16-bit, file HEIC và thông tin siêu dữ liệu EXIF (máy ảnh, ống kính, khẩu độ, toạ độ GPS) bạn mở trong DEVSTU.':
      'Original photos, 16-bit RAW files, HEIC files, and EXIF metadata (camera, lens, aperture, GPS) you open in DEVSTU.',
    'Dữ liệu khuôn mặt và cơ thể mà MediaPipe / U-Net AI nhận diện (để làm mịn da, tạo khối 3D, gọn tóc con): toàn bộ suy luận chạy cục bộ trên GPU/CPU máy bạn và không gửi ra ngoài.':
      'Facial and body landmarks detected by MediaPipe / U-Net AI (for skin smoothing, 3D contouring, hair cleanup): all inference runs locally on your GPU/CPU and is never transmitted.',
    'Dữ liệu lưu trên máy của bạn': 'Data stored on your PC',
    'Lựa chọn giao diện (Đơn giản / Pro / STU Ultra Max), cỡ cọ, bộ màu và LUT bạn tự nhập.':
      'Your UI mode (Simple / Pro / STU Ultra Max), brush sizes, and imported color looks or LUTs.',
    'Những dữ liệu này chỉ nằm trên máy của bạn. Bạn có thể xoá sạch bất cứ lúc nào bằng cách dọn thư mục bộ nhớ đệm hoặc gỡ thư mục cài đặt DEVSTU.':
      'This data stays solely on your machine. You can remove it anytime by clearing the cache folder or deleting the DEVSTU folder.',
    'Khi bạn mua gói bản quyền Pro hoặc Studio Max': 'When you purchase Pro or Studio Max',
    'Khi bạn mua gói bản quyền': 'When you purchase a license',
    'Khi bạn liên hệ đăng ký bản quyền Pro · STU Ultra hoặc Studio Max, chúng tôi chỉ lưu thông tin cần thiết để kích hoạt và hỗ trợ kỹ thuật: email đăng ký, gói sử dụng, thời điểm thanh toán, mã giao dịch và thông tin xuất hoá đơn (nếu studio có yêu cầu).':
      'When you register a Pro · STU Ultra or Studio Max license, we only keep details required for activation and support: your email, plan, payment date, transaction ID, and invoice details if requested.',
    'Dữ liệu trên website giới thiệu': 'Data on this website',
    'Website giới thiệu DEVSTU là trang tĩnh hoàn toàn, không chứa quảng cáo và không cài trình theo dõi bên thứ ba. Máy chủ lưu trữ (Vercel) chỉ ghi nhật ký truy cập kỹ thuật tiêu chuẩn (địa chỉ IP, thời điểm, mã phản hồi HTTP) nhằm bảo vệ hạ tầng khỏi tấn công từ chối dịch vụ và sửa lỗi.':
      'The DEVSTU website is fully static, ad-free, and uses no third-party trackers. Our hosting provider (Vercel) records standard technical server logs (IP address, timestamp, HTTP status) solely for infrastructure security and troubleshooting.',
    'Khi bạn liên hệ với chúng tôi': 'When you contact us',
    'Căn cứ pháp lý': 'Legal basis',
    'Chúng tôi tôn trọng và tuân thủ quy định pháp luật Việt Nam về bảo vệ dữ liệu cá nhân. Mọi dữ liệu liên hệ hoặc chứng từ bản quyền chỉ được xử lý trên cơ sở yêu cầu trực tiếp của bạn và nghĩa vụ kế toán theo quy định.':
      'We respect and comply with Vietnamese personal data protection regulations. Contact details and license records are processed strictly to fulfill your direct requests and statutory accounting duties.',
    'Quyền của bạn': 'Your rights',
    'Thay đổi chính sách': 'Policy updates',
    'Khi chính sách này được cập nhật, ngày "Cập nhật lần cuối" ở đầu trang sẽ thay đổi tương ứng. Các thay đổi quan trọng sẽ được thông báo rõ trên website trước khi áp dụng.':
      'When this policy changes, the "Last updated" date at the top will be revised. Material updates will be announced clearly on this website before taking effect.',

    // Terms of Use (/chinh-sach/dieu-khoan/)
    'Ảnh của bạn là của bạn': 'Your photos belong to you',
    'Bạn tự chịu trách nhiệm bảo đảm mình có quyền hợp pháp để chỉnh sửa và phát hành các hình ảnh đó, không xâm phạm bản quyền hay quyền nhân thân về hình ảnh của người khác.':
      'You are responsible for ensuring you hold legal rights to edit and publish those images without infringing copyright or personal image rights.',
    'Dùng DEVSTU đúng cách': 'Acceptable use',
    'Bạn đồng ý không sử dụng DEVSTU cho các mục đích sau:': 'You agree not to use DEVSTU to:',
    'Tạo, chỉnh sửa hoặc phát tán nội dung vi phạm pháp luật Việt Nam hay nơi bạn sinh sống, nội dung xâm hại trẻ em, bôi nhọ hoặc lừa đảo.':
      'Create, edit, or distribute content violating the laws of Vietnam or your jurisdiction, child exploitation material, defamation, or fraud.',
    'Làm giả giấy tờ tuỳ thân, chứng từ hoặc chỉnh sửa hình ảnh nhằm quấy rối, xúc phạm danh dự người khác.':
      'Forge identity documents or records, or manipulate photos to harass or defame others.',
    'Phân phối lại bộ cài trái phép, bẻ khoá bản quyền hoặc sao chép mã nguồn, trọng số mô hình AI độc quyền để kinh doanh dưới tên sản phẩm khác.':
      'Redistribute installers without authorization, crack licensing, or copy proprietary source code or AI weights for competing products.',
    'Bộ màu, mô hình AI và phần mềm bên thứ ba': 'Looks, AI models & third-party software',
    'Bộ màu, mô hình AI & bên thứ ba': 'Looks, AI & third-party software',
    'Các công cụ AI (tách nền BiRefNet, xoá vật thể LaMa, đo độ sâu Depth Anything v2, làm đẹp da U-Net) tạo kết quả tự động dựa trên suy luận mạng thần kinh; hãy luôn kiểm tra lại ảnh trước khi in ấn hoặc bàn giao cho khách hàng.':
      'AI tools (BiRefNet matting, LaMa erase, Depth Anything v2 bokeh, U-Net skin retouch) generate automated neural estimates; always inspect final photos before printing or delivering to clients.',
    'Mã nguồn và quyền sở hữu trí tuệ': 'Source code & intellectual property',
    'Mã nguồn & sở hữu trí tuệ': 'Source code & IP',
    'Mã nguồn đóng gói trong DEVSTU (nhân Rust Tauri v2, Rust SIMD Engine, đường ống màu Oklab, giao diện, 111 bộ màu và các mô hình tinh chỉnh riêng) được bảo hộ theo Luật Sở hữu trí tuệ Việt Nam cùng các điều ước quốc tế về quyền tác giả.':
      'Code packaged in DEVSTU (Rust Tauri v2 runtime, Rust SIMD Engine, Oklab color pipeline, UI, 111 looks, and custom fine-tuned models) is protected under Vietnamese Intellectual Property Law and international copyright treaties.',
    'Nếu không có sự đồng ý bằng văn bản từ tác giả, bạn không được:': 'Without written permission from the author, you may not:',
    'Sao chép, tái đóng gói hoặc đưa bộ cài / một phần mã ứng dụng lên nền tảng, dịch vụ khác để phân phối thương mại.':
      'Copy, repackage, or host the installer or application code on another platform or commercial service.',
    'Dịch ngược, giải mã mã đóng gói để trích xuất thuật toán hay bộ màu độc quyền.':
      'Reverse-engineer or decompile packaged code to extract proprietary algorithms or color looks.',
    'Gỡ bỏ hoặc chỉnh sửa các thông báo bản quyền đi kèm trong ứng dụng.':
      'Remove or alter copyright notices bundled inside the application.',
    'Bản miễn phí, Pro và thay đổi dịch vụ': 'Free tier, Pro & service changes',
    'Bản miễn phí, Pro & cập nhật': 'Free tier, Pro & updates',
    'Giới hạn trách nhiệm': 'Limitation of liability',
    'Luật áp dụng': 'Governing law',
    'Các điều khoản này được điều chỉnh theo pháp luật Việt Nam. Mọi tranh chấp (nếu phát sinh) ưu tiên giải quyết bằng thương lượng thiện chí; nếu không đạt thoả thuận sẽ đưa ra cơ quan có thẩm quyền tại Việt Nam.':
      'These terms are governed by the laws of Vietnam. Any dispute will first be resolved through good-faith negotiation, and otherwise submitted to competent authorities in Vietnam.',

    // Cookie Policy (/chinh-sach/cookie/)
    'Ngắn gọn': 'In short',
    'Lưu trữ thiết yếu trong trình duyệt': 'Essential browser storage',
    'Lưu trữ thiết yếu': 'Essential storage',
    'Tuỳ chọn hiệu năng & trải nghiệm': 'Performance & experience preferences',
    'Tuỳ chọn hiệu năng': 'Performance preferences',
    'Những thứ lưu trong ứng dụng DEVSTU Desktop': 'What DEVSTU Desktop stores locally',
    'Ứng dụng DEVSTU Desktop': 'DEVSTU Desktop app',
    'Xoá dữ liệu': 'Clearing data',
    'Nếu sau này có thay đổi': 'Future changes',
    'Nếu trong tương lai website tích hợp thêm công cụ đo lường hoặc đặt cookie không thiết yếu mới, chúng tôi sẽ cập nhật rõ tại trang này trước khi áp dụng.':
      'If we ever add new analytics tools or non-essential cookies in the future, we will clearly update this page beforehand.',

    // Payment & Refunds (/chinh-sach/thanh-toan-hoan-tien/)
    'Bản miễn phí': 'Free edition',
    'Gói Pro · STU Ultra & Studio Max': 'Pro · STU Ultra & Studio Max',
    'Gói Pro & Studio Max': 'Pro & Studio Max plans',
    'Gói Vĩnh viễn trả một lần, sử dụng lâu dài trên máy trạm đã kích hoạt.':
      'Lifetime plans are paid once for ongoing use on your activated workstation.',
    'Cách thanh toán': 'How to pay',
    'DEVSTU không bao giờ yêu cầu hay lưu số thẻ ngân hàng, mật khẩu hoặc mã OTP của bạn.':
      'DEVSTU never requests or stores your card numbers, passwords, or banking OTPs.',
    'Nếu cần chứng từ thanh toán hoặc thông tin cho studio, vui lòng cung cấp tên đơn vị và email nhận chứng từ khi đăng ký.':
      'If you need payment receipts or studio billing details, include your studio name and billing email when ordering.',
    'Hoàn tiền': 'Refunds',
    'Các yêu cầu hoàn tiền khác được xem xét thiện chí theo từng trường hợp cụ thể.':
      'Other refund requests are reviewed fairly on a case-by-case basis.',
    'Email đăng ký bản quyền và ảnh biên lai chuyển khoản (hoặc mã giao dịch).':
      'Your registered license email and transfer receipt (or transaction ID).',
    'Cấu hình máy và mô tả ngắn vấn đề gặp phải (nếu có).':
      'Your PC specifications and a brief description of the issue (if any).',
    'Nếu yêu cầu được chấp nhận, khoản tiền được hoàn về đúng tài khoản đã thanh toán và khoá bản quyền tương ứng sẽ được thu hồi. Chính sách này không hạn chế bất kỳ quyền lợi hợp pháp nào của người tiêu dùng theo pháp luật Việt Nam.':
      'Once approved, the refund is returned to the original payment account and the corresponding license key is deactivated. This policy does not limit statutory consumer rights under Vietnamese law.',
    'Cẩn thận lừa đảo': 'Beware of scams',

    // Software Licenses (/chinh-sach/giay-phep/)
    'Mô hình AI': 'AI Models',
    'Thành phần': 'Component',
    'Dùng để': 'Used for',
    'Giấy phép': 'License',
    'Lấp nền và xoá vật thể 512×512 ngay trên máy': 'On-device 512×512 object removal & inpainting',
    'Đo bản đồ độ sâu trường ảnh cho Xoá phông quang học': 'Depth map estimation for optical lens bokeh',
    'BiRefNet_lite (Peng Zheng và cộng sự)': 'BiRefNet_lite (Peng Zheng et al.)',
    'Tách chủ thể độ phân giải cao 1024×1024 giữ sợi tóc': 'High-res 1024×1024 hair-accurate subject cutout',
    'MODNet (Zhanghan Ke và cộng sự)': 'MODNet (Zhanghan Ke et al.)',
    'Tách người siêu nhẹ (6.6 MB) cho ảnh thẻ & mặt nạ nhanh': 'Lightweight 6.6 MB portrait matting for fast studio & ID masks',
    'SCUNet (Kai Zhang và cộng sự)': 'SCUNet (Kai Zhang et al.)',
    'Khử nhiễu ISO cao cho ảnh RAW và chụp thiếu sáng': 'High-ISO AI denoising for RAW and low-light photos',
    'Định vị 478 mốc khuôn mặt, phân vùng tóc, da, mắt, môi, quần áo': '478 facial landmarks & hair/skin/eyes/lips/clothing masks',
    'Làm mịn da giữ vân, mờ rãnh cười, đánh khối 3D, da cơ thể, phẳng nếp áo, gọn tóc con':
      'Texture-safe skin smoothing, smile lines, 3D contour, body skin, clothing de-wrinkle, stray-hair cleanup',
    'Của DEVSTU': 'Proprietary (DEVSTU)',
    'Tách tóc studio, thay phông ảnh thẻ và tách bầu trời tự động': 'Studio hair cutout, ID backdrop swap & sky segmentation',
    'Thư viện & Hạ tầng': 'Libraries & Runtime',
    'Đóng gói ứng dụng Desktop Windows và máy chủ HTTP cục bộ (<10 MB RAM)': 'Windows desktop wrapper & embedded local HTTP server (<10 MB RAM)',
    'Thực thi mô hình AI tăng tốc phần cứng WebGPU & WASM SIMD': 'Hardware-accelerated WebGPU & WASM SIMD AI inference',
    'Giải mã file RAW 16-bit (Sony ARW, Canon CR2/CR3, Nikon NEF, Fuji RAF, DNG)': '16-bit RAW decoding (Sony ARW, Canon CR2/CR3, Nikon NEF, Fuji RAF, DNG)',
    'Đọc trực tiếp ảnh HEIC / HEIF của iPhone ngay trên máy': 'Native on-device iPhone HEIC / HEIF decoding',
    'Hệ thống biểu tượng giao diện ứng dụng': 'Application UI icon set',
    'Phông chữ': 'Fonts',
    'Be Vietnam Pro (và các bộ chữ dùng cho đóng logo studio trên ảnh) được sử dụng theo giấy phép SIL Open Font License 1.1.':
      'Be Vietnam Pro (and studio watermark typefaces) are licensed under the SIL Open Font License 1.1.',

    // Blog Index & Facebook Color Shift Article (/blog/*)
    'Mẹo chỉnh ảnh, quản lý màu sắc và quy trình hậu kỳ thực tế cùng DEVSTU.':
      'Photo editing tips, color management guides, and real-world post-production workflows with DEVSTU.',
    '21/11/2026 · 3 phút đọc': 'Nov 21, 2026 · 3 min read',
    'Ảnh đăng Facebook bị lệch màu: nguyên nhân và cách sửa': 'Why Photos Look Different on Facebook: Causes & Fix',
    'Vì sao ảnh chỉnh đẹp trong Photoshop, Camera Raw lên Facebook, Zalo lại nhợt, da xám? Cài đặt đúng khi xuất ảnh và công cụ kiểm tra sRGB miễn phí ngay trên máy.':
      'Why do photos edited in Photoshop or Camera Raw look dull and gray on Facebook? Correct sRGB export settings plus a free on-device sRGB checker.',
    'Tài nguyên miễn phí · .CUBE & ?m=': 'Free Resources · .CUBE & ?m=',
    'Kho 8 LUT 3D miễn phí cho ảnh cưới, chân dung & film': '8 Free 3D LUTs for Weddings, Portraits & Film',
    'Tải trực tiếp file .cube chuẩn 17×17×17 và link bộ màu devstu.vercel.app/?m=... dùng ngay trên DEVSTU, Lightroom, Photoshop và DaVinci.':
      'Download 17×17×17 .cube LUTs and devstu.vercel.app/?m=... look links ready for DEVSTU, Lightroom, Photoshop, and DaVinci.',
    'Kiến trúc · Offline AI': 'Architecture · Offline AI',
    'Bên trong DEVSTU: Tauri v2, Rust SIMD & 7 mô hình AI chạy trên máy': 'Inside DEVSTU: Tauri v2, Rust SIMD & 7 On-Device AI Models',
    'Cách DEVSTU giải mã RAW 16-bit bằng LibRaw, chỉnh màu Oklab và chạy 6 mô hình U-Net Skin AI offline 100% không cần tải ảnh lên mạng.':
      'How DEVSTU decodes 16-bit RAW with LibRaw, grades in Oklab, and runs 6 U-Net Skin AI models 100% offline with zero uploads.',
    'Viết bởi DEVSTU · ducdoan-04': 'Written by DEVSTU · ducdoan-04',
    'Cập nhật 21/11/2026': 'Updated Nov 21, 2026',
    '3 phút đọc': '3 min read',
    'Nguyên nhân hay gặp nhất: ảnh không ở sRGB': 'Most common cause: the photo isn’t in sRGB',
    'Các trường hợp cụ thể hay gặp:': 'Common real-world scenarios:',
    'Cách xuất ảnh đúng trong Photoshop': 'How to export properly in Photoshop',
    'Sau đó, tuỳ theo cách bạn lưu ảnh:': 'Then, depending on how you save:',
    'Trong Camera Raw, Lightroom và DEVSTU': 'In Camera Raw, Lightroom & DEVSTU',
    'Trong Camera Raw, Lightroom & DEVSTU': 'In Camera Raw, Lightroom & DEVSTU',
    'Facebook cũng nén và thu nhỏ ảnh': 'Facebook also compresses & resizes photos',
    'Những thứ không sửa được bằng file': 'What a file alone cannot fix',
    'Kiểm tra nhanh độ lệch màu ngay tại đây (miễn phí)': 'Check your photo for color shifts right here (free)',
    'Kiểm tra nhanh độ lệch màu': 'Instant color shift checker',
    'Kéo ảnh vào đây hoặc bấm để chọn file': 'Drag photos here or click to select files',
    'Hỗ trợ JPEG, PNG, WebP (tối đa 6 ảnh mỗi lượt) · Chạy 100% offline trên trình duyệt':
      'Supports JPEG, PNG, WebP (up to 6 images at once) · Runs 100% offline in your browser',
    'Tự thu cạnh dài về 2048 px tối ưu cho Facebook khi lưu': 'Automatically resize long edge to 2048 px for Facebook on export',
    'quản lý màu': 'color management',
    'hướng dẫn': 'guide',
    'Chỉnh màu Oklab & xuất chuẩn sRGB trên DEVSTU': 'Grade in Oklab & export clean sRGB with DEVSTU',
    'Xử lý RAW 16-bit, làm đẹp da AI U-Net và đồng bộ hàng loạt 100% offline ngay trên máy Windows của bạn.':
      '16-bit RAW editing, U-Net AI skin retouching, and batch sync running 100% offline on your Windows PC.',
    'Tài nguyên hữu ích': 'Helpful resources',
    'Kho 8 LUT 3D .cube miễn phí': '8 Free 3D .cube LUTs',
    'Tất cả bài viết Blog': 'All Blog Posts',

    // Dedicated Login Page (/dang-nhap/) & Orders Page (/don-hang/)
    'Lưu lịch sử đơn hàng VietQR & nhận mã Key kích hoạt ngay cả khi bạn lỡ đóng trình duyệt.':
      'Save your VietQR order history & retrieve activation Keys anytime — even if you close the browser.',
    '← Quay lại Bảng giá': '← Back to Pricing',
    'Thanh toán xong nhận mã Key riêng, không tự kích hoạt.': 'Receive a standalone Key upon payment (no auto-activation).',
    'Lịch sử đơn & Kho Key': 'Orders & Key Vault',
    'Mua thêm gói': 'Buy a Plan',
    'Đăng nhập để xem Lịch sử đơn hàng & Kho Key': 'Sign in to view your Orders & Key Vault',
    'Mã Key bạn đã mua qua VietQR được lưu an toàn theo tài khoản Google hoặc Email của bạn.':
      'Activation Keys purchased via VietQR are safely saved to your Google or Email account.',
    'Đăng nhập ngay': 'Sign in now',
    'Xem bảng giá': 'View Pricing',
    'Tất cả': 'All',
    'Đã cấp Key': 'Key Issued',
    'Đang chờ thanh toán': 'Awaiting Payment',
    'Đã hủy / Hết hạn': 'Cancelled / Expired',
    'Tự động 24/7': '24/7 Instant',

    // 404 Page
    'Không tìm thấy trang': 'Page not found',
    'Đường dẫn bạn vừa mở không tồn tại hoặc đã được chuyển đi.': 'The page you requested does not exist or has been moved.',
    'Quay về trang chủ DEVSTU': 'Back to DEVSTU Home'
  };

  var ATTR_MAP = {
    'Điều hướng chính': 'Main navigation',
    'Mở menu': 'Open menu',
    'Chọn ngôn ngữ': 'Select language',
    'Ngôn ngữ': 'Language',
    'Đóng': 'Close',
    'Minh hoạ giao diện DEVSTU': 'DEVSTU interface preview',
    'Chế độ giao diện': 'Interface mode',
    'Kéo để so sánh ảnh gốc và ảnh sau khi chỉnh': 'Drag to compare original and edited photo',
    'Bộ lọc ảnh': 'Photo filter',
    'Chọn công cụ AI': 'Select AI tool',
    'Chọn kỳ hạn': 'Select billing period',
    'Nhập link bộ màu (devstu.vercel.app/?m=...)': 'Enter a look link (devstu.vercel.app/?m=...)',
    'Nhập 6 số sau khi bấm Gửi mã': 'Enter the 6-digit code sent to your email',
    'Nhập mật khẩu': 'Enter your password',
    'Chuyển mục Bảng giá và Đơn hàng': 'Switch between Pricing and Orders',
    'Lọc trạng thái đơn hàng': 'Filter order status'
  };

  function collectDom() {
    if (textEntries) return;
    htmlEntries = [];
    textEntries = [];
    attrEntries = [];

    var skippedNodes = new Set();

    // 1. Collect mixed-HTML blocks
    document.querySelectorAll(HTML_SELECTORS).forEach(function (el) {
      var key = norm(el.textContent);
      if (HTML_MAP[key]) {
        htmlEntries.push({ el: el, vi: el.innerHTML, en: HTML_MAP[key] });
        skippedNodes.add(el);
      }
    });

    // 2. Walk text nodes
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      var parent = node.parentElement;
      if (!parent) continue;
      if (parent.closest('script, style, code')) continue;
      // Skip if inside an htmlEntry
      var insideHtml = false;
      var cur = parent;
      while (cur) {
        if (skippedNodes.has(cur)) { insideHtml = true; break; }
        cur = cur.parentElement;
      }
      if (insideHtml) continue;

      var raw = node.nodeValue;
      var trimmed = norm(raw);
      if (!trimmed) continue;
      var en = TEXT_MAP[trimmed];
      if (en) {
        var lead = raw.match(/^\s*/)[0];
        var trail = raw.match(/\s*$/)[0];
        textEntries.push({ node: node, vi: raw, en: lead + en + trail });
      }
    }

    // 3. Collect aria-label attributes
    document.querySelectorAll('[aria-label]').forEach(function (el) {
      var val = el.getAttribute('aria-label');
      if (ATTR_MAP[val]) {
        attrEntries.push({ el: el, attr: 'aria-label', vi: val, en: ATTR_MAP[val] });
      }
    });
  }

  function getSavedLang() {
    try {
      var qp = new URLSearchParams(window.location.search).get('lang');
      if (qp === 'en' || qp === 'vi') return qp;
      if (isEnglishUrl()) return 'en';
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'vi') return saved;
    } catch (_) { }
    return 'vi';
  }

  var currentLang = getSavedLang();

  function updateSwitcherUI(lang) {
    document.documentElement.lang = lang;
    var hm = document.getElementById('hm');
    if (hm) hm.setAttribute('lang', lang);

    document.querySelectorAll('[data-lang-code]').forEach(function (el) {
      el.textContent = lang.toUpperCase();
    });

    document.querySelectorAll('[data-set-lang]').forEach(function (btn) {
      var isCurrent = btn.getAttribute('data-set-lang') === lang;
      btn.setAttribute('aria-current', String(isCurrent));
      btn.classList.toggle('on', isCurrent);
    });
  }

  function applyLang(lang, persist) {
    if (lang !== 'en' && lang !== 'vi') lang = 'vi';
    collectDom();
    currentLang = lang;

    if (persist || isEnglishUrl()) {
      try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) { }
    }

    // Title & meta description
    var titleKey = norm(origTitle);
    document.title = lang === 'en' && TITLE_MAP[titleKey] ? TITLE_MAP[titleKey] : origTitle;
    if (metaDescEl) {
      var descKey = norm(origMetaDesc);
      metaDescEl.setAttribute('content', lang === 'en' && META_MAP[descKey] ? META_MAP[descKey] : origMetaDesc);
    }

    // Apply mixed-HTML blocks
    for (var i = 0; i < htmlEntries.length; i++) {
      var h = htmlEntries[i];
      h.el.innerHTML = lang === 'en' ? h.en : h.vi;
    }

    // Apply pure text nodes
    for (var j = 0; j < textEntries.length; j++) {
      var t = textEntries[j];
      t.node.nodeValue = lang === 'en' ? t.en : t.vi;
    }

    // Apply attributes
    for (var k = 0; k < attrEntries.length; k++) {
      var a = attrEntries[k];
      a.el.setAttribute(a.attr, lang === 'en' ? a.en : a.vi);
    }

    // Rewrite every internal link & update browser URL path to match language
    rewriteLinks(lang);
    syncBrowserUrl(lang);
    updateSwitcherUI(lang);

    for (var m = 0; m < listeners.length; m++) {
      try { listeners[m](lang); } catch (_) { }
    }
  }

  function bindSwitchers() {
    document.querySelectorAll('[data-set-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = btn.getAttribute('data-set-lang');
        applyLang(next, true);
        var dd = btn.closest('details.lang-dd');
        if (dd) dd.open = false;
      });
    });
  }

  window.DEVSTU_I18N = {
    getLang: function () { return currentLang; },
    setLang: function (lang) { applyLang(lang, true); },
    t: function (vi, en) { return currentLang === 'en' ? en : vi; },
    onChange: function (fn) {
      if (typeof fn === 'function') listeners.push(fn);
    }
  };

  function init() {
    bindSwitchers();
    applyLang(currentLang, false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
