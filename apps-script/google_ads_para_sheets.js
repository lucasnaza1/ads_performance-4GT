// ============================================================
// 4GrowthBR — Google Ads MCC → Google Sheets
// Apps Script — cole em: Extensions > Apps Script
// ============================================================
// CONFIGURAÇÃO — preencha antes de rodar
// ============================================================

const CONFIG = {
  MCC_CUSTOMER_ID: '568-079-1205',       // Seu MCC
  SPREADSHEET_ID: 'COLE_O_ID_DA_SUA_PLANILHA_AQUI', // ID da URL da planilha
  DIAS_ATRAS: 30,                         // Período padrão de pull
};

// ============================================================
// PONTO DE ENTRADA — rode esta função manualmente ou agende
// ============================================================

function rodarTudo() {
  const planilha = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  sincronizarGoogleAds(planilha);
  Logger.log('✅ Google Ads sincronizado com sucesso!');
}

// ============================================================
// GOOGLE ADS — puxar via Google Ads Scripts (MCC)
// ============================================================
// ATENÇÃO: Este script deve ser colado em:
// Google Ads > Tools > Bulk Actions > Scripts (nível MCC)
// O Apps Script do Google Sheets NÃO tem acesso direto à
// Google Ads API sem OAuth2 — o caminho mais simples é via
// Google Ads Scripts que já roda autenticado dentro da conta.
// ============================================================

// ---- Cole este bloco no Google Ads Scripts (MCC) ----

function main() {
  const SPREADSHEET_ID = 'COLE_O_ID_DA_SUA_PLANILHA_AQUI';
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  sincronizarCampanhas(ss);
  sincronizarKPIs(ss);
  sincronizarLinhaTempo(ss);

  Logger.log('✅ Dados Google Ads exportados para Sheets!');
}

// ── Aba: google_campanhas ────────────────────────────────────
function sincronizarCampanhas(ss) {
  let aba = ss.getSheetByName('google_campanhas');
  if (!aba) aba = ss.insertSheet('google_campanhas');
  aba.clearContents();

  const cabecalho = [
    'data_extracao', 'conta_id', 'conta_nome',
    'campanha_id', 'campanha_nome', 'status',
    'investimento', 'impressoes', 'cliques',
    'conversoes', 'cpa', 'ctr', 'cpc_medio', 'roas'
  ];
  aba.appendRow(cabecalho);

  const dataFim   = new Date();
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - 30);

  const formatarData = d => Utilities.formatDate(d, 'America/Sao_Paulo', 'yyyy-MM-dd');
  const hoje = formatarData(new Date());

  // Itera sobre todas as contas filhas do MCC
  const iteradorContas = MccApp.accounts().get();
  while (iteradorContas.hasNext()) {
    const conta = iteradorContas.next();
    MccApp.select(conta);

    const iteradorCamp = AdsApp.campaigns()
      .withCondition("Status IN ['ENABLED', 'PAUSED']")
      .forDateRange(formatarData(dataInicio), formatarData(dataFim))
      .get();

    while (iteradorCamp.hasNext()) {
      const camp  = iteradorCamp.next();
      const stats = camp.getStatsFor(formatarData(dataInicio), formatarData(dataFim));

      const invest    = stats.getCost();
      const impressoes = stats.getImpressions();
      const cliques   = stats.getClicks();
      const conv      = stats.getConversions();
      const ctr       = impressoes > 0 ? (cliques / impressoes * 100) : 0;
      const cpa       = conv > 0 ? (invest / conv) : 0;
      const cpc       = cliques > 0 ? (invest / cliques) : 0;
      const roas      = invest > 0 ? (stats.getConversionValue() / invest) : 0;

      aba.appendRow([
        hoje,
        conta.getCustomerId(),
        conta.getName(),
        camp.getId(),
        camp.getName(),
        camp.isEnabled() ? 'ativa' : 'pausada',
        invest.toFixed(2),
        impressoes,
        cliques,
        conv.toFixed(0),
        cpa.toFixed(2),
        ctr.toFixed(2),
        cpc.toFixed(2),
        roas.toFixed(2),
      ]);
    }
  }
}

// ── Aba: google_kpis (totais consolidados) ───────────────────
function sincronizarKPIs(ss) {
  let aba = ss.getSheetByName('google_kpis');
  if (!aba) aba = ss.insertSheet('google_kpis');
  aba.clearContents();

  aba.appendRow([
    'data_extracao', 'conta_id', 'conta_nome',
    'investimento_total', 'impressoes_total', 'cliques_total',
    'conversoes_total', 'cpa_medio', 'ctr_medio', 'roas_medio'
  ]);

  const hoje = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
  const dataInicio = new Date(); dataInicio.setDate(dataInicio.getDate() - 30);
  const fmtInicio = Utilities.formatDate(dataInicio, 'America/Sao_Paulo', 'yyyy-MM-dd');

  const iteradorContas = MccApp.accounts().get();
  while (iteradorContas.hasNext()) {
    const conta = iteradorContas.next();
    MccApp.select(conta);

    const stats = AdsApp.currentAccount().getStatsFor(fmtInicio, hoje);
    const invest    = stats.getCost();
    const impressoes = stats.getImpressions();
    const cliques   = stats.getClicks();
    const conv      = stats.getConversions();

    aba.appendRow([
      hoje,
      conta.getCustomerId(),
      conta.getName(),
      invest.toFixed(2),
      impressoes,
      cliques,
      conv.toFixed(0),
      conv > 0 ? (invest / conv).toFixed(2) : 0,
      impressoes > 0 ? (cliques / impressoes * 100).toFixed(2) : 0,
      invest > 0 ? (stats.getConversionValue() / invest).toFixed(2) : 0,
    ]);
  }
}

// ── Aba: google_linha_tempo (diário) ────────────────────────
function sincronizarLinhaTempo(ss) {
  let aba = ss.getSheetByName('google_linha_tempo');
  if (!aba) aba = ss.insertSheet('google_linha_tempo');
  aba.clearContents();

  aba.appendRow([
    'data', 'conta_id', 'investimento', 'cliques', 'conversoes', 'cpa'
  ]);

  const hoje = new Date();
  const iteradorContas = MccApp.accounts().get();

  while (iteradorContas.hasNext()) {
    const conta = iteradorContas.next();
    MccApp.select(conta);

    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(hoje.getDate() - i);
      const dStr = Utilities.formatDate(d, 'America/Sao_Paulo', 'yyyy-MM-dd');

      const stats = AdsApp.currentAccount().getStatsFor(dStr, dStr);
      const invest = stats.getCost();
      const conv   = stats.getConversions();

      aba.appendRow([
        dStr,
        conta.getCustomerId(),
        invest.toFixed(2),
        stats.getClicks(),
        conv.toFixed(0),
        conv > 0 ? (invest / conv).toFixed(2) : 0,
      ]);
    }
  }
}

// ============================================================
// AGENDAMENTO — configure em Google Ads Scripts
// ============================================================
// 1. Abra o script no Google Ads (Tools > Scripts)
// 2. Clique em "Frequency" e escolha: Daily
// 3. O script vai rodar todo dia de madrugada automaticamente
// ============================================================
