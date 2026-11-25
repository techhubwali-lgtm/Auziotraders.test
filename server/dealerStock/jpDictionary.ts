import type { DealerBodyCategory } from '../../src/types/portal';

// =============================================================================
// Japanese-to-English Automotive Terminology Translation Dictionary
// Used strictly server-side to normalize extracted Japanese dealer listings.
// =============================================================================

export const JP_MAKE_MAP: Array<[RegExp, string]> = [
  [/トヨタ|TOYOTA/i, 'Toyota'],
  [/レクサス|LEXUS/i, 'Lexus'],
  [/日産|ニッサン|NISSAN/i, 'Nissan'],
  [/ホンダ|本田|HONDA/i, 'Honda'],
  [/マツダ|MAZDA/i, 'Mazda'],
  [/スバル|SUBARU/i, 'Subaru'],
  [/スズキ|SUZUKI/i, 'Suzuki'],
  [/ダイハツ|DAIHATSU/i, 'Daihatsu'],
  [/三菱ふそう|FUSO/i, 'Mitsubishi Fuso'],
  [/三菱|ミツビシ|MITSUBISHI/i, 'Mitsubishi'],
  [/いすゞ|イスズ|ISUZU/i, 'Isuzu'],
  [/日野|ヒノ|HINO/i, 'Hino'],
  [/ＵＤトラックス|UDトラックス/i, 'UD Trucks'],
  [/メルセデス・ベンツ|ベンツ|MERCEDES/i, 'Mercedes-Benz'],
  [/ＢＭＷ|BMW/i, 'BMW'],
  [/アウディ|AUDI/i, 'Audi'],
  [/フォルクスワーゲン|VW|VOLKSWAGEN/i, 'Volkswagen'],
  [/ポルシェ|PORSCHE/i, 'Porsche'],
  [/ジープ|JEEP/i, 'Jeep'],
  [/ランドローバー|LAND ROVER/i, 'Land Rover'],
  [/ボルボ|VOLVO/i, 'Volvo'],
  [/ミニ|MINI/i, 'MINI'],
  [/プジョー|PEUGEOT/i, 'Peugeot'],
  [/フィアット|FIAT/i, 'Fiat'],
  [/ルノー|RENAULT/i, 'Renault'],
  [/フォード|FORD/i, 'Ford'],
  [/シボレー|CHEVROLET/i, 'Chevrolet'],
  [/テスラ|TESLA/i, 'Tesla'],
];

