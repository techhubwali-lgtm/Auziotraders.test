# AUZIO TRADERS — Production Deployment Guide for JetHosting (`ns1.eu1001.jethosting.com`)

This project includes ready-to-deploy builds for **both** JetHosting cPanel hosting modes:
- **Option A — cPanel Setup Node.js App** (Recommended if your plan includes Node.js 18/20+)
- **Option B — Standard cPanel `public_html` + PHP 8.x** (Zero Node.js required)

---

## Step 1: Build Production Bundles Locally (Already Prepared)

Run this single command from the project root:
```bash
npm run build:cpanel
```
This outputs:
- `dist/` — Production minified React SPA + static vehicle assets
- `dist-server/server.cjs` — Standalone Node.js production server bundle (for Option A)

---

## Option A: Deploy Using cPanel **Setup Node.js App** (Recommended)

1. In JetHosting cPanel, open **File Manager** and create a folder outside `public_html`, e.g.:
   `/home/<your-cpanel-user>/auziotraders-app/`
2. Upload these items into `/home/<your-cpanel-user>/auziotraders-app/`:
   - `dist/` (entire folder)
   - `dist-server/server.cjs`
   - `package.json`
3. In cPanel, open **Setup Node.js App** → **Create Application**:
   - **Node.js version**: `20.x` (or `18.x`)
   - **Application mode**: `Production`
   - **Application root**: `auziotraders-app`
   - **Application URL**: `auziotraders.com`
   - **Application startup file**: `dist-server/server.cjs`
4. Add **Environment Variables** in the cPanel Node.js App panel:
   - `NODE_ENV` = `production`
   - `AJES_API_CODE` = `<your 13-character AJES API code>` *(just the code, NOT a URL)*
5. Click **Run NPM Install** (or via SSH: `npm install --omit=dev`), then click **Start / Restart**.

---

## Option B: Deploy Using Standard cPanel **`public_html` + PHP 8.x** (No Node.js Needed)

1. Upload the entire contents of `dist/` directly into `/home/<your-cpanel-user>/public_html/`.
2. Upload the files from `deploy/cpanel-php/public_html/` into `/home/<your-cpanel-user>/public_html/`:
   - `public_html/.htaccess`
   - `public_html/api/auction.php`
3. Upload `deploy/cpanel-php/auzio-secrets.example.php` **one level ABOVE `public_html/`**, rename it to:
   `/home/<your-cpanel-user>/auzio-secrets.php`
   - Edit `auzio-secrets.php` and replace `YOUR_13_CHAR_AJES_CODE_HERE` with your 13-character AJES API code.
   - Set its permissions to **`0600`** in cPanel File Manager so only your server user can read it.
4. In cPanel → **MultiPHP Manager**, verify `auziotraders.com` is set to **PHP 8.1 / 8.2 / 8.3** with `curl` enabled (enabled by default on JetHosting).

---

## Step 2: Mandatory Live Domain Setup (Both Options)

1. **SSL Certificate (HTTPS)**:
   - In JetHosting cPanel → **SSL/TLS Status**, click **Run AutoSSL** for `auziotraders.com` and `www.auziotraders.com`.
2. **Firebase Authentication Authorized Domains**:
   - Open [Firebase Console](https://console.firebase.google.com/) → your project → **Authentication → Settings → Authorized domains**.
   - Click **Add domain** and add:
     - `auziotraders.com`
     - `www.auziotraders.com`
   - *(Without this, customer and staff logins will be blocked by Firebase on your live domain.)*
3. **DNS Check**:
   - Ensure your domain registrar points to JetHosting nameservers (`ns1.eu1001.jethosting.com` / `ns2.eu1001.jethosting.com`) and the A record resolves to your JetHosting server IP.

---

## Step 3: Post-Deployment Verification

Open these URLs in your browser after uploading:
1. `https://auziotraders.com/` — Storefront loads over HTTPS with no console errors.
2. `https://auziotraders.com/api/auction/status` — Should return `"ok": true` and `"mode": "ajes_api"`.
3. `https://auziotraders.com/api/auction/search?make=Toyota` — Should return live Toyota auction lots with `&w=320` images.
4. Test **Customer Login** and **Management / Staff Login** (`techhub.wali@gmail.com`).
