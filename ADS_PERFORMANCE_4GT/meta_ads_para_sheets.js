// ============================================================
// 4GrowthBR — Meta Ads → Google Sheets
// Cole em: Extensions > Apps Script (dentro da sua planilha)
// ============================================================

// ============================================================
// CONFIGURAÇÃO — preencha antes de rodar
// ============================================================

const META_CONFIG = {
  AD_ACCOUNT_ID: 'act_927050894349804',
  ACCESS_TOKEN: 'COLE_SEU_ACCESS_TOKEN_AQUI',
  // Como gerar o token:
  // 1. Acesse: https://developers.facebook.com/tools/explorer/
  // 2. Selecione seu App (ou crie um em developers.facebook.com)
  // 3. Adicione as permissões: ads_read, read_insights
  // 4. Clique em "Generate Access Token"
  // 5. Para token de longa duração (60 dias), use o endpoint de troca abaixo
  SPREADSHEET_ID: 'COLE_O_ID_DA_SUA_PLANILHA_AQUI',
  DIAS_ATRAS: 30,
  API_VERSION: 'v19.0',
};

// ============================================================
// PONTO DE ENTRADA
// ============================================================

function sincronizarMetaAds() {
  const ss = SpreadsheetApp.openById(META_CONFIG.SPREADSHEET_ID);
  
  try {
    puxarCampanhasMeta(ss);
    puxarKPIsMeta(ss);
    puxarLinhaTempoMeta(ss);
    Logger.log('✅ Meta Ads sincronizado com sucesso!');
  } catch (e) {
    Logger.log('❌ Erro: ' + e.message);
    throw e;
  }
}

// ── Helpers ──────────────────────────────────────────────────

function getDatas() {
  const hoje = new Date();
  const inicio = new Date();
  inicio.setDate(hoje.getDate() - META_CONFIG.DIAS_ATRAS);
  const fmt = d => Utilities.formatDate(d, 'America/Sao_Paulo', 'yyyy-MM-dd');
  return { inicio: fmt(inicio), fim: fmt(hoje), hoje: fmt(hoje) };
}

function chamarAPI(endpoint, params) {
  const base = `https://graph.facebook.com/${META_CONFIG.API_VERSION}`;
  const query = Object.entries({ access_token: META_CONFIG.ACCESS_TOKEN, ...params })
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const url = `${base}/${endpoint}?${query}`;
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const json = JSON.parse(resp.getContentText());
  if (json.error) throw new Error(`Meta API: ${json.error.message}`);
  return json;
}

function garantirAba(ss, nome, cabecalho) {
  let aba = ss.getSheetByName(nome);
  if (!aba) aba = ss.insertSheet(nome);
  aba.clearContents();
  aba.appendRow(cabecalho);
  return aba;
}

// ── Aba: meta_campanhas ──────────────────────────────────────

function puxarCampanhasMeta(ss) {
  const aba = garantirAba(ss, 'meta_campanhas', [
    'data_extracao', 'campanha_id', 'campanha_nome', 'status',
    'objetivo', 'investimento', 'impressoes', 'cliques',
    'conversoes', 'cpa', 'ctr', 'cpc', 'roas', 'alcance'
  ]);

  const { inicio, fim, hoje } = getDatas();

  // Buscar campanhas
  const campanhas = chamarAPI(`${META_CONFIG.AD_ACCOUNT_ID}/campaigns`, {
    fields: 'id,name,status,objective',
    limit: 100,
  });

  if (!campanhas.data) return;

  campanhas.data.forEach(camp => {
    // Buscar insights por campanha
    try {
      const insights = chamarAPI(`${camp.id}/insights`, {
        fields: 'spend,impressions,clicks,actions,action_values,reach,ctr,cpc',
        time_range: JSON.stringify({ since: inicio, until: fim }),
        level: 'campaign',
      });

      if (!insights.data || insights.data.length === 0) {
        aba.appendRow([hoje, camp.id, camp.name, camp.status.toLowerCase(), camp.objective,
          0, 0, 0, 0, 0, 0, 0, 0, 0]);
        return;
      }

      const i = insights.data[0];
      const invest    = parseFloat(i.spend || 0);
      const cliques   = parseInt(i.clicks || 0);
      const impressoes = parseInt(i.impressions || 0);
      const alcance   = parseInt(i.reach || 0);
      const ctr       = parseFloat(i.ctr || 0);
      const cpc       = parseFloat(i.cpc || 0);

      // Conversões — ação "purchase" ou "lead" dependendo do objetivo
      const acoes = i.actions || [];
      const conv = acoes
        .filter(a => ['purchase', 'lead', 'complete_registration', 'offsite_conversion.fb_pixel_purchase'].includes(a.action_type))
        .reduce((s, a) => s + parseFloat(a.value || 0), 0);

      // ROAS — purchase_roas
      const roasArr = (i.action_values || []).filter(a => a.action_type === 'purchase');
      const roasVal = roasArr.length > 0 ? parseFloat(roasArr[0].value) / invest : 0;

      const cpa = conv > 0 ? (invest / conv) : 0;
      const status = camp.status === 'ACTIVE' ? 'ativa' : 'pausada';

      aba.appendRow([
        hoje, camp.id, camp.name, status, camp.objective,
        invest.toFixed(2), impressoes, cliques,
        conv.toFixed(0), cpa.toFixed(2),
        ctr.toFixed(2), cpc.toFixed(2),
        roasVal.toFixed(2), alcance
      ]);

    } catch (e) {
      Logger.log(`Erro na campanha ${camp.name}: ${e.message}`);
    }
  });
}

