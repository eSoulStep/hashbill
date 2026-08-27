/* Hashbill PDF writer — Helvetica A4, no external library. */
(function (global) {
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN = 48;

  const HELV = {
    32:278,33:278,34:355,35:556,36:556,37:889,38:667,39:191,40:333,41:333,42:389,43:584,
    44:278,45:333,46:278,47:278,48:556,49:556,50:556,51:556,52:556,53:556,54:556,55:556,
    56:556,57:556,58:278,59:278,60:584,61:584,62:584,63:556,64:1015,65:667,66:667,67:722,
    68:722,69:667,70:611,71:778,72:722,73:278,74:500,75:667,76:556,77:833,78:722,79:778,
    80:667,81:778,82:722,83:667,84:611,85:722,86:667,87:944,88:667,89:667,90:611,91:278,
    92:278,93:278,94:469,95:556,96:333,97:556,98:556,99:500,100:556,101:556,102:278,
    103:556,104:556,105:222,106:222,107:500,108:222,109:833,110:556,111:556,112:556,
    113:556,114:333,115:500,116:278,117:556,118:500,119:722,120:500,121:500,122:500,
    123:334,124:260,125:334,126:584
  };
  const HELV_B = {
    32:278,33:333,34:474,35:556,36:556,37:889,38:722,39:238,40:333,41:333,42:389,43:584,
    44:278,45:333,46:278,47:278,48:556,49:556,50:556,51:556,52:556,53:556,54:556,55:556,
    56:556,57:556,58:333,59:333,60:584,61:584,62:584,63:611,64:975,65:722,66:722,67:722,
    68:722,69:667,70:611,71:778,72:722,73:278,74:556,75:722,76:611,77:833,78:722,79:778,
    80:667,81:778,82:722,83:667,84:611,85:722,86:667,87:944,88:667,89:667,90:611,91:333,
    92:278,93:333,94:584,95:556,96:333,97:556,98:611,99:556,100:611,101:556,102:333,
    103:611,104:611,105:278,106:278,107:556,108:278,109:889,110:611,111:611,112:611,
    113:611,114:389,115:556,116:333,117:611,118:556,119:778,120:556,121:556,122:500,
    123:389,124:280,125:389,126:584
  };

  function latin1(s) {
    return String(s || "").replace(/[^\x20-\x7E]/g, function (ch) {
      const map = {
        "–": "-", "—": "-", "‘": "'", "’": "'", "“": '"', "”": '"',
        "•": "-", "€": "EUR", "£": "GBP", "¥": "YEN", "×": "x"
      };
      return map[ch] || "?";
    });
  }

  function esc(s) {
    return latin1(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }

  function tw(s, size, bold) {
    const table = bold ? HELV_B : HELV;
    let w = 0;
    const t = latin1(s);
    for (let i = 0; i < t.length; i++) w += table[t.charCodeAt(i)] || 500;
    return w * size / 1000;
  }

  function wrap(s, size, bold, maxW) {
    const text = latin1(s || "");
    if (!text) return [""];
    const words = text.split(/\s+/);
    const lines = [];
    let cur = "";
    words.forEach(function (word) {
      const trial = cur ? cur + " " + word : word;
      if (tw(trial, size, bold) <= maxW) cur = trial;
      else {
        if (cur) lines.push(cur);
        if (tw(word, size, bold) > maxW) {
          let chunk = "";
          for (let i = 0; i < word.length; i++) {
            const t = chunk + word[i];
            if (tw(t, size, bold) > maxW && chunk) { lines.push(chunk); chunk = word[i]; }
            else chunk = t;
          }
          cur = chunk;
        } else cur = word;
      }
    });
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  }

  function Pdf() {
    this.cmds = [];
  }
  Pdf.prototype.push = function (c) { this.cmds.push(c); };
  Pdf.prototype.color = function (r, g, b) {
    this.push((r / 255).toFixed(3) + " " + (g / 255).toFixed(3) + " " + (b / 255).toFixed(3) + " rg");
  };
  Pdf.prototype.strokeColor = function (r, g, b) {
    this.push((r / 255).toFixed(3) + " " + (g / 255).toFixed(3) + " " + (b / 255).toFixed(3) + " RG");
  };
  Pdf.prototype.rect = function (x, y, w, h, fill) {
    this.push(x.toFixed(2) + " " + y.toFixed(2) + " " + w.toFixed(2) + " " + h.toFixed(2) + " re " + (fill ? "f" : "S"));
  };
  Pdf.prototype.line = function (x1, y1, x2, y2) {
    this.push(x1.toFixed(2) + " " + y1.toFixed(2) + " m " + x2.toFixed(2) + " " + y2.toFixed(2) + " l S");
  };
  Pdf.prototype.text = function (s, x, y, size, bold) {
    const font = bold ? "/F2" : "/F1";
    this.push("BT " + font + " " + size + " Tf 1 0 0 1 " + x.toFixed(2) + " " + y.toFixed(2) + " Tm (" + esc(s) + ") Tj ET");
  };
  Pdf.prototype.textRight = function (s, xRight, y, size, bold) {
    this.text(s, xRight - tw(s, size, bold), y, size, bold);
  };
  Pdf.prototype.watermark = function () {
    this.push("q 0.82 0.80 0.76 rg BT /F2 42 Tf 0.92 0.38 -0.38 0.92 90 240 Tm (HASHBILL PREVIEW) Tj ET Q");
    this.push("q 0.82 0.80 0.76 rg BT /F2 42 Tf 0.92 0.38 -0.38 0.92 130 420 Tm (HASHBILL PREVIEW) Tj ET Q");
  };

  function build(inv, paid) {
    const d = new Pdf();
    const left = MARGIN;
    const right = PAGE_W - MARGIN;
    let y = PAGE_H - 50;

    d.color(42, 70, 59);
    d.rect(0, 0, 10, PAGE_H, true);

    d.color(42, 70, 59);
    d.text("HASHBILL", left, y, 9, true);
    d.color(28, 24, 20);
    d.text("INVOICE", left, y - 22, 22, true);
    d.color(111, 103, 94);
    d.textRight("No.", right, y, 9, false);
    d.color(28, 24, 20);
    d.textRight(inv.number || "—", right, y - 16, 12, true);
    y -= 40;
    d.strokeColor(216, 208, 195);
    d.push("0.6 w");
    d.line(left, y, right, y);
    y -= 22;

    const col2 = left + (right - left) / 2 + 8;
    d.color(140, 131, 120);
    d.text("FROM", left, y, 8, true);
    d.text("TO", col2, y, 8, true);
    y -= 14;
    d.color(28, 24, 20);
    d.text(inv.from.name || "—", left, y, 11, true);
    d.text(inv.to.name || "—", col2, y, 11, true);
    y -= 13;
    d.color(63, 56, 50);
    const fromBits = [inv.from.email, inv.from.wallet].filter(Boolean);
    const toBits = [inv.to.email, inv.to.wallet].filter(Boolean);
    const fromLines = wrap(fromBits.join("   ") || " ", 9, false, (right - left) / 2 - 12);
    const toLines = wrap(toBits.join("   ") || " ", 9, false, (right - left) / 2 - 16);
    const partyLines = Math.max(fromLines.length, toLines.length, 1);
    for (let i = 0; i < partyLines; i++) {
      if (fromLines[i]) d.text(fromLines[i], left, y, 9, false);
      if (toLines[i]) d.text(toLines[i], col2, y, 9, false);
      y -= 12;
    }
    y -= 8;

    d.strokeColor(216, 208, 195);
    d.line(left, y, right, y);
    y -= 18;
    d.color(140, 131, 120);
    d.text("ISSUED", left, y, 8, true);
    d.text("DUE", left + 120, y, 8, true);
    d.text("TOKEN / CHAIN", left + 240, y, 8, true);
    y -= 13;
    d.color(28, 24, 20);
    d.text(inv.issueDate || "—", left, y, 10, false);
    d.text(inv.dueDate || "—", left + 120, y, 10, false);
    d.text((inv.token || "ETH") + " · " + (inv.chain || "Ethereum"), left + 240, y, 10, false);
    y -= 16;
    d.strokeColor(216, 208, 195);
    d.line(left, y, right, y);
    y -= 20;

    d.color(140, 131, 120);
    d.text("DESCRIPTION", left, y, 8, true);
    d.textRight("QTY", right - 150, y, 8, true);
    d.textRight("UNIT", right - 78, y, 8, true);
    d.textRight("AMOUNT", right, y, 8, true);
    y -= 8;
    d.strokeColor(216, 208, 195);
    d.line(left, y, right, y);
    y -= 14;

    d.color(28, 24, 20);
    inv.lines.forEach(function (line) {
      const descLines = wrap(line.description || "Item", 10, false, right - left - 200);
      const rowTop = y;
      descLines.forEach(function (ln, idx) {
        d.text(ln, left, y - idx * 12, 10, false);
      });
      d.textRight(fmtNum(line.qty), right - 150, rowTop, 10, false);
      d.textRight(fmtNum(line.unit), right - 78, rowTop, 10, false);
      d.textRight(fmtNum(line.qty * line.unit), right, rowTop, 10, false);
      y -= Math.max(16, descLines.length * 12 + 6);
    });

    y -= 6;
    d.strokeColor(216, 208, 195);
    d.line(left + 220, y, right, y);
    y -= 16;
    d.color(63, 56, 50);
    d.textRight("Subtotal", right - 90, y, 10, false);
    d.textRight(fmtNum(inv.subtotal) + " " + inv.token, right, y, 10, false);
    if (inv.fee && inv.fee !== 0) {
      y -= 14;
      d.textRight(inv.feeLabel || "Fee / tax", right - 90, y, 10, false);
      d.textRight(fmtNum(inv.fee) + " " + inv.token, right, y, 10, false);
    }
    y -= 18;
    d.color(28, 24, 20);
    d.strokeColor(28, 24, 20);
    d.line(left + 220, y + 10, right, y + 10);
    d.textRight("Total", right - 90, y, 13, true);
    d.textRight(fmtNum(inv.total) + " " + inv.token, right, y, 13, true);
    if (inv.fiat) {
      y -= 14;
      d.color(111, 103, 94);
      d.textRight("Approx. " + inv.fiat, right, y, 9, false);
    }

    y -= 28;
    d.color(228, 238, 232);
    const boxH = 64 + (inv.txHash ? 14 : 0) + (inv.notes ? 8 : 0);
    d.rect(left, y - boxH + 18, right - left, boxH, true);
    d.color(42, 70, 59);
    d.text("SETTLEMENT", left + 12, y, 8, true);
    y -= 14;
    d.color(28, 24, 20);
    const payeeLines = wrap("Payee  " + (inv.payee || "—"), 9, false, right - left - 28);
    payeeLines.forEach(function (ln) { d.text(ln, left + 12, y, 9, false); y -= 12; });
    const payerLines = wrap("Payer  " + (inv.payer || "—"), 9, false, right - left - 28);
    payerLines.forEach(function (ln) { d.text(ln, left + 12, y, 9, false); y -= 12; });
    if (inv.txHash) {
      const txLines = wrap("Tx  " + inv.txHash, 8, false, right - left - 28);
      txLines.forEach(function (ln) { d.text(ln, left + 12, y, 8, false); y -= 11; });
    }

    if (inv.notes) {
      y -= 10;
      d.color(140, 131, 120);
      d.text("NOTES", left, y, 8, true);
      y -= 13;
      d.color(63, 56, 50);
      wrap(inv.notes, 9, false, right - left).forEach(function (ln) {
        d.text(ln, left, y, 9, false);
        y -= 12;
      });
    }

    d.color(140, 131, 120);
    d.text("This document is a template. It is not tax, accounting, or legal advice.", left, 40, 8, false);
    d.text("Prepared with Hashbill.", left, 28, 8, false);

    if (!paid) d.watermark();

    const stream = d.cmds.join("\n");
    return assemble(stream);
  }

  function fmtNum(n) {
    if (n === "" || n === null || typeof n === "undefined" || isNaN(Number(n))) return "0";
    const x = Number(n);
    if (Math.abs(x) >= 1e6 || (Math.abs(x) > 0 && Math.abs(x) < 1e-6)) return String(x);
    return String(Math.round(x * 1e8) / 1e8);
  }

  function assemble(content) {
    const objects = [];
    function obj(body) { objects.push(body); return objects.length; }

    const font1 = obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    const font2 = obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    const contents = obj("<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream");
    const page = obj(
      "<< /Type /Page /Parent 0 0 R /MediaBox [0 0 " + PAGE_W + " " + PAGE_H + "] " +
      "/Resources << /Font << /F1 " + font1 + " 0 R /F2 " + font2 + " 0 R >> >> " +
      "/Contents " + contents + " 0 R >>"
    );
    const pages = obj("<< /Type /Pages /Kids [" + page + " 0 R] /Count 1 >>");
    const catalog = obj("<< /Type /Catalog /Pages " + pages + " 0 R >>");

    objects[page - 1] = objects[page - 1].replace("/Parent 0 0 R", "/Parent " + pages + " 0 R");

    let out = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach(function (body, i) {
      offsets.push(out.length);
      out += (i + 1) + " 0 obj\n" + body + "\nendobj\n";
    });
    const xref = out.length;
    out += "xref\n0 " + (objects.length + 1) + "\n";
    out += "0000000000 65535 f \n";
    for (let i = 1; i < offsets.length; i++) {
      out += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
    }
    out += "trailer << /Size " + (objects.length + 1) + " /Root " + catalog + " 0 R >>\n";
    out += "startxref\n" + xref + "\n%%EOF";
    return out;
  }

  function download(inv, paid) {
    const pdf = build(inv, paid);
    const blob = new Blob([pdf], { type: "application/pdf" });
    const a = document.createElement("a");
    const safe = (inv.number || "invoice").replace(/[^\w.-]+/g, "_");
    a.href = URL.createObjectURL(blob);
    a.download = "hashbill-" + safe + (paid ? "" : "-preview") + ".pdf";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      if (a.remove) a.remove();
    }, 800);
  }

  global.HashbillPdf = { download: download, formatNumber: fmtNum };
})(window);
