# 2020 Measure (Leica DISTO X3)

A lightweight Netlify-hosted measure-sheet web app designed to work with the Leica DISTO X3 using **Bluetooth keyboard mode**.

## Why keyboard mode?
The X3 can behave like a Bluetooth keyboard and "types" the measured value into the cursor position. That means you can use this in a normal browser without needing a proprietary BLE protocol.

## Deploy (GitHub + Netlify)
1. Create a GitHub repo (e.g. `leica-measure`).
2. Copy all files from this folder into the repo root and push to `main`.
3. In Netlify: **Add new site** → **Import from Git** → pick the repo.
4. Deploy settings:
   - Build command: *(empty)*
   - Publish directory: `.`

### Turn on employee login (Netlify Identity)
1. Netlify dashboard → **Identity** → Enable.
2. Identity → **Registration preferences**: set to “Invite only” (recommended).
3. Invite employees (Identity → Invite users).

### Turn on Admin Console (Decap CMS)
1. Identity → Enable **Git Gateway**.
2. Invite only the users who should edit settings.
3. Visit `/admin/`.

## Pairing + Settings on the Leica DISTO X3
- Pair the X3 in your device Bluetooth settings. It will show as a keyboard.
- In the X3 Bluetooth settings, set termination to **Tab** so it jumps to the next field after each measurement.
- Optional: turn unit transfer off so it sends plain numbers.

## Using the form
- Go to `/app` and sign in.
- Add windows.
- Click the first input and start measuring. If termination is set to Tab, it will automatically advance through the fields.
- The smallest of the 3 widths and 3 heights is highlighted, and the min values are shown.
- Submit sends a single JSON payload to **Netlify Forms** (see site dashboard → Forms).

## Next steps (future features)
- Window templates by product type
- Photo capture per window (mobile)
- PDF export
- Job list + search (database)
- Direct BLE read (if Leica GATT protocol is available)
