# Auzio Traders — Japanese Dealer Stock Integration Guide

## 1. Architecture Overview

The Japanese Dealer Stock Integration runs strictly **server-side** (never scraping from the customer browser) and keeps dealer inventory isolated from Live Japanese Auction listings across 7 dedicated Firestore collections:

1. `dealer_sources` — Registry of the 22 candidate Japanese dealer sources, compliance audit verdicts, `robots.txt` summaries, and rate-limit settings.
2. `dealer_stock` — Publicly browsable, normalized Japanese dealer inventory. Contains **only** customer-facing Estimated FOB prices (never raw dealer costs or internal profit margin formulas).
3. `dealer_pricing_rules` — Strictly staff/admin-only confidential profit margins, inland Japan transport, export handling, documentation, and emergency-stop switch.
4. `dealer_price_history` — Staff-only historical log of original Japanese dealer JPY prices and Estimated FOB changes.
5. `dealer_sync_logs` — Operational log of manual, scheduled, dry-run, and CSV/XML feed sync executions.
6. `dealer_import_errors` — Structured diagnostics for `robots.txt`, HTTP, HTML parser, or feed validation issues.
7. `dealer_inquiries` — Customer quotation and live availability confirmation requests.

## 2. Compliance & Responsible Extraction Policy

- Every domain is validated against an allowlist and private-IP SSRF filter before any HTTP request is made.
- `robots.txt` is fetched and honored before extraction.
- HTTP 403 / 429 / WAF / CAPTCHA challenges are **never bypassed**. Blocked or prohibited sites are automatically disabled and flagged for an **Authorized CSV/XML Feed** or direct B2B partnership.
- If a source fails to load during a sync, existing listings are marked `unverified` (never mass-marked as `sold`).

## 3. Verified Live Source Audit Summary (22 Candidates)

| Status | Domains |
| --- | --- |
| **Verified Compliant & Tested** | `www.flexnet.co.jp` (FLEX — 40 cars/page, Schema.org ItemList + HTML), `www.applenet.co.jp` (Apple Auto Network — 50 cars/page, HTML) |
| **Disabled — `robots.txt` / ToS Prohibited** | `www.nextage.jp` (`Disallow: /search/`), `toyota.jp/ucar/` (`Disallow: /detail/`), `www.carsensor.net` (Aggregator ToS) |
| **Disabled — HTTP 403 / WAF / Bot Gate** | `ucar.honda.co.jp`, `u-catch.daihatsu.co.jp`, `www.e-rabbit.jp`, `www.wecars.co.jp`, `www.carseven.co.jp`, `www.goo-net.com` |
| **Disabled — Unreachable / Pending Review** | `221616.com`, `www.suv-land.jp`, `www.carchs.com`, `k-p-nice.com`, `k-brand.jp`, `u-car.nissan.co.jp`, `www.suzuki.co.jp/ucar/`, `www.mazda.co.jp`, `sugdas.jp`, `ucar.mitsubishi-motors.co.jp`, `cpo.lexus.jp` |

## 4. Automated 6-Hour Sync via GitHub Actions

Workflow file: `.github/workflows/dealer-stock-sync.yml`

- Runs automatically every 6 hours (`0 */6 * * *`) and supports manual runs (`workflow_dispatch`) with dry-run mode and single-source targeting.
- Set repository variable `DEALER_SYNC_EMERGENCY_STOP=true` in GitHub Settings → Actions → Variables to immediately pause scheduled runs.
- Run locally or verify compliance anytime:
  ```bash
  npx tsx scripts/syncDealerStock.ts --audit --source=flexnet
  npx tsx scripts/syncDealerStock.ts --dry-run --source=applenet --max=20
  ```
