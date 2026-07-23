(() => {
  const historyList = document.getElementById('historyList');
  if (!historyList) return;

  function attachHistoryLinks() {
    historyList.querySelectorAll('.history-item').forEach((item) => {
      if (item.dataset.clickReady === '1') return;

      const title = item.querySelector('h4')?.textContent || '';
      const matchedDate = title.match(/(\d{1,2})\s([A-Za-z]{3})/);
      const rowIndex = Array.from(historyList.querySelectorAll('.history-item')).indexOf(item);
      const rows = window.__orderanHistoryRows || [];
      const row = rows[rowIndex];

      if (!row?.work_date) return;

      item.dataset.clickReady = '1';
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

  const observer = new MutationObserver(attachHistoryLinks);
  observer.observe(historyList, { childList: true, subtree: true });

  document.addEventListener('orderan:history-rendered', attachHistoryLinks);
  setTimeout(attachHistoryLinks, 500);
})();
