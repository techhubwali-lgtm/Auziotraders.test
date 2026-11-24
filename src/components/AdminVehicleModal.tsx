import { ImagePlus, Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { compressVehicleImage } from '../lib/imageCompressor';
import { saveVehicle } from '../services/firestoreService';
import type {
  BodyPanelKey,
  BodyType,
  DrivetrainType,
  FuelType,
  ListingType,
  OriginPort,
  SteeringType,
  TransmissionType,
  Vehicle,
  VehicleStatus,
} from '../types/portal';

interface AdminVehicleModalProps {
  vehicle: Vehicle | null;
  isImportMode?: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const EDITABLE_PANELS: { key: BodyPanelKey; label: string }[] = [
  { key: 'frontBumper', label: 'Front Bumper' },
  { key: 'hood', label: 'Bonnet / Hood' },
  { key: 'frontLeftDoor', label: 'Front Left Door' },
  { key: 'rearLeftDoor', label: 'Rear Left Door' },
  { key: 'frontRightDoor', label: 'Front Right Door' },
  { key: 'rearRightDoor', label: 'Rear Right Door' },
  { key: 'rearBumper', label: 'Rear Bumper' },
];

const MARK_OPTIONS = ['', 'A1', 'A2', 'U1', 'U2', 'W1', 'W2', 'XX', 'S1'];

export function AdminVehicleModal({
  vehicle,
  isImportMode = false,
  onClose,
  onSaved,
}: AdminVehicleModalProps) {
  const [stockCode, setStockCode] = useState(
    vehicle?.stockCode || `AUZ-JP-${Math.floor(1050 + Math.random() * 8900)}`
  );
  const [listingType, setListingType] = useState<ListingType>(
    vehicle?.listingType || 'auzio_stock'
  );
  const [auctionDate, setAuctionDate] = useState(vehicle?.auctionDate || '');
  const [make, setMake] = useState(vehicle?.make || 'Toyota');
  const [model, setModel] = useState(vehicle?.model || '');
  const [trim, setTrim] = useState(vehicle?.trim || '');
  const [year, setYear] = useState(vehicle?.year || 2021);
  const [chassisCode, setChassisCode] = useState(vehicle?.chassisCode || '');
  const [mileageKm, setMileageKm] = useState(vehicle?.mileageKm || 35000);
  const [engineCc, setEngineCc] = useState(vehicle?.engineCc || 2000);
  const [fuelType, setFuelType] = useState<FuelType>(vehicle?.fuelType || 'Petrol');
  const [transmission, setTransmission] = useState<TransmissionType>(
    vehicle?.transmission || 'Automatic'
  );
  const [drivetrain, setDrivetrain] = useState<DrivetrainType>(
    vehicle?.drivetrain || '4WD'
  );
  const [steering, setSteering] = useState<SteeringType>(vehicle?.steering || 'RHD');
  const [exteriorColor, setExteriorColor] = useState(
    vehicle?.exteriorColor || 'Pearl White'
  );
  const [bodyType, setBodyType] = useState<BodyType>(vehicle?.bodyType || 'SUV');
  const [originPort, setOriginPort] = useState<OriginPort>(
    vehicle?.originPort || 'Yokohama'
  );
  const [volumeM3, setVolumeM3] = useState(vehicle?.volumeM3 || 15.2);
  const [fobPriceUsd, setFobPriceUsd] = useState(vehicle?.fobPriceUsd || 16500);
  const [status, setStatus] = useState<VehicleStatus>(vehicle?.status || 'available');
  const [featured, setFeatured] = useState(Boolean(vehicle?.featured));
  const [images, setImages] = useState<string[]>(
    vehicle?.images?.length
      ? vehicle.images
      : ['/src/assets/images/car_landcruiser_prado_1795453395370.jpg']
  );
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [featuresText, setFeaturesText] = useState(
    vehicle?.features?.join('\n') || 'Smart Key & Push Start\nReverse Camera\nAlloy Wheels'
  );

  // Auction Report fields
  const [exteriorGrade, setExteriorGrade] = useState(
    vehicle?.auctionReport?.exteriorGrade || '4.5'
  );
  const [interiorGrade, setInteriorGrade] = useState(
    vehicle?.auctionReport?.interiorGrade || 'B'
  );
  const [auctionHouse, setAuctionHouse] = useState(
    vehicle?.auctionReport?.auctionHouse || 'USS Tokyo'
  );
  const [lotNumber, setLotNumber] = useState(
    vehicle?.auctionReport?.lotNumber || '45210'
  );
  const [inspectionDate, setInspectionDate] = useState(
    vehicle?.auctionReport?.inspectionDate || new Date().toISOString().slice(0, 10)
  );
  const [inspectorNotes, setInspectorNotes] = useState(
    vehicle?.auctionReport?.inspectorNotes ||
      'Verified odometer and clean accident-free frame confirmed at yard inspection.'
  );
  const [engineNote, setEngineNote] = useState(
    vehicle?.auctionReport?.mechanicalStatus?.engine || 'Pass — Clean idle, no leaks'
  );
  const [transNote, setTransNote] = useState(
    vehicle?.auctionReport?.mechanicalStatus?.transmission || 'Pass — Smooth shifting'
  );
  const [suspNote, setSuspNote] = useState(
    vehicle?.auctionReport?.mechanicalStatus?.suspension || 'Pass — Factory tight'
  );
  const [acNote, setAcNote] = useState(
    vehicle?.auctionReport?.mechanicalStatus?.airConditioning || 'Pass — Cold output'
  );
  const [frameNote, setFrameNote] = useState(
    vehicle?.auctionReport?.mechanicalStatus?.frame || 'Pass — Original frame rails'
  );
  const [panelMarks, setPanelMarks] = useState<Partial<Record<BodyPanelKey, string>>>(
    vehicle?.auctionReport?.panelMarks || { frontBumper: 'A1' }
  );

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError('');
    setUploading(true);
    try {
      const remaining = Math.max(0, 6 - images.length);
      const batch = Array.from(files).slice(0, remaining);
      const compressed: string[] = [];
      for (const file of batch) {
        const url = await compressVehicleImage(file);
        compressed.push(url);
      }
      setImages((prev) => [...prev, ...compressed].slice(0, 6));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compress uploaded image.');
    } finally {
      setUploading(false);
    }
  };

  const handleAddUrl = () => {
    const cleaned = imageUrlInput.trim();
    if (!cleaned) return;
    if (images.length >= 6) {
      setError('Maximum 6 photos allowed per vehicle.');
      return;
    }
    setImages((prev) => [...prev, cleaned]);
    setImageUrlInput('');
  };

  const handlePanelChange = (key: BodyPanelKey, val: string) => {
    setPanelMarks((prev) => {
      const next = { ...prev };
      if (!val) {
        delete next[key];
      } else {
        next[key] = val;
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!stockCode.trim() || !make.trim() || !model.trim() || !chassisCode.trim()) {
      setError('Stock Code, Make, Model, and Chassis Code are required.');
      return;
    }
    if (images.length === 0) {
      setError('Please include at least one vehicle photo.');
      return;
    }

    setSaving(true);
    try {
      const sanitizedStock = stockCode
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, '')
        .slice(0, 32);
      const safeStockCode = sanitizedStock.length >= 3 ? sanitizedStock : `AUC-${Date.now().toString().slice(-6)}`;
      const safeChassis =
        chassisCode.trim().length >= 3 ? chassisCode.trim().slice(0, 40) : `JP-${safeStockCode}`;

      await saveVehicle(
        {
          stockCode: safeStockCode,
          listingType,
          auctionDate: auctionDate.slice(0, 32),
          make: make.trim().slice(0, 40),
          model: model.trim().slice(0, 60),
          trim: trim.trim().slice(0, 60),
          year: Math.max(1985, Math.min(2027, Math.round(Number(year)))),
          chassisCode: safeChassis,
          mileageKm: Math.max(0, Math.min(999999, Math.round(Number(mileageKm)))),
          engineCc: Math.max(500, Math.min(10000, Math.round(Number(engineCc)))),
          fuelType,
          transmission,
          drivetrain,
          steering,
          exteriorColor: (exteriorColor.trim() || 'Metallic').slice(0, 40),
          bodyType,
          originPort,
          volumeM3: Math.max(5, Math.min(40, Number(volumeM3))),
          fobPriceUsd: Math.max(500, Math.min(500000, Number(fobPriceUsd))),
          status,
          featured,
          images: images.slice(0, 6),
          features: featuresText
            .split('\n')
            .map((line) => line.trim().slice(0, 80))
            .filter(Boolean)
            .slice(0, 20),
          auctionReport: {
            exteriorGrade: (exteriorGrade || '4').slice(0, 10),
            interiorGrade: (interiorGrade || 'B').slice(0, 10),
            auctionHouse: (auctionHouse.trim() || 'USS Tokyo').slice(0, 60),
            lotNumber: (lotNumber.trim() || '0000').slice(0, 30),
            inspectionDate: (inspectionDate || new Date().toISOString().slice(0, 10)).slice(0, 24),
            inspectorNotes: inspectorNotes.slice(0, 600),
            mechanicalStatus: {
              engine: (engineNote.trim() || 'Pass').slice(0, 120),
              transmission: (transNote.trim() || 'Pass').slice(0, 120),
              suspension: (suspNote.trim() || 'Pass').slice(0, 120),
              airConditioning: (acNote.trim() || 'Pass').slice(0, 120),
              frame: (frameNote.trim() || 'Pass').slice(0, 120),
            },
            panelMarks,
          },
        },
        isImportMode ? undefined : vehicle?.id,
        isImportMode ? undefined : vehicle?.createdAt
      );
      onSaved(
        isImportMode
          ? `Imported live auction lot ${safeStockCode} into Firestore inventory`
          : vehicle
            ? `Updated ${safeStockCode}`
            : `Added ${safeStockCode} to live stock`
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? 'Failed to save vehicle. Verify all fields and admin permissions.'
          : 'Save error.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs overflow-y-auto p-4 sm:p-6 flex items-start justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={vehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
    >
      <div className="w-full max-w-4xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden my-6">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">
              {isImportMode && vehicle
                ? `Import Live Auction Lot to Firestore — ${vehicle.stockCode}`
                : vehicle
                  ? `Edit Vehicle — ${vehicle.stockCode}`
                  : 'Add Export Vehicle to Inventory'}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              {isImportMode
                ? 'Imported from auc.auziotraders.com — review specs, FOB, and volume before publishing to Firestore'
                : 'Saved directly to live cloud inventory with automatic CIF calculations'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8 max-h-[82vh] overflow-y-auto">
          {/* Section 1: Core Specs */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-500 border-b border-slate-200 pb-2">
              1. Core Identification & Pricing
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Listing Source Type *
                </label>
                <select
                  value={listingType}
                  onChange={(e) => setListingType(e.target.value as ListingType)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                >
                  <option value="auzio_stock">Auzio Physical Stock</option>
                  <option value="auction_listing">Auction Listing — Not Yet Purchased</option>
                  <option value="partner_stock">Supplier / Partner Stock</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Auction Date / Venue (if auction lot)
                </label>
                <input
                  type="text"
                  value={auctionDate}
                  onChange={(e) => setAuctionDate(e.target.value)}
                  placeholder="2026-12-02 (USS Yokohama)"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Stock Code *
                </label>
                <input
                  type="text"
                  required
                  value={stockCode}
                  onChange={(e) => setStockCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Make *</label>
                <input
                  type="text"
                  required
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Model *</label>
                <input
                  type="text"
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Land Cruiser Prado"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Grade / Trim
                </label>
                <input
                  type="text"
                  value={trim}
                  onChange={(e) => setTrim(e.target.value)}
                  placeholder="TX-L Package"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Chassis / VIN *
                </label>
                <input
                  type="text"
                  required
                  value={chassisCode}
                  onChange={(e) => setChassisCode(e.target.value.toUpperCase())}
                  placeholder="GDJ150W-0048219"
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  FOB Price (USD) *
                </label>
                <input
                  type="number"
                  required
                  min={500}
                  max={500000}
                  value={fobPriceUsd}
                  onChange={(e) => setFobPriceUsd(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Year</label>
                <input
                  type="number"
                  min={1985}
                  max={2027}
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mileage (km)
                </label>
                <input
                  type="number"
                  min={0}
                  max={999999}
                  value={mileageKm}
                  onChange={(e) => setMileageKm(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Engine (cc)
                </label>
                <input
                  type="number"
                  min={500}
                  max={10000}
                  value={engineCc}
                  onChange={(e) => setEngineCc(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Volume (m³)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={5}
                  max={40}
                  value={volumeM3}
                  onChange={(e) => setVolumeM3(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Fuel</label>
                <select
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value as FuelType)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                >
                  <option value="Petrol">Petrol</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Electric">Electric</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Transmission
                </label>
                <select
                  value={transmission}
                  onChange={(e) => setTransmission(e.target.value as TransmissionType)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                >
                  <option value="Automatic">Automatic</option>
                  <option value="CVT">CVT</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Drivetrain</label>
                <select
                  value={drivetrain}
                  onChange={(e) => setDrivetrain(e.target.value as DrivetrainType)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                >
                  <option value="4WD">4WD</option>
                  <option value="AWD">AWD</option>
                  <option value="2WD">2WD</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Steering</label>
                <select
                  value={steering}
                  onChange={(e) => setSteering(e.target.value as SteeringType)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                >
                  <option value="RHD">RHD</option>
                  <option value="LHD">LHD</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Body Type</label>
                <select
                  value={bodyType}
                  onChange={(e) => setBodyType(e.target.value as BodyType)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                >
                  <option value="SUV">SUV</option>
                  <option value="Pickup">Pickup</option>
                  <option value="Sedan">Sedan</option>
                  <option value="Hatchback">Hatchback</option>
                  <option value="Van">Van</option>
                  <option value="Coupe">Coupe</option>
                  <option value="Wagon">Wagon</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Origin Port
                </label>
                <select
                  value={originPort}
                  onChange={(e) => setOriginPort(e.target.value as OriginPort)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                >
                  <option value="Yokohama">Yokohama</option>
                  <option value="Nagoya">Nagoya</option>
                  <option value="Kobe">Kobe</option>
                  <option value="Osaka">Osaka</option>
                  <option value="Hakata">Hakata</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Color</label>
                <input
                  type="text"
                  value={exteriorColor}
                  onChange={(e) => setExteriorColor(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as VehicleStatus)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                >
                  <option value="available">Available</option>
                  <option value="reserved">Reserved</option>
                  <option value="sold">Sold</option>
                  <option value="archived">Archived (Hidden)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Vehicle Photos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-xs font-semibold text-slate-500">
                2. Vehicle Photography ({images.length}/6)
              </h3>
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-800 cursor-pointer">
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Upload Photos (Auto-Compressed)
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={uploading || images.length >= 6}
                  onChange={(e) => void handleFileUpload(e.target.files)}
                  className="hidden"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {images.map((src, idx) => (
                <div
                  key={`${src.slice(0, 32)}-${idx}`}
                  className="relative aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group"
                >
                  <img
                    src={src}
                    alt={`Photo ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label="Remove photo"
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-slate-900/80 text-white flex items-center justify-center hover:bg-red-700 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {images.length < 6 && (
                <label className="aspect-[4/3] rounded-lg border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center text-slate-500 text-xs cursor-pointer">
                  <ImagePlus className="w-5 h-5 mb-1" />
                  <span>Add File</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => void handleFileUpload(e.target.files)}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="url"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="Or paste an image URL..."
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
              <button
                type="button"
                onClick={handleAddUrl}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add URL
              </button>
            </div>
          </div>

          {/* Section 3: Auction Grade Sheet & Body Diagram */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-500 border-b border-slate-200 pb-2">
              3. Japanese Auction Sheet & Condition Marks
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Ext Grade</label>
                <select
                  value={exteriorGrade}
                  onChange={(e) => setExteriorGrade(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                >
                  <option value="S">S (New)</option>
                  <option value="5">5</option>
                  <option value="4.5">4.5</option>
                  <option value="4">4</option>
                  <option value="3.5">3.5</option>
                  <option value="R">R</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Int Grade</label>
                <select
                  value={interiorGrade}
                  onChange={(e) => setInteriorGrade(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Auction House
                </label>
                <input
                  type="text"
                  value={auctionHouse}
                  onChange={(e) => setAuctionHouse(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Lot No.</label>
                <input
                  type="text"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Inspect Date
                </label>
                <input
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {EDITABLE_PANELS.map((panel) => (
                <div key={panel.key}>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {panel.label}
                  </label>
                  <select
                    value={panelMarks[panel.key] || ''}
                    onChange={(e) => handlePanelChange(panel.key, e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-md"
                  >
                    {MARK_OPTIONS.map((opt) => (
                      <option key={opt || 'clean'} value={opt}>
                        {opt || 'Clean (None)'}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Inspector Notes
                </label>
                <textarea
                  rows={3}
                  maxLength={600}
                  value={inspectorNotes}
                  onChange={(e) => setInspectorNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Equipment Features (one per line)
                </label>
                <textarea
                  rows={3}
                  value={featuresText}
                  onChange={(e) => setFeaturesText(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={engineNote}
                onChange={(e) => setEngineNote(e.target.value)}
                placeholder="Engine check"
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
              <input
                type="text"
                value={transNote}
                onChange={(e) => setTransNote(e.target.value)}
                placeholder="Transmission check"
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
              <input
                type="text"
                value={frameNote}
                onChange={(e) => setFrameNote(e.target.value)}
                placeholder="Frame check"
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
              <input
                type="text"
                value={suspNote}
                onChange={(e) => setSuspNote(e.target.value)}
                placeholder="Suspension check"
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
              <input
                type="text"
                value={acNote}
                onChange={(e) => setAcNote(e.target.value)}
                placeholder="A/C check"
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 px-2">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="rounded accent-amber-600"
                />
                Mark as Featured Stock
              </label>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-60 cursor-pointer"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isImportMode
                ? 'Import & Publish to Firestore'
                : vehicle
                  ? 'Save Vehicle Changes'
                  : 'Publish Vehicle to Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
