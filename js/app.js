(function () {
  const $ = function (id) { return document.getElementById(id); };

  function todayISO() {
    const d = new Date();
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 10);
  }
  function plusDays(iso, n) {
    const d = new Date(iso + "T12:00:00");
    d.setDate(d.getDate() + n);
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 10);
  }
  function randomNo() {
    const d = todayISO().replace(/-/g, "");
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 9000 + 1000;
    return "HB-" + d + "-" + n;
  }
  function num(v) {
    const n = parseFloat(String(v || "").replace(/,/g, ""));
    return isFinite(n) ? n : 0;
  }
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(function () { el.classList.remove("show"); }, 2200);
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { toast("Copied"); });
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    toast("Copied");
    return Promise.resolve();
  }

  function addLine(desc, qty, unit) {
    const row = document.createElement("div");
    row.className = "line-row";
    row.innerHTML =
      '<label class="desc">Description <input class="li-desc" placeholder="Design sprint"></label>' +
      '<label>Qty <input class="li-qty" inputmode="decimal" value="1"></label>' +
      '<label>Unit price <input class="li-unit" inputmode="decimal" placeholder="0"></label>' +
      '<div class="amount-read li-amt">0</div>' +
      '<button type="button" class="icon-btn li-del" aria-label="Remove line">×</button>';
    row.querySelector(".li-desc").value = desc || "";
    row.querySelector(".li-qty").value = qty == null ? "1" : String(qty);
    row.querySelector(".li-unit").value = unit == null ? "" : String(unit);
    row.querySelector(".li-del").addEventListener("click", function () {
      if ($("line-items").children.length === 1) return;
      row.remove();
      render();
    });
    row.querySelectorAll("input").forEach(function (inp) {
      inp.addEventListener("input", render);
    });
    $("line-items").appendChild(row);
  }

  function tokenSymbol() {
    const t = $("token").value;
    return t === "OTHER" ? ($("token-other").value.trim() || "TOKEN") : t;
  }

  function collect() {
    const lines = [];
    $("line-items").querySelectorAll(".line-row").forEach(function (row) {
      const qty = num(row.querySelector(".li-qty").value);
      const unit = num(row.querySelector(".li-unit").value);
      const description = row.querySelector(".li-desc").value.trim();
      lines.push({ description: description, qty: qty, unit: unit, amount: qty * unit });
      row.querySelector(".li-amt").textContent = HashbillPdf.formatNumber(qty * unit);
    });
    const subtotal = lines.reduce(function (s, l) { return s + l.amount; }, 0);
    const fee = num($("fee-amount").value);
    const total = subtotal + fee;
    const fiatAmt = $("fiat-amount").value.trim();
    const fiatCcy = $("fiat-ccy").value.trim();
    return {
      from: {
        name: $("from-name").value.trim(),
        email: $("from-email").value.trim(),
        wallet: $("from-wallet").value.trim()
      },
      to: {
        name: $("to-name").value.trim(),
        email: $("to-email").value.trim(),
        wallet: $("to-wallet").value.trim()
      },
      number: $("inv-number").value.trim(),
      issueDate: $("issue-date").value,
      dueDate: $("due-date").value,
      token: tokenSymbol(),
      chain: $("chain").value,
      lines: lines,
      subtotal: subtotal,
      fee: fee,
      feeLabel: $("fee-label").value.trim() || "Fee / tax",
      total: total,
      fiat: fiatAmt ? ((fiatCcy || "USD") + " " + fiatAmt) : "",
      payee: $("payee-wallet").value.trim(),
      payer: $("payer-wallet").value.trim(),
      txHash: $("tx-hash").value.trim(),
      notes: $("notes").value.trim()
    };
  }

  function partyHtml(p) {
    const name = p.name || '<span class="empty">Name</span>';
    const bits = [p.email, p.wallet].filter(Boolean).map(function (x) {
      return "<div class='party-meta'>" + escapeHtml(x) + "</div>";
    }).join("");
    return "<div class='party-name'>" + (p.name ? escapeHtml(p.name) : name) + "</div>" + bits;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function render() {
    const inv = collect();
    const paid = HashbillPay.isUnlocked();
    $("token-other-wrap").classList.toggle("hidden", $("token").value !== "OTHER");
    $("preview-stamp").classList.toggle("hidden", paid);

    const rows = inv.lines.map(function (l) {
      return "<tr><td>" + escapeHtml(l.description || "—") + "</td><td>" +
        escapeHtml(HashbillPdf.formatNumber(l.qty)) + "</td><td>" +
        escapeHtml(HashbillPdf.formatNumber(l.unit)) + "</td><td>" +
        escapeHtml(HashbillPdf.formatNumber(l.amount)) + "</td></tr>";
    }).join("");

    const feeRow = inv.fee
      ? "<p><span>" + escapeHtml(inv.feeLabel) + "</span><span>" + escapeHtml(HashbillPdf.formatNumber(inv.fee) + " " + inv.token) + "</span></p>"
      : "";
    const fiatRow = inv.fiat ? "<p class='muted'><span>Fiat equivalent</span><span>" + escapeHtml(inv.fiat) + "</span></p>" : "";
    const notes = inv.notes ? "<div class='notes'><strong>Notes</strong><div>" + escapeHtml(inv.notes) + "</div></div>" : "";
    const tx = inv.txHash ? "<div>Tx <code>" + escapeHtml(inv.txHash) + "</code></div>" : "";

    $("preview-body").innerHTML =
      "<div class='inv-top'><div><div class='inv-kicker'>Hashbill</div><h1 class='inv-title'>Invoice</h1></div>" +
      "<div class='inv-num'>No.<strong>" + escapeHtml(inv.number || "—") + "</strong></div></div>" +
      "<div class='parties'><div><div class='party-label'>From</div>" + partyHtml(inv.from) + "</div>" +
      "<div><div class='party-label'>To</div>" + partyHtml(inv.to) + "</div></div>" +
      "<div class='meta-row'><div><span>Issued</span><strong>" + escapeHtml(inv.issueDate || "—") + "</strong></div>" +
      "<div><span>Due</span><strong>" + escapeHtml(inv.dueDate || "—") + "</strong></div>" +
      "<div><span>Token</span><strong>" + escapeHtml(inv.token + " · " + inv.chain) + "</strong></div></div>" +
      "<table class='inv-table'><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Amount</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table>" +
      "<div class='inv-totals'><p><span>Subtotal</span><span>" + escapeHtml(HashbillPdf.formatNumber(inv.subtotal) + " " + inv.token) + "</span></p>" +
      feeRow +
      "<p class='grand'><span>Total</span><span>" + escapeHtml(HashbillPdf.formatNumber(inv.total) + " " + inv.token) + "</span></p>" +
      fiatRow + "</div>" +
      "<div class='paybox'><h3>Settlement</h3>" +
      "<div>Payee <code>" + escapeHtml(inv.payee || "—") + "</code></div>" +
      "<div>Payer <code>" + escapeHtml(inv.payer || "—") + "</code></div>" + tx + "</div>" +
      notes +
      "<p class='disclaimer'>This document is a template. It is not tax, accounting, or legal advice. Prepared with Hashbill.</p>";

    $("totals-live").innerHTML =
      "<div><span>Subtotal</span><span>" + escapeHtml(HashbillPdf.formatNumber(inv.subtotal) + " " + inv.token) + "</span></div>" +
      "<div><span>" + escapeHtml(inv.feeLabel) + "</span><span>" + escapeHtml(HashbillPdf.formatNumber(inv.fee) + " " + inv.token) + "</span></div>" +
      "<div class='grand'><span>Total</span><span>" + escapeHtml(HashbillPdf.formatNumber(inv.total) + " " + inv.token) + "</span></div>";

    refreshTier();
    persistDraft(inv);
  }

  function refreshTier() {
    const paid = HashbillPay.isUnlocked();
    const pill = $("tier-pill");
    const label = $("tier-label");
    const note = $("pdf-note");
    if (paid) {
      pill.classList.add("unlocked");
      label.textContent = "Unlocked · unlimited unbranded PDFs";
      note.textContent = "This browser is unlocked. PDFs have no watermark. From details are remembered locally.";
    } else {
      pill.classList.remove("unlocked");
      const used = HashbillPay.freePdfsUsed();
      label.textContent = used >= 1 ? "Preview · unlock to download more" : "Preview · 1 watermarked PDF";
      note.textContent = used >= 1
        ? "You have used the free watermarked PDF in this browser. Unlock for unlimited unbranded copies."
        : "Free use includes a live preview and one watermarked PDF in this browser. Unlock for unlimited unbranded copies.";
    }
  }

  function persistDraft(inv) {
    try {
      localStorage.setItem("hashbill_draft", JSON.stringify({ from: inv.from,
        to: inv.to,
        number: inv.number,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        tokenSel: $("token").value,
        tokenOther: $("token-other").value,
        chain: inv.chain,
        lines: inv.lines,
        fee: $("fee-amount").value,
        feeLabel: $("fee-label").value,
        fiatAmount: $("fiat-amount").value,
        fiatCcy: $("fiat-ccy").value,
        payee: inv.payee,
        payer: inv.payer,
        txHash: inv.txHash,
        notes: inv.notes
      }));
    } catch (e) {}
    if (HashbillPay.isUnlocked()) {
      try {
        localStorage.setItem(HashbillPay.STORAGE_FROM, JSON.stringify(inv.from));
      } catch (e) {}
    }
  }

  function restore() {
    $("inv-number").value = randomNo();
    $("issue-date").value = todayISO();
    $("due-date").value = plusDays(todayISO(), 14);

    const fromSaved = HashbillPay.isUnlocked() ? (function () {
      try { return JSON.parse(localStorage.getItem(HashbillPay.STORAGE_FROM) || "null"); } catch (e) { return null; }
    })() : null;
    if (fromSaved) {
      $("from-name").value = fromSaved.name || "";
      $("from-email").value = fromSaved.email || "";
      $("from-wallet").value = fromSaved.wallet || "";
    }

    let draft = null;
    try { draft = JSON.parse(localStorage.getItem("hashbill_draft") || "null"); } catch (e) { draft = null; }
    if (draft) {
      if (!fromSaved && draft.from) {
        $("from-name").value = draft.from.name || "";
        $("from-email").value = draft.from.email || "";
        $("from-wallet").value = draft.from.wallet || "";
      }
      $("to-name").value = (draft.to && draft.to.name) || "";
      $("to-email").value = (draft.to && draft.to.email) || "";
      $("to-wallet").value = (draft.to && draft.to.wallet) || "";
      if (draft.number) $("inv-number").value = draft.number;
      if (draft.issueDate) $("issue-date").value = draft.issueDate;
      if (draft.dueDate) $("due-date").value = draft.dueDate;
      if (draft.tokenSel) $("token").value = draft.tokenSel;
      if (draft.tokenOther) $("token-other").value = draft.tokenOther;
      if (draft.chain) $("chain").value = draft.chain;
      $("fee-amount").value = draft.fee || "";
      $("fee-label").value = draft.feeLabel || "";
      $("fiat-amount").value = draft.fiatAmount || "";
      $("fiat-ccy").value = draft.fiatCcy || "";
      $("payee-wallet").value = draft.payee || "";
      $("payer-wallet").value = draft.payer || "";
      $("tx-hash").value = draft.txHash || "";
      $("notes").value = draft.notes || "";
      if (draft.lines && draft.lines.length) {
        draft.lines.forEach(function (l) { addLine(l.description, l.qty, l.unit); });
      }
    }
    if (!$("line-items").children.length) addLine("Product design", 1, 0.5);

    ["from-name","from-email","from-wallet","to-name","to-email","to-wallet","inv-number",
     "issue-date","due-date","token","token-other","chain","fee-label","fee-amount",
     "fiat-amount","fiat-ccy","payee-wallet","payer-wallet","tx-hash","notes"
    ].forEach(function (id) {
      $(id).addEventListener("input", render);
      $(id).addEventListener("change", render);
    });
  }

  function paintPayment() {
    const checkout = HashbillPay.getCheckout();
    $("pay-amount").textContent = checkout.totalEth + " ETH";
    $("pay-address").textContent = HashbillPay.RECEIVE;
    $("unlock-code-hint").textContent = HashbillPay.isUnlocked()
      ? ("Unlocked. Backup code for this browser: " + checkout.totalEth)
      : ("Your backup unlock code is this exact amount: " + checkout.totalEth);
    HashbillQR.draw($("qr"), HashbillPay.eip681(checkout));
    if (HashbillPay.isUnlocked()) {
      $("pay-status").textContent = "This browser is already unlocked. You can still keep the amount as a backup code.";
    }
  }

  function openPay() {
    paintPayment();
    $("pay-dialog").showModal();
  }

  function closePay() {
    HashbillPay.stopWatch();
    $("pay-dialog").close();
  }

  function onUnlocked() {
    refreshTier();
    render();
    $("pay-status").textContent = "Payment matched. Unbranded PDFs are unlocked in this browser.";
    toast("Unlocked in this browser");
    const checkout = HashbillPay.getCheckout();
    $("unlock-code-hint").textContent = "Backup unlock code: " + checkout.totalEth;
  }

  $("btn-add-line").addEventListener("click", function () {
    addLine("", 1, "");
    render();
  });
  $("btn-unlock-open").addEventListener("click", openPay);
  $("btn-pay-close").addEventListener("click", closePay);
  $("pay-dialog").addEventListener("close", function () { HashbillPay.stopWatch(); });

  $("btn-watch").addEventListener("click", function () {
    HashbillPay.startWatch(function (msg) {
      $("pay-status").textContent = msg;
    }, onUnlocked);
  });
  $("btn-check-now").addEventListener("click", async function () {
    $("pay-status").textContent = "Checking public endpoints…";
    try {
      const hit = await HashbillPay.lookForPayment();
      if (hit) {
        HashbillPay.markUnlocked({ txHash: hit.hash, source: "manual-check" });
        onUnlocked();
      } else {
        $("pay-status").textContent = "No matching confirmed transfer yet. Send the exact amount, wait for confirmation, or use the unlock code.";
      }
    } catch (err) {
      $("pay-status").textContent = "RPC/indexer request failed: " + (err && err.message ? err.message : err);
    }
  });

  $("btn-manual-unlock").addEventListener("click", function () {
    const result = HashbillPay.tryManualCode($("unlock-code").value);
    if (!result.ok) {
      $("pay-status").textContent = result.error;
      return;
    }
    HashbillPay.markUnlocked({ source: "unlock-code" });
    onUnlocked();
  });

  $("btn-check-tx").addEventListener("click", async function () {
    $("pay-status").textContent = "Verifying hash on a public RPC…";
    try {
      const checkout = HashbillPay.getCheckout();
      const hit = await HashbillPay.checkTxHash($("unlock-tx").value, checkout.totalWei);
      HashbillPay.markUnlocked({ txHash: hit.hash, source: "tx-hash" });
      onUnlocked();
    } catch (err) {
      $("pay-status").textContent = err && err.message ? err.message : String(err);
    }
  });

  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const id = btn.getAttribute("data-copy");
      const text = $(id).textContent.replace(/\s+ETH$/, "").trim();
      copyText(id === "pay-amount" ? HashbillPay.getCheckout().totalEth : text);
    });
  });

  $("btn-pdf").addEventListener("click", function () {
    const paid = HashbillPay.isUnlocked();
    if (!paid && HashbillPay.freePdfsUsed() >= 1) {
      openPay();
      $("pay-status").textContent = "The free watermarked PDF has already been used in this browser.";
      return;
    }
    const inv = collect();
    HashbillPdf.download(inv, paid);
    if (!paid) HashbillPay.recordFreePdf();
    refreshTier();
    toast(paid ? "PDF downloaded" : "Watermarked PDF downloaded");
  });

  $("btn-print").addEventListener("click", function () {
    window.print();
  });

  restore();
  render();
})();
