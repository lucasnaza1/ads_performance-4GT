// ============================================================
// ESTADO GLOBAL
// ============================================================
let DADOS = {
  metaKpi: null, googleKpi: null,
  metaCamp: [], googleCamp: [],
  metaTimeline: [], googleTimeline: [],
};
let donutChart, lineChart, barChart;

// ============================================================
// CARREGAMENTO DE CSV
// ============================================================
async function carregarCSV(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: r => resolve(r.data),
      error: e => reject(e),
    });
  });
}

function fmt(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return '—';
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtN(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return '—';
  return n.toLocaleString('pt-BR');
}
function fmtPct(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return '—';
  return n.toFixed(2) + '%';
}

// ============================================================
// RENDERIZAÇÃO
// ============================================================
function renderKPIs() {
  const m = DADOS.metaKpi;
  const g = DADOS.googleKpi;

  const metaInvest  = parseFloat(m?.investimento_total || 0);
  const googleInvest = parseFloat(g?.investimento_total || 0);
  const totalInvest = metaInvest + googleInvest;

  const metaImp    = parseInt(m?.impressoes_total || 0);
  const googleImp  = parseInt(g?.impressoes_total || 0);
  const metaClk    = parseInt(m?.cliques_total || 0);
  const googleClk  = parseInt(g?.cliques_total || 0);
  const metaConv   = parseFloat(m?.conversoes_total || 0);
  const googleConv = parseFloat(g?.conversoes_total || 0);
  const totalConv  = metaConv + googleConv;
  const metaCPA    = parseFloat(m?.cpa_medio || 0);
  const googleCPA  = parseFloat(g?.cpa_medio || 0);
  const avgCPA     = totalConv > 0 ? totalInvest / totalConv : 0;
  const metaCTR    = parseFloat(m?.ctr_medio || 0);
  const googleCTR  = parseFloat(g?.ctr_medio || 0);
  const avgCTR     = (metaCTR + googleCTR) / 2;

  const kpis = [
    { label: 'Investimento Total', val: fmt(totalInvest), sub: 'Período selecionado', orange: true },
    { label: 'Impressões', val: fmtN(metaImp + googleImp), sub: 'Meta + Google' },
    { label: 'Cliques', val: fmtN(metaClk + googleClk), sub: 'Meta + Google' },
    { label: 'Conversões', val: fmtN(totalConv), sub: 'Leads / Vendas' },
    { label: 'CPA Médio', val: fmt(avgCPA), sub: 'Custo por conversão' },
    { label: 'CTR Médio', val: fmtPct(avgCTR), sub: 'Meta + Google' },
  ];

  document.getElementById('kpi-strip').innerHTML = kpis.map(k => `
    <div class="kpi">
      <div class="kpi-plat">${k.label}</div>
      <div class="kpi-val ${k.orange ? 'orange' : ''}">${k.val}</div>
      <div class="kpi-label">${k.sub}</div>
    </div>
  `).join('');
}

function renderTabela() {
  const plat   = document.getElementById('sel-plat').value;
  const status = document.getElementById('sel-status').value;

  let campanhas = [];
  if (plat !== 'google') DADOS.metaCamp.forEach(c => campanhas.push({ ...c, _plat: 'meta' }));
  if (plat !== 'meta')   DADOS.googleCamp.forEach(c => campanhas.push({ ...c, _plat: 'google' }));
  if (status !== 'all')  campanhas = campanhas.filter(c => c.status === status);

  document.getElementById('camp-count').textContent = campanhas.length + ' campanhas';

  const body = document.getElementById('camp-body');
  if (campanhas.length === 0) {
    body.innerHTML = `<tr><td colspan="9" class="empty">Nenhuma campanha encontrada</td></tr>`;
    return;
  }

  body.innerHTML = campanhas.map(c => {
    const ativo = c.status === 'ativa';
    const ctr = parseFloat(c.ctr || 0);
    const barPct = Math.min(ctr * 10, 100);
    const nome = c.campanha_nome || c.nome || '—';
    const plataforma = c._plat;
    return `<tr>
      <td><span class="badge ${ativo ? 'badge-on' : 'badge-off'}">${ativo ? 'Ativa' : 'Pausada'}</span></td>
      <td class="camp-nome" title="${nome}">${nome}</td>
      <td><span class="badge ${plataforma === 'meta' ? 'badge-meta' : 'badge-google'}">${plataforma === 'meta' ? 'Meta' : 'Google'}</span></td>
      <td class="invest">${fmt(c.investimento)}</td>
      <td>${fmtN(c.impressoes)}</td>
      <td>${fmtN(c.cliques)}</td>
      <td style="font-weight:600">${fmtN(c.conversoes)}</td>
      <td>${fmt(c.cpa)}</td>
      <td>
        ${fmtPct(c.ctr)}
        <div class="bar-w"><div class="bar-f" style="width:${barPct}%"></div></div>
      </td>
    </tr>`;
  }).join('');
}

function renderPainelLateral() {
  const m = DADOS.metaKpi;
  const g = DADOS.googleKpi;

  const metaInvest  = parseFloat(m?.investimento_total || 0);
  const googleInvest = parseFloat(g?.investimento_total || 0);
  const total = metaInvest + googleInvest;
  const metaPct = total > 0 ? Math.round(metaInvest / total * 100) : 0;

  document.getElementById('donut-pct').textContent = metaPct + '%';
  document.getElementById('meta-invest').textContent = fmt(metaInvest);
  document.getElementById('google-invest').textContent = fmt(googleInvest);
  document.getElementById('meta-cpa').textContent = 'CPA ' + fmt(m?.cpa_medio);
  document.getElementById('google-cpa').textContent = 'CPA ' + fmt(g?.cpa_medio);
  document.getElementById('meta-roas').textContent = parseFloat(m?.roas_medio || 0).toFixed(1) + '×';
  document.getElementById('google-roas').textContent = parseFloat(g?.roas_medio || 0).toFixed(1) + '×';
  document.getElementById('meta-conv').textContent = fmtN(m?.conversoes_total);
  document.getElementById('google-conv').textContent = fmtN(g?.conversoes_total);
  document.getElementById('total-invest').textContent = fmt(total);
  document.getElementById('total-conv').textContent = fmtN(parseFloat(m?.conversoes_total || 0) + parseFloat(g?.conversoes_total || 0));

  if (donutChart) donutChart.destroy();
  donutChart = new Chart(document.getElementById('donut-chart'), {
    type: 'doughnut',
    data: {
      labels: ['Meta Ads', 'Google Ads'],
      datasets: [{ data: [metaInvest || 0.01, googleInvest || 0.01], backgroundColor: ['#4c8ff5', '#EA4335'], borderWidth: 0, hoverOffset: 4 }]
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + fmt(c.raw) } } } }
  });
}