export const JP_MODEL_MAP: Array<[RegExp, string]> = [
  [/ランドクルーザープラド/i, 'Land Cruiser Prado'],
  [/ランドクルーザー\s*250|ランクル\s*250/i, 'Land Cruiser 250'],
  [/ランドクルーザー\s*300|ランクル\s*300/i, 'Land Cruiser 300'],
  [/ランドクルーザー\s*70|ランクル\s*70/i, 'Land Cruiser 70'],
  [/ランドクルーザー|ランクル/i, 'Land Cruiser'],
  [/ハイエースバン/i, 'HiAce Van'],
  [/ハイエースワゴン/i, 'HiAce Wagon'],
  [/ハイエースコミューター/i, 'HiAce Commuter'],
  [/ハイエース/i, 'HiAce'],
  [/レジアスエースバン|レジアスエース/i, 'RegiusAce'],
  [/ハイラックスサーフ/i, 'Hilux Surf'],
  [/ハイラックス/i, 'Hilux'],
  [/FJクルーザー/i, 'FJ Cruiser'],
  [/ハリアー/i, 'Harrier'],
  [/RAV4|ラブ4/i, 'RAV4'],
  [/アルファード/i, 'Alphard'],
  [/ヴェルファイア/i, 'Vellfire'],
  [/ノア/i, 'Noah'],
  [/ヴォクシー/i, 'Voxy'],
  [/エスクァイア/i, 'Esquire'],
  [/シエンタ/i, 'Sienta'],
  [/プリウスα/i, 'Prius Alpha'],
  [/プリウスPHV/i, 'Prius PHV'],
  [/プリウス/i, 'Prius'],
  [/アクア/i, 'Aqua'],
  [/ヤリスクロス/i, 'Yaris Cross'],
  [/ヤリス/i, 'Yaris'],
  [/カローラクロス/i, 'Corolla Cross'],
  [/カローラツーリング/i, 'Corolla Touring'],
  [/カローラフィールダー/i, 'Corolla Fielder'],
  [/カローラスポーツ/i, 'Corolla Sport'],
  [/カローラ/i, 'Corolla'],
  [/クラウン/i, 'Crown'],
  [/カムリ/i, 'Camry'],
  [/マークX/i, 'Mark X'],
  [/C-HR/i, 'C-HR'],
  [/ライズ/i, 'Raize'],
  [/ルーミー/i, 'Roomy'],
  [/タンク/i, 'Tank'],
  [/ヴィッツ/i, 'Vitz'],
  [/パッソ/i, 'Passo'],
  [/プロボックスバン|プロボックス/i, 'Probox'],
  [/サクシード/i, 'Succeed'],
  [/タウンエースバン|タウンエース/i, 'TownAce'],
  [/ライトエース/i, 'LiteAce'],
  [/ダイナ/i, 'Dyna'],
  [/コースター/i, 'Coaster'],
  [/トヨエース/i, 'ToyoAce'],
  [/86|GR86/i, 'GR86 / 86'],
  [/スープラ/i, 'Supra'],
  [/エクストレイル/i, 'X-Trail'],
  [/セレナ/i, 'Serena'],
  [/ノート/i, 'Note'],
  [/デイズルークス/i, 'Dayz Roox'],
  [/ルークス/i, 'Roox'],
  [/デイズ/i, 'Dayz'],
  [/キャラバン|NV350キャラバン/i, 'NV350 Caravan'],
  [/NV200バネット/i, 'NV200 Vanette'],
  [/エルグランド/i, 'Elgrand'],
  [/スカイライン/i, 'Skyline'],
  [/フェアレディZ/i, 'Fairlady Z'],
  [/GT-R/i, 'GT-R'],
  [/キックス/i, 'Kicks'],
  [/ジューク/i, 'Juke'],
  [/マーチ/i, 'March'],
  [/キューブ/i, 'Cube'],
  [/リーフ/i, 'Leaf'],
  [/サクラ/i, 'Sakura'],
  [/アトラス/i, 'Atlas'],
  [/N-BOX/i, 'N-BOX'],
  [/N-WGN/i, 'N-WGN'],
  [/N-VAN/i, 'N-VAN'],
  [/N-ONE/i, 'N-ONE'],
  [/ヴェゼル/i, 'Vezel'],
  [/フィット/i, 'Fit'],
  [/フリード/i, 'Freed'],
  [/ステップワゴン/i, 'StepWGN'],
  [/オデッセイ/i, 'Odyssey'],
  [/シビック/i, 'Civic'],
  [/アコード/i, 'Accord'],
  [/CR-V/i, 'CR-V'],
  [/WR-V/i, 'WR-V'],
  [/ZR-V/i, 'ZR-V'],
  [/アクティトラック|アクティ/i, 'Acty'],
  [/ジムニーシエラ/i, 'Jimny Sierra'],
  [/ジムニー/i, 'Jimny'],
  [/ハスラー/i, 'Hustler'],
  [/スペーシア/i, 'Spacia'],
  [/ワゴンR/i, 'Wagon R'],
  [/アルト/i, 'Alto'],
  [/ラパン/i, 'Lapin'],
  [/スイフト/i, 'Swift'],
  [/ソリオ/i, 'Solio'],
  [/クロスビー/i, 'XBEE'],
  [/エブリイワゴン/i, 'Every Wagon'],
  [/エブリイ/i, 'Every'],
  [/キャリイトラック|キャリイ/i, 'Carry'],
  [/タント/i, 'Tanto'],
  [/ムーヴキャンバス/i, 'Move Canbus'],
  [/ムーヴ/i, 'Move'],
  [/ミラトコット|ミライース|ミラ/i, 'Mira'],
  [/タフト/i, 'Taft'],
  [/ロッキー/i, 'Rocky'],
  [/ウェイク/i, 'Wake'],
  [/ハイゼットカーゴ/i, 'Hijet Cargo'],
  [/ハイゼットトラック|ハイゼット/i, 'Hijet'],
  [/アトレー/i, 'Atrai'],
  [/CX-5/i, 'CX-5'],
  [/CX-8/i, 'CX-8'],
  [/CX-30/i, 'CX-30'],
  [/CX-60/i, 'CX-60'],
  [/CX-3/i, 'CX-3'],
  [/デミオ|MAZDA2/i, 'Demio / Mazda2'],
  [/アクセラ|MAZDA3/i, 'Axela / Mazda3'],
  [/アテンザ|MAZDA6/i, 'Atenza / Mazda6'],
  [/ロードスター/i, 'Roadster (MX-5)'],
  [/ボンゴ/i, 'Bongo'],
  [/タイタン/i, 'Titan'],
  [/フォレスター/i, 'Forester'],
  [/レヴォーグ/i, 'Levorg'],
  [/インプレッサ/i, 'Impreza'],
  [/XV|クロストレック/i, 'XV / Crosstrek'],
  [/レガシィアウトバック|アウトバック/i, 'Outback'],
  [/レガシィ/i, 'Legacy'],
  [/WRX/i, 'WRX'],
  [/BRZ/i, 'BRZ'],
  [/サンバー/i, 'Sambar'],
  [/デリカD:5|デリカD5/i, 'Delica D:5'],
  [/デリカミニ/i, 'Delica Mini'],
  [/アウトランダー/i, 'Outlander'],
  [/エクリプスクロス/i, 'Eclipse Cross'],
  [/パジェロ/i, 'Pajero'],
  [/トライトン/i, 'Triton'],
  [/eKワゴン|eKスペース|eKクロス/i, 'eK Series'],
  [/ミニキャブ/i, 'Minicab'],
  [/キャンター/i, 'Canter'],
  [/エルフ/i, 'Elf'],
  [/デュトロ/i, 'Dutro'],
  [/レンジャー/i, 'Ranger'],
  [/プロフィア/i, 'Profia'],
  [/フォワード/i, 'Forward'],
  [/ギガ/i, 'Giga'],
  [/スーパーグレート/i, 'Super Great'],
  [/ファイター/i, 'Fighter'],
  [/ラングラー/i, 'Wrangler'],
  [/ディフェンダー/i, 'Defender'],
  [/RX|LX|NX|UX|ES|IS|LS|LC|RC|CT/i, '$&'],
];

