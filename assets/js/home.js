// DEVSTU Showcase — Interactive app demo, before/after sliders, AI skin slider, culling filter, genre presets, AI tools switcher, hardware check
(() => {
  const root = document.getElementById('hm');
  if (!root) return;
  root.classList.add('hm-js');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const IMG = '/assets/img/home/';
  const isEn = () => window.DEVSTU_I18N && window.DEVSTU_I18N.getLang() === 'en';
  const tr = (vi, en) => (isEn() ? en : vi);

  // 1. Draggable before/after comparison sliders
  for (const c of root.querySelectorAll('[data-cmp]')) {
    const r = c.querySelector('input[type=range]');
    if (!r) continue;
    const set = () => c.style.setProperty('--x', r.value + '%');
    r.addEventListener('input', set);
    set();
  }

  // 2. AI Skin slider (0..100 opacity blend with auto-demo on scroll)
  for (const f of root.querySelectorAll('[data-aiskin]')) {
    const r = f.querySelector('[data-aiskin-range]');
    const out = f.querySelector('[data-aiskin-out]');
    if (!r || !out) continue;
    let stop = false;
    const set = (v) => {
      r.value = String(Math.round(v));
      out.textContent = r.value;
      f.style.setProperty('--v', String(v / 100));
    };
    r.addEventListener('input', () => { stop = true; set(Number(r.value)); });
    for (const ev of ['pointerdown', 'keydown']) r.addEventListener(ev, () => { stop = true; }, { passive: true });
    if (still || !('IntersectionObserver' in window)) continue;
    set(0);
    new IntersectionObserver((es, o) => {
      for (const e of es) {
        if (e.isIntersecting) {
          o.disconnect();
          let t0 = 0;
          const ease = (x) => 1 - Math.pow(1 - x, 3);
          const step = (now) => {
            if (stop) return;
            if (!t0) t0 = now;
            const k = Math.min(1, (now - t0) / 1800);
            set(100 * ease(k));
            if (k < 1) requestAnimationFrame(step);
          };
          setTimeout(() => !stop && requestAnimationFrame(step), 500);
        } else if (e.boundingClientRect.top < 0) {
          o.disconnect();
          if (!stop) set(100);
        }
      }
    }, { threshold: 0.35 }).observe(f);
  }

  // 3. Hero Interactive DEVSTU App Simulator
  const app = root.querySelector('[data-hm-app]');
  if (app) {
    const cmp = app.querySelector('[data-cmp]');
    const A = cmp.querySelector('[data-a]');
    const B = cmp.querySelector('[data-b]');
    const autoBtn = app.querySelector('[data-auto]');
    const lookBtns = [...app.querySelectorAll('[data-look]')];
    const thumbs = [...app.querySelectorAll('[data-thumb]')];
    const syncBtn = app.querySelector('[data-sync]');
    const badge = app.querySelector('[data-badge]');
    const count = app.querySelector('[data-count]');
    const slExp = app.querySelector('[data-sl="exp"]');
    const slTemp = app.querySelector('[data-sl="temp"]');
    const slCon = app.querySelector('[data-sl="con"]');
    const modeBtns = [...app.querySelectorAll('[data-app-mode]')];
    const T = app.dataset;
    const syncLook = Number(T.syncLook) || 1;
    const st = { photo: 1, auto: true, look: 0, synced: false, done: new Set([1]) };

    const LOOK_SL = {
      0: { exp: [['sáng hơn nhẹ', 'slightly brighter'], '56%'], temp: [['cân bằng tự nhiên', 'natural balance'], '52%'], con: [['rõ chi tiết', 'crisp detail'], '54%'] },
      1: { exp: [['ấm nắng nhẹ', 'warm glow'], '55%'], temp: [['ấm vàng chiều', 'golden warmth'], '70%'], con: [['đậm vừa', 'balanced depth'], '58%'] },
      2: { exp: [['sáng trong', 'bright airy'], '64%'], temp: [['hồng nhẹ', 'soft rosy'], '48%'], con: [['mềm dịu', 'soft gentle'], '46%'] },
      3: { exp: [['film cổ điển', 'classic film'], '51%'], temp: [['ấm nhẹ', 'subtle warm'], '60%'], con: [['tương phản film', 'film contrast'], '62%'] },
      4: { exp: [['sáng rạng rỡ', 'clean bright'], '60%'], temp: [['trong trẻo', 'cool crisp'], '44%'], con: [['nét trong', 'clear crisp'], '57%'] }
    };

    const heroSrc = (name) => ({
      src: `${IMG}${name}.webp`,
      srcset: `${IMG}${name}.webp 900w`
    });
    const swap = (img, s) => {
      if (img.getAttribute('src') === s.src) return;
      img.srcset = s.srcset || '';
      img.src = s.src;
      if (!still) { img.classList.remove('hm-swap'); void img.offsetWidth; img.classList.add('hm-swap'); }
    };
    const setSl = (el, val) => {
      if (!el || !val) return;
      const sp = el.querySelector('.hm-sl__t span');
      const trEl = el.querySelector('.hm-sl__track');
      if (sp) sp.textContent = Array.isArray(val[0]) ? tr(val[0][0], val[0][1]) : val[0];
      if (trEl) trEl.style.setProperty('--v', val[1]);
    };
    const paint = () => {
      const STUDIO = '/assets/img/studio/';
      if (st.photo === 1) {
        swap(A, { src: `${STUDIO}hero-raw.webp` });
        swap(B, { src: !st.auto ? `${STUDIO}hero-raw.webp` : st.look ? `${STUDIO}hero-look-${st.look}.webp` : `${STUDIO}hero-auto.webp` });
      } else {
        const n = st.photo;
        swap(A, { src: `${STUDIO}shoot-${n}-raw.webp` });
        swap(B, { src: `${STUDIO}shoot-${n}-${st.done.has(n) ? 'edit' : 'raw'}.webp` });
      }
      autoBtn.setAttribute('aria-pressed', String(st.auto));
      autoBtn.querySelector('span').textContent = st.auto
        ? tr(T.tOn || 'Máy đã chỉnh giúp', 'Auto-edited for you')
        : tr(T.tOff || 'Chỉnh giúp tôi', 'Auto-edit for me');
      for (const b of lookBtns) b.setAttribute('aria-pressed', String(Number(b.dataset.look) === (st.auto ? st.look : -1)));
      for (const t of thumbs) {
        const n = Number(t.dataset.thumb);
        t.classList.toggle('on', n === st.photo);
        t.setAttribute('aria-pressed', String(n === st.photo));
      }
      badge.textContent = tr(T.tBadge || 'Ảnh {n} / 8', 'Photo {n} / 8').replace('{n}', st.photo);
      count.textContent = tr(T.tCount || '8 ảnh · đã chỉnh {n}', '8 photos · {n} edited').replace('{n}', st.done.size);
      if (st.synced && st.done.size === thumbs.length) {
        syncBtn.querySelector('span').textContent = tr(T.tSynced || 'Đã đồng bộ 8 ảnh', 'Synced all 8 photos');
      }
      const slData = st.auto ? (LOOK_SL[st.look] || LOOK_SL[0]) : {
        exp: [['giữ nguyên', 'unchanged'], '50%'],
        temp: [['giữ nguyên', 'unchanged'], '50%'],
        con: [['giữ nguyên', 'unchanged'], '50%']
      };
      setSl(slExp, slData.exp);
      setSl(slTemp, slData.temp);
      setSl(slCon, slData.con);
    };

    if (window.DEVSTU_I18N) window.DEVSTU_I18N.onChange(paint);

    const toFirst = () => { if (st.photo !== 1) st.photo = 1; };
    autoBtn.addEventListener('click', () => { toFirst(); st.auto = !st.auto; if (!st.auto) st.look = 0; paint(); });
    for (const b of lookBtns) b.addEventListener('click', () => { toFirst(); st.auto = true; st.look = Number(b.dataset.look); paint(); });
    for (const t of thumbs) t.addEventListener('click', () => { st.photo = Number(t.dataset.thumb); paint(); });
    for (const m of modeBtns) {
      m.addEventListener('click', () => {
        modeBtns.forEach((x) => x.classList.toggle('on', x === m));
      });
    }

    const cmpBtn = app.querySelector('[data-compare]');
    if (cmpBtn) {
      cmpBtn.addEventListener('click', () => {
        const on = cmpBtn.getAttribute('aria-pressed') !== 'true';
        cmpBtn.setAttribute('aria-pressed', String(on));
        cmp.classList.toggle('off', !on);
      });
    }

    syncBtn.addEventListener('click', () => {
      if (st.synced) return;
      st.synced = true;
      syncBtn.disabled = true;
      st.auto = true;
      st.look = syncLook;
      paint();
      thumbs.forEach((t, i) => {
        const go = () => {
          const n = Number(t.dataset.thumb);
          t.querySelector('img').src = t.dataset.sau;
          t.classList.add('done');
          st.done.add(n);
          if (n === st.photo && n !== 1) paint();
          count.textContent = tr(T.tCount || '8 ảnh · đã chỉnh {n}', '8 photos · {n} edited').replace('{n}', st.done.size);
          if (st.done.size === thumbs.length) syncBtn.querySelector('span').textContent = tr(T.tSynced || 'Đã đồng bộ 8 ảnh', 'Synced all 8 photos');
        };
        if (still) go(); else setTimeout(go, 130 * i);
      });
    });
    paint();
  }

  // 4. Interactive Culling filter
  const cull = root.querySelector('[data-cull-app]');
  if (cull) {
    const tabs = [...cull.querySelectorAll('[data-cull-filter]')];
    const items = [...cull.querySelectorAll('[data-cull-item]')];
    for (const t of tabs) {
      t.addEventListener('click', () => {
        const f = t.dataset.cullFilter;
        tabs.forEach((x) => x.setAttribute('aria-pressed', String(x === t)));
        items.forEach((it) => {
          const st = it.dataset.cullItem;
          const show = f === 'all' || (f === 'ok' && st === 'ok') || (f === 'flag' && st !== 'ok');
          it.classList.toggle('is-dim', !show);
        });
      });
    }
  }

  // 5. Batch Sync Grid Toggle ("Chỉnh một tấm, cả buổi đẹp theo")
  const dev = root.querySelector('.hm-dev');
  if (dev) {
    const cells = [...dev.querySelectorAll('.hm-dev__cell')];
    const allBtns = [...root.querySelectorAll('[data-dev-all]')];
    const sync = () => {
      const on = cells.filter((c) => c.getAttribute('aria-pressed') === 'true').length;
      for (const b of allBtns) b.setAttribute('aria-pressed', String(b.dataset.devAll === 'sau' ? on === cells.length : on === 0));
    };
    const set = (c, on) => { dev.classList.add('hm-done'); c.setAttribute('aria-pressed', String(on)); c.classList.toggle('off', !on); };
    for (const c of cells) c.addEventListener('click', () => { set(c, c.getAttribute('aria-pressed') !== 'true'); sync(); });
    for (const b of allBtns) b.addEventListener('click', () => {
      const on = b.dataset.devAll === 'sau';
      cells.forEach((c, i) => (still ? set(c, on) : setTimeout(() => set(c, on), i * 65)));
      for (const x of allBtns) x.setAttribute('aria-pressed', String(x === b));
    });
  }

  // 6. Interactive 4-in-1 AI Tools Switcher (Erase / Bokeh / Sky / Water)
  const aiBox = root.querySelector('[data-ai-tools]');
  if (aiBox) {
    const btns = [...aiBox.querySelectorAll('[data-tool-tab]')];
    const imgA = aiBox.querySelector('[data-tool-a]');
    const imgB = aiBox.querySelector('[data-tool-b]');
    const cap = aiBox.querySelector('[data-tool-cap]');
    const TOOLS = {
      erase: {
        a: '/assets/img/studio/ai-denoise-raw.webp',
        b: '/assets/img/studio/ai-denoise-after.webp',
        cap: [
          'SCUNet Khử nhiễu AI: Tẩy sạch nhiễu hạt ISO cao trong vùng tối mà vẫn giữ trọn chi tiết tóc và da.',
          'SCUNet AI Denoise: Eliminates high-ISO chroma & luma shadow grain while keeping crisp facial texture.'
        ]
      },
      bokeh: {
        a: '/assets/img/studio/ai-bokeh-raw.webp',
        b: '/assets/img/studio/ai-bokeh-after.webp',
        cap: [
          'Depth Anything v2 + BiRefNet: Tạo bản đồ độ sâu trường ảnh, xóa phông quang học giữ nét từng sợi tóc.',
          'Depth Anything v2 + BiRefNet: Generates a depth map for optical lens bokeh while keeping fine hair strands razor-sharp.'
        ]
      },
      sky: {
        a: '/assets/img/studio/ai-sky-raw.webp',
        b: '/assets/img/studio/ai-sky-after.webp',
        cap: [
          'LK Magic Pro Sky Segmentation: Tự tách đường chân trời và phục hồi bầu trời hoàng hôn rực rỡ.',
          'LK Magic Pro Sky Segmentation: Automatically masks the horizon and restores rich golden sunset clouds.'
        ]
      },
      water: {
        a: '/assets/img/studio/ai-water-raw.webp',
        b: '/assets/img/studio/ai-water-after.webp',
        cap: [
          'Mặt nạ vùng nước AI: Tách riêng mặt biển để đẩy sắc xanh ngọc trong trẻo mà không ám lên bãi cát.',
          'AI Water Mask: Isolates the sea surface to enhance crystal-clear turquoise tones without tinting the sand.'
        ]
      }
    };
    let activeTool = 'erase';
    const renderToolCap = () => {
      const d = TOOLS[activeTool];
      if (d && cap) cap.textContent = tr(d.cap[0], d.cap[1]);
    };
    for (const b of btns) {
      b.addEventListener('click', () => {
        const k = b.dataset.toolTab;
        const d = TOOLS[k];
        if (!d) return;
        activeTool = k;
        btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        if (imgA) imgA.src = d.a;
        if (imgB) imgB.src = d.b;
        renderToolCap();
      });
    }
    if (window.DEVSTU_I18N) window.DEVSTU_I18N.onChange(renderToolCap);
  }

  // 7. Auto-scroll Pro tool inspector
  const col = root.querySelector('[data-autoscroll]');
  if (col) {
    const fig = col.closest('.hm-full');
    let stop = false, dir = 1, rest = 0, visible = false, last = 0;
    const halt = () => { stop = true; fig?.classList.add('touched'); };
    for (const ev of ['wheel', 'pointerdown', 'touchstart', 'keydown']) col.addEventListener(ev, halt, { passive: true });
    const tick = (now) => {
      if (stop || !visible) { last = 0; return; }
      const dt = last ? Math.min(64, now - last) : 16; last = now;
      const max = col.scrollHeight - col.clientHeight;
      if (max <= 0) return;
      if (rest > 0) rest -= dt;
      else {
        col.scrollTop += dir * dt * (dir > 0 ? 0.06 : 0.16);
        if (dir > 0 && col.scrollTop >= max - 1) { dir = -1; rest = 1200; }
        else if (dir < 0 && col.scrollTop <= 0) { dir = 1; rest = 1800; }
      }
      requestAnimationFrame(tick);
    };
    if (!still && 'IntersectionObserver' in window) {
      new IntersectionObserver((es) => {
        for (const e of es) {
          const was = visible; visible = e.isIntersecting;
          if (visible && !was) { rest = 700; requestAnimationFrame(tick); }
        }
      }, { threshold: 0.4 }).observe(col);
    }
  }

  // 8. Scroll reveal & automatic comparison sweep
  const rv = root.querySelectorAll('[data-rv]');
  const sweeps = root.querySelectorAll('[data-sweep]');
  if (!('IntersectionObserver' in window)) {
    rv.forEach((e) => e.classList.add('hm-in'));
    return;
  }
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { e.target.classList.add('hm-in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -10% 0px' });
  rv.forEach((e) => io.observe(e));

  if (!still) {
    const ease = (x) => 1 - Math.pow(1 - x, 4);
    const sweep = (c) => {
      const r = c.querySelector('input[type=range]');
      if (!r) return;
      const from = Number(c.dataset.sweep), to = 50, dur = 1600;
      let stop = false, t0 = 0;
      const halt = () => { stop = true; };
      for (const ev of ['pointerdown', 'keydown', 'wheel']) c.addEventListener(ev, halt, { once: true, passive: true });
      const set = (v) => { r.value = String(Math.round(v)); c.style.setProperty('--x', v + '%'); };
      set(from);
      const step = (now) => {
        if (stop) return;
        if (!t0) t0 = now;
        const k = Math.min(1, (now - t0) / dur);
        set(from + (to - from) * ease(k));
        if (k < 1) requestAnimationFrame(step);
      };
      c._go = () => setTimeout(() => !stop && requestAnimationFrame(step), Number(c.dataset.delay) || 0);
      c._end = () => { stop = true; set(to); };
    };
    const so = new IntersectionObserver((es) => {
      for (const e of es) {
        if (e.isIntersecting) { so.unobserve(e.target); e.target._go?.(); }
        else if (e.boundingClientRect.top < 0) { so.unobserve(e.target); e.target._end?.(); }
      }
    }, { threshold: 0.3 });
    sweeps.forEach((c) => { sweep(c); so.observe(c); });
  }
})();

