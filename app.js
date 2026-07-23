const SUPABASE_URL = 'https://kipcvugwlghonpgvitjk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpcGN2dWd3bGdob25wZ3ZpdGprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMDUzNTgsImV4cCI6MjA5MjU4MTM1OH0.orjTj18nAm0HDLffgWzJpaZM4wfW2-L_C8ukzYKX88Y';
const SESSION_KEY = 'orderan_session';

const $ = (id) => document.getElementById(id);
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const rupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n || 0));
const shortRp = (n) => `Rp${Math.round(Number(n || 0) / 1000)} rb`;
const dateLabel = (date) => new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(`${date}T12:00:00+07:00`));

let session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
let user = session?.user || null;
let currentDay = null;

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  setTimeout(() => $('toast').classList.remove('show'), 2600);
}

function setAuthMessage(message) { $('authMessage').textContent = message || ''; }
function openDialog(id) { $(id).showModal(); }
function closeDialogs() { document.querySelectorAll('dialog[open]').forEach((d) => d.close()); }
document.querySelectorAll('.close-btn').forEach((b) => b.addEventListener('click', closeDialogs));

async function request(path, options = {}, useAuth = true) {
  const headers = {
    apikey: SUPABASE_KEY,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (useAuth && session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

  const response = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || data?.hint || `HTTP ${response.status}`);
  return data;
}

async function signIn(email, password) {
  const data = await request('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }, false);
  session = data;
  user = data.user;
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  await applySession();
}

async function signUp(email, password) {
  return request('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }, false);
}

function restQuery(table, query = '') {
  return request(`/rest/v1/${table}${query ? `?${query}` : ''}`, { headers: { Accept: 'application/json' } });
}

async function insertRow(table, payload, select = true) {
  return request(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { Prefer: select ? 'return=representation' : 'return=minimal' },
    body: JSON.stringify(payload)
  });
}

async function updateRows(table, query, payload) {
  return request(`/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(payload)
  });
}

async function ensureWorkDay() {
  const rows = await restQuery('ojol_work_days', `select=*&work_date=eq.${today()}&limit=1`);
  if (rows?.[0]) return rows[0];
  const created = await insertRow('ojol_work_days', { work_date: today() });
  return created[0];
}

async function loadDashboard() {
  try {
    currentDay = await ensureWorkDay();
    const start = new Date();
    start.setDate(1);
    const startDate = start.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const [todayRows, monthRows, historyRows] = await Promise.all([
      restQuery('ojol_daily_summary', `select=*&work_date=eq.${today()}&limit=1`),
      restQuery('ojol_daily_summary', `select=*&work_date=gte.${startDate}&work_date=lte.${today()}`),
      restQuery('ojol_daily_summary', 'select=*&order=work_date.desc&limit=7')
    ]);
    renderToday(todayRows?.[0] || currentDay);
    renderMonth(monthRows || []);
    renderHistory(historyRows || []);
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
  $('historyList').innerHTML = rows.length ? rows.map((row) => `<article class="history-item"><div><h4>${dateLabel(row.work_date)} · ${row.day_type || 'cash'}</h4><p>Pagi ${shortRp(row.morning_income)} · Pulang ${shortRp(row.return_income)} · Biaya ${shortRp(row.total_expense)}</p></div><strong class="${Number(row.net_income || 0) >= 0 ? 'positive' : ''}">${rupiah(row.net_income)}</strong></article>`).join('') : '<p class="muted">Belum ada riwayat.</p>';
}

$('authForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  setAuthMessage('Memproses...');
  try {
    await signIn($('email').value.trim(), $('password').value);
    setAuthMessage('');
  } catch (error) {
    setAuthMessage(error.message || 'Login gagal');
  }
});

$('signupBtn').addEventListener('click', async () => {
  const email = $('email').value.trim();
  const password = $('password').value;
  if (!email || password.length < 6) return setAuthMessage('Isi email dan password minimal 6 karakter.');
  setAuthMessage('Membuat akun...');
  try {
    const data = await signUp(email, password);
    if (data?.access_token) {
      session = data;
      user = data.user;
      localStorage.setItem(SESSION_KEY, JSON.stringify(data));
      await applySession();
    } else {
      setAuthMessage('Akun dibuat. Cek email untuk konfirmasi, lalu tekan Masuk.');
    }
  } catch (error) {
    setAuthMessage(error.message || 'Gagal membuat akun');
  }
});

$('logoutBtn').addEventListener('click', async () => {
  try { if (session?.access_token) await request('/auth/v1/logout', { method: 'POST' }); } catch {}
  localStorage.removeItem(SESSION_KEY);
  session = null; user = null; currentDay = null;
  await applySession();
});

$('openWorkDayBtn').addEventListener('click', () => openDialog('workDayDialog'));
$('addMorningBtn').addEventListener('click', () => openOrder('morning'));
$('addReturnBtn').addEventListener('click', () => openOrder('return'));
$('addExpenseBtn').addEventListener('click', () => openDialog('expenseDialog'));
$('openBuildBtn').addEventListener('click', () => openDialog('buildDialog'));

function openOrder(segment) {
  $('orderSegment').value = segment;
  $('orderDialogTitle').textContent = segment === 'morning' ? 'Tambah order pagi' : 'Tambah order pulang';
  $('orderAmount').value = ''; $('orderDistance').value = ''; $('deliveryPoints').value = 1;
  $('pickupArea').value = ''; $('destinationArea').value = ''; $('orderNotes').value = '';
  openDialog('orderDialog');
}

$('workDayForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await updateRows('ojol_work_days', `id=eq.${currentDay.id}`, { day_type: $('dayType').value, morning_target: Number($('morningTarget').value || 0), return_target: Number($('returnTarget').value || 0), status: 'active' });
    closeDialogs(); toast('Target hari disimpan'); await loadDashboard();
  } catch (error) { toast(error.message); }
});

$('orderForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const segment = $('orderSegment').value;
  try {
    await insertRow('ojol_orders', { work_day_id: currentDay.id, segment, platform: $('platform').value, amount: Number($('orderAmount').value || 0), distance_km: $('orderDistance').value ? Number($('orderDistance').value) : null, delivery_points: Number($('deliveryPoints').value || 1), pickup_area: $('pickupArea').value || null, destination_area: $('destinationArea').value || null, is_return_order: segment === 'return', accepted: true, accepted_at: new Date().toISOString(), completed_at: new Date().toISOString(), notes: $('orderNotes').value || null }, false);
    closeDialogs(); toast('Order tersimpan'); await loadDashboard();
  } catch (error) { toast(error.message); }
});

$('expenseForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await insertRow('ojol_expenses', { work_day_id: currentDay.id, expense_date: today(), category: $('expenseCategory').value, amount: Number($('expenseAmount').value || 0), notes: $('expenseNotes').value || null }, false);
    $('expenseAmount').value = ''; $('expenseNotes').value = '';
    closeDialogs(); toast('Biaya tersimpan'); await loadDashboard();
  } catch (error) { toast(error.message); }
});

$('buildForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await updateRows('ojol_work_days', `id=eq.${currentDay.id}`, { build_minutes: Number($('buildMinutesInput').value || 0), build_output: $('buildOutputInput').value || null, energy_score: $('energyScoreInput').value ? Number($('energyScoreInput').value) : null });
    closeDialogs(); toast('Progres disimpan'); await loadDashboard();
  } catch (error) { toast(error.message); }
});

async function applySession() {
  const loggedIn = !!user;
  $('authView').classList.toggle('hidden', loggedIn);
  $('appView').classList.toggle('hidden', !loggedIn);
  if (loggedIn) await loadDashboard();
}

window.addEventListener('error', (event) => setAuthMessage(`Aplikasi gagal dimuat: ${event.message}`));
applySession();
