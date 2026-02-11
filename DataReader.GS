/**
 * ======================================================
 * DATA READER - GÜNCELLENMİŞ VERSİYON (TÜM SÜTUNLAR + GEÇMİŞ FİYATLAR)
 * ------------------------------------------------------
 * SORUMLULUKLAR:
 * 1. Google Sheet'ten HAM VERİYİ okur (CONFIG.SHEETS.PORTFOY)
 * 2. TÜM SÜTUNLARI okur (A:AQ gibi) - 44 sütun
 * 3. Veriyi temel JavaScript objelerine çevirir
 * 4. HİÇBİR finansal hesaplama yapmaz
 * 5. Cache mekanizması içerir (performans için)
 * 6. Geçmiş fiyat verilerini okur
 * ======================================================
 */
const DataReader = {

  /**
   * Cache için özellikler - GENİŞLETİLMİŞ
   */
  _cache: {
    portfolio: null,
    historicalSTOCK: null,
    historicalCURRENCY: null,
    historicalGOLD: null,
    lastFetchPortfolio: null,
    lastFetchSTOCK: null,
    lastFetchCURRENCY: null,
    lastFetchGOLD: null,
    CACHE_DURATION: 5 * 60 * 1000, // 5 dakika (milisaniye)
  },

  // ==================== MEVCUT PORFÖY OKUMA KODLARI ====================
  
  /**
   * Ana fonksiyon: Portföy verilerini okur (cache'li)
   * @returns {Array<Object>} Tüm portföy verileri (tüm sütunlar)
   */
  readPortfolio(forceRefresh = false) {
    console.log('📖 DataReader: Portföy verileri okunuyor...');
    
    // Cache kontrolü
    if (!forceRefresh && this._cache.portfolio && this._cache.lastFetchPortfolio) {
      const age = new Date().getTime() - this._cache.lastFetchPortfolio.getTime();
      if (age < this._cache.CACHE_DURATION) {
        console.log('💾 Cache\'den veri döndürülüyor');
        return this._cache.portfolio;
      }
    }
    
    try {
      // 1. Sheet'i aç
      const sheet = this._getPortfolioSheet();
      if (!sheet) {
        console.error('❌ Portföy sheet\'i bulunamadı');
        return [];
      }

      // 2. Tüm veriyi oku (tüm sütunlar)
      const allData = this._readAllData(sheet);
      
      if (allData.length === 0) {
        console.warn('⚠️ Portföy sheet\'inde veri yok');
        return [];
      }

      // 3. Veriyi CONFIG.COLUMNS yapısına göre objelere dönüştür
      const portfolio = this._convertToObjects(allData);
      
      // 4. Cache'e kaydet
      this._cache.portfolio = portfolio;
      this._cache.lastFetchPortfolio = new Date();
      
      console.log(`✅ ${portfolio.length} portföy kaydı okundu ve cache'lendi`);
      return portfolio;
      
    } catch (error) {
      console.error('❌ Portföy okuma hatası:', error);
      return [];
    }
  },

  /**
   * Cache'i temizle
   */
  clearCache() {
    this._cache = {
      portfolio: null,
      historicalSTOCK: null,
      historicalCURRENCY: null,
      historicalGOLD: null,
      lastFetchPortfolio: null,
      lastFetchSTOCK: null,
      lastFetchCURRENCY: null,
      lastFetchGOLD: null,
      CACHE_DURATION: 5 * 60 * 1000,
    };
    console.log('🗑️ DataReader cache temizlendi');
  },

  // ==================== GEÇMİŞ FİYAT VERİLERİ OKUMA ====================

  /**
   * Hisse geçmiş fiyatlarını oku
   */
  readHistoricalStockPrices(forceRefresh = false) {
    return this._readHistoricalData('HISSE_GECMIS_GUNLUK', 'STOCK', forceRefresh);
  },

  /**
   * Döviz geçmiş fiyatlarını oku
   */
  readHistoricalCurrencyPrices(forceRefresh = false) {
    return this._readHistoricalData('DOVIZ_GECMIS_GUNLUK', 'CURRENCY', forceRefresh);
  },

  /**
   * Altın geçmiş fiyatlarını oku
   */
  readHistoricalGoldPrices(forceRefresh = false) {
    return this._readHistoricalData('ALTIN_GECMIS_GUNLUK', 'GOLD', forceRefresh);
  },

  /**
   * Genel geçmiş veri okuma fonksiyonu
   */
  _readHistoricalData(sheetType, dataType, forceRefresh = false) {
    console.log(`📊 DataReader: ${sheetType} geçmiş verileri okunuyor...`);
    
    // Cache kontrolü
    const cacheKey = `historical${dataType}`;
    if (!forceRefresh && this._cache[cacheKey] && this._cache[`lastFetch${dataType}`]) {
      const age = new Date().getTime() - this._cache[`lastFetch${dataType}`].getTime();
      if (age < this._cache.CACHE_DURATION) {
        console.log(`💾 ${sheetType} cache'den döndürülüyor`);
        return this._cache[cacheKey];
      }
    }
    
    try {
      const sheet = this._getHistoricalSheet(sheetType);
      if (!sheet) {
        console.error(`❌ ${sheetType} sheet'i bulunamadı`);
        return [];
      }

      // Veriyi oku
      const data = this._readHistoricalSheetData(sheet, sheetType);
      
      if (data.length === 0) {
        console.warn(`⚠️ ${sheetType} sheet'inde veri yok`);
        return [];
      }

      // Veriyi objelere dönüştür
      const historicalData = this._convertHistoricalData(data, dataType);
      
      // Cache'e kaydet
      this._cache[cacheKey] = historicalData;
      this._cache[`lastFetch${dataType}`] = new Date();
      
      console.log(`✅ ${historicalData.length} ${sheetType} kaydı okundu ve cache'lendi`);
      return historicalData;
      
    } catch (error) {
      console.error(`❌ ${sheetType} okuma hatası:`, error);
      return [];
    }
  },

  /**
   * Geçmiş veri sheet'ini getir
   */
  _getHistoricalSheet(sheetType) {
    try {
      const sheetConfig = CONFIG.SHEETS[sheetType];
      if (!sheetConfig) {
        console.error(`❌ ${sheetType} konfigürasyonu bulunamadı`);
        return null;
      }
      
      // Portföyle aynı spreadsheet'i kullan
      const ss = SpreadsheetApp.openById(CONFIG.SHEETS.PORTFOY.ID);
      const sheet = ss.getSheetByName(sheetConfig.NAME);
      
      if (!sheet) {
        console.error(`❌ Sheet "${sheetConfig.NAME}" bulunamadı`);
        return null;
      }
      
      return sheet;
    } catch (error) {
      console.error(`❌ Sheet açma hatası (${sheetType}):`, error);
      return null;
    }
  },

  /**
   * Sheet'ten veriyi oku
   */
  _readHistoricalSheetData(sheet, sheetType) {
    try {
      const config = CONFIG.SHEETS[sheetType];
      
      // Son satır ve sütun sayısını al
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      
      console.log(`   📊 Sheet boyutu: ${lastRow} satır, ${lastCol} sütun`);
      
      if (lastRow < config.FIRST_DATA_ROW) {
        return [];
      }
      
      // Okunacak satır sayısı
      const startRow = config.FIRST_DATA_ROW;
      const numRows = lastRow - startRow + 1;
      
      console.log(`   📖 Okuma aralığı: ${startRow}.satırdan ${numRows} satır, ${lastCol} sütun`);
      
      const range = sheet.getRange(startRow, 1, numRows, lastCol);
      const data = range.getValues();
      
      console.log(`   📦 ${data.length} satır veri okundu`);
      return data;
      
    } catch (error) {
      console.error('❌ Geçmiş veri okuma hatası:', error);
      return [];
    }
  },

  /**
   * Geçmiş veriyi objelere dönüştür
   */
  _convertHistoricalData(data, dataType) {
    console.log(`   🔄 ${dataType} verisi object'lere dönüştürülüyor...`);
    
    // Sheet tipini belirle
    let sheetType, columnConfig;
    switch (dataType) {
      case 'STOCK':
        sheetType = 'HISSE_GECMIS_GUNLUK';
        columnConfig = CONFIG.SHEETS[sheetType].COLUMNS;
        break;
      case 'CURRENCY':
        sheetType = 'DOVIZ_GECMIS_GUNLUK';
        columnConfig = CONFIG.SHEETS[sheetType].COLUMNS;
        break;
      case 'GOLD':
        sheetType = 'ALTIN_GECMIS_GUNLUK';
        columnConfig = CONFIG.SHEETS[sheetType].COLUMNS;
        break;
      default:
        console.error(`❌ Bilinmeyen dataType: ${dataType}`);
        return [];
    }
    
    return data.map((row, rowIndex) => {
      try {
        // İlk sütun (sembol/tür) boşsa atla
        const firstCol = columnConfig.SYMBOL !== undefined ? columnConfig.SYMBOL : columnConfig.TYPE;
        if (firstCol >= row.length || !row[firstCol]) {
          return null;
        }
        
        // Temel obje oluştur
        const obj = {
          // Sembol veya Tür
          symbol: dataType === 'GOLD' ? this._getValue(row, columnConfig.TYPE) : this._getValue(row, columnConfig.SYMBOL),
          
          // Tarih
          date: this._parseDate(this._getValue(row, columnConfig.DATE)),
          
          // Fiyat bilgileri
          open: this._getNumericValue(row, columnConfig.OPEN),
          high: this._getNumericValue(row, columnConfig.HIGH),
          low: this._getNumericValue(row, columnConfig.LOW),
          close: this._getNumericValue(row, columnConfig.CLOSE), // Güncel fiyat
          
          // Asset tipi
          type: dataType,
          
          // Meta bilgiler
          __rawRow: row,
          __rowNumber: CONFIG.SHEETS[sheetType].FIRST_DATA_ROW + rowIndex
        };
        
        // Hacim (sadece hisse ve altın için)
        if (dataType !== 'CURRENCY') {
          obj.volume = this._getNumericValue(row, columnConfig.VOLUME);
        }
        
        // Kaynak bilgisi
        if (dataType === 'CURRENCY') {
          // Döviz için: kaynak ve zaman damgası
          const sourceField = this._getValue(row, columnConfig.SOURCE);
          obj.source = sourceField;
          
          // Zaman damgası varsa ekle
          if (columnConfig.TIMESTAMP !== undefined) {
            obj.timestamp = this._parseDate(this._getValue(row, columnConfig.TIMESTAMP));
          }
        } else {
          // Hisse ve altın için kaynak
          obj.source = this._getValue(row, columnConfig.SOURCE);
        }
        
        return obj;
        
      } catch (error) {
        console.error(`❌ ${dataType} satır ${rowIndex + 1} dönüştürülürken hata:`, error);
        return null;
      }
    }).filter(item => item !== null);
  },

  // ==================== FİYAT SORGULAMA FONKSİYONLARI ====================

  /**
   * Bir varlığın güncel fiyatını getir
   */
  getCurrentPrice(symbol, assetType) {
    let historicalData;
    
    switch (assetType) {
      case 'STOCK':
        historicalData = this.readHistoricalStockPrices();
        break;
      case 'CURRENCY':
        historicalData = this.readHistoricalCurrencyPrices();
        break;
      case 'GOLD':
        historicalData = this.readHistoricalGoldPrices();
        break;
      default:
        console.error(`❌ Geçersiz asset type: ${assetType}`);
        return null;
    }
    
    if (historicalData.length === 0) {
      console.warn(`⚠️ ${assetType} verisi boş`);
      return null;
    }
    
    // Sembole göre filtrele (büyük/küçük harf duyarsız)
    const assetRecords = historicalData.filter(item => {
      if (!item || !item.symbol) return false;
      
      const itemSymbol = item.symbol.toString().trim().toLowerCase();
      const searchSymbol = symbol.toString().trim().toLowerCase();
      
      return itemSymbol === searchSymbol;
    });
    
    if (assetRecords.length === 0) {
      // Alternatif sembol arama
      console.log(`🔍 "${symbol}" için alternatif arama yapılıyor...`);
      
      // Dolar için alternatifler
      if (symbol === 'USD' || symbol === 'USD/TRY') {
        const usdRecords = historicalData.filter(item => 
          item.symbol && item.symbol.toString().toLowerCase().includes('usd')
        );
        if (usdRecords.length > 0) {
          return this._getLatestRecord(usdRecords);
        }
      }
      
      // Euro için alternatifler
      if (symbol === 'EUR' || symbol === 'EUR/TRY') {
        const eurRecords = historicalData.filter(item => 
          item.symbol && item.symbol.toString().toLowerCase().includes('eur')
        );
        if (eurRecords.length > 0) {
          return this._getLatestRecord(eurRecords);
        }
      }
      
      console.warn(`⚠️ "${symbol}" ${assetType} verisinde bulunamadı`);
      return null;
    }
    
    return this._getLatestRecord(assetRecords);
  },

  /**
   * Kayıtlardan en güncel olanı getir
   */
  _getLatestRecord(records) {
    if (!records || records.length === 0) {
      return null;
    }
    
    // Tarihe göre sırala (en yeni en başta)
    const sorted = [...records].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
    
    const latest = sorted[0];
    
    return {
      price: latest.close,
      date: latest.date,
      source: latest.source || 'Unknown',
      symbol: latest.symbol,
      type: latest.type
    };
  },

  /**
   * Dolar fiyatını getir
   */
  getDolarPrice() {
    return this.getCurrentPrice('USDTRY=X', 'CURRENCY') || 
           this.getCurrentPrice('USD', 'CURRENCY');
  },

  /**
   * Euro fiyatını getir
   */
  getEuroPrice() {
    return this.getCurrentPrice('EURTRY=X', 'CURRENCY') || 
           this.getCurrentPrice('EUR', 'CURRENCY');
  },

  /**
   * Gram altın fiyatını getir
   */
  getGramAltinPrice() {
    return this.getCurrentPrice('gram-altin', 'GOLD');
  },

  /**
   * Ons altın fiyatını getir
   */
  getOnsAltinPrice() {
    return this.getCurrentPrice('ons', 'GOLD');
  },

  /**
   * Portföydeki bir varlığın fiyatını getir
   */
  getPortfolioItemPrice(item) {
    if (!item) return null;
    
    const { kategori, birimi, baslik } = item;
    
    // Kategoriye göre asset type belirle
    if (kategori && kategori.includes('Borsa')) {
      return this.getCurrentPrice(baslik, 'STOCK');
    }
    else if (kategori === 'Döviz' || birimi === 'USD' || birimi === 'EUR') {
      const symbol = birimi === 'USD' ? 'USDTRY=X' : 
                     birimi === 'EUR' ? 'EURTRY=X' : birimi;
      return this.getCurrentPrice(symbol, 'CURRENCY');
    }
    else if (kategori && (kategori.includes('Altın') || kategori.includes('Gümüş'))) {
      // Başlıktan altın türünü tahmin et
      const baslikLower = baslik.toLowerCase();
      let goldType;
      
      if (baslikLower.includes('gram')) goldType = 'gram-altin';
      else if (baslikLower.includes('ons')) goldType = 'ons';
      else if (baslikLower.includes('çeyrek') || baslikLower.includes('ceyrek')) goldType = 'ceyrek-altin';
      else if (baslikLower.includes('yarım') || baslikLower.includes('yarim')) goldType = 'yarim-altin';
      else if (baslikLower.includes('tam')) goldType = 'tam-altin';
      else goldType = baslikLower;
      
      return this.getCurrentPrice(goldType, 'GOLD');
    }
    
    console.warn(`⚠️ Bilinmeyen kategori: ${kategori}`);
    return null;
  },

  /**
   * Tüm önemli fiyatları getir
   */
  getAllImportantPrices() {
    return {
      dolar: this.getDolarPrice(),
      euro: this.getEuroPrice(),
      gramAltin: this.getGramAltinPrice(),
      onsAltin: this.getOnsAltinPrice(),
      timestamp: new Date()
    };
  },

  // ==================== DEBUG FONKSİYONLARI ====================

  /**
   * Geçmiş veri yapısını debug et
   */
  debugHistoricalData() {
    console.log('🔍 DATA READER GEÇMİŞ VERİ DEBUG');
    console.log('='.repeat(80));
    
    try {
      // Hisse verisi
      console.log('\n📈 HİSSE VERİSİ:');
      const stocks = this.readHistoricalStockPrices();
      console.log(`   Toplam kayıt: ${stocks.length}`);
      
      if (stocks.length > 0) {
        const uniqueSymbols = [...new Set(stocks.map(item => item.symbol))];
        console.log(`   Benzersiz hisse sayısı: ${uniqueSymbols.length}`);
        
        // İlk 3 hisse için güncel fiyat
        uniqueSymbols.slice(0, 3).forEach(symbol => {
          const price = this.getCurrentPrice(symbol, 'STOCK');
          if (price) {
            const dateStr = price.date ? 
              Utilities.formatDate(price.date, 'GMT', 'dd.MM.yyyy') : 'Tarih yok';
            console.log(`   ${symbol}: ${price.price} (${dateStr})`);
          }
        });
      }
      
      // Döviz verisi
      console.log('\n💱 DÖVİZ VERİSİ:');
      const currencies = this.readHistoricalCurrencyPrices();
      console.log(`   Toplam kayıt: ${currencies.length}`);
      
      // Önemli dövizler
      const importantCurrencies = ['USDTRY=X', 'EURTRY=X'];
      importantCurrencies.forEach(symbol => {
        const price = this.getCurrentPrice(symbol, 'CURRENCY');
        if (price) {
          const dateStr = price.date ? 
            Utilities.formatDate(price.date, 'GMT', 'dd.MM.yyyy') : 'Tarih yok';
          console.log(`   ${symbol}: ${price.price} (${dateStr})`);
        }
      });
      
      // Altın verisi
      console.log('\n🏅 ALTIN VERİSİ:');
      const golds = this.readHistoricalGoldPrices();
      console.log(`   Toplam kayıt: ${golds.length}`);
      
      // Önemli altın türleri
      const importantGolds = ['gram-altin', 'ons'];
      importantGolds.forEach(symbol => {
        const price = this.getCurrentPrice(symbol, 'GOLD');
        if (price) {
          const dateStr = price.date ? 
            Utilities.formatDate(price.date, 'GMT', 'dd.MM.yyyy') : 'Tarih yok';
          console.log(`   ${symbol}: ${price.price} (${dateStr})`);
        }
      });
      
    } catch (error) {
      console.error('❌ Geçmiş veri debug hatası:', error);
    }
    
    console.log('\n' + '='.repeat(80));
  },

  /**
   * Tüm verileri debug et
   */
  debugAllData() {
    console.log('🔍 DATA READER TÜM VERİ DEBUG');
    console.log('='.repeat(80));
    
    // Portföy
    console.log('\n📖 PORFÖY VERİSİ:');
    const portfolio = this.readPortfolio();
    console.log(`   Toplam: ${portfolio.length} kayıt`);
    
    if (portfolio.length > 0) {
      console.log('   İlk 3 kayıt:');
      portfolio.slice(0, 3).forEach(item => {
        console.log(`   - ${item.baslik} (${item.kategori}): ${item.adet} adet`);
      });
    }
    
    // Hisse
    console.log('\n📈 HİSSE GEÇMİŞ VERİSİ:');
    const stocks = this.readHistoricalStockPrices();
    console.log(`   Toplam: ${stocks.length} kayıt`);
    
    if (stocks.length > 0) {
      const uniqueStocks = [...new Set(stocks.map(s => s.symbol))];
      console.log(`   Benzersiz hisse: ${uniqueStocks.length}`);
    }
    
    // Döviz
    console.log('\n💱 DÖVİZ GEÇMİŞ VERİSİ:');
    const currencies = this.readHistoricalCurrencyPrices();
    console.log(`   Toplam: ${currencies.length} kayıt`);
    
    if (currencies.length > 0) {
      const uniqueCurrencies = [...new Set(currencies.map(c => c.symbol))];
      console.log(`   Benzersiz döviz: ${uniqueCurrencies.length}`);
    }
    
    // Altın
    console.log('\n🏅 ALTIN GEÇMİŞ VERİSİ:');
    const golds = this.readHistoricalGoldPrices();
    console.log(`   Toplam: ${golds.length} kayıt`);
    
    if (golds.length > 0) {
      const uniqueGolds = [...new Set(golds.map(g => g.symbol))];
      console.log(`   Benzersiz altın türü: ${uniqueGolds.length}`);
    }
    
    console.log('\n' + '='.repeat(80));
  },

  // ==================== MEVCUT YARDIMCI FONKSİYONLAR ====================

  /**
   * Portföy sheet'ini bul ve döndür
   */
  _getPortfolioSheet() {
    try {
      const sheetConfig = CONFIG.SHEETS.PORTFOY;
      
      // Spesifik sheet ID varsa onu kullan, yoksa aktif spreadsheet'i
      let ss;
      if (sheetConfig.ID) {
        ss = SpreadsheetApp.openById(sheetConfig.ID);
      } else {
        ss = SpreadsheetApp.getActiveSpreadsheet();
      }
      
      const sheet = ss.getSheetByName(sheetConfig.NAME);
      
      if (!sheet) {
        console.error(`❌ Sheet "${sheetConfig.NAME}" bulunamadı`);
        console.log(`ℹ️ Mevcut sheet'ler:`, ss.getSheets().map(s => s.getName()));
      }
      
      return sheet;
    } catch (error) {
      console.error('❌ Sheet açma hatası:', error);
      return null;
    }
  },

  /**
   * Sheet'ten tüm veriyi oku (tüm sütunlar)
   */
  _readAllData(sheet) {
    try {
      const config = CONFIG.SHEETS.PORTFOY;
      
      // Son satır ve sütun sayısını al
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      
      console.log(`📊 Sheet boyutu: ${lastRow} satır, ${lastCol} sütun`);
      
      if (lastRow <= 1) {
        return [];
      }
      
      // CONFIG'teki tüm sütunları kapsayacak şekilde oku
      // CONFIG.COLUMNS'taki maksimum sütun indeksini bul
      const maxConfigCol = Math.max(...Object.values(CONFIG.COLUMNS));
      
      // Okunacak sütun sayısı: sheet'teki sütun sayısı ve CONFIG gereksinimi arasında maksimum
      const numCols = Math.max(lastCol, maxConfigCol + 1);
      
      // CONFIG'te belirtilen ilk veri satırından başlayarak oku
      const startRow = config.FIRST_DATA_ROW;
      const numRows = lastRow - startRow + 1;
      
      console.log(`📖 Okuma aralığı: ${startRow}.satırdan ${numRows} satır, ${numCols} sütun`);
      console.log(`⚙️ CONFIG gereksinimi: ${maxConfigCol + 1} sütun`);
      
      const range = sheet.getRange(startRow, 1, numRows, numCols);
      const data = range.getValues();
      
      console.log(`📦 ${data.length} satır veri okundu (her satır ${data[0]?.length || 0} sütun)`);
      return data;
      
    } catch (error) {
      console.error('❌ Veri okuma hatası:', error);
      return [];
    }
  },

  /**
   * Ham veriyi CONFIG.COLUMNS yapısına göre objelere dönüştür (TÜM SÜTUNLAR)
   */
  _convertToObjects(data) {
    console.log('🔄 Ham veri object\'lere dönüştürülüyor...');
    
    return data.map((row, rowIndex) => {
      try {
        // Tüm CONFIG.COLUMNS alanlarını oku
        const obj = {
          // Ham veriyi koru (debug için)
          __rawRow: row,
          __rowNumber: CONFIG.SHEETS.PORTFOY.FIRST_DATA_ROW + rowIndex,
          
          // ==================== TEMEL BİLGİLER ====================
          id: this._getValue(row, CONFIG.COLUMNS.ID),
          tarih: this._parseDate(this._getValue(row, CONFIG.COLUMNS.TARIH)),
          islemTuru: this._getValue(row, CONFIG.COLUMNS.ISLEM_TURU),
          birimi: this._getValue(row, CONFIG.COLUMNS.BIRIMI),
          birimFiyat: this._getNumericValue(row, CONFIG.COLUMNS.BIRIM_FIYAT),
          baslik: this._getValue(row, CONFIG.COLUMNS.BASLIK),
          adet: this._getNumericValue(row, CONFIG.COLUMNS.ADET),
          kategori: this._getValue(row, CONFIG.COLUMNS.KATEGORI),
          platform: this._getValue(row, CONFIG.COLUMNS.PLATFORM),
          detaylar: this._getValue(row, CONFIG.COLUMNS.DETAYLAR),

          // ==================== YATIRILAN DEĞERLER ====================
          yatirilanTutar: this._getNumericValue(row, CONFIG.COLUMNS.YATIRILAN_TUTAR),
          yatirilanTL: this._getNumericValue(row, CONFIG.COLUMNS.YATIRILAN_TL),
          yatirilanUSD: this._getNumericValue(row, CONFIG.COLUMNS.YATIRILAN_USD),
          yatirilanEUR: this._getNumericValue(row, CONFIG.COLUMNS.YATIRILAN_EUR),
          yatirilanAltin: this._getNumericValue(row, CONFIG.COLUMNS.YATIRILAN_ALTIN),

          // ==================== GÜNCEL DEĞERLER ====================
          guncelTutar: this._getNumericValue(row, CONFIG.COLUMNS.GUNCEL_TUTAR),
          guncelTL: this._getNumericValue(row, CONFIG.COLUMNS.GUNCEL_TL),
          guncelUSD: this._getNumericValue(row, CONFIG.COLUMNS.GUNCEL_USD),
          guncelEUR: this._getNumericValue(row, CONFIG.COLUMNS.GUNCEL_EUR),
          guncelAltin: this._getNumericValue(row, CONFIG.COLUMNS.GUNCEL_ALTIN),

          // ==================== KAR / ZARAR ====================
          karZararTutar: this._getNumericValue(row, CONFIG.COLUMNS.KAR_ZARAR_TUTAR),
          karZararTL: this._getNumericValue(row, CONFIG.COLUMNS.KAR_ZARAR_TL),
          karZararUSD: this._getNumericValue(row, CONFIG.COLUMNS.KAR_ZARAR_USD),
          karZararEUR: this._getNumericValue(row, CONFIG.COLUMNS.KAR_ZARAR_EUR),
          karZararYuzde: this._getNumericValue(row, CONFIG.COLUMNS.KAR_ZARAR_YUZDE),
          karZararAltin: this._getNumericValue(row, CONFIG.COLUMNS.KAR_ZARAR_ALTIN),

          // ==================== DURUM / GÜNCELLEME ====================
          fiyatGuncelleme: this._parseDate(this._getValue(row, CONFIG.COLUMNS.FIYAT_GUNCELLEME)),
          durum: this._getValue(row, CONFIG.COLUMNS.DURUM),
          gunlukDegisim: this._getNumericValue(row, CONFIG.COLUMNS.GUNLUK_DEGISIM),
          gunlukDegisimTL: this._getNumericValue(row, CONFIG.COLUMNS.GUNLUK_DEGISIM_TL),

          // ==================== PORTFÖY AĞIRLIK ====================
          portfoyAgirlik: this._getNumericValue(row, CONFIG.COLUMNS.PORTFOY_AGIRLIK),
          kategoriAgirlik: this._getNumericValue(row, CONFIG.COLUMNS.KATEGORI_AGIRLIK),

          // ==================== MALİYET / GETİRİ ====================
          ortalamaMaliyet: this._getNumericValue(row, CONFIG.COLUMNS.ORTALAMA_MALIYET),
          tutulmaSuresi: this._getNumericValue(row, CONFIG.COLUMNS.TUTULMA_SURESI),
          getiriYillik: this._getNumericValue(row, CONFIG.COLUMNS.GETIRI_YILLIK),

          // ==================== TEKNİK ANALİZ ====================
          rsi14: this._getNumericValue(row, CONFIG.COLUMNS.RSI_14),
          movingAverage50: this._getNumericValue(row, CONFIG.COLUMNS.MOVING_AVERAGE_50),

          // ==================== ALARM ====================
          alarmSeviyesi: this._getValue(row, CONFIG.COLUMNS.ALARM_SEVIYESI),
          hedefFiyat: this._getNumericValue(row, CONFIG.COLUMNS.HEDEF_FIYAT),
          stopLoss: this._getNumericValue(row, CONFIG.COLUMNS.STOP_LOSS),

          // ==================== METADATA ====================
          notlar: this._getValue(row, CONFIG.COLUMNS.NOTLAR),
          etiketler: this._getValue(row, CONFIG.COLUMNS.ETIKETLER),
          hesaplamaTarihi: this._parseDate(this._getValue(row, CONFIG.COLUMNS.HESAPLAMA_TARIHI)),
          veriKaynagi: this._getValue(row, CONFIG.COLUMNS.VERI_KAYNAGI),
        };

        // Boş satırları filtrele (tüm alanlar boşsa)
        const isEmpty = Object.values(obj).every(value => 
          value === undefined || value === null || value === '' || 
          (typeof value === 'number' && isNaN(value)) ||
          value === obj.__rawRow || value === obj.__rowNumber // Özel alanları hariç tut
        );

        return isEmpty ? null : obj;

      } catch (error) {
        console.error(`❌ Satır ${rowIndex + 1} dönüştürülürken hata:`, error);
        return null;
      }
    }).filter(item => item !== null); // null'ları filtrele
  },

  /**
   * Satırdan değer al (güvenli)
   */
  _getValue(row, index) {
    if (!row || index < 0 || index >= row.length) {
      return '';
    }
    
    const value = row[index];
    
    // Null/undefined kontrolü
    if (value === null || value === undefined) {
      return '';
    }
    
    // String'e çevir ve trim yap
    return value.toString().trim();
  },

 _getNumericValue(row, index) {
  const value = this._getValue(row, index);
  
  if (value === '') return 0;
  if (typeof value === 'number') return value;
  
  const str = value.toString().trim();
  
  // DEBUG: Hangi string geliyor görelim
  console.log(`🔢 Dönüştürülen string: "${str}"`);
  
  // 1. Boşlukları temizle
  let cleanStr = str.replace(/\s/g, '');
  
  // 2. TÜRKÇE FORMAT: "1.234,56" veya "5.080,33"
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleanStr)) {
    // Binlik ayraçları (nokta) kaldır, ondalık ayracını (virgül) noktaya çevir
    cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleanStr);
    console.log(`   Türkçe format -> "${str}" -> "${cleanStr}" -> ${num}`);
    return isNaN(num) ? 0 : num;
  }
  
  // 3. İNGİLİZCE FORMAT: "1,234.56" veya "30.67"
  if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(cleanStr)) {
    // Binlik ayraçları (virgül) kaldır
    cleanStr = cleanStr.replace(/,/g, '');
    const num = parseFloat(cleanStr);
    console.log(`   İngilizce format -> "${str}" -> "${cleanStr}" -> ${num}`);
    return isNaN(num) ? 0 : num;
  }
  
  // 4. BASİT ONDALIK: "30,67" veya "12,89"
  if (/^\d+,\d+$/.test(cleanStr)) {
    cleanStr = cleanStr.replace(',', '.');
    const num = parseFloat(cleanStr);
    console.log(`   Basit ondalık -> "${str}" -> "${cleanStr}" -> ${num}`);
    return isNaN(num) ? 0 : num;
  }
  
  // 5. TAM SAYI: "1244"
  if (/^\d+$/.test(cleanStr)) {
    const num = parseFloat(cleanStr);
    console.log(`   Tam sayı -> "${str}" -> ${num}`);
    return isNaN(num) ? 0 : num;
  }
  
  console.warn(`⚠️ Sayıya çevrilemedi: "${str}"`);
  return 0;
 },

  /**
   * Tarihi parse et
   */
  _parseDate(input) {
    if (!input) {
      return null;
    }
    
    // Zaten Date objesiyse
    if (input instanceof Date) {
      // Geçerli bir tarih mi?
      if (isNaN(input.getTime())) {
        return null;
      }
      return input;
    }
    
    const str = input.toString().trim();
    
    // Boşsa null döndür
    if (str === '') {
      return null;
    }
    
    try {
      // "DD.MM.YYYY" formatı
      const parts = str.split('.');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Ay 0'dan başlar
        const year = parseInt(parts[2], 10);
        
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          const fullYear = year < 100 ? 2000 + year : year;
          return new Date(fullYear, month, day);
        }
      }
      
      // "YYYY-MM-DD" formatı
      const isoParts = str.split('-');
      if (isoParts.length === 3) {
        const year = parseInt(isoParts[0], 10);
        const month = parseInt(isoParts[1], 10) - 1;
        const day = parseInt(isoParts[2], 10);
        
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          return new Date(year, month, day);
        }
      }
      
      // Varsayılan Date parser
      const date = new Date(str);
      
      // Geçerli bir tarih mi?
      if (isNaN(date.getTime())) {
        console.warn(`⚠️ Geçersiz tarih formatı: "${str}"`);
        return null;
      }
      
      return date;
      
    } catch (error) {
      console.error(`❌ Tarih parse hatası: "${str}"`, error);
      return null;
    }
  },

  /**
   * Sheet'teki sütun başlıklarını getir (debug için)
   */
  getColumnHeaders() {
    try {
      const sheet = this._getPortfolioSheet();
      if (!sheet) {
        return [];
      }
      
      // İlk satırı oku (başlıklar)
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      
      console.log('📋 Sütun başlıkları:');
      headers.forEach((header, index) => {
        console.log(`  ${index}. ${header} -> CONFIG.COLUMNS'da: ${this._getConfigColumnName(index)}`);
      });
      
      return headers;
      
    } catch (error) {
      console.error('❌ Başlık okuma hatası:', error);
      return [];
    }
  },

  /**
   * CONFIG.COLUMNS'tan sütun adını bul
   */
  _getConfigColumnName(index) {
    for (const [key, value] of Object.entries(CONFIG.COLUMNS)) {
      if (value === index) {
        return key;
      }
    }
    return 'TANIMSIZ';
  },

  /**
   * Veri yapısını debug et (güncellenmiş versiyon)
   */
  debugDataStructure() {
    console.log('🔍 DATA STRUCTURE DEBUG (GÜNCELLENMİŞ)');
    console.log('='.repeat(80));
    
    try {
      // 1. Cache durumu
      console.log('\n💾 CACHE DURUMU:');
      console.log(`   Cache'de veri: ${this._cache.portfolio ? 'EVET' : 'HAYIR'}`);
      if (this._cache.lastFetchPortfolio) {
        const age = (new Date().getTime() - this._cache.lastFetchPortfolio.getTime()) / 1000;
        console.log(`   Son portföy okuma: ${Math.floor(age)} saniye önce`);
      }
      
      // 2. Sheet başlıklarını göster
      console.log('\n📋 SHEET BAŞLIKLARI:');
      const headers = this.getColumnHeaders();
      
      // 3. CONFIG.COLUMNS mapping'ini göster
      console.log('\n⚙️ CONFIG.COLUMNS MAPPING (44 sütun):');
      const columnEntries = Object.entries(CONFIG.COLUMNS);
      columnEntries.sort((a, b) => a[1] - b[1]);
      
      columnEntries.forEach(([key, index]) => {
        const headerName = headers[index] || 'BOŞ';
        console.log(`  ${index.toString().padStart(2)}. ${key.padEnd(25)} -> "${headerName}"`);
      });
      
      // 4. İlk birkaç kaydı göster
      console.log('\n📊 İLK KAYIT (tüm alanlar):');
      const portfolio = this.readPortfolio();
      
      if (portfolio.length > 0) {
        const sample = portfolio[0];
        
        console.log('\n  TEMEL BİLGİLER:');
        console.log(`     ID: ${sample.id}`);
        console.log(`     Tarih: ${sample.tarih ? Utilities.formatDate(sample.tarih, 'GMT', 'dd.MM.yyyy') : 'BOŞ'}`);
        console.log(`     Başlık: ${sample.baslik}`);
        console.log(`     Kategori: ${sample.kategori}`);
        console.log(`     İşlem Türü: ${sample.islemTuru}`);
        console.log(`     Birim: ${sample.birimi}`);
        console.log(`     Adet: ${sample.adet}`);
        console.log(`     Birim Fiyat: ${sample.birimFiyat}`);
        console.log(`     Platform: ${sample.platform}`);
        
        console.log('\n  YATIRILAN DEĞERLER:');
        console.log(`     Yatırılan Tutar: ${sample.yatirilanTutar}`);
        console.log(`     Yatırılan TL: ${sample.yatirilanTL}`);
        console.log(`     Yatırılan USD: ${sample.yatirilanUSD}`);
        
        console.log('\n  GÜNCEL DEĞERLER:');
        console.log(`     Güncel Tutar: ${sample.guncelTutar}`);
        console.log(`     Güncel TL: ${sample.guncelTL}`);
        
        console.log('\n  KAR/ZARAR:');
        console.log(`     Kar/Zarar Tutar: ${sample.karZararTutar}`);
        console.log(`     Kar/Zarar %: ${sample.karZararYuzde}`);
        
        console.log(`\n📈 TOPLAM: ${portfolio.length} kayıt okundu`);
        
        // 5. Kategori dağılımı
        console.log('\n📊 KATEGORİ DAĞILIMI:');
        const kategoriCounts = {};
        portfolio.forEach(item => {
          const kategori = item.kategori || 'BELİRSİZ';
          kategoriCounts[kategori] = (kategoriCounts[kategori] || 0) + 1;
        });
        
        Object.entries(kategoriCounts)
          .sort((a, b) => b[1] - a[1])
          .forEach(([kategori, count]) => {
            const percentage = ((count / portfolio.length) * 100).toFixed(1);
            console.log(`  ${kategori}: ${count} (%${percentage})`);
          });
          
      } else {
        console.log('ℹ️ Portföy boş');
      }
      
      // 6. Geçmiş veri durumu
      console.log('\n📊 GEÇMİŞ VERİ DURUMU:');
      const stocks = this.readHistoricalStockPrices();
      const currencies = this.readHistoricalCurrencyPrices();
      const golds = this.readHistoricalGoldPrices();
      
      console.log(`   Hisse kayıtları: ${stocks.length}`);
      console.log(`   Döviz kayıtları: ${currencies.length}`);
      console.log(`   Altın kayıtları: ${golds.length}`);
      
      // 7. Güncel fiyatlar
      console.log('\n💰 GÜNCEL FİYATLAR:');
      const dolar = this.getDolarPrice();
      const gramAltin = this.getGramAltinPrice();
      
      if (dolar) {
        const dateStr = dolar.date ? Utilities.formatDate(dolar.date, 'GMT', 'dd.MM.yyyy') : '?';
        console.log(`   Dolar: ${dolar.price.toFixed(4)} TL (${dateStr})`);
      }
      
      if (gramAltin) {
        const dateStr = gramAltin.date ? Utilities.formatDate(gramAltin.date, 'GMT', 'dd.MM.yyyy') : '?';
        console.log(`   Gram Altın: ${gramAltin.price.toFixed(2)} TL (${dateStr})`);
      }
      
      console.log('\n' + '='.repeat(80));
      
    } catch (error) {
      console.error('❌ Debug hatası:', error);
    }
  },

  /**
   * Portföy verisini dışa aktar (başka dosyalar için)
   */
  exportPortfolioData() {
    return this.readPortfolio();
  },

  /**
   * Belirli bir alanın değerlerini döndür
   */
  getFieldValues(fieldName) {
    const portfolio = this.readPortfolio();
    return portfolio.map(item => item[fieldName]);
  },

  /**
   * Benzersiz değerleri döndür
   */
  getUniqueValues(fieldName) {
    const values = this.getFieldValues(fieldName);
    return [...new Set(values.filter(val => val && val !== ''))];
  }
};
/**
 * 🧪 DATA READER TAM TEST FONKSİYONU (PORTFÖY + GEÇMİŞ FİYATLAR)
 */