// Download page: OS detection & interactive setup dialog
(() => {
  const pick = document.querySelector('[data-get-pick]');
  if (!pick) return;
  const plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  const ua = navigator.userAgent;
  const os = /Win/i.test(plat) || /Windows/i.test(ua) ? 'win' : /Mac/i.test(plat) ? 'mac' : 'win';
  const rec = pick.querySelector(`[data-os="${os}"]`);
  if (rec) {
    rec.classList.add('is-rec');
    const tag = rec.querySelector('.hm-get-rec');
    if (tag) tag.hidden = false;
  }

  for (const a of pick.querySelectorAll('[data-get]')) {
    const k = a.dataset.get;
    const dlg = document.querySelector(`[data-dlg="${k}"]`);
    if (!dlg || typeof dlg.showModal !== 'function') continue;
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      if (a.href && /^https?:\/\//i.test(a.href)) {
        window.open(a.href, '_blank', 'noopener,noreferrer');
      }
      dlg.showModal();
      const fill = dlg.querySelector('[data-fill]');
      const pc = dlg.querySelector('[data-pc]');
      const st = dlg.querySelector('[data-st]');
      const prog = dlg.querySelector('[data-prog]');
      if (fill) fill.style.width = '100%';
      if (pc) pc.textContent = '100 %';
      if (prog) prog.classList.add('is-done');
      if (st) st.textContent = window.DEVSTU_I18N && window.DEVSTU_I18N.getLang() === 'en'
        ? 'DEVSTU Google Drive folder opened — see setup steps below'
        : 'Đã mở thư mục tải DEVSTU trên Google Drive — xem hướng dẫn cài đặt bên dưới';
    });
    dlg.querySelector('[data-close]')?.addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (ev) => { if (ev.target === dlg) dlg.close(); });
  }
})();

