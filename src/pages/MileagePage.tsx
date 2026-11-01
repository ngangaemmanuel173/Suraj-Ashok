import { useEffect, useState, useCallback, useMemo } from 'react';
import { Gauge, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { LoadingSpinner, EmptyState } from '@/components/Shared';
import { useToast } from '@/components/Toast';
import { SubAccount } from '@/lib/portals';

const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500';
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1';
const todayStr = () => new Date().toLocaleDateString('en-CA');
const monthStart = () => { const d = new Date(); d.setDate(1); return d.toLocaleDateString('en-CA'); };
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtKm = (n: number) => `${Math.round(n).toLocaleString('en-KE')} km`;

const EMPTY = { entry_date: todayStr(), driver_id: '', vehicle_id: '', trip_id: '', trip_ref: '', start_km: '', end_km: '', km_covered: '', notes: '' };

/** Operations team: mileage per driver + truck + trip (drivers change trucks, so all three are recorded). */
export function MileagePage({ portalColor, subAccount }: { portalColor: string; subAccount: SubAccount }) {
  const { showToast } = useToast();
  const { profile } = useAuth();
  const toast = useCallback((m: string, t: 'success' | 'error' = 'success') => (showToast as any)(m, t), [showToast]);
  const who = (profile as any)?.full_name || (profile as any)?.email || 'Unknown';

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayStr());
  const [truckF, setTruckF] = useState('all');
  const [driverF, setDriverF] = useState('all');
  const [tripF, setTripF] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [m, d, v, t] = await Promise.all([
      supabase.from('driver_mileage').select('*').eq('sub_account', subAccount).gte('entry_date', from).lte('entry_date', to).order('entry_date', { ascending: false }),
      supabase.from('drivers').select('id, name').order('name'),
      supabase.from('vehicles').select('id, plate_number').order('plate_number'),
      supabase.from('sub_account_trips').select('id, trip_date, vehicle_id, driver_id, departure_point, arrival_point').order('trip_date', { ascending: false }).limit(200),
    ]);
    if (m.error) toast(`Could not load mileage: ${m.error.message}`, 'error');
    setRows(m.data || []); setDrivers(d.data || []); setVehicles(v.data || []); setTrips(t.data || []);
    setLoading(false);
  }, [subAccount, from, to, toast]);
  useEffect(() => { load(); }, [load]);

  const dName = useMemo(() => Object.fromEntries(drivers.map(d => [d.id, d.name])), [drivers]);
  const vName = useMemo(() => Object.fromEntries(vehicles.map(v => [v.id, v.plate_number])), [vehicles]);
  const tripLabel = (t: any) => `${fmtDate(t.trip_date)} · ${vName[t.vehicle_id] || '—'} · ${t.departure_point || '?'} → ${t.arrival_point || '?'}`;

  const visible = useMemo(() => rows.filter(r =>
    (truckF === 'all' || r.vehicle_id === truckF) &&
    (driverF === 'all' || r.driver_id === driverF) &&
    (!tripF.trim() || `${r.trip_ref || ''}`.toLowerCase().includes(tripF.trim().toLowerCase()))
  ), [rows, truckF, driverF, tripF]);

  const total = visible.reduce((a, r) => a + Number(r.km_covered || 0), 0);
  const byDriver = useMemo(() => {
    const m: Record<string, number> = {};
    visible.forEach(r => { const k = dName[r.driver_id] || 'Unassigned'; m[k] = (m[k] || 0) + Number(r.km_covered || 0); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [visible, dName]);
  const byTruck = useMemo(() => {
    const m: Record<string, number> = {};
    visible.forEach(r => { const k = vName[r.vehicle_id] || 'Unassigned'; m[k] = (m[k] || 0) + Number(r.km_covered || 0); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [visible, vName]);

  const pickTrip = (id: string) => {
    const t = trips.find(x => x.id === id);
    setForm(f => ({ ...f, trip_id: id, trip_ref: t ? tripLabel(t) : f.trip_ref, vehicle_id: t?.vehicle_id || f.vehicle_id, driver_id: t?.driver_id || f.driver_id }));
  };
  const autoKm = (s: string, e: string) => (s !== '' && e !== '' && Number(e) >= Number(s) ? String(Number(e) - Number(s)) : '');

  const save = async () => {
    const km = Number(form.km_covered);
    if (!form.driver_id) return toast('Choose the driver', 'error');
    if (!form.vehicle_id) return toast('Choose the truck', 'error');
    if (!km || km <= 0) return toast('Enter the kilometres covered (or start and end odometer)', 'error');
    setSaving(true);
    const { error } = await supabase.from('driver_mileage').insert({
      sub_account: subAccount, entry_date: form.entry_date, driver_id: form.driver_id, vehicle_id: form.vehicle_id,
      trip_id: form.trip_id || null, trip_ref: form.trip_ref.trim() || null,
      start_km: form.start_km !== '' ? Number(form.start_km) : null, end_km: form.end_km !== '' ? Number(form.end_km) : null,
      km_covered: km, notes: form.notes.trim() || null, entered_by: who,
    });
    setSaving(false);
    if (error) return toast(error.message, 'error');
    toast('Mileage saved'); setOpen(false); setForm({ ...EMPTY }); load();
  };
  const remove = async (id: string) => {
    if (!confirm('Delete this mileage entry?')) return;
    const { error } = await supabase.from('driver_mileage').delete().eq('id', id);
    if (error) return toast(error.message, 'error');
    load();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: portalColor }}><Gauge className="h-6 w-6" /></div>
          <div><h2 className="text-lg font-bold text-slate-800">Driver Mileage</h2><p className="text-sm text-slate-500">Kilometres per driver, truck and trip</p></div>
        </div>
        <button onClick={() => { setForm({ ...EMPTY }); setOpen(true); }} className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white" style={{ background: portalColor }}>
          <Plus className="h-4 w-4" /> Add Mileage
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <div><label className={labelCls}>From</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>To</label><input type="date" value={to} onChange={e => setTo(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Truck</label>
          <select value={truckF} onChange={e => setTruckF(e.target.value)} className={inputCls}><option value="all">All trucks</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}</select></div>
        <div><label className={labelCls}>Driver</label>
          <select value={driverF} onChange={e => setDriverF(e.target.value)} className={inputCls}><option value="all">All drivers</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div className="col-span-2 lg:col-span-1"><label className={labelCls}>Trip</label><input value={tripF} onChange={e => setTripF(e.target.value)} placeholder="Search trip..." className={inputCls} /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="card p-4"><p className="text-xs font-semibold text-slate-500">Total distance (filtered)</p><p className="text-2xl font-bold text-slate-800">{fmtKm(total)}</p><p className="text-xs text-slate-400">{visible.length} entries</p></div>
        <div className="card p-4"><p className="text-xs font-semibold text-slate-500 mb-1">By driver</p>{byDriver.length === 0 ? <p className="text-sm text-slate-400">—</p> : byDriver.slice(0, 5).map(([k, v]) => <div key={k} className="flex justify-between text-sm"><span className="truncate">{k}</span><span className="font-semibold">{fmtKm(v)}</span></div>)}</div>
        <div className="card p-4"><p className="text-xs font-semibold text-slate-500 mb-1">By truck</p>{byTruck.length === 0 ? <p className="text-sm text-slate-400">—</p> : byTruck.slice(0, 5).map(([k, v]) => <div key={k} className="flex justify-between text-sm"><span className="truncate">{k}</span><span className="font-semibold">{fmtKm(v)}</span></div>)}</div>
      </div>

      {loading ? <LoadingSpinner message="Loading mileage..." /> : visible.length === 0 ? (
        <div className="card"><EmptyState icon={<Gauge className="h-8 w-8" />} title="No mileage found" message="Add mileage or widen the filters." /></div>
      ) : (
        <div className="card table-wrapper overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Driver</th><th>Truck</th><th>Trip</th><th>Start km</th><th>End km</th><th>Distance</th><th>Entered by</th><th /></tr></thead>
            <tbody>{visible.map(r => (
              <tr key={r.id}>
                <td>{fmtDate(r.entry_date)}</td><td className="font-medium">{dName[r.driver_id] || '—'}</td><td>{vName[r.vehicle_id] || '—'}</td>
                <td className="max-w-[260px] truncate" title={r.trip_ref || ''}>{r.trip_ref || '—'}</td>
                <td>{r.start_km ?? '—'}</td><td>{r.end_km ?? '—'}</td><td className="font-bold text-slate-800">{fmtKm(Number(r.km_covered))}</td>
                <td className="text-xs text-slate-500">{r.entered_by || '—'}</td>
                <td><button onClick={() => remove(r.id)} className="text-slate-400 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></td>
              </tr>))}</tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between"><h3 className="text-base font-bold text-slate-800">Add mileage</h3><button onClick={() => setOpen(false)}><X className="h-5 w-5 text-slate-400" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className={labelCls}>Trip (optional, fills truck and driver)</label>
                <select value={form.trip_id} onChange={e => pickTrip(e.target.value)} className={inputCls}><option value="">— Not linked to a recorded trip —</option>{trips.map(t => <option key={t.id} value={t.id}>{tripLabel(t)}</option>)}</select></div>
              <div className="col-span-2"><label className={labelCls}>Trip reference</label><input value={form.trip_ref} onChange={e => setForm({ ...form, trip_ref: e.target.value })} placeholder="e.g. Mombasa → Nairobi" className={inputCls} /></div>
              <div><label className={labelCls}>Date</label><input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Driver *</label><select value={form.driver_id} onChange={e => setForm({ ...form, driver_id: e.target.value })} className={inputCls}><option value="">—</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div><label className={labelCls}>Truck *</label><select value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })} className={inputCls}><option value="">—</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}</select></div>
              <div><label className={labelCls}>Km covered *</label><input type="number" value={form.km_covered} onChange={e => setForm({ ...form, km_covered: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Start odometer</label><input type="number" value={form.start_km} onChange={e => setForm({ ...form, start_km: e.target.value, km_covered: autoKm(e.target.value, form.end_km) || form.km_covered })} className={inputCls} /></div>
              <div><label className={labelCls}>End odometer</label><input type="number" value={form.end_km} onChange={e => setForm({ ...form, end_km: e.target.value, km_covered: autoKm(form.start_km, e.target.value) || form.km_covered })} className={inputCls} /></div>
              <div className="col-span-2"><label className={labelCls}>Notes</label><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputCls} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
              <button onClick={save} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: portalColor }}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