function test_DataReader_Complete() {
  console.log('🧪 DATA READER TAM TEST (PORTFÖY + GEÇMİŞ FİYATLAR)');
  console.log('='.repeat(80));
  
  const startTime = new Date();
  
  try {
    // 1. CONFIG kontrolü
    console.log('\n1️⃣ CONFIG KONTROLÜ');
    console.log(`   Sheet ID: ${CONFIG.SHEETS.PORTFOY?.ID ? 'VAR' : 'YOK'}`);
    console.log(`   Portföy Sheet: ${CONFIG.SHEETS.PORTFOY?.NAME || 'YOK'}`);
    console.log(`   Hisse Sheet: ${CONFIG.SHEETS.HISSE_GECMIS_GUNLUK?.NAME || 'YOK'}`);
    console.log(`   Döviz Sheet: ${CONFIG.SHEETS.DOVIZ_GECMIS_GUNLUK?.NAME || 'YOK'}`);
    console.log(`   Altın Sheet: ${CONFIG.SHEETS.ALTIN_GECMIS_GUNLUK?.NAME || 'YOK'}`);
    
    // 2. DataReader kontrolü
    console.log('\n2️⃣ DATA READER KONTROLÜ');
    if (typeof DataReader !== 'undefined') {
      console.log('   ✅ DataReader nesnesi mevcut');
    } else {
      console.log('   ❌ DataReader nesnesi tanımlı değil');
      return;
    }
    
    // 3. Portföy okuma testi
    console.log('\n3️⃣ PORTFÖY OKUMA TESTİ');
    const portfolioStart = new Date();
    const portfolio = DataReader.readPortfolio();
    const portfolioDuration = new Date() - portfolioStart;
    
    console.log(`   ✅ ${portfolio.length} kayıt okundu`);
    console.log(`   ⏱️  Süre: ${portfolioDuration}ms`);
    
    if (portfolio.length > 0) {
      const sample = portfolio[0];
      console.log(`   📊 Örnek kayıt: ${sample.baslik} (${sample.kategori}) - ${sample.adet} adet`);
      
      // Portföy kategorilerini göster
      const categories = {};
      portfolio.forEach(item => {
        const cat = item.kategori || 'BELİRSİZ';
        categories[cat] = (categories[cat] || 0) + 1;
      });
      
      console.log(`   📈 Kategori dağılımı:`);
      Object.entries(categories).forEach(([cat, count]) => {
        console.log(`      ${cat}: ${count} kayıt`);
      });
    }
    
    // 4. Geçmiş veri okuma testi
    console.log('\n4️⃣ GEÇMİŞ VERİ OKUMA TESTİ');
    
    // Hisse
    console.log('   📈 Hisse geçmişi okunuyor...');
    const stocksStart = new Date();
    const stocks = DataReader.readHistoricalStockPrices();
    const stocksDuration = new Date() - stocksStart;
    console.log(`      ✅ ${stocks.length} kayıt (${stocksDuration}ms)`);
    
    if (stocks.length > 0) {
      const uniqueStocks = [...new Set(stocks.map(s => s.symbol))];
      console.log(`      📊 ${uniqueStocks.length} benzersiz hisse`);
      
      if (uniqueStocks.length > 0) {
        console.log(`      Örnek hisseler: ${uniqueStocks.slice(0, 3).join(', ')}`);
      }
    }
    
    // Döviz
    console.log('   💱 Döviz geçmişi okunuyor...');
    const currenciesStart = new Date();
    const currencies = DataReader.readHistoricalCurrencyPrices();
    const currenciesDuration = new Date() - currenciesStart;
    console.log(`      ✅ ${currencies.length} kayıt (${currenciesDuration}ms)`);
    
    if (currencies.length > 0) {
      const uniqueCurrencies = [...new Set(currencies.map(c => c.symbol))];
      console.log(`      📊 ${uniqueCurrencies.length} benzersiz döviz`);
      
      if (uniqueCurrencies.length > 0) {
        console.log(`      Örnek dövizler: ${uniqueCurrencies.slice(0, 3).join(', ')}`);
      }
    }
    
    // Altın
    console.log('   🏅 Altın geçmişi okunuyor...');
    const goldStart = new Date();
    const golds = DataReader.readHistoricalGoldPrices();
    const goldDuration = new Date() - goldStart;
    console.log(`      ✅ ${golds.length} kayıt (${goldDuration}ms)`);
    
    if (golds.length > 0) {
      const uniqueGolds = [...new Set(golds.map(g => g.symbol))];
      console.log(`      📊 ${uniqueGolds.length} benzersiz altın türü`);
      
      if (uniqueGolds.length > 0) {
        console.log(`      Örnek altınlar: ${uniqueGolds.slice(0, 5).join(', ')}`);
      }
    }
    
    // 5. Güncel fiyat sorgulama testi
    console.log('\n5️⃣ GÜNCEL FİYAT SORGULAMA TESTİ');
    
    // Dolar
    console.log('   💵 Dolar fiyatı sorgulanıyor...');
    const dolarStart = new Date();
    const dolar = DataReader.getDolarPrice();
    const dolarDuration = new Date() - dolarStart;
    
    if (dolar) {
      const dateStr = dolar.date ? Utilities.formatDate(dolar.date, 'GMT', 'dd.MM.yyyy') : 'Tarih yok';
      console.log(`      ✅ USD/TRY: ${dolar.price.toFixed(4)} TL (${dateStr}) - ${dolarDuration}ms`);
    } else {
      console.log(`      ❌ Dolar fiyatı bulunamadı`);
    }
    
    // Gram altın
    console.log('   🏅 Gram altın fiyatı sorgulanıyor...');
    const altinStart = new Date();
    const gramAltin = DataReader.getGramAltinPrice();
    const altinDuration = new Date() - altinStart;
    
    if (gramAltin) {
      const dateStr = gramAltin.date ? Utilities.formatDate(gramAltin.date, 'GMT', 'dd.MM.yyyy') : 'Tarih yok';
      console.log(`      ✅ Gram Altın: ${gramAltin.price.toFixed(2)} TL (${dateStr}) - ${altinDuration}ms`);
    } else {
      console.log(`      ❌ Gram altın fiyatı bulunamadı`);
    }
    
    // 6. Portföy varlığı fiyat testi
    console.log('\n6️⃣ PORTFÖY VARLIĞI FİYAT TESTİ');
    
    if (portfolio.length > 0) {
      // Hisse örneği
      const hisseItem = portfolio.find(item => item.kategori && item.kategori.includes('Borsa'));
      if (hisseItem) {
        console.log(`   📈 Hisse testi: ${hisseItem.baslik}`);
        const hissePrice = DataReader.getPortfolioItemPrice(hisseItem);
        if (hissePrice) {
          console.log(`      ✅ Fiyat: ${hissePrice.price.toFixed(2)} TL`);
        } else {
          console.log(`      ❌ Fiyat bulunamadı`);
        }
      }
      
      // Döviz örneği
      const dovizItem = portfolio.find(item => item.kategori === 'Döviz' || item.birimi === 'USD' || item.birimi === 'EUR');
      if (dovizItem) {
        console.log(`   💱 Döviz testi: ${dovizItem.birim || dovizItem.baslik}`);
        const dovizPrice = DataReader.getPortfolioItemPrice(dovizItem);
        if (dovizPrice) {
          console.log(`      ✅ Fiyat: ${dovizPrice.price.toFixed(4)} TL`);
        } else {
          console.log(`      ❌ Fiyat bulunamadı`);
        }
      }
      
      // Altın örneği
      const altinItem = portfolio.find(item => item.kategori && item.kategori.includes('Altın'));
      if (altinItem) {
        console.log(`   🏅 Altın testi: ${altinItem.baslik}`);
        const altinPrice = DataReader.getPortfolioItemPrice(altinItem);
        if (altinPrice) {
          console.log(`      ✅ Fiyat: ${altinPrice.price.toFixed(2)} TL`);
        } else {
          console.log(`      ❌ Fiyat bulunamadı`);
        }
      }
    }
    
    // 7. Cache testi
    console.log('\n7️⃣ CACHE TESTİ');
    console.log('   İkinci portföy okuması (cache kullanmalı):');
    const cacheStart = new Date();
    DataReader.readPortfolio();
    const cacheDuration = new Date() - cacheStart;
    console.log(`   ⚡ Cache okuma süresi: ${cacheDuration}ms`);
    
    console.log('   Force refresh ile portföy okuması:');
    const forceStart = new Date();
    DataReader.readPortfolio(true);
    const forceDuration = new Date() - forceStart;
    console.log(`   🔄 Force refresh süresi: ${forceDuration}ms`);
    
    // 8. Debug çıktıları
    console.log('\n8️⃣ DEBUG ÇIKTILARI');
    console.log('   DataReader.debugDataStructure() çalıştırılıyor...');
    DataReader.debugDataStructure();
    
    // 9. Tüm önemli fiyatlar
    console.log('\n9️⃣ TÜM ÖNEMLİ FİYATLAR');
    const allPrices = DataReader.getAllImportantPrices();
    console.log(`   Dolar: ${allPrices.dolar?.price?.toFixed(4) || 'Bulunamadı'} TL`);
    console.log(`   Euro: ${allPrices.euro?.price?.toFixed(4) || 'Bulunamadı'} TL`);
    console.log(`   Gram Altın: ${allPrices.gramAltin?.price?.toFixed(2) || 'Bulunamadı'} TL`);
    console.log(`   Ons Altın: ${allPrices.onsAltin?.price?.toFixed(2) || 'Bulunamadı'} $`);
    
    // 10. Cache temizleme
    console.log('\n🔟 CACHE TEMİZLEME');
    DataReader.clearCache();
    console.log('   ✅ Tüm cache\'ler temizlendi');
    
  } catch (error) {
    console.error('❌ Test hatası:', error);
    console.error(error.stack);
  }
  
  const totalDuration = (new Date().getTime() - startTime.getTime()) / 1000;
  console.log('\n' + '='.repeat(80));
  console.log(`⏱️  Toplam süre: ${totalDuration.toFixed(2)} saniye`);
  console.log('🎉 DATA READER TAM TEST TAMAMLANDI');
}

