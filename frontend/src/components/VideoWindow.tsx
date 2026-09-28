import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  stream: MediaStream | null;
  label?: string;
  muted?: boolean;
  mirrored?: boolean;
  className?: string;
  placeholder?: ReactNode;
}

export default function VideoWindow({ stream, label, muted, mirrored, className = '', placeholder }: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div className={`relative overflow-hidden bg-video ${className}`}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={`h-full w-full object-cover ${mirrored ? '-scale-x-100' : ''} ${stream ? '' : 'hidden'}`}
      />
      {!stream && <div className="absolute inset-0 grid place-items-center text-white/80">{placeholder}</div>}
      {label && (
        <span className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 font-mono text-sm text-white backdrop-blur">
          {label}
        </span>
      )}
    </div>
  );
}
