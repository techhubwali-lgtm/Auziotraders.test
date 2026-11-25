import 'dotenv/config';
import { CANDIDATE_DEALER_SOURCES, getCandidateSourceById } from '../server/dealerStock/sourceRegistry.ts';
import { auditDealerSource, runDealerSourceExtraction } from '../server/dealerStock/syncEngine.ts';
import { DEFAULT_DEALER_PRICING_RULES } from '../src/data/dealerPricing.ts';

/**
 * Standalone CLI runner for GitHub Actions (6-hour scheduled sync) and local compliance audits.
 * Usage:
 *   npx tsx scripts/syncDealerStock.ts --dry-run --source=flexnet --max=20
 *   npx tsx scripts/syncDealerStock.ts --audit
 *   npx tsx scripts/syncDealerStock.ts --max=50
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const auditOnly = args.includes('--audit');
  const sourceArg = args.find((a) => a.startsWith('--source='))?.split('=')[1];
  const maxArg = Number(args.find((a) => a.startsWith('--max='))?.split('=')[1] || 50);
  const maxVehicles = Math.min(100, Math.max(1, Number.isFinite(maxArg) ? maxArg : 50));

  const targets = sourceArg
    ? [getCandidateSourceById(sourceArg)].filter((s): s is NonNullable<typeof s> => Boolean(s))
    : CANDIDATE_DEALER_SOURCES.filter((s) => s.enabled);

  if (targets.length === 0) {
    console.error('No matching enabled Japanese dealer sources found.');
    process.exit(1);
  }

  console.log(
    `[Auzio Dealer Sync] Starting ${auditOnly ? 'AUDIT' : dryRun ? 'DRY-RUN' : 'SYNC'} for ${targets.length} source(s) (cap ${maxVehicles} vehicles/source)...`
  );

  for (const source of targets) {
    if (auditOnly) {
      const report = await auditDealerSource(source, DEFAULT_DEALER_PRICING_RULES);
      console.log(
        JSON.stringify(
          {
            sourceId: report.sourceId,
            complianceStatus: report.complianceStatus,
            robotsAllowed: report.robotsAllowed,
            robotsSummary: report.robotsSummary,
            sampleExtractedCount: report.sampleExtractedCount,
            verifiedRealExtraction: report.verifiedRealExtraction,
            sampleTitles: report.sampleVehicles.slice(0, 3).map((v) => ({
              stockId: v.stockId,
              title: [v.manufacturingYear, v.manufacturer, v.model].filter(Boolean).join(' '),
              estimatedFobUsd: v.estimatedFobUsd,
              url: v.originalListingUrl,
            })),
          },
          null,
          2
        )
      );
      continue;
    }

    const result = await runDealerSourceExtraction({
      source,
      maxVehicles,
      dryRun,
      pricingRules: DEFAULT_DEALER_PRICING_RULES,
    });

    console.log(
      JSON.stringify(
        {
          sourceId: result.sourceId,
          ok: result.ok,
          dryRun: result.dryRun,
          extractedCount: result.vehicles.length,
          duplicateSkipped: result.duplicateSkippedCount,
          errors: result.errors.length,
          durationMs: result.durationMs,
          sample: result.vehicles.slice(0, 3).map((v) => ({
            stockId: v.stockId,
            manufacturer: v.manufacturer,
            model: v.model,
            year: v.manufacturingYear,
            mileageKm: v.mileageKm,
            engineCapacityCc: v.engineCapacityCc,
            bodyType: v.bodyType,
            estimatedFobUsd: v.estimatedFobUsd,
            imageCount: v.images.length,
            originalListingUrl: v.originalListingUrl,
          })),
        },
        null,
        2
      )
    );
  }
}

main().catch((err) => {
  console.error('[Auzio Dealer Sync] Fatal error:', err);
  process.exit(1);
});