/**
 * 🚀 HIZLI TEST (BASİT KONTROL)
 */
function test_DataReader_Quick() {
  console.log('⚡ DATA READER HIZLI TEST');
  console.log('='.repeat(60));
  
  try {
    // 1. Portföy
    console.log('\n📊 PORTFÖY:');
    const portfolio = DataReader.readPortfolio();
    console.log(`   ${portfolio.length} kayıt`);
    
    if (portfolio.length > 0) {
      console.log('   İlk 3 kayıt:');
      portfolio.slice(0, 3).forEach((item, i) => {
        console.log(`   ${i+1}. ${item.baslik} (${item.kategori}): ${item.adet} adet`);
      });
    }
    
    // 2. Geçmiş veriler
    console.log('\n📈 GEÇMİŞ VERİLER:');
    const stocks = DataReader.readHistoricalStockPrices();
    const currencies = DataReader.readHistoricalCurrencyPrices();
    const golds = DataReader.readHistoricalGoldPrices();
    
    console.log(`   Hisse: ${stocks.length} kayıt`);
    console.log(`   Döviz: ${currencies.length} kayıt`);
    console.log(`   Altın: ${golds.length} kayıt`);
    
    // 3. Güncel fiyatlar
    console.log('\n💰 GÜNCEL FİYATLAR:');
    
    const dolar = DataReader.getDolarPrice();
    if (dolar) {
      const dateStr = dolar.date ? Utilities.formatDate(dolar.date, 'GMT', 'dd.MM.yyyy') : '?';
      console.log(`   💵 Dolar: ${dolar.price.toFixed(4)} TL (${dateStr})`);
    }
    
    const gramAltin = DataReader.getGramAltinPrice();
    if (gramAltin) {
      const dateStr = gramAltin.date ? Utilities.formatDate(gramAltin.date, 'GMT', 'dd.MM.yyyy') : '?';
      console.log(`   🏅 Gram Altın: ${gramAltin.price.toFixed(2)} TL (${dateStr})`);
    }
    
    // 4. Portföy varlığı fiyatı
    console.log('\n📊 PORTFÖY VARLIĞI FİYATI:');
    if (portfolio.length > 0) {
      const sampleItem = portfolio[0];
      const price = DataReader.getPortfolioItemPrice(sampleItem);
      if (price) {
        console.log(`   ${sampleItem.baslik}: ${price.price.toFixed(2)} TL`);
      }
    }
    
    // 5. Performans
    console.log('\n⚡ PERFORMANS:');
    console.log('   Cache temizleniyor...');
    DataReader.clearCache();
    
    console.log('   İlk okuma:');
    const start1 = new Date();
    DataReader.readPortfolio();
    const time1 = new Date() - start1;
    console.log(`      Portföy: ${time1}ms`);
    
    console.log('   İkinci okuma (cache):');
    const start2 = new Date();
    DataReader.readPortfolio();
    const time2 = new Date() - start2;
    console.log(`      Portföy: ${time2}ms`);
    
  } catch (error) {
    console.error('❌ Hızlı test hatası:', error);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 HIZLI TEST TAMAMLANDI');
}

/**
 * 📊 GEÇMİŞ VERİ ÖZEL TESTİ
 */
function test_DataReader_Historical_Data() {
  console.log('📊 DATA READER GEÇMİŞ VERİ TESTİ');
  console.log('='.repeat(80));
  
  try {
    // 1. Tüm geçmiş verileri oku
    console.log('\n1️⃣ TÜM GEÇMİŞ VERİLERİ OKUMA');
    
    const stocks = DataReader.readHistoricalStockPrices();
    const currencies = DataReader.readHistoricalCurrencyPrices();
    const golds = DataReader.readHistoricalGoldPrices();
    
    console.log(`   📈 Hisse: ${stocks.length} kayıt`);
    console.log(`   💱 Döviz: ${currencies.length} kayıt`);
    console.log(`   🏅 Altın: ${golds.length} kayıt`);
    
    // 2. Örnek kayıtlar göster
    console.log('\n2️⃣ ÖRNEK KAYITLAR');
    
    if (stocks.length > 0) {
      console.log('   📈 Hisse örneği:');
      const sampleStock = stocks[0];
      console.log(`      Sembol: ${sampleStock.symbol}`);
      console.log(`      Tarih: ${sampleStock.date ? Utilities.formatDate(sampleStock.date, 'GMT', 'dd.MM.yyyy') : '?'}`);
      console.log(`      Kapanış: ${sampleStock.close}`);
      console.log(`      Kaynak: ${sampleStock.source}`);
    }
    
    if (currencies.length > 0) {
      console.log('   💱 Döviz örneği:');
      const sampleCurrency = currencies[0];
      console.log(`      Sembol: ${sampleCurrency.symbol}`);
      console.log(`      Tarih: ${sampleCurrency.date ? Utilities.formatDate(sampleCurrency.date, 'GMT', 'dd.MM.yyyy') : '?'}`);
      console.log(`      Kapanış: ${sampleCurrency.close}`);
      console.log(`      Kaynak: ${sampleCurrency.source}`);
    }
    
    if (golds.length > 0) {
      console.log('   🏅 Altın örneği:');
      const sampleGold = golds[0];
      console.log(`      Tür: ${sampleGold.symbol}`);
      console.log(`      Tarih: ${sampleGold.date ? Utilities.formatDate(sampleGold.date, 'GMT', 'dd.MM.yyyy') : '?'}`);
      console.log(`      Kapanış: ${sampleGold.close}`);
      console.log(`      Kaynak: ${sampleGold.source}`);
    }
    
    // 3. Sembol listesi
    console.log('\n3️⃣ SEMBOL LİSTESİ');
    
    if (stocks.length > 0) {
      const uniqueStocks = [...new Set(stocks.map(s => s.symbol))];
      console.log(`   📈 ${uniqueStocks.length} benzersiz hisse`);
      if (uniqueStocks.length > 0) {
        console.log(`   İlk 5: ${uniqueStocks.slice(0, 5).join(', ')}`);
      }
    }
    
    if (currencies.length > 0) {
      const uniqueCurrencies = [...new Set(currencies.map(c => c.symbol))];
      console.log(`   💱 ${uniqueCurrencies.length} benzersiz döviz`);
      console.log(`   Tümü: ${uniqueCurrencies.join(', ')}`);
    }
    
    if (golds.length > 0) {
      const uniqueGolds = [...new Set(golds.map(g => g.symbol))];
      console.log(`   🏅 ${uniqueGolds.length} benzersiz altın türü`);
      console.log(`   Tümü: ${uniqueGolds.join(', ')}`);
    }
    
    // 4. Güncel fiyat testi
    console.log('\n4️⃣ GÜNCEL FİYAT TESTİ');
    
    // USDTRY=X fiyatı
    const usdPrice = DataReader.getCurrentPrice('USDTRY=X', 'CURRENCY');
    if (usdPrice) {
      console.log(`   💵 USDTRY=X: ${usdPrice.price.toFixed(4)} TL`);
    } else {
      console.log('   ❌ USDTRY=X fiyatı bulunamadı');
    }
    
    // Gram altın fiyatı
    const gramAltinPrice = DataReader.getCurrentPrice('gram-altin', 'GOLD');
    if (gramAltinPrice) {
      console.log(`   🏅 Gram Altın: ${gramAltinPrice.price.toFixed(2)} TL`);
    } else {
      console.log('   ❌ Gram Altın fiyatı bulunamadı');
    }
    
    // 5. En güncel tarihler
    console.log('\n5️⃣ EN GÜNCEL TARİHLER');
    
    if (stocks.length > 0) {
      const latestStock = stocks.reduce((latest, current) => {
        if (!latest) return current;
        return (current.date > latest.date) ? current : latest;
      }, null);
      
      if (latestStock) {
        console.log(`   📈 En güncel hisse: ${latestStock.symbol} - ${Utilities.formatDate(latestStock.date, 'GMT', 'dd.MM.yyyy')}`);
      }
    }
    
    if (currencies.length > 0) {
      const latestCurrency = currencies.reduce((latest, current) => {
        if (!latest) return current;
        return (current.date > latest.date) ? current : latest;
      }, null);
      
      if (latestCurrency) {
        console.log(`   💱 En güncel döviz: ${latestCurrency.symbol} - ${Utilities.formatDate(latestCurrency.date, 'GMT', 'dd.MM.yyyy')}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Geçmiş veri test hatası:', error);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('🎉 GEÇMİŞ VERİ TESTİ TAMAMLANDI');
}

/**
 * 🚀 TÜM TESTLERİ ÇALIŞTIR
 */
function run_All_DataReader_Tests() {
  console.log('🚀 DATA READER TÜM TESTLER BAŞLATILIYOR...\n');
  
  // 1. Hızlı test
  test_DataReader_Quick();
  
  console.log('\n' + '='.repeat(100) + '\n');
  
  // 2. Geçmiş veri testi
  test_DataReader_Historical_Data();
  
  console.log('\n' + '='.repeat(100) + '\n');
  
  // 3. Tam test
  test_DataReader_Complete();
  
  console.log('\n' + '='.repeat(100));
  console.log('🎊 TÜM DATA READER TESTLERİ BAŞARIYLA TAMAMLANDI!');
}

/**
 * 📱 WEB UYGULAMASI İÇİN TEST (basit)
 */
function test_DataReader_For_Web() {
  console.log('🌐 WEB UYGULAMASI TESTİ');
  console.log('='.repeat(60));
  
  try {
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      data: {}
    };
    
    // Portföy
    const portfolio = DataReader.readPortfolio();
    result.data.portfolio = {
      count: portfolio.length,
      sample: portfolio.length > 0 ? portfolio[0].baslik : null,
      categories: {}
    };
    
    // Kategoriler
    portfolio.forEach(item => {
      const cat = item.kategori || 'BELİRSİZ';
      result.data.portfolio.categories[cat] = (result.data.portfolio.categories[cat] || 0) + 1;
    });
    
    // Güncel fiyatlar
    result.data.prices = {
      dolar: DataReader.getDolarPrice(),
      gramAltin: DataReader.getGramAltinPrice(),
      euro: DataReader.getEuroPrice(),
      onsAltin: DataReader.getOnsAltinPrice()
    };
    
    // Geçmiş veri durumu
    result.data.historical = {
      stocks: DataReader.readHistoricalStockPrices().length,
      currencies: DataReader.readHistoricalCurrencyPrices().length,
      gold: DataReader.readHistoricalGoldPrices().length
    };
    
    // Console'a yaz
    console.log(`📊 Portföy: ${result.data.portfolio.count} kayıt`);
    console.log(`💰 Dolar: ${result.data.prices.dolar?.price?.toFixed(4) || 'N/A'} TL`);
    console.log(`🏅 Gram Altın: ${result.data.prices.gramAltin?.price?.toFixed(2) || 'N/A'} TL`);
    console.log(`📈 Hisse geçmişi: ${result.data.historical.stocks} kayıt`);
    console.log(`💱 Döviz geçmişi: ${result.data.historical.currencies} kayıt`);
    console.log(`🏅 Altın geçmişi: ${result.data.historical.gold} kayıt`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Web testi başarılı');
    
    return result;
    
  } catch (error) {
    console.error('❌ Web testi hatası:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * ⚡ EN HIZLI TEST (sadece kontrol)
 */
function quickCheck() {
  console.log('⚡ HIZLI KONTROL');
  console.log('='.repeat(50));
  
  const start = new Date();
  
  try {
    // Portföy
    const portfolio = DataReader.readPortfolio();
    console.log(`📊 Portföy: ${portfolio.length} kayıt`);
    
    // Dolar
    const dolar = DataReader.getDolarPrice();
    console.log(`💵 Dolar: ${dolar ? dolar.price.toFixed(4) + ' TL' : 'Bulunamadı'}`);
    
    // Gram altın
    const gramAltin = DataReader.getGramAltinPrice();
    console.log(`🏅 Gram Altın: ${gramAltin ? gramAltin.price.toFixed(2) + ' TL' : 'Bulunamadı'}`);
    
    // Hisse geçmişi
    const stocks = DataReader.readHistoricalStockPrices();
    console.log(`📈 Hisse geçmişi: ${stocks.length} kayıt`);
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  }
  
  const duration = new Date() - start;
  console.log(`\n⏱️  Süre: ${duration}ms`);
  console.log('='.repeat(50));
}
