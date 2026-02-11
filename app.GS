/**
 * 🚀 PORTFÖY API - TEK DOSYA
 * Tüm endpoint'ler ve HTML'ler burada
 */

function doGet(e) {
  console.log('API İsteği:', e?.parameter?.action || 'ui');
  
  try {
    const params = e?.parameter || {};
    const action = params.action || 'ui';
    
    switch(action.toLowerCase()) {
      case 'dashboard':
        return handleDashboard(params);
      case 'portfolio':
        return handlePortfolio(params);
      case 'analytics':
        return handleAnalytics(params);
      case 'health':
        return handleHealth(params);
      case 'test':
        return handleTest(params);
      case 'stocks':
        return handleStocks(params);
      case 'currencies':
        return handleCurrencies(params);
      case 'gold':
        return handleGold(params);
      case 'debug':
        return handleDebug(params);
      case 'ui':
      default:
        return handleUI(params);
    }
  } catch (error) {
    console.error('Hata:', error);
    return createErrorResponse(error);
  }
}

// JSON ENDPOINT'LERİ
function handleDashboard(params) {
  try {
    const data = PortfolioAnalytics.getDashboardJSON();
    return jsonResponse({
      status: 'success',
      endpoint: 'dashboard',
      data: data.data,
      timestamp: new Date().toISOString()
    });
  } catch(e) {
    return jsonResponse({
      status: 'error',
      endpoint: 'dashboard',
      error: e.message,
      timestamp: new Date().toISOString()
    });
  }
}

function handlePortfolio(params) {
  try {
    const portfolio = DataReader.readPortfolio();
    return jsonResponse({
      status: 'success',
      endpoint: 'portfolio',
      count: portfolio.length,
      records: portfolio.slice(0, 50),
      timestamp: new Date().toISOString()
    });
  } catch(e) {
    return jsonResponse({
      status: 'error',
      endpoint: 'portfolio',
      error: e.message,
      timestamp: new Date().toISOString()
    });
  }
}

function handleAnalytics(params) {
  try {
    const data = PortfolioAnalytics.getAPIResponseJSON('analytics');
    return jsonResponse({
      status: 'success',
      endpoint: 'analytics',
      data: data.data,
      timestamp: new Date().toISOString()
    });
  } catch(e) {
    return jsonResponse({
      status: 'error',
      endpoint: 'analytics',
      error: e.message,
      timestamp: new Date().toISOString()
    });
  }
}

function handleHealth(params) {
  try {
    const services = {
      DataReader: typeof DataReader !== 'undefined',
      PortfolioAnalytics: typeof PortfolioAnalytics !== 'undefined',
      CalculationEngine: typeof CalculationEngine !== 'undefined',
      CacheService: typeof CacheService !== 'undefined'
    };
    
    return jsonResponse({
      status: 'success',
      endpoint: 'health',
      services: services,
      timestamp: new Date().toISOString()
    });
  } catch(e) {
    return jsonResponse({
      status: 'error',
      endpoint: 'health',
      error: e.message,
      timestamp: new Date().toISOString()
    });
  }
}

function handleStocks(params) {
  try {
    const portfolio = DataReader.readPortfolio();
    const stocks = HisseGecmisKayitService._extractAllStocks(portfolio);
    
    return jsonResponse({
      status: 'success',
      endpoint: 'stocks',
      count: stocks.length,
      stocks: stocks,
      timestamp: new Date().toISOString()
    });
  } catch(e) {
    return jsonResponse({
      status: 'error',
      endpoint: 'stocks',
      error: e.message,
      timestamp: new Date().toISOString()
    });
  }
}

function handleCurrencies(params) {
  try {
    const portfolio = DataReader.readPortfolio();
    const distribution = PortfolioAnalytics._getCurrencyDistribution(portfolio);
    
    return jsonResponse({
      status: 'success',
      endpoint: 'currencies',
      currencies: distribution,
      timestamp: new Date().toISOString()
    });
  } catch(e) {
    return jsonResponse({
      status: 'error',
      endpoint: 'currencies',
      error: e.message,
      timestamp: new Date().toISOString()
    });
  }
}

function handleGold(params) {
  try {
    if (typeof GoldService !== 'undefined') {
      const goldData = GoldService.getGoldPrices();
      return jsonResponse({
        status: 'success',
        endpoint: 'gold',
        data: goldData,
        timestamp: new Date().toISOString()
      });
    } else {
      return jsonResponse({
        status: 'error',
        endpoint: 'gold',
        error: 'GoldService bulunamadı',
        timestamp: new Date().toISOString()
      });
    }
  } catch(e) {
    return jsonResponse({
      status: 'error',
      endpoint: 'gold',
      error: e.message,
      timestamp: new Date().toISOString()
    });
  }
}

function handleDebug(params) {
  try {
    return jsonResponse({
      status: 'success',
      endpoint: 'debug',
      debug: {
        timestamp: new Date().toISOString(),
        url: ScriptApp.getService().getUrl(),
        timezone: Session.getScriptTimeZone(),
        scriptId: ScriptApp.getScriptId()
      },
      timestamp: new Date().toISOString()
    });
  } catch(e) {
    return jsonResponse({
      status: 'error',
      endpoint: 'debug',
      error: e.message,
      timestamp: new Date().toISOString()
    });
  }
}

