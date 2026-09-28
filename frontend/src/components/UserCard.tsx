import type { ReactNode } from 'react';
import { formatLastSeen } from '../services/api';
import { Avatar } from './AvatarPicker';

interface Props {
  name: string;
  avatarUrl: string | null;
  isOnline: number | boolean;
  lastSeen: string | null;
  onClick?: () => void;
  actions?: ReactNode;
}

export default function UserCard({ name, avatarUrl, isOnline, lastSeen, onClick, actions }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-celeste-200 bg-surface p-3 transition hover:bg-celeste-100">
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="relative">
          <Avatar avatarUrl={avatarUrl} />
          {!!isOnline && <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-400 ring-2 ring-surface" />}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{name}</p>
          <p className={`text-xs ${isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-soft'}`}>{formatLastSeen(isOnline, lastSeen)}</p>
        </div>
      </button>
      {actions}
    </div>
  );
}