export const JP_PREFECTURE_MAP: Array<[string, string]> = [
  ['北海道', 'Hokkaido'],
  ['青森県', 'Aomori'],
  ['岩手県', 'Iwate'],
  ['宮城県', 'Miyagi'],
  ['秋田県', 'Akita'],
  ['山形県', 'Yamagata'],
  ['福島県', 'Fukushima'],
  ['茨城県', 'Ibaraki'],
  ['栃木県', 'Tochigi'],
  ['群馬県', 'Gunma'],
  ['埼玉県', 'Saitama'],
  ['千葉県', 'Chiba'],
  ['東京都', 'Tokyo'],
  ['神奈川県', 'Kanagawa'],
  ['新潟県', 'Niigata'],
  ['富山県', 'Toyama'],
  ['石川県', 'Ishikawa'],
  ['福井県', 'Fukui'],
  ['山梨県', 'Yamanashi'],
  ['長野県', 'Nagano'],
  ['岐阜県', 'Gifu'],
  ['静岡県', 'Shizuoka'],
  ['愛知県', 'Aichi'],
  ['三重県', 'Mie'],
  ['滋賀県', 'Shiga'],
  ['京都府', 'Kyoto'],
  ['大阪府', 'Osaka'],
  ['兵庫県', 'Hyogo'],
  ['奈良県', 'Nara'],
  ['和歌山県', 'Wakayama'],
  ['鳥取県', 'Tottori'],
  ['島根県', 'Shimane'],
  ['岡山県', 'Okayama'],
  ['広島県', 'Hiroshima'],
  ['山口県', 'Yamaguchi'],
  ['徳島県', 'Tokushima'],
  ['香川県', 'Kagawa'],
  ['愛媛県', 'Ehime'],
  ['高知県', 'Kochi'],
  ['福岡県', 'Fukuoka'],
  ['佐賀県', 'Saga'],
  ['長崎県', 'Nagasaki'],
  ['熊本県', 'Kumamoto'],
  ['大分県', 'Oita'],
  ['宮崎県', 'Miyazaki'],
  ['鹿児島県', 'Kagoshima'],
  ['沖縄県', 'Okinawa'],
];

