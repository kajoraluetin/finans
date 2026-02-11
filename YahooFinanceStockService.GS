/**
 * 🚀 YAHOO FINANCE STOCK SERVICE
 * Sadece Yahoo Finance API işlemleri
 * Modül 1: Veri Çekme
 */

const YahooFinanceStockService = {
  
  // Son istek zamanı (rate limit için)
  _lastRequestTime: null,
  
  /**
   * Yahoo Finance'ten günlük hisse verisi çek
   * @param {string} symbol - Hisse sembolü
   * @param {string} range - Veri aralığı: '1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max'
   * @returns {Array} İşlenmiş günlük veri dizisi
   */
  fetchDailyHistory: function(symbol, range = '3mo') {
    console.log(`📡 Yahoo Finance API → ${symbol} (${range})`);
    
    // Rate limit kontrolü (saniyede 1 istek)
    this._checkRateLimit();
    
    try {
      // URL oluştur
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`;
      
      console.log(`   🔗 URL: ${url}`);
      
      // HTTP isteği yap
      const response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      });
      
      const statusCode = response.getResponseCode();
      const responseText = response.getContentText();
      
      console.log(`   📊 Status: ${statusCode}, Length: ${responseText.length}`);
      
      if (statusCode !== 200) {
        console.error(`❌ HTTP Hatası (${symbol}): ${statusCode}`);
        
        // 404 hatası - hisse bulunamadı
        if (statusCode === 404) {
          console.log(`   ℹ️ Hisse ${symbol} Yahoo Finance'te bulunamadı. Farklı sembol deneyin.`);
        }
        
        return null;
      }
      
      // JSON parse
      const data = JSON.parse(responseText);
      
      // Hata kontrolü
      if (data.chart && data.chart.error) {
        console.error(`❌ Yahoo Finance HATA (${symbol}): ${data.chart.error.description}`);
        return null;
      }
      
      // Veriyi işle
      return this._processYahooData(data, symbol);
      
    } catch (error) {
      console.error(`💥 Yahoo Finance HATA (${symbol}):`, error.message);
      return null;
    }
  },
  
  /**
   * Yahoo Finance verisini işle
   */
  _processYahooData: function(data, symbol) {
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      console.error(`❌ ${symbol}: Geçerli veri yok`);
      return null;
    }
    
    const result = data.chart.result[0];
    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    
    if (timestamps.length === 0) {
      console.error(`❌ ${symbol}: Zaman damgası yok`);
      return null;
    }
    
    const processed = [];
    const today = new Date();
    
    for (let i = 0; i < timestamps.length; i++) {
      const timestamp = timestamps[i];
      
      // Zaman damgası yoksa atla
      if (!timestamp) continue;
      
      const date = new Date(timestamp * 1000); // Saniyeden milisaniyeye
      
      // Bugün ve gelecek tarihleri atla
      if (date > today) continue;
      
      // Verileri al
      const open = quotes.open?.[i] || 0;
      const high = quotes.high?.[i] || 0;
      const low = quotes.low?.[i] || 0;
      const close = quotes.close?.[i] || 0;
      const volume = quotes.volume?.[i] || 0;
      
      // Sıfır verileri atla
      if (open === 0 && high === 0 && low === 0 && close === 0) {
        continue;
      }
      
      processed.push({
        tarih: date,
        open: open,
        high: high,
        low: low,
        close: close,
        volume: Math.round(volume)
      });
    }
    
    // Tarihe göre sırala (eskiden yeniye)
    processed.sort((a, b) => a.tarih - b.tarih);
    
    console.log(`✅ ${symbol}: ${processed.length} günlük veri işlendi`);
    
    if (processed.length > 0) {
      const firstDate = processed[0].tarih.toISOString().split('T')[0];
      const lastDate = processed[processed.length - 1].tarih.toISOString().split('T')[0];
      console.log(`   📅 İlk tarih: ${firstDate}`);
      console.log(`   📅 Son tarih: ${lastDate}`);
      console.log(`   💰 Son kapanış: ${processed[processed.length - 1].close}`);
    }
    
    return processed;
  },
  
  /**
   * Rate limit kontrolü (Yahoo Finance için çok daha az sıkı)
   */
  _checkRateLimit: function() {
    const now = new Date();
    
    if (this._lastRequestTime) {
      const timeDiff = (now - this._lastRequestTime) / 1000; // saniye
      
      // Yahoo için saniyede 1 istek yeterli
      if (timeDiff < 1) {
        const waitTime = Math.ceil(1 - timeDiff);
        console.log(`⏳ Yahoo rate limit için ${waitTime} saniye bekleniyor...`);
        Utilities.sleep(waitTime * 1000);
      }
    }
    
    this._lastRequestTime = new Date();
  },
  
  /**
   * Bugünün verisini al (günlük güncelleme için)
   */
  fetchTodayData: function(symbol) {
    console.log(`📡 Yahoo Finance Bugünkü Veri → ${symbol}`);
    
    // Son 5 günü al, en son tarihi döndür
    const data = this.fetchDailyHistory(symbol, '5d');
    
    if (!data || data.length === 0) {
      return null;
    }
    
    // En son tarihli veriyi al
    const latestData = data[data.length - 1];
    console.log(`✅ ${symbol}: Bugünkü veri alındı (${latestData.tarih.toISOString().split('T')[0]})`);
    
    return latestData;
  },
  
  /**
   * Çoklu hisse testi
   */
  testMultipleSymbols: function() {
    console.log('🧪 Yahoo Finance Çoklu Sembol Testi');
    
    const testSymbols = [
      'AAPL',   // Apple - NASDAQ
      'MSFT',   // Microsoft - NASDAQ
      'GOOGL',  // Google - NASDAQ
      'CVX',    // Chevron - NYSE
      'SLB',    // Schlumberger - NYSE
      'PATH',   // UiPath - NYSE
      'AMZN',   // Amazon - NASDAQ
      'TSLA',   // Tesla - NASDAQ
      'JPM',    // JPMorgan Chase - NYSE
      'V'       // Visa - NYSE
    ];
    
    let success = 0;
    let failed = 0;
    
    testSymbols.forEach((symbol, index) => {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🔍 ${index + 1}/${testSymbols.length}: ${symbol}`);
      
      const data = this.fetchDailyHistory(symbol, '7d'); // Son 7 gün
      
      if (data && data.length > 0) {
        console.log(`✅ ${symbol}: ${data.length} gün veri`);
        success++;
      } else {
        console.log(`❌ ${symbol}: Veri yok`);
        failed++;
      }
      
      // Rate limit için bekle
      if (index < testSymbols.length - 1) {
        console.log('⏳ 1 saniye bekleniyor...');
        Utilities.sleep(1000);
      }
    });
    
    console.log('\n📊 TEST ÖZETİ');
    console.log({
      toplam: testSymbols.length,
      basarili: success,
      basarisiz: failed,
      basariOrani: ((success / testSymbols.length) * 100).toFixed(1) + '%'
    });
    
    return success === testSymbols.length;
  },
  
  /**
   * Hisse sembolünü doğrula (Yahoo Finance'te var mı?)
   */
  validateSymbol: function(symbol) {
    console.log(`🔍 Sembol Doğrulama: ${symbol}`);
    
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
      
      const response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });
      
      const data = JSON.parse(response.getContentText());
      
      if (data.chart && data.chart.result && data.chart.result.length > 0) {
        console.log(`✅ ${symbol}: Yahoo Finance'te geçerli`);
        return true;
      } else {
        console.log(`❌ ${symbol}: Yahoo Finance'te bulunamadı`);
        return false;
      }
      
    } catch (error) {
      console.error(`💥 Doğrulama hatası (${symbol}):`, error.message);
      return false;
    }
  }
};