// Hardware check probe ("Kiểm tra máy này") — real WebGL 2 GPU + CPU single-thread benchmark
(() => {
  const box = document.querySelector('[data-mc]');
  if (!box) return;
  const go = box.querySelector('[data-mc-go]');
  const out = box.querySelector('[data-mc-out]');
  if (!go || !out) return;
  box.hidden = false;

  const INTEL_MS = 2.4, FAST = 5, OK = 0.4, CPU_BASE = 54, CPU_SLOW = 0.25;
  const SOFT = /swiftshader|llvmpipe|softpipe|software|basic render|warp/i;
  const SHARED = /apple|intel\(r\) (uhd|hd|iris)|iris\(r\) xe|uhd graphics|radeon\(tm\) graphics|radeon graphics|adreno|mali/;
  const VRAM = [
    [/rtx\s*5090/, 32], [/rtx\s*(5080|5070\s*ti|4080|4070\s*ti\s*super)/, 16],
    [/rtx\s*4090|rtx\s*3090/, 24], [/rtx\s*(5070|4070|3080\s*ti)/, 12],
    [/rtx\s*(5060|4060|3070|3060|2080|2070)/, 8], [/rtx\s*(4050|2060)/, 6],
    [/rtx\s*3050|gtx\s*16\d0|gtx\s*1060/, 4], [/rx\s*(79|78|69|68)\d0/, 16], [/rx\s*(76|66)\d0/, 8]
  ];
  const guessVram = (r) => {
    r = r.toLowerCase();
    if (SHARED.test(r)) return 0;
    for (const [re, gb] of VRAM) if (re.test(r)) return gb;
    return /nvidia|geforce|quadro|radeon|arc/.test(r) ? 4 : 0;
  };
  const gpuName = (r) => {
    let s = String(r || '');
    const m = s.match(/^ANGLE \((.*)\)$/);
    if (m) { const p = m[1].split(', '); s = p.length > 1 ? p[1] : p[0]; }
    return s.replace(/ANGLE Metal Renderer:\s*/i, '').replace(/\(0x[0-9a-f]+\)/gi, '').replace(/\s(Direct3D|OpenGL|Vulkan|Metal).*$/i, '').replace(/\s+/g, ' ').trim();
  };

  const VS = '#version 300 es\nvoid main(){vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);gl_Position=vec4(p,0.,1.);}';
  const FS = '#version 300 es\nprecision highp float;uniform float u;out vec4 o;void main(){vec3 a=vec3(gl_FragCoord.xy/1024.,u);for(int i=0;i<64;i++){a=fract(a*1.37+sin(a.yzx*6.2831+float(i)*.1));}o=vec4(a,1.);}';

  function probeGpu() {
    const r = { gl2: false, caveat: false, renderer: '', ms: null };
    const opt = { powerPreference: 'high-performance', antialias: false, depth: false, stencil: false };
    let gl = null;
    try {
      gl = document.createElement('canvas').getContext('webgl2', { ...opt, failIfMajorPerformanceCaveat: true });
      if (!gl) { gl = document.createElement('canvas').getContext('webgl2', opt); r.caveat = !!gl; }
    } catch { gl = null; }
    if (!gl) return r;
    r.gl2 = true;
    try {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      r.renderer = String((ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || '');
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
      if (gl.getProgramParameter(p, gl.LINK_STATUS)) {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 1024, 1024);
        gl.bindFramebuffer(gl.FRAMEBUFFER, gl.createFramebuffer());
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.viewport(0, 0, 1024, 1024); gl.useProgram(p); gl.bindVertexArray(gl.createVertexArray());
        const u = gl.getUniformLocation(p, 'u'), px = new Uint8Array(4);
        const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const pass = (i) => { gl.uniform1f(u, i * 0.001); gl.drawArrays(gl.TRIANGLES, 0, 3); };
        pass(0); sync();
        let n = 0, batch = 1;
        const t0 = performance.now();
        for (;;) {
          for (let k = 0; k < batch; k++) pass(++n);
          sync();
          const dt = performance.now() - t0;
          if (dt > 150 || n >= 512) { r.ms = dt / n; break; }
          if (dt < 20) batch = Math.min(64, batch * 2);
        }
      }
    } catch {}
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return r;
  }

  function probeCpu() {
    let x = 1, n = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 50) {
      for (let i = 0; i < 20000; i++) x = (Math.imul(x, 1664525) + 1013904223 + i) | 0;
      n++;
    }
    return x === 0.5 ? 0 : n / (performance.now() - t0) / CPU_BASE;
  }

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const tMc = (vi, en) => (window.DEVSTU_I18N && window.DEVSTU_I18N.getLang() === 'en' ? en : vi);
  let lastRes = null;

  function renderResult(res) {
    const { g, cores, mem, webgpu, gb, edit, ai } = res;
    const lvEdit = [
      tMc('Không hỗ trợ WebGL 2', 'No WebGL 2 support'),
      tMc('Chạy cơ bản', 'Basic'),
      tMc('Mượt mà', 'Smooth'),
      tMc('Rất nhanh', 'Very Fast')
    ];
    const lvAi = [
      tMc('Không hỗ trợ', 'Unsupported'),
      tMc('Chạy CPU/WASM', 'CPU / WASM mode'),
      tMc('WebGPU khá nhanh', 'Fast WebGPU'),
      tMc('WebGPU RTX siêu tốc', 'Ultra-fast WebGPU RTX')
    ];
    const tip = !g.gl2
      ? tMc('Hãy bật Tăng tốc phần cứng (Hardware Acceleration) hoặc cài bản Desktop DEVSTU.', 'Enable Hardware Acceleration in your browser or install the DEVSTU Desktop app.')
      : gb >= 6
      ? tMc('Máy có card rời mạnh: bản Desktop DEVSTU (Tauri + Rust SIMD + WebGPU) sẽ xử lý BiRefNet, LaMa và U-Net Skin AI cực nhanh.', 'Dedicated GPU detected: DEVSTU Desktop (Tauri + Rust SIMD + WebGPU) will run BiRefNet, LaMa, and U-Net Skin AI at top speed.')
      : tMc('Cấu hình đáp ứng tốt chỉnh ảnh RAW 16-bit & màu Oklab trên DEVSTU. Dùng bản Desktop Tauri để tối ưu RAM và đa luồng Rust SIMD.', 'Well suited for 16-bit RAW & Oklab grading on DEVSTU. Use the Tauri Desktop app for optimal RAM and multi-threaded Rust SIMD.');

    const row = (k, names, v) => {
      const d = el('div', 'hm-mc__row');
      const b = el('b', 'hm-mc__lv', names[v]);
      b.dataset.lv = String(v);
      d.append(el('span', 'hm-mc__k', k), b);
      return d;
    };
    const dl = el('dl', 'hm-mc__info');
    const add = (k, v) => { const d = document.createElement('div'); d.append(el('dt', null, k), el('dd', null, v)); dl.append(d); };
    add(tMc('Card đồ hoạ', 'GPU'), gpuName(g.renderer) || tMc('Trình duyệt ẩn tên GPU', 'Hidden by browser'));
    add('CPU', cores ? tMc(`${cores} luồng`, `${cores} threads`) : tMc('Không xác định', 'Unknown'));
    add(tMc('RAM trình duyệt', 'Browser RAM'), mem ? (mem >= 8 ? tMc('8 GB trở lên', '8 GB or more') : `${mem} GB`) : tMc('Không xác định', 'Unknown'));
    add('WebGPU', webgpu ? tMc('Có hỗ trợ', 'Supported') : tMc('Dùng WASM SIMD fallback', 'WASM SIMD fallback'));

    out.replaceChildren(
      row(tMc('Chỉnh ảnh & RAW 16-bit', 'Editing & 16-bit RAW'), lvEdit, edit),
      row(tMc('Mô hình AI (BiRefNet / Skin AI)', 'AI Models (BiRefNet / Skin AI)'), lvAi, ai),
      el('p', 'hm-mc__tip', tip),
      dl,
      el('p', 'hm-mc__note', tMc(
        'Ước lượng trực tiếp trên trình duyệt. Bản cài đặt Windows DEVSTU đọc đầy đủ VRAM card rời & tận dụng toàn bộ nhân CPU qua Rust SIMD.',
        'Estimated live in your browser. The Windows DEVSTU Desktop app accesses full discrete VRAM and all CPU cores via Rust SIMD.'
      ))
    );
    out.hidden = false;
    go.textContent = tMc('Kiểm tra lại', 'Run again');
  }

  if (window.DEVSTU_I18N) {
    window.DEVSTU_I18N.onChange(() => {
      if (lastRes) renderResult(lastRes);
    });
  }

  go.addEventListener('click', () => {
    go.disabled = true;
    go.textContent = tMc('Đang đo GPU & CPU…', 'Benchmarking GPU & CPU…');
    requestAnimationFrame(() => setTimeout(() => {
      const g = probeGpu();
      const cores = navigator.hardwareConcurrency || 0;
      const mem = navigator.deviceMemory || 0;
      const webgpu = 'gpu' in navigator;
      const cpu = probeCpu();
      const soft = g.caveat || SOFT.test(g.renderer);
      const gb = guessVram(g.renderer);
      const score = g.ms ? INTEL_MS / g.ms : null;

      let edit = !g.gl2 ? 0 : soft ? 1 : score == null ? (gb ? 3 : 2) : score >= FAST ? 3 : score >= OK ? 2 : 1;
      if (cores && cores <= 2) edit = Math.min(edit, 1);
      if (cpu < CPU_SLOW) edit = Math.min(edit, 1);

      let ai = !g.gl2 ? 0 : (gb >= 8 || /apple m\d+ (pro|max|ultra)/i.test(g.renderer) ? 3 : 2);
      if (!webgpu || soft || (cores && cores <= 4) || (mem && mem < 8)) ai = Math.min(ai, 1);
      if (edit <= 1) ai = Math.min(ai, 1);

      lastRes = { g, cores, mem, webgpu, gb, edit, ai };
      renderResult(lastRes);
      go.disabled = false;
    }, 30));
  });
})();