export const JP_COLOR_MAP: Array<[RegExp, string]> = [
  [/パールホワイト|ホワイトパール|プラチナホワイト/i, 'Pearl White'],
  [/白|ホワイト|WHITE/i, 'White'],
  [/黒|ブラック|BLACK/i, 'Black'],
  [/シルバー|銀|SILVER/i, 'Silver'],
  [/ガンメタ|グレー|灰|GRAY|GREY/i, 'Gray'],
  [/青|ブルー|紺|ネイビー|BLUE|NAVY/i, 'Blue'],
  [/赤|レッド|ワイン|マルーン|RED/i, 'Red'],
  [/緑|グリーン|カーキ|オリーブ|GREEN/i, 'Green'],
  [/茶|ブラウン|ブロンズ|BROWN/i, 'Brown'],
  [/ベージュ|シャンパン|ゴールド|金|BEIGE|GOLD/i, 'Beige / Gold'],
  [/黄|イエロー|YELLOW/i, 'Yellow'],
  [/橙|オレンジ|ORANGE/i, 'Orange'],
  [/紫|パープル|PURPLE/i, 'Purple'],
  [/ピンク|PINK/i, 'Pink'],
];

export const JP_FEATURE_MAP: Array<[RegExp, string]> = [
  [/エアコン|クーラー/i, 'Air Conditioning'],
  [/パワステ/i, 'Power Steering'],
  [/パワーウィンドウ/i, 'Power Windows'],
  [/ナビ|カーナビ|BIG-X|ディスプレイオーディオ/i, 'Navigation / Infotainment'],
  [/バックカメラ|アラウンドビュー|全周囲カメラ/i, 'Backup / 360 Camera'],
  [/ETC/i, 'ETC Toll Reader'],
  [/ABS/i, 'ABS Brakes'],
  [/エアバッグ/i, 'Airbags'],
  [/スマートキー|キーレス/i, 'Smart Key / Keyless'],
  [/プッシュスタート/i, 'Push Start'],
  [/クルーズコントロール|レーダークルーズ/i, 'Cruise Control'],
  [/衝突被害軽減|自動ブレーキ|セーフティセンス|アイサイト/i, 'Collision Avoidance Safety'],
  [/LEDヘッド|LEDライト/i, 'LED Headlights'],
  [/サンルーフ|ムーンルーフ/i, 'Sunroof / Moonroof'],
  [/本革|レザーシート/i, 'Leather Seats'],
  [/シートヒーター/i, 'Heated Seats'],
  [/両側パワースライド|パワースライドドア/i, 'Power Sliding Door'],
  [/アルミホイール|社外AW/i, 'Alloy Wheels'],
  [/ドライブレコーダー|ドラレコ/i, 'Dashcam Recorder'],
  [/ベッドキット/i, 'Camper Bed Kit'],
  [/リフトアップ/i, 'Lift-Up Suspension'],
  [/Bluetooth|ブルートゥース/i, 'Bluetooth Audio'],
  [/保証付/i, 'Dealer Warranty Included'],
  [/禁煙車/i, 'Non-Smoking Vehicle'],
  [/ワンオーナー/i, 'One Owner'],
];

export function translateMake(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  for (const [pattern, en] of JP_MAKE_MAP) {
    if (pattern.test(cleaned)) return en;
  }
  return cleaned.length > 0 && /^[A-Za-z0-9\s\-&]+$/.test(cleaned) ? cleaned : null;
}

