# Cruzar Ingest — Chrome extension

One-click ingestion of Facebook group border-wait reports into `cruzar.app`.

## Install (once)

1. Open `chrome://extensions` in Chrome
2. Toggle **Developer mode** on (top right)
3. Click **Load unpacked**
4. Select the folder `C:\Users\dnawa\cruzar\chrome-extension`
5. The **Cruzar Ingest** extension appears in your toolbar

## Configure

1. Click the extension icon in the toolbar → popup opens
2. **Endpoint:** leave as `https://cruzar.app/api/ingest/fb-post` unless you're testing a preview deploy
3. **Ingest Secret:** paste the `INGEST_SECRET` you set in Vercel
4. Click **Save**

## Use

1. Open any Facebook group where people post wait times
2. Select the text of a report (click-drag to highlight)
3. Right-click → **📥 Enviar a Cruzar**
4. A system notification confirms how many reports were inserted (1+ per post depending on lanes mentioned)

The extension auto-detects the group name from the page title.

## Under the hood

- `manifest.json` — MV3 manifest, permissions limited to facebook.com and cruzar.app
- `background.js` — service worker; registers context menu, reads selection, POSTs to `/api/ingest/fb-post`
- `popup.html` / `popup.js` — settings UI for endpoint + secret (stored in `chrome.storage.local`)
- `icon.png` — placeholder icon

## Updating

After edits, go to `chrome://extensions`, find Cruzar Ingest, click the reload icon (⟳).
