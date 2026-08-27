# Hashbill

Hashbill is a local, original invoice generator for people who get paid in crypto.

Draft an invoice in the browser, watch a live paper preview, and download a PDF. There is no account and no connect-wallet flow.

This tree is original work: layout, copy, payment matching, QR drawing, and the PDF writer were written for Hashbill v1. It is not a skin of another invoice product.

Serve this folder as static files (Python http.server on port 4173 works), or open index.html directly.

Free tier: live preview and one watermarked PDF per browser (localStorage). Paid: unlimited unbranded PDFs, and From details are remembered locally after unlock.

Invoice fields: From and To (name, optional email, wallet/ENS), invoice number, issue date, due date, token plus chain, line items (description, qty, unit price), optional fee/tax, total in crypto and optional fiat equivalent, payee wallet, payer wallet, optional tx hash, notes. Footer: document template, not tax or legal advice.

The payee wallet on the invoice is your client-facing address. It is not Hashbill's receive address.

## Unlock (Ethereum mainnet, native ETH)

Unlock is a one-time native ETH transfer for this browser. It is not the invoice you send a client.

Receive address: 0x6c2094e511a6d6F5a44Ad3815fDAC7125D007a3D

Price: 0.004 ETH plus a unique extra 1 to 999999 wei generated in this browser. Send exactly the amount shown. After a matching confirmed incoming transfer, this browser unlocks unlimited unbranded PDFs. The displayed amount is what to send, not an unlock code. If the watcher cannot see the chain, paste the transaction hash.

The page shows the address, exact amount, QR (EIP-681), and copy buttons. Pay from a wallet you already use. There is no wallet connection.

## Payment matching

Watch for my payment / Check now probes public sources:

1. Blockscout REST (eth.blockscout.com API v2 address transactions)
2. JSON-RPC fallbacks scanning recent blocks for a native ETH transfer to the receive address with the exact wei value: ethereum.publicnode.com, eth.llamarpc.com, cloudflare-eth.com, 1rpc.io/eth, rpc.ankr.com/eth, eth.drpc.org

Optional: paste a transaction hash to verify it on those RPCs.

### CORS caveat

Public RPCs and indexers set their own CORS headers. Some browsers, extensions, or file:// origins will block fetches. If that happens, confirm the transfer on a block explorer, then paste the transaction hash. Pasting the send amount does not unlock.

Unlock is per browser origin. The unique amount is stored locally when generated.

## PDF

PDFs are built in the browser (js/pdf.js, Helvetica A4). Print / Save as PDF is a second path. Free PDFs show HASHBILL PREVIEW. Paid PDFs do not.

## Files

- index.html
- css/styles.css
- js/app.js
- js/payment.js
- js/pdf.js
- js/qr.js (local QR; image API fallback only if encoding throws)

This tree contains no secrets. Do not add wallet JSON or seed material here.
