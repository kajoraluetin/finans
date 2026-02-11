/**
 * 📈 GOLD HISTORY - TAM DÜZELTME
 * SORUN ÇÖZÜLDÜ: Fiyatlar 100 katı yazılıyordu
 * SÖZ DİZİMİ HATASI DÜZELTİLDİ: %50'den fazla fark varsa → // %50'den fazla fark varsa
 */

const GoldHistoryService = {
  
  SHEET_NAME: 'ALTIN_GECMIS_GUNLUK',
  
  /**
   * Bugünün altın fiyatlarını HISSE formatında kaydet - DÜZELTİLMİŞ
   */
  saveTodayPricesToHisseSheet: function() {
    console.log('📥 Altın fiyatları HISSE formatında sheet\'e yazılıyor (2. satırdan)...');
    
    try {
      // 1. Güncel fiyatları al
      const allData = GoldService.getAllPrices();
      const goldData = allData.altinlar;
      
      if (!goldData || Object.keys(goldData).length === 0) {
        console.error('❌ Kaydedilecek altın verisi yok');
        return { success: false, message: 'Altın verisi yok' };
      }
      
      console.log(`📊 ${Object.keys(goldData).length} altın türü bulundu`);
      
      // 2. Sheet'i hazırla
      const sheet = this._getHisseFormatSheet();
      
      // 3. Mevcut kayıtları kontrol et
      let existingRecords = new Set();
      if (sheet.getLastRow() > 1) {
        existingRecords = this._getExistingRecords(sheet);
      }
      
      // 4. Bugünün tarihi
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = Utilities.formatDate(today, 'GMT', 'dd.MM.yyyy');
      
      // 5. YAZILACAK satırları hazırla
      const rows = [];
      let newRecords = 0;
      let skippedRecords = 0;
      
      // DEBUG: İlk 3 kaydı detaylı logla
      const debugKeys = Object.keys(goldData).slice(0, 3);
      console.log('🔍 DEBUG - İlk 3 kayıt:');
      
      Object.keys(goldData).forEach((key, index) => {
        const priceInfo = goldData[key];
        
        // İlk 3 kayıt için detaylı debug
        if (index < 3) {
          console.log(`   ${index + 1}. ${key}:`);
          console.log(`      Orijinal Alış: "${priceInfo.buyingRaw}"`);
          console.log(`      Parse Edilmiş: ${priceInfo.buying}`);
          console.log(`      Orijinal Satış: "${priceInfo.sellingRaw}"`);
          console.log(`      Parse Edilmiş: ${priceInfo.selling}`);
          
          // Beklenen değer kontrolü
          const expectedBuying = this._calculateExpectedValue(priceInfo.buyingRaw);
          console.log(`      Beklenen Alış: ${expectedBuying}`);
          
          if (Math.abs(priceInfo.buying - expectedBuying) > 1) {
            console.warn(`      ⚠️ UYUMSUZLUK! Parse: ${priceInfo.buying}, Beklenen: ${expectedBuying}`);
          }
        }
        
        // Duplicate kontrolü
        const recordKey = `${key}_${todayStr}`;
        if (existingRecords.has(recordKey)) {
          if (index < 3) console.log(`      ⏭️ Zaten mevcut, atlanıyor`);
          skippedRecords++;
          return;
        }
        
        // DEĞER KONTROLÜ: Eğer değer 100 katıysa, düzelt
        let buying = priceInfo.buying;
        let selling = priceInfo.selling;
        
        // Kontrol: "7.094,49" → 7094.49 olmalı
        // Eğer 709449 geliyorsa, 100'e böl
        const expected = this._calculateExpectedValue(priceInfo.buyingRaw);
        
        // DÜZELTME: Sözdizimi hatası düzeltildi
        // if (Math.abs(buying - expected) > expected * 0.5) { %50'den fazla fark varsa
        if (Math.abs(buying - expected) > expected * 0.5) { // %50'den fazla fark varsa
          console.warn(`   ⚠️ ${key}: Beklenmeyen değer! Parse: ${buying}, Beklenen: ${expected}`);
          
          // 100 katı kontrolü
          if (Math.abs(buying / 100 - expected) < 1) {
            console.log(`     100 katı tespit edildi, düzeltiliyor: ${buying} → ${buying / 100}`);
            buying = buying / 100;
            selling = selling / 100;
          }
        }
        
        const high = Math.max(buying, selling);
        const low = Math.min(buying, selling);
        
        if (index < 3) {
          console.log(`      📝 Yazılacak: ${buying} / ${selling}`);
        }
        
        rows.push([
          key,                    // Sembol
          today,                  // Tarih
          buying,                 // Açılış
          high,                   // En Yüksek
          low,                    // En Düşük
          selling,                // Kapanış
          0,                      // Hacim
          'TruncgilAPI'           // Kaynak
        ]);
        
        newRecords++;
      });
      
      if (rows.length === 0) {
        console.log(`⏭️ Tüm kayıtlar zaten mevcut (${skippedRecords} atlandı)`);
        return { 
          success: true, 
          message: 'Tüm kayıtlar zaten mevcut', 
          newRecords: 0,
          skipped: skippedRecords 
        };
      }
      
      // 6. HER ZAMAN 2. SATIRDAN BAŞLAYARAK yaz
      let startRow = 2;
      if (sheet.getLastRow() > 1) {
        startRow = sheet.getLastRow() + 1;
      }
      
      console.log(`📝 ${rows.length} kayıt sheet'e yazılıyor (satır ${startRow})...`);
      
      // DEBUG: Yazmadan önce ilk 3 satırı göster
      console.log('📋 Yazılacak ilk 3 satır:');
      for (let i = 0; i < Math.min(3, rows.length); i++) {
        console.log(`   ${rows[i][0]}: ${rows[i][2]} / ${rows[i][5]}`);
      }
      
      const range = sheet.getRange(startRow, 1, rows.length, 8);
      range.setValues(rows);
      
      // 7. Formatları ayarla
      sheet.getRange(startRow, 2, rows.length, 1)
           .setNumberFormat('DD.MM.YYYY');
      
      const priceColumns = sheet.getRange(startRow, 3, rows.length, 4);
      priceColumns.setNumberFormat('#,##0.00');
      priceColumns.setHorizontalAlignment('right');
      
      sheet.getRange(startRow, 7, rows.length, 1)
           .setNumberFormat('#,##0');
      
      console.log(`✅ ${newRecords} yeni altın kaydı eklendi (satır ${startRow}-${startRow + rows.length - 1})`);
      
      // 8. Sheet'ten oku ve kontrol et
      console.log('\n🔍 SHEET KONTROLÜ (İlk 3 kayıt):');
      for (let i = 0; i < Math.min(3, rows.length); i++) {
        const sheetValue = sheet.getRange(startRow + i, 3).getValue();
        console.log(`   ${rows[i][0]}: Sheet'te = ${sheetValue}, Beklenen = ${rows[i][2]}`);
        
        if (Math.abs(sheetValue - rows[i][2]) > 0.01) {
          console.warn(`   ⚠️ UYUMSUZLUK! Fark: ${Math.abs(sheetValue - rows[i][2])}`);
        }
      }
      
      return { 
        success: true, 
        message: 'Altın fiyatları başarıyla kaydedildi',
        newRecords: newRecords,
        skipped: skippedRecords,
        startRow: startRow
      };
      
    } catch (error) {
      console.error('💥 Altın kayıt hatası:', error);
      return { 
        success: false, 
        message: 'Hata: ' + error.message,
        error: error.toString() 
      };
    }
  },
  
  /**
   * Beklenen değeri hesapla
   */
  _calculateExpectedValue: function(priceStr) {
    if (!priceStr) return 0;
    
    try {
      // "7.094,49" → 7094.49
      let cleaned = priceStr.replace(/[$\€£¥]/g, '').trim();
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      return parseFloat(cleaned);
    } catch (e) {
      return 0;
    }
  },
  
  /**
   * HISSE_GECMIS_GUNLUK formatında sheet getir
   */
  _getHisseFormatSheet: function() {
    const ss = SpreadsheetApp.getActive();
    let sheet = ss.getSheetByName(this.SHEET_NAME);
    
    if (!sheet) {
      console.log(`📄 "${this.SHEET_NAME}" sheet'i oluşturuluyor...`);
      sheet = ss.insertSheet(this.SHEET_NAME);
      
      console.log(`ℹ️ Sheet oluşturuldu. Başlıkları ekleyin.`);
    }
    
    return sheet;
  },
  
  /**
   * Sheet'teki mevcut kayıtları getir
   */
  _getExistingRecords: function(sheet) {
    const existingMap = new Set();
    
    if (sheet.getLastRow() <= 1) return existingMap;
    
    try {
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
      
      data.forEach(row => {
        const symbol = row[0];
        const date = row[1];
        
        if (symbol && date instanceof Date) {
          const dateStr = Utilities.formatDate(date, 'GMT', 'dd.MM.yyyy');
          existingMap.add(`${symbol}_${dateStr}`);
        }
      });
      
      console.log(`📊 Sheet'te ${existingMap.size} mevcut kayıt`);
    } catch (error) {
      console.log('ℹ️ Mevcut kayıtlar okunamadı');
    }
    
    return existingMap;
  },
  
  /**
   * Sheet'i tamamen sıfırla
   */
  resetSheet: function() {
    console.log('🔄 Sheet tamamen sıfırlanıyor...');
    
    try {
      const ss = SpreadsheetApp.getActive();
      const sheet = ss.getSheetByName(this.SHEET_NAME);
      
      if (sheet) {
        ss.deleteSheet(sheet);
        console.log(`✅ "${this.SHEET_NAME}" sheet'i silindi`);
      }
      
      return { 
        success: true, 
        message: 'Sheet sıfırlandı'
      };
      
    } catch (error) {
      console.error('💥 Sıfırlama hatası:', error);
      return { success: false, message: 'Hata: ' + error.message };
    }
  },

  /**
   * Sheet yapısını kontrol et
   */
  checkSheetStructure: function() {
    console.log('🔍 Sheet yapısı kontrol ediliyor...');
    
    try {
      const sheet = this._getHisseFormatSheet();
      
      if (sheet.getLastRow() === 0) {
        return {
          isValid: false,
          message: 'Sheet boş, başlıkları ekleyin',
          sheetName: sheet.getName(),
          columnCount: sheet.getLastColumn()
        };
      }
      
      // Başlık satırını oku
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      
      // Beklenen başlıklar (en azından temel başlıklar)
      const expectedHeaders = ['Sembol', 'Tarih', 'Açılış', 'En Yüksek', 'En Düşük', 'Kapanış'];
      let isValid = true;
      let issues = [];
      
      // Her sütunun başlığını kontrol et (en azından ilk 6 sütun)
      for (let i = 0; i < Math.min(expectedHeaders.length, headers.length); i++) {
        const expected = expectedHeaders[i];
        const actual = headers[i] || '';
        
        if (!actual.toString().toLowerCase().includes(expected.toLowerCase())) {
          isValid = false;
          issues.push(`${i+1}. sütun: "${actual}" beklenen "${expected}" olmalı`);
        }
      }
      
      return {
        isValid: isValid,
        message: isValid ? 'Sheet yapısı uygun' : 'Başlık uyuşmazlığı var',
        sheetName: sheet.getName(),
        columnCount: sheet.getLastColumn(),
        headers: headers,
        issues: issues
      };
      
    } catch (error) {
      return {
        isValid: false,
        message: 'Sheet kontrol hatası: ' + error.message,
        sheetName: this.SHEET_NAME,
        error: error.toString()
      };
    }
  }
};

