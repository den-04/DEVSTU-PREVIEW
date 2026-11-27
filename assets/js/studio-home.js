// DEVSTU Studio Pro Bento Homepage Controller
(() => {
  'use strict';

  const root = document.getElementById('ds-home');
  if (!root) return;
  root.classList.add('ds-js');

  const STUDIO = '/assets/img/studio/';
  const isEn = () => Boolean(window.DEVSTU_I18N && window.DEVSTU_I18N.getLang() === 'en');
  const t = (vi, en) => (isEn() ? en : vi);

  // 1. Scroll reveal ([data-ds-rv])
  const rvNodes = [...root.querySelectorAll('[data-ds-rv]')];
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('ds-in');
          io.unobserve(e.target);
        }
      }
    }, { rootMargin: '0px 0px -8% 0px' });
    rvNodes.forEach((n) => io.observe(n));
  } else {
    rvNodes.forEach((n) => n.classList.add('ds-in'));
  }

  // 2. Draggable Before/After Comparisons ([data-ds-cmp]) using clip-path
  for (const box of root.querySelectorAll('[data-ds-cmp]')) {
    const range = box.querySelector('input[type="range"]');
    if (!range) continue;
    const syncPos = () => box.style.setProperty('--pos', `${range.value}%`);
    range.addEventListener('input', syncPos);
    syncPos();
  }

  // 3. 3-Column Darkroom Workstation Interactive Demo
  const wk = root.querySelector('[data-ds-workstation]');
  if (wk) {
    const cmp = wk.querySelector('[data-ds-cmp]');
    const imgRaw = wk.querySelector('[data-ds-raw]');
    const imgAfter = wk.querySelector('[data-ds-after]');
    const shotBtns = [...wk.querySelectorAll('[data-ds-shot]')];
    const modeBtns = [...wk.querySelectorAll('[data-ds-mode]')];
    const autoBtn = wk.querySelector('[data-ds-auto]');
    const lookBtns = [...wk.querySelectorAll('[data-ds-look]')];
    const resetBtn = wk.querySelector('[data-ds-look-reset]');
    const cmpToggle = wk.querySelector('[data-ds-compare]');
    const syncBtn = wk.querySelector('[data-ds-sync]');
    const badgeEl = wk.querySelector('[data-ds-badge]');
    const countEl = wk.querySelector('[data-ds-count]');

    const slExp = wk.querySelector('[data-ds-sl="exp"]');
    const slTemp = wk.querySelector('[data-ds-sl="temp"]');
    const slCon = wk.querySelector('[data-ds-sl="con"]');
    const slSkin = wk.querySelector('[data-ds-sl="skin"]');

    const rangeExp = wk.querySelector('[data-ds-range="exp"]');
    const rangeTemp = wk.querySelector('[data-ds-range="temp"]');
    const rangeCon = wk.querySelector('[data-ds-range="con"]');
    const rangeSkin = wk.querySelector('[data-ds-range="skin"]');

    const PRESETS = {
      0: { exp: 25, temp: 5600, con: 12, skin: 75 },
      1: { exp: 35, temp: 6150, con: 18, skin: 78 },
      2: { exp: 55, temp: 5200, con: -8, skin: 85 },
      3: { exp: 30, temp: 5450, con: 6,  skin: 82 },
      4: { exp: 15, temp: 5900, con: 24, skin: 65 }
    };

    const makeShotState = (done) => ({
      auto: true,
      userDisabled: false,
      look: 0,
      done,
      ...PRESETS[0]
    });

    const shots = {
      1: makeShotState(true),
      2: makeShotState(false),
      3: makeShotState(false),
      4: makeShotState(false),
      5: makeShotState(false),
      6: makeShotState(false)
    };

    const ws = { shot: 1, allSynced: false };

    const getRawSrc = (n) => (n === 1 ? `${STUDIO}hero-raw.webp` : `${STUDIO}shoot-${n}-raw.webp`);
    const getAfterSrc = (n, s) => {
      if (!s.done || !s.auto) return getRawSrc(n);
      if (s.look >= 1 && s.look <= 4) {
        return n === 1 ? `${STUDIO}hero-look-${s.look}.webp` : `${STUDIO}shoot-${n}-look-${s.look}.webp`;
      }
      return n === 1 ? `${STUDIO}hero-auto.webp` : `${STUDIO}shoot-${n}-edit.webp`;
    };
    const getThumbSrc = (n, s) => {
      if (!s.done || !s.auto) return `${STUDIO}shoot-${n}-raw-240.webp`;
      if (s.look >= 1 && s.look <= 4) {
        return n === 1 ? `${STUDIO}hero-look-${s.look}-240.webp` : `${STUDIO}shoot-${n}-look-${s.look}-240.webp`;
      }
      return `${STUDIO}shoot-${n}-edit-240.webp`;
    };

    const computeFilter = (s) => {
      if (!s.done || !s.auto) return '';
      const base = PRESETS[s.look] || PRESETS[0];
      const dExp = (s.exp - base.exp) / 100;
      const dCon = (s.con - base.con) / 100;
      const dTemp = (s.temp - base.temp) / 1400;
      const dSkin = (s.skin - base.skin) / 100;
      if (dExp === 0 && dCon === 0 && dTemp === 0 && dSkin === 0) return '';

      const parts = [];
      const bright = Math.max(0.65, Math.min(1.45, 1 + dExp * 0.42 + dSkin * 0.04));
      if (Math.abs(bright - 1) > 0.002) parts.push(`brightness(${bright.toFixed(3)})`);

      const con = Math.max(0.70, Math.min(1.40, 1 + dCon * 0.50));
      if (Math.abs(con - 1) > 0.002) parts.push(`contrast(${con.toFixed(3)})`);

      if (dTemp > 0.005) {
        parts.push(`sepia(${(dTemp * 0.22).toFixed(3)})`);
        parts.push(`saturate(${(1 + dTemp * 0.14).toFixed(3)})`);
      } else if (dTemp < -0.005) {
        parts.push(`hue-rotate(${(dTemp * 14).toFixed(1)}deg)`);
        parts.push(`saturate(${(1 + Math.abs(dTemp) * 0.06).toFixed(3)})`);
      }
      return parts.join(' ');
    };

    const setMeter = (el, inp, text, pct, rawVal) => {
      if (!el) return;
      const sp = el.querySelector('span');
      const track = el.querySelector('.ds-meter__track');
      if (sp) sp.textContent = text;
      if (track) track.style.setProperty('--v', pct);
      if (inp && rawVal !== undefined) inp.value = String(rawVal);
    };

    const setImg = (img, src) => {
      if (img && img.getAttribute('src') !== src) img.src = src;
    };

    const paintWs = () => {
      const n = ws.shot;
      const cur = shots[n];

      setImg(imgRaw, getRawSrc(n));
      setImg(imgAfter, getAfterSrc(n, cur));
      if (imgAfter) imgAfter.style.filter = computeFilter(cur);

      if (autoBtn) {
        autoBtn.setAttribute('aria-pressed', String(cur.auto));
        const txt = autoBtn.querySelector('[data-ds-auto-lbl]');
        if (txt) txt.textContent = cur.auto ? t('AI Auto-Retouch: Bật', 'AI Auto-Retouch: On') : t('Chỉnh giúp tôi (Auto)', 'Auto-Retouch Off');
      }

      const lookPrefix = n === 1 ? 'hero' : `shoot-${n}`;
      for (const b of lookBtns) {
        const k = Number(b.dataset.dsLook);
        b.setAttribute('aria-pressed', String(cur.auto && k === cur.look));
        setImg(b.querySelector('img'), `${STUDIO}${lookPrefix}-look-${k}-240.webp`);
      }
      if (resetBtn) resetBtn.setAttribute('aria-pressed', String(cur.auto && cur.look === 0));

      let doneCount = 0;
      for (const s of shotBtns) {
        const sn = Number(s.dataset.dsShot);
        const st = shots[sn];
        const isEdited = st.done && st.auto;
        if (st.done) doneCount++;
        s.setAttribute('aria-pressed', String(sn === n));
        s.classList.toggle('done', isEdited);
        setImg(s.querySelector('img'), getThumbSrc(sn, st));
        const stSpan = s.querySelector('[data-ds-shot-st]');
        if (stSpan) {
          stSpan.textContent = isEdited ? t('Đã chỉnh', 'Edited') : (st.done ? t('Tắt AI', 'AI Off') : t('Ảnh RAW', 'RAW'));
        }
      }

      if (badgeEl) badgeEl.textContent = t(`Ảnh ${n} / 6`, `Shot ${n} / 6`);
      if (countEl) countEl.textContent = t(`6 ảnh · đã chỉnh ${doneCount}`, `6 shots · ${doneCount} edited`);
      if (syncBtn) {
        syncBtn.disabled = ws.allSynced;
        syncBtn.textContent = ws.allSynced ? t('✓ Đã đồng bộ cả 6 ảnh', '✓ Synced all 6 photos') : t('Đồng bộ cả 6 ảnh', 'Sync all 6 shots');
      }

      if (cur.auto) {
        const expText = `${cur.exp >= 0 ? '+' : ''}${(cur.exp / 100).toFixed(2)} EV`;
        const conText = `${cur.con >= 0 ? '+' : ''}${cur.con}`;
        setMeter(slExp, rangeExp, expText, `${Math.max(0, Math.min(100, (cur.exp + 100) / 2))}%`, cur.exp);
        setMeter(slTemp, rangeTemp, `${cur.temp}K`, `${Math.max(0, Math.min(100, (cur.temp - 4200) / 28))}%`, cur.temp);
        setMeter(slCon, rangeCon, conText, `${Math.max(0, Math.min(100, cur.con + 50))}%`, cur.con);
        setMeter(slSkin, rangeSkin, `AI ${cur.skin}%`, `${Math.max(0, Math.min(100, cur.skin))}%`, cur.skin);
      } else {
        setMeter(slExp, rangeExp, '0.00 EV', '50%', 0);
        setMeter(slTemp, rangeTemp, '5500K', '46.4%', 5500);
        setMeter(slCon, rangeCon, '0', '50%', 0);
        setMeter(slSkin, rangeSkin, '0%', '0%', 0);
      }
    };

    const runSync = () => {
      if (ws.allSynced) return;
      const src = shots[ws.shot];
      if (!src.auto) {
        src.auto = true;
        src.userDisabled = false;
      }
      src.done = true;
      const tpl = { look: src.look, exp: src.exp, temp: src.temp, con: src.con, skin: src.skin };
      ws.allSynced = true;
      paintWs();

      shotBtns.forEach((btn, idx) => {
        const sn = Number(btn.dataset.dsShot);
        setTimeout(() => {
          Object.assign(shots[sn], tpl, { auto: true, userDisabled: false, done: true });
          paintWs();
        }, 90 * idx);
      });
    };

    shotBtns.forEach((btn) => btn.addEventListener('click', () => {
      const n = Number(btn.dataset.dsShot) || 1;
      ws.shot = n;
      const st = shots[n];
      st.done = true;
      if (!st.userDisabled) st.auto = true;
      paintWs();
    }));

    modeBtns.forEach((btn) => btn.addEventListener('click', () => {
      modeBtns.forEach((x) => {
        const on = x === btn;
        x.classList.toggle('on', on);
        x.setAttribute('aria-selected', String(on));
      });
      if (btn.dataset.dsMode === 'sync') runSync();
    }));

    autoBtn?.addEventListener('click', () => {
      const cur = shots[ws.shot];
      cur.done = true;
      cur.auto = !cur.auto;
      cur.userDisabled = !cur.auto;
      ws.allSynced = false;
      paintWs();
    });

    lookBtns.forEach((btn) => btn.addEventListener('click', () => {
      const cur = shots[ws.shot];
      const k = Number(btn.dataset.dsLook) || 1;
      cur.done = true;
      cur.auto = true;
      cur.userDisabled = false;
      cur.look = k;
      Object.assign(cur, PRESETS[k] || PRESETS[1]);
      ws.allSynced = false;
      paintWs();
    }));

    resetBtn?.addEventListener('click', () => {
      const cur = shots[ws.shot];
      cur.done = true;
      cur.auto = true;
      cur.userDisabled = false;
      cur.look = 0;
      Object.assign(cur, PRESETS[0]);
      ws.allSynced = false;
      paintWs();
    });

    [
      ['exp', rangeExp],
      ['temp', rangeTemp],
      ['con', rangeCon],
      ['skin', rangeSkin]
    ].forEach(([key, inp]) => {
      inp?.addEventListener('input', () => {
        const cur = shots[ws.shot];
        cur.done = true;
        cur.auto = true;
        cur.userDisabled = false;
        cur[key] = Number(inp.value);
        ws.allSynced = false;
        paintWs();
      });
    });

    cmpToggle?.addEventListener('click', () => {
      const next = cmpToggle.getAttribute('aria-pressed') !== 'true';
      cmpToggle.setAttribute('aria-pressed', String(next));
      cmp?.classList.toggle('is-off', !next);
    });

    syncBtn?.addEventListener('click', runSync);

    if (window.DEVSTU_I18N) window.DEVSTU_I18N.onChange(paintWs);
    paintWs();
  }

  // 4. Smart AI Culling Filter ([data-ds-cull])
  const cullBox = root.querySelector('[data-ds-cull]');
  if (cullBox) {
    const btns = [...cullBox.querySelectorAll('[data-ds-cull-btn]')];
    const items = [...cullBox.querySelectorAll('[data-ds-cull-item]')];
    btns.forEach((btn) => btn.addEventListener('click', () => {
      const filter = btn.dataset.dsCullBtn;
      btns.forEach((x) => x.setAttribute('aria-pressed', String(x === btn)));
      items.forEach((it) => {
        const status = it.dataset.dsCullItem;
        const show = filter === 'all' || filter === status;
        it.classList.toggle('is-dim', !show);
      });
    }));
  }

  // 5. 6-Model U-Net Skin AI Lab ([data-ds-skin])
  const skinLab = root.querySelector('[data-ds-skin]');
  if (skinLab) {
    const stage = skinLab.querySelector('[data-ds-skin-stage]');
    const range = skinLab.querySelector('[data-ds-skin-range]');
    const out = skinLab.querySelector('[data-ds-skin-out]');
    const chips = [...skinLab.querySelectorAll('[data-ds-skin-preset]')];
    const noteEl = skinLab.querySelector('[data-ds-skin-note]');

    const setVal = (val) => {
      const n = Math.max(0, Math.min(100, Math.round(Number(val) || 0)));
      if (range) range.value = String(n);
      if (out) out.textContent = `${n}%`;
      if (stage) stage.style.setProperty('--skin-v', String(n / 100));
    };

    const paintNote = (c) => {
      if (noteEl && c && c.dataset.dsSkinMsg) {
        noteEl.textContent = isEn() && c.dataset.dsSkinMsgEn ? c.dataset.dsSkinMsgEn : c.dataset.dsSkinMsg;
      }
    };

    range?.addEventListener('input', () => setVal(range.value));
    chips.forEach((c) => c.addEventListener('click', () => {
      chips.forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
      setVal(c.dataset.dsSkinVal || 85);
      paintNote(c);
    }));
    if (window.DEVSTU_I18N) {
      window.DEVSTU_I18N.onChange(() => {
        paintNote(skinLab.querySelector('[data-ds-skin-preset][aria-pressed="true"]'));
      });
    }
    setVal(range?.value || 85);
  }

  // 6. 4-in-1 On-Device AI Vision Deck ([data-ds-vision])
  const vision = root.querySelector('[data-ds-vision]');
  if (vision) {
    const tabs = [...vision.querySelectorAll('[data-ds-vtab]')];
    const imgRaw = vision.querySelector('[data-ds-vraw]');
    const imgAfter = vision.querySelector('[data-ds-vafter]');
    const cap = vision.querySelector('[data-ds-vcap]');
    const MODELS = {
      bokeh: {
        raw: `${STUDIO}ai-bokeh-raw.webp`,
        after: `${STUDIO}ai-bokeh-after.webp`,
        cap: [
          'Depth Anything v2 + BiRefNet: Tạo bản đồ độ sâu trường ảnh, xóa phông quang học giữ nét từng sợi tóc.',
          'Depth Anything v2 + BiRefNet: Generates an optical lens depth map for creamy bokeh while keeping hair razor-sharp.'
        ]
      },
      sky: {
        raw: `${STUDIO}ai-sky-raw.webp`,
        after: `${STUDIO}ai-sky-after.webp`,
        cap: [
          'LK Magic Pro Sky Segmentation: Tự tách đường chân trời và phục hồi bầu trời hoàng hôn rực rỡ.',
          'LK Magic Pro Sky Segmentation: Masks the horizon automatically and restores vivid golden sunset clouds.'
        ]
      },
      denoise: {
        raw: `${STUDIO}ai-denoise-raw.webp`,
        after: `${STUDIO}ai-denoise-after.webp`,
        cap: [
          'SCUNet AI Denoise: Loại bỏ hạt nhiễu ISO cao trong ảnh thiếu sáng mà vẫn giữ sắc nét râu, tóc và vân áo.',
          'SCUNet AI Denoise: Removes high-ISO shadow grain while preserving crisp hair, stubble, and fabric detail.'
        ]
      },
      water: {
        raw: `${STUDIO}ai-water-raw.webp`,
        after: `${STUDIO}ai-water-after.webp`,
        cap: [
          'Mặt nạ vùng nước AI: Tách riêng mặt biển để đẩy sắc xanh ngọc trong trẻo mà không ám lên sắc da.',
          'AI Water Mask: Isolates ocean water to push crystal turquoise tones without shifting natural skin color.'
        ]
      }
    };
    let activeKey = 'bokeh';
    const paintCap = () => {
      const m = MODELS[activeKey];
      if (m && cap) cap.textContent = t(m.cap[0], m.cap[1]);
    };
    tabs.forEach((btn) => btn.addEventListener('click', () => {
      const k = btn.dataset.dsVtab;
      const m = MODELS[k];
      if (!m) return;
      activeKey = k;
      tabs.forEach((x) => x.setAttribute('aria-pressed', String(x === btn)));
      if (imgRaw) imgRaw.src = m.raw;
      if (imgAfter) imgAfter.src = m.after;
      paintCap();
    }));
    if (window.DEVSTU_I18N) window.DEVSTU_I18N.onChange(paintCap);
    paintCap();
  }

  // 7. Shared Look Link (?m=...) Decoder/Encoder & 8 .CUBE LUT Filter
  const banner = document.querySelector('[data-m-banner]');
  const box = document.querySelector('[data-m-box]');
  if (banner || box) {
    const MAX_LEN = 32 * 1024;
    const SHARE_ORIGIN = 'https://devstu.vercel.app/';
    const clamp = (v, lo, hi, def = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
    };
    const encodePreset = (obj) => {
      const bytes = new TextEncoder().encode(JSON.stringify(obj));
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };
    const decodeToken = (tok) => {
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
    };
    const parseLookInput = (input) => {
      const clean = String(input || '').trim().slice(0, MAX_LEN + 4096);
      if (!clean) return null;
      const m = /[?&]m=([A-Za-z0-9_-]+)/.exec(clean);
      const token = m ? m[1] : clean;
      const preset = decodeToken(token);
      return preset ? { token, preset } : null;
    };

    const SAMPLES = {
      'chieu-muon': { lookIndex: 1, data: { v: 1, name: 'Chiều ấm nắng', tone: { contrast: 10, highlights: -16, shadows: 20, whites: 8, blacks: -6 }, presence: { vibrance: 14, saturation: 5, texture: 0, clarity: 6 }, look: { id: 'chieu-muon', amount: 80, skin: 20, person: 100, adapt: 1 }, wb: { temp: 16, tint: 4 }, skin: { ai: 45, smooth: 35 }, effects: { grain: 8, vignette: -12 } } },
      'han-quoc': { lookIndex: 2, data: { v: 1, name: 'Hàn Quốc sáng', tone: { contrast: -6, highlights: -12, shadows: 28, whites: 14, blacks: 6 }, presence: { vibrance: 10, saturation: -4, texture: 0, clarity: -4 }, look: { id: 'han-quoc', amount: 75, skin: 35, person: 100, adapt: 1 }, wb: { temp: -6, tint: 8 }, skin: { ai: 65, smooth: 50 }, effects: { grain: 0, vignette: 0 } } },
      'da-trang-hong': { lookIndex: 2, data: { v: 1, name: 'Da trắng hồng', tone: { contrast: 6, highlights: -10, shadows: 24, whites: 12, blacks: 0 }, presence: { vibrance: 8, saturation: -2, texture: 0, clarity: 2 }, look: { id: 'da-trang-hong', amount: 78, skin: 40, person: 100, adapt: 1 }, wb: { temp: -4, tint: 10 }, skin: { ai: 70, smooth: 55 }, effects: { grain: 0, vignette: 0 } } },
      'cuoi-nhe-nhang': { lookIndex: 3, data: { v: 1, name: 'Cưới nhẹ nhàng', tone: { contrast: -8, highlights: -18, shadows: 30, whites: 10, blacks: 8 }, presence: { vibrance: 6, saturation: -8, texture: 0, clarity: -2 }, look: { id: 'cuoi-nhe-nhang', amount: 80, skin: 30, person: 100, adapt: 1 }, wb: { temp: 4, tint: 4 }, skin: { ai: 55, smooth: 45 }, effects: { grain: 4, vignette: -4 } } },
      'co-dien': { lookIndex: 4, data: { v: 1, name: 'Film cổ điển', tone: { contrast: 14, highlights: -22, shadows: 14, whites: -4, blacks: 12 }, presence: { vibrance: 4, saturation: -14, texture: 6, clarity: 8 }, look: { id: 'co-dien', amount: 85, skin: 15, person: 100, adapt: 1 }, wb: { temp: 12, tint: -2 }, skin: { ai: 30, smooth: 25 }, effects: { grain: 26, vignette: -18 } } },
      'trong-treo': { lookIndex: 2, data: { v: 1, name: 'Trong trẻo', tone: { contrast: 12, highlights: -10, shadows: 18, whites: 12, blacks: -8 }, presence: { vibrance: 16, saturation: 6, texture: 8, clarity: 10 }, look: { id: 'trong-treo', amount: 72, skin: 25, person: 100, adapt: 1 }, wb: { temp: -6, tint: 2 }, skin: { ai: 50, smooth: 40 }, effects: { grain: 0, vignette: -6 } } },
      'bien-xanh': { lookIndex: 2, data: { v: 1, name: 'Biển xanh', tone: { contrast: 14, highlights: -14, shadows: 16, whites: 10, blacks: -6 }, presence: { vibrance: 22, saturation: 10, texture: 6, clarity: 12 }, look: { id: 'bien-xanh', amount: 82, skin: 20, person: 100, adapt: 1 }, wb: { temp: -10, tint: -2 }, skin: { ai: 35, smooth: 25 }, effects: { grain: 0, vignette: -8 } } },
      'den-trang-mem': { lookIndex: 4, data: { v: 1, name: 'Đen trắng mềm', tone: { contrast: 12, highlights: -12, shadows: 20, whites: 10, blacks: 8 }, presence: { vibrance: 0, saturation: -100, texture: 6, clarity: 8 }, look: { id: 'den-trang-mem', amount: 100, skin: 20, person: 100, adapt: 1 }, wb: { temp: 0, tint: 0 }, skin: { ai: 40, smooth: 30 }, effects: { grain: 16, vignette: -14 } } }
    };

    const fmtSign = (n) => (n > 0 ? `+${n}` : String(n));
    const buildChips = (p) => {
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
    };

    const makeCard = (parsed, opts = {}) => {
      const wrap = document.createElement('div');
      if (!parsed) {
        wrap.className = 'dv-m-card dv-m-card--err';
        const msg = document.createElement('p');
        msg.className = 'dv-m-card__note';
        msg.style.color = '#fda4af';
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
      copyBtn.className = 'ds-btn ds-btn--sm';
      copyBtn.textContent = t('Sao chép link bộ màu', 'Copy look link');
      copyBtn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(shareUrl); } catch {
          const ta = document.createElement('textarea');
          ta.value = shareUrl;
          document.body.append(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        copyBtn.textContent = t('Đã sao chép link!', 'Link copied!');
        setTimeout(() => { copyBtn.textContent = t('Sao chép link bộ màu', 'Copy look link'); }, 1800);
      });

      const dlJsonBtn = document.createElement('button');
      dlJsonBtn.type = 'button';
      dlJsonBtn.className = 'ds-btn ds-btn--ghost ds-btn--sm';
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
      dlApp.className = 'ds-btn ds-btn--ghost ds-btn--sm';
      dlApp.href = isEn() ? '/en/download/' : '/tai-xuong/';
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
    };

    let activeBannerState = null;
    let activeBoxState = null;

    const renderBanner = () => {
      if (!banner) return;
      if (!activeBannerState) {
        banner.hidden = true;
        banner.replaceChildren();
        return;
      }
      banner.hidden = false;
      banner.replaceChildren(makeCard(activeBannerState.parsed, {
        fromUrl: true,
        onClose: () => { activeBannerState = null; renderBanner(); }
      }));
    };

    const form = box?.querySelector('[data-m-form]');
    const input = box?.querySelector('[data-m-input]');
    const out = box?.querySelector('[data-m-out]');

    const renderBox = () => {
      if (!out) return;
      if (!activeBoxState) {
        out.hidden = true;
        out.replaceChildren();
        return;
      }
      out.hidden = false;
      out.replaceChildren(makeCard(activeBoxState.parsed, { fromUrl: false }));
    };

    if (form && input && out) {
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const parsed = parseLookInput(input.value);
        activeBoxState = { parsed };
        renderBox();
        if (parsed && window.history?.replaceState && location.protocol !== 'file:') {
          const u = new URL(location.href);
          u.searchParams.set('m', parsed.token);
          history.replaceState(null, '', u.pathname + u.search + u.hash);
        }
      });

      document.querySelectorAll('[data-m-sample]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const s = SAMPLES[btn.dataset.mSample];
          if (!s) return;
          const tok = encodePreset(s.data);
          const link = `${SHARE_ORIGIN}?m=${tok}`;
          input.value = link;
          const parsed = parseLookInput(link);
          activeBoxState = { parsed };
          renderBox();
          if (window.history?.replaceState && location.protocol !== 'file:') {
            const u = new URL(location.href);
            u.searchParams.set('m', tok);
            history.replaceState(null, '', u.pathname + u.search + u.hash);
          }
          if (btn.closest('[data-lut-lib]')) {
            box.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          const heroLook = document.querySelector(`[data-ds-workstation] [data-ds-look="${s.lookIndex}"]`);
          if (heroLook) heroLook.click();
        });
      });
    }

    const lutLib = document.querySelector('[data-lut-lib]');
    if (lutLib) {
      const tabs = [...lutLib.querySelectorAll('[data-lut-cat]')];
      const cards = [...lutLib.querySelectorAll('[data-lut-tags]')];
      tabs.forEach((tab) => tab.addEventListener('click', () => {
        const cat = tab.dataset.lutCat;
        tabs.forEach((x) => x.setAttribute('aria-pressed', String(x === tab)));
        cards.forEach((c) => {
          const tags = (c.dataset.lutTags || '').split(/\s+/);
          c.hidden = cat !== 'all' && !tags.includes(cat);
        });
      }));
    }

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
  }
})();
