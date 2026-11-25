import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  useAdvancedMarkerRef,
  useMap,
} from '@vis.gl/react-google-maps';
import { Globe, Layers, Map as MapIcon, Maximize2, Mountain, Satellite } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  formatNavigationalStatus,
  getVesselFreshness,
} from '../services/vesselTrackingService';
import type { RegisteredVessel } from '../types/portal';

// Modern Google Maps Platform React implementation using @vis.gl/react-google-maps
// AdvancedMarker + InfoWindow + Satellite/Hybrid/Terrain/Roadmap views.
// Ref: https://developers.google.com/maps/documentation/javascript/advanced-markers/overview?utm_campaign=gmp_mcp_codeassist_v1_aistudio

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
const DEFAULT_CENTER = { lat: 20, lng: 95 };
const DEFAULT_ZOOM = 3;

type GoogleMapTypeId = 'hybrid' | 'satellite' | 'terrain' | 'roadmap';

interface VesselLeafletMapProps {
  vessels: RegisteredVessel[];
  selectedVesselId?: string | null;
  onSelectVessel?: (vesselId: string) => void;
  heightClass?: string;
}

interface PositionedVessel {
  vessel: RegisteredVessel;
  lat: number;
  lng: number;
  isManual: boolean;
}

function getVesselCoordinates(vessel: RegisteredVessel): {
  lat: number;
  lng: number;
  isManual: boolean;
} | null {
  if (
    typeof vessel.latitude === 'number' &&
    typeof vessel.longitude === 'number' &&
    Number.isFinite(vessel.latitude) &&
    Number.isFinite(vessel.longitude)
  ) {
    return { lat: vessel.latitude, lng: vessel.longitude, isManual: false };
  }
  if (
    typeof vessel.manualLatitude === 'number' &&
    typeof vessel.manualLongitude === 'number' &&
    Number.isFinite(vessel.manualLatitude) &&
    Number.isFinite(vessel.manualLongitude)
  ) {
    return { lat: vessel.manualLatitude, lng: vessel.manualLongitude, isManual: true };
  }
  return null;
}

function getFreshnessColor(vessel: RegisteredVessel): string {
  const freshness = getVesselFreshness(vessel);
  if (freshness.status === 'stale') return '#f59e0b';
  if (freshness.status === 'outdated') return '#ef4444';
  if (freshness.status === 'manual_only') return '#3b82f6';
  if (freshness.status === 'no_signal') return '#94a3b8';
  return '#10b981';
}

interface VesselMarkerItemProps {
  item: PositionedVessel;
  isSelected: boolean;
  isInfoOpen: boolean;
  onSelect: (vesselId: string) => void;
  onCloseInfo: () => void;
}