// Shared Color Look Link (?m=...) — 100% compatible with DEVSTU Desktop v1 preset encoder/decoder
(() => {
  const banner = document.querySelector('[data-m-banner]');
  const box = document.querySelector('[data-m-box]');
  if (!banner && !box) return;

  const MAX_LEN = 32 * 1024;
  const SHARE_ORIGIN = 'https://devstu.vercel.app/';
  const t = (vi, en) => (window.DEVSTU_I18N && window.DEVSTU_I18N.getLang() === 'en' ? en : vi);
  const clamp = (v, lo, hi, def = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
  };

  function encodePreset(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeToken(tok) {
    if (!tok || tok.length > MAX_LEN || !/^[A-Za-z0-9_-]+$/.test(tok)) return null;
    try {
      const b64 = tok.replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      const r = JSON.parse(new TextDecoder().decode(bytes));
      if (!r || r.v !== 1 || typeof r.name !== 'string' || !r.tone || !r.presence || !r.look) return null;
      return {
        v: 1,
        name: r.name.trim().slice(0, 60) || t('Bộ màu DEVSTU', 'DEVSTU Look'),
        tone: {
          contrast: clamp(r.tone.contrast, -100, 100),
          highlights: clamp(r.tone.highlights, -100, 100),
          shadows: clamp(r.tone.shadows, -100, 100),
          whites: clamp(r.tone.whites, -100, 100),
          blacks: clamp(r.tone.blacks, -100, 100)
        },
        presence: {
          vibrance: clamp(r.presence.vibrance, -100, 100),
          saturation: clamp(r.presence.saturation, -100, 100),
          texture: clamp(r.presence.texture, -100, 100),
          clarity: clamp(r.presence.clarity, -100, 100)
        },
        look: {
          id: typeof r.look.id === 'string' ? r.look.id.slice(0, 40) : null,
          amount: clamp(r.look.amount, 0, 100, 70),
          skin: clamp(r.look.skin, 0, 100),
          person: clamp(r.look.person, 0, 100, 100),
          adapt: clamp(r.look.adapt, 0, 1)
        },
        wb: r.wb ? { temp: clamp(r.wb.temp, -100, 100), tint: clamp(r.wb.tint, -100, 100) } : null,
        skin: r.skin ? { ai: clamp(r.skin.ai, 0, 100), smooth: clamp(r.skin.smooth, 0, 100) } : null,
        effects: r.effects ? { grain: clamp(r.effects.grain, 0, 100), vignette: clamp(r.effects.vignette, -100, 100) } : null,
        raw: r
      };
    } catch {
      return null;
    }
  }

  function parseLookInput(input) {
    const clean = String(input || '').trim().slice(0, MAX_LEN + 4096);
    if (!clean) return null;
    const m = /[?&]m=([A-Za-z0-9_-]+)/.exec(clean);
    const token = m ? m[1] : clean;
    const preset = decodeToken(token);
    return preset ? { token, preset } : null;
  }

  const SAMPLES = {
    'chieu-muon': {
      lookIndex: 1,
      data: {
        v: 1,
        name: 'Chiều ấm nắng',
        tone: { contrast: 10, highlights: -16, shadows: 20, whites: 8, blacks: -6 },
        presence: { vibrance: 14, saturation: 5, texture: 0, clarity: 6 },
        look: { id: 'chieu-muon', amount: 80, skin: 20, person: 100, adapt: 1 },
        wb: { temp: 16, tint: 4 },
        skin: { ai: 45, smooth: 35 },
        effects: { grain: 8, vignette: -12 }
      }
    },
    'han-quoc': {
      lookIndex: 2,
      data: {
        v: 1,
        name: 'Hàn Quốc sáng',
        tone: { contrast: -6, highlights: -12, shadows: 28, whites: 14, blacks: 6 },
        presence: { vibrance: 10, saturation: -4, texture: 0, clarity: -4 },
        look: { id: 'han-quoc', amount: 75, skin: 35, person: 100, adapt: 1 },
        wb: { temp: -6, tint: 8 },
        skin: { ai: 65, smooth: 50 },
        effects: { grain: 0, vignette: 0 }
      }
    },
    'da-trang-hong': {
      lookIndex: 2,
      data: {
        v: 1,
        name: 'Da trắng hồng',
        tone: { contrast: 6, highlights: -10, shadows: 24, whites: 12, blacks: 0 },
        presence: { vibrance: 8, saturation: -2, texture: 0, clarity: 2 },
        look: { id: 'da-trang-hong', amount: 78, skin: 40, person: 100, adapt: 1 },
        wb: { temp: -4, tint: 10 },
        skin: { ai: 70, smooth: 55 },
        effects: { grain: 0, vignette: 0 }
      }
    },
    'cuoi-nhe-nhang': {
      lookIndex: 2,
      data: {
        v: 1,
        name: 'Cưới nhẹ nhàng',
        tone: { contrast: -8, highlights: -18, shadows: 30, whites: 10, blacks: 8 },
        presence: { vibrance: 6, saturation: -8, texture: 0, clarity: -2 },
        look: { id: 'cuoi-nhe-nhang', amount: 80, skin: 30, person: 100, adapt: 1 },
        wb: { temp: 4, tint: 4 },
        skin: { ai: 55, smooth: 45 },
        effects: { grain: 4, vignette: -4 }
      }
    },
    'co-dien': {
      lookIndex: 3,
      data: {
        v: 1,
        name: 'Film cổ điển',
        tone: { contrast: 14, highlights: -22, shadows: 14, whites: -4, blacks: 12 },
        presence: { vibrance: 4, saturation: -14, texture: 6, clarity: 8 },
        look: { id: 'co-dien', amount: 85, skin: 15, person: 100, adapt: 1 },
        wb: { temp: 12, tint: -2 },
        skin: { ai: 30, smooth: 25 },
        effects: { grain: 26, vignette: -18 }
      }
    },
    'trong-treo': {
      lookIndex: 4,
      data: {
        v: 1,
        name: 'Trong trẻo',
        tone: { contrast: 12, highlights: -10, shadows: 18, whites: 12, blacks: -8 },
        presence: { vibrance: 16, saturation: 6, texture: 8, clarity: 10 },
        look: { id: 'trong-treo', amount: 72, skin: 25, person: 100, adapt: 1 },
        wb: { temp: -6, tint: 2 },
        skin: { ai: 50, smooth: 40 },
        effects: { grain: 0, vignette: -6 }
      }
    },
    'bien-xanh': {
      lookIndex: 4,
      data: {
        v: 1,
        name: 'Biển xanh',
        tone: { contrast: 14, highlights: -14, shadows: 16, whites: 10, blacks: -6 },
        presence: { vibrance: 22, saturation: 10, texture: 6, clarity: 12 },
        look: { id: 'bien-xanh', amount: 82, skin: 20, person: 100, adapt: 1 },
        wb: { temp: -10, tint: -2 },
        skin: { ai: 35, smooth: 25 },
        effects: { grain: 0, vignette: -8 }
      }
    },
    'den-trang-mem': {
      lookIndex: 3,
      data: {
        v: 1,
        name: 'Đen trắng mềm',
        tone: { contrast: 12, highlights: -12, shadows: 20, whites: 10, blacks: 8 },
        presence: { vibrance: 0, saturation: -100, texture: 6, clarity: 8 },
        look: { id: 'den-trang-mem', amount: 100, skin: 20, person: 100, adapt: 1 },
        wb: { temp: 0, tint: 0 },
        skin: { ai: 40, smooth: 30 },
        effects: { grain: 16, vignette: -14 }
      }
    }
  };

  const fmtSign = (n) => (n > 0 ? `+${n}` : String(n));

  function buildChips(p) {
    const chips = [];
    if (p.look.id) chips.push(`${p.look.id} · ${p.look.amount}%`);
    if (p.wb?.temp) chips.push(t(`Ám xanh / vàng ${fmtSign(p.wb.temp)}`, `Temp ${fmtSign(p.wb.temp)}`));
    if (p.wb?.tint) chips.push(t(`Sắc thái ${fmtSign(p.wb.tint)}`, `Tint ${fmtSign(p.wb.tint)}`));
    if (p.tone.contrast) chips.push(t(`Tương phản ${fmtSign(p.tone.contrast)}`, `Contrast ${fmtSign(p.tone.contrast)}`));
    if (p.tone.highlights) chips.push(t(`Vùng sáng ${fmtSign(p.tone.highlights)}`, `Highlights ${fmtSign(p.tone.highlights)}`));
    if (p.tone.shadows) chips.push(t(`Vùng tối ${fmtSign(p.tone.shadows)}`, `Shadows ${fmtSign(p.tone.shadows)}`));
    if (p.presence.vibrance) chips.push(t(`Màu tươi ${fmtSign(p.presence.vibrance)}`, `Vibrance ${fmtSign(p.presence.vibrance)}`));
    if (p.presence.saturation) chips.push(t(`Bão hoà ${fmtSign(p.presence.saturation)}`, `Saturation ${fmtSign(p.presence.saturation)}`));
    if (p.presence.clarity) chips.push(t(`Độ trong ${fmtSign(p.presence.clarity)}`, `Clarity ${fmtSign(p.presence.clarity)}`));
    if (p.skin?.ai) chips.push(t(`Da AI ${p.skin.ai}`, `Skin AI ${p.skin.ai}`));
    if (p.effects?.grain) chips.push(t(`Hạt phim ${p.effects.grain}`, `Grain ${p.effects.grain}`));
    if (p.effects?.vignette) chips.push(t(`Tối góc ${fmtSign(p.effects.vignette)}`, `Vignette ${fmtSign(p.effects.vignette)}`));
    return chips;
  }

  function makeCard(parsed, opts = {}) {
    const wrap = document.createElement('div');
    if (!parsed) {
      wrap.className = 'dv-m-card dv-m-card--err';
      const msg = document.createElement('p');
      msg.className = 'dv-m-card__note';
      msg.style.color = '#fca5a5';
      msg.textContent = t(
        'Link này không chứa bộ màu DEVSTU hợp lệ. Vui lòng dán link dạng devstu.vercel.app/?m=... xuất từ mục Chia sẻ bộ màu.',
        'This link does not contain a valid DEVSTU look. Paste a devstu.vercel.app/?m=... link exported from Share Look.'
      );
      wrap.append(msg);
      return wrap;
    }

    const { token, preset } = parsed;
    const shareUrl = `${SHARE_ORIGIN}?m=${token}`;
    wrap.className = 'dv-m-card';

    const top = document.createElement('div');
    top.className = 'dv-m-card__top';
    const badge = document.createElement('span');
    badge.className = 'dv-m-card__badge';
    badge.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';
    badge.append(document.createTextNode(opts.fromUrl
      ? t('Có người gửi bạn một bộ màu DEVSTU', 'Someone sent you a DEVSTU look')
      : t('Đã nhận diện bộ màu DEVSTU', 'DEVSTU Look decoded')));
    top.append(badge);

    if (opts.onClose) {
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'dv-m-card__x';
      x.setAttribute('aria-label', t('Đóng', 'Close'));
      x.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"></path></svg>';
      x.addEventListener('click', opts.onClose);
      top.append(x);
    }

    const name = document.createElement('h4');
    name.className = 'dv-m-card__name';
    name.textContent = preset.name;

    const chipsEl = document.createElement('div');
    chipsEl.className = 'dv-m-chips';
    for (const c of buildChips(preset)) {
      const sp = document.createElement('span');
      sp.textContent = c;
      chipsEl.append(sp);
    }

    const urlEl = document.createElement('div');
    urlEl.className = 'dv-m-card__url';
    urlEl.title = shareUrl;
    urlEl.textContent = shareUrl;

    const acts = document.createElement('div');
    acts.className = 'dv-m-card__acts';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'hm-btn';
    copyBtn.textContent = t('Sao chép link bộ màu', 'Copy look link');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        copyBtn.textContent = t('Đã sao chép link!', 'Link copied!');
        setTimeout(() => { copyBtn.textContent = t('Sao chép link bộ màu', 'Copy look link'); }, 1800);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        document.body.append(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        copyBtn.textContent = t('Đã sao chép link!', 'Link copied!');
        setTimeout(() => { copyBtn.textContent = t('Sao chép link bộ màu', 'Copy look link'); }, 1800);
      }
    });

    const dlJsonBtn = document.createElement('button');
    dlJsonBtn.type = 'button';
    dlJsonBtn.className = 'hm-btn hm-btn--ghost';
    dlJsonBtn.textContent = t('Tải file preset .json', 'Download .json preset');
    dlJsonBtn.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(preset.raw, null, 2)], { type: 'application/json' });
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = `${(preset.look.id || 'devstu-look').replace(/[^a-z0-9_-]/gi, '-')}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
    });

    const dlApp = document.createElement('a');
    dlApp.className = 'hm-btn hm-btn--ghost';
    dlApp.href = window.DEVSTU_I18N && window.DEVSTU_I18N.getLang() === 'en' ? '/en/download/' : '/tai-xuong/';
    dlApp.textContent = t('Tải DEVSTU để áp vào ảnh', 'Download DEVSTU to apply');

    acts.append(copyBtn, dlJsonBtn, dlApp);

    const note = document.createElement('p');
    note.className = 'dv-m-card__note';
    note.textContent = t(
      'Dán link này vào mục “Mở link bộ màu” trong ứng dụng DEVSTU Desktop để lưu và áp ngay lên ảnh RAW của bạn.',
      'Paste this link into “Open a look link” inside DEVSTU Desktop to save and apply it directly to your RAW photos.'
    );

    wrap.append(top, name);
    if (chipsEl.childNodes.length) wrap.append(chipsEl);
    wrap.append(urlEl, acts, note);
    return wrap;
  }

  let activeBannerState = null;
  let activeBoxState = null;

  function renderBanner() {
    if (!banner) return;
    if (!activeBannerState) {
      banner.hidden = true;
      banner.replaceChildren();
      return;
    }
    banner.hidden = false;
    banner.replaceChildren(makeCard(activeBannerState.parsed, {
      fromUrl: true,
      onClose: () => {
        activeBannerState = null;
        renderBanner();
      }
    }));
  }

  const form = box?.querySelector('[data-m-form]');
  const input = box?.querySelector('[data-m-input]');
  const out = box?.querySelector('[data-m-out]');

  function renderBox() {
    if (!out) return;
    if (!activeBoxState) {
      out.hidden = true;
      out.replaceChildren();
      return;
    }
    out.hidden = false;
    out.replaceChildren(makeCard(activeBoxState.parsed, { fromUrl: false }));
  }

  if (form && input && out) {
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const parsed = parseLookInput(input.value);
      activeBoxState = { parsed };
      renderBox();
      if (parsed && window.history && typeof window.history.replaceState === 'function' && location.protocol !== 'file:') {
        const u = new URL(location.href);
        u.searchParams.set('m', parsed.token);
        history.replaceState(null, '', u.pathname + u.search + u.hash);
      }
    });

    for (const btn of document.querySelectorAll('[data-m-sample]')) {
      btn.addEventListener('click', () => {
        const key = btn.dataset.mSample;
        const s = SAMPLES[key];
        if (!s) return;
        const tok = encodePreset(s.data);
        const link = `${SHARE_ORIGIN}?m=${tok}`;
        input.value = link;
        const parsed = parseLookInput(link);
        activeBoxState = { parsed };
        renderBox();
        if (window.history && typeof window.history.replaceState === 'function' && location.protocol !== 'file:') {
          const u = new URL(location.href);
          u.searchParams.set('m', tok);
          history.replaceState(null, '', u.pathname + u.search + u.hash);
        }
        if (btn.closest('[data-lut-lib]')) {
          box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        const heroLook = document.querySelector(`[data-hm-app] [data-look="${s.lookIndex}"]`);
        if (heroLook) heroLook.click();
      });
    }
  }

  // LUT Library category filter tabs
  const lutLib = document.querySelector('[data-lut-lib]');
  if (lutLib) {
    const tabs = [...lutLib.querySelectorAll('[data-lut-cat]')];
    const cards = [...lutLib.querySelectorAll('[data-lut-tags]')];
    for (const tab of tabs) {
      tab.addEventListener('click', () => {
        const cat = tab.dataset.lutCat;
        tabs.forEach((x) => x.setAttribute('aria-pressed', String(x === tab)));
        cards.forEach((c) => {
          const tags = (c.dataset.lutTags || '').split(/\s+/);
          c.hidden = cat !== 'all' && !tags.includes(cat);
        });
      });
    }
  }

  // Check URL ?m=... on initial load
  try {
    const mParam = new URLSearchParams(location.search).get('m');
    if (mParam !== null) {
      const parsed = parseLookInput(`?m=${mParam}`);
      activeBannerState = { parsed };
      renderBanner();
      if (input && out && parsed) {
        input.value = `${SHARE_ORIGIN}?m=${parsed.token}`;
        activeBoxState = { parsed };
        renderBox();
      }
    }
  } catch {}

  if (window.DEVSTU_I18N) {
    window.DEVSTU_I18N.onChange(() => {
      renderBanner();
      renderBox();
    });
  }
})();
