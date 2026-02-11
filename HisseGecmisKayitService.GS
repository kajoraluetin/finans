
/**
 * 🏦 HISSE GEÇMİŞ KAYIT SERVİSİ (ABD + BIST)
 * Modül 2: Veritabanı İşlemleri ve Senkronizasyon
 * BAĞIMLILIKLAR: YahooFinanceStockService.gs, DataReader.gs, CONFIG
 */

const HisseGecmisKayitService = {

  /**
   * ANA TETİKLEYİCİ - Tüm hisseler (ABD + BIST)
   */
  syncAllStockHistory: function() {
    console.log('📥 HİSSE GEÇMİŞ SENKRONİZASYONU BAŞLADI (Tüm Hisseler)');
    console.log('📅 Tarih:', new Date().toISOString());
    console.log('⚡ Mod: Tüm hisseler için 3 aylık veri');

    const startTime = new Date();
    try {
      // 1. Portföyü oku
      console.log('📖 Portföy okunuyor...');
      const portfolio = DataReader.readPortfolio();
      console.log(`📦 Portföy kayıt sayısı: ${portfolio.length}`);

      // 2. Tüm hisseleri ayıkla (ABD + BIST)
      console.log('🔍 Hisseler ayıklanıyor...');
      const stocks = this._extractAllStocks(portfolio);
      console.log(`📌 Toplam hisse: ${stocks.length}`);
      
      if (stocks.length === 0) {
        console.log('⚠️ Portföyde işlenecek hisse bulunamadı!');
        return;
      }

      // 3. Sheet'i hazırla
      const ss = SpreadsheetApp.getActive();
      const sheetName = CONFIG.SHEETS.HISSE_GECMIS_GUNLUK?.NAME || 'HISSE_GECMIS_GUNLUK';
      const sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) {
        console.error(`❌ Sheet bulunamadı: ${sheetName}`);
        return;
      }

      console.log(`📝 Hedef Sheet: ${sheetName} (${sheet.getLastRow()} satır mevcut)`);

      let totalWritten = 0;
      let totalFailed = 0;
      let successfulSymbols = [];
      let failedSymbols = [];

      // 4. Her hisseyi işle
      stocks.forEach((stock, index) => {
        console.log('\n━━━━━━━━━━━━━━━━━━━━');
        console.log(`📊 İŞLENİYOR (${index + 1}/${stocks.length}) → ${stock.symbol} (${stock.type})`);

        try {
          // a) Yahoo Finance'ten veri al
          const dailyData = YahooFinanceStockService.fetchDailyHistory(stock.yahooSymbol, '3mo');

          if (!dailyData || dailyData.length === 0) {
            console.warn(`⚠️ Veri yok → ${stock.symbol}`);
            totalFailed++;
            failedSymbols.push(stock.symbol);
            return;
          }

          console.log(`📦 ${dailyData.length} günlük veri alındı`);

          // b) Sheet'e yaz (duplicate kontrolü ile)
          // Not: Sheet'e yazarken orijinal sembolü kullan (yahooSymbol değil)
          const written = this._writeToSheet(sheet, stock.symbol, dailyData);
          
          if (written > 0) {
            totalWritten += written;
            successfulSymbols.push({
              symbol: stock.symbol,
              yahooSymbol: stock.yahooSymbol,
              type: stock.type,
              newRecords: written,
              firstDate: dailyData[0].tarih.toISOString().split('T')[0],
              lastDate: dailyData[dailyData.length-1].tarih.toISOString().split('T')[0]
            });
            console.log(`✅ ${written} yeni kayıt yazıldı`);
          } else {
            console.log(`⏭️ Yeni kayıt yok (tüm veriler zaten mevcut)`);
          }

        } catch (error) {
          console.error(`💥 ${stock.symbol} işlenirken hata:`, error.message);
          totalFailed++;
          failedSymbols.push(stock.symbol);
        }

        // c) Rate limit için bekle (sadece sonraki hisse varsa)
        if (index < stocks.length - 1) {
          console.log('⏳ 2 saniye bekleniyor...');
          Utilities.sleep(2000);
        }
      });

      // 5. Özet göster
      const duration = (new Date().getTime() - startTime.getTime()) / 1000;
      
      console.log('\n════════════════════════════════════════');
      console.log('📊 SENKRONİZASYON ÖZETİ');
      console.log('════════════════════════════════════════');
      console.log(`📅 Tarih: ${new Date().toISOString().split('T')[0]}`);
      console.log(`⏱️  Süre: ${duration.toFixed(1)} saniye`);
      console.log(`📈 Toplam Hisse: ${stocks.length}`);
      console.log(`✅ Başarılı: ${successfulSymbols.length}`);
      console.log(`❌ Başarısız: ${totalFailed}`);
      console.log(`📝 Yeni Kayıt: ${totalWritten}`);

      if (successfulSymbols.length > 0) {
        console.log('\n✅ BAŞARILI HİSSELER:');
        successfulSymbols.forEach(item => {
          console.log(`   ${item.symbol} (${item.type}) -> ${item.yahooSymbol}: ${item.newRecords} kayıt (${item.firstDate} - ${item.lastDate})`);
        });
      }

      if (failedSymbols.length > 0) {
        console.log('\n⚠️ BAŞARISIZ HİSSELER:');
        console.log(failedSymbols.join(', '));
        console.log('💡 İpucu: Bu hisseler için sembol kontrolü yapın.');
      }

      // 6. Sheet istatistiklerini göster
      this._showSheetStats(sheet);

      console.log('\n🎉 HİSSE GEÇMİŞ SENKRONİZASYONU TAMAMLANDI');

    } catch (error) {
      console.error('💥 GENEL SENKRONİZASYON HATASI', error);
    }
  },

  /**
   * Portföyden tüm hisseleri ayıkla (ABD + BIST)
   */
  _extractAllStocks: function(portfolio) {
    console.log('🔍 Portföyden tüm hisseler ayıklanıyor...');

    const stockMap = new Map();
    
    portfolio.forEach(item => {
      if (!item.baslik || !item.kategori) return;

      const kategori = (item.kategori || '').toString().toUpperCase();
      const symbol = item.baslik.trim().toUpperCase();
      
      // ABD hisseleri (NASDAQ, NYSE, AMEX)
      if (kategori.includes('NASDAQ') || kategori.includes('NYSE') || kategori.includes('AMEX')) {
        const key = `USD-${symbol}`;
        if (!stockMap.has(key)) {
          stockMap.set(key, {
            symbol: symbol,
            yahooSymbol: symbol, // ABD hisseleri için sembol aynı
            type: 'ABD',
            kategori: item.kategori,
            birimi: item.birimi || 'USD'
          });
        }
      }
      // BIST hisseleri
      else if (kategori.includes('BIST')) {
        const key = `BIST-${symbol}`;
        if (!stockMap.has(key)) {
          stockMap.set(key, {
            symbol: symbol,
            yahooSymbol: symbol + '.IS', // BIST hisseleri için .IS ekle
            type: 'BIST',
            kategori: item.kategori,
            birimi: item.birimi || 'TRY'
          });
        }
      }
    });

    const stocks = Array.from(stockMap.values());
    
    // Hisseleri grupla
    const usStocks = stocks.filter(s => s.type === 'ABD');
    const bistStocks = stocks.filter(s => s.type === 'BIST');
    
    console.log(`📌 Bulunan hisseler (${stocks.length} adet):`);
    console.log(`   🇺🇸 ABD Hisseleri (${usStocks.length}): ${usStocks.map(s => s.symbol).join(', ')}`);
    console.log(`   🇹🇷 BIST Hisseleri (${bistStocks.length}): ${bistStocks.map(s => s.symbol).join(', ')}`);
    
    return stocks;
  },

  /**
   * Sadece ABD hisselerini ayıkla (eski fonksiyon, geriye uyumluluk için)
   */
  _extractUSDStocks: function(portfolio) {
    return this._extractAllStocks(portfolio).filter(stock => stock.type === 'ABD');
  },

  /**
   * Sheet'e yaz (duplicate kontrolü ile)
   */
  _writeToSheet: function(sheet, symbol, dailyData) {
    console.log(`   📝 ${symbol} verileri sheet'e yazılıyor...`);

    // Mevcut kayıtları al (Sembol + Tarih)
    const existing = this._getExistingRecords(sheet);
    
    const rowsToWrite = [];
    const today = new Date();
    
    dailyData.forEach(d => {
      const tarih = new Date(d.tarih);
      
      // Gelecek tarihleri atla
      if (tarih > today) return;
      
      const tarihStr = Utilities.formatDate(tarih, 'GMT', 'yyyy-MM-dd');
      const key = `${symbol}_${tarihStr}`;
      
      // Duplicate kontrolü
      if (existing.has(key)) {
        return;
      }

      rowsToWrite.push([
        symbol,
        tarih, // Tarih
        d.open || 0,
        d.high || 0,
        d.low || 0,
        d.close || 0,
        d.volume || 0,
        'YahooFinance', // Kaynak
        new Date() // Eklenme tarihi
      ]);
    });

    if (rowsToWrite.length === 0) {
      console.log(`   ⏭️ ${symbol}: Tüm veriler zaten mevcut`);
      return 0;
    }

    // Sheet'e yaz
    const startRow = sheet.getLastRow() + 1;
    const range = sheet.getRange(startRow, 1, rowsToWrite.length, 9); // 9 sütun
    range.setValues(rowsToWrite);
    
    // Tarih sütununu formatla
    const dateRange = sheet.getRange(startRow, 2, rowsToWrite.length, 1);
    dateRange.setNumberFormat('YYYY-MM-DD');
    
    console.log(`   ✅ ${symbol}: ${rowsToWrite.length} kayıt eklendi (satır ${startRow}-${startRow + rowsToWrite.length - 1})`);
    
    return rowsToWrite.length;
  },

  /**
   * Sheet'teki mevcut kayıtları getir
   */
  _getExistingRecords: function(sheet) {
    const existingMap = new Map();
    
    if (sheet.getLastRow() <= 1) {
      return existingMap;
    }
    
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    
    data.forEach(row => {
      const symbol = row[0];
      const date = row[1];
      
      if (symbol && date instanceof Date) {
        const key = `${symbol}_${Utilities.formatDate(date, 'GMT', 'yyyy-MM-dd')}`;
        existingMap.set(key, true);
      }
    });
    
    return existingMap;
  },

  /**
   * Sheet istatistiklerini göster
   */
  _showSheetStats: function(sheet) {
    console.log('\n📊 SHEET İSTATİSTİKLERİ:');
    console.log(`   Sheet: ${sheet.getName()}`);
    console.log(`   Toplam Satır: ${sheet.getLastRow()}`);
    
    if (sheet.getLastRow() > 1) {
      // Hisselere göre grupla
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
      const symbolCounts = {};
      
      data.forEach(row => {
        const symbol = row[0];
        if (symbol) {
          symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
        }
      });
      
      console.log(`   Kayıtlı Hisse Sayısı: ${Object.keys(symbolCounts).length}`);
      
      // En çok kaydı olan 5 hisse
      const sortedSymbols = Object.entries(symbolCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      console.log('   📈 En Çok Kayıtlı 5 Hisse:');
      sortedSymbols.forEach(([symbol, count], index) => {
        console.log(`      ${index + 1}. ${symbol}: ${count} kayıt`);
      });
    }
  },

  /**
   * GÜNLÜK GÜNCELLEME - Tüm hisseler (ABD + BIST)
   */
  updateAllStocks: function() {
    console.log('🔄 TÜM HİSSE GÜNCELLEMESİ BAŞLADI');
    console.log('📅 Tarih:', new Date().toISOString());

    const startTime = new Date();
    try {
      // 1. Portföy ve hisseler
      const portfolio = DataReader.readPortfolio();
      const stocks = this._extractAllStocks(portfolio);
      
      console.log(`📦 İşlenecek hisse: ${stocks.length}`);

      if (stocks.length === 0) {
        console.log('ℹ️ Güncellenecek hisse yok');
        return;
      }

      // 2. Sheet
      const ss = SpreadsheetApp.getActive();
      const sheetName = CONFIG.SHEETS.HISSE_GECMIS_GUNLUK?.NAME || 'HISSE_GECMIS_GUNLUK';
      const sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) {
        console.error(`❌ Sheet bulunamadı: ${sheetName}`);
        return;
      }

      let updatedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      let totalNewRecords = 0;

      // 3. Her hisse için
      stocks.forEach((stock, index) => {
        console.log(`\n📊 ${index + 1}/${stocks.length}: ${stock.symbol} (${stock.type})`);
        
        try {
          // a) Son tarihi kontrol et
          const lastDate = this._getLastDateForSymbol(sheet, stock.symbol);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // b) Güncel mi kontrol et
          if (lastDate) {
            const daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
            
            if (daysDiff <= 1) {
              console.log(`   ⏭️ Zaten güncel (son tarih: ${lastDate.toISOString().split('T')[0]})`);
              skippedCount++;
              return;
            }
            
            console.log(`   📅 Son kayıt: ${lastDate.toISOString().split('T')[0]} (${daysDiff} gün önce)`);
          }
          
          // c) Kaç günlük veri çekeceğini belirle
          const range = this._calculateDateRange(lastDate);
          console.log(`   🔍 ${range} veri aranıyor...`);
          
          // d) Veriyi al (Yahoo sembolü ile)
          const allData = YahooFinanceStockService.fetchDailyHistory(stock.yahooSymbol, range);
          
          if (!allData || allData.length === 0) {
            console.log(`   ⚠️ Veri alınamadı`);
            failedCount++;
            return;
          }
          
          // e) Yeni verileri filtrele
          const newData = lastDate 
            ? allData.filter(item => new Date(item.tarih) > lastDate)
            : allData;
          
          console.log(`   📦 ${allData.length} gün veriden ${newData.length} yeni`);
          
          if (newData.length === 0) {
            console.log(`   ⏭️ Yeni veri yok`);
            skippedCount++;
            return;
          }
          
          // f) Sheet'e yaz (orijinal sembol ile)
          const written = this._writeToSheet(sheet, stock.symbol, newData);
          
          if (written > 0) {
            console.log(`   ✅ ${written} yeni kayıt eklendi`);
            updatedCount++;
            totalNewRecords += written;
          }
          
        } catch (error) {
          console.error(`   💥 Hata: ${error.message}`);
          failedCount++;
        }
        
        // g) Bekleme
        if (index < stocks.length - 1) {
          Utilities.sleep(2000);
        }
      });

      // 4. Özet
      const duration = (new Date().getTime() - startTime.getTime()) / 1000;
      
      console.log('\n📊 GÜNCELLEME ÖZETİ');
      console.log({
        toplamHisse: stocks.length,
        guncellenen: updatedCount,
        atlanan: skippedCount,
        hatali: failedCount,
        yeniKayit: totalNewRecords,
        toplamSureSn: duration.toFixed(1)
      });

      console.log('✅ TÜM HİSSE GÜNCELLEMESİ TAMAMLANDI');

    } catch (error) {
      console.error('💥 Güncelleme hatası:', error);
    }
  },

  /**
   * Bir hissenin sheet'teki en son tarihini bul
   */
  _getLastDateForSymbol: function(sheet, symbol) {
    if (sheet.getLastRow() <= 1) return null;
    
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    
    let lastDate = null;
    for (const row of data) {
      if (row[0] === symbol && row[1] instanceof Date) {
        const date = new Date(row[1]);
        if (!lastDate || date > lastDate) {
          lastDate = date;
        }
      }
    }
    
    return lastDate;
  },

  /**
   * Ne kadar veri çekileceğini hesapla
   */
  _calculateDateRange: function(lastDate) {
    if (!lastDate) return '3mo'; // Hiç veri yoksa 3 ay
    
    const today = new Date();
    const daysSinceLast = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLast > 90) return '3mo';
    if (daysSinceLast > 30) return '1mo';
    if (daysSinceLast > 7) return '5d';
    return '5d'; // Varsayılan
  }
};

