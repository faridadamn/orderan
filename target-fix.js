// Target bulanan Orderan dihitung dari pendapatan kotor, bukan pendapatan bersih.
renderMonth = function renderMonthGross(rows) {
  const gross = rows.reduce((sum, row) => sum + Number(row.gross_income || 0), 0);
  const target = 6000000;
  const percent = Math.min(100, Math.round((gross / target) * 100));

  $('monthNet').textContent = rupiah(gross);
  $('workDayCount').textContent = `${rows.filter((row) => Number(row.gross_income || 0) > 0).length} hari`;
  $('monthProgress').style.width = `${percent}%`;
  $('monthPercent').textContent = `${percent}%`;
};