/**
 * 🧪 YAHOO FINANCE SERVİSİ TESTİ - GERÇEK PORTFÖY VERİLERİ
 * 
 * AMAÇ:
 * - Portföydeki gerçek hisselerle Yahoo Finance API testi
 * - DataReader ile portföyü okuyup hisseleri çıkar
 * - Sadece portföydeki hisseleri test et
 */
function test_YahooFinanceService_WithPortfolio() {
  console.log('='.repeat(70));
  console.log('🧪 YAHOO FINANCE TESTİ - GERÇEK PORTFÖY VERİLERİ');
  console.log('='.repeat(70));
  
  const startTime = new Date();
  const testResults = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    errors: [],
    symbolsTested: []
  };
  
  try {
    // 1. PORTFÖYÜ OKU VE HİSSELERİ ÇIKAR
    console.log('\n1️⃣ PORTFÖY ANALİZİ');
    
    const portfolio = DataReader.readPortfolio();
    console.log(`📦 Portföy kayıt sayısı: ${portfolio.length}`);
    
    if (portfolio.length === 0) {
      console.log('❌ Test edilecek portföy verisi yok!');
      return testResults;
    }
    
    // HisseGecmisKayitService kullanarak hisseleri çıkar
    const allStocks = HisseGecmisKayitService._extractAllStocks(portfolio);
    console.log(`📈 Portföydeki hisse sayısı: ${allStocks.length}`);
    
    if (allStocks.length === 0) {
      console.log('❌ Portföyde test edilecek hisse bulunamadı!');
      return testResults;
    }
    
    // ABD ve BIST hisselerini ayır
    const usStocks = allStocks.filter(s => s.type === 'ABD');
    const bistStocks = allStocks.filter(s => s.type === 'BIST');
    
    console.log(`   🇺🇸 ABD Hisseleri: ${usStocks.length}`);
    console.log(`   🇹🇷 BIST Hisseleri: ${bistStocks.length}`);
    
    // İlk 5 hisseyi göster
    console.log('\n🔍 PORTFÖYDEKİ HİSSELER (ilk 10):');
    allStocks.slice(0, 10).forEach((stock, i) => {
      console.log(`   ${i + 1}. ${stock.symbol} -> ${stock.yahooSymbol} (${stock.type})`);
    });
    
    if (allStocks.length > 10) {
      console.log(`   ... ve ${allStocks.length - 10} tane daha`);
    }
    
    // 2. YAHOO FINANCE SERVİSİ KONTROLÜ
    console.log('\n2️⃣ YAHOO FINANCE SERVİSİ KONTROLÜ');
    testResults.totalTests++;
    
    if (typeof YahooFinanceStockService === 'undefined') {
      console.log('❌ YahooFinanceStockService tanımlı değil!');
      testResults.failed++;
      return testResults;
    }
    
    console.log('✅ YahooFinanceStockService mevcut');
    testResults.passed++;
    
    // 3. PORTFÖY HİSSELERİ İLE TEST
    console.log('\n3️⃣ PORTFÖY HİSSELERİ İLE TEST');
    console.log('='.repeat(50));
    
    // Test edilecek maksimum hisse sayısı (performans için)
    const maxStocksToTest = Math.min(allStocks.length, 8);
    const stocksToTest = allStocks.slice(0, maxStocksToTest);
    
    console.log(`🔬 ${maxStocksToTest} hisse test edilecek:`);
    
    stocksToTest.forEach((stock, index) => {
      console.log(`\n${index + 1}/${maxStocksToTest}: ${stock.symbol} -> ${stock.yahooSymbol} (${stock.type})`);
      
      const symbolResult = {
        symbol: stock.symbol,
        yahooSymbol: stock.yahooSymbol,
        type: stock.type,
        status: 'pending',
        dataCount: 0,
        lastPrice: 0,
        error: null
      };
      
      try {
        // 3.1. Sembol doğrulama testi
        testResults.totalTests++;
        console.log(`   🔍 Sembol doğrulama...`);
        const isValid = YahooFinanceStockService.validateSymbol(stock.yahooSymbol);
        
        if (isValid) {
          console.log(`   ✅ Yahoo Finance'te geçerli`);
          testResults.passed++;
        } else {
          console.log(`   ❌ Yahoo Finance'te bulunamadı`);
          testResults.failed++;
          symbolResult.status = 'invalid_symbol';
          symbolResult.error = 'Yahoo Finance sembolü geçersiz';
          testResults.symbolsTested.push(symbolResult);
          
          // Geçersiz sembol için veri çekme testi yapma
          testResults.errors.push(`${stock.symbol} -> ${stock.yahooSymbol}: Geçersiz sembol`);
          return;
        }
        
        // 3.2. Veri çekme testi (5 günlük)
        testResults.totalTests++;
        console.log(`   📡 5 günlük veri çekiliyor...`);
        
        const startFetch = new Date();
        const data = YahooFinanceStockService.fetchDailyHistory(stock.yahooSymbol, '5d');
        const fetchTime = (new Date() - startFetch) / 1000;
        
        if (data && Array.isArray(data) && data.length > 0) {
          console.log(`   ✅ ${data.length} gün veri alındı (${fetchTime.toFixed(2)}s)`);
          
          // Veri kalitesi kontrolü
          const validData = data.filter(d => d.close > 0);
          if (validData.length > 0) {
            const lastRecord = validData[validData.length - 1];
            console.log(`   📊 Son fiyat: ${lastRecord.close} ${stock.birimi}`);
            console.log(`   📅 Son tarih: ${lastRecord.tarih.toISOString().split('T')[0]}`);
            
            symbolResult.status = 'success';
            symbolResult.dataCount = data.length;
            symbolResult.lastPrice = lastRecord.close;
            
            testResults.passed++;
          } else {
            console.log(`   ⚠️ Veri var ama geçersiz fiyatlar`);
            symbolResult.status = 'invalid_data';
            testResults.warnings++;
          }
        } else {
          console.log(`   ❌ Veri alınamadı`);
          symbolResult.status = 'no_data';
          symbolResult.error = 'Veri alınamadı';
          testResults.failed++;
          testResults.errors.push(`${stock.symbol} -> ${stock.yahooSymbol}: Veri alınamadı`);
        }
        
      } catch (error) {
        console.log(`   💥 Hata: ${error.message}`);
        symbolResult.status = 'error';
        symbolResult.error = error.message;
        testResults.failed++;
        testResults.errors.push(`${stock.symbol} -> ${stock.yahooSymbol}: ${error.message}`);
      }
      
      testResults.symbolsTested.push(symbolResult);
      
      // Rate limit için bekle (son hisse değilse)
      if (index < stocksToTest.length - 1) {
        console.log('   ⏳ 2 saniye bekleniyor...');
        Utilities.sleep(2000);
      }
    });
    
    console.log('\n' + '='.repeat(50));
    
    // 4. ÖZET ANALİZ
    console.log('\n4️⃣ TEST ÖZET ANALİZİ');
    
    const successfulSymbols = testResults.symbolsTested.filter(s => s.status === 'success');
    const failedSymbols = testResults.symbolsTested.filter(s => s.status === 'error' || s.status === 'no_data');
    const invalidSymbols = testResults.symbolsTested.filter(s => s.status === 'invalid_symbol');
    
    console.log(`✅ Başarılı: ${successfulSymbols.length} hisse`);
    console.log(`❌ Başarısız: ${failedSymbols.length} hisse`);
    console.log(`⚠️  Geçersiz Sembol: ${invalidSymbols.length} hisse`);
    
    if (successfulSymbols.length > 0) {
      console.log('\n📈 BAŞARILI HİSSELER:');
      successfulSymbols.forEach((symbol, index) => {
        console.log(`   ${index + 1}. ${symbol.symbol} -> ${symbol.yahooSymbol}: ${symbol.lastPrice}`);
      });
    }
    
    if (failedSymbols.length > 0) {
      console.log('\n❌ BAŞARISIZ HİSSELER:');
      failedSymbols.forEach((symbol, index) => {
        console.log(`   ${index + 1}. ${symbol.symbol} -> ${symbol.yahooSymbol}: ${symbol.error}`);
      });
    }
    
    if (invalidSymbols.length > 0) {
      console.log('\n⚠️  GEÇERSİZ SEMBOLLER (Yahoo Finance\'te yok):');
      invalidSymbols.forEach((symbol, index) => {
        console.log(`   ${index + 1}. ${symbol.symbol} -> ${symbol.yahooSymbol}`);
      });
      
      console.log('\n💡 ÖNERİ: Bu hisseler için sembolleri kontrol edin:');
      console.log('   - BIST hisseleri için ".IS" uzantısı doğru mu?');
      console.log('   - ABD hisseleri için sembol doğru mu?');
      console.log('   - Yahoo Finance\'te sembolü ara: finance.yahoo.com');
    }
    
    // 5. TÜM PORTFÖY İÇİN HIZLI DURUM KONTROLÜ
    console.log('\n5️⃣ TÜM PORTFÖY HIZLI DURUM KONTROLÜ');
    
    // Geçerli sembolleri test etmeden kontrol et
    const allSymbolsStatus = [];
    
    allStocks.forEach((stock, index) => {
      if (index < 15) { // Sadece ilk 15 hisse
        try {
          const isValid = YahooFinanceStockService.validateSymbol(stock.yahooSymbol);
          allSymbolsStatus.push({
            symbol: stock.symbol,
            yahooSymbol: stock.yahooSymbol,
            type: stock.type,
            valid: isValid
          });
        } catch (e) {
          allSymbolsStatus.push({
            symbol: stock.symbol,
            yahooSymbol: stock.yahooSymbol,
            type: stock.type,
            valid: false,
            error: e.message
          });
        }
      }
    });
    
    const validCount = allSymbolsStatus.filter(s => s.valid).length;
    const invalidCount = allSymbolsStatus.filter(s => !s.valid).length;
    
    console.log(`   📊 Geçerli sembol: ${validCount}/${allSymbolsStatus.length}`);
    console.log(`   📊 Geçersiz sembol: ${invalidCount}/${allSymbolsStatus.length}`);
    
    if (invalidCount > 0) {
      console.log('\n   🔍 GEÇERSİZ SEMBOLLER:');
      allSymbolsStatus.filter(s => !s.valid).slice(0, 5).forEach((symbol, i) => {
        console.log(`      ${i + 1}. ${symbol.symbol} -> ${symbol.yahooSymbol} (${symbol.type})`);
      });
    }
    
  } catch (error) {
    console.error(`💥 GENEL TEST HATASI: ${error.message}`);
    testResults.errors.push(`Genel hata: ${error.message}`);
  }
  
  // TEST SONUÇLARI
  const duration = (new Date().getTime() - startTime.getTime()) / 1000;
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 YAHOO FINANCE TEST SONUÇLARI');
  console.log('='.repeat(70));
  
  console.log(`⏱️  Toplam Süre: ${duration.toFixed(1)} saniye`);
  console.log(`📋 Toplam Test: ${testResults.totalTests}`);
  console.log(`✅ Başarılı: ${testResults.passed}`);
  console.log(`❌ Başarısız: ${testResults.failed}`);
  console.log(`⚠️  Uyarılar: ${testResults.warnings}`);
  
  const successRate = testResults.totalTests > 0 ? 
    ((testResults.passed / testResults.totalTests) * 100).toFixed(1) : 0;
  console.log(`📈 Başarı Oranı: ${successRate}%`);
  
  // PORTFÖY BAZLI SONUÇ DEĞERLENDİRMESİ
  console.log('\n' + '='.repeat(70));
  
  if (testResults.failed === 0 && testResults.totalTests > 0) {
    console.log('🎉 YAHOO FINANCE SERVİSİ PORTFÖYÜNÜZLE TAM UYUMLU!');
    console.log('   ✅ Tüm hisseleriniz Yahoo Finance\'te mevcut');
    console.log('   ✅ Veri çekme sorunsuz çalışıyor');
  } else if (testResults.passed > testResults.failed) {
    console.log('⚠️ YAHOO FINANCE SERVİSİ KISMEN ÇALIŞIYOR');
    console.log(`   ${testResults.failed} hissede sorun var`);
    console.log('   ⚠️ Bazı hisselerin sembolleri kontrol edilmeli');
  } else {
    console.log('❌ YAHOO FINANCE SERVİSİNDE CİDDİ SORUNLAR VAR!');
    console.log('   🔧 Hisse sembollerini ve API bağlantısını kontrol edin');
  }
  
  console.log('\n💡 PORTFÖY İÇİN ÖNERİLER:');
  console.log('1. Geçersiz sembollü hisseleri portföyden çıkarın');
  console.log('2. BIST hisseleri için ".IS" uzantısını kontrol edin');
  console.log('3. ABD hisseleri için doğru sembol kullanın');
  console.log('4. Düzenli olarak sembol doğrulama testi yapın');
  
  console.log('='.repeat(70));
  
  return testResults;
}