// ── Aba: meta_kpis (totais da conta) ────────────────────────

function puxarKPIsMeta(ss) {
  const aba = garantirAba(ss, 'meta_kpis', [
    'data_extracao', 'investimento_total', 'impressoes_total',
    'cliques_total', 'conversoes_total', 'cpa_medio',
    'ctr_medio', 'alcance_total', 'roas_medio'
  ]);

  const { inicio, fim, hoje } = getDatas();

  const insights = chamarAPI(`${META_CONFIG.AD_ACCOUNT_ID}/insights`, {
    fields: 'spend,impressions,clicks,actions,action_values,reach,ctr',
    time_range: JSON.stringify({ since: inicio, until: fim }),
    level: 'account',
  });

  if (!insights.data || insights.data.length === 0) return;

  const i = insights.data[0];
  const invest    = parseFloat(i.spend || 0);
  const cliques   = parseInt(i.clicks || 0);
  const impressoes = parseInt(i.impressions || 0);
  const alcance   = parseInt(i.reach || 0);
  const ctr       = parseFloat(i.ctr || 0);

  const acoes = i.actions || [];
  const conv = acoes
    .filter(a => ['purchase', 'lead', 'complete_registration'].includes(a.action_type))
    .reduce((s, a) => s + parseFloat(a.value || 0), 0);

  const roasArr = (i.action_values || []).filter(a => a.action_type === 'purchase');
  const roasVal = roasArr.length > 0 ? parseFloat(roasArr[0].value) / invest : 0;

  aba.appendRow([
    hoje, invest.toFixed(2), impressoes, cliques,
    conv.toFixed(0), conv > 0 ? (invest / conv).toFixed(2) : 0,
    ctr.toFixed(2), alcance, roasVal.toFixed(2)
  ]);
}

// ── Aba: meta_linha_tempo (diário) ───────────────────────────

function puxarLinhaTempoMeta(ss) {
  const aba = garantirAba(ss, 'meta_linha_tempo', [
    'data', 'investimento', 'impressoes', 'cliques', 'conversoes', 'cpa', 'ctr'
  ]);

  const { inicio, fim } = getDatas();

  const insights = chamarAPI(`${META_CONFIG.AD_ACCOUNT_ID}/insights`, {
    fields: 'spend,impressions,clicks,actions,ctr',
    time_range: JSON.stringify({ since: inicio, until: fim }),
    time_increment: 1, // 1 = diário
    level: 'account',
  });

  if (!insights.data) return;

  insights.data.forEach(dia => {
    const invest = parseFloat(dia.spend || 0);
    const acoes = dia.actions || [];
    const conv = acoes
      .filter(a => ['purchase', 'lead', 'complete_registration'].includes(a.action_type))
      .reduce((s, a) => s + parseFloat(a.value || 0), 0);

    aba.appendRow([
      dia.date_start,
      invest.toFixed(2),
      parseInt(dia.impressions || 0),
      parseInt(dia.clicks || 0),
      conv.toFixed(0),
      conv > 0 ? (invest / conv).toFixed(2) : 0,
      parseFloat(dia.ctr || 0).toFixed(2),
    ]);
  });
}

// ============================================================
// AGENDAMENTO AUTOMÁTICO
// ============================================================
// Para criar o trigger de agendamento automaticamente:
// 1. Rode a função criarTrigger() UMA VEZ manualmente
// 2. Depois o script vai rodar todo dia às 6h da manhã

function criarTrigger() {
  // Remove triggers antigos
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  
  ScriptApp.newTrigger('sincronizarMetaAds')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();
  
  Logger.log('✅ Trigger criado: rodará diariamente às 6h');
}

// ============================================================
// RENOVAÇÃO DE TOKEN (rode manualmente a cada 60 dias)
// ============================================================
// O token de curta duração do Meta expira em ~1h.
// Use o endpoint abaixo para gerar um token de 60 dias:
// https://graph.facebook.com/v19.0/oauth/access_token
//   ?grant_type=fb_exchange_token
//   &client_id=SEU_APP_ID
//   &client_secret=SEU_APP_SECRET
//   &fb_exchange_token=SEU_TOKEN_CURTO
//
// Depois atualize o ACCESS_TOKEN na META_CONFIG acima.
// ============================================================
