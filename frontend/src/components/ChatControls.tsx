import type { FriendState } from '../hooks/useWebRTC';

interface Props {
  connected: boolean;
  canAddFriend: boolean;
  friendState: FriendState;
  partnerWantsFriend: boolean;
  onSkip: () => void;
  onAddFriend: () => void;
  onReport: () => void;
  onEnd: () => void;
}

const FRIEND_LABEL: Record<FriendState, string> = {
  none: 'Agregar amigo',
  sent: 'Solicitud enviada',
  accepted: '¡Ya son amigos!',
  already: 'Ya son amigos',
  unavailable: 'No disponible',
};

function Btn({
  onClick,
  disabled,
  className,
  icon,
  label,
  title,
}: {
  onClick: () => void;
  disabled?: boolean;
  className: string;
  icon: string;
  label: string;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wide shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      <span className="text-sm">{icon}</span>
      {label}
    </button>
  );
}

export default function ChatControls(p: Props) {
  const friendDisabled = !p.connected || !p.canAddFriend || p.friendState !== 'none';
  const friendTitle = !p.canAddFriend ? 'Ambos necesitan una cuenta para agregarse como amigos' : undefined;
  const incoming = p.partnerWantsFriend && p.friendState === 'none';

  return (
    <div className="flex flex-wrap items-center justify-start gap-2">
      <Btn onClick={p.onSkip} className="bg-brand-600 text-white hover:bg-brand-700" icon="⏭" label="Skip" />
      <Btn
        onClick={p.onAddFriend}
        disabled={friendDisabled}
        title={friendTitle}
        className={`text-white ${incoming ? 'animate-pulse bg-brand-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
        icon="🤝"
        label={incoming ? 'Aceptar amistad' : FRIEND_LABEL[p.friendState]}
      />
      <Btn onClick={p.onReport} disabled={!p.connected} className="bg-amber-400 text-amber-950 hover:bg-amber-300" icon="🚩" label="Reportar" />
      <Btn onClick={p.onEnd} className="bg-rose-600 text-white hover:bg-rose-500" icon="✕" label="Terminar" />
    </div>
  );
}
