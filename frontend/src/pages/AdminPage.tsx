import { useCallback, useEffect, useState } from 'react';
import { api, parseDbDate, REPORT_REASONS, type AdminReport, type AutoViolation } from '../services/api';

const TABS: { value: AdminReport['status']; label: string }[] = [
  { value: 'open', label: 'Pendientes' },
  { value: 'actioned', label: 'Con sanción' },
  { value: 'dismissed', label: 'Descartados' },
];

const reasonLabel = (reason: string) => REPORT_REASONS.find((r) => r.value === reason.split(':')[0])?.label ?? reason;

/** Panel de moderación: revisar reportes, descartarlos o suspender al reportado. */
function ReportsPanel() {
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
        <h2 className="text-lg font-bold">Reportes de usuarios</h2>
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

const ACTION_LABEL: Record<AutoViolation['action'], string> = {
  warning: 'Advertencia',
  ban_24h: 'Ban 24 h',
  ban_permanent: 'Ban permanente',
};
const CATEGORY_LABEL: Record<AutoViolation['category'], string> = { porn: 'Contenido sexual', hentai: 'Contenido sexual (dibujo)' };

/** Detecciones automáticas (NSFWJS en el navegador). Sin vídeo: solo quién, cuándo, tipo y confianza. */
function DetectionsPanel() {
  const [status, setStatus] = useState<AutoViolation['status']>('active');
  const [items, setItems] = useState<AutoViolation[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setItems(null);
    api
      .adminViolations(status)
      .then((r) => setItems(r.violations))
      .catch((e) => setError(e.message));
  }, [status]);
  useEffect(load, [load]);

  async function overturn(v: AutoViolation) {
    const who = v.username ? `@${v.username}` : `el anónimo ${v.label}`;
    if (!confirm(`¿Anular esta detección de ${who}? Se levantará su sanción (${ACTION_LABEL[v.action]}) y no contará para futuras.`)) return;
    await api.adminOverturn(v.id);
    load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Detecciones automáticas</h2>
        <p className="mt-1 text-sm text-ink-soft">
          El navegador de quien recibe el vídeo lo analiza localmente; aquí solo llega el resultado. Escalera: advertencia →
          ban 24 h → ban permanente (cuenta y hash de IP). Si es un falso positivo, anúlala.
        </p>
      </div>
      <div className="flex gap-2">
        {(['active', 'overturned'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-sm ${status === s ? 'bg-brand-600 font-semibold text-white' : 'bg-surface text-ink hover:bg-celeste-50'}`}
          >
            {s === 'active' ? 'Vigentes' : 'Anuladas'}
          </button>
        ))}
      </div>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{error}</p>}
      {items === null && !error && <p className="text-ink-soft">Cargando…</p>}
      {items?.length === 0 && <div className="rounded-2xl border border-dashed border-celeste-300 p-10 text-center text-ink-soft">No hay detecciones aquí.</div>}
      <div className="space-y-3">
        {items?.map((v) => (
          <div key={v.id} className={`rounded-xl border bg-surface p-4 ${v.action === 'ban_permanent' ? 'border-rose-400' : 'border-celeste-200'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {CATEGORY_LABEL[v.category]} · <span className="font-normal">confianza {Math.round(v.score * 100)}%</span>
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  Usuario: <span className="text-ink">{v.username ? `@${v.username}` : 'anónimo'} ({v.label ?? '—'})</span>
                  {' · '}Sanción: <span className="font-semibold text-ink">{ACTION_LABEL[v.action]}</span>
                  {' · '}{v.activeViolations} detección{v.activeViolations === 1 ? '' : 'es'} vigente{v.activeViolations === 1 ? '' : 's'}
                  {!!v.isBanned && <span className="ml-2 rounded bg-rose-600 px-1.5 py-0.5 text-xs font-bold text-white">SUSPENDIDO</span>}
                </p>
                <p className="text-xs text-ink-soft">
                  Detectado por {v.reporterUsername ? `@${v.reporterUsername}` : 'un usuario anónimo'} · {parseDbDate(v.createdAt)?.toLocaleString()}
                </p>
              </div>
              {v.status === 'active' && (
                <button onClick={() => overturn(v)} className="rounded-lg border border-celeste-300 px-3 py-1.5 text-sm hover:bg-celeste-100">
                  Anular (falso positivo)
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [section, setSection] = useState<'reports' | 'detections'>('reports');
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold">Moderación</h1>
      <div className="mt-4 flex gap-2 border-b border-celeste-200">
        {([['reports', '🚩 Reportes'], ['detections', '🛡️ Detecciones automáticas']] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setSection(k)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${section === k ? 'border-brand-600 text-accent' : 'border-transparent text-ink-soft hover:text-ink'}`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="-mx-6">{section === 'reports' ? <ReportsPanel /> : <div className="p-6"><DetectionsPanel /></div>}</div>
    </div>
  );
}
