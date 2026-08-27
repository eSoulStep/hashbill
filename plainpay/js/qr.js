/* Plainpay local QR — byte mode, ECC M, versions 1–10. */
(function (global) {
  const CAP = [0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
  const RS = {
    1: [[1, 26, 16]],
    2: [[1, 44, 28]],
    3: [[1, 70, 44]],
    4: [[2, 50, 32]],
    5: [[2, 67, 43]],
    6: [[4, 43, 27]],
    7: [[4, 49, 31]],
    8: [[2, 60, 38], [2, 61, 39]],
    9: [[3, 58, 36], [2, 59, 37]],
    10: [[4, 69, 43], [1, 70, 44]]
  };
  const ALIGN = {
    2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
    7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };

  const EXP = new Array(512);
  const LOG = new Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 256) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  function gfMul(a, b) {
    if (!a || !b) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  function rsGenerator(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, ec) {
    const gen = rsGenerator(ec);
    const res = data.concat(new Array(ec).fill(0));
    for (let i = 0; i < data.length; i++) {
      const coef = res[i];
      if (!coef) continue;
      for (let j = 0; j < gen.length; j++) res[i + j] ^= gfMul(gen[j], coef);
    }
    return res.slice(data.length);
  }

  function BitBuf() { this.bits = []; }
  BitBuf.prototype.put = function (val, len) {
    for (let i = len - 1; i >= 0; i--) this.bits.push((val >>> i) & 1);
  };
  BitBuf.prototype.toBytes = function () {
    const bytes = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | (this.bits[i + j] || 0);
      bytes.push(b);
    }
    return bytes;
  };

  function chooseVersion(n) {
    for (let v = 1; v <= 10; v++) {
      const bits = 4 + (v < 10 ? 8 : 16) + n * 8 + 4;
      if (Math.ceil(bits / 8) <= CAP[v]) return v;
    }
    throw new Error("QR payload too long");
  }

  function buildData(text, version) {
    const bytes = [];
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      bytes.push(c > 255 ? 63 : c);
    }
    const buf = new BitBuf();
    buf.put(4, 4);
    buf.put(bytes.length, version < 10 ? 8 : 16);
    bytes.forEach(function (b) { buf.put(b, 8); });
    const totalData = RS[version].reduce(function (s, blk) { return s + blk[0] * blk[2]; }, 0);
    const remain = totalData * 8 - buf.bits.length;
    buf.put(0, Math.min(4, remain));
    while (buf.bits.length % 8) buf.put(0, 1);
    const data = buf.toBytes();
    const pad = [0xec, 0x11];
    let p = 0;
    while (data.length < totalData) data.push(pad[p++ % 2]);
    return data.slice(0, totalData);
  }

  function interleave(data, version) {
    const blocks = [];
    let offset = 0, maxData = 0, maxEc = 0;
    RS[version].forEach(function (spec) {
      const count = spec[0], total = spec[1], dc = spec[2], ec = total - dc;
      for (let i = 0; i < count; i++) {
        const chunk = data.slice(offset, offset + dc);
        offset += dc;
        const ecc = rsEncode(chunk, ec);
        blocks.push({ data: chunk, ecc: ecc });
        maxData = Math.max(maxData, chunk.length);
        maxEc = Math.max(maxEc, ecc.length);
      }
    });
    const out = [];
    for (let i = 0; i < maxData; i++) blocks.forEach(function (b) { if (i < b.data.length) out.push(b.data[i]); });
    for (let i = 0; i < maxEc; i++) blocks.forEach(function (b) { if (i < b.ecc.length) out.push(b.ecc[i]); });
    return out;
  }

  function bchTypeInfo(data) {
    let d = data << 10;
    for (let i = 14; i >= 10; i--) {
      if ((d >>> i) & 1) d ^= 0x537 << (i - 10);
    }
    return ((data << 10) | d) ^ 0x5412;
  }

  function makeModules(text) {
    const version = chooseVersion(text.length);
    const size = version * 4 + 17;
    const m = Array.from({ length: size }, function () { return new Array(size).fill(null); });

    function finder(col, row) {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const rr = row + r, cc = col + c;
          if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
          m[rr][cc] = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        }
      }
    }
    finder(0, 0);
    finder(size - 7, 0);
    finder(0, size - 7);

    for (let i = 8; i < size - 8; i++) {
      if (m[i][6] === null) m[i][6] = i % 2 === 0;
      if (m[6][i] === null) m[6][i] = i % 2 === 0;
    }

    const pos = ALIGN[version] || [];
    pos.forEach(function (y) {
      pos.forEach(function (x) {
        if (m[y][x] !== null) return;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            m[y + r][x + c] = Math.max(Math.abs(r), Math.abs(c)) !== 1;
          }
        }
      });
    });

    const format = bchTypeInfo(0 << 3 | 0);
    for (let e = 0; e < 15; e++) {
      const bit = ((format >> e) & 1) === 1;
      if (e < 6) m[e][8] = bit;
      else if (e < 8) m[e + 1][8] = bit;
      else m[size - 15 + e][8] = bit;

      if (e < 8) m[8][size - e - 1] = bit;
      else if (e === 8) m[8][7] = bit;
      else m[8][15 - e - 1] = bit;
    }
    m[size - 8][8] = true;

    const data = interleave(buildData(text, version), version);
    let bitIdx = 0;
    let dir = -1;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (let n = 0; n < size; n++) {
        const row = dir < 0 ? size - 1 - n : n;
        for (let k = 0; k < 2; k++) {
          const c = col - k;
          if (m[row][c] !== null) continue;
          let dark = false;
          if (bitIdx < data.length * 8) {
            const b = data[bitIdx >> 3];
            dark = ((b >> (7 - (bitIdx & 7))) & 1) === 1;
            bitIdx++;
          }
          if (((row + c) & 1) === 0) dark = !dark;
          m[row][c] = dark;
        }
      }
      dir = -dir;
    }
    return m;
  }

  function draw(el, text) {
    el.innerHTML = "";
    const modules = makeModules(text);
    const n = modules.length;
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "-1 -1 " + (n + 2) + " " + (n + 2));
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("shape-rendering", "crispEdges");
    const bg = document.createElementNS(svgNS, "rect");
    bg.setAttribute("x", -1);
    bg.setAttribute("y", -1);
    bg.setAttribute("width", n + 2);
    bg.setAttribute("height", n + 2);
    bg.setAttribute("fill", "#ffffff");
    svg.appendChild(bg);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!modules[r][c]) continue;
        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", c);
        rect.setAttribute("y", r);
        rect.setAttribute("width", 1);
        rect.setAttribute("height", 1);
        rect.setAttribute("fill", "#10284d");
        svg.appendChild(rect);
      }
    }
    el.appendChild(svg);
  }

  global.PlainpayQR = {
    draw: function (el, text) {
      try {
        draw(el, text);
      } catch (err) {
        const img = document.createElement("img");
        img.alt = "Payment QR code";
        img.src = "https://api.qrserver.com/v1/create-qr-code/?size=168x168&ecc=M&margin=2&data=" + encodeURIComponent(text);
        el.innerHTML = "";
        el.appendChild(img);
      }
    }
  };
})(window);
