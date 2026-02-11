/**
 * =========================================================
 * TEST: DataReader (DETAYLI DEBUG)
 * =========================================================
 * AMAÇ:
 * - Okunan TÜM kayıtları görmek
 * - Satır bazında kontrol
 * - Yapısal hata var mı anlamak
 * =========================================================
 */
function test_DataReader_Debug() {
  console.log('🧪 TEST BAŞLADI: DataReader (DETAYLI)');

  try {
    const data = DataReader.readPortfolio();

    console.log('📦 Toplam kayıt sayısı:', data.length);

    if (data.length === 0) {
      console.warn('⚠️ Veri yok, test sonlandırıldı');
      return;
    }

    // -----------------------------------------------------
    // 1️⃣ TÜM VERİNİN HAM JSON DUMP'I
    // -----------------------------------------------------
    console.log('📚 TÜM VERİ (JSON DUMP BAŞLANGIÇ)');
    console.log(JSON.stringify(data, null, 2));
    console.log('📚 TÜM VERİ (JSON DUMP BİTİŞ)');

    // -----------------------------------------------------
    // 2️⃣ SATIR SATIR OKUNABİLİR DEBUG
    // -----------------------------------------------------
    console.log('🧾 SATIR SATIR DETAYLI DEBUG');

    data.forEach((row, index) => {
      console.log(`────────────────────────────`);
      console.log(`🔢 KAYIT #${index + 1}`);
      console.log('ID:', row.id);
      console.log('Tarih:', row.tarih);
      console.log('İşlem Türü:', row.islemTuru);
      console.log('Başlık:', row.baslik);
      console.log('Adet:', row.adet);
      console.log('Birim Fiyat:', row.birimFiyat);
      console.log('Toplam Tutar:', row.toplamTutar);
      console.log('Kategori:', row.kategori);
      console.log('Platform:', row.platform);
      console.log('Durum:', row.durum);
    });

    // -----------------------------------------------------
    // 3️⃣ HIZLI SAĞLIK KONTROLLERİ
    // -----------------------------------------------------
    const hataliKayitlar = data.filter(d =>
      !d.tarih ||
      typeof d.toplamTutar !== 'number' ||
      isNaN(d.toplamTutar)
    );

    if (hataliKayitlar.length > 0) {
      console.warn(
        `⚠️ ${hataliKayitlar.length} adet şüpheli kayıt bulundu`,
        hataliKayitlar
      );
    } else {
      console.log('✅ Tüm kayıtlar temel kontrollerden geçti');
    }

    console.log('🎉 TEST BAŞARIYLA TAMAMLANDI');

  } catch (error) {
    console.error('💥 TEST HATASI:', error);
  }
}

/**
 * ======================================================
 * TEST: CalculationEngine
 * ------------------------------------------------------
 * - GERÇEK Sheet datası kullanır
 * - Tüm hesaplamaları sırayla çalıştırır
 * - Debug için detaylı log basar
 * ======================================================
 */
function CalculationEngine_Debug() {
  console.log('🧪 TEST BAŞLADI: CalculationEngine');

  // 1️⃣ DATA OKU
  const portfolio = DataReader.readPortfolio();
  console.log(`📦 Toplam kayıt: ${portfolio.length}`);

  // 2️⃣ FIFO
  const fifo = CalculationEngine.calculateFIFOProfitLoss(portfolio);
  console.log('🧮 FIFO KAR/ZARAR MAP');
  console.log(JSON.stringify(fifo, null, 2));

  // 3️⃣ FIFO sonucunu portföye yaz
  portfolio.forEach(p => {
    if (fifo[p.id] !== undefined) {
      p.karZarar = fifo[p.id];
    }
  });

  console.log('📌 KAR/ZARAR YAZILMIŞ KAYITLAR');
  console.log(
    JSON.stringify(
      portfolio.filter(p => p.karZarar !== 0),
      null,
      2
    )
  );

  // 4️⃣ ORTALAMALAR
  console.log('📊 ORTALAMA ALIŞ');
  console.log(
    JSON.stringify(
      CalculationEngine.calculateAveragePurchasePrice(portfolio),
      null,
      2
    )
  );

  console.log('📊 ORTALAMA SATIŞ');
  console.log(
    JSON.stringify(
      CalculationEngine.calculateAverageSalePrice(portfolio),
      null,
      2
    )
  );

  // 5️⃣ ÖZETLER
  console.log('📈 HİSSE ÖZETLERİ');
  console.log(
    JSON.stringify(
      CalculationEngine.calculateStockSummaries(portfolio),
      null,
      2
    )
  );

  console.log('✅ TEST TAMAMLANDI');
}

