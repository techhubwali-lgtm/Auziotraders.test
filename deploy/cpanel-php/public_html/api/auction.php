<?php
/**
 * AUZIO TRADERS — Production PHP Backend for /api/auction/* on Shared cPanel Hosting
 *
 * Mirrors server/auctionProxy.ts for JetHosting / cPanel accounts without Node.js:
 * - Official AJES SQL/JSON API (http://78.46.90.228/api/?json&ip=...&code=...&sql=...)
 * - Supports both `main` (live upcoming auctions) and `stats` (sold price statistics)
 * - Strictly validates & allowlists all query parameters (no arbitrary SQL)
 * - Caches metadata (10 min) and individual opened lots by ID (10 min) per AJES rules
 * - Never bulk-loads all lots; every search queries AJES live on demand
 * - Uses AJES 3-size images: &w=320 (medium), &h=50 (small), unresized (big/zoom/sheet)
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

const AJES_API_BASE = 'http://78.46.90.228/api/';
const AUC_BASE_ORIGIN = 'https://auc.auziotraders.com';
const ALLOWED_IMG_PREFIX = 'https://8.ajes.com/imgs/';
const META_TTL_SEC = 600; // 10 min (AJES Rule #2.1 & #2.2)
const LOT_TTL_SEC = 600;  // 10 min (AJES Rule #2.3)

function loadAjesApiCode(): string
{
    $raw = '';
    $envVal = getenv('AJES_API_CODE');
    if (is_string($envVal) && trim($envVal) !== '') {
        $raw = trim($envVal);
    } else {
        // Look one directory above public_html: /home/<user>/auzio-secrets.php
        $secretsPath = dirname(__DIR__, 2) . '/auzio-secrets.php';
        if (is_file($secretsPath) && is_readable($secretsPath)) {
            $cfg = require $secretsPath;
            if (is_array($cfg) && isset($cfg['AJES_API_CODE']) && is_string($cfg['AJES_API_CODE'])) {
                $raw = trim($cfg['AJES_API_CODE']);
            }
        }
    }

    $raw = trim($raw, " \t\n\r\0\x0B'\"");
    if ($raw === '' || $raw === 'YOUR_13_CHAR_AJES_CODE_HERE') {
        return '';
    }

    if (preg_match('/^https?:\/\//i', $raw)) {
        $parts = parse_url($raw);
        if (!empty($parts['query'])) {
            parse_str($parts['query'], $qs);
            $extracted = isset($qs['code']) && is_string($qs['code']) ? trim($qs['code']) : '';
            if (preg_match('/^[A-Za-z0-9_-]{6,64}$/', $extracted)) {
                return $extracted;
            }
        }
        return '';
    }

    return preg_match('/^[A-Za-z0-9_-]{6,64}$/', $raw) ? $raw : '';
}

function getClientIp(): string
{
    $candidate = '';
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $parts = explode(',', (string)$_SERVER['HTTP_X_FORWARDED_FOR']);
        $candidate = trim($parts[0]);
    } elseif (!empty($_SERVER['REMOTE_ADDR'])) {
        $candidate = trim((string)$_SERVER['REMOTE_ADDR']);
    }
    $candidate = preg_replace('/^::ffff:/i', '', $candidate) ?? '';

    if (filter_var($candidate, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
        return $candidate;
    }
    return '203.0.113.1';
}

function cacheGet(string $key, int $ttlSec): ?array
{
    $file = rtrim(sys_get_temp_dir(), '/\\') . '/auzio_ajes_' . hash('sha256', $key) . '.json';
    if (!is_file($file)) {
        return null;
    }
    if ((time() - (int)filemtime($file)) > $ttlSec) {
        @unlink($file);
        return null;
    }
    $raw = @file_get_contents($file);
    if ($raw === false) {
        return null;
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : null;
}

function cacheSet(string $key, array $value): void
{
    $file = rtrim(sys_get_temp_dir(), '/\\') . '/auzio_ajes_' . hash('sha256', $key) . '.json';
    @file_put_contents($file, json_encode($value), LOCK_EX);
}

function queryAjesSql(string $sql, string $code, string $ip): array
{
    $url = AJES_API_BASE
        . '?json&ip=' . rawurlencode($ip)
        . '&code=' . rawurlencode($code)
        . '&sql=' . rawurlencode($sql);

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 12,
            CURLOPT_CONNECTTIMEOUT => 6,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_HTTPHEADER => ['Accept: application/json, text/plain, */*'],
            CURLOPT_USERAGENT => 'AUZIO-TRADERS-Portal/1.0',
        ]);
        $body = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($body === false || $httpCode < 200 || $httpCode >= 300) {
            throw new RuntimeException($err !== '' ? "AJES request failed ($err)" : "AJES API returned HTTP $httpCode");
        }
    } else {
        $ctx = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => 12,
                'header' => "Accept: application/json\r\nUser-Agent: AUZIO-TRADERS-Portal/1.0\r\n",
            ],
        ]);
        $body = @file_get_contents($url, false, $ctx);
        if ($body === false) {
            throw new RuntimeException('Unable to connect to AJES API');
        }
    }

    $trimmed = trim((string)$body);
    if ($trimmed === '') {
        return [];
    }
    if ($trimmed[0] !== '[') {
        $notice = substr(trim(strip_tags($trimmed)), 0, 140);
        throw new RuntimeException($notice !== '' ? $notice : 'Unexpected response from AJES API');
    }

    $rows = json_decode($trimmed, true);
    return is_array($rows) ? $rows : [];
}