function VesselMarkerItem({
  item,
  isSelected,
  isInfoOpen,
  onSelect,
  onCloseInfo,
}: VesselMarkerItemProps) {
  const { vessel, lat, lng, isManual } = item;
  const [markerRef, marker] = useAdvancedMarkerRef();
  const freshness = getVesselFreshness(vessel);
  const fill = getFreshnessColor(vessel);

  const heading =
    typeof vessel.headingDeg === 'number'
      ? vessel.headingDeg
      : typeof vessel.courseDeg === 'number'
        ? vessel.courseDeg
        : 0;

  const size = isSelected ? 40 : 32;
  const speedText =
    typeof vessel.speedKnots === 'number' ? `${vessel.speedKnots.toFixed(1)} kn` : 'N/A';
  const courseText =
    typeof vessel.courseDeg === 'number'
      ? `${vessel.courseDeg.toFixed(1)}°`
      : typeof vessel.headingDeg === 'number'
        ? `${vessel.headingDeg}°`
        : 'N/A';
  const destText = vessel.aisDestination || vessel.destinationPort || 'Not reported';
  const etaText = vessel.etaReported || vessel.etaManual || 'Pending';
  const updatedText = vessel.lastAisUpdateAt
    ? new Date(vessel.lastAisUpdateAt).toLocaleString()
    : vessel.manualUpdatedAt
      ? `Manual: ${new Date(vessel.manualUpdatedAt).toLocaleString()}`
      : 'No AIS timestamp';

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat, lng }}
        zIndex={isSelected ? 500 : 100}
        title={`${vessel.name}${vessel.imo ? ` (IMO ${vessel.imo})` : ''}`}
        onClick={() => onSelect(vessel.id)}
      >
        <div className="flex flex-col items-center -translate-y-1/2 cursor-pointer select-none">
          <div
            className="flex items-center justify-center rounded-full bg-slate-950/90 transition-transform hover:scale-110"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              border: `2.5px solid ${fill}`,
              boxShadow: isSelected
                ? '0 0 0 5px rgba(245,158,11,0.45), 0 4px 12px rgba(0,0,0,0.55)'
                : '0 2px 8px rgba(0,0,0,0.5)',
            }}
          >
            <svg
              width={Math.round(size * 0.6)}
              height={Math.round(size * 0.6)}
              viewBox="0 0 24 24"
              style={{ transform: `rotate(${heading}deg)` }}
              fill={fill}
            >
              <path
                d="M12 2L19 20L12 16L5 20L12 2Z"
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="mt-1 px-1.5 py-0.5 rounded bg-slate-950/85 border border-white/20 text-[10px] font-mono font-bold text-white whitespace-nowrap shadow-md">
            {vessel.name}
          </div>
        </div>
      </AdvancedMarker>

      {isInfoOpen && marker && (
        <InfoWindow anchor={marker} maxWidth={300} onCloseClick={onCloseInfo}>
          <div className="min-w-[230px] text-xs text-slate-900 leading-snug space-y-2 p-0.5">
            <div>
              <div className="font-bold text-sm text-slate-950">{vessel.name}</div>
              <div className="text-[11px] font-mono text-slate-500">
                {vessel.imo ? `IMO ${vessel.imo}` : ''}
                {vessel.imo && vessel.mmsi ? ' · ' : ''}
                {vessel.mmsi ? `MMSI ${vessel.mmsi}` : ''}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 bg-slate-50 border border-slate-200 rounded-md p-2">
              <div>
                <span className="block text-[10px] text-slate-500 uppercase">Speed</span>
                <strong className="font-mono text-slate-950">{speedText}</strong>
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 uppercase">Course</span>
                <strong className="font-mono text-slate-950">{courseText}</strong>
              </div>
              <div className="col-span-2">
                <span className="block text-[10px] text-slate-500 uppercase">Destination</span>
                <strong className="font-mono text-slate-950">{destText}</strong>
              </div>
              <div className="col-span-2">
                <span className="block text-[10px] text-slate-500 uppercase">Reported ETA</span>
                <strong className="font-mono text-slate-950">{etaText}</strong>
              </div>
            </div>

            <div className="text-[11px] text-slate-700 space-y-0.5">
              <div>
                <strong>Coordinates:</strong>{' '}
                <span className="font-mono">
                  {lat.toFixed(4)}°, {lng.toFixed(4)}°
                </span>
              </div>
              <div>
                <strong>Status:</strong>{' '}
                {isManual
                  ? vessel.manualStatus || 'Manual Position'
                  : formatNavigationalStatus(vessel.navStatus)}
              </div>
              <div>
                <strong>Signal:</strong> {freshness.label}
              </div>
              <div className="text-[10px] text-slate-500 pt-0.5">Updated: {updatedText}</div>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

interface CameraControllerProps {
  positionedVessels: PositionedVessel[];
  selectedVesselId?: string | null;
  fitRequestNonce: number;
}

function VesselMapCameraController({
  positionedVessels,
  selectedVesselId,
  fitRequestNonce,
}: CameraControllerProps) {
  const map = useMap();

  const fitFleet = useCallback(() => {
    if (!map) return;
    if (positionedVessels.length === 0) {
      map.panTo(DEFAULT_CENTER);
      map.setZoom(DEFAULT_ZOOM);
      return;
    }
    if (positionedVessels.length === 1) {
      const only = positionedVessels[0];
      map.panTo({ lat: only.lat, lng: only.lng });
      map.setZoom(10);
      return;
    }
    let north = -90;
    let south = 90;
    let east = -180;
    let west = 180;
    positionedVessels.forEach((v) => {
      if (v.lat > north) north = v.lat;
      if (v.lat < south) south = v.lat;
      if (v.lng > east) east = v.lng;
      if (v.lng < west) west = v.lng;
    });
    map.fitBounds({ north, south, east, west }, 64);
  }, [map, positionedVessels]);

  // Smoothly focus selected vessel (or frame fleet when none selected)
  useEffect(() => {
    if (!map) return;
    if (selectedVesselId) {
      const target = positionedVessels.find((v) => v.vessel.id === selectedVesselId);
      if (target) {
        map.panTo({ lat: target.lat, lng: target.lng });
        const currentZoom = map.getZoom() ?? DEFAULT_ZOOM;
        if (currentZoom < 9) {
          map.setZoom(10);
        }
        return;
      }
    }
    fitFleet();
  }, [map, positionedVessels, selectedVesselId, fitFleet]);

  // Explicit "Fit Fleet" button click
  useEffect(() => {
    if (fitRequestNonce === 0) return;
    fitFleet();
  }, [fitRequestNonce, fitFleet]);

  return null;
}

const MAP_STYLE_OPTIONS: Array<{
  id: GoogleMapTypeId;
  label: string;
  title: string;
  Icon: typeof Satellite;
}> = [
  { id: 'hybrid', label: 'Satellite', title: 'Google Satellite imagery with port & ocean labels', Icon: Satellite },
  { id: 'satellite', label: 'Clean Sat', title: 'Pure Google Satellite imagery without labels', Icon: Globe },
  { id: 'terrain', label: 'Terrain', title: 'Google Terrain topography map', Icon: Mountain },
  { id: 'roadmap', label: 'Map', title: 'Google standard road & coastal map', Icon: MapIcon },
];

export function VesselLeafletMap({
  vessels,
  selectedVesselId,
  onSelectVessel,
  heightClass = 'h-[460px]',
}: VesselLeafletMapProps) {
  const [mapTypeId, setMapTypeId] = useState<GoogleMapTypeId>('hybrid');
  const [openInfoVesselId, setOpenInfoVesselId] = useState<string | null>(selectedVesselId || null);
  const [fitNonce, setFitNonce] = useState(0);

  const positionedVessels = useMemo<PositionedVessel[]>(() => {
    return vessels
      .map((vessel) => {
        const coords = getVesselCoordinates(vessel);
        return coords ? { vessel, ...coords } : null;
      })
      .filter((item): item is PositionedVessel => Boolean(item));
  }, [vessels]);

  useEffect(() => {
    if (selectedVesselId) {
      setOpenInfoVesselId(selectedVesselId);
    }
  }, [selectedVesselId]);

  const handleSelect = useCallback(
    (vesselId: string) => {
      setOpenInfoVesselId(vesselId);
      onSelectVessel?.(vesselId);
    },
    [onSelectVessel]
  );

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div
        className={`relative rounded-xl overflow-hidden border border-slate-200 bg-slate-950 text-white flex items-center justify-center p-6 text-center ${heightClass}`}
      >
        <div className="max-w-md space-y-2">
          <Layers className="w-8 h-8 text-amber-400 mx-auto" />
          <div className="text-sm font-bold">Google Maps Satellite API Key Required</div>
          <p className="text-xs text-slate-300">
            Configure <span className="font-mono text-amber-300">VITE_GOOGLE_MAPS_API_KEY</span> in
            your environment secrets to load live Google Maps satellite imagery.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-950">
      <div className={`w-full ${heightClass}`}>
        <APIProvider
          apiKey={GOOGLE_MAPS_API_KEY}
          libraries={['marker']}
          language="en"
          region="JP"
        >
          <GoogleMap
            mapId="DEMO_MAP_ID"
            mapTypeId={mapTypeId}
            defaultCenter={DEFAULT_CENTER}
            defaultZoom={DEFAULT_ZOOM}
            minZoom={2}
            maxZoom={20}
            gestureHandling="greedy"
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl={true}
            zoomControl={true}
            scaleControl={true}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            className="w-full h-full"
          >
            <VesselMapCameraController
              positionedVessels={positionedVessels}
              selectedVesselId={selectedVesselId}
              fitRequestNonce={fitNonce}
            />

            {positionedVessels.map((item) => (
              <VesselMarkerItem
                key={item.vessel.id}
                item={item}
                isSelected={item.vessel.id === selectedVesselId}
                isInfoOpen={item.vessel.id === openInfoVesselId}
                onSelect={handleSelect}
                onCloseInfo={() => setOpenInfoVesselId(null)}
              />
            ))}
          </GoogleMap>
        </APIProvider>
      </div>

      {/* Top-left Google Satellite Layer Switcher */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1 bg-slate-950/85 backdrop-blur-md p-1 rounded-lg border border-white/15 shadow-lg">
        {MAP_STYLE_OPTIONS.map(({ id, label, title, Icon }) => {
          const active = mapTypeId === id;
          return (
            <button
              key={id}
              type="button"
              title={title}
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

      {/* Top-right Fit Fleet Control (offset left of Google Fullscreen control) */}
      <div className="absolute top-3 right-14 z-10">
        <button
          type="button"
          onClick={() => setFitNonce((n) => n + 1)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold bg-slate-950/85 backdrop-blur-md text-white border border-white/15 hover:bg-slate-900 rounded-lg shadow-lg cursor-pointer"
          title="Fit all tracked vessels in view"
        >
          <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
          Fit Fleet
        </button>
      </div>

      {/* Empty Coordinates Overlay */}
      {positionedVessels.length === 0 && (
        <div className="absolute bottom-7 left-3 z-10 max-w-md bg-slate-950/90 backdrop-blur text-white px-3.5 py-2.5 rounded-lg border border-slate-700 text-xs">
          <div className="font-semibold text-amber-400">Live Satellite Map Ready</div>
          <p className="text-[11px] text-slate-300 mt-0.5">
            Enter a vessel IMO number, MMSI, or ship name above to locate and zoom directly onto
            its live ocean position in Google Satellite view.
          </p>
        </div>
      )}
    </div>
  );
}
