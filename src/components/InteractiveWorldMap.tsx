import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Anchor,
  Globe,
  Layers,
  Map as MapIcon,
  Maximize2,
  Mountain,
  Satellite,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// Modern Google Maps Platform React implementation for Global Shipping Network
// Ref: https://developers.google.com/maps/documentation/javascript/advanced-markers/overview?utm_campaign=gmp_mcp_codeassist_v1_aistudio

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
const DEFAULT_CENTER = { lat: 14, lng: 82 };
const DEFAULT_ZOOM = 2;

type GoogleMapTypeId = 'hybrid' | 'satellite' | 'terrain' | 'roadmap';

interface LatLngPoint {
  lat: number;
  lng: number;
}

interface CorridorNode {
  id: string;
  countryCode: string;
  portId: string;
  label: string;
  shortLabel: string;
  unLocode: string;
  transit: string;
  position: LatLngPoint;
  seaRoute: LatLngPoint[];
}

const JAPAN_HUB: LatLngPoint = { lat: 35.4437, lng: 139.638 }; // Yokohama (JPYOK)

const CORRIDOR_NODES: CorridorNode[] = [
  {
    id: 'mombasa',
    countryCode: 'KE',
    portId: 'mombasa-ke',
    label: 'Mombasa, Kenya',
    shortLabel: 'Mombasa',
    unLocode: 'KEMBA',
    transit: '24–30 days',
    position: { lat: -4.0435, lng: 39.6682 },
    seaRoute: [
      JAPAN_HUB,
      { lat: 24, lng: 126 },
      { lat: 13, lng: 115 },
      { lat: 1.3, lng: 104 },
      { lat: 5.5, lng: 94 },
      { lat: 3.5, lng: 76 },
      { lat: -0.5, lng: 56 },
      { lat: -4.0435, lng: 39.6682 },
    ],
  },
  {
    id: 'dar',
    countryCode: 'TZ',
    portId: 'dar-es-salaam-tz',
    label: 'Dar es Salaam, Tanzania',
    shortLabel: 'Dar es Salaam',
    unLocode: 'TZDAR',
    transit: '25–32 days',
    position: { lat: -6.7924, lng: 39.2695 },
    seaRoute: [
      JAPAN_HUB,
      { lat: 24, lng: 126 },
      { lat: 13, lng: 115 },
      { lat: 1.3, lng: 104 },
      { lat: 3.5, lng: 93 },
      { lat: -1.5, lng: 74 },
      { lat: -6, lng: 54 },
      { lat: -6.7924, lng: 39.2695 },
    ],
  },
  {
    id: 'durban',
    countryCode: 'ZA',
    portId: 'durban-za',
    label: 'Durban, South Africa',
    shortLabel: 'Durban',
    unLocode: 'ZADUR',
    transit: '26–34 days',
    position: { lat: -29.8587, lng: 31.0218 },
    seaRoute: [
      JAPAN_HUB,
      { lat: 24, lng: 126 },
      { lat: 13, lng: 115 },
      { lat: 1.3, lng: 104 },
      { lat: -4, lng: 95 },
      { lat: -16, lng: 76 },
      { lat: -27, lng: 54 },
      { lat: -29.8587, lng: 31.0218 },
    ],
  },
  {
    id: 'jebel-ali',
    countryCode: 'AE',
    portId: 'jebel-ali-ae',
    label: 'Jebel Ali, UAE',
    shortLabel: 'Jebel Ali',
    unLocode: 'AEJEA',
    transit: '18–24 days',
    position: { lat: 24.9857, lng: 55.0273 },
    seaRoute: [
      JAPAN_HUB,
      { lat: 24, lng: 126 },
      { lat: 13, lng: 115 },
      { lat: 1.3, lng: 104 },
      { lat: 6.5, lng: 91 },
      { lat: 13, lng: 73 },
      { lat: 25.5, lng: 58 },
      { lat: 24.9857, lng: 55.0273 },
    ],
  },
  {
    id: 'southampton',
    countryCode: 'GB',
    portId: 'southampton-uk',
    label: 'Southampton, UK',
    shortLabel: 'Southampton',
    unLocode: 'GBSOU',
    transit: '36–44 days',
    position: { lat: 50.9097, lng: -1.4044 },
    seaRoute: [
      JAPAN_HUB,
      { lat: 24, lng: 126 },
      { lat: 13, lng: 115 },
      { lat: 1.3, lng: 104 },
      { lat: 6, lng: 88 },
      { lat: 12, lng: 65 },
      { lat: 12.6, lng: 43.4 },
      { lat: 30.0, lng: 32.6 },
      { lat: 35.5, lng: 16 },
      { lat: 36.0, lng: -5.6 },
      { lat: 43.5, lng: -10.5 },
      { lat: 49.5, lng: -5.5 },
      { lat: 50.9097, lng: -1.4044 },
    ],
  },
  {
    id: 'sydney',
    countryCode: 'AU',
    portId: 'sydney-au',
    label: 'Sydney / Port Kembla',
    shortLabel: 'Sydney',
    unLocode: 'AUPKL',
    transit: '12–19 days',
    position: { lat: -33.8688, lng: 151.2093 },
    seaRoute: [
      JAPAN_HUB,
      { lat: 22, lng: 145 },
      { lat: 4, lng: 152 },
      { lat: -18, lng: 156 },
      { lat: -33.8688, lng: 151.2093 },
    ],
  },
  {
    id: 'auckland',
    countryCode: 'NZ',
    portId: 'auckland-nz',
    label: 'Auckland, New Zealand',
    shortLabel: 'Auckland',
    unLocode: 'NZAKL',
    transit: '14–18 days',
    position: { lat: -36.8485, lng: 174.7633 },
    seaRoute: [
      JAPAN_HUB,
      { lat: 20, lng: 150 },
      { lat: -4, lng: 164 },
      { lat: -24, lng: 173 },
      { lat: -36.8485, lng: 174.7633 },
    ],
  },
  {
    id: 'kingston',
    countryCode: 'JM',
    portId: 'kingston-jm',
    label: 'Kingston, Caribbean',
    shortLabel: 'Kingston',
    unLocode: 'JMKIN',
    transit: '30–38 days',
    position: { lat: 17.9712, lng: -76.7936 },
    seaRoute: [
      JAPAN_HUB,
      { lat: 29, lng: 168 },
      { lat: 22, lng: -156 },
      { lat: 15, lng: -118 },
      { lat: 8.5, lng: -86 },
      { lat: 9.3, lng: -79.9 },
      { lat: 17.9712, lng: -76.7936 },
    ],
  },
];