/**
 * 🧪 HİSSE GEÇMİŞ KAYIT SERVİSİ TESTİ - GERÇEK VERİLER
 * 
 * AMAÇ:
 * - Hisse geçmiş servisinin tüm fonksiyonlarını gerçek verilerle test et
 * - Sheet'teki mevcut verileri analiz et
 * - Bugünün verisi eksikse kontrol et
 * - Portföydeki hisseleri doğru çıkarıp çıkarmadığını test et
 */
function test_HisseGecmisKayitService_RealData() {
  console.log('='.repeat(70));
  console.log('🧪 HİSSE GEÇMİŞ KAYIT SERVİSİ TESTİ - GERÇEK VERİLER');
  console.log('='.repeat(70));
  
  const startTime = new Date();
  const testResults = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    errors: []
  };
  
  try {
    // 1. SERVİS KONTROLÜ
    console.log('\n1️⃣ SERVİS KONTROLÜ');
    testResults.totalTests++;
    
    if (typeof HisseGecmisKayitService === 'undefined') {
      console.log('❌ HisseGecmisKayitService tanımlı değil!');
      testResults.failed++;
      testResults.errors.push('HisseGecmisKayitService nesnesi bulunamadı');
      return testResults;
    }
    
    console.log('✅ HisseGecmisKayitService mevcut');
    testResults.passed++;
    
    // 2. PORTFÖY OKUMA VE HİSSE AYIKLAMA TESTİ
    console.log('\n2️⃣ PORTFÖY OKUMA VE HİSSE AYIKLAMA TESTİ');
    testResults.totalTests++;
    
    try {
      console.log('📖 Portföy okunuyor...');
      const portfolio = DataReader.readPortfolio();
      
      if (!portfolio || portfolio.length === 0) {
        console.log('⚠️ Portföy boş, bazı testler atlanacak');
        testResults.warnings++;
      } else {
        console.log(`✅ ${portfolio.length} portföy kaydı okundu`);
        
        // Hisseleri ayıkla
        console.log('🔍 Hisseler ayıklanıyor...');
        const stocks = HisseGecmisKayitService._extractAllStocks(portfolio);
        
        console.log(`📌 ${stocks.length} hisse bulundu:`);
        
        // ABD ve BIST hisselerini ayır
        const usStocks = stocks.filter(s => s.type === 'ABD');
        const bistStocks = stocks.filter(s => s.type === 'BIST');
        
        console.log(`   🇺🇸 ABD Hisseleri: ${usStocks.length}`);
        usStocks.slice(0, 5).forEach((stock, i) => {
          console.log(`      ${i + 1}. ${stock.symbol} -> ${stock.yahooSymbol}`);
        });
        if (usStocks.length > 5) console.log(`      ... ve ${usStocks.length - 5} tane daha`);
        
        console.log(`\n   🇹🇷 BIST Hisseleri: ${bistStocks.length}`);
        bistStocks.slice(0, 5).forEach((stock, i) => {
          console.log(`      ${i + 1}. ${stock.symbol} -> ${stock.yahooSymbol}`);
        });
        if (bistStocks.length > 5) console.log(`      ... ve ${bistStocks.length - 5} tane daha`);
        
        testResults.passed++;
      }
    } catch (error) {
      console.log(`❌ Portföy okuma/hisse ayıklama hatası: ${error.message}`);
      testResults.failed++;
      testResults.errors.push(`Portföy hatası: ${error.message}`);
    }
    
    // 3. SHEET KONTROLÜ
    console.log('\n3️⃣ SHEET KONTROLÜ');
    testResults.totalTests++;
    
    try {
      // Sheet adını CONFIG'ten al
      const sheetName = CONFIG?.SHEETS?.HISSE_GECMIS_GUNLUK?.NAME || 'HISSE_GECMIS_GUNLUK';
      console.log(`📄 Sheet adı: ${sheetName}`);
      
      const ss = SpreadsheetApp.getActive();
      const sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) {
        console.log(`❌ "${sheetName}" sheet'i bulunamadı!`);
        console.log('ℹ️ Sheet oluşturmak için: setup_Hisse_Sheet_Headers() fonksiyonunu çalıştırın');
        testResults.failed++;
        testResults.errors.push(`Sheet bulunamadı: ${sheetName}`);
      } else {
        const rowCount = sheet.getLastRow();
        const colCount = sheet.getLastColumn();
        
        console.log(`✅ Sheet bulundu: ${rowCount} satır, ${colCount} sütun`);
        
        // Başlıkları kontrol et
        if (rowCount > 0) {
          const headers = sheet.getRange(1, 1, 1, colCount).getValues()[0];
          console.log(`📋 Başlıklar: ${headers.join(' | ')}`);
          
          // Veri varsa analiz et
          if (rowCount > 1) {
            const dataCount = rowCount - 1;
            console.log(`📊 Sheet'te ${dataCount} kayıt var`);
            
            // Benzersiz hisseleri say
            if (dataCount > 0) {
              const symbolRange = sheet.getRange(2, 1, dataCount, 1);
              const symbols = symbolRange.getValues().flat();
              const uniqueSymbols = [...new Set(symbols.filter(s => s))];
              
              console.log(`🔢 ${uniqueSymbols.length} benzersiz hisse`);
              
              // Her hisse için kayıt sayısı
              const symbolCounts = {};
              symbols.forEach(symbol => {
                if (symbol) {
                  symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
                }
              });
              
              console.log('\n📈 HİSSE BAZLI KAYIT DAĞILIMI (ilk 10):');
              Object.entries(symbolCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .forEach(([symbol, count], i) => {
                  console.log(`   ${i + 1}. ${symbol}: ${count} kayıt`);
                });
              
              // Tarih aralığını kontrol et
              try {
                const dateRange = sheet.getRange(2, 2, dataCount, 1);
                const dates = dateRange.getValues().flat().filter(d => d instanceof Date);
                
                if (dates.length > 0) {
                  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
                  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
                  const dayDiff = Math.floor((maxDate - minDate) / (1000 * 60 * 60 * 24));
                  
                  console.log(`\n📅 TARİH ARALIĞI:`);
                  console.log(`   En erken: ${Utilities.formatDate(minDate, 'GMT', 'dd.MM.yyyy')}`);
                  console.log(`   En geç: ${Utilities.formatDate(maxDate, 'GMT', 'dd.MM.yyyy')}`);
                  console.log(`   Gün sayısı: ${dayDiff}`);
                  
                  // Bugünün tarihini kontrol et
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const hasToday = dates.some(d => {
                    const date = new Date(d);
                    date.setHours(0, 0, 0, 0);
                    return date.getTime() === today.getTime();
                  });
                  
                  console.log(`   Bugünün verisi: ${hasToday ? '✅ VAR' : '❌ YOK'}`);
                  
                  if (!hasToday) {
                    testResults.warnings++;
                    console.log('   ⚠️ Bugünün verisi eksik! Güncelleme gerekli.');
                  }
                }
              } catch (dateError) {
                console.log(`ℹ️ Tarih analizi hatası: ${dateError.message}`);
              }
            }
          } else {
            console.log('ℹ️ Sheet boş (sadece başlık satırı var)');
          }
        }
        
        testResults.passed++;
      }
    } catch (error) {
      console.log(`❌ Sheet kontrol hatası: ${error.message}`);
      testResults.failed++;
      testResults.errors.push(`Sheet hatası: ${error.message}`);
    }
    
    // 4. HİSSE BAŞINA SON TARİH KONTROLÜ
    console.log('\n4️⃣ HİSSE BAŞINA SON TARİH KONTROLÜ');
    testResults.totalTests++;
    
    try {
      const sheetName = CONFIG?.SHEETS?.HISSE_GECMIS_GUNLUK?.NAME || 'HISSE_GECMIS_GUNLUK';
      const ss = SpreadsheetApp.getActive();
      const sheet = ss.getSheetByName(sheetName);
      
      if (sheet && sheet.getLastRow() > 1) {
        const portfolio = DataReader.readPortfolio();
        const stocks = HisseGecmisKayitService._extractAllStocks(portfolio);
        
        if (stocks.length > 0) {
          console.log(`🔍 ${stocks.length} hisse için son tarihler kontrol ediliyor...`);
          
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          let upToDateCount = 0;
          let outdatedCount = 0;
          let missingCount = 0;
          
          stocks.slice(0, 10).forEach((stock, index) => { // Sadece ilk 10 hisse
            try {
              const lastDate = HisseGecmisKayitService._getLastDateForSymbol(sheet, stock.symbol);
              
              if (lastDate) {
                const lastDateNormalized = new Date(lastDate);
                lastDateNormalized.setHours(0, 0, 0, 0);
                
                const daysDiff = Math.floor((today - lastDateNormalized) / (1000 * 60 * 60 * 24));
                
                if (daysDiff <= 1) {
                  upToDateCount++;
                  console.log(`   ${index + 1}. ${stock.symbol}: ✅ Güncel (${daysDiff} gün önce)`);
                } else {
                  outdatedCount++;
                  console.log(`   ${index + 1}. ${stock.symbol}: ⚠️ Eski (${daysDiff} gün önce)`);
                }
              } else {
                missingCount++;
                console.log(`   ${index + 1}. ${stock.symbol}: ❌ Kayıt yok`);
              }
            } catch (error) {
              console.log(`   ${index + 1}. ${stock.symbol}: 💥 Hata: ${error.message}`);
            }
          });
          
          console.log(`\n📊 SONUÇ:`);
          console.log(`   Güncel: ${upToDateCount} hisse`);
          console.log(`   Eski: ${outdatedCount} hisse`);
          console.log(`   Kayıt yok: ${missingCount} hisse`);
          
          if (outdatedCount > 0 || missingCount > 0) {
            testResults.warnings++;
            console.log('   ⚠️ Güncelleme gereken hisseler var!');
          }
        } else {
          console.log('ℹ️ Portföyde hisse bulunamadı');
        }
        
        testResults.passed++;
      } else {
        console.log('ℹ️ Sheet boş veya yok, kontrol atlanıyor');
        testResults.passed++;
      }
    } catch (error) {
      console.log(`❌ Son tarih kontrol hatası: ${error.message}`);
      testResults.failed++;
      testResults.errors.push(`Son tarih hatası: ${error.message}`);
    }
    
    // 5. YAHOO FINANCE BAĞLANTI TESTİ (SADECE 1 HİSSE İLE)
    console.log('\n5️⃣ YAHOO FINANCE BAĞLANTI TESTİ');
    testResults.totalTests++;
    
    try {
      console.log('🌐 Yahoo Finance bağlantısı test ediliyor...');
      
      // Test için bir hisse seç (AAPL her zaman güvenilir)
      const testSymbol = 'AAPL';
      const testData = YahooFinanceStockService.fetchDailyHistory(testSymbol, '5d');
      
      if (testData && testData.length > 0) {
        console.log(`✅ Yahoo Finance bağlantısı başarılı`);
        console.log(`   📈 ${testSymbol}: ${testData.length} gün veri alındı`);
        console.log(`   💰 Son fiyat: ${testData[testData.length - 1].close}`);
        console.log(`   📅 Son tarih: ${testData[testData.length - 1].tarih.toISOString().split('T')[0]}`);
        
        testResults.passed++;
      } else {
        console.log(`❌ Yahoo Finance bağlantısı başarısız`);
        testResults.failed++;
        testResults.errors.push('Yahoo Finance bağlantısı başarısız');
      }
    } catch (error) {
      console.log(`❌ Yahoo Finance test hatası: ${error.message}`);
      testResults.failed++;
      testResults.errors.push(`Yahoo Finance hatası: ${error.message}`);
    }
    
    // 6. GÜNCELLEME MANTIĞI TESTİ (SİMÜLASYON)
    console.log('\n6️⃣ GÜNCELLEME MANTIĞI TESTİ (SİMÜLASYON)');
    testResults.totalTests++;
    
    try {
      console.log('🔧 Güncelleme mantığı simüle ediliyor...');
      
      // Sheet'teki bir hisseyi al
      const sheetName = CONFIG?.SHEETS?.HISSE_GECMIS_GUNLUK?.NAME || 'HISSE_GECMIS_GUNLUK';
      const ss = SpreadsheetApp.getActive();
      const sheet = ss.getSheetByName(sheetName);
      
      if (sheet && sheet.getLastRow() > 1) {
        // Sheet'teki ilk hisseyi al
        const firstSymbolCell = sheet.getRange(2, 1);
        const sampleSymbol = firstSymbolCell.getValue();
        
        if (sampleSymbol) {
          console.log(`   Örnek hisse: ${sampleSymbol}`);
          
          // Bu hisse için son tarihi bul
          const lastDate = HisseGecmisKayitService._getLastDateForSymbol(sheet, sampleSymbol);
          
          if (lastDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const lastDateNormalized = new Date(lastDate);
            lastDateNormalized.setHours(0, 0, 0, 0);
            
            const daysDiff = Math.floor((today - lastDateNormalized) / (1000 * 60 * 60 * 24));
            
            console.log(`   Son kayıt tarihi: ${Utilities.formatDate(lastDate, 'GMT', 'dd.MM.yyyy')}`);
            console.log(`   Bugün: ${Utilities.formatDate(today, 'GMT', 'dd.MM.yyyy')}`);
            console.log(`   Gün farkı: ${daysDiff} gün`);
            
            // Güncelleme gerekli mi?
            const needsUpdate = daysDiff > 1;
            console.log(`   Güncelleme gerekli mi? ${needsUpdate ? '✅ EVET' : '❌ HAYIR'}`);
            
            if (needsUpdate) {
              console.log(`   ⚠️ ${sampleSymbol} hissesi ${daysDiff} gündür güncellenmemiş!`);
              testResults.warnings++;
            }
            
            // Kaç günlük veri gerekli?
            const requiredRange = HisseGecmisKayitService._calculateDateRange(lastDate);
            console.log(`   Gerekli veri aralığı: ${requiredRange}`);
            
          } else {
            console.log(`   ℹ️ ${sampleSymbol} için tarih bulunamadı`);
          }
        } else {
          console.log('   ℹ️ Sheet boş, örnek hisse bulunamadı');
        }
      } else {
        console.log('   ℹ️ Sheet boş veya yok');
      }
      
      console.log('✅ Güncelleme mantığı testi tamamlandı');
      testResults.passed++;
    } catch (error) {
      console.log(`❌ Güncelleme mantığı test hatası: ${error.message}`);
      testResults.failed++;
      testResults.errors.push(`Güncelleme mantığı hatası: ${error.message}`);
    }
    
    // 7. SENKRONİZASYON FONKSİYONU KONTROLÜ
    console.log('\n7️⃣ SENKRONİZASYON FONKSİYONU KONTROLÜ');
    testResults.totalTests++;
    
    try {
      console.log('🔍 Senkronizasyon fonksiyonları kontrol ediliyor...');
      
      // Ana senkronizasyon fonksiyonu
      if (typeof HisseGecmisKayitService.syncAllStockHistory === 'function') {
        console.log('✅ syncAllStockHistory() fonksiyonu mevcut');
      } else {
        console.log('❌ syncAllStockHistory() fonksiyonu eksik');
        testResults.warnings++;
      }
      
      // Güncelleme fonksiyonu
      if (typeof HisseGecmisKayitService.updateAllStocks === 'function') {
        console.log('✅ updateAllStocks() fonksiyonu mevcut');
      } else {
        console.log('❌ updateAllStocks() fonksiyonu eksik');
        testResults.warnings++;
      }
      
      // Yardımcı fonksiyonlar
      const helperFunctions = [
        '_extractAllStocks',
        '_getLastDateForSymbol',
        '_calculateDateRange',
        '_writeToSheet'
      ];
      
      helperFunctions.forEach(funcName => {
        if (typeof HisseGecmisKayitService[funcName] === 'function') {
          console.log(`✅ ${funcName}() fonksiyonu mevcut`);
        } else {
          console.log(`❌ ${funcName}() fonksiyonu eksik`);
          testResults.warnings++;
        }
      });
      
      console.log('✅ Tüm fonksiyonlar kontrol edildi');
      testResults.passed++;
    } catch (error) {
      console.log(`❌ Fonksiyon kontrol hatası: ${error.message}`);
      testResults.failed++;
      testResults.errors.push(`Fonksiyon kontrol hatası: ${error.message}`);
    }
    
  } catch (error) {
    console.error(`💥 GENEL TEST HATASI: ${error.message}`);
    testResults.errors.push(`Genel hata: ${error.message}`);
  }
  
  // TEST SONUÇLARI
  const duration = (new Date().getTime() - startTime.getTime()) / 1000;
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 HİSSE GEÇMİŞ SERVİSİ TEST SONUÇLARI');
  console.log('='.repeat(70));
  
  console.log(`Toplam Test: ${testResults.totalTests}`);
  console.log(`Başarılı: ${testResults.passed}`);
  console.log(`Başarısız: ${testResults.failed}`);
  console.log(`Uyarılar: ${testResults.warnings}`);
  console.log(`Başarı Oranı: ${testResults.totalTests > 0 ? ((testResults.passed / testResults.totalTests) * 100).toFixed(1) : 0}%`);
  console.log(`Toplam Süre: ${duration.toFixed(2)} saniye`);
  
  // ÖNERİLER
  console.log('\n💡 ÖNERİLER VE SONRAKİ ADIMLAR:');
  
  if (testResults.warnings > 0) {
    console.log('1. Eksik/bugünün verisi olmayan hisseler için güncelleme yapın:');
    console.log('   📌 Fonksiyon: run_Daily_Update_All()');
  }
  
  if (testResults.failed === 0 && testResults.warnings === 0) {
    console.log('✅ Tüm sistem sorunsuz çalışıyor!');
    console.log('   📌 Günlük güncelleme için: run_Daily_Update_All()');
  } else if (testResults.failed > 0) {
    console.log('\n⚠️ DÜZELTİLMESİ GEREKEN HATALAR:');
    testResults.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }
  
  console.log('\n' + '='.repeat(70));
  return testResults;
}


