// DEVSTU On-Device Color Profile Inspector & sRGB Exporter (100% local in browser)
(() => {
  const root = document.querySelector('[data-color-check]');
  if (!root) return;

  const drop = root.querySelector('[data-cc-drop]');
  const input = root.querySelector('[data-cc-input]');
  const resizeCb = root.querySelector('[data-cc-resize]');
  const out = root.querySelector('[data-cc-out]');
  if (!drop || !input || !out) return;

  const t = (vi, en) => (window.DEVSTU_I18N && window.DEVSTU_I18N.getLang() === 'en' ? en : vi);
  let lastItems = [];

  // Parse JPEG APP2 ICC_PROFILE chunks + APP1 EXIF ColorSpace + SOF component count (CMYK detection)
  function parseJpegMeta(buf) {
    const u8 = new Uint8Array(buf);
    const dv = new DataView(buf);
    if (u8.length < 4 || u8[0] !== 0xFF || u8[1] !== 0xD8) return { format: 'other', iccDesc: null, cmyk: false, exifColorSpace: null };
    let off = 2;
    const iccChunks = [];
    let cmyk = false;
    let exifColorSpace = null;
    while (off + 4 < u8.length) {
      if (u8[off] !== 0xFF) break;
      let marker = u8[off + 1];
      while (marker === 0xFF && off + 2 < u8.length) { off++; marker = u8[off + 1]; }
      if (marker === 0xD9 || marker === 0xDA) break;
      const len = dv.getUint16(off + 2);
      if (len < 2 || off + 2 + len > u8.length) break;
      const start = off + 4;
      const segLen = len - 2;

      // SOF0 / SOF2: component count = 4 indicates CMYK/YCCK
      if ((marker === 0xC0 || marker === 0xC2) && segLen >= 6) {
        const comps = u8[start + 5];
        if (comps === 4) cmyk = true;
      }

      // APP2: ICC_PROFILE\0
      if (marker === 0xE2 && segLen > 14) {
        let sig = '';
        for (let i = 0; i < 12; i++) sig += String.fromCharCode(u8[start + i]);
        if (sig === 'ICC_PROFILE\0') {
          const seq = u8[start + 12];
          iccChunks.push({ seq, data: u8.subarray(start + 14, start + segLen) });
        }
      }

      // APP1: Exif ColorSpace tag (0xA001: 1 = sRGB, 65535 = Uncalibrated/AdobeRGB)
      if (marker === 0xE1 && segLen > 16) {
        const text = String.fromCharCode(u8[start], u8[start + 1], u8[start + 2], u8[start + 3]);
        if (text === 'Exif') {
          exifColorSpace = readExifColorSpace(u8, start + 6, segLen - 6);
        }
      }

      off += 2 + len;
    }

    let iccDesc = null;
    if (iccChunks.length) {
      iccChunks.sort((a, b) => a.seq - b.seq);
      const total = iccChunks.reduce((s, c) => s + c.data.length, 0);
      const merged = new Uint8Array(total);
      let pos = 0;
      for (const c of iccChunks) { merged.set(c.data, pos); pos += c.data.length; }
      iccDesc = extractIccDesc(merged);
    }
    return { format: 'jpeg', iccDesc, cmyk, exifColorSpace };
  }

  function readExifColorSpace(u8, tiffStart, maxLen) {
    try {
      if (maxLen < 12) return null;
      const le = u8[tiffStart] === 0x49 && u8[tiffStart + 1] === 0x49;
      const dv = new DataView(u8.buffer, u8.byteOffset + tiffStart, maxLen);
      const u16 = (o) => dv.getUint16(o, le);
      const u32 = (o) => dv.getUint32(o, le);
      const ifd0 = u32(4);
      if (ifd0 + 2 > maxLen) return null;
      const entries = u16(ifd0);
      let exifIfd = 0;
      for (let i = 0; i < entries; i++) {
        const e = ifd0 + 2 + i * 12;
        if (e + 12 > maxLen) break;
        if (u16(e) === 0x8769) { exifIfd = u32(e + 8); break; }
      }
      if (!exifIfd || exifIfd + 2 > maxLen) return null;
      const n2 = u16(exifIfd);
      for (let i = 0; i < n2; i++) {
        const e = exifIfd + 2 + i * 12;
        if (e + 12 > maxLen) break;
        if (u16(e) === 0xA001) return u16(e + 8);
      }
    } catch {}
    return null;
  }

  function extractIccDesc(icc) {
    try {
      if (icc.length < 132) return null;
      const dv = new DataView(icc.buffer, icc.byteOffset, icc.byteLength);
      const count = dv.getUint32(128, false);
      for (let i = 0; i < count && i < 64; i++) {
        const base = 132 + i * 12;
        if (base + 12 > icc.length) break;
        const sig = String.fromCharCode(icc[base], icc[base + 1], icc[base + 2], icc[base + 3]);
        if (sig === 'desc') {
          const offset = dv.getUint32(base + 4, false);
          const size = dv.getUint32(base + 8, false);
          if (offset + 12 > icc.length) break;
          const type = String.fromCharCode(icc[offset], icc[offset + 1], icc[offset + 2], icc[offset + 3]);
          if (type === 'desc') {
            const len = Math.min(dv.getUint32(offset + 8, false), size - 12, 120);
            let s = '';
            for (let j = 0; j < len; j++) {
              const ch = icc[offset + 12 + j];
              if (ch === 0) break;
              s += String.fromCharCode(ch);
            }
            return s.trim() || null;
          }
          if (type === 'mluc' && offset + 28 <= icc.length) {
            const recLen = dv.getUint32(offset + 20, false);
            const recOff = dv.getUint32(offset + 24, false);
            const strStart = offset + recOff;
            if (strStart + recLen <= icc.length) {
              let s = '';
              for (let j = 0; j + 1 < Math.min(recLen, 200); j += 2) {
                const code = (icc[strStart + j] << 8) | icc[strStart + j + 1];
                if (code) s += String.fromCharCode(code);
              }
              return s.trim() || null;
            }
          }
        }
      }
      // Fallback ASCII scan inside ICC bytes
      let ascii = '';
      for (let i = 0; i < Math.min(icc.length, 4096); i++) {
        ascii += icc[i] >= 32 && icc[i] <= 126 ? String.fromCharCode(icc[i]) : ' ';
      }
      const m = ascii.match(/(sRGB[^ ]*|Adobe RGB[^ ]*|Display P3|ProPhoto RGB|Apple RGB)/i);
      return m ? m[1] : 'ICC Profile';
    } catch {
      return null;
    }
  }

  function parsePngMeta(buf) {
    const u8 = new Uint8Array(buf);
    const dv = new DataView(buf);
    if (u8.length < 24 || u8[0] !== 0x89 || u8[1] !== 0x50) return null;
    let off = 8;
    let srgb = false;
    let iccpName = null;
    while (off + 12 <= u8.length) {
      const len = dv.getUint32(off, false);
      const type = String.fromCharCode(u8[off + 4], u8[off + 5], u8[off + 6], u8[off + 7]);
      if (type === 'sRGB') srgb = true;
      if (type === 'iCCP' && len > 2) {
        let name = '';
        for (let i = 0; i < Math.min(len, 80); i++) {
          const b = u8[off + 8 + i];
          if (b === 0) break;
          name += String.fromCharCode(b);
        }
        iccpName = name || 'ICC Profile';
      }
      if (type === 'IDAT' || type === 'IEND') break;
      off += 12 + len;
    }
    return { format: 'png', iccDesc: iccpName || (srgb ? 'sRGB' : null), cmyk: false, exifColorSpace: srgb ? 1 : null };
  }

  function diagnose(item) {
    const { meta, width, height } = item;
    const longEdge = Math.max(width, height);
    const desc = (meta.iccDesc || '').toLowerCase();
    const isSrgb = /srgb|iec61966/i.test(desc);
    const isWide = /adobe|p3|prophoto|romm|dci/i.test(desc);
    const issues = [];
    let level = 'ok';

    if (meta.cmyk) {
      level = 'bad';
      issues.push(t(
        'Ảnh đang ở hệ màu CMYK (chỉ dành cho in ấn). Đăng Facebook/Zalo sẽ bị sai màu nghiêm trọng.',
        'Image is in CMYK (print only). Uploading to Facebook/Zalo will cause severe color shifts.'
      ));
    } else if (isWide) {
      level = 'bad';
      issues.push(t(
        `Ảnh dùng dải màu rộng (${meta.iccDesc}) thay vì sRGB. Khi nền tảng bỏ qua hồ sơ màu, ảnh sẽ bị nhợt và da xám đi.`,
        `Image uses a wide color space (${meta.iccDesc}) instead of sRGB. Platforms ignoring profiles will render it dull and desaturated.`
      ));
    } else if (!meta.iccDesc) {
      if (meta.exifColorSpace === 65535) {
        level = 'bad';
        issues.push(t(
          'Ảnh không nhúng ICC Profile và EXIF ghi Uncalibrated (thường là JPEG chụp Adobe RGB từ máy ảnh). Rất dễ bị lệch màu khi đăng.',
          'No embedded ICC Profile and EXIF marks Uncalibrated (common for Adobe RGB camera JPEGs). High risk of color shift.'
        ));
      } else {
        level = 'warn';
        issues.push(t(
          'Ảnh chưa nhúng ICC Profile sRGB. Nên lưu lại có chuẩn sRGB để hiển thị đồng nhất trên mọi thiết bị.',
          'No embedded sRGB ICC Profile. Re-saving as standard sRGB ensures consistent colors across devices.'
        ));
      }
    } else if (!isSrgb) {
      level = 'warn';
      issues.push(t(
        `Ảnh đang nhúng hồ sơ "${meta.iccDesc}" (có thể là hồ sơ màn hình hoặc hệ màu không phổ biến). Nên đổi về sRGB IEC61966-2.1.`,
        `Image embeds "${meta.iccDesc}" (possibly a monitor or non-standard profile). Convert to sRGB IEC61966-2.1.`
      ));
    }

    if (longEdge > 2048) {
      if (level === 'ok') level = 'warn';
      issues.push(t(
        `Cạnh dài ${longEdge} px vượt chuẩn 2048 px của Facebook — Facebook sẽ tự thu nhỏ và nén lại khiến ảnh giảm độ nét.`,
        `Long edge is ${longEdge} px (above Facebook’s 2048 px limit) — Facebook will downscale and recompress it.`
      ));
    }

    if (!issues.length) {
      issues.push(t(
        'Chuẩn sRGB và kích thước tối ưu cho Facebook / Zalo. Có thể đăng trực tiếp.',
        'Proper sRGB profile and optimal dimensions for Facebook / web. Ready to upload.'
      ));
    }

    const badge = level === 'ok'
      ? t('Đạt chuẩn sRGB', 'sRGB Ready')
      : level === 'warn'
      ? t('Nên tối ưu lại', 'Can Be Optimized')
      : t('Nguy cơ lệch màu cao', 'Color Shift Risk');

    return { level, badge, issues, profileLabel: meta.cmyk ? 'CMYK' : (meta.iccDesc || t('Không có ICC Profile', 'No ICC Profile')) };
  }

  function exportSrgb(item) {
    const img = item.imgEl;
    const cap2048 = !!(resizeCb && resizeCb.checked);
    let w = item.width;
    let h = item.height;
    const maxEdge = Math.max(w, h);
    if (cap2048 && maxEdge > 2048) {
      const k = 2048 / maxEdge;
      w = Math.round(w * k);
      h = Math.round(h * k);
    }
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d', { colorSpace: 'srgb' }) || cv.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    cv.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const base = item.name.replace(/\.[^.]+$/, '');
      a.href = url;
      a.download = `${base}-sRGB${cap2048 && maxEdge > 2048 ? '-2048px' : ''}.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, 'image/jpeg', 0.91);
  }

  function render() {
    out.replaceChildren();
    if (!lastItems.length) { out.hidden = true; return; }
    out.hidden = false;
    for (const item of lastItems) {
      const d = diagnose(item);
      const card = document.createElement('div');
      card.className = 'cc-item';

      const thumb = document.createElement('img');
      thumb.src = item.thumbUrl;
      thumb.alt = item.name;

      const body = document.createElement('div');
      const head = document.createElement('div');
      head.className = 'cc-item__h';
      const title = document.createElement('b');
      title.textContent = item.name;
      const pill = document.createElement('span');
      pill.className = `cc-pill cc-pill--${d.level}`;
      pill.textContent = d.badge;
      head.append(title, pill);

      const metaLine = document.createElement('div');
      metaLine.className = 'cc-item__meta';
      metaLine.textContent = `${item.width} × ${item.height} px · ${(item.size / 1024).toFixed(0)} KB · ${t('Hồ sơ màu', 'Profile')}: ${d.profileLabel}`;

      body.append(head, metaLine);
      for (const msg of d.issues) {
        const p = document.createElement('p');
        p.textContent = msg;
        body.append(p);
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'inline-btn';
      btn.textContent = t('Lưu bản chuẩn sRGB (.jpg)', 'Save sRGB JPEG (.jpg)');
      btn.addEventListener('click', () => exportSrgb(item));
      body.append(btn);

      card.append(thumb, body);
      out.append(card);
    }
  }

  async function handleFiles(fileList) {
    const files = [...fileList].filter((f) => /^image\//i.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name)).slice(0, 6);
    if (!files.length) return;
    for (const old of lastItems) URL.revokeObjectURL(old.thumbUrl);
    lastItems = [];
    for (const f of files) {
      const buf = await f.arrayBuffer();
      const meta = parsePngMeta(buf) || parseJpegMeta(buf);
      const url = URL.createObjectURL(f);
      const imgEl = await new Promise((resolve) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => resolve(null);
        im.src = url;
      });
      if (!imgEl) { URL.revokeObjectURL(url); continue; }
      lastItems.push({ name: f.name, size: f.size, width: imgEl.naturalWidth, height: imgEl.naturalHeight, meta, thumbUrl: url, imgEl });
    }
    render();
  }

  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', () => { if (input.files?.length) handleFiles(input.files); input.value = ''; });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('is-over');
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  });

  if (window.DEVSTU_I18N) window.DEVSTU_I18N.onChange(render);
})();