/**
 * 🔍 YAHOO FINANCE BAĞLANTI KONTROLÜ (PORTFÖY İLE)
 * 
 * Portföydeki hisselerle hızlı bağlantı testi
 */
function check_YahooFinance_Portfolio_Connection() {
  console.log('🔍 YAHOO FINANCE BAĞLANTI KONTROLÜ - PORTFÖY');
  console.log('='.repeat(50));
  
  try {
    // Portföyü oku
    const portfolio = DataReader.readPortfolio();
    console.log(`📦 Portföy: ${portfolio.length} kayıt`);
    
    if (portfolio.length === 0) {
      console.log('❌ Portföy boş!');
      return;
    }
    
    // Hisseleri çıkar
    const allStocks = HisseGecmisKayitService._extractAllStocks(portfolio);
    console.log(`📈 Hisseler: ${allStocks.length} adet`);
    
    if (allStocks.length === 0) {
      console.log('❌ Portföyde hisse bulunamadı!');
      return;
    }
    
    // ABD ve BIST sayıları
    const usStocks = allStocks.filter(s => s.type === 'ABD');
    const bistStocks = allStocks.filter(s => s.type === 'BIST');
    console.log(`   🇺🇸 ABD: ${usStocks.length}, 🇹🇷 BIST: ${bistStocks.length}`);
    
    // Test için 3 hisse seç (1 ABD, 1 BIST, 1 rastgele)
    const testStocks = [];
    if (usStocks.length > 0) testStocks.push(usStocks[0]);
    if (bistStocks.length > 0) testStocks.push(bistStocks[0]);
    if (allStocks.length > 2) testStocks.push(allStocks[2]);
    
    console.log(`\n🔬 ${testStocks.length} hisse test edilecek:`);
    
    const results = [];
    
    testStocks.forEach((stock, index) => {
      console.log(`\n${index + 1}. ${stock.symbol} -> ${stock.yahooSymbol} (${stock.type}):`);
      
      try {
        const start = new Date();
        const data = YahooFinanceStockService.fetchDailyHistory(stock.yahooSymbol, '1d');
        const duration = (new Date() - start) / 1000;
        
        if (data && data.length > 0) {
          const record = data[0];
          console.log(`   ✅ BAĞLANDI (${duration.toFixed(2)}s)`);
          console.log(`      Tarih: ${record.tarih.toISOString().split('T')[0]}`);
          console.log(`      Fiyat: ${record.close} ${stock.birimi}`);
          results.push({ 
            symbol: stock.symbol, 
            yahooSymbol: stock.yahooSymbol,
            type: stock.type,
            status: 'success', 
            time: duration,
            price: record.close
          });
        } else {
          console.log(`   ❌ BAĞLANAMADI (veri yok)`);
          results.push({ 
            symbol: stock.symbol, 
            yahooSymbol: stock.yahooSymbol,
            type: stock.type,
            status: 'no_data', 
            time: duration 
          });
        }
      } catch (error) {
        console.log(`   ❌ HATA: ${error.message}`);
        results.push({ 
          symbol: stock.symbol, 
          yahooSymbol: stock.yahooSymbol,
          type: stock.type,
          status: 'error', 
          message: error.message 
        });
      }
      
      if (index < testStocks.length - 1) {
        Utilities.sleep(2000);
      }
    });
    
    // Özet
    const successCount = results.filter(r => r.status === 'success').length;
    const totalCount = results.length;
    
    console.log('\n' + '='.repeat(50));
    console.log(`📊 SONUÇ: ${successCount}/${totalCount} başarılı`);
    
    if (successCount === totalCount) {
      console.log('✅ YAHOO FINANCE PORTFÖY BAĞLANTISI SORUNSUZ');
    } else if (successCount > 0) {
      console.log('⚠️ YAHOO FINANCE BAĞLANTISI KISMEN ÇALIŞIYOR');
      
      // Hangi tür hisselerde sorun var?
      const failedTypes = results
        .filter(r => r.status !== 'success')
        .map(r => r.type)
        .filter((value, index, self) => self.indexOf(value) === index);
      
      if (failedTypes.length > 0) {
        console.log(`   🔍 Sorunlu hisse türleri: ${failedTypes.join(', ')}`);
      }
    } else {
      console.log('❌ YAHOO FINANCE BAĞLANTISI TAMAMEN KOPUK');
      console.log('   🔧 İnternet bağlantınızı veya proxy ayarlarınızı kontrol edin');
    }
    
    // Tüm portföy için geçerli sembol oranı (hızlı kontrol)
    console.log('\n📊 TÜM PORTFÖY SEMBOL KONTROLÜ (örnekleme):');
    const sampleSymbols = allStocks.slice(0, 8); // İlk 8 hisse
    let validSampleCount = 0;
    
    sampleSymbols.forEach(symbol => {
      try {
        const isValid = YahooFinanceStockService.validateSymbol(symbol.yahooSymbol);
        if (isValid) validSampleCount++;
      } catch (e) {
        // Geçersiz say
      }
    });
    
    const sampleValidRate = (validSampleCount / sampleSymbols.length * 100).toFixed(0);
    console.log(`   Örnek ${sampleSymbols.length} hisse: %${sampleValidRate} geçerli sembol`);
    
    if (parseInt(sampleValidRate) < 70) {
      console.log('   ⚠️  Yüksek oranda geçersiz sembol olabilir!');
    }
    
    return results;
    
  } catch (error) {
    console.error(`💥 Kontrol hatası: ${error.message}`);
    return null;
  }
}