function sanitizeAlphaNum(string $val, int $maxLen): string
{
    $clean = preg_replace('/[^A-Za-z0-9 .-]/', '', trim($val)) ?? '';
    $clean = preg_replace('/\s+/', ' ', $clean) ?? '';
    return substr(trim($clean), 0, $maxLen);
}

function sanitizeCode(string $val, int $maxLen): string
{
    $clean = preg_replace('/[^A-Za-z0-9-]/', '', trim($val)) ?? '';
    return substr($clean, 0, $maxLen);
}

function toTitleCase(string $input): string
{
    $clean = trim(preg_replace('/\s+/', ' ', strip_tags($input)) ?? '');
    if ($clean === '') {
        return '';
    }
    $upperWords = ['BMW', 'GMC', 'SUV', 'GT', 'GR', 'RS', 'AMG', 'CR-V', 'HR-V', 'RAV4', 'RX', 'NX', 'LX', 'GX', 'UX', 'CX-5', 'CX-8', 'CX-3', 'UD', 'VW', 'MINI'];
    $words = explode(' ', $clean);
    $out = [];
    foreach ($words as $w) {
        $up = strtoupper($w);
        if (in_array($up, $upperWords, true) || (strlen($w) <= 2 && preg_match('/^[A-Z0-9-]+$/i', $w))) {
            $out[] = $up;
        } else {
            $out[] = ucfirst(strtolower($w));
        }
    }
    return implode(' ', $out);
}

function extractSafeBaseImg(string $raw): ?string
{
    $trimmed = str_replace('\\/', '/', trim($raw));
    $withoutSize = preg_replace('/&(?:h=50|w=320)$/i', '', $trimmed) ?? '';
    if (str_starts_with($withoutSize, ALLOWED_IMG_PREFIX)) {
        $token = substr($withoutSize, strlen(ALLOWED_IMG_PREFIX));
        if (preg_match('/^[a-zA-Z0-9_-]{8,160}$/', $token)) {
            return ALLOWED_IMG_PREFIX . $token;
        }
    }
    return null;
}

function parseAjesImages(string $rawImages, bool $isDetailById): array
{
    $bases = [];
    foreach (explode('#', $rawImages) as $part) {
        $base = extractSafeBaseImg($part);
        if ($base !== null && !in_array($base, $bases, true)) {
            $bases[] = $base;
        }
    }
    if (count($bases) === 0) {
        return ['medium' => [], 'full' => [], 'thumbs' => [], 'sheet' => null];
    }

    $sheet = null;
    if ($isDetailById && count($bases) >= 2) {
        $sheet = $bases[0];
        $photos = array_slice($bases, 1, 8);
    } else {
        $photos = array_slice($bases, 0, 8);
    }

    return [
        'medium' => array_map(static fn(string $b): string => $b . '&w=320', $photos),
        'full' => $photos,
        'thumbs' => array_map(static fn(string $b): string => $b . '&h=50', $photos),
        'sheet' => $sheet,
    ];
}