/**
 * 🧪 TEST: AlphaVantageService (DETAYLI DEBUG)
 *
 * AMAÇ:
 * - Tek API çağrısı ile Alpha Vantage davranışını görmek
 * - Rate limit / Note / Error ayrımını net loglamak
 * - Günlük veri yapısını analiz etmek
 */
function test_AlphaVantageService() {
  console.log('🧪 TEST BAŞLADI: AlphaVantageService');
  console.log('🎯 Test sembolü: AAPL');

  const startTime = new Date();

  try {
    const data = AlphaVantageStockService.fetchDailyHistory('AAPL');

    console.log('📦 HAM VERİ UZUNLUĞU:', data.length);

    if (data.length === 0) {
      console.warn('⚠️ Hiç veri gelmedi → Rate limit / sembol hatası olabilir');
      return;
    }

    // Tarih analizi
    const dates = data.map(d => d.tarih).sort();
    console.log('📅 TARİH ARALIĞI', {
      enEski: dates[0],
      enYeni: dates[dates.length - 1]
    });

    // İlk / son kayıt
    console.log('📄 İLK 3 GÜN', data.slice(0, 3));
    console.log('📄 SON 3 GÜN', data.slice(-3));

    // Yapı kontrolü
    const sample = data[0];
    console.log('🧬 VERİ ŞEMASI KONTROLÜ', {
      symbol: typeof sample.symbol,
      tarih: typeof sample.tarih,
      open: typeof sample.open,
      high: typeof sample.high,
      low: typeof sample.low,
      close: typeof sample.close,
      volume: typeof sample.volume
    });

    const duration = (new Date().getTime() - startTime.getTime()) / 1000;
    console.log(`⏱️ API süresi: ${duration} sn`);
    console.log('✅ AlphaVantageService TEST BAŞARIYLA TAMAMLANDI');

  } catch (e) {
    console.error('💥 AlphaVantageService TEST HATASI', e);
  }
}


/**
 * 🧪 BIST HİSSELERİ TESTİ
 */
function test_BIST_Stocks() {
  console.log('🧪 BIST HİSSELERİ TESTİ');
  
  try {
    const portfolio = DataReader.readPortfolio();
    const stocks = HisseGecmisKayitService._extractAllStocks(portfolio);
    const bistStocks = stocks.filter(s => s.type === 'BIST');
    
    console.log(`🔍 ${bistStocks.length} BIST hissesi bulundu.`);
    
    let validCount = 0;
    let invalidCount = 0;
    
    bistStocks.forEach((stock, index) => {
      console.log(`\n${index + 1}. ${stock.symbol} -> ${stock.yahooSymbol}`);
      
      // Yahoo Finance'te var mı kontrol et
      const isValid = YahooFinanceStockService.validateSymbol(stock.yahooSymbol);
      
      if (isValid) {
        console.log(`   ✅ Yahoo Finance'te geçerli`);
        
        // Test verisi al (sadece 5 gün)
        const testData = YahooFinanceStockService.fetchDailyHistory(stock.yahooSymbol, '5d');
        
        if (testData && testData.length > 0) {
          console.log(`   📈 ${testData.length} gün veri alınabildi`);
          console.log(`   💰 Son fiyat: ${testData[testData.length-1].close} ${stock.birimi}`);
          validCount++;
        } else {
          console.log(`   ⚠️ Veri alınamadı`);
          invalidCount++;
        }
      } else {
        console.log(`   ❌ Yahoo Finance'te bulunamadı`);
        invalidCount++;
      }
      
      // Rate limit için bekle
      if (index < bistStocks.length - 1) {
        Utilities.sleep(2000);
      }
    });
    
    console.log('\n📊 TEST SONUCU:');
    console.log(`   Toplam BIST hissesi: ${bistStocks.length}`);
    console.log(`   Geçerli: ${validCount}`);
    console.log(`   Geçersiz: ${invalidCount}`);
    
    if (invalidCount === 0) {
      console.log('🎉 TÜM BIST HİSSELERİ GEÇERLİ!');
    }
    
  } catch (error) {
    console.error('💥 Test hatası:', error);
  }
}

