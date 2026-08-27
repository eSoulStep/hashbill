(function () {
  const $ = function (id) { return document.getElementById(id); };

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(function () { el.classList.remove("show"); }, 2200);
  }

  function copyText(text) {
    if (!text) return Promise.resolve();
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

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function isAddress(v) {
    return /^0x[0-9a-fA-F]{40}$/.test(String(v || "").trim());
  }

  function randomRef() {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 9000 + 1000;
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return "PP-" + y + m + day + "-" + n;
  }

  function collect() {
    const payee = $("payee").value.trim();
    const amount = $("amount").value.trim();
    const wei = Plainpay.ethAmountToWei(amount);
    return {
      payee: payee,
      amount: amount,
      wei: wei,
      fromName: $("from-name").value.trim(),
      note: $("note").value.trim(),
      ref: $("ref").value.trim()
    };
  }

  function requestText(req) {
    const lines = [
      "Ethereum payment request",
      "Pay " + (req.amount || "—") + " ETH",
      "to " + (req.payee || "—")
    ];
    if (req.wei && isAddress(req.payee)) lines.push(Plainpay.requestUri(req.payee, req.wei));
    if (req.note) lines.push("Note: " + req.note);
    if (req.fromName) lines.push("Requested by: " + req.fromName);
    if (req.ref) lines.push("Ref: " + req.ref);
    return lines.join("\n");
  }

  function persist(req) {
    try {
      localStorage.setItem(Plainpay.STORAGE_DRAFT, JSON.stringify({
        payee: req.payee,
        amount: req.amount,
        fromName: req.fromName,
        note: req.note,
        ref: req.ref
      }));
    } catch (e) {}
  }

  function refreshTier() {
    const paid = Plainpay.isUnlocked();
    const pill = $("tier-pill");
    const label = $("tier-label");
    const note = $("quota-note");
    $("wm").classList.toggle("hide", paid);
    if (paid) {
      pill.classList.add("ok");
      label.textContent = "Unlocked · unlimited unbranded";
      note.textContent = "This browser is unlocked. Requests have no watermark.";
    } else {
      pill.classList.remove("ok");
      const used = Plainpay.freeCopiesUsed();
      label.textContent = used >= 1 ? "Preview · unlock to copy more" : "Free · 1 watermarked request";
      note.textContent = used >= 1
        ? "You have used the free watermarked copy in this browser. Unlock for unlimited unbranded requests."
        : "Free use: one watermarked copy in this browser. Unlock for unlimited unbranded requests.";
    }
  }

  function render() {
    const req = collect();
    const paid = Plainpay.isUnlocked();
    const validPayee = isAddress(req.payee);
    const validAmt = req.wei != null && req.wei > 0n;
    const uri = validPayee && validAmt ? Plainpay.requestUri(req.payee, req.wei) : "";

    $("payee-hint").textContent = validPayee
      ? "Client pays this address. It is not Plainpay’s unlock address."
      : (req.payee ? "Enter a 42-character 0x address (Ethereum mainnet)." : "Where the client should send ETH. This is not Plainpay’s unlock address.");

    let body = '<div class="card-inner">';
    body += '<div class="kicker">Pay exactly</div>';
    body += '<div class="pay-amt" id="card-amount">' + escapeHtml(req.amount || "0") + ' <small>ETH</small></div>';
    body += '<div class="kicker">To</div>';
    body += '<div class="addr" id="card-address">' + escapeHtml(req.payee || "0x…") + '</div>';

    body += '<div class="meta">';
    if (req.fromName) body += "<div><span>Requested by</span>" + escapeHtml(req.fromName) + "</div>";
    if (req.ref) body += "<div><span>Reference</span>" + escapeHtml(req.ref) + "</div>";
    body += "<div><span>Network</span>Ethereum mainnet</div>";
    body += "</div>";

    if (req.note) {
      body += '<div class="note-block"><span class="kicker">Note</span><div>' + escapeHtml(req.note) + "</div></div>";
    }

    if (!validPayee || !validAmt) {
      body += '<p class="warn">Add a valid payee address and ETH amount to mint the QR.</p>';
    } else {
      body += '<div id="card-qr" class="card-qr" role="img" aria-label="EIP-681 QR for this payment request"></div>';
      body += '<p class="card-foot">' + escapeHtml(uri) + "</p>";
    }

    body += '<p class="card-foot">This is a payment request, not a custody or tax document.' +
      (paid ? "" : " · Plainpay preview") + "</p>";
    body += "</div>";

    $("card-body").innerHTML = body;
    if (uri) PlainpayQR.draw($("card-qr"), uri);

    persist(req);
    refreshTier();
  }

  function canCopy() {
    if (Plainpay.isUnlocked()) return true;
    return Plainpay.freeCopiesUsed() < 1;
  }

  function consumeCopy() {
    if (!Plainpay.isUnlocked()) {
      Plainpay.recordFreeCopy();
      refreshTier();
    }
  }

  function gateCopy(fn) {
    const req = collect();
    if (!isAddress(req.payee) || !(req.wei != null && req.wei > 0n)) {
      toast("Need a valid address and amount");
      return;
    }
    if (!canCopy()) {
      openUnlock();
      $("pay-status").textContent = "The free watermarked copy has already been used in this browser.";
      return;
    }
    fn(req);
    consumeCopy();
  }

  function openUnlock() {
    paintUnlock();
    $("unlock-sheet").hidden = false;
  }

  function closeUnlock() {
    Plainpay.stopWatch();
    $("unlock-sheet").hidden = true;
  }

  function paintUnlock() {
    const checkout = Plainpay.getCheckout();
    $("pay-amount").textContent = checkout.totalEth + " ETH";
    $("pay-address").textContent = Plainpay.RECEIVE;
    $("unlock-code-hint").textContent = Plainpay.isUnlocked()
      ? "This browser is unlocked. Keep your transaction hash if you need to restore later."
      : "Unlock only after a confirmed transfer. The amount on this page is what to send, not a code.";
    PlainpayQR.draw($("unlock-qr"), Plainpay.eip681(checkout));
    if (Plainpay.isUnlocked()) {
      $("pay-status").textContent = "This browser is already unlocked.";
      $("pay-status").classList.add("ok");
    } else {
      $("pay-status").classList.remove("ok");
    }
  }

  function onUnlocked() {
    refreshTier();
    render();
    $("pay-status").textContent = "Payment matched. Unbranded requests are unlocked in this browser.";
    $("pay-status").classList.add("ok");
    toast("Unlocked in this browser");
    $("unlock-code-hint").textContent = "Unlocked after a confirmed transfer. Keep the transaction hash.";
  }

  function restore() {
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(Plainpay.STORAGE_DRAFT) || "null"); } catch (e) { draft = null; }
    if (draft) {
      $("payee").value = draft.payee || "";
      $("amount").value = draft.amount || "";
      $("from-name").value = draft.fromName || "";
      $("note").value = draft.note || "";
      $("ref").value = draft.ref || "";
    }
    if (!$("ref").value) $("ref").value = randomRef();

    ["payee", "amount", "from-name", "note", "ref"].forEach(function (id) {
      $(id).addEventListener("input", render);
      $(id).addEventListener("change", render);
    });
  }

  $("btn-copy-request").addEventListener("click", function () {
    gateCopy(function (req) { copyText(requestText(req)); });
  });
  $("btn-copy-uri").addEventListener("click", function () {
    gateCopy(function (req) { copyText(Plainpay.requestUri(req.payee, req.wei)); });
  });
  $("btn-copy-text").addEventListener("click", function () {
    gateCopy(function (req) { copyText(requestText(req)); });
  });
  $("btn-new").addEventListener("click", function () {
    $("payee").value = "";
    $("amount").value = "";
    $("note").value = "";
    $("ref").value = randomRef();
    render();
  });

  $("btn-unlock-open").addEventListener("click", openUnlock);
  $("btn-unlock-close").addEventListener("click", closeUnlock);
  $("unlock-sheet").addEventListener("click", function (ev) {
    if (ev.target === $("unlock-sheet")) closeUnlock();
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && !$("unlock-sheet").hidden) closeUnlock();
  });

  $("btn-watch").addEventListener("click", function () {
    $("pay-status").classList.remove("ok");
    Plainpay.startWatch(function (msg) {
      $("pay-status").textContent = msg;
    }, onUnlocked);
  });
  $("btn-check-now").addEventListener("click", async function () {
    $("pay-status").classList.remove("ok");
    $("pay-status").textContent = "Checking public endpoints…";
    try {
      const hit = await Plainpay.lookForPayment();
      if (hit) {
        Plainpay.markUnlocked({ txHash: hit.hash, source: "manual-check" });
        onUnlocked();
      } else {
        $("pay-status").textContent = "No matching confirmed transfer yet. Send the exact amount, wait for confirmation, or paste the transaction hash.";
      }
    } catch (err) {
      $("pay-status").textContent = "RPC/indexer request failed: " + (err && err.message ? err.message : err);
    }
  });
  if ($("btn-manual-unlock")) {
    $("btn-manual-unlock").addEventListener("click", function () {
      $("pay-status").classList.remove("ok");
      $("pay-status").textContent = "The displayed amount is not an unlock code. Paste a confirmed transaction hash and use Verify hash.";
    });
  }
  $("btn-check-tx").addEventListener("click", async function () {
    $("pay-status").classList.remove("ok");
    $("pay-status").textContent = "Verifying hash on a public RPC…";
    try {
      const checkout = Plainpay.getCheckout();
      const hit = await Plainpay.checkTxHash($("unlock-tx").value, checkout.totalWei);
      Plainpay.markUnlocked({ txHash: hit.hash, source: "tx-hash" });
      onUnlocked();
    } catch (err) {
      $("pay-status").textContent = err && err.message ? err.message : String(err);
    }
  });

  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const id = btn.getAttribute("data-copy");
      if (id === "pay-amount") {
        copyText(Plainpay.getCheckout().totalEth);
        return;
      }
      if (id === "pay-address") {
        copyText(Plainpay.RECEIVE);
        return;
      }
      if (id === "card-address" || id === "card-amount") {
        gateCopy(function (req) {
          copyText(id === "card-address" ? req.payee : req.amount);
        });
        return;
      }
      const el = $(id);
      copyText(el ? el.textContent.trim() : "");
    });
  });

  restore();
  render();
})();
