import { CheckCircle2, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { AUCTION_MARK_LEGEND } from '../data/ports';
import type { AuctionReport, BodyPanelKey } from '../types/portal';

interface AuctionSheetPanelProps {
  report: AuctionReport;
  stockCode: string;
  chassisCode: string;
}

const PANEL_COORDS: Record<
  BodyPanelKey,
  { label: string; x: number; y: number }
> = {
  frontBumper: { label: 'Front Bumper', x: 150, y: 24 },
  hood: { label: 'Bonnet / Hood', x: 150, y: 72 },
  roof: { label: 'Roof Panel', x: 150, y: 152 },
  rearBumper: { label: 'Rear Bumper', x: 150, y: 274 },
  frontLeftFender: { label: 'Front Left Fender', x: 56, y: 68 },
  frontLeftDoor: { label: 'Front Left Door', x: 56, y: 128 },
  rearLeftDoor: { label: 'Rear Left Door', x: 56, y: 186 },
  rearLeftQuarter: { label: 'Rear Left Quarter', x: 56, y: 238 },
  frontRightFender: { label: 'Front Right Fender', x: 244, y: 68 },
  frontRightDoor: { label: 'Front Right Door', x: 244, y: 128 },
  rearRightDoor: { label: 'Rear Right Door', x: 244, y: 186 },
  rearRightQuarter: { label: 'Rear Right Quarter', x: 244, y: 238 },
};

export function AuctionSheetPanel({
  report,
  stockCode,
  chassisCode,
}: AuctionSheetPanelProps) {
  const markedEntries = (
    Object.entries(report.panelMarks || {}) as [BodyPanelKey, string][]
  ).filter(([, code]) => Boolean(code && code.trim()));

  const [selectedPanel, setSelectedPanel] = useState<BodyPanelKey | null>(
    markedEntries.length > 0 ? markedEntries[0][0] : null
  );

  const selectedCode = selectedPanel ? report.panelMarks?.[selectedPanel] : null;
  const selectedDefinition = selectedCode
    ? AUCTION_MARK_LEGEND[selectedCode] || 'Minor cosmetic notation logged by auction inspector'
    : null;

  const mechanicalRows = [
    { label: 'Engine & Idle', value: report.mechanicalStatus.engine },
    { label: 'Transmission & Drive', value: report.mechanicalStatus.transmission },
    { label: 'Suspension & Steering', value: report.mechanicalStatus.suspension },
    { label: 'Air Conditioning', value: report.mechanicalStatus.airConditioning },
    { label: 'Chassis & Frame', value: report.mechanicalStatus.frame },
  ];

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/70">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Japanese Auction Grade Sheet & Inspection Report
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">
            {report.auctionHouse} · Lot #{report.lotNumber} · Inspected {report.inspectionDate}
          </p>
        </div>
        <div className="flex items-center gap-6 font-mono tabular-nums">
          <div className="text-right">
            <div className="text-[11px] text-slate-500">Exterior Grade</div>
            <div className="text-xl font-bold text-slate-950">{report.exteriorGrade}</div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="text-right">
            <div className="text-[11px] text-slate-500">Interior Grade</div>
            <div className="text-xl font-bold text-slate-950">{report.interiorGrade}</div>
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Interactive Top-Down Body Condition Schematic */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Exterior Body Condition Diagram
            </h3>
            <span className="text-xs font-mono text-slate-500">
              {markedEntries.length} panel {markedEntries.length === 1 ? 'note' : 'notes'}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col items-center">
            <svg
              viewBox="0 0 300 300"
              className="w-full max-w-[240px] h-auto"
              role="img"
              aria-label={`Exterior inspection body diagram for ${stockCode}`}
            >
              {/* Vehicle Top-Down Silhouette */}
              <rect
                x="76"
                y="26"
                width="148"
                height="248"
                rx="34"
                fill="#ffffff"
                stroke="#334155"
                strokeWidth="2"
              />
              {/* Windshield */}
              <path
                d="M92 98 Q150 86 208 98 L198 126 Q150 118 102 126 Z"
                fill="#e2e8f0"
                stroke="#64748b"
                strokeWidth="1.2"
              />
              {/* Rear Glass */}
              <path
                d="M102 204 Q150 212 198 204 L206 232 Q150 242 94 232 Z"
                fill="#e2e8f0"
                stroke="#64748b"
                strokeWidth="1.2"
              />
              {/* Cabin Roof Outline */}
              <rect
                x="100"
                y="126"
                width="100"
                height="78"
                rx="10"
                fill="#f8fafc"
                stroke="#94a3b8"
                strokeWidth="1.2"
              />
              {/* Side Door Dividers */}
              <line x1="76" y1="158" x2="100" y2="158" stroke="#94a3b8" strokeWidth="1.2" />
              <line x1="200" y1="158" x2="224" y2="158" stroke="#94a3b8" strokeWidth="1.2" />
              <line x1="76" y1="100" x2="96" y2="100" stroke="#94a3b8" strokeWidth="1.2" />
              <line x1="204" y1="100" x2="224" y2="100" stroke="#94a3b8" strokeWidth="1.2" />
              <line x1="76" y1="214" x2="98" y2="214" stroke="#94a3b8" strokeWidth="1.2" />
              <line x1="202" y1="214" x2="224" y2="214" stroke="#94a3b8" strokeWidth="1.2" />
              {/* Front / Rear labels */}
              <text
                x="150"
                y="14"
                textAnchor="middle"
                fontSize="9"
                fill="#64748b"
                fontFamily="JetBrains Mono, monospace"
              >
                FRONT
              </text>
              <text
                x="150"
                y="294"
                textAnchor="middle"
                fontSize="9"
                fill="#64748b"
                fontFamily="JetBrains Mono, monospace"
              >
                REAR
              </text>

              {/* Interactive Panel Markers */}
              {markedEntries.map(([panelKey, markCode]) => {
                const coord = PANEL_COORDS[panelKey];
                if (!coord) return null;
                const isSelected = selectedPanel === panelKey;
                return (
                  <g
                    key={panelKey}
                    onClick={() => setSelectedPanel(panelKey)}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={coord.x}
                      cy={coord.y}
                      r={isSelected ? 15 : 13}
                      fill={isSelected ? '#d97706' : '#0f172a'}
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <text
                      x={coord.x}
                      y={coord.y + 3.5}
                      textAnchor="middle"
                      fontSize="9.5"
                      fontWeight="700"
                      fill="#ffffff"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {markCode}
                    </text>
                  </g>
                );
              })}
            </svg>

            {selectedPanel && selectedCode ? (
              <div className="w-full mt-3 pt-3 border-t border-slate-200 text-left">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900">
                    {PANEL_COORDS[selectedPanel]?.label}
                  </span>
                  <span className="font-mono font-bold text-amber-700">
                    Code {selectedCode}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">{selectedDefinition}</p>
              </div>
            ) : (
              <div className="w-full mt-3 pt-3 border-t border-slate-200 text-xs text-emerald-700 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>No exterior body panel flaws recorded on auction sheet.</span>
              </div>
            )}
          </div>

          <div className="mt-3 text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-1 font-mono">
            <span>A1: Minor Scratch</span>
            <span>·</span>
            <span>U1: Small Dimple</span>
            <span>·</span>
            <span>W1: Paint Blend</span>
            <span>·</span>
            <span>XX: Replaced Panel</span>
          </div>
        </div>

        {/* Mechanical Checklist & Inspector Notes */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Mechanical & Structural Verification
              </h3>
              <span className="text-xs font-mono text-slate-500">
                Chassis {chassisCode}
              </span>
            </div>

            <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
              {mechanicalRows.map((row) => (
                <div
                  key={row.label}
                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm"
                >
                  <span className="text-slate-600 font-medium">{row.label}</span>
                  <span className="text-slate-900 font-mono text-xs inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 mb-1.5">
              <ClipboardCheck className="w-4 h-4 text-slate-600" />
              <span>Export Inspector Summary</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              {report.inspectorNotes ||
                'Verified odometer reading and accident-free frame confirmed prior to yard release.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
