(() => {
  const historyList = document.getElementById('historyList');
  if (!historyList) return;

  let latestRows = [];
  const originalRenderHistory = window.renderHistory;

  if (typeof originalRenderHistory === 'function') {
    window.renderHistory = function patchedRenderHistory(rows) {
      latestRows = Array.isArray(rows) ? rows : [];
      originalRenderHistory(rows);
      attachHistoryLinks();
    };
  }

  function attachHistoryLinks() {
    historyList.querySelectorAll('.history-item').forEach((item, index) => {
      const row = latestRows[index];
      if (!row?.work_date || item.dataset.clickReady === '1') return;

      item.dataset.clickReady = '1';
      item.dataset.workDate = row.work_date;
      item.setAttribute('role', 'link');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-label', `Buka detail ${row.work_date}`);
      item.classList.add('history-clickable');

      const go = () => {
        window.location.href = `detail.html?date=${encodeURIComponent(row.work_date)}`;
      };

      item.addEventListener('click', go);
      item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          go();
        }
      });
    });
  }
})();