const MAP_STYLE_OPTIONS: Array<{
  id: GoogleMapTypeId;
  label: string;
  Icon: typeof Satellite;
}> = [
  { id: 'hybrid', label: 'Satellite', Icon: Satellite },
  { id: 'satellite', label: 'Clean Sat', Icon: Globe },
  { id: 'terrain', label: 'Terrain', Icon: Mountain },
  { id: 'roadmap', label: 'Map', Icon: MapIcon },
];

interface SeaLanePolylinesProps {
  selectedPortId: string;
  hoveredId: string | null;
}

function SeaLanePolylines({ selectedPortId, hoveredId }: SeaLanePolylinesProps) {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');

  useEffect(() => {
    if (!map || !mapsLib) return;

    const polylines = CORRIDOR_NODES.map((node) => {
      const emphasized = selectedPortId === node.portId || hoveredId === node.id;
      return new mapsLib.Polyline({
        path: node.seaRoute,
        geodesic: true,
        strokeColor: emphasized ? '#fbbf24' : '#38bdf8',
        strokeOpacity: emphasized ? 0.95 : 0.45,
        strokeWeight: emphasized ? 3.5 : 1.75,
        zIndex: emphasized ? 20 : 5,
        map,
      });
    });

    return () => {
      polylines.forEach((line) => line.setMap(null));
    };
  }, [map, mapsLib, selectedPortId, hoveredId]);

  return null;
}

interface NetworkCameraControllerProps {
  selectedNode: CorridorNode | null;
  resetNonce: number;
}