/**
 * ALTIN FİYATLARINI SHEET'E YAZ (Ana fonksiyon)
 * Her zaman 2. satırdan başlar, duplicate kontrolü yapar
 */
function save_Altin_Fiyatlari_To_Sheet() {
  console.log('🚀 Altın fiyatları sheet\'e yazılıyor...');
  
  // 1. Önce sheet yapısını kontrol et
  console.log('\n1️⃣ Sheet Yapısı Kontrolü:');
  const structureCheck = GoldHistoryService.checkSheetStructure();
  
  if (!structureCheck.isValid && structureCheck.message !== 'Sheet boş, başlıkları ekleyin') {
    console.warn(`⚠️ Sheet yapısı uygun değil: ${structureCheck.message}`);
    console.log('   Devam etmek istiyor musunuz? Başlıklar:');
    console.log('   Sembol | Tarih | Açılış | En Yüksek | En Düşük | Kapanış | Hacim | Kaynak');
  }
  
  // 2. API bağlantı testi
  console.log('\n2️⃣ API Bağlantı Testi:');
  const apiTest = GoldService.testConnection();
  
  if (!apiTest.success) {
    console.error(`❌ API hatası: ${apiTest.message}`);
    return { success: false, step: 'api_test', error: apiTest.message };
  }
  
  console.log(`✅ API bağlantısı başarılı (${apiTest.data.diffMinutes} dakika önce güncellenmiş)`);
  
  // 3. Fiyatları sheet'e yaz
  console.log('\n3️⃣ Sheet\'e Yazma İşlemi:');
  const writeResult = GoldHistoryService.saveTodayPricesToHisseSheet();
  
  // 4. Sonuçları göster
  console.log('\n4️⃣ SONUÇ:');
  console.log(JSON.stringify(writeResult, null, 2));
  
  if (writeResult.success) {
    console.log(`🎉 ${writeResult.newRecords} yeni kayıt eklendi!`);
    console.log(`   📍 Satır: ${writeResult.startRow}-${writeResult.endRow}`);
    
    // Ek bilgiler
    const goldData = GoldService.getGoldPrices();
    console.log(`   📊 Toplam ${Object.keys(goldData.prices || {}).length} altın türü işlendi`);
  }
  
  return writeResult;
}

