import { Anchor } from 'lucide-react';

interface CorridorNode {
  id: string;
  countryCode: string;
  portId: string;
  label: string;
  unLocode: string;
  transit: string;
  x: number;
  y: number;
}

const JAPAN_HUB = { x: 768, y: 158 };

const CORRIDOR_NODES: CorridorNode[] = [
  {
    id: 'mombasa',
    countryCode: 'KE',
    portId: 'mombasa-ke',
    label: 'Mombasa (East Africa)',
    unLocode: 'KEMBA',
    transit: '24–30d',
    x: 545,
    y: 256,
  },
  {
    id: 'dar',
    countryCode: 'TZ',
    portId: 'dar-es-salaam-tz',
    label: 'Dar es Salaam',
    unLocode: 'TZDAR',
    transit: '25–32d',
    x: 540,
    y: 274,
  },
  {
    id: 'durban',
    countryCode: 'ZA',
    portId: 'durban-za',
    label: 'Durban (Southern Africa)',
    unLocode: 'ZADUR',
    transit: '26–34d',
    x: 515,
    y: 334,
  },
  {
    id: 'jebel-ali',
    countryCode: 'AE',
    portId: 'jebel-ali-ae',
    label: 'Jebel Ali (UAE)',
    unLocode: 'AEJEA',
    transit: '18–24d',
    x: 575,
    y: 192,
  },
  {
    id: 'southampton',
    countryCode: 'GB',
    portId: 'southampton-uk',
    label: 'Southampton (UK)',
    unLocode: 'GBSOU',
    transit: '36–44d',
    x: 444,
    y: 112,
  },
  {
    id: 'sydney',
    countryCode: 'AU',
    portId: 'sydney-au',
    label: 'Sydney / Brisbane',
    unLocode: 'AUPKL',
    transit: '12–19d',
    x: 794,
    y: 344,
  },
  {
    id: 'auckland',
    countryCode: 'NZ',
    portId: 'auckland-nz',
    label: 'Auckland (NZ)',
    unLocode: 'NZAKL',
    transit: '14–18d',
    x: 848,
    y: 358,
  },
  {
    id: 'kingston',
    countryCode: 'JM',
    portId: 'kingston-jm',
    label: 'Kingston (Caribbean)',
    unLocode: 'JMKIN',
    transit: '30–38d',
    x: 250,
    y: 208,
  },
];

interface InteractiveWorldMapProps {
  selectedPortId: string;
  onSelectDestination: (countryCode: string, portId: string) => void;
}