function NetworkCameraController({ selectedNode, resetNonce }: NetworkCameraControllerProps) {
  const map = useMap();

  useEffect(() => {
    if (!map || resetNonce === 0) return;
    map.panTo(DEFAULT_CENTER);
    map.setZoom(DEFAULT_ZOOM);
  }, [map, resetNonce]);

  useEffect(() => {
    if (!map || !selectedNode) return;
    // Frame both Yokohama hub and the selected destination port cleanly when user clicks a lane
    const lats = selectedNode.seaRoute.map((p) => p.lat);
    const north = Math.max(...lats);
    const south = Math.min(...lats);

    // Avoid crossing-antimeridian wrap distortion for trans-Pacific Kingston route
    if (selectedNode.id === 'kingston') {
      map.panTo({ lat: 20, lng: -150 });
      map.setZoom(2);
      return;
    }

    const lngs = selectedNode.seaRoute.map((p) => p.lng);
    const east = Math.max(...lngs);
    const west = Math.min(...lngs);
    map.fitBounds({ north, south, east, west }, 48);
  }, [map, selectedNode]);

  return null;
}

interface PortMarkerProps {
  node: CorridorNode;
  isSelected: boolean;
  isInfoOpen: boolean;
  onHover: (id: string | null) => void;
  onSelect: (node: CorridorNode) => void;
  onCloseInfo: () => void;
}