function inferBodyType(string $name, string $trim): string
{
    $hay = strtoupper($name . ' ' . $trim);
    if (preg_match('/PRADO|LAND CRUISER|HARRIER|RAV4|X-TRAIL|FORESTER|OUTLANDER|PAJERO|CR-V|VEZEL|CX-5|CX-8|CX-3|JIMNY|C-HR|RUSH|RX|NX|LX|GX|DEFENDER|RANGE ROVER|WRANGLER|X3|X5|Q5|Q7|GLE|GLC|RAIZE|ROCKY|YARIS CROSS|COROLLA CROSS/', $hay)) {
        return 'SUV';
    }
    if (preg_match('/HILUX|TRITON|NAVARA|RANGER|D-MAX|TUNDRA|TACOMA|PICKUP|TRUCK|CANTER|ELF|DUTRO|DYNA|CARRY/', $hay)) {
        return 'Pickup';
    }
    if (preg_match('/HIACE|ALPHARD|VELLFIRE|NOAH|VOXY|SERENA|STEPWGN|ELGRAND|ESTIMA|DELICA|CARAVAN|EVERY|N-BOX|TANTO|SPACIA|SIENTA|FREED|ODYSSEY|PROBOX|TOWN ACE|TOWNACE/', $hay)) {
        return 'Van';
    }
    if (preg_match('/86|BRZ|GT-R|GTR|SUPRA|FAIRLADY|ROADSTER|MX-5|RX-7|RX-8|911|COUPE|LC500/', $hay)) {
        return 'Coupe';
    }
    if (preg_match('/FIELDER|TOURING|WAGON|LEVORG|OUTBACK|LEGACY|ESTATE|AVANT/', $hay)) {
        return 'Wagon';
    }
    if (preg_match('/FIT|VITZ|YARIS|AQUA|DEMIO|SWIFT|NOTE|MARCH|PASSO|MIRAGE|ALTO|WAGON R|HUSTLER|GOLF|POLO|MINI|PRIUS|LEAF/', $hay)) {
        return 'Hatchback';
    }
    return 'Sedan';
}

function estimateVolumeM3(string $bodyType, string $name): float
{
    if (preg_match('/LAND CRUISER|LX|ALPHARD|VELLFIRE|HIACE|CARAVAN|ELGRAND|HILUX|NAVARA|TRITON|PAJERO/i', $name)) {
        return 16.8;
    }
    return match ($bodyType) {
        'SUV' => 15.2,
        'Pickup' => 16.5,
        'Van' => 15.8,
        'Wagon' => 13.4,
        'Sedan' => 13.0,
        'Coupe' => 12.2,
        default => 11.4,
    };
}

function inferFuelType(string $name, string $trim, int $cc): string
{
    $hay = strtoupper($name . ' ' . $trim);
    if (preg_match('/LEAF|BZ4X|ARIYA|MODEL 3|MODEL Y|SAKURA|ELECTRIC/', $hay) || $cc <= 100) {
        return 'Electric';
    }
    if (preg_match('/PRIUS|AQUA|HYBRID|E-POWER|E:HEV|PHEV|PHV|CT200|UX250|RX450|NX300H/', $hay)) {
        return 'Hybrid';
    }
    if (preg_match('/DIESEL|GDJ|KDJ|GUN125|KDH|GDH|CDI|TDI|2\.8D|3\.0D/', $hay)) {
        return 'Diesel';
    }
    return 'Petrol';
}

function normalizeTransmission(string $raw): string
{
    $up = strtoupper(trim($raw));
    if (preg_match('/MT|F5|F6|5M|6M|M5|M6|MANUAL/', $up)) {
        return 'Manual';
    }
    if (preg_match('/CVT|CA\b|ECVT/', $up)) {
        return 'CVT';
    }
    return 'Automatic';
}

function normalizeDrivetrain(string $raw): string
{
    $up = strtoupper(trim($raw));
    if (preg_match('/4WD|4X4/', $up)) {
        return '4WD';
    }
    if (preg_match('/AWD|FULLTIME/', $up)) {
        return 'AWD';
    }
    return '2WD';
}

function normalizeOriginPort(string $auction): string
{
    $up = strtoupper($auction);
    if (preg_match('/NAGOYA|CHUBU|SHIZUOKA|GIFU/', $up)) {
        return 'Nagoya';
    }
    if (preg_match('/KOBE|HYOGO|HAA/', $up)) {
        return 'Kobe';
    }
    if (preg_match('/OSAKA|KINKI|KANSAI/', $up)) {
        return 'Osaka';
    }
    if (preg_match('/KYUSHU|FUKUOKA|HAKATA|KUMAMOTO/', $up)) {
        return 'Hakata';
    }
    return 'Yokohama';
}

function normalizeGrade(string $raw): string
{
    $cleaned = strtoupper(trim(strip_tags($raw)));
    $allowed = ['S', '6', '5', '4.5', '4', '3.5', '3', 'R', 'RA'];
    if (in_array($cleaned, $allowed, true)) {
        return $cleaned;
    }
    if (preg_match('/^(S|6|5|4\.5|4|3\.5|3|R|RA)/', $cleaned, $m)) {
        return $m[1];
    }
    return '4';
}

