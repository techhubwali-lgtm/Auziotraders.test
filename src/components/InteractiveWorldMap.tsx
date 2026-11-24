import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry, LineString } from 'geojson';
import { Anchor } from 'lucide-react';
import { useMemo, useState } from 'react';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import worldAtlasRaw from 'world-atlas/countries-110m.json';

interface CorridorNode {
  id: string;
  countryCode: string;
  isoNumeric: string;
  portId: string;
  label: string;
  shortLabel: string;
  unLocode: string;
  transit: string;
  coords: [number, number]; // [lon, lat]
  seaRoute: [number, number][]; // Real maritime waypoints from Yokohama
  labelDx: number;
  labelDy: number;
  labelAnchor: 'start' | 'end' | 'middle';
}

const JAPAN_ISO_NUMERIC = '392';
const JAPAN_COORDS: [number, number] = [139.638, 35.4437]; // Yokohama (JPYOK)

const CORRIDOR_NODES: CorridorNode[] = [
  {
    id: 'mombasa',
    countryCode: 'KE',
    isoNumeric: '404',
    portId: 'mombasa-ke',
    label: 'Mombasa, Kenya',
    shortLabel: 'Mombasa',
    unLocode: 'KEMBA',
    transit: '24–30 days',
    coords: [39.6682, -4.0435],
    seaRoute: [
      JAPAN_COORDS,
      [126, 24],
      [115, 13],
      [104, 1.3],
      [94, 5.5],
      [76, 3.5],
      [56, -0.5],
      [39.6682, -4.0435],
    ],
    labelDx: 9,
    labelDy: -4,
    labelAnchor: 'start',
  },
  {
    id: 'dar',
    countryCode: 'TZ',
    isoNumeric: '834',
    portId: 'dar-es-salaam-tz',
    label: 'Dar es Salaam, Tanzania',
    shortLabel: 'Dar es Salaam',
    unLocode: 'TZDAR',
    transit: '25–32 days',
    coords: [39.2695, -6.7924],
    seaRoute: [
      JAPAN_COORDS,
      [126, 24],
      [115, 13],
      [104, 1.3],
      [93, 3.5],
      [74, -1.5],
      [54, -6],
      [39.2695, -6.7924],
    ],
    labelDx: 9,
    labelDy: 10,
    labelAnchor: 'start',
  },
  {
    id: 'durban',
    countryCode: 'ZA',
    isoNumeric: '710',
    portId: 'durban-za',
    label: 'Durban, South Africa',
    shortLabel: 'Durban',
    unLocode: 'ZADUR',
    transit: '26–34 days',
    coords: [31.0218, -29.8587],
    seaRoute: [
      JAPAN_COORDS,
      [126, 24],
      [115, 13],
      [104, 1.3],
      [95, -4],
      [76, -16],
      [54, -27],
      [31.0218, -29.8587],
    ],
    labelDx: 9,
    labelDy: 4,
    labelAnchor: 'start',
  },
  {
    id: 'jebel-ali',
    countryCode: 'AE',
    isoNumeric: '784',
    portId: 'jebel-ali-ae',
    label: 'Jebel Ali, UAE',
    shortLabel: 'Jebel Ali',
    unLocode: 'AEJEA',
    transit: '18–24 days',
    coords: [55.0273, 24.9857],
    seaRoute: [
      JAPAN_COORDS,
      [126, 24],
      [115, 13],
      [104, 1.3],
      [91, 6.5],
      [73, 13],
      [58, 25.5],
      [55.0273, 24.9857],
    ],
    labelDx: 8,
    labelDy: -6,
    labelAnchor: 'start',
  },
  {
    id: 'southampton',
    countryCode: 'GB',
    isoNumeric: '826',
    portId: 'southampton-uk',
    label: 'Southampton, UK',
    shortLabel: 'Southampton',
    unLocode: 'GBSOU',
    transit: '36–44 days',
    coords: [-1.4044, 50.9097],
    seaRoute: [
      JAPAN_COORDS,
      [126, 24],
      [115, 13],
      [104, 1.3],
      [88, 6],
      [65, 12],
      [43.4, 12.6],
      [32.6, 30.0],
      [16, 35.5],
      [-5.6, 36.0],
      [-10.5, 43.5],
      [-5.5, 49.5],
      [-1.4044, 50.9097],
    ],
    labelDx: -9,
    labelDy: -5,
    labelAnchor: 'end',
  },
  {
    id: 'sydney',
    countryCode: 'AU',
    isoNumeric: '036',
    portId: 'sydney-au',
    label: 'Sydney / Port Kembla',
    shortLabel: 'Sydney',
    unLocode: 'AUPKL',
    transit: '12–19 days',
    coords: [151.2093, -33.8688],
    seaRoute: [
      JAPAN_COORDS,
      [145, 22],
      [152, 4],
      [156, -18],
      [151.2093, -33.8688],
    ],
    labelDx: -10,
    labelDy: 4,
    labelAnchor: 'end',
  },
  {
    id: 'auckland',
    countryCode: 'NZ',
    isoNumeric: '554',
    portId: 'auckland-nz',
    label: 'Auckland, New Zealand',
    shortLabel: 'Auckland',
    unLocode: 'NZAKL',
    transit: '14–18 days',
    coords: [174.7633, -36.8485],
    seaRoute: [
      JAPAN_COORDS,
      [150, 20],
      [164, -4],
      [173, -24],
      [174.7633, -36.8485],
    ],
    labelDx: -9,
    labelDy: 13,
    labelAnchor: 'end',
  },
  {
    id: 'kingston',
    countryCode: 'JM',
    isoNumeric: '388',
    portId: 'kingston-jm',
    label: 'Kingston, Caribbean',
    shortLabel: 'Kingston',
    unLocode: 'JMKIN',
    transit: '30–38 days',
    coords: [-76.7936, 17.9712],
    seaRoute: [
      JAPAN_COORDS,
      [168, 29],
      [-156, 22],
      [-118, 15],
      [-86, 8.5],
      [-79.9, 9.3],
      [-76.7936, 17.9712],
    ],
    labelDx: 9,
    labelDy: 3,
    labelAnchor: 'start',
  },
];

