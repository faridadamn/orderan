let activeActivity = null;
let timerStartedAt = null;
let timerTick = null;

const durationLabel = (minutes) => {
  const total = Math.max(0, Math.floor(Number(minutes || 0)));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours}j ${mins}m`;
};

const clockLabel = (seconds) => {
  const total = Math.max(0, Math.floor(seconds));
  const hours = String(Math.floor(total / 3600)).padStart(2, '0');
  const mins = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const secs = String(total % 60).padStart(2, '0');
  return `${hours}:${mins}:${secs}`;
};

function setTimerButtons(status) {
  $('startOnbidBtn').classList.toggle('hidden', status !== 'offbid');
  $('startInAppBtn').classList.toggle('hidden', status !== 'onbid');
  $('finishOrderBtn').classList.toggle('hidden', status !== 'in_app');
  $('offbidBtn').classList.toggle('hidden', status === 'offbid');

  $('activityStatus').textContent = status === 'onbid'
    ? 'Onbid — cari order'
    : status === 'in_app'
      ? 'In-app — bawa order'
      : 'Offbid';

  document.querySelector('.timer-card')?.classList.toggle('is-active', status !== 'offbid');
  document.querySelector('.timer-card')?.classList.toggle('is-order', status === 'in_app');
}

function startLiveClock(startedAt) {
  timerStartedAt = startedAt ? new Date(startedAt) : null;
  clearInterval(timerTick);

  const render = () => {
    if (!timerStartedAt) {
      $('liveTimer').textContent = '00:00:00';
      return;
    }
    $('liveTimer').textContent = clockLabel((Date.now() - timerStartedAt.getTime()) / 1000);
  };

  render();
  timerTick = setInterval(render, 1000);
}

async function getActiveActivity() {
  const rows = await restQuery(
    'ojol_activity_logs',
    'select=*&ended_at=is.null&order=started_at.desc&limit=1'
  );
  return rows?.[0] || null;
}

async function loadTimerStatus() {
  if (!user || !currentDay) return;

  try {
    const [summaryRows, active] = await Promise.all([
      restQuery('ojol_activity_summary', `select=*&work_day_id=eq.${currentDay.id}&limit=1`),
      getActiveActivity()
    ]);

    const summary = summaryRows?.[0] || {};
    activeActivity = active;

    $('onbidDuration').textContent = durationLabel(summary.onbid_minutes);
    $('inAppDuration').textContent = durationLabel(summary.in_app_minutes);
    $('totalOnlineDuration').textContent = durationLabel(summary.total_online_minutes);

    const status = active?.activity_type || 'offbid';
    setTimerButtons(status);
    startLiveClock(active?.started_at || null);
  } catch (error) {
    console.error(error);
    toast(error.message || 'Gagal memuat timer');
  }
}

async function closeActiveActivity() {
  const active = await getActiveActivity();
  if (!active) return;
  await updateRows(
    'ojol_activity_logs',
    `id=eq.${active.id}`,
    { ended_at: new Date().toISOString() }
  );
}

async function startActivity(type) {
  if (!currentDay) currentDay = await ensureWorkDay();

  await closeActiveActivity();
  await insertRow('ojol_activity_logs', {
    work_day_id: currentDay.id,
    activity_type: type,
    started_at: new Date().toISOString()
  }, false);

  const workDayUpdate = {
    status: 'active',
    end_time: null
  };
  if (!currentDay.start_time) workDayUpdate.start_time = new Date().toISOString();
  await updateRows('ojol_work_days', `id=eq.${currentDay.id}`, workDayUpdate);
  currentDay = { ...currentDay, ...workDayUpdate };

  await loadTimerStatus();
}

$('startOnbidBtn').addEventListener('click', async () => {
  try {
    await startActivity('onbid');
    toast('Onbid dimulai');
  } catch (error) {
    toast(error.message || 'Gagal memulai onbid');
  }
});

$('startInAppBtn').addEventListener('click', async () => {
  try {
    await startActivity('in_app');
    toast('Status berubah ke in-app');
  } catch (error) {
    toast(error.message || 'Gagal mengubah status');
  }
});

$('finishOrderBtn').addEventListener('click', async () => {
  try {
    await startActivity('onbid');
    toast('Order selesai, kembali onbid');
  } catch (error) {
    toast(error.message || 'Gagal menyelesaikan order');
  }
});

$('offbidBtn').addEventListener('click', async () => {
  try {
    await closeActiveActivity();
    await updateRows('ojol_work_days', `id=eq.${currentDay.id}`, {
      status: 'completed',
      end_time: new Date().toISOString()
    });
    activeActivity = null;
    setTimerButtons('offbid');
    startLiveClock(null);
    await loadTimerStatus();
    toast('Offbid. Hari kerja selesai');
  } catch (error) {
    toast(error.message || 'Gagal offbid');
  }
});

async function waitForTimerReady() {
  if (user && currentDay) {
    await loadTimerStatus();
    return;
  }
  setTimeout(waitForTimerReady, 500);
}

waitForTimerReady();
setInterval(() => {
  if (user && currentDay) loadTimerStatus();
}, 30000);
