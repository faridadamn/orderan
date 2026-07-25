let gpsBusy = false;
let gpsFabActivityId = null;

const gpsStatus = (message, state = '') => {
  const el = document.getElementById('gpsStatus');
  if (!el) return;
  el.textContent = message;
  el.dataset.state = state;
};

const getCurrentPosition = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) return reject(new Error('GPS tidak didukung browser ini'));
  navigator.geolocation.getCurrentPosition(resolve, reject, {
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 0
  });
});

async function getLatestGpsPoint() {
  if (!currentDay) return null;
  const rows = await restQuery('ojol_gps_points', `select=*&work_day_id=eq.${currentDay.id}&order=captured_at.desc&limit=1`);
  return rows?.[0] || null;
}

async function checkpointCount(activityLogId) {
  if (!activityLogId) return 0;
  const rows = await restQuery('ojol_gps_points', `select=id&activity_log_id=eq.${activityLogId}&event_type=eq.manual`);
  return rows?.length || 0;
}

async function refreshCheckpointBadge() {
  const badge = document.getElementById('gpsCheckpointCount');
  if (!badge) return;
  const count = await checkpointCount(gpsFabActivityId);
  badge.textContent = String(count);
  badge.classList.toggle('hidden', count === 0);
}

function legType(previousEvent, currentEvent) {
  if (currentEvent === 'offbid') return 'return_home';
  if (currentEvent === 'order_start') return 'empty_to_order';
  if (currentEvent === 'manual' || currentEvent === 'order_finish') return 'order_trip';
  if ((previousEvent === 'order_finish' || previousEvent === 'manual') && currentEvent === 'order_start') return 'empty_to_order';
  return 'general';
}

async function calculateRoadRoute(fromPoint, toPoint) {
  const coordinates = `${fromPoint.longitude},${fromPoint.latitude};${toPoint.longitude},${toPoint.latitude}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=polyline6&steps=false`;
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || data.code !== 'Ok' || !data.routes?.[0]) {
    throw new Error(data.message || 'Rute jalan tidak ditemukan');
  }
  return data.routes[0];
}

async function captureGpsEvent(eventType, activityLogId = null) {
  if (gpsBusy || !currentDay) return null;
  gpsBusy = true;
  const fab = document.getElementById('gpsCheckpointFab');
  if (fab) fab.disabled = true;
  gpsStatus(eventType === 'manual' ? 'Mencatat titik perjalanan…' : 'Mengambil GPS…', 'loading');

  try {
    const previous = await getLatestGpsPoint();
    const position = await getCurrentPosition();
    const c = position.coords;
    const created = await insertRow('ojol_gps_points', {
      work_day_id: currentDay.id,
      activity_log_id: activityLogId || null,
      event_type: eventType,
      latitude: c.latitude,
      longitude: c.longitude,
      accuracy_m: Number.isFinite(c.accuracy) ? Math.round(c.accuracy) : null,
      altitude_m: Number.isFinite(c.altitude) ? c.altitude : null,
      speed_mps: Number.isFinite(c.speed) ? c.speed : null,
      heading_deg: Number.isFinite(c.heading) ? c.heading : null,
      captured_at: new Date(position.timestamp).toISOString()
    });

    const point = created?.[0];
    let routeLabel = '';
    if (previous && point && previous.id !== point.id) {
      try {
        const route = await calculateRoadRoute(previous, point);
        await insertRow('ojol_route_legs', {
          work_day_id: currentDay.id,
          from_point_id: previous.id,
          to_point_id: point.id,
          leg_type: legType(previous.event_type, eventType),
          provider: 'osrm',
          profile: 'driving',
          distance_m: Math.round(route.distance),
          duration_s: Math.round(route.duration),
          geometry: route.geometry,
          estimated: true
        }, false);
        routeLabel = ` · ${(route.distance / 1000).toFixed(1)} km rute jalan`;
      } catch (routeError) {
        console.warn('GPS tersimpan, routing gagal', routeError);
        routeLabel = ' · rute belum dihitung';
      }
    }

    const accuracy = Number.isFinite(c.accuracy) ? `akurasi ±${Math.round(c.accuracy)} m` : 'akurasi tidak tersedia';
    if (eventType === 'manual') {
      await refreshCheckpointBadge();
      const count = await checkpointCount(activityLogId);
      gpsStatus(`Titik ${count} tersimpan · ${accuracy}${routeLabel}`, 'success');
      toast(`Titik ${count} tersimpan`);
      navigator.vibrate?.(60);
    } else {
      gpsStatus(`GPS tersimpan · ${accuracy}${routeLabel}`, 'success');
    }
    return point;
  } catch (error) {
    console.error(error);
    const message = error.code === 1
      ? 'Izin lokasi ditolak. Aktifkan GPS dan izinkan lokasi.'
      : error.code === 2
        ? 'Lokasi tidak tersedia. Coba di area terbuka.'
        : error.code === 3
          ? 'GPS terlalu lama merespons. Coba lagi.'
          : (error.message || 'Gagal mengambil GPS');
    gpsStatus(message, 'error');
    toast(message);
    return null;
  } finally {
    gpsBusy = false;
    if (fab) fab.disabled = false;
  }
}

window.updateGpsFab = async (status, activityLogId = null) => {
  const fab = document.getElementById('gpsCheckpointFab');
  if (!fab) return;
  const visible = status === 'in_app' && !!activityLogId;
  gpsFabActivityId = visible ? activityLogId : null;
  fab.classList.toggle('hidden', !visible);
  if (visible) await refreshCheckpointBadge();
};

window.addEventListener('orderan:activity-changed', async (event) => {
  const detail = event.detail || {};
  if (detail.eventType) await captureGpsEvent(detail.eventType, detail.activityLogId || null);
});

document.getElementById('gpsCheckpointFab')?.addEventListener('click', async () => {
  if (!gpsFabActivityId || gpsBusy) return;
  await captureGpsEvent('manual', gpsFabActivityId);
});

window.captureGpsEvent = captureGpsEvent;

(async function initializeGpsFab() {
  try {
    if (!user || !currentDay || typeof getActiveActivity !== 'function') return;
    const active = await getActiveActivity();
    window.updateGpsFab(active?.activity_type || 'offbid', active?.id || null);
  } catch (error) {
    console.warn('Gagal memuat status FAB GPS', error);
  }
})();