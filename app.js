const SUPABASE_URL = 'https://kipcvugwlghonpgvitjk.supabase.co';
const SUPABASE_KEY = 'sb_publishable__GQklRAhqZ2zvxmrnsUmhQ_JYHazo-s';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const rupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n || 0));
const shortRp = (n) => `Rp${Math.round(Number(n || 0) / 1000)} rb`;
const dateLabel = (date) => new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(`${date}T12:00:00+07:00`));

let user = null;
let currentDay = null;

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  setTimeout(() => $('toast').classList.remove('show'), 2200);
}

function openDialog(id) { $(id).showModal(); }
function closeDialogs() { document.querySelectorAll('dialog[open]').forEach((d) => d.close()); }
document.querySelectorAll('.close-btn').forEach((b) => b.addEventListener('click', closeDialogs));

async function ensureWorkDay() {
  const workDate = today();
  const { data: existing, error } = await db.from('ojol_work_days').select('*').eq('work_date', workDate).maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  const { data, error: insertError } = await db.from('ojol_work_days').insert({ work_date: workDate }).select().single();
  if (insertError) throw insertError;
  return data;
}

async function loadDashboard() {
  try {
    currentDay = await ensureWorkDay();
    const start = new Date();
    start.setDate(1);
    const startDate = start.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

    const [{ data: todayData, error: todayError }, { data: monthData, error: monthError }, { data: history, error: historyError }] = await Promise.all([
      db.from('ojol_daily_summary').select('*').eq('work_date', today()).maybeSingle(),
      db.from('ojol_daily_summary').select('*').gte('work_date', startDate).lte('work_date', today()),
      db.from('ojol_daily_summary').select('*').order('work_date', { ascending: false }).limit(7)
    ]);
    if (todayError) throw todayError;
    if (monthError) throw monthError;
    if (historyError) throw historyError;

    renderToday(todayData || currentDay);
    renderMonth(monthData || []);
    renderHistory(history || []);
  } catch (error) {
    console.error(error);
    toast(error.message || 'Gagal memuat data');
  }
}

function renderToday(data) {
  const morning = Number(data.morning_income || 0);
  const returning = Number(data.return_income || 0);
  const expense = Number(data.total_expense || 0);
  const net = Number(data.net_income ?? (morning + returning - expense));
  const morningTarget = Number(data.morning_target || currentDay.morning_target || 50000);
  const returnTarget = Number(data.return_target || currentDay.return_target || 120000);

  $('greeting').textContent = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' }).format(new Date());
  $('todayMorning').textContent = rupiah(morning);
  $('todayReturn').textContent = rupiah(returning);
  $('todayExpense').textContent = rupiah(expense);
  $('todayNet').textContent = rupiah(net);
  $('morningTargetLabel').textContent = `Target ${shortRp(morningTarget)}`;
  $('returnTargetLabel').textContent = `Target ${shortRp(returnTarget)}`;
  $('buildMinutes').textContent = `${data.build_minutes || 0} menit`;
  $('buildOutput').textContent = data.build_output || 'Belum ada output hari ini.';
  $('energyScore').textContent = data.energy_score ? `Energi ${data.energy_score}/5` : 'Energi belum diisi';

  $('dayType').value = currentDay.day_type || 'cash';
  $('morningTarget').value = morningTarget;
  $('returnTarget').value = returnTarget;
  $('buildMinutesInput').value = currentDay.build_minutes || 0;
  $('buildOutputInput').value = currentDay.build_output || '';
  $('energyScoreInput').value = currentDay.energy_score || '';
}

function renderMonth(rows) {
  const net = rows.reduce((sum, row) => sum + Number(row.net_income || 0), 0);
  const target = 6000000;
  const percent = Math.min(100, Math.round((net / target) * 100));
  $('monthNet').textContent = rupiah(net);
  $('workDayCount').textContent = `${rows.filter(r => Number(r.gross_income || 0) > 0).length} hari`;
  $('monthProgress').style.width = `${percent}%`;
  $('monthPercent').textContent = `${percent}%`;
}

