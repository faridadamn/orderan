const SUPABASE_URL = 'https://kipcvugwlghonpgvitjk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpcGN2dWd3bGdob25wZ3ZpdGprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMDUzNTgsImV4cCI6MjA5MjU4MTM1OH0.orjTj18nAm0HDLffgWzJpaZM4wfW2-L_C8ukzYKX88Y';
const SESSION_KEY = 'orderan_session';
const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
const $ = (id) => document.getElementById(id);
const rupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n || 0));
const num = (n) => Number(n || 0);
let mode = 'weekly';
let rows = [];

async function loadRows() {
  if (!session?.access_token) { location.href = 'index.html'; return; }
  const response = await fetch(`${SUPABASE_URL}/rest/v1/ojol_daily_summary?select=*&order=work_date.desc`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}`, Accept: 'application/json' }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || `HTTP ${response.status}`);
  rows = Array.isArray(data) ? data : [];
  render();
}
function dateOnly(value) { return new Date(`${value}T12:00:00+07:00`); }
function mondayKey(value) { const d = dateOnly(value); const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1); return d.toISOString().slice(0, 10); }
function monthKey(value) { return value.slice(0, 7); }
function labelDate(value, options) { return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', ...options }).format(dateOnly(value)); }
function formatWeek(start) { const d = dateOnly(start); const end = new Date(d); end.setDate(d.getDate() + 6); return `${labelDate(start, { day: 'numeric', month: 'short' })} – ${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(end)}`; }
function aggregate(list) { return list.reduce((a, r) => { a.gross += num(r.gross_income); a.expense += num(r.total_expense); a.net += num(r.net_income); a.orders += num(r.accepted_orders); a.km += num(r.paid_distance_km); a.days += num(r.gross_income) > 0 ? 1 : 0; return a; }, { gross: 0, expense: 0, net: 0, orders: 0, km: 0, days: 0 }); }
function groups() { const map = new Map(); for (const row of rows) { const key = mode === 'weekly' ? mondayKey(row.work_date) : monthKey(row.work_date); if (!map.has(key)) map.set(key, []); map.get(key).push(row); } return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])); }
function card(key, list, index) {
  const allGroups = groups(); const a = aggregate(list); const previous = allGroups[index + 1]?.[1]; const p = previous ? aggregate(previous) : null;
  const delta = (current, old) => old ? `${current >= old ? '+' : ''}${Math.round(((current - old) / old) * 100)}%` : '—';
  const rpKm = a.km ? a.gross / a.km : 0; const rpOrder = a.orders ? a.gross / a.orders : 0;
  const period = mode === 'weekly' ? formatWeek(key) : labelDate(`${key}-01`, { month: 'long', year: 'numeric' });
  return `<article class="history-item" style="display:block"><div class="detail-list-top"><div><h4>${period}</h4><p>${a.days} hari aktif · ${a.orders} order · ${a.km.toFixed(1)} km</p></div><strong class="positive">${rupiah(a.net)}</strong></div><div class="stats-grid" style="margin-top:12px"><article class="stat-card"><span>Gross</span><strong>${rupiah(a.gross)}</strong><small>${p ? delta(a.gross,p.gross) : 'Periode pertama'}</small></article><article class="stat-card"><span>Biaya</span><strong>${rupiah(a.expense)}</strong><small>${p ? delta(a.expense,p.expense) : '—'}</small></article><article class="stat-card"><span>Rp/km</span><strong>${rupiah(rpKm)}</strong><small>Gross ÷ km</small></article><article class="stat-card"><span>Rp/order</span><strong>${rupiah(rpOrder)}</strong><small>Gross ÷ order</small></article></div></article>`;
}
function render() { const gs = groups(); $('periodList').innerHTML = gs.length ? gs.map(([key, list], i) => card(key, list, i)).join('') : '<p class="muted">Belum ada riwayat.</p>'; }
$('weeklyTab').addEventListener('click', () => { mode = 'weekly'; $('weeklyTab').classList.add('active'); $('monthlyTab').classList.remove('active'); render(); });
$('monthlyTab').addEventListener('click', () => { mode = 'monthly'; $('monthlyTab').classList.add('active'); $('weeklyTab').classList.remove('active'); render(); });
$('backBtn').addEventListener('click', () => location.href = 'index.html');
loadRows().catch(error => { $('periodList').innerHTML = `<p class="muted">${error.message || 'Gagal memuat riwayat.'}</p>`; });
