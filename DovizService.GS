/**
 * 💱 DÖVİZ SERVİSİ - Portföy Bazlı & Akıllı Sorgulama (TAM KOD)
 */
const DovizService = {

  /**
   * Tüm döviz çiftleri için geçmiş veriyi çek ve sheet'e yaz
   */
  syncAllCurrencyHistory: function() {
    console.log('💱 DÖVİZ KURU SENKRONİZASYONU BAŞLATILIYOR');
    console.log('📅 Tarih:', new Date().toISOString());

    const startTime = new Date();
    
    try {
      // 1. Portföyü oku ve para birimlerini çıkar
      console.log('📊 Portföy okunuyor...');
      const portfolio = DataReader.readPortfolio();
      console.log(`📦 Portföy kayıt sayısı: ${portfolio.length}`);
      
      if (portfolio.length === 0) {
        console.log('ℹ️ Portföy boş, döviz senkronizasyonu atlanıyor');
        return { success: true, message: 'Portföy boş' };
      }
      
      // 2. Portföydeki benzersiz para birimlerini bul (TRY hariç)
      const currencies = this._extractCurrenciesFromPortfolio(portfolio);
      console.log(`📌 Portföyde bulunan para birimleri: ${currencies.length} adet`);
      
      if (currencies.length === 0) {
        console.log('ℹ️ TRY dışında para birimi bulunamadı');
        return { success: true, message: 'TRY dışında para birimi yok' };
      }
      
      // 3. Sheet'i hazırla
      const sheetName = this._getSheetName();
      const sheet = this._getOrCreateSheet(sheetName);
      
      // 4. Her para birimi için işlem yap
      let totalProcessed = 0;
      let totalWritten = 0;
      let totalSkipped = 0;
      let totalFailed = 0;
      
      currencies.forEach((currency, index) => {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━`);
        console.log(`💱 ${index + 1}/${currencies.length}: ${currency.currency}`);
        console.log(`   📊 Portföyde ${currency.count} kayıt var`);
        
        try {
          // Döviz sembolünü oluştur
          const symbol = this._createCurrencySymbol(currency.currency);
          if (!symbol) {
            console.log(`   ⏭️ ${currency.currency} için sembol oluşturulamadı`);
            totalSkipped++;
            return;
          }
          
          // 4a. Bu döviz için sheet'teki en son tarihi kontrol et
          const lastRecordDate = this._getLastRecordDateForSymbol(sheet, symbol);
          
          // 4b. Güncellik kontrolü
          if (this._isUpToDate(lastRecordDate)) {
            console.log(`   ⏭️ ${symbol} zaten güncel (son tarih: ${lastRecordDate ? lastRecordDate.toISOString().split('T')[0] : 'yok'})`);
            totalSkipped++;
            return;
          }
          
          console.log(`   📅 En son kayıt: ${lastRecordDate ? lastRecordDate.toISOString().split('T')[0] : 'Yok'}`);
          console.log(`   🔍 Veri çekiliyor...`);
          
          // 4c. CONFIG'teki aralıkla veriyi çek
          const range = this._getDateRange();
          const dailyData = YahooFinanceStockService.fetchDailyHistory(symbol, range);
          
          if (!dailyData || dailyData.length === 0) {
            console.log(`   ⚠️ ${symbol} için veri alınamadı`);
            totalFailed++;
            return;
          }
          
          console.log(`   ✅ ${dailyData.length} gün veri alındı`);
          console.log(`   💰 Son fiyat: ${dailyData[dailyData.length - 1].close}`);
          
          // 4d. Sheet'e yaz (duplicate kontrolü ile)
          const written = this._writeToCurrencySheet(sheet, symbol, dailyData);
          
          if (written > 0) {
            console.log(`   📝 ${written} yeni kayıt eklendi`);
            totalWritten += written;
            totalProcessed++;
          } else {
            console.log(`   ⏭️ Yeni kayıt yok`);
            totalSkipped++;
          }
          
        } catch (error) {
          console.error(`   💥 ${currency.currency} işlenirken hata:`, error.message);
          totalFailed++;
        }
        
        // Rate limit için bekle (sonraki döviz varsa)
        if (index < currencies.length - 1) {
          console.log('   ⏳ 2 saniye bekleniyor...');
          Utilities.sleep(2000);
        }
      });
      
      // 5. Özet göster
      const duration = (new Date().getTime() - startTime.getTime()) / 1000;
      
      console.log('\n════════════════════════════════════════');
      console.log('📊 DÖVİZ SENKRONİZASYON ÖZETİ');
      console.log('════════════════════════════════════════');
      console.log(`📅 Tarih: ${new Date().toISOString().split('T')[0]}`);
      console.log(`⏱️  Süre: ${duration.toFixed(1)} saniye`);
      console.log(`💱 Toplam Para Birimi: ${currencies.length}`);
      console.log(`✅ İşlenen: ${totalProcessed}`);
      console.log(`⏭️ Atlanan: ${totalSkipped}`);
      console.log(`❌ Başarısız: ${totalFailed}`);
      console.log(`📝 Yeni Kayıt: ${totalWritten}`);
      console.log('🎉 DÖVİZ SENKRONİZASYONU TAMAMLANDI');
      
      return {
        success: totalFailed === 0,
        processed: totalProcessed,
        skipped: totalSkipped,
        failed: totalFailed,
        newRecords: totalWritten,
        duration: duration
      };
      
    } catch (error) {
      console.error('💥 Genel senkronizasyon hatası:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  /**
   * Portföydeki benzersiz para birimlerini çıkar (TRY hariç)
   */
  _extractCurrenciesFromPortfolio: function(portfolio) {
    const currencyMap = new Map();
    
    portfolio.forEach(item => {
      const currency = item.birimi ? item.birimi.trim() : null;
      
      if (currency) {
        if (!currencyMap.has(currency)) {
          currencyMap.set(currency, {
            currency: currency,
            count: 0
          });
        }
        currencyMap.get(currency).count++;
      }
    });
    
    // Map'i array'e çevir ve sayıya göre sırala (en çok kaydı olan önce)
    const currencies = Array.from(currencyMap.values())
      .sort((a, b) => b.count - a.count);
    
    console.log(`📋 Portföydeki para birimleri:`);
    currencies.forEach((c, i) => {
      console.log(`   ${i+1}. ${c.currency}: ${c.count} kayıt`);
    });
    
    return currencies;
  },
  
  /**
   * Sheet adını güvenli şekilde al
   */
  _getSheetName: function() {
    // CONFIG'ten al, yoksa varsayılan
    try {
      if (CONFIG && CONFIG.SHEETS && CONFIG.SHEETS.DOVIZ_GECMIS && CONFIG.SHEETS.DOVIZ_GECMIS.NAME) {
        return CONFIG.SHEETS.DOVIZ_GECMIS.NAME;
      }
    } catch (e) {
      // CONFIG erişim hatası
    }
    return 'DOVIZ_GECMIS_GUNLUK'; // Varsayılan
  },
  
  /**
   * Tarih aralığını güvenli şekilde al
   */
  _getDateRange: function() {
    // CONFIG'ten al, yoksa varsayılan
    try {
      if (CONFIG && CONFIG.DOVIZ && CONFIG.DOVIZ.DEFAULT_RANGE) {
        return CONFIG.DOVIZ.DEFAULT_RANGE;
      }
    } catch (e) {
      // CONFIG erişim hatası
    }
    return '3mo'; // Varsayılan (3 ay)
  },
  
  /**
   * Para birimini Yahoo Finance sembolüne çevir
   */
  _createCurrencySymbol: function(currency) {
    const currencyUpper = currency.toUpperCase();
    
    // Para birimi eşleştirmeleri
    const currencyMap = {
      'TL': 'TRY',    // TL -> TRY
      'EURO': 'EUR',  // EURO -> EUR
      'USD': 'USD',
      'EUR': 'EUR',
      'GBP': 'GBP',
      'JPY': 'JPY',
      'CHF': 'CHF',
      'CAD': 'CAD',
      'AUD': 'AUD'
    };
    
    const normalizedCurrency = currencyMap[currencyUpper] || currencyUpper;
    
    // TRY ise döviz kuru çekmeye gerek yok
    if (normalizedCurrency === 'TRY') {
      console.log(`   ℹ️ ${currency} (TRY) için döviz kuru çekmeye gerek yok`);
      return null;
    }
    
    const symbol = `${normalizedCurrency}TRY=X`;
    console.log(`   🔄 ${currency} -> ${symbol}`);
    return symbol;
  },
  
  /**
   * Sheet'i getir veya oluştur
   */
  _getOrCreateSheet: function(sheetName) {
    const ss = SpreadsheetApp.getActive();
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      console.log(`📄 "${sheetName}" sheet'i oluşturuluyor...`);
      sheet = ss.insertSheet(sheetName);
      
      // Başlıkları yaz
      const headers = [
        'Sembol',
        'Tarih',
        'Açılış',
        'Yüksek',
        'Düşük',
        'Kapanış',
        'Kaynak',
        'Eklenme Tarihi'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      
      // Kolon genişliklerini ayarla
      sheet.setColumnWidth(1, 120); // Sembol
      sheet.setColumnWidth(2, 120); // Tarih
      sheet.setColumnWidth(3, 100); // Açılış
      sheet.setColumnWidth(4, 100); // Yüksek
      sheet.setColumnWidth(5, 100); // Düşük
      sheet.setColumnWidth(6, 100); // Kapanış
      sheet.setColumnWidth(7, 120); // Kaynak
      sheet.setColumnWidth(8, 150); // Eklenme Tarihi
    }
    
    return sheet;
  },
  
  /**
   * Bir sembol için sheet'teki en son tarihi bul
   */
  _getLastRecordDateForSymbol: function(sheet, symbol) {
    // Sheet boşsa null döndür
    if (sheet.getLastRow() <= 1) {
      return null;
    }
    
    try {
      // Tüm verileri oku (Sembol ve Tarih sütunları)
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
      let lastDate = null;
      
      // Bu sembol için en son tarihi bul
      for (const row of data) {
        const existingSymbol = row[0];
        const date = row[1];
        
        if (existingSymbol === symbol && date instanceof Date) {
          const recordDate = new Date(date);
          if (!lastDate || recordDate > lastDate) {
            lastDate = recordDate;
          }
        }
      }
      
      return lastDate;
      
    } catch (error) {
      console.log(`   ℹ️ ${symbol}: Kayıt tarihi okunamadı, yeni sheet olabilir`);
      return null;
    }
  },
  
  /**
   * Bir tarihin güncel olup olmadığını kontrol et
   */
  _isUpToDate: function(lastDate) {
    if (!lastDate) {
      return false; // Hiç kayıt yok, güncel değil
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const recordDate = new Date(lastDate);
    recordDate.setHours(0, 0, 0, 0);
    
    // Bugün ile kayıt tarihi arasındaki gün farkı
    const timeDiff = today.getTime() - recordDate.getTime();
    const dayDiff = timeDiff / (1000 * 3600 * 24);
    
    // Son kayıt bugün veya dün ise güncel kabul et
    const isUpToDate = dayDiff <= 1;
    
    console.log(`   📊 Güncellik kontrolü:`);
    console.log(`      Son kayıt: ${recordDate.toISOString().split('T')[0]}`);
    console.log(`      Bugün: ${today.toISOString().split('T')[0]}`);
    console.log(`      Gün farkı: ${dayDiff.toFixed(1)}`);
    console.log(`      Güncel mi? ${isUpToDate ? '✅ Evet' : '❌ Hayır'}`);
    
    return isUpToDate;
  },
  
  /**
   * Döviz verilerini sheet'e yaz (duplicate kontrolü ile)
   */
  _writeToCurrencySheet: function(sheet, symbol, dailyData) {
    console.log(`   📝 ${symbol} verileri sheet'e yazılıyor...`);
    
    // 1. Mevcut kayıtları al (duplicate kontrolü için)
    const existingRecords = this._getExistingRecords(sheet, symbol);
    
    // 2. Yeni kayıtları hazırla
    const rowsToWrite = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    dailyData.forEach(d => {
      const tarih = new Date(d.tarih);
      tarih.setHours(0, 0, 0, 0);
      
      // Gelecek tarihleri atla
      if (tarih > today) return;
      
      const tarihStr = Utilities.formatDate(tarih, 'GMT', 'yyyy-MM-dd');
      const key = `${symbol}_${tarihStr}`;
      
      // Duplicate kontrolü
      if (existingRecords.has(key)) {
        return;
      }
      
      rowsToWrite.push([
        symbol,
        tarih, // Tarih
        d.open || 0,
        d.high || 0,
        d.low || 0,
        d.close || 0,
        'YahooFinance',
        new Date() // Eklenme tarihi
      ]);
    });
    
    if (rowsToWrite.length === 0) {
      console.log(`   ⏭️ ${symbol}: Tüm veriler zaten mevcut`);
      return 0;
    }
    
    // 3. Sheet'e yaz
    const startRow = sheet.getLastRow() + 1;
    const range = sheet.getRange(startRow, 1, rowsToWrite.length, 8);
    range.setValues(rowsToWrite);
    
    // 4. Formatları ayarla
    const dateRange = sheet.getRange(startRow, 2, rowsToWrite.length, 1);
    dateRange.setNumberFormat('YYYY-MM-DD');
    
    const priceRange = sheet.getRange(startRow, 3, rowsToWrite.length, 4);
    priceRange.setNumberFormat('#,##0.00');
    
    const addedRange = sheet.getRange(startRow, 8, rowsToWrite.length, 1);
    addedRange.setNumberFormat('YYYY-MM-DD HH:mm:ss');
    
    console.log(`   ✅ ${symbol}: ${rowsToWrite.length} kayıt eklendi (satır ${startRow}-${startRow + rowsToWrite.length - 1})`);
    
    return rowsToWrite.length;
  },
  
  /**
   * Sheet'teki mevcut kayıtları getir (duplicate kontrolü için)
   */
  _getExistingRecords: function(sheet, symbol) {
    const existingMap = new Set();
    
    // Sheet boşsa boş set döndür
    if (sheet.getLastRow() <= 1) {
      return existingMap;
    }
    
    try {
      // Sembol ve tarih sütunlarını oku
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
      
      data.forEach(row => {
        const existingSymbol = row[0];
        const date = row[1];
        
        if (existingSymbol === symbol && date instanceof Date) {
          const dateStr = Utilities.formatDate(date, 'GMT', 'yyyy-MM-dd');
          const key = `${symbol}_${dateStr}`;
          existingMap.add(key);
        }
      });
      
      console.log(`   📊 ${symbol}: Sheet'te ${existingMap.size} mevcut kayıt bulundu`);
      
    } catch (error) {
      console.log(`   ℹ️ ${symbol}: Mevcut kayıtlar okunamadı, yeni sheet olabilir`);
    }
    
    return existingMap;
  },
  
  /**
   * Sheet istatistiklerini göster
   */
  showSheetStats: function() {
    const sheetName = this._getSheetName();
    const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
    
    if (!sheet) {
      console.log(`❌ "${sheetName}" sheet'i bulunamadı`);
      return;
    }
    
    console.log('\n📊 DÖVİZ SHEET İSTATİSTİKLERİ:');
    console.log(`   Sheet: ${sheet.getName()}`);
    console.log(`   Toplam Satır: ${sheet.getLastRow()}`);
    
    if (sheet.getLastRow() > 1) {
      // Döviz sembollerine göre grupla
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
      const symbolCounts = {};
      const symbolDates = {};
      
      data.forEach(row => {
        const symbol = row[0];
        const date = row[1];
        
        if (symbol) {
          symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
          
          if (date instanceof Date) {
            if (!symbolDates[symbol] || date > symbolDates[symbol]) {
              symbolDates[symbol] = date;
            }
          }
        }
      });
      
      console.log(`   Kayıtlı Döviz Çifti Sayısı: ${Object.keys(symbolCounts).length}`);
      
      if (Object.keys(symbolCounts).length > 0) {
        console.log('   📈 KAYIT DETAYLARI:');
        Object.entries(symbolCounts).forEach(([symbol, count], index) => {
          const lastDate = symbolDates[symbol];
          const lastDateStr = lastDate ? lastDate.toISOString().split('T')[0] : 'Bilinmiyor';
          console.log(`      ${index + 1}. ${symbol}: ${count} kayıt (Son: ${lastDateStr})`);
        });
      }
    }
  },
  
  /**
   * GÜNCEL 2 YILLIK VERİ ÇEK - Manuel fonksiyon
   */
  fetchFullTwoYearHistory: function() {
    console.log('📅 2 YILLIK TAM GEÇMİŞ VERİ ÇEKİLİYOR');
    console.log('⏳ Bu işlem biraz zaman alabilir...');
    
    // Geçici olarak DEFAULT_RANGE'i 2y yap
    const originalDefaultRange = this._getDateRange();
    
    try {
      // CONFIG'i geçici olarak değiştir (mümkünse)
      try {
        if (CONFIG && CONFIG.DOVIZ) {
          CONFIG.DOVIZ.DEFAULT_RANGE = '2y';
        }
      } catch (e) {
        // CONFIG erişim hatası
        console.log('ℹ️ CONFIG değiştirilemedi, 2y ile devam edilecek');
      }
      
      const result = this.syncAllCurrencyHistory();
      
      console.log('\n🎯 2 YILLIK VERİ ÇEKME SONUCU:');
      console.log(JSON.stringify(result, null, 2));
      
      return result;
      
    } catch (error) {
      console.error('💥 2 yıllık veri çekme hatası:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      // Orijinal ayarı geri yükle (mümkünse)
      try {
        if (CONFIG && CONFIG.DOVIZ && originalDefaultRange) {
          CONFIG.DOVIZ.DEFAULT_RANGE = originalDefaultRange;
        }
      } catch (e) {
        // Geri yükleme hatası
      }
    }
  },
  
  /**
   * BELİRLİ BİR DÖVİZ İÇİN 2 YILLIK VERİ ÇEK
   */
  fetchTwoYearHistoryForCurrency: function(currencyCode) {
    console.log(`📅 ${currencyCode} için 2 yıllık veri çekiliyor...`);
    
    try {
      // Symbol oluştur
      const symbol = this._createCurrencySymbol(currencyCode);
      if (!symbol) {
        console.log(`❌ ${currencyCode} için sembol oluşturulamadı`);
        return { success: false, message: 'Geçersiz para birimi' };
      }
      
      // Sheet'i hazırla
      const sheetName = this._getSheetName();
      const sheet = this._getOrCreateSheet(sheetName);
      
      // 2 yıllık veriyi çek
      console.log(`📡 ${symbol} (2y) verisi çekiliyor...`);
      const data = YahooFinanceStockService.fetchDailyHistory(symbol, '2y');
      
      if (!data || data.length === 0) {
        console.log(`❌ ${currencyCode} verisi alınamadı`);
        return { success: false, message: 'Veri alınamadı' };
      }
      
      console.log(`✅ ${data.length} gün veri alındı`);
      
      // Tarih aralığını göster
      if (data.length > 0) {
        const firstDate = data[0].tarih.toISOString().split('T')[0];
        const lastDate = data[data.length - 1].tarih.toISOString().split('T')[0];
        console.log(`📅 Tarih aralığı: ${firstDate} - ${lastDate}`);
      }
      
      // Mevcut kayıtları sil (bu sembol için)
      this._deleteExistingRecordsForSymbol(sheet, symbol);
      
      // Yeni kayıtları hazırla
      const rowsToWrite = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      data.forEach(d => {
        const tarih = new Date(d.tarih);
        tarih.setHours(0, 0, 0, 0);
        
        // Gelecek tarihleri atla
        if (tarih > today) return;
        
        rowsToWrite.push([
          symbol,
          tarih,
          d.open || 0,
          d.high || 0,
          d.low || 0,
          d.close || 0,
          'YahooFinance',
          new Date()
        ]);
      });
      
      if (rowsToWrite.length === 0) {
        console.log(`ℹ️ Yazılacak veri yok`);
        return { success: true, newRecords: 0 };
      }
      
      // Yeni kayıtları yaz
      const startRow = sheet.getLastRow() + 1;
      const range = sheet.getRange(startRow, 1, rowsToWrite.length, 8);
      range.setValues(rowsToWrite);
      
      // Formatları ayarla
      const dateRange = sheet.getRange(startRow, 2, rowsToWrite.length, 1);
      dateRange.setNumberFormat('YYYY-MM-DD');
      
      const priceRange = sheet.getRange(startRow, 3, rowsToWrite.length, 4);
      priceRange.setNumberFormat('#,##0.00');
      
      const addedRange = sheet.getRange(startRow, 8, rowsToWrite.length, 1);
      addedRange.setNumberFormat('YYYY-MM-DD HH:mm:ss');
      
      console.log(`✅ ${symbol}: ${rowsToWrite.length} kayıt eklendi`);
      
      return {
        success: true,
        currency: currencyCode,
        symbol: symbol,
        newRecords: rowsToWrite.length,
        dateRange: {
          first: data[0].tarih.toISOString().split('T')[0],
          last: data[data.length - 1].tarih.toISOString().split('T')[0]
        }
      };
      
    } catch (error) {
      console.error(`💥 ${currencyCode} 2 yıllık veri hatası:`, error.message);
      return {
        success: false,
        currency: currencyCode,
        error: error.message
      };
    }
  },
  
  /**
   * Bir sembol için mevcut kayıtları sil
   */
  _deleteExistingRecordsForSymbol: function(sheet, symbol) {
    if (sheet.getLastRow() <= 1) return 0;
    
    let deletedCount = 0;
    const rowsToDelete = [];
    
    try {
      // Tüm verileri oku
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
      
      // Silinecek satırları bul
      data.forEach((row, index) => {
        if (row[0] === symbol) {
          rowsToDelete.push(index + 2); // +2 çünkü 1. satır başlık, 2. satırdan başlıyor
        }
      });
      
      // Tersten sil (satır numaraları değişmesin diye)
      rowsToDelete.reverse().forEach(rowNum => {
        sheet.deleteRow(rowNum);
        deletedCount++;
      });
      
      if (deletedCount > 0) {
        console.log(`   🗑️  ${symbol}: ${deletedCount} eski kayıt silindi`);
      }
      
    } catch (error) {
      console.log(`   ℹ️ ${symbol}: Eski kayıtlar silinemedi:`, error.message);
    }
    
    return deletedCount;
  }
};

/**
 *  FONKSİYON ÖZETİ:
  Fonksiyon	Amaç	Sıklık
  test_DovizService_Main()	Portföy bazlı döviz senkronizasyonu	Günlük
  check_Currency_Updates()	Güncellik kontrolü	Günlük
  analyze_Portfolio_Currencies()	Portföy analizi	Haftalık
  fetch_TwoYear_History()	2 yıllık geçmiş veri çekme	İlk kurulumda
  reset_Currency_Sheet()	Sheet temizleme	Nadiren
 */
/**
 * 🧪 DÖVİZ SERVİSİ TEMEL TESTİ
 * Ana fonksiyon: Portföy bazlı döviz senkronizasyonu
 */
function test_DovizService_Main() {
  console.log('🧪 DÖVİZ SERVİSİ ANA TESTİ');
  console.log('⚡ Portföydeki para birimlerine göre döviz verisi çekilecek');
  
  // 1. Portföy analizi
  console.log('\n🔍 Portföy analizi yapılıyor...');
  const portfolio = DataReader.readPortfolio();
  const currencies = DovizService._extractCurrenciesFromPortfolio(portfolio);
  
  console.log(`📌 Portföyde ${currencies.length} farklı para birimi bulundu`);
  currencies.forEach((c, i) => {
    console.log(`   ${i+1}. ${c.currency}: ${c.count} kayıt`);
  });
  
  // 2. Döviz senkronizasyonu
  console.log('\n🚀 Döviz senkronizasyonu başlatılıyor...');
  const result = DovizService.syncAllCurrencyHistory();
  
  // 3. Sonuçları göster
  console.log('\n🎯 TEST SONUCU:');
  console.log(JSON.stringify(result, null, 2));
  
  // 4. Sheet istatistikleri
  console.log('\n📊 SHEET DURUMU:');
  try {
    DovizService.showSheetStats();
  } catch (e) {
    console.log('ℹ️ Sheet istatistikleri gösterilemedi');
  }
  
  return result;
}

/**
 * 📅 2 YILLIK TAM GEÇMİŞ VERİ ÇEK
 * Eksik olan tüm 2 yıllık verileri tamamlar
 */
function fetch_TwoYear_History() {
  console.log('📅 2 YILLIK TAM GEÇMİŞ VERİ ÇEKİLİYOR');
  console.log('⏳ Bu işlem biraz zaman alabilir...');
  
  const result = DovizService.fetchFullTwoYearHistory();
  
  console.log('\n🎯 SONUÇ:');
  console.log(JSON.stringify(result, null, 2));
  
  return result;
}

/**
 * 🔍 GÜNCELLİK KONTROLÜ
 * Mevcut döviz verilerinin güncel olup olmadığını kontrol eder
 */
function check_Currency_Updates() {
  console.log('🔍 DÖVİZ GÜNCELLİK KONTROLÜ');
  
  try {
    // Sheet'i kontrol et
    const sheetName = DovizService._getSheetName();
    const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
    
    if (!sheet) {
      console.log('ℹ️ Döviz sheet\'i bulunamadı');
      return;
    }
    
    console.log(`📄 Sheet: ${sheet.getName()}, Satır: ${sheet.getLastRow()}`);
    
    if (sheet.getLastRow() <= 1) {
      console.log('ℹ️ Sheet boş');
      return;
    }
    
    // Portföydeki para birimlerini al
    const portfolio = DataReader.readPortfolio();
    const currencies = DovizService._extractCurrenciesFromPortfolio(portfolio);
    
    console.log(`📊 Portföydeki yabancı para birimleri: ${currencies.filter(c => c.currency !== 'TL').length} adet`);
    
    currencies.forEach((currency, index) => {
      const symbol = DovizService._createCurrencySymbol(currency.currency);
      if (!symbol) return;
      
      console.log(`\n${index + 1}. ${currency.currency} -> ${symbol}:`);
      
      try {
        const lastDate = DovizService._getLastRecordDateForSymbol(sheet, symbol);
        const isUpToDate = DovizService._isUpToDate(lastDate);
        
        console.log(`   Son kayıt: ${lastDate ? lastDate.toISOString().split('T')[0] : 'Yok'}`);
        console.log(`   Güncel mi? ${isUpToDate ? '✅ Evet' : '❌ Hayır'}`);
        
      } catch (error) {
        console.log(`   ❌ Hata: ${error.message}`);
      }
    });
    
  } catch (error) {
    console.error('💥 Kontrol hatası:', error.message);
  }
}

/**
 * 🗑️ DÖVİZ SHEET'İNİ TEMİZLE (TEST İÇİN)
 * Sadece ihtiyaç olduğunda kullanın
 */
function reset_Currency_Sheet() {
  console.log('🗑️ DÖVİZ SHEET TEMİZLEME');
  
  const sheetName = DovizService._getSheetName();
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  
  if (sheet) {
    // Sheet'i tamamen sil
    const ss = SpreadsheetApp.getActive();
    ss.deleteSheet(sheet);
    console.log(`✅ "${sheetName}" sheet'i silindi`);
  } else {
    console.log(`ℹ️ "${sheetName}" sheet'i bulunamadı`);
  }
  
  return {
    success: true,
    message: 'Sheet temizlendi'
  };
}

/**
 * 📊 PORTFÖY PARA BİRİMİ ANALİZİ
 * Portföyde hangi para birimlerinin olduğunu gösterir
 */
function analyze_Portfolio_Currencies() {
  console.log('📊 PORTFÖY PARA BİRİMİ ANALİZİ');
  
  try {
    const portfolio = DataReader.readPortfolio();
    
    console.log(`📦 Toplam kayıt: ${portfolio.length}`);
    
    // Tüm para birimlerini say
    const currencyCounts = {};
    
    portfolio.forEach(item => {
      const currency = item.birimi ? item.birimi.toUpperCase() : 'BELİRSİZ';
      currencyCounts[currency] = (currencyCounts[currency] || 0) + 1;
    });
    
    console.log('\n📋 PARA BİRİMİ DAĞILIMI:');
    Object.entries(currencyCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([currency, count], index) => {
        const percentage = ((count / portfolio.length) * 100).toFixed(1);
        console.log(`   ${index + 1}. ${currency}: ${count} kayıt (%${percentage})`);
      });
    
    // Yabancı para birimleri
    const foreignCurrencies = Object.entries(currencyCounts)
      .filter(([currency]) => currency !== 'TL' && currency !== 'TRY')
      .map(([currency, count]) => ({ currency, count }));
    
    console.log(`\n🎯 YABANCI PARA BİRİMLERİ (${foreignCurrencies.length} adet):`);
    
    if (foreignCurrencies.length > 0) {
      foreignCurrencies.forEach(({ currency, count }, index) => {
        const yahooSymbol = DovizService._createCurrencySymbol(currency);
        console.log(`   ${index + 1}. ${currency}: ${count} kayıt → ${yahooSymbol || 'Geçersiz'}`);
      });
    } else {
      console.log('   ℹ️ Portföyde sadece TL kullanılmış');
    }
    
  } catch (error) {
    console.error('💥 Analiz hatası:', error);
  }
}
