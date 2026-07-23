const SUPABASE_URL = 'https://kipcvugwlghonpgvitjk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpcGN2dWd3bGdob25wZ3ZpdGprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMDUzNTgsImV4cCI6MjA5MjU4MTM1OH0.orjTj18nAm0HDLffgWzJpaZM4wfW2-L_C8ukzYKX88Y';
const SESSION_KEY = 'orderan_session';
const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const workDate = params.get('date');
const workDayId = params.get('id');

const rupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n || 0));
const shortRp = (n) => `Rp${Math.round(Number(n || 0) / 1000)} rb`;
const minutesLabel = (minutes) => `${Math.floor(Number(minutes || 0) / 60)}j ${Number(minutes || 0) % 60}m`;
const timeLabel = (value) => value ? new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(value)) : '—';
const dateLong = (date) => new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(`${date}T12:00:00+07:00`));
const dayTypeLabel = { cash: 'Cash Day', build: 'Build Day', home_standby: 'Standby Rajeg', off: 'Libur' };
const expenseLabel = { fuel: 'Bensin', meal: 'Makan', toll: 'Tol', parking: 'Parkir', maintenance: 'Servis', mobile_data: 'Kuota', other: 'Lainnya' };

async function request(path) {
  if (!session?.access_token) throw new Error('Sesi login tidak ditemukan. Silakan masuk kembali.');
  const response = await fetch(`${SUPABASE_URL}${path}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}`, Accept: 'application/json' } });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.message || data?.msg || data?.hint || `HTTP ${response.status}`);
  return data;
}

function query(table, filters) { return request(`/rest/v1/${table}?${filters}`); }

function renderOrders(rows) {
  $('orderList').innerHTML = rows.length ? rows.map((row) => `
    <article class="detail-list-item">
      <div class="detail-list-top"><span class="segment-pill ${row.segment}">${row.segment === 'return' ? 'Pulang' : row.segment === 'morning' ? 'Pagi' : 'Lainnya'}</span><strong>${rupiah(row.amount)}</strong></div>
      <h4>${row.pickup_area || 'Pickup tidak diisi'} → ${row.destination_area || 'Tujuan tidak diisi'}</h4>
      <p>${row.platform || 'Platform tidak diisi'} · ${row.distance_km ? `${row.distance_km} km` : 'Jarak tidak diisi'} · ${row.delivery_points || 1} titik</p>
      ${row.notes ? `<small>${row.notes}</small>` : ''}
    </article>`).join('') : '<p class="muted empty-detail">Tidak ada order pada hari ini.</p>';
}

function renderExpenses(rows) {
  $('expenseList').innerHTML = rows.length ? rows.map((row) => `
    <article class="detail-list-item compact-item">
      <div><h4>${expenseLabel[row.category] || row.category}</h4><p>${row.notes || 'Tanpa catatan'}</p></div>
      <strong>${rupiah(row.amount)}</strong>
    </article>`).join('') : '<p class="muted empty-detail">Tidak ada pengeluaran pada hari ini.</p>';
}

async function loadDetail() {
  try {
    if (!workDate || !workDayId) throw new Error('Tanggal atau ID hari kerja tidak tersedia.');
    const [summaryRows, activityRows, orders, expenses] = await Promise.all([
      query('ojol_daily_summary', `select=*&work_day_id=eq.${encodeURIComponent(workDayId)}&limit=1`),
      query('ojol_activity_summary', `select=*&work_day_id=eq.${encodeURIComponent(workDayId)}&limit=1`),
      query('ojol_orders', `select=*&work_day_id=eq.${encodeURIComponent(workDayId)}&accepted=eq.true&order=accepted_at.asc.nullslast,created_at.asc`),
      query('ojol_expenses', `select=*&work_day_id=eq.${encodeURIComponent(workDayId)}&order=created_at.asc`)
    ]);

    const summary = summaryRows?.[0];
    if (!summary) throw new Error('Data hari tersebut tidak ditemukan.');
    const activity = activityRows?.[0] || {};

    $('detailDate').textContent = dateLong(workDate);
    $('detailNet').textContent = rupiah(summary.net_income);
    $('detailDayType').textContent = dayTypeLabel[summary.day_type] || summary.day_type || 'Hari kerja';
    $('detailStatus').textContent = summary.status === 'completed' ? 'Selesai' : summary.status === 'active' ? 'Aktif' : summary.status || 'Tercatat';
    $('detailMorning').textContent = rupiah(summary.morning_income);
    $('detailReturn').textContent = rupiah(summary.return_income);
    $('detailExpense').textContent = rupiah(summary.total_expense);
    $('detailGross').textContent = rupiah(summary.gross_income);
    $('detailMorningTarget').textContent = `Target ${shortRp(summary.morning_target)}`;
    $('detailReturnTarget').textContent = `Target ${shortRp(summary.return_target)}`;
    $('detailOrders').textContent = `${summary.accepted_orders || 0} order · ${summary.paid_distance_km || 0} km`;
    $('detailOnbid').textContent = minutesLabel(activity.onbid_minutes);
    $('detailInApp').textContent = minutesLabel(activity.in_app_minutes);
    $('detailOnline').textContent = minutesLabel(activity.total_online_minutes);
    $('detailStart').textContent = `Mulai ${timeLabel(activity.first_started_at)}`;
    $('detailEnd').textContent = `Selesai ${timeLabel(activity.last_ended_at)}`;
    $('detailBuildMinutes').textContent = `${summary.build_minutes || 0} menit`;
    $('detailEnergy').textContent = summary.energy_score ? `Energi ${summary.energy_score}/5` : 'Energi belum diisi';
    $('detailBuildOutput').textContent = summary.build_output || 'Belum ada output.';
    renderOrders(orders || []);
    renderExpenses(expenses || []);
    $('detailContent').classList.remove('hidden');
  } catch (error) {
    $('detailError').textContent = error.message || 'Gagal memuat detail.';
    $('detailError').classList.remove('hidden');
    if (!session?.access_token) setTimeout(() => { location.href = 'index.html'; }, 1800);
  }
}

$('backBtn').addEventListener('click', () => {
  if (history.length > 1) history.back(); else location.href = 'index.html';
});
loadDetail();