const SERVED_BY_ISO = new Map<string, CorridorNode>(
  CORRIDOR_NODES.map((n) => [n.isoNumeric, n])
);

const MAP_WIDTH = 960;
const MAP_HEIGHT = 470;

interface InteractiveWorldMapProps {
  selectedPortId: string;
  onSelectDestination: (countryCode: string, portId: string) => void;
}

export function InteractiveWorldMap({
  selectedPortId,
  onSelectDestination,
}: InteractiveWorldMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const {
    countries,
    spherePath,
    graticulePath,
    japanPoint,
    nodeProjections,
    routePaths,
  } = useMemo(() => {
    const topology = worldAtlasRaw as unknown as Topology<{
      countries: GeometryCollection<{ name?: string }>;
    }>;
    const fc = feature(
      topology,
      topology.objects.countries
    ) as unknown as FeatureCollection<Geometry, { name?: string }>;

    // Exclude Antarctica (010) so inhabited continents and maritime lanes fill the viewport cleanly
    const filteredFeatures: Feature<Geometry, { name?: string }>[] = fc.features.filter(
      (f) => String(f.id) !== '010'
    );
    const filteredCollection: FeatureCollection<Geometry, { name?: string }> = {
      type: 'FeatureCollection',
      features: filteredFeatures,
    };

    const projection = geoNaturalEarth1().fitExtent(
      [
        [10, 14],
        [MAP_WIDTH - 10, MAP_HEIGHT - 14],
      ],
      filteredCollection
    );

    const pathGen = geoPath(projection);
    const sphere = pathGen({ type: 'Sphere' }) || '';
    const graticule = pathGen(geoGraticule10()) || '';

    const countryPaths = filteredFeatures.map((f, idx) => ({
      key: String(f.id ?? idx),
      id: String(f.id ?? ''),
      name: f.properties?.name || '',
      d: pathGen(f) || '',
    }));

    const jp = projection(JAPAN_COORDS) || [805, 160];

    const nodes = CORRIDOR_NODES.map((node) => {
      const pt = projection(node.coords) || [0, 0];
      return {
        ...node,
        x: pt[0],
        y: pt[1],
      };
    });

    const routes = CORRIDOR_NODES.map((node) => {
      const line: LineString = {
        type: 'LineString',
        coordinates: node.seaRoute,
      };
      return {
        id: node.id,
        portId: node.portId,
        d: pathGen(line) || '',
      };
    });

    return {
      countries: countryPaths,
      spherePath: sphere,
      graticulePath: graticule,
      japanPoint: jp,
      nodeProjections: nodes,
      routePaths: routes,
    };
  }, []);

  const activeNode =
    nodeProjections.find((n) => n.id === hoveredId) ||
    nodeProjections.find((n) => n.portId === selectedPortId) ||
    nodeProjections[0];

  return (
    <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 sm:p-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
          <Anchor className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Japan Export Hubs (Yokohama · Nagoya · Kobe · Osaka · Hakata)</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-300 tabular-nums">
          <span className="text-amber-400 font-semibold">{activeNode.label}</span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span>{activeNode.unLocode}</span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span>Est. Sea Transit {activeNode.transit}</span>
        </div>
      </div>

      <div className="relative w-full aspect-[960/470] min-h-[260px]">
        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          className="w-full h-full select-none"
          role="img"
          aria-label="Real-world maritime vehicle shipping map from Japan to Africa, Middle East, Europe, Oceania, and the Caribbean"
        >
          <defs>
            <radialGradient id="oceanBathymetry" cx="52%" cy="46%" r="65%">
              <stop offset="0%" stopColor="#122c4a" />
              <stop offset="55%" stopColor="#0b1d35" />
              <stop offset="100%" stopColor="#061121" />
            </radialGradient>
            <linearGradient id="seaLaneGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.9" />
            </linearGradient>
            <clipPath id="earthSphereClip">
              <path d={spherePath} />
            </clipPath>
          </defs>

          {/* Earth Ocean Sphere */}
          <path d={spherePath} fill="url(#oceanBathymetry)" stroke="#1e3a5f" strokeWidth="1" />

          {/* Clipped Cartographic Layers */}
          <g clipPath="url(#earthSphereClip)">
            {/* Real Latitude / Longitude Graticule */}
            <path
              d={graticulePath}
              fill="none"
              stroke="#60a5fa"
              strokeOpacity="0.11"
              strokeWidth="0.6"
            />

            {/* Real-World Natural Earth Country Polygons */}
            <g>
              {countries.map((c) => {
                const isJapan = c.id === JAPAN_ISO_NUMERIC;
                const servedNode = SERVED_BY_ISO.get(c.id);
                const isSelectedCountry = Boolean(
                  servedNode && servedNode.portId === selectedPortId
                );
                const isHoveredCountry = Boolean(servedNode && servedNode.id === hoveredId);

                let fill = '#223347';
                let stroke = '#364d68';
                let strokeWidth = 0.55;

                if (isJapan) {
                  fill = '#f59e0b';
                  stroke = '#fde68a';
                  strokeWidth = 0.9;
                } else if (isSelectedCountry || isHoveredCountry) {
                  fill = '#b45309';
                  stroke = '#fbbf24';
                  strokeWidth = 0.95;
                } else if (servedNode) {
                  fill = '#1b4965';
                  stroke = '#38bdf8';
                  strokeWidth = 0.7;
                }

                return (
                  <path
                    key={c.key}
                    d={c.d}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                    className={
                      servedNode
                        ? 'cursor-pointer transition-colors duration-150'
                        : 'transition-colors duration-150'
                    }
                    onMouseEnter={() => {
                      if (servedNode) setHoveredId(servedNode.id);
                    }}
                    onMouseLeave={() => {
                      if (servedNode) setHoveredId(null);
                    }}
                    onClick={() => {
                      if (servedNode) {
                        onSelectDestination(servedNode.countryCode, servedNode.portId);
                      }
                    }}
                  >
                    {c.name && <title>{c.name}</title>}
                  </path>
                );
              })}
            </g>

            {/* Real Maritime Sea-Lane Corridors (GeoJSON Projected) */}
            <g>
              {routePaths.map((route) => {
                const isSelected = selectedPortId === route.portId;
                const isHovered = hoveredId === route.id;
                const emphasized = isSelected || isHovered;
                return (
                  <g key={route.id}>
                    {emphasized && (
                      <path
                        d={route.d}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth={5}
                        strokeOpacity={0.22}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    <path
                      d={route.d}
                      fill="none"
                      stroke={emphasized ? '#fbbf24' : 'url(#seaLaneGrad)'}
                      strokeWidth={emphasized ? 2.2 : 1.25}
                      strokeDasharray={emphasized ? '7 4' : '4 4'}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="auzio-route-dash"
                      opacity={emphasized ? 1 : 0.62}
                    />
                  </g>
                );
              })}
            </g>

            {/* Origin Hub: Yokohama, Japan */}
            <g>
              <circle cx={japanPoint[0]} cy={japanPoint[1]} r="10" fill="#f59e0b" opacity="0.24" />
              <circle
                cx={japanPoint[0]}
                cy={japanPoint[1]}
                r="4.5"
                fill="#f59e0b"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              <text
                x={japanPoint[0] + 9}
                y={japanPoint[1] - 7}
                fill="#fde68a"
                stroke="#061121"
                strokeWidth="3.5"
                paintOrder="stroke"
                fontSize="10.5"
                fontWeight="700"
                letterSpacing="0.03em"
              >
                JAPAN (JPYOK)
              </text>
            </g>

            {/* Clickable Real-Coordinate Destination Ports */}
            {nodeProjections.map((node) => {
              const isSelected = selectedPortId === node.portId;
              const isHovered = hoveredId === node.id;
              const active = isSelected || isHovered;
              return (
                <g
                  key={node.id}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onSelectDestination(node.countryCode, node.portId)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={active ? 11 : 7}
                    fill={active ? '#f59e0b' : '#38bdf8'}
                    opacity={active ? 0.3 : 0.18}
                  />
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={active ? 4.8 : 3.6}
                    fill={active ? '#fbbf24' : '#38bdf8'}
                    stroke="#061121"
                    strokeWidth="1.5"
                  />
                  <text
                    x={node.x + node.labelDx}
                    y={node.y + node.labelDy}
                    textAnchor={node.labelAnchor}
                    fill={active ? '#fef3c7' : '#e2e8f0'}
                    stroke="#061121"
                    strokeWidth="3.5"
                    paintOrder="stroke"
                    fontSize={active ? '10.5' : '9.5'}
                    fontWeight={active ? '700' : '600'}
                  >
                    {node.shortLabel}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Subtle Ocean Legend inside Bottom-Left Corner */}
          <g transform="translate(22, 434)" fontSize="9.5" fill="#94a3b8">
            <circle cx="5" cy="0" r="3.5" fill="#f59e0b" />
            <text x="14" y="3.5" fill="#cbd5e1">
              Japan Export Hub
            </text>
            <circle cx="122" cy="0" r="3.5" fill="#38bdf8" />
            <text x="131" y="3.5" fill="#cbd5e1">
              Destination Port
            </text>
            <line
              x1="226"
              y1="0"
              x2="246"
              y2="0"
              stroke="#fbbf24"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            <text x="253" y="3.5" fill="#cbd5e1">
              Active Maritime Lane
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
