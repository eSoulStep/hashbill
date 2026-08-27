/* Plainpay unlock watcher — public RPCs / Blockscout. No wallet connection. */
(function (global) {
  const RECEIVE = "0x6c2094e511a6d6F5a44Ad3815fDAC7125D007a3D";
  const RECEIVE_LC = RECEIVE.toLowerCase();
  const BASE_WEI = 4000000000000000n;
  const STORAGE_UNLOCK = "plainpay_unlock";
  const STORAGE_CHECKOUT = "plainpay_checkout";
  const STORAGE_DRAFT = "plainpay_draft";
  const STORAGE_FREE = "plainpay_free_copies";

  const RPCS = [
    "https://ethereum.publicnode.com",
    "https://eth.llamarpc.com",
    "https://cloudflare-eth.com",
    "https://1rpc.io/eth",
    "https://rpc.ankr.com/eth",
    "https://eth.drpc.org"
  ];

  const INDEXERS = [
    "https://eth.blockscout.com/api/v2/addresses/" + RECEIVE + "/transactions?filter=to",
    "https://eth.blockscout.com/api/v2/addresses/" + RECEIVE + "/transactions"
  ];

  let watchTimer = null;
  let lastRpcError = "";
  let goodRpc = null;

  function weiToEth(wei) {
    const s = BigInt(wei).toString().padStart(19, "0");
    const whole = s.slice(0, -18).replace(/^0+/, "") || "0";
    const frac = s.slice(-18).replace(/0+$/, "");
    return frac ? whole + "." + frac : whole;
  }

  function parseEthToWei(str) {
    const t = String(str || "").trim().replace(/\s*ETH\s*$/i, "").trim();
    if (!t) return null;
    if (/^\d+$/.test(t)) {
      const n = BigInt(t);
      if (n >= BASE_WEI + 1n && n <= BASE_WEI + 999999n) return n;
      if (n >= 1n && n <= 999999n) return BASE_WEI + n;
    }
    const m = t.match(/^0*(\d*)(?:\.(\d+))?$/);
    if (!m) return null;
    let whole = m[1] || "0";
    let frac = (m[2] || "").replace(/0+$/, "");
    if (frac.length > 18) frac = frac.slice(0, 18);
    frac = frac.padEnd(18, "0");
    return BigInt(whole) * 10n ** 18n + BigInt(frac || "0");
  }


  function ethAmountToWei(str) {
    const t = String(str || "").trim().replace(/,/g, "").replace(/\s*ETH\s*$/i, "").trim();
    if (!t || t === ".") return null;
    const m = t.match(/^0*(\d*)(?:\.(\d+))?$/);
    if (!m) return null;
    let whole = m[1] || "0";
    let frac = m[2] || "";
    if (frac.length > 18) frac = frac.slice(0, 18);
    frac = frac.padEnd(18, "0");
    const wei = BigInt(whole || "0") * 10n ** 18n + BigInt(frac || "0");
    return wei;
  }

  function randomExtraWei() {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return BigInt(a[0] % 999999) + 1n;
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function getCheckout() {
    const existing = readJson(STORAGE_CHECKOUT);
    if (existing && existing.totalWei && existing.extraWei) return existing;
    const extra = randomExtraWei();
    const total = BASE_WEI + extra;
    const o = {
      extraWei: extra.toString(),
      totalWei: total.toString(),
      totalEth: weiToEth(total),
      createdAt: Date.now()
    };
    localStorage.setItem(STORAGE_CHECKOUT, JSON.stringify(o));
    return o;
  }

  function isUnlocked() {
    const u = readJson(STORAGE_UNLOCK);
    return !!(u && u.paid);
  }

  function freeCopiesUsed() {
    return Number(localStorage.getItem(STORAGE_FREE) || "0") || 0;
  }

  function recordFreeCopy() {
    localStorage.setItem(STORAGE_FREE, String(freeCopiesUsed() + 1));
  }

  function markUnlocked(meta) {
    const checkout = getCheckout();
    const payload = {
      paid: true,
      extraWei: checkout.extraWei,
      totalWei: checkout.totalWei,
      totalEth: checkout.totalEth,
      unlockedAt: Date.now(),
      txHash: (meta && meta.txHash) || null,
      source: (meta && meta.source) || "watch"
    };
    localStorage.setItem(STORAGE_UNLOCK, JSON.stringify(payload));
    return payload;
  }

  function eip681(checkout) {
    return "ethereum:" + RECEIVE + "@1?value=" + checkout.totalWei;
  }

  function requestUri(payee, wei) {
    return "ethereum:" + payee + "@1?value=" + wei.toString();
  }

  async function rpc(url, method, params) {
    const opts = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: method, params: params || [] })
    };
    if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) opts.signal = AbortSignal.timeout(8000);
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error("RPC HTTP " + res.status);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || "RPC error");
    return json.result;
  }

  async function rpcFirst(method, params) {
    let last = null;
    const urls = goodRpc ? [goodRpc].concat(RPCS.filter(function (u) { return u !== goodRpc; })) : RPCS.slice();
    for (let i = 0; i < urls.length; i++) {
      try {
        const result = await rpc(urls[i], method, params);
        goodRpc = urls[i];
        return result;
      } catch (err) {
        last = err;
        lastRpcError = (urls[i] + ": " + (err && err.message ? err.message : err));
        if (urls[i] === goodRpc) goodRpc = null;
      }
    }
    throw last || new Error("All RPCs failed");
  }

  function sameAddr(a, b) {
    return String(a || "").toLowerCase() === String(b || "").toLowerCase();
  }

  function valueMatches(valueHexOrDec, expectedWei) {
    try {
      const v = BigInt(valueHexOrDec);
      return v === BigInt(expectedWei);
    } catch (e) {
      return false;
    }
  }

  async function checkTxHash(hash, expectedWei) {
    const h = String(hash || "").trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(h)) throw new Error("That does not look like a transaction hash.");
    const tx = await rpcFirst("eth_getTransactionByHash", [h]);
    if (!tx) throw new Error("Transaction not found yet. Wait for it to appear, then try again.");
    if (!sameAddr(tx.to, RECEIVE)) throw new Error("That transfer is not to the Plainpay receive address.");
    if (!valueMatches(tx.value, expectedWei)) throw new Error("Amount does not match the exact unlock total for this browser.");
    const receipt = await rpcFirst("eth_getTransactionReceipt", [h]);
    if (!receipt) throw new Error("Found the transfer, waiting for confirmation.");
    if (receipt.status && receipt.status !== "0x1") throw new Error("That transaction did not succeed.");
    return { hash: h, confirmed: true };
  }

  async function scanRecentBlocks(expectedWei) {
    const latestHex = await rpcFirst("eth_blockNumber", []);
    const latest = parseInt(latestHex, 16);
    const lookback = 16;
    for (let n = latest; n >= latest - lookback && n >= 0; n--) {
      const block = await rpcFirst("eth_getBlockByNumber", ["0x" + n.toString(16), true]);
      if (!block || !block.transactions) continue;
      for (let i = 0; i < block.transactions.length; i++) {
        const tx = block.transactions[i];
        if (!tx || !sameAddr(tx.to, RECEIVE)) continue;
        if (!valueMatches(tx.value, expectedWei)) continue;
        return { hash: tx.hash, confirmed: true };
      }
    }
    return null;
  }

  async function scanIndexers(expectedWei) {
    for (let i = 0; i < INDEXERS.length; i++) {
      try {
        const res = await fetch(INDEXERS[i]);
        if (!res.ok) continue;
        const json = await res.json();
        const items = json.items || json.result || [];
        for (let j = 0; j < items.length; j++) {
          const it = items[j];
          const to = (it.to && (it.to.hash || it.to)) || it.toHash || "";
          const value = it.value;
          const status = String(it.status || it.result || "").toLowerCase();
          const failed = status === "error" || status === "failed";
          if (failed) continue;
          if (to && !sameAddr(to, RECEIVE) && it.from) {
            /* some payloads list direction separately */
          }
          if (value != null && valueMatches(value, expectedWei)) {
            const hash = it.hash || it.tx_hash || it.transactionHash;
            return { hash: hash, confirmed: true };
          }
        }
      } catch (err) {
        lastRpcError = "indexer: " + (err && err.message ? err.message : err);
      }
    }
    return null;
  }

  async function lookForPayment() {
    const checkout = getCheckout();
    const expected = checkout.totalWei;
    const indexerHit = await scanIndexers(expected);
    if (indexerHit) return indexerHit;
    try {
      return await scanRecentBlocks(expected);
    } catch (err) {
      lastRpcError = err && err.message ? err.message : String(err);
      return null;
    }
  }

  function tryManualCode(input) {
    const checkout = getCheckout();
    const expected = BigInt(checkout.totalWei);
    const parsed = parseEthToWei(input);
    if (parsed === null) return { ok: false, error: "Enter the exact ETH amount shown above." };
    if (parsed === expected) return { ok: true };
    if (parsed === BigInt(checkout.extraWei)) return { ok: true };
    return { ok: false, error: "That code does not match the amount generated in this browser." };
  }

  function stopWatch() {
    if (watchTimer) {
      clearInterval(watchTimer);
      watchTimer = null;
    }
  }

  function startWatch(onTick, onUnlock) {
    stopWatch();
    async function tick() {
      onTick("Looking for a confirmed transfer of " + getCheckout().totalEth + " ETH…");
      try {
        const hit = await lookForPayment();
        if (hit) {
          stopWatch();
          const u = markUnlocked({ txHash: hit.hash, source: "watch" });
          onUnlock(u);
          return;
        }
        const extra = lastRpcError ? " Last probe: " + lastRpcError : "";
        onTick("No matching confirmed transfer yet. Checking about every 12 seconds." + extra);
      } catch (err) {
        onTick("Could not reach a public RPC (" + (err && err.message ? err.message : err) + "). Use the unlock code if your transfer already confirmed.");
      }
    }
    tick();
    watchTimer = setInterval(tick, 12000);
  }

  global.Plainpay = {
    RECEIVE: RECEIVE,
    RECEIVE_LC: RECEIVE_LC,
    STORAGE_DRAFT: STORAGE_DRAFT,
    getCheckout: getCheckout,
    eip681: eip681,
    requestUri: requestUri,
    isUnlocked: isUnlocked,
    markUnlocked: markUnlocked,
    tryManualCode: tryManualCode,
    checkTxHash: checkTxHash,
    lookForPayment: lookForPayment,
    startWatch: startWatch,
    stopWatch: stopWatch,
    freeCopiesUsed: freeCopiesUsed,
    recordFreeCopy: recordFreeCopy,
    weiToEth: weiToEth,
    parseEthToWei: parseEthToWei,
    ethAmountToWei: ethAmountToWei,
    lastError: function () { return lastRpcError; }
  };
})(window);