function renderGraficos() {
  const metaTL   = DADOS.metaTimeline;
  const googleTL = DADOS.googleTimeline;

  // Unir datas
  const datas = [...new Set([...metaTL.map(d => d.data), ...googleTL.map(d => d.date_start || d.data)])].sort().slice(-30);
  const metaMap   = Object.fromEntries(metaTL.map(d => [d.data, d]));
  const googleMap = Object.fromEntries(googleTL.map(d => [d.date_start || d.data, d]));

  const labelsFormatados = datas.map(d => {
    const [, m, dia] = d.split('-');
    return `${dia}/${m}`;
  });

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#555', font: { size: 9 } }, grid: { color: '#1e1e1e' } },
      y: { ticks: { color: '#555', font: { size: 9 } }, grid: { color: '#1e1e1e' } }
    }
  };

  if (lineChart) lineChart.destroy();
  lineChart = new Chart(document.getElementById('line-chart'), {
    type: 'line',
    data: {
      labels: labelsFormatados,
      datasets: [
        { label: 'Meta CPA', data: datas.map(d => parseFloat(metaMap[d]?.cpa || 0)), borderColor: '#4c8ff5', backgroundColor: 'rgba(76,143,245,.06)', fill: true, tension: .4, pointRadius: 2, borderWidth: 2 },
        { label: 'Google CPA', data: datas.map(d => parseFloat(googleMap[d]?.cpa || 0)), borderColor: '#EA4335', backgroundColor: 'rgba(234,67,53,.06)', fill: true, tension: .4, pointRadius: 2, borderWidth: 2 },
      ]
    },
    options: { ...chartOpts, scales: { ...chartOpts.scales, y: { ...chartOpts.scales.y, ticks: { ...chartOpts.scales.y.ticks, callback: v => 'R$' + v } } } }
  });

  if (barChart) barChart.destroy();
  barChart = new Chart(document.getElementById('bar-chart'), {
    type: 'bar',
    data: {
      labels: labelsFormatados,
      datasets: [
        { label: 'Meta', data: datas.map(d => parseInt(metaMap[d]?.impressoes || 0)), backgroundColor: 'rgba(76,143,245,.7)', borderRadius: 3, borderWidth: 0 },
        { label: 'Google', data: datas.map(d => parseInt(googleMap[d]?.impressoes || 0)), backgroundColor: 'rgba(234,67,53,.7)', borderRadius: 3, borderWidth: 0 },
      ]
    },
    options: { ...chartOpts, scales: { ...chartOpts.scales, x: { ...chartOpts.scales.x, stacked: false }, y: { ...chartOpts.scales.y, stacked: false } } }
  });
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================
async function inicializar() {
  try {
    if (typeof SHEETS !== 'object' || !SHEETS) {
      throw new Error('Configuração SHEETS não encontrada. Verifique se assets/js/sheets.config.js está carregando.');
    }
    const sheetsUrls = Object.values(SHEETS);
    if (sheetsUrls.some(u => typeof u !== 'string' || u.trim() === '')) {
      throw new Error('Configuração inválida em SHEETS. Verifique assets/js/sheets.config.js.');
    }
    if (sheetsUrls.some(u => u.includes('SPREADSHEET_ID'))) {
      throw new Error('SPREADSHEET_ID ainda não foi substituído em assets/js/sheets.config.js.');
    }

    const [metaKpi, googleKpi, metaCamp, googleCamp, metaTL, googleTL] = await Promise.all([
      carregarCSV(SHEETS.meta_kpis),
      carregarCSV(SHEETS.google_kpis),
      carregarCSV(SHEETS.meta_campanhas),
      carregarCSV(SHEETS.google_campanhas),
      carregarCSV(SHEETS.meta_timeline),
      carregarCSV(SHEETS.google_timeline),
    ]);

    DADOS.metaKpi      = metaKpi[metaKpi.length - 1];
    DADOS.googleKpi    = googleKpi[googleKpi.length - 1];
    DADOS.metaCamp     = metaCamp;
    DADOS.googleCamp   = googleCamp;
    DADOS.metaTimeline = metaTL;
    DADOS.googleTimeline = googleTL;

    const dataEx = DADOS.metaKpi?.data_extracao || DADOS.googleKpi?.data_extracao || '—';
    document.getElementById('ultima-atualizacao').textContent = 'Atualizado em ' + dataEx;

    renderKPIs();
    renderTabela();
    renderPainelLateral();
    renderGraficos();

  } catch (e) {
    console.error(e);
    const box = document.getElementById('error-box');
    box.classList.remove('is-hidden');
    box.textContent = '⚠️ Erro ao carregar dados. Verifique se a planilha está publicada publicamente e os IDs estão corretos. Detalhe: ' + e.message;
    document.getElementById('kpi-strip').innerHTML = '';
  }
}

document.getElementById('sel-plat').onchange   = renderTabela;
document.getElementById('sel-status').onchange = renderTabela;

inicializar();