function normalizeRowToVehicle(array $row, string $table, float $jpyRate, bool $isDetailById): ?array
{
    $lotId = trim((string)($row['ID'] ?? ''));
    if ($lotId === '' || !preg_match('/^[a-zA-Z0-9_-]{4,48}$/', $lotId)) {
        return null;
    }

    $rawMake = trim(strip_tags((string)($row['MARKA_NAME'] ?? '')));
    $rawModel = trim(strip_tags((string)($row['MODEL_NAME'] ?? '')));
    if ($rawMake === '') {
        return null;
    }

    $make = strtoupper($rawMake) === 'MERCEDES BENZ' ? 'Mercedes-Benz' : substr(toTitleCase($rawMake), 0, 40);
    $model = substr(toTitleCase($rawModel !== '' ? $rawModel : 'Export Model'), 0, 60);
    $fullName = trim($rawMake . ' ' . $rawModel);
    $trim = substr(trim(strip_tags((string)($row['GRADE'] ?? ''))), 0, 60);

    $year = (int)($row['YEAR'] ?? 2020);
    if ($year < 1985 || $year > 2027) {
        $year = 2020;
    }

    $engineCc = (int)($row['ENG_V'] ?? 2000);
    if ($engineCc < 500 || $engineCc > 10000) {
        $engineCc = 2000;
    }

    $mileageKm = (int)preg_replace('/[^0-9]/', '', (string)($row['MILEAGE'] ?? '0'));
    if ($mileageKm < 0 || $mileageKm > 999999) {
        $mileageKm = 0;
    }

    $lotNumber = substr(trim(strip_tags((string)($row['LOT'] ?? '0000'))), 0, 30) ?: '0000';
    $chassisRaw = strtoupper(preg_replace('/[^A-Z0-9-]/i', '', (string)($row['KUZOV'] ?? '')) ?? '');
    $chassisCode = substr(strlen($chassisRaw) >= 3 ? $chassisRaw : 'JP-' . preg_replace('/[^A-Z0-9]/i', '', $lotNumber), 0, 40);
    $stockCode = substr('AUC-' . strtoupper(preg_replace('/[^A-Z0-9]/i', '', $lotNumber) ?: substr($lotId, 0, 6)), 0, 32);

    $auctionHouse = substr(trim(strip_tags((string)($row['AUCTION'] ?? 'Japanese Auto Auction'))), 0, 60) ?: 'Japanese Auto Auction';
    $auctionDateFull = trim(strip_tags((string)($row['AUCTION_DATE'] ?? '')));
    $auctionDateRaw = substr($auctionDateFull, 0, 10);
    $auctionTimeRaw = strlen($auctionDateFull) >= 16 ? substr($auctionDateFull, 11, 5) : substr(trim(strip_tags((string)($row['TIME'] ?? ''))), 0, 12);
    $auctionStatus = substr(trim(strip_tags((string)($row['STATUS'] ?? ''))), 0, 30);

    $startJpy = (int)($row['START'] ?? 0);
    $finishJpy = (int)($row['FINISH'] ?? 0);
    $avgJpy = (int)($row['AVG_PRICE'] ?? 0);

    $priceBasis = 'estimated';
    $chosenJpy = 0;
    if ($table === 'stats' && $finishJpy > 0) {
        $chosenJpy = $finishJpy;
        $priceBasis = 'finish';
    } elseif ($avgJpy > 0) {
        $chosenJpy = $avgJpy;
        $priceBasis = 'average';
    } elseif ($startJpy > 0) {
        $chosenJpy = $startJpy;
        $priceBasis = 'start';
    } elseif ($finishJpy > 0) {
        $chosenJpy = $finishJpy;
        $priceBasis = 'finish';
    }

    $safeRate = ($jpyRate >= 50 && $jpyRate <= 500) ? $jpyRate : 154.0;
    if ($chosenJpy > 0) {
        $fobPriceUsd = (int)round($chosenJpy / $safeRate + 850);
    } else {
        $fobPriceUsd = (int)round(6500 + max(0, $year - 2012) * 900 + ($engineCc > 2400 ? 4500 : 0));
    }
    $fobPriceUsd = max(500, min(500000, $fobPriceUsd));

    $bodyType = inferBodyType($fullName, $trim);
    $volumeM3 = estimateVolumeM3($bodyType, $fullName);
    $fuelType = inferFuelType($fullName, $trim, $engineCc);
    $transmission = normalizeTransmission((string)($row['KPP'] ?? ''));
    $drivetrain = normalizeDrivetrain((string)($row['PRIV'] ?? ''));
    $steering = ((string)($row['LHDRIVE'] ?? '0')) === '1' ? 'LHD' : 'RHD';
    $exteriorColor = substr(toTitleCase((string)($row['COLOR'] ?? 'Metallic')) ?: 'Metallic', 0, 40);
    $exteriorGrade = normalizeGrade((string)($row['RATE'] ?? ''));
    $originPort = normalizeOriginPort($auctionHouse);

    $infoRaw = substr(trim(strip_tags((string)($row['INFO'] ?? ''))), 0, 320);
    $interiorGrade = in_array($exteriorGrade, ['6', '5', 'S'], true) ? 'A' : 'B';
    if (preg_match('/Rate\s+int\s*:\s*([A-E])/i', $infoRaw, $m)) {
        $interiorGrade = strtoupper($m[1]);
    }

    $imgs = parseAjesImages((string)($row['IMAGES'] ?? ''), $isDetailById);
    $mediumImages = count($imgs['medium']) > 0 ? $imgs['medium'] : ['/src/assets/images/car_landcruiser_prado_1795453395370.jpg'];

    $equipRaw = trim(strip_tags((string)($row['EQUIP'] ?? '')));
    $powerHp = trim(strip_tags((string)($row['PW'] ?? '')));
    $features = ["Auction Feed: {$auctionHouse} (Lot #{$lotNumber})"];
    if ((int)$powerHp > 0) {
        $features[] = 'Engine Output: ' . (int)$powerHp . ' HP';
    }
    if ($equipRaw !== '') {
        $features[] = 'Equipment Codes: ' . $equipRaw;
    }

    $linkPrefix = $table === 'stats' ? 'st' : 'aj';
    $sourceUrl = AUC_BASE_ORIGIN . "/{$linkPrefix}-{$lotId}.htm";

    return [
        'id' => "auc-{$lotId}",
        'stockCode' => $stockCode,
        'listingType' => 'auction_listing',
        'auctionDate' => substr(trim($auctionDateRaw . ' · ' . $auctionHouse, ' ·'), 0, 36),
        'make' => $make,
        'model' => $model,
        'trim' => $trim !== '' ? $trim : "{$engineCc}cc {$transmission}",
        'year' => $year,
        'chassisCode' => $chassisCode,
        'mileageKm' => $mileageKm,
        'engineCc' => $engineCc,
        'fuelType' => $fuelType,
        'transmission' => $transmission,
        'drivetrain' => $drivetrain,
        'steering' => $steering,
        'exteriorColor' => $exteriorColor,
        'bodyType' => $bodyType,
        'originPort' => $originPort,
        'volumeM3' => $volumeM3,
        'fobPriceUsd' => $fobPriceUsd,
        'status' => strtolower($auctionStatus) === 'sold' ? 'sold' : 'available',
        'featured' => in_array($exteriorGrade, ['6', '5', '4.5', 'S'], true),
        'images' => $mediumImages,
        'features' => $features,
        'auctionReport' => [
            'exteriorGrade' => $exteriorGrade,
            'interiorGrade' => $interiorGrade,
            'auctionHouse' => $auctionHouse,
            'lotNumber' => $lotNumber,
            'inspectionDate' => $auctionDateRaw !== '' ? $auctionDateRaw : gmdate('Y-m-d'),
            'inspectorNotes' => ($infoRaw !== '' ? $infoRaw . '. ' : '') . "Official AJES feed lot ({$auctionHouse}, Lot #{$lotNumber}).",
            'mechanicalStatus' => [
                'engine' => $infoRaw !== '' ? "Inspector remark: {$infoRaw}" : 'Pending AUZIO pre-bid translation & yard check',
                'transmission' => "{$transmission} — auction house spec",
                'suspension' => 'Subject to official Japanese auction sheet',
                'airConditioning' => stripos($equipRaw, 'AC') !== false ? 'Factory A/C listed' : 'Verify on inspection sheet',
                'frame' => in_array($exteriorGrade, ['R', 'RA'], true) ? 'Grade R/RA — repair history noted' : 'Clean auction grade reported',
            ],
            'panelMarks' => new stdClass(),
        ],
        'auctionSourceMeta' => [
            'provider' => 'ajes_api',
            'table' => $table,
            'externalLotId' => $lotId,
            'lotNumber' => $lotNumber,
            'auctionHouse' => $auctionHouse,
            'auctionDate' => $auctionDateRaw,
            'auctionTime' => $auctionTimeRaw,
            'auctionStatus' => $auctionStatus,
            'rawStartPriceJpy' => $startJpy,
            'rawAvgPriceJpy' => $avgJpy,
            'rawFinishPriceJpy' => $finishJpy,
            'priceBasis' => $priceBasis,
            'powerHp' => $powerHp,
            'equipmentRaw' => $equipRaw,
            'inspectorRawInfo' => $infoRaw !== '' ? $infoRaw : null,
            'auctionSheetUrl' => $imgs['sheet'],
            'fullImageUrls' => count($imgs['full']) > 0 ? $imgs['full'] : null,
            'thumbnailUrls' => count($imgs['thumbs']) > 0 ? $imgs['thumbs'] : null,
            'sourceUrl' => $sourceUrl,
        ],
    ];
}