function renderHistory(rows) {
  $('historyList').innerHTML = rows.length ? rows.map((row) => `
    <article class="history-item">
      <div><h4>${dateLabel(row.work_date)} · ${row.day_type || 'cash'}</h4><p>Pagi ${shortRp(row.morning_income)} · Pulang ${shortRp(row.return_income)} · Biaya ${shortRp(row.total_expense)}</p></div>
      <strong class="${Number(row.net_income || 0) >= 0 ? 'positive' : ''}">${rupiah(row.net_income)}</strong>
    </article>`).join('') : '<p class="muted">Belum ada riwayat.</p>';
}

$('authForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('authMessage').textContent = 'Memproses...';
  const { error } = await db.auth.signInWithPassword({ email: $('email').value, password: $('password').value });
  $('authMessage').textContent = error ? error.message : '';
});

$('signupBtn').addEventListener('click', async () => {
  $('authMessage').textContent = 'Membuat akun...';
  const { error } = await db.auth.signUp({ email: $('email').value, password: $('password').value });
  $('authMessage').textContent = error ? error.message : 'Akun dibuat. Cek email jika konfirmasi diwajibkan.';
});

$('logoutBtn').addEventListener('click', () => db.auth.signOut());

$('openWorkDayBtn').addEventListener('click', () => openDialog('workDayDialog'));
$('addMorningBtn').addEventListener('click', () => openOrder('morning'));
$('addReturnBtn').addEventListener('click', () => openOrder('return'));
$('addExpenseBtn').addEventListener('click', () => openDialog('expenseDialog'));
$('openBuildBtn').addEventListener('click', () => openDialog('buildDialog'));

function openOrder(segment) {
  $('orderSegment').value = segment;
  $('orderDialogTitle').textContent = segment === 'morning' ? 'Tambah order pagi' : 'Tambah order pulang';
  $('orderAmount').value = '';
  $('orderDistance').value = '';
  $('deliveryPoints').value = 1;
  $('pickupArea').value = '';
  $('destinationArea').value = '';
  $('orderNotes').value = '';
  openDialog('orderDialog');
}

$('workDayForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const { error } = await db.from('ojol_work_days').update({
    day_type: $('dayType').value,
    morning_target: Number($('morningTarget').value || 0),
    return_target: Number($('returnTarget').value || 0),
    status: 'active'
  }).eq('id', currentDay.id);
  if (error) return toast(error.message);
  closeDialogs(); toast('Target hari disimpan'); await loadDashboard();
});

$('orderForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const segment = $('orderSegment').value;
  const { error } = await db.from('ojol_orders').insert({
    work_day_id: currentDay.id,
    segment,
    platform: $('platform').value,
    amount: Number($('orderAmount').value || 0),
    distance_km: $('orderDistance').value ? Number($('orderDistance').value) : null,
    delivery_points: Number($('deliveryPoints').value || 1),
    pickup_area: $('pickupArea').value || null,
    destination_area: $('destinationArea').value || null,
    is_return_order: segment === 'return',
    accepted: true,
    accepted_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    notes: $('orderNotes').value || null
  });
  if (error) return toast(error.message);
  closeDialogs(); toast('Order tersimpan'); await loadDashboard();
});

$('expenseForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const { error } = await db.from('ojol_expenses').insert({
    work_day_id: currentDay.id,
    expense_date: today(),
    category: $('expenseCategory').value,
    amount: Number($('expenseAmount').value || 0),
    notes: $('expenseNotes').value || null
  });
  if (error) return toast(error.message);
  $('expenseAmount').value = '';
  $('expenseNotes').value = '';
  closeDialogs(); toast('Biaya tersimpan'); await loadDashboard();
});

$('buildForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const { error } = await db.from('ojol_work_days').update({
    build_minutes: Number($('buildMinutesInput').value || 0),
    build_output: $('buildOutputInput').value || null,
    energy_score: $('energyScoreInput').value ? Number($('energyScoreInput').value) : null
  }).eq('id', currentDay.id);
  if (error) return toast(error.message);
  closeDialogs(); toast('Progres disimpan'); await loadDashboard();
});

async function applySession(session) {
  user = session?.user || null;
  $('authView').classList.toggle('hidden', !!user);
  $('appView').classList.toggle('hidden', !user);
  if (user) await loadDashboard();
}

db.auth.onAuthStateChange((_event, session) => applySession(session));
db.auth.getSession().then(({ data }) => applySession(data.session));