/**
 * Sheet'i hazırla (başlıkları ekle)
 * BU FONKSİYONU SADECE İLK KEZ ÇALIŞTIR
 */
function setup_Altin_Sheet_Headers() {
  console.log('🛠️ Altın Sheet Başlıkları Hazırlanıyor...');
  
  try {
    const ss = SpreadsheetApp.getActive();
    const sheetName = GoldHistoryService.SHEET_NAME;
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      console.log(`✅ Yeni sheet oluşturuldu: "${sheetName}"`);
    }
    
    // HISSE_GECMIS_GUNLUK ile TAMAMEN AYNI başlıklar
    const headers = [
      ['Sembol', 'Tarih', 'Açılış (Open)', 'En Yüksek (High)', 'En Düşük (Low)', 'Kapanış (Close)', 'Hacim (Volume)', 'Kaynak']
    ];
    
    // Başlıkları 1. satıra yaz
    sheet.getRange(1, 1, 1, headers[0].length)
         .setValues(headers)
         .setFontWeight('bold')
         .setBackground('#f3f3f3');
    
    // Kolon genişliklerini ayarla
    sheet.setColumnWidth(1, 120);  // Sembol
    sheet.setColumnWidth(2, 100);  // Tarih
    sheet.setColumnWidth(3, 100);  // Açılış
    sheet.setColumnWidth(4, 100);  // En Yüksek
    sheet.setColumnWidth(5, 100);  // En Düşük
    sheet.setColumnWidth(6, 100);  // Kapanış
    sheet.setColumnWidth(7, 100);  // Hacim
    sheet.setColumnWidth(8, 120);  // Kaynak
    
    console.log('✅ Başlıklar eklendi:');
    headers[0].forEach((h, i) => console.log(`   ${i+1}. ${h}`));
    console.log('\n📌 NOT: Artık "save_Altin_Fiyatlari_To_Sheet()" fonksiyonunu kullanabilirsiniz.');
    
    return {
      success: true,
      message: 'Başlıklar eklendi',
      sheetName: sheet.getName(),
      headers: headers[0]
    };
    
  } catch (error) {
    console.error('💥 Başlık ekleme hatası:', error);
    return { success: false, message: 'Hata: ' + error.message };
  }
}