function getOrFetchMeta(string $code, string $ip): array
{
    $cached = cacheGet('meta_v1', META_TTL_SEC);
    if ($cached !== null) {
        $cached['cached'] = true;
        return $cached;
    }

    $countRows = queryAjesSql('select count(*) from main', $code, $ip);
    $makeRows = queryAjesSql('select marka_id, marka_name, count(*) from main group by marka_id', $code, $ip);
    $modelRows = queryAjesSql('select marka_id, model_name, count(*) from main group by model_id limit 3000', $code, $ip);
    $auctionRows = queryAjesSql('select auction, count(*) from main group by auction', $code, $ip);

    $totalCount = (int)($countRows[0]['TAG0'] ?? 0);
    $makeIdToDisplay = [];
    $lotTotalsByMakeId = [];

    foreach ($makeRows as $r) {
        $id = trim((string)($r['MARKA_ID'] ?? ''));
        $rawName = trim((string)($r['MARKA_NAME'] ?? ''));
        $cnt = (int)($r['TAG2'] ?? 0);
        if ($id === '' || $rawName === '' || $cnt <= 0) {
            continue;
        }
        $display = strtoupper($rawName) === 'MERCEDES BENZ' ? 'Mercedes-Benz' : toTitleCase($rawName);
        $makeIdToDisplay[$id] = $display;
        $lotTotalsByMakeId[$id] = $cnt;
    }

    $modelsByMake = [];
    foreach ($modelRows as $r) {
        $makeId = trim((string)($r['MARKA_ID'] ?? ''));
        $modelName = trim((string)($r['MODEL_NAME'] ?? ''));
        $cnt = (int)($r['TAG2'] ?? 0);
        if ($makeId === '' || $modelName === '' || $cnt <= 0 || !isset($makeIdToDisplay[$makeId])) {
            continue;
        }
        $displayMake = $makeIdToDisplay[$makeId];
        $modelsByMake[$displayMake][] = ['makeId' => $makeId, 'name' => $modelName, 'count' => $cnt];
    }

    $makes = [];
    $sumLots = 0;
    foreach ($makeIdToDisplay as $id => $display) {
        if (isset($modelsByMake[$display])) {
            usort($modelsByMake[$display], static fn(array $a, array $b): int => $b['count'] <=> $a['count']);
        }
        $totalLots = $lotTotalsByMakeId[$id] ?? 0;
        $sumLots += $totalLots;
        $makes[] = [
            'id' => $id,
            'name' => $display,
            'modelCount' => count($modelsByMake[$display] ?? []),
            'totalLots' => $totalLots,
        ];
    }
    usort($makes, static fn(array $a, array $b): int => $b['totalLots'] <=> $a['totalLots']);

    $auctions = [];
    foreach ($auctionRows as $r) {
        $name = trim(strip_tags((string)($r['AUCTION'] ?? '')));
        $cnt = (int)($r['TAG1'] ?? 0);
        if ($name !== '' && $cnt > 0) {
            $auctions[] = ['name' => $name, 'count' => $cnt];
        }
    }
    usort($auctions, static fn(array $a, array $b): int => $b['count'] <=> $a['count']);

    $payload = [
        'ok' => true,
        'source' => 'AJES Official API (auziotraders.com)',
        'mode' => 'ajes_api',
        'makes' => $makes,
        'modelsByMake' => $modelsByMake,
        'auctions' => $auctions,
        'totalEstimatedLots' => $totalCount > 0 ? $totalCount : $sumLots,
        'syncedAt' => gmdate('c'),
        'cached' => false,
    ];
    cacheSet('meta_v1', $payload);
    return $payload;
}