/**
 * TÜM HİSSELER İÇİN İLK SENKRONİZASYON
 */
function run_Initial_Sync_All() {
  console.log('🚀 TÜM HİSSE SENKRONİZASYONU BAŞLATILIYOR');
  console.log('⏱️  Tahmini süre: 40-50 saniye');
  console.log('   (10 ABD hissesi + 12 BIST hissesi = 22 hisse)');
  
  HisseGecmisKayitService.syncAllStockHistory();
}

/**
 * TÜM HİSSELER İÇİN GÜNLÜK GÜNCELLEME
 
function run_Daily_Update_All() {
  console.log('🔄 TÜM HİSSE GÜNCELLEMESİ BAŞLATILIYOR');
  HisseGecmisKayitService.updateAllStocks();
}
*/
/**
 * PORTFÖY ANALİZİ (DETAYLI)
 */
function analyze_Portfolio_Detailed() {
  console.log('📊 PORTFÖY DETAYLI ANALİZ');
  
  try {
    const portfolio = DataReader.readPortfolio();
    
    console.log(`📦 Toplam kayıt: ${portfolio.length}`);
    
    // Kategorilere göre grupla
    const categories = {};
    
    portfolio.forEach(item => {
      const category = item.kategori || 'Belirsiz';
      categories[category] = (categories[category] || 0) + 1;
    });
    
    console.log('\n📋 KATEGORİ DAĞILIMI:');
    Object.entries(categories).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} kayıt`);
    });
    
    // Tüm hisseleri ayıkla
    const allStocks = HisseGecmisKayitService._extractAllStocks(portfolio);
    const usStocks = allStocks.filter(s => s.type === 'ABD');
    const bistStocks = allStocks.filter(s => s.type === 'BIST');
    
    console.log(`\n🎯 İŞLENECEK HİSSELER (${allStocks.length}):`);
    console.log(`   🇺🇸 ABD Hisseleri (${usStocks.length}):`);
    usStocks.forEach(stock => {
      console.log(`      - ${stock.symbol} -> ${stock.yahooSymbol} (${stock.birimi})`);
    });
    
    console.log(`\n   🇹🇷 BIST Hisseleri (${bistStocks.length}):`);
    bistStocks.forEach(stock => {
      console.log(`      - ${stock.symbol} -> ${stock.yahooSymbol} (${stock.birimi})`);
    });
    
    // Diğer yatırımlar
    const otherInvestments = portfolio.filter(item => {
      const kategori = (item.kategori || '').toString().toUpperCase();
      return !kategori.includes('NASDAQ') && 
             !kategori.includes('NYSE') && 
             !kategori.includes('AMEX') &&
             !kategori.includes('BIST');
    });
    
    console.log(`\n💰 DİĞER YATIRIMLAR (${otherInvestments.length}):`);
    const otherSymbols = [...new Set(otherInvestments.map(item => item.baslik).filter(Boolean))];
    console.log(`   ${otherSymbols.join(', ')}`);
    
    console.log('\n💡 ÖNERİ:');
    console.log(`   • Toplam ${allStocks.length} hisse için veri çekilecek.`);
    console.log(`   • Tahmini süre: ${allStocks.length * 3} saniye.`);
    console.log(`   • Her hisse için ~62 günlük veri alınacak.`);
    
  } catch (error) {
    console.error('💥 Analiz hatası:', error);
  }
}