/**
 * TEST: Tüm süreci test et
 */
function test_Full_Altin_Sheet_Process() {
  console.log('🧪 TAM ALTIN SHEET SÜREÇ TESTİ');
  console.log('='.repeat(50));
  
  // 1. Sheet'i kontrol et veya oluştur
  console.log('\n1️⃣ SHEET HAZIRLIK:');
  const sheetCheck = GoldHistoryService.checkSheetStructure();
  
  if (!sheetCheck.isValid) {
    console.log(`ℹ️ ${sheetCheck.message}`);
    console.log('   Başlıkları otomatik eklemek ister misiniz?');
    console.log('   "setup_Altin_Sheet_Headers()" fonksiyonunu çalıştırın.');
  } else {
    console.log(`✅ Sheet hazır: ${sheetCheck.columnCount} sütunlu`);
  }
  
  // 2. API testi
  console.log('\n2️⃣ API TESTİ:');
  const apiTest = GoldService.testConnection();
  console.log(apiTest.success ? `✅ ${apiTest.message}` : `❌ ${apiTest.message}`);
  
  if (apiTest.success && apiTest.data.sampleAltin) {
    console.log(`   Örnek: ${apiTest.data.sampleAltin.Alış} / ${apiTest.data.sampleAltin.Satış}`);
  }
  
  // 3. Fiyatları yaz
  console.log('\n3️⃣ SHEET\'E YAZMA TESTİ:');
  const writeResult = GoldHistoryService.saveTodayPricesToHisseSheet();
  
  console.log('\n4️⃣ SONUÇ:');
  if (writeResult.success) {
    console.log(`✅ BAŞARILI! ${writeResult.newRecords} kayıt eklendi`);
    if (writeResult.skippedRecords > 0) {
      console.log(`   (${writeResult.skippedRecords} kayıt zaten mevcuttu)`);
    }
  } else {
    console.error(`❌ HATA: ${writeResult.message}`);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🎉 TEST TAMAMLANDI');
  
  return {
    sheetReady: sheetCheck.isValid,
    apiReady: apiTest.success,
    writeSuccess: writeResult.success,
    newRecords: writeResult.newRecords || 0
  };
}

/**
 * Parse hatasını debug et
 */
function debug_Altin_Parse_Issue() {
  console.log('🔧 ALTIN PARSE HATA AYIKLAMA');
  console.log('='.repeat(60));
  
  // 1. API testi
  console.log('\n1️⃣ API TESTİ:');
  const apiTest = GoldService.testConnection();
  console.log(apiTest.success ? '✅ ' + apiTest.message : '❌ ' + apiTest.message);
  
  // 2. Örnek parse testleri
  console.log('\n2️⃣ PARSE TESTLERİ:');
  
  const testCases = [
    { input: '7.094,49', expected: 7094.49, desc: 'Gram Altın' },
    { input: '5.062,12', expected: 5062.12, desc: 'Ons Altın ($ olmadan)' },
    { input: '$5.062,12', expected: 5062.12, desc: 'Ons Altın ($ ile)' },
    { input: '43,5888', expected: 43.5888, desc: 'Dolar' },
    { input: '1.166.504,00', expected: 1166504, desc: 'Çeyrek Altın' },
    { input: '11.646,00', expected: 11646, desc: 'Gümüş' }
  ];
  
  testCases.forEach(test => {
    const result = GoldService._parsePriceString(test.input);
    const isCorrect = Math.abs(result - test.expected) < 0.01;
    
    console.log(`   ${isCorrect ? '✅' : '❌'} ${test.desc}:`);
    console.log(`      Giriş: "${test.input}"`);
    console.log(`      Çıktı: ${result}`);
    console.log(`      Beklenen: ${test.expected}`);
    console.log(`      Fark: ${Math.abs(result - test.expected)}`);
    
    if (!isCorrect) {
      console.warn(`      ⚠️ HATA! 100 katı mı? ${result / 100}`);
    }
  });
  
  // 3. Gerçek API verilerini test et
  console.log('\n3️⃣ GERÇEK API VERİLERİ:');
  
  try {
    const allData = GoldService.getAllPrices();
    const goldData = allData.altinlar;
    
    console.log(`   Toplam ${Object.keys(goldData).length} altın türü`);
    
    // İlk 5 altın türünü kontrol et
    Object.keys(goldData).slice(0, 5).forEach(key => {
      const item = goldData[key];
      const expectedBuying = GoldHistoryService._calculateExpectedValue(item.buyingRaw);
      const diff = Math.abs(item.buying - expectedBuying);
      
      console.log(`   ${key}:`);
      console.log(`      Orijinal: "${item.buyingRaw}"`);
      console.log(`      Parse: ${item.buying}`);
      console.log(`      Beklenen: ${expectedBuying}`);
      console.log(`      Fark: ${diff} ${diff > 1 ? '⚠️' : '✅'}`);
      
      if (diff > 1) {
        const ratio = item.buying / expectedBuying;
        console.log(`      Oran: ${ratio}x (${ratio === 100 ? '100 KATI!' : 'farklı'})`);
      }
    });
    
  } catch (error) {
    console.error('   ❌ API verileri alınamadı:', error.message);
  }
  
  // 4. Sheet kontrolü
  console.log('\n4️⃣ SHEET KONTROLÜ:');
  
  try {
    const ss = SpreadsheetApp.getActive();
    const sheet = ss.getSheetByName('ALTIN_GECMIS_GUNLUK');
    
    if (sheet) {
      console.log(`   Sheet: "${sheet.getName()}"`);
      console.log(`   Satır sayısı: ${sheet.getLastRow()}`);
      
      if (sheet.getLastRow() > 1) {
        // Son 3 kaydı göster
        const startRow = Math.max(2, sheet.getLastRow() - 2);
        const range = sheet.getRange(startRow, 1, Math.min(3, sheet.getLastRow() - 1), 8);
        const values = range.getValues();
        
        console.log('   Son 3 kayıt:');
        values.forEach((row, idx) => {
          console.log(`      ${startRow + idx}. ${row[0]}: ${row[2]} (Açılış)`);
        });
      }
    } else {
      console.log('   ❌ Sheet bulunamadı');
    }
  } catch (error) {
    console.log('   ❌ Sheet okunamadı:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎯 SONUÇ: Debug tamamlandı. Yukarıdaki logları kontrol edin.');
  
  return { success: true };
}
