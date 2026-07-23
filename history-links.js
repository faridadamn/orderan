(() => {
  const list = document.getElementById('historyList');
  if (!list) return;

  let decorating = false;

  async function decorateHistory() {
    if (decorating || !window.user) return;
    const items = [...list.querySelectorAll('.history-item')];
    if (!items.length || items.every((item) => item.dataset.detailReady === 'true')) return;

    decorating = true;
    try {
      const rows = await restQuery('ojol_daily_summary', 'select=work_day_id,work_date&order=work_date.desc&limit=7');
      items.forEach((item, index) => {
        const row = rows?.[index];
        if (!row) return;
        item.dataset.detailReady = 'true';
        item.tabIndex = 0;
        item.setAttribute('role', 'link');
        item.setAttribute('aria-label', `Buka detail ${row.work_date}`);
        item.classList.add('history-clickable');
        const open = () => { window.location.href = `detail.html?date=${encodeURIComponent(row.work_date)}&id=${encodeURIComponent(row.work_day_id)}`; };
        item.addEventListener('click', open);
        item.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            open();
          }
        });
        const arrow = document.createElement('span');
        arrow.className = 'history-arrow';
        arrow.textContent = '›';
        item.appendChild(arrow);
      });
    } catch (error) {
      console.error('Gagal memasang link riwayat', error);
    } finally {
      decorating = false;
    }
  }

  new MutationObserver(decorateHistory).observe(list, { childList: true });
  setTimeout(decorateHistory, 300);
})();
