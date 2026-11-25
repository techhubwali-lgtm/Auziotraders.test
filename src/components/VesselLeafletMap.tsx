import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Maximize2 } from 'lucide-react';
import {
  formatNavigationalStatus,
  getVesselFreshness,
} from '../services/vesselTrackingService';
import type { RegisteredVessel } from '../types/portal';

interface VesselLeafletMapProps {
  vessels: RegisteredVessel[];
  selectedVesselId?: string | null;
  onSelectVessel?: (vesselId: string) => void;
  heightClass?: string;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getVesselCoordinates(vessel: RegisteredVessel): {
  lat: number;
  lon: number;
  isManual: boolean;
} | null {
  if (
    typeof vessel.latitude === 'number' &&
    typeof vessel.longitude === 'number' &&
    Number.isFinite(vessel.latitude) &&
    Number.isFinite(vessel.longitude)
  ) {
    return { lat: vessel.latitude, lon: vessel.longitude, isManual: false };
  }
  if (
    typeof vessel.manualLatitude === 'number' &&
    typeof vessel.manualLongitude === 'number' &&
    Number.isFinite(vessel.manualLatitude) &&
    Number.isFinite(vessel.manualLongitude)
  ) {
    return { lat: vessel.manualLatitude, lon: vessel.manualLongitude, isManual: true };
  }
  return null;
}

function buildShipIcon(vessel: RegisteredVessel, isSelected: boolean): L.DivIcon {
  const freshness = getVesselFreshness(vessel);
  const heading =
    typeof vessel.headingDeg === 'number'
      ? vessel.headingDeg
      : typeof vessel.courseDeg === 'number'
        ? vessel.courseDeg
        : 0;

  let fill = '#059669'; // live emerald
  if (freshness.status === 'stale') fill = '#d97706'; // amber
  else if (freshness.status === 'outdated') fill = '#dc2626'; // red
  else if (freshness.status === 'manual_only') fill = '#2563eb'; // blue
  else if (freshness.status === 'no_signal') fill = '#64748b'; // slate

  const size = isSelected ? 38 : 30;
  const ring = isSelected ? 'box-shadow: 0 0 0 4px rgba(245,158,11,0.45);' : '';

  const html = `
    <div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;border-radius:9999px;background:rgba(15,23,42,0.92);border:2px solid ${fill};${ring}transition:transform 0.2s;">
      <svg width="${Math.round(size * 0.62)}" height="${Math.round(size * 0.62)}" viewBox="0 0 24 24" style="transform:rotate(${heading}deg);" fill="${fill}">
        <path d="M12 2L19 20L12 16L5 20L12 2Z" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round" />
      </svg>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'auzio-vessel-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export function VesselLeafletMap({
  vessels,
  selectedVesselId,
  onSelectVessel,
  heightClass = 'h-[460px]',
}: VesselLeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const seamarkLayerRef = useRef<L.TileLayer | null>(null);
  const [showSeamarks, setShowSeamarks] = useState(true);

  const positionedVessels = useMemo(() => {
    return vessels
      .map((vessel) => {
        const coords = getVesselCoordinates(vessel);
        return coords ? { vessel, ...coords } : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [vessels]);

  // Initialize Leaflet map instance
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [20, 95], // Centered over Indo-Pacific Japan -> Africa / Oceania export sea lanes
      zoom: 3,
      minZoom: 2,
      maxZoom: 18,
      worldCopyJump: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    const seamarks = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
      attribution:
        'Sea marks &copy; <a href="https://www.openseamap.org/" target="_blank" rel="noopener noreferrer">OpenSeaMap</a>',
      opacity: 0.75,
      maxZoom: 18,
    });
    seamarks.addTo(map);
    seamarkLayerRef.current = seamarks;

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapRef.current = map;

    // Ensure proper tile sizing after flex/grid layout paint
    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      seamarkLayerRef.current = null;
    };
  }, []);

  // Toggle OpenSeaMap navigational seamark overlay
  useEffect(() => {
    const map = mapRef.current;
    const seamarks = seamarkLayerRef.current;
    if (!map || !seamarks) return;
    if (showSeamarks) {
      if (!map.hasLayer(seamarks)) seamarks.addTo(map);
    } else if (map.hasLayer(seamarks)) {
      map.removeLayer(seamarks);
    }
  }, [showSeamarks]);

  // Render vessel markers & popups
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    positionedVessels.forEach(({ vessel, lat, lon, isManual }) => {
      const isSelected = vessel.id === selectedVesselId;
      const freshness = getVesselFreshness(vessel);
      const marker = L.marker([lat, lon], {
        icon: buildShipIcon(vessel, isSelected),
        zIndexOffset: isSelected ? 500 : 100,
      });

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

      const popupHtml = `
        <div style="min-width:230px;font-family:system-ui,-apple-system,sans-serif;font-size:12px;color:#0f172a;line-height:1.45;">
          <div style="font-weight:700;font-size:13px;margin-bottom:4px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <span>${escapeHtml(vessel.name)}</span>
          </div>
          <div style="font-size:11px;color:#475569;margin-bottom:6px;font-family:ui-monospace,monospace;">
            MMSI: ${escapeHtml(vessel.mmsi)}${vessel.imo ? ` · IMO: ${escapeHtml(vessel.imo)}` : ''}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 8px;margin-bottom:6px;">
            <div><span style="color:#64748b;font-size:10px;display:block;">SPEED</span><strong>${escapeHtml(speedText)}</strong></div>
            <div><span style="color:#64748b;font-size:10px;display:block;">COURSE</span><strong>${escapeHtml(courseText)}</strong></div>
            <div><span style="color:#64748b;font-size:10px;display:block;">DESTINATION</span><strong>${escapeHtml(destText)}</strong></div>
            <div><span style="color:#64748b;font-size:10px;display:block;">REPORTED ETA</span><strong>${escapeHtml(etaText)}</strong></div>
          </div>
          <div style="font-size:11px;color:#334155;">
            <div><strong>Status:</strong> ${escapeHtml(isManual ? vessel.manualStatus || 'Manual Position' : formatNavigationalStatus(vessel.navStatus))}</div>
            <div><strong>Signal:</strong> ${escapeHtml(freshness.label)}</div>
            <div style="color:#64748b;font-size:10px;margin-top:3px;">Updated: ${escapeHtml(updatedText)}</div>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 290 });
      marker.on('click', () => {
        onSelectVessel?.(vessel.id);
      });
      marker.addTo(layer);

      if (isSelected) {
        marker.openPopup();
      }
    });

    if (selectedVesselId) {
      const target = positionedVessels.find((v) => v.vessel.id === selectedVesselId);
      if (target) {
        map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), 6), { duration: 0.9 });
      }
    } else if (positionedVessels.length === 1) {
      const only = positionedVessels[0];
      map.setView([only.lat, only.lon], 6);
    } else if (positionedVessels.length > 1) {
      const bounds = L.latLngBounds(positionedVessels.map((v) => [v.lat, v.lon] as [number, number]));
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 7 });
    }
  }, [positionedVessels, selectedVesselId, onSelectVessel]);

  const handleFitAll = () => {
    const map = mapRef.current;
    if (!map) return;
    if (positionedVessels.length === 0) {
      map.setView([20, 95], 3);
      return;
    }
    if (positionedVessels.length === 1) {
      map.flyTo([positionedVessels[0].lat, positionedVessels[0].lon], 6, { duration: 0.7 });
      return;
    }
    const bounds = L.latLngBounds(positionedVessels.map((v) => [v.lat, v.lon] as [number, number]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 7 });
  };

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
      <div ref={mapContainerRef} className={`w-full ${heightClass} z-0`} />

      {/* Top-right Map Controls */}
      <div className="absolute top-3 right-3 z-[400] flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowSeamarks((s) => !s)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg shadow-sm border transition-colors cursor-pointer ${
            showSeamarks
              ? 'bg-slate-900 text-white border-slate-700'
              : 'bg-white/95 text-slate-700 border-slate-300 hover:bg-white'
          }`}
          title="Toggle OpenSeaMap Maritime Seamarks"
        >
          <Layers className="w-3.5 h-3.5" />
          Sea Marks
        </button>
        <button
          type="button"
          onClick={handleFitAll}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold bg-white/95 text-slate-800 border border-slate-300 hover:bg-white rounded-lg shadow-sm cursor-pointer"
          title="Fit all tracked vessels"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          Fit Fleet
        </button>
      </div>

      {/* Empty Coordinates Overlay */}
      {positionedVessels.length === 0 && (
        <div className="absolute bottom-3 left-3 z-[400] max-w-md bg-slate-950/90 backdrop-blur text-white px-3.5 py-2.5 rounded-lg border border-slate-700 text-xs">
          <div className="font-semibold text-amber-400">Awaiting Real AIS Vessel Coordinates</div>
          <p className="text-[11px] text-slate-300 mt-0.5">
            No registered vessels currently have a live AIS or manual coordinate fix. Coordinates
            appear automatically once AISStream broadcasts arrive or an operations coordinator posts
            a manual checkpoint.
          </p>
        </div>
      )}
    </div>
  );
}
