import { useCallback, useEffect, useState } from 'react';
import { api, parseDbDate, REPORT_REASONS, type AdminReport } from '../services/api';

const TABS: { value: AdminReport['status']; label: string }[] = [
  { value: 'open', label: 'Pendientes' },
  { value: 'actioned', label: 'Con sanción' },
  { value: 'dismissed', label: 'Descartados' },
];

const reasonLabel = (reason: string) => REPORT_REASONS.find((r) => r.value === reason.split(':')[0])?.label ?? reason;

/** Panel de moderación: revisar reportes, descartarlos o suspender al reportado. */
export default function AdminPage() {
  const [tab, setTab] = useState<AdminReport['status']>('open');
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setReports(null);
    api
      .adminReports(tab)
      .then((r) => setReports(r.reports))
      .catch((e) => setError(e.message));
  }, [tab]);

  useEffect(load, [load]);

  async function act(report: AdminReport, action: 'dismiss' | 'ban') {
    const who = report.reportedUsername ? `@${report.reportedUsername}` : `el usuario anónimo ${report.reportedLabel}`;
    if (action === 'ban' && !confirm(`¿Suspender a ${who}? Perderá el acceso al chat y se cerrarán todos sus reportes pendientes.`)) return;
    await (action === 'ban' ? api.adminBan(report.id) : api.adminDismiss(report.id));
    load();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Moderación</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Los reportes por posible menor de edad aparecen primero. Suspender a un anónimo bloquea su conexión (por hash
          de IP, nunca se muestra la IP).
        </p>
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-lg px-3 py-1.5 text-sm ${tab === t.value ? 'bg-brand-600 font-semibold text-white' : 'bg-surface text-ink hover:bg-celeste-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{error}</p>}
      {reports === null && !error && <p className="text-ink-soft">Cargando…</p>}
      {reports?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-celeste-300 p-10 text-center text-ink-soft">No hay reportes aquí. 🎉</div>
      )}

      <div className="space-y-3">
        {reports?.map((r) => (
          <div
            key={r.id}
            className={`rounded-xl border bg-surface p-4 ${r.reason.startsWith('minor') ? 'border-rose-400' : 'border-celeste-200'}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {r.reason.startsWith('minor') && '⚠️ '}
                  {reasonLabel(r.reason)}
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  Reportado:{' '}
                  <span className="text-ink">
                    {r.reportedUsername ? `@${r.reportedUsername}` : 'anónimo'} ({r.reportedLabel ?? 'sin etiqueta'})
                  </span>
                  {' · '}
                  {r.totalReports} reporte{r.totalReports === 1 ? '' : 's'} en total
                  {!!r.isBanned && <span className="ml-2 rounded bg-rose-600 px-1.5 py-0.5 text-xs font-bold text-white">SUSPENDIDO</span>}
                </p>
                <p className="text-xs text-ink-soft">
                  Por {r.reporterUsername ? `@${r.reporterUsername}` : 'un usuario anónimo'} · {parseDbDate(r.createdAt)?.toLocaleString()}
                </p>
              </div>
              {r.status === 'open' && (
                <div className="flex gap-2">
                  <button onClick={() => act(r, 'dismiss')} className="rounded-lg px-3 py-1.5 text-sm text-ink-soft hover:bg-celeste-100">
                    Descartar
                  </button>
                  <button onClick={() => act(r, 'ban')} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-500">
                    Suspender
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