$route = isset($_GET['route']) && is_string($_GET['route']) ? trim($_GET['route']) : 'status';
$code = loadAjesApiCode();
$ip = getClientIp();

if ($code === '') {
    http_response_code(503);
    echo json_encode([
        'ok' => false,
        'source' => 'AJES Official API',
        'mode' => 'unavailable',
        'reachable' => false,
        'ajesApiConfigured' => false,
        'makesCount' => 0,
        'totalEstimatedLots' => 0,
        'checkedAt' => gmdate('c'),
        'message' => 'AJES_API_CODE is not configured in auzio-secrets.php above public_html.',
    ]);
    exit;
}

try {
    if ($route === 'status') {
        header('Cache-Control: no-store');
        $meta = getOrFetchMeta($code, $ip);
        echo json_encode([
            'ok' => true,
            'source' => $meta['source'],
            'mode' => 'ajes_api',
            'reachable' => true,
            'ajesApiConfigured' => true,
            'makesCount' => count($meta['makes']),
            'totalEstimatedLots' => $meta['totalEstimatedLots'],
            'checkedAt' => gmdate('c'),
            'message' => sprintf(
                'Connected via Official AJES SQL/JSON API (%s active lots across %d makes & %d auction houses).',
                number_format((int)$meta['totalEstimatedLots']),
                count($meta['makes']),
                count($meta['auctions'])
            ),
        ]);
        exit;
    }

    if ($route === 'meta') {
        header('Cache-Control: public, max-age=300');
        echo json_encode(getOrFetchMeta($code, $ip));
        exit;
    }

    if ($route === 'search') {
        header('Cache-Control: no-store');
        $table = (isset($_GET['table']) && $_GET['table'] === 'stats') ? 'stats' : 'main';
        $page = max(1, min(100, (int)($_GET['page'] ?? 1)));
        $pageSize = 20;
        $jpyRate = isset($_GET['jpyRate']) && is_numeric($_GET['jpyRate']) ? (float)$_GET['jpyRate'] : 154.0;

        $makeClean = sanitizeAlphaNum((string)($_GET['make'] ?? ''), 40);
        $modelClean = sanitizeAlphaNum((string)($_GET['model'] ?? ''), 60);
        $auctionClean = sanitizeAlphaNum((string)($_GET['auction'] ?? ''), 60);
        $lotClean = sanitizeCode((string)($_GET['lot'] ?? ''), 20);
        $chassisClean = strtoupper(sanitizeCode((string)($_GET['chassis'] ?? ''), 24));
        $gradeRaw = strtoupper(trim((string)($_GET['grade'] ?? '')));
        $allowedGrades = ['S', '6', '5', '4.5', '4', '3.5', '3', 'R', 'RA'];
        $gradeClean = in_array($gradeRaw, $allowedGrades, true) ? $gradeRaw : '';
        $steering = strtoupper(trim((string)($_GET['steering'] ?? '')));
        $yearMin = isset($_GET['yearMin']) && is_numeric($_GET['yearMin']) ? (int)$_GET['yearMin'] : 0;
        $yearMax = isset($_GET['yearMax']) && is_numeric($_GET['yearMax']) ? (int)$_GET['yearMax'] : 0;

        $conditions = [];
        if ($makeClean !== '' && strtoupper($makeClean) !== 'ALL') {
            $sqlMake = strtoupper($makeClean) === 'MERCEDES-BENZ' ? 'MERCEDES BENZ' : strtoupper($makeClean);
            $conditions[] = "marka_name='{$sqlMake}'";
        } elseif ($lotClean === '' && $chassisClean === '' && $auctionClean === '') {
            $conditions[] = "marka_name='TOYOTA'";
        }
        if ($modelClean !== '' && strtoupper($modelClean) !== 'ALL' && strtolower($modelClean) !== 'any') {
            $cleanedModel = strtoupper(trim(preg_replace('/\s*\(\d+\)\s*$/', '', $modelClean) ?? ''));
            if ($cleanedModel !== '') {
                $conditions[] = "model_name='{$cleanedModel}'";
            }
        }
        if ($auctionClean !== '' && strtoupper($auctionClean) !== 'ALL') {
            $conditions[] = "auction='{$auctionClean}'";
        }
        if ($lotClean !== '') {
            $conditions[] = "lot='{$lotClean}'";
        }
        if ($chassisClean !== '') {
            $conditions[] = "kuzov like '{$chassisClean}%'";
        }
        if ($yearMin >= 1985 && $yearMin <= 2027) {
            $conditions[] = "year>={$yearMin}";
        }
        if ($yearMax >= 1985 && $yearMax <= 2027) {
            $conditions[] = "year<={$yearMax}";
        }
        if ($gradeClean === '4.5') {
            $conditions[] = "rate in ('4.5','5','6','S')";
        } elseif ($gradeClean !== '') {
            $conditions[] = "rate='{$gradeClean}'";
        }
        if ($steering === 'LHD') {
            $conditions[] = 'lhdrive=1';
        } elseif ($steering === 'RHD') {
            $conditions[] = 'lhdrive=0';
        }
        if ($table === 'stats') {
            $conditions[] = 'finish>0';
        }

        $whereClause = count($conditions) > 0 ? ' where ' . implode(' and ', $conditions) : '';
        $orderClause = $table === 'stats' ? ' order by auction_date desc' : ' order by year desc, lot asc';
        $offset = ($page - 1) * $pageSize;

        $countRows = queryAjesSql("select count(*) from {$table}{$whereClause}", $code, $ip);
        $dataRows = queryAjesSql("select * from {$table}{$whereClause}{$orderClause} limit {$offset},{$pageSize}", $code, $ip);

        $totalMatches = (int)($countRows[0]['TAG0'] ?? count($dataRows));
        $items = [];
        foreach ($dataRows as $r) {
            $v = normalizeRowToVehicle($r, $table, $jpyRate, false);
            if ($v !== null) {
                $items[] = $v;
            }
        }

        echo json_encode([
            'ok' => true,
            'source' => 'AJES Official API (auziotraders.com)',
            'mode' => 'ajes_api',
            'table' => $table,
            'totalMatches' => $totalMatches,
            'page' => $page,
            'pageSize' => $pageSize,
            'totalPages' => max(1, (int)ceil($totalMatches / $pageSize)),
            'items' => $items,
            'syncedAt' => gmdate('c'),
            'cached' => false,
        ]);
        exit;
    }

    if ($route === 'lot') {
        header('Cache-Control: public, max-age=180');
        $rawId = isset($_GET['id']) && is_string($_GET['id']) ? trim($_GET['id']) : '';
        $lotId = preg_replace('/^auc-/', '', $rawId) ?? '';
        $table = (isset($_GET['table']) && $_GET['table'] === 'stats') ? 'stats' : 'main';
        $jpyRate = isset($_GET['jpyRate']) && is_numeric($_GET['jpyRate']) ? (float)$_GET['jpyRate'] : 154.0;

        if (!preg_match('/^[a-zA-Z0-9_-]{4,48}$/', $lotId)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'lotId' => '', 'images' => [], 'fullImages' => [], 'thumbnails' => [], 'sourceUrl' => AUC_BASE_ORIGIN, 'message' => 'Invalid lot ID.']);
            exit;
        }

        $cacheKey = "lot_{$table}_{$lotId}";
        $cached = cacheGet($cacheKey, LOT_TTL_SEC);
        if ($cached !== null) {
            $cached['cached'] = true;
            echo json_encode($cached);
            exit;
        }

        $activeTable = $table;
        $rows = queryAjesSql("select * from {$activeTable} where id='{$lotId}'", $code, $ip);
        if (count($rows) === 0) {
            $altTable = $activeTable === 'main' ? 'stats' : 'main';
            $altRows = queryAjesSql("select * from {$altTable} where id='{$lotId}'", $code, $ip);
            if (count($altRows) > 0) {
                $rows = $altRows;
                $activeTable = $altTable;
            }
        }

        if (count($rows) === 0) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'lotId' => $lotId, 'table' => $table, 'images' => [], 'fullImages' => [], 'thumbnails' => [], 'sourceUrl' => AUC_BASE_ORIGIN, 'message' => 'Lot not found.']);
            exit;
        }

        $vehicle = normalizeRowToVehicle($rows[0], $activeTable, $jpyRate, true);
        if ($vehicle === null) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'lotId' => $lotId, 'images' => [], 'fullImages' => [], 'thumbnails' => [], 'sourceUrl' => AUC_BASE_ORIGIN, 'message' => 'Unable to parse lot.']);
            exit;
        }

        $payload = [
            'ok' => true,
            'lotId' => $lotId,
            'table' => $activeTable,
            'mode' => 'ajes_api',
            'images' => $vehicle['images'],
            'fullImages' => $vehicle['auctionSourceMeta']['fullImageUrls'] ?? $vehicle['images'],
            'thumbnails' => $vehicle['auctionSourceMeta']['thumbnailUrls'] ?? $vehicle['images'],
            'auctionSheetUrl' => $vehicle['auctionSourceMeta']['auctionSheetUrl'] ?? null,
            'vehicle' => $vehicle,
            'sourceUrl' => $vehicle['auctionSourceMeta']['sourceUrl'],
            'cached' => false,
        ];
        cacheSet($cacheKey, $payload);
        echo json_encode($payload);
        exit;
    }

    http_response_code(404);
    echo json_encode(['ok' => false, 'message' => 'Unknown auction API route.']);
} catch (Throwable $e) {
    http_response_code(502);
    echo json_encode([
        'ok' => false,
        'source' => 'AJES Official API',
        'mode' => 'unavailable',
        'reachable' => false,
        'ajesApiConfigured' => true,
        'message' => 'AJES API error: ' . $e->getMessage(),
    ]);
}
