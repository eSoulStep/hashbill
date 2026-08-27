# Plainpay

Static Ethereum **payment requests**. A freelancer (or anyone) fills in a payee address, an exact ETH amount, and an optional note. The page draws an EIP-681 QR and copyable text a client can settle from their own wallet.

This is not an invoice product. There is no line-item ledger, no PDF studio, and no wallet-connect flow. The page never asks for a signature or a key.

Serve the folder as static files, or push it to GitHub Pages (this tree includes `.nojekyll`). Opening `index.html` through a static server is enough.

## What you get

- Payee address, ETH amount, optional name / note / reference
- Live payment-request card with EIP-681 QR (`ethereum:<address>@1?value=<wei>`)
- Copy request, copy URI, copy address, copy amount
- Free: one watermarked copy per browser (`localStorage`)
- Paid: unlimited unbranded requests in that same browser

The payee on the card is **your** receive address — the one your client should pay. It is not Plainpay’s unlock address.

## Unlock (Ethereum mainnet, native ETH)

A one-time native ETH transfer unlocks this browser. It is not the request you send a client.

Receive address: `0x6c2094e511a6d6F5a44Ad3815fDAC7125D007a3D`

Price: **0.004 ETH** plus a unique extra **1 to 999,999 wei** generated in this browser. Send exactly the amount shown. After a matching confirmed incoming transfer, `localStorage` unlocks unlimited unbranded requests and shows that unique amount as a backup unlock code.

The unlock panel shows the address, exact amount, EIP-681 QR, and copy buttons. Pay from a wallet you already use. There is no wallet connection.

## Payment matching

Watch for my payment / Check now probes public sources:

1. Blockscout REST (`eth.blockscout.com` API v2 address transactions)
2. JSON-RPC fallbacks scanning recent blocks for a native ETH transfer to the receive address with the exact wei value: `ethereum.publicnode.com`, `eth.llamarpc.com`, `cloudflare-eth.com`, `1rpc.io/eth`, `rpc.ankr.com/eth`, `eth.drpc.org`

Optional: paste a transaction hash to verify it on those RPCs, or paste the exact ETH amount as a manual unlock code.

### CORS caveat

Public RPCs and indexers set their own CORS headers. Some browsers, extensions, or `file://` origins will block fetches. If that happens, confirm the exact amount on a block explorer, then paste it into the unlock-code box. The watcher is implemented either way; the manual box is the backup.

Unlock is per browser origin. The unique amount is stored locally when generated.

## GitHub Pages

1. Put this folder at the root of a repository (or in `/docs`).
2. Settings → Pages → Deploy from branch.
3. `.nojekyll` is already present so GitHub does not run Jekyll on `css/` / `js/`.

Local check:

```
python3 -m http.server 4174
```

Then open `http://127.0.0.1:4174/`.

## Files

- `index.html`
- `css/app.css`
- `js/app.js`
- `js/pay.js`
- `js/qr.js` (local QR; image API fallback only if encoding throws)
- `.nojekyll`

This tree contains no secrets. Do not add wallet JSON or seed material here.

## Disclaimer

Plainpay is a static formatter. It is not a custodian, exchange, wallet, or payment processor. It does not move funds and is not tax, accounting, or legal advice.