/**
 * 🔍 SHEET İÇERİĞİNİ ANALİZ ET
 * 
 * Sheet'teki tüm verileri detaylı analiz eder
 * 10:33:40	Hata	💥 Analiz hatası: hasToday is not defined hata veriyor sonra iyileştirme yapılacak
 */
function analyze_Hisse_Sheet_Content() {
  console.log('🔍 HİSSE SHEET İÇERİĞİ ANALİZİ');
  console.log('='.repeat(60));
  
  try {
    const sheetName = CONFIG?.SHEETS?.HISSE_GECMIS_GUNLUK?.NAME || 'HISSE_GECMIS_GUNLUK';
    const ss = SpreadsheetApp.getActive();
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      console.log(`❌ "${sheetName}" sheet'i bulunamadı`);
      return;
    }
    
    const rowCount = sheet.getLastRow();
    const colCount = sheet.getLastColumn();
    
    console.log(`📄 Sheet: ${sheetName}`);
    console.log(`📊 Boyut: ${rowCount} satır, ${colCount} sütun`);
    
    if (rowCount <= 1) {
      console.log('ℹ️ Sheet boş (sadece başlıklar)');
      return;
    }
    
    const dataCount = rowCount - 1;
    console.log(`📦 Veri kaydı: ${dataCount}`);
    
    // Tüm veriyi oku
    const dataRange = sheet.getRange(2, 1, dataCount, colCount);
    const data = dataRange.getValues();
    
    // 1. Hisse dağılımı
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
    
    const uniqueSymbols = Object.keys(symbolCounts);
    console.log(`\n📈 ${uniqueSymbols.length} BENZERSİZ HİSSE:`);
    
    // Hisse başına kayıt sayısına göre sırala
    const sortedSymbols = Object.entries(symbolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20); // İlk 20 hisseyi göster
    
    sortedSymbols.forEach(([symbol, count], index) => {
      const lastDate = symbolDates[symbol];
      const lastDateStr = lastDate ? Utilities.formatDate(lastDate, 'GMT', 'dd.MM.yyyy') : 'Belirsiz';
      console.log(`   ${index + 1}. ${symbol}: ${count} kayıt (Son: ${lastDateStr})`);
    });
    
    if (uniqueSymbols.length > 20) {
      console.log(`   ... ve ${uniqueSymbols.length - 20} tane daha`);
    }
    
    // 2. Tarih analizi
    console.log('\n📅 TARİH ANALİZİ:');
    
    const dates = data
      .map(row => row[1])
      .filter(date => date instanceof Date)
      .map(date => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      });
    
    if (dates.length > 0) {
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      const dayDiff = Math.floor((maxDate - minDate) / (1000 * 60 * 60 * 24));
      
      console.log(`   En erken tarih: ${Utilities.formatDate(minDate, 'GMT', 'dd.MM.yyyy')}`);
      console.log(`   En geç tarih: ${Utilities.formatDate(maxDate, 'GMT', 'dd.MM.yyyy')}`);
      console.log(`   Toplam gün: ${dayDiff}`);
      
      // Bugünün tarihi
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTime = today.getTime();
      
      const hasToday = dates.some(date => date === todayTime);
      console.log(`   Bugünün verisi: ${hasToday ? '✅ VAR' : '❌ YOK'}`);
      
      // Eksik günleri kontrol et
      if (!hasToday) {
        console.log(`   ⚠️ Bugünün verisi eksik! (${Utilities.formatDate(today, 'GMT', 'dd.MM.yyyy')})`);
      }
      
      // Son 7 gün kontrolü
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoTime = sevenDaysAgo.getTime();
      
      const recentDates = dates.filter(date => date >= sevenDaysAgoTime);
      console.log(`   Son 7 günde: ${recentDates.length} kayıt`);
      
      if (recentDates.length < uniqueSymbols.length) {
        const missingCount = uniqueSymbols.length - recentDates.length;
        console.log(`   ⚠️ ${missingCount} hissenin son 7 gün verisi eksik!`);
      }
    }
    
    // 3. Veri kalitesi kontrolü
    console.log('\n🔧 VERİ KALİTESİ KONTROLÜ:');
    
    let missingSymbols = 0;
    let missingDates = 0;
    let zeroPrices = 0;
    
    data.forEach(row => {
      if (!row[0] || row[0].toString().trim() === '') missingSymbols++;
      if (!(row[1] instanceof Date)) missingDates++;
      if (row[5] === 0 || row[5] === '0') zeroPrices++; // Kapanış fiyatı
    });
    
    console.log(`   Eksik sembol: ${missingSymbols} kayıt`);
    console.log(`   Eksik tarih: ${missingDates} kayıt`);
    console.log(`   Sıfır fiyat: ${zeroPrices} kayıt`);
    
    if (missingSymbols === 0 && missingDates === 0) {
      console.log('   ✅ Veri kalitesi: İYİ');
    } else {
      console.log('   ⚠️ Veri kalitesi: DÜZELTME GEREKİYOR');
    }
    
    console.log('\n💡 ÖNERİLER:');
    
    if (!hasToday) {
      console.log('1. Bugünün verisini eklemek için: run_Daily_Update_All()');
    }
    
    if (recentDates.length < uniqueSymbols.length) {
      console.log('2. Eksik güncel verileri tamamlamak için: run_Initial_Sync_All()');
    }
    
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error(`💥 Analiz hatası: ${error.message}`);
  }
}
/**
 * 🚀 GÜNLÜK HİSSE GÜNCELLEMESİ - BASİT VERSİYON
 * 
 * Tüm hisseler için günlük güncellemeyi başlatır.
 * HisseGecmisKayitService.updateAllStocks() fonksiyonunu çağırır.
 */
function run_Daily_Update_All() {
  console.log('🔄 TÜM HİSSE GÜNCELLEMESİ BAŞLATILIYOR');
  console.log('📅 Tarih:', new Date().toISOString());
  console.log('='.repeat(60));
  
  const startTime = new Date();
  
  try {
    // Ana güncelleme fonksiyonunu çağır
    HisseGecmisKayitService.updateAllStocks();
    
    const duration = (new Date().getTime() - startTime.getTime()) / 1000;
    console.log('\n' + '='.repeat(60));
    console.log(`✅ GÜNCELLEME TAMAMLANDI (${duration.toFixed(1)} saniye)`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ GÜNCELLEME HATASI:', error.message);
    console.error(error.stack);
  }
}