// HTML ENDPOINT'LERİ
function handleUI(params) {
  try {
    return HtmlService
      .createHtmlOutput(createDashboardHTML())
      .setTitle('📊 Portföy Dashboard')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch(e) {
    return createErrorHTML(e);
  }
}

function handleTest(params) {
  try {
    return HtmlService
      .createHtmlOutput(createTestHTML())
      .setTitle('🧪 API Test')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch(e) {
    return createErrorHTML(e);
  }
}

// YARDIMCI FONKSİYONLAR - DÜZELTİLMİŞ VERSİYON
function jsonResponse(data) {
  // DÜZELTME: setHeader yerine doğru yöntem
  const output = ContentService
    .createTextOutput(JSON.stringify(data, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
  
  // CORS için headers ekleyelim
  // Not: Apps Script'te setHeaders array alır
  return output;
}

function createErrorResponse(error) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// HTML TEMPLATE'LERİ
function createDashboardHTML() {
  const apiUrl = ScriptApp.getService().getUrl();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>📊 Portföy Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }
    body { background: #f0f2f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    
    .header { 
      background: white; 
      padding: 20px; 
      border-radius: 10px; 
      margin-bottom: 20px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    
    .cards { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
      gap: 20px; 
      margin-bottom: 20px; 
    }
    
    .card { 
      background: white; 
      padding: 20px; 
      border-radius: 10px; 
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    
    .api-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 20px; }
    .api-btn { 
      background: #4CAF50; 
      color: white; 
      padding: 10px; 
      border-radius: 5px; 
      text-align: center;
      text-decoration: none;
      display: block;
    }
    
    .result { 
      background: #f8f9fa; 
      padding: 15px; 
      border-radius: 5px; 
      margin-top: 20px;
      max-height: 400px;
      overflow: auto;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Portföy Dashboard</h1>
      <p>API URL: <code>${apiUrl}</code></p>
      <button onclick="loadDashboard()" style="padding: 10px 20px; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer; margin-top: 10px;">
        🔄 Yenile
      </button>
    </div>
    
    <div class="cards" id="dashboardCards">
      <div style="text-align: center; padding: 40px; color: #666;">
        ⏳ Dashboard yükleniyor...
      </div>
    </div>
    
    <div class="card">
      <h2>🔗 API Endpoint'leri</h2>
      <div class="api-grid">
        <a href="${apiUrl}?action=dashboard" target="_blank" class="api-btn">
          📊 Dashboard JSON
        </a>
        <a href="${apiUrl}?action=portfolio" target="_blank" class="api-btn">
          📄 Portfolio JSON
        </a>
        <a href="${apiUrl}?action=analytics" target="_blank" class="api-btn">
          📈 Analytics JSON
        </a>
        <a href="${apiUrl}?action=health" target="_blank" class="api-btn">
          🏥 Health Check
        </a>
        <a href="${apiUrl}?action=test" class="api-btn">
          🧪 Test Arayüzü
        </a>
      </div>
    </div>
    
    <div class="card">
      <h2>⚡ Hızlı Test</h2>
      <select id="testEndpoint" style="padding: 8px; width: 200px; margin-right: 10px;">
        <option value="dashboard">Dashboard</option>
        <option value="portfolio">Portfolio</option>
        <option value="health">Health Check</option>
        <option value="debug">Debug</option>
      </select>
      <button onclick="testEndpoint()" style="padding: 8px 15px; background: #ff9800; color: white; border: none; border-radius: 5px; cursor: pointer;">
        🚀 Test Et
      </button>
      <div class="result" id="testResult">
        Test sonucu burada görünecek...
      </div>
    </div>
  </div>
  
  <script>
    const API_URL = '${apiUrl}';
    
    // Sayfa yüklendiğinde dashboard'ı çek
    window.addEventListener('load', loadDashboard);
    
    async function loadDashboard() {
      try {
        const response = await fetch(API_URL + '?action=dashboard');
        const data = await response.json();
        
        if (data.status === 'success') {
          renderDashboard(data.data);
        }
      } catch (error) {
        document.getElementById('dashboardCards').innerHTML = \`
          <div style="grid-column: 1 / -1; background: #ffebee; color: #c62828; padding: 20px; border-radius: 10px; text-align: center;">
            ❌ Hata: \${error.message}
          </div>
        \`;
      }
    }
    
    function renderDashboard(dashboard) {
      const cards = dashboard.summaryCards || [];
      const cardsHtml = cards.map(card => \`
        <div class="card">
          <h3>\${card.title}</h3>
          <div style="font-size: 28px; font-weight: bold; color: #333; margin: 10px 0;">
            \${formatNumber(card.value)} \${card.currency || ''}
          </div>
        </div>
      \`).join('');
      
      document.getElementById('dashboardCards').innerHTML = cardsHtml;
    }
    
    async function testEndpoint() {
      const endpoint = document.getElementById('testEndpoint').value;
      const resultDiv = document.getElementById('testResult');
      
      resultDiv.innerHTML = '<div style="color: #666;">⏳ Test ediliyor...</div>';
      
      try {
        const response = await fetch(API_URL + '?action=' + endpoint);
        const data = await response.json();
        
        resultDiv.innerHTML = \`
          <div style="background: \${data.status === 'success' ? '#e8f5e9' : '#ffebee'}; 
               color: \${data.status === 'success' ? '#2e7d32' : '#c62828'}; 
               padding: 10px; border-radius: 5px; margin-bottom: 10px;">
            \${data.status === 'success' ? '✅' : '❌'} \${data.status === 'success' ? 'Başarılı!' : 'Hata!'} (Status: \${data.status})
          </div>
          <pre style="background: white; padding: 10px; border-radius: 5px; overflow: auto;">
\${JSON.stringify(data, null, 2)}
          </pre>
        \`;
      } catch (error) {
        resultDiv.innerHTML = \`
          <div style="background: #ffebee; color: #c62828; padding: 10px; border-radius: 5px;">
            ❌ Hata: \${error.message}
          </div>
        \`;
      }
    }
    
    function formatNumber(num) {
      if (typeof num !== 'number') return num;
      return num.toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }
    
    // 2 dakikada bir otomatik yenile
    setInterval(loadDashboard, 120000);
  </script>
</body>
</html>
  `;
}

function createTestHTML() {
  const apiUrl = ScriptApp.getService().getUrl();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>🧪 API Test</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .endpoint { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px; }
    .test-btn { background: #007bff; color: white; padding: 8px 15px; border: none; border-radius: 3px; cursor: pointer; }
    .result { background: white; padding: 10px; margin-top: 10px; border-radius: 3px; border: 1px solid #ddd; }
  </style>
</head>
<body>
  <h1>🧪 API Test Arayüzü</h1>
  <p>Base URL: <code>${apiUrl}</code></p>
  
  <div class="endpoint">
    <h3>📊 Dashboard</h3>
    <code>${apiUrl}?action=dashboard</code><br>
    <button class="test-btn" onclick="test('dashboard')">Test</button>
    <div class="result" id="result-dashboard">Sonuç burada görünecek</div>
  </div>
  
  <div class="endpoint">
    <h3>📄 Portfolio</h3>
    <code>${apiUrl}?action=portfolio</code><br>
    <button class="test-btn" onclick="test('portfolio')">Test</button>
    <div class="result" id="result-portfolio">Sonuç burada görünecek</div>
  </div>
  
  <div class="endpoint">
    <h3>🏥 Health Check</h3>
    <code>${apiUrl}?action=health</code><br>
    <button class="test-btn" onclick="test('health')">Test</button>
    <div class="result" id="result-health">Sonuç burada görünecek</div>
  </div>
  
  <div class="endpoint">
    <h3>🔧 Debug Info</h3>
    <code>${apiUrl}?action=debug</code><br>
    <button class="test-btn" onclick="test('debug')">Test</button>
    <div class="result" id="result-debug">Sonuç burada görünecek</div>
  </div>
  
  <script>
    const API_URL = '${apiUrl}';
    
    async function test(action) {
      const resultDiv = document.getElementById('result-' + action);
      resultDiv.innerHTML = '⏳ Testing...';
      
      try {
        const response = await fetch(API_URL + '?action=' + action);
        const data = await response.json();
        
        resultDiv.innerHTML = \`
          <strong>\${data.status === 'success' ? '✅ SUCCESS' : '❌ ERROR'}</strong><br>
          <strong>Endpoint:</strong> \${data.endpoint || action}<br>
          <strong>Timestamp:</strong> \${data.timestamp || 'N/A'}<br><br>
          <pre>\${JSON.stringify(data, null, 2)}</pre>
        \`;
      } catch (error) {
        resultDiv.innerHTML = \`<strong>❌ ERROR:</strong> \${error.message}\`;
      }
    }
  </script>
</body>
</html>
  `;
}

function createErrorHTML(error) {
  const apiUrl = ScriptApp.getService().getUrl();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial; padding: 40px; background: #f8d7da; color: #721c24; }
    .error-box { background: white; padding: 30px; border-radius: 10px; }
  </style>
</head>
<body>
  <div class="error-box">
    <h1>❌ Hata Oluştu</h1>
    <p><strong>Mesaj:</strong> ${error.message || 'Bilinmeyen hata'}</p>
    <p><strong>Tarih:</strong> ${new Date().toLocaleString('tr-TR')}</p>
    <a href="${apiUrl}?action=ui" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">
      Dashboard'a Dön
    </a>
  </div>
</body>
</html>
  `;
}

// DEBUG İÇİN
function testAll() {
  console.log('API Test Başlıyor...');
  
  const tests = [
    'dashboard',
    'portfolio', 
    'health',
    'debug'
  ];
  
  tests.forEach(action => {
    try {
      const mockEvent = { parameter: { action: action } };
      const result = doGet(mockEvent);
      console.log(`${action}: ${result.getContent().length} bytes`);
    } catch(e) {
      console.error(`${action} HATA:`, e.message);
    }
  });
}