export function translateModel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  for (const [pattern, en] of JP_MODEL_MAP) {
    if (pattern.test(cleaned)) {
      if (en === '$&') {
        const match = cleaned.match(pattern);
        return match ? match[0] : cleaned;
      }
      return en;
    }
  }
  // If ASCII model name is already present, return cleanly
  const ascii = cleaned.match(/[A-Za-z0-9][A-Za-z0-9\s\-\.\+:\/]{1,36}/);
  return ascii ? ascii[0].trim() : cleaned.slice(0, 48);
}

export function translateFuel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/プラグイン|PHEV|PHV/i.test(s)) return 'Plug-in Hybrid';
  if (/ハイブリッド|HV|HYBRID|e-POWER/i.test(s)) return 'Hybrid';
  if (/ディーゼル|軽油|DIESEL/i.test(s)) return 'Diesel';
  if (/電気|EV|ELECTRIC/i.test(s)) return 'Electric';
  if (/LPG/i.test(s)) return 'LPG';
  if (/ガソリン|無鉛|PETROL|GASOLINE/i.test(s)) return 'Petrol';
  return null;
}

export function translateTransmission(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/CVT/i.test(s)) return 'CVT';
  if (/(^|\s|[^A-Z])MT|マニュアル|\dMT/i.test(s) && !/MTモード付AT/i.test(s)) return 'Manual';
  if (/AT|オートマ|DCT|インパネ|フロア|コラム/i.test(s)) return 'Automatic';
  return null;
}

export function translateDriveType(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/4WD|４WD|AWD|四輪駆動/i.test(s)) return '4WD';
  if (/2WD|２WD|FF|FR|MR|RR|二輪駆動/i.test(s)) return '2WD';
  return null;
}

export function translateColor(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  for (const [pattern, en] of JP_COLOR_MAP) {
    if (pattern.test(s)) return en;
  }
  return /^[A-Za-z\s\/]+$/.test(s) ? s : null;
}

export function translateRepairHistory(
  raw: string | null | undefined
): 'No Repair History' | 'Repair History Present' | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/なし|無し|無|No/i.test(s)) return 'No Repair History';
  if (/あり|有り|有|Yes/i.test(s)) return 'Repair History Present';
  return null;
}

export function translatePrefecture(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  for (const [jp, en] of JP_PREFECTURE_MAP) {
    const shortJp = jp.replace(/[県府都]$/, '');
    if (s.includes(jp) || s.includes(shortJp)) {
      return `${en}, Japan`;
    }
  }
  return null;
}