export function InteractiveWorldMap({
  selectedPortId,
  onSelectDestination,
}: InteractiveWorldMapProps) {
  return (
    <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 sm:p-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
          <Anchor className="w-4 h-4 text-amber-400" />
          <span>Japan Export Hubs (Yokohama · Nagoya · Kobe · Osaka · Hakata)</span>
        </div>
        <div className="text-[11px] text-slate-400">
          Click any destination corridor to load tariffs &amp; transit schedule
        </div>
      </div>

      <div className="relative w-full aspect-[2.1/1] min-h-[240px]">
        <svg
          viewBox="0 0 920 430"
          className="w-full h-full"
          role="img"
          aria-label="Global maritime vehicle shipping routes from Japan to Africa, Oceania, Caribbean, Europe, and Middle East"
        >
          <defs>
            <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.85" />
            </linearGradient>
          </defs>

          {/* Subtle latitude / longitude maritime grid */}
          <g stroke="#1e293b" strokeWidth="0.7" opacity="0.7">
            <line x1="0" y1="108" x2="920" y2="108" />
            <line x1="0" y1="215" x2="920" y2="215" />
            <line x1="0" y1="322" x2="920" y2="322" />
            <line x1="230" y1="0" x2="230" y2="430" />
            <line x1="460" y1="0" x2="460" y2="430" />
            <line x1="690" y1="0" x2="690" y2="430" />
          </g>

          {/* Clean geometric continent silhouettes */}
          <g fill="#1e293b" stroke="#334155" strokeWidth="1">
            {/* North America */}
            <path d="M85,82 L150,62 L235,66 L290,94 L276,136 L248,166 L220,192 L198,205 L182,188 L156,174 L126,144 L95,112 Z" />
            {/* Caribbean islands */}
            <path d="M236,204 L268,202 L276,212 L244,214 Z" />
            {/* South America */}
            <path d="M254,234 L298,236 L336,266 L342,306 L312,356 L286,396 L268,386 L260,336 L244,274 Z" />
            {/* Europe */}
            <path d="M430,86 L486,74 L536,88 L544,126 L510,144 L468,144 L438,128 L428,108 Z" />
            {/* Africa */}
            <path d="M432,162 L494,154 L544,174 L568,218 L556,272 L526,338 L494,344 L472,296 L462,250 L422,226 L416,188 Z" />
            {/* Middle East & Asia */}
            <path d="M546,148 L594,156 L612,186 L584,206 L552,188 Z" />
            <path d="M542,78 L658,64 L760,82 L788,122 L750,174 L708,214 L670,224 L628,202 L584,162 L542,130 Z" />
            {/* Japan archipelago */}
            <path d="M760,138 L774,146 L776,166 L762,174 L756,158 Z" fill="#f59e0b" stroke="#fcd34d" />
            {/* SE Asia / Indonesia */}
            <path d="M694,236 L752,246 L764,258 L704,252 Z" />
            {/* Australia */}
            <path d="M726,294 L792,288 L818,324 L802,360 L746,356 L718,328 Z" />
            {/* New Zealand */}
            <path d="M842,348 L858,354 L852,374 L838,368 Z" />
          </g>

          {/* Animated Shipping Corridors from Japan */}
          {CORRIDOR_NODES.map((node) => {
            const isSelected = selectedPortId === node.portId;
            const midX = (JAPAN_HUB.x + node.x) / 2;
            const midY = Math.min(JAPAN_HUB.y, node.y) - (node.x < 350 ? 60 : 32);
            const pathD = `M ${JAPAN_HUB.x} ${JAPAN_HUB.y} Q ${midX} ${midY} ${node.x} ${node.y}`;
            return (
              <g key={node.id}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={isSelected ? '#f59e0b' : 'url(#routeGrad)'}
                  strokeWidth={isSelected ? 2.6 : 1.5}
                  strokeDasharray="6 5"
                  className="auzio-route-dash"
                  opacity={isSelected ? 1 : 0.65}
                />
              </g>
            );
          })}

          {/* Origin Hub: Yokohama, Japan */}
          <g>
            <circle cx={JAPAN_HUB.x} cy={JAPAN_HUB.y} r="9" fill="#f59e0b" opacity="0.25" />
            <circle cx={JAPAN_HUB.x} cy={JAPAN_HUB.y} r="4.5" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
            <text
              x={JAPAN_HUB.x + 10}
              y={JAPAN_HUB.y - 6}
              fill="#fbbf24"
              fontSize="11"
              fontWeight="700"
            >
              JAPAN (JPYOK)
            </text>
          </g>

          {/* Clickable Destination Hub Markers */}
          {CORRIDOR_NODES.map((node) => {
            const isSelected = selectedPortId === node.portId;
            const labelOnLeft = node.x > 760;
            return (
              <g
                key={node.id}
                onClick={() => onSelectDestination(node.countryCode, node.portId)}
                className="cursor-pointer group"
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isSelected ? 10 : 7}
                  fill={isSelected ? '#f59e0b' : '#38bdf8'}
                  opacity={isSelected ? 0.3 : 0.18}
                />
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isSelected ? 5 : 3.8}
                  fill={isSelected ? '#f59e0b' : '#38bdf8'}
                  stroke="#0f172a"
                  strokeWidth="1.5"
                />
                <text
                  x={labelOnLeft ? node.x - 10 : node.x + 9}
                  y={node.y + 4}
                  textAnchor={labelOnLeft ? 'end' : 'start'}
                  fill={isSelected ? '#fef3c7' : '#cbd5e1'}
                  fontSize="10"
                  fontWeight={isSelected ? '700' : '500'}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
