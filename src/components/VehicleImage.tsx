import { Car } from 'lucide-react';
import { useState } from 'react';

interface VehicleImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function VehicleImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackTitle,
}: VehicleImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-100 via-slate-200/70 to-slate-100 flex flex-col items-center justify-center p-6 text-center text-slate-500">
        <Car className="w-10 h-10 text-slate-400 mb-2" strokeWidth={1.5} />
        <span className="text-xs font-medium text-slate-600 max-w-[200px] truncate">
          {fallbackTitle || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