export function inferBodyCategory(
  rawBody: string | null | undefined,
  titleOrModel: string | null | undefined,
  engineCc: number | null
): DealerBodyCategory | null {
  const combined = `${rawBody || ''} ${titleOrModel || ''}`.trim();
  if (!combined) return null;

  if (/バス|コースター|マイクロバス|BUS/i.test(combined)) return 'Bus';
  if (/ピックアップ|ハイラックス|トライトン|PICKUP/i.test(combined)) return 'Pickup';
  if (/トラック|ダイナ|エルフ|キャンター|デュトロ|アトラス|ダンプ|クレーン|平ボディ|箱車|TRUCK/i.test(combined)) {
    return 'Truck';
  }
  if (/オープン|カブリオレ|ロードスター|コンバーチブル|CONVERTIBLE/i.test(combined)) return 'Convertible';
  if (/クーペ|86|GR86|BRZ|スープラ|フェアレディZ|GT-R|COUPE/i.test(combined)) return 'Coupe';
  if (/軽自動車|軽|N-BOX|N-WGN|N-VAN|タント|ムーヴ|ワゴンR|ハスラー|スペーシア|アルト|タフト|デイズ|ルークス|ジムニー(?!シエラ)/i.test(combined)) {
    return 'Kei Car';
  }
  if (engineCc !== null && engineCc > 0 && engineCc <= 660) {
    return 'Kei Car';
  }
  if (/SUV|クロカン|ランドクルーザー|ランクル|プラド|ハリアー|RAV4|エクストレイル|フォレスター|ヴェゼル|CX-|パジェロ|ジープ|ラングラー|ディフェンダー|ジムニーシエラ|FJクルーザー/i.test(combined)) {
    return 'SUV';
  }
  if (/ハイエースバン|キャラバン|プロボックス|サクシード|タウンエース|ライトエース|NV200|商用バン|バン|VAN/i.test(combined)) {
    return 'Van';
  }
  if (/ミニバン|アルファード|ヴェルファイア|ノア|ヴォクシー|セレナ|ステップワゴン|エルグランド|デリカD|MINIVAN/i.test(combined)) {
    return 'Minivan';
  }
  if (/MPV|シエンタ|フリード|オデッセイ|エスクァイア/i.test(combined)) return 'MPV';
  if (/ステーションワゴン|ツーリングワゴン|レヴォーグ|フィールダー|ワゴン|WAGON/i.test(combined)) {
    return 'Wagon';
  }
  if (/ハッチバック|コンパクト|プリウス|アクア|ヤリス|フィット|ノート|スイフト|デミオ|ヴィッツ|ルーミー|HATCHBACK/i.test(combined)) {
    return 'Hatchback';
  }
  if (/セダン|クラウン|カムリ|スカイライン|アコード|カローラ|マークX|SEDAN/i.test(combined)) {
    return 'Sedan';
  }
  return null;
}

export function extractEnglishFeatures(rawText: string): string[] {
  const found = new Set<string>();
  for (const [pattern, label] of JP_FEATURE_MAP) {
    if (pattern.test(rawText)) {
      found.add(label);
    }
  }
  return Array.from(found);
}

export function parseJapaneseManYenToJpy(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, '').replace(/\s+/g, '');
  const manMatch = cleaned.match(/(\d+(?:\.\d+)?)万/);
  if (manMatch) {
    const val = parseFloat(manMatch[1]);
    if (Number.isFinite(val) && val > 0 && val < 100000) {
      return Math.round(val * 10000);
    }
  }
  const yenMatch = cleaned.match(/(\d{5,9})円/);
  if (yenMatch) {
    const val = parseInt(yenMatch[1], 10);
    if (Number.isFinite(val) && val >= 50000) return val;
  }
  return null;
}

export function parseJapaneseMileageToKm(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, '').replace(/\s+/g, '');
  const manKm = cleaned.match(/(\d+(?:\.\d+)?)万\s*km/i);
  if (manKm) {
    const val = parseFloat(manKm[1]);
    if (Number.isFinite(val) && val >= 0) return Math.round(val * 10000);
  }
  const plainKm = cleaned.match(/(\d{1,7})\s*km/i);
  if (plainKm) {
    const val = parseInt(plainKm[1], 10);
    if (Number.isFinite(val) && val >= 0) return val;
  }
  return null;
}

export function parseJapaneseYear(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/(19[89]\d|20[0-3]\d)/);
  if (match) {
    const y = parseInt(match[1], 10);
    if (y >= 1980 && y <= 2030) return y;
  }
  return null;
}

export function parseEngineCc(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, '');
  const m = cleaned.match(/(\d{3,5})\s*cc/i);
  if (m) {
    const cc = parseInt(m[1], 10);
    if (cc >= 300 && cc <= 18000) return cc;
  }
  return null;
}

export function translateShaken(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/^[-－—なし無]+$/.test(s)) return null;
  const reiwa = s.match(/R(\d{1,2})年(\d{1,2})月/i);
  if (reiwa) {
    const yr = 2018 + parseInt(reiwa[1], 10);
    const mo = reiwa[2].padStart(2, '0');
    return `${yr}-${mo}`;
  }
  const western = s.match(/(20\d{2})年(\d{1,2})月/);
  if (western) {
    return `${western[1]}-${western[2].padStart(2, '0')}`;
  }
  if (/車検整備付/.test(s)) return 'Shaken Inspection Included';
  return s.slice(0, 32);
}
