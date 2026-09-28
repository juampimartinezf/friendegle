import { useEffect, useRef, type ReactNode } from 'react';
import { Avatar } from './AvatarPicker';

interface Props {
  stream: MediaStream | null;
  label?: string;
  avatarUrl?: string | null;
  muted?: boolean;
  mirrored?: boolean;
  className?: string;
  placeholder?: ReactNode;
}

export default function VideoWindow({ stream, label, avatarUrl, muted, mirrored, className = '', placeholder }: Props) {
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
        <span className="absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full bg-black/55 py-1 pl-1 pr-3 font-mono text-sm text-white backdrop-blur">
          {avatarUrl ? <Avatar avatarUrl={avatarUrl} size="xs" /> : <span className="pl-2" />}
          <span className="truncate">{label}</span>
        </span>
      )}
    </div>
  );
}