function PortMarker({
  node,
  isSelected,
  isInfoOpen,
  onHover,
  onSelect,
  onCloseInfo,
}: PortMarkerProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={node.position}
        zIndex={isSelected ? 400 : 120}
        title={`${node.label} (${node.unLocode})`}
        onClick={() => onSelect(node)}
      >
        <div
          onMouseEnter={() => onHover(node.id)}
          onMouseLeave={() => onHover(null)}
          className="flex flex-col items-center -translate-y-1/2 cursor-pointer select-none"
        >
          <div
            className="rounded-full transition-transform hover:scale-125"
            style={{
              width: isSelected ? '16px' : '12px',
              height: isSelected ? '16px' : '12px',
              backgroundColor: isSelected ? '#fbbf24' : '#38bdf8',
              border: '2px solid #020617',
              boxShadow: isSelected
                ? '0 0 0 5px rgba(251,191,36,0.45), 0 2px 8px rgba(0,0,0,0.6)'
                : '0 0 0 3px rgba(56,189,248,0.28), 0 2px 6px rgba(0,0,0,0.5)',
            }}
          />
          <span
            className={`mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold whitespace-nowrap shadow-md border ${
              isSelected
                ? 'bg-amber-400 text-slate-950 border-amber-200'
                : 'bg-slate-950/85 text-slate-100 border-white/20'
            }`}
          >
            {node.shortLabel}
          </span>
        </div>
      </AdvancedMarker>

      {isInfoOpen && marker && (
        <InfoWindow anchor={marker} maxWidth={260} onCloseClick={onCloseInfo}>
          <div className="text-xs text-slate-900 space-y-1.5 p-0.5 min-w-[200px]">
            <div className="font-bold text-sm text-slate-950">{node.label}</div>
            <div className="font-mono text-[11px] text-amber-800 font-semibold">
              UN/LOCODE: {node.unLocode}
            </div>
            <div className="text-[11px] text-slate-700">
              <strong>Origin:</strong> Yokohama, Japan (JPYOK)
            </div>
            <div className="text-[11px] text-slate-700">
              <strong>Est. Sea Transit:</strong> {node.transit}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

interface InteractiveWorldMapProps {
  selectedPortId: string;
  onSelectDestination: (countryCode: string, portId: string) => void;
}

export function InteractiveWorldMap({
  selectedPortId,
  onSelectDestination,
}: InteractiveWorldMapProps) {
  const [mapTypeId, setMapTypeId] = useState<GoogleMapTypeId>('hybrid');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);
  const [focusedNode, setFocusedNode] = useState<CorridorNode | null>(null);
  const [resetNonce, setResetNonce] = useState(0);

  const activeNode =
    CORRIDOR_NODES.find((n) => n.id === hoveredId) ||
    CORRIDOR_NODES.find((n) => n.portId === selectedPortId) ||
    CORRIDOR_NODES[0];

  const handleSelectPortNode = useCallback(
    (node: CorridorNode) => {
      setOpenInfoId(node.id);
      setFocusedNode(node);
      onSelectDestination(node.countryCode, node.portId);
    },
    [onSelectDestination]
  );

  return (
    <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 sm:p-6 overflow-hidden space-y-3">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
          <Anchor className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Japan Export Hubs (Yokohama · Nagoya · Kobe · Osaka · Hakata)</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-300 tabular-nums">
          <span className="text-amber-400 font-semibold">{activeNode.label}</span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className="font-mono">{activeNode.unLocode}</span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span>Est. Sea Transit {activeNode.transit}</span>
        </div>
      </div>

      {/* Live Google Maps Satellite Viewport */}
      <div className="relative w-full h-[420px] sm:h-[470px] rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
        {!GOOGLE_MAPS_API_KEY ? (
          <div className="w-full h-full flex items-center justify-center p-6 text-center text-white">
            <div className="max-w-md space-y-2">
              <Layers className="w-8 h-8 text-amber-400 mx-auto" />
              <div className="text-sm font-bold">Google Maps API Key Required</div>
              <p className="text-xs text-slate-300">
                Configure <span className="font-mono text-amber-300">VITE_GOOGLE_MAPS_API_KEY</span>{' '}
                to display the live Google Satellite shipping network map.
              </p>
            </div>
          </div>
        ) : (
          <APIProvider
            apiKey={GOOGLE_MAPS_API_KEY}
            libraries={['marker', 'maps']}
            language="en"
            region="JP"
          >
            <GoogleMap
              mapId="DEMO_MAP_ID"
              mapTypeId={mapTypeId}
              defaultCenter={DEFAULT_CENTER}
              defaultZoom={DEFAULT_ZOOM}
              minZoom={2}
              maxZoom={18}
              gestureHandling="cooperative"
              mapTypeControl={false}
              streetViewControl={false}
              fullscreenControl={true}
              zoomControl={true}
              scaleControl={true}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              className="w-full h-full"
            >
              <SeaLanePolylines selectedPortId={selectedPortId} hoveredId={hoveredId} />
              <NetworkCameraController selectedNode={focusedNode} resetNonce={resetNonce} />

              {/* Origin Hub: Yokohama, Japan */}
              <AdvancedMarker
                position={JAPAN_HUB}
                zIndex={450}
                title="Japan Export Hub — Yokohama (JPYOK)"
              >
                <div className="flex flex-col items-center -translate-y-1/2 select-none">
                  <div
                    className="w-4 h-4 rounded-full bg-amber-400 border-2 border-white"
                    style={{
                      boxShadow:
                        '0 0 0 6px rgba(245,158,11,0.4), 0 2px 10px rgba(0,0,0,0.65)',
                    }}
                  />
                  <span className="mt-1 px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-mono font-extrabold whitespace-nowrap shadow-md">
                    JAPAN (JPYOK)
                  </span>
                </div>
              </AdvancedMarker>

              {/* Clickable Destination Port Markers */}
              {CORRIDOR_NODES.map((node) => (
                <PortMarker
                  key={node.id}
                  node={node}
                  isSelected={selectedPortId === node.portId}
                  isInfoOpen={openInfoId === node.id}
                  onHover={setHoveredId}
                  onSelect={handleSelectPortNode}
                  onCloseInfo={() => setOpenInfoId(null)}
                />
              ))}
            </GoogleMap>
          </APIProvider>
        )}

        {/* Top-left Map Type Switcher */}
        <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1 bg-slate-950/85 backdrop-blur-md p-1 rounded-lg border border-white/15 shadow-lg">
          {MAP_STYLE_OPTIONS.map(({ id, label, Icon }) => {
            const active = mapTypeId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setMapTypeId(id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                  active
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Top-right World View Reset */}
        <div className="absolute top-3 right-14 z-10">
          <button
            type="button"
            onClick={() => {
              setFocusedNode(null);
              setOpenInfoId(null);
              setResetNonce((n) => n + 1);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold bg-slate-950/85 backdrop-blur-md text-white border border-white/15 hover:bg-slate-900 rounded-lg shadow-lg cursor-pointer"
            title="Reset to global shipping network view"
          >
            <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
            World View
          </button>
        </div>
      </div>

      {/* Quick Destination Corridor Buttons + Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {CORRIDOR_NODES.map((node) => {
            const isSelected = selectedPortId === node.portId;
            return (
              <button
                key={node.id}
                type="button"
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => handleSelectPortNode(node)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-amber-500/60 hover:text-white'
                }`}
              >
                {node.shortLabel} ({node.unLocode})
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            Japan Hub
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            Destination Port
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-amber-400 inline-block" />
            Active Lane
          </span>
        </div>
      </div>
    </div>
  );
}
