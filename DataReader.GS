/**
 * SON GÜNCELLEME: 2026-02-11 23:59 (RAW-vs-CACHE DEBUG REVISION)
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

  /**
   * Parse davranışı seçenekleri
   * numericEmptyAsNull=true olduğunda boş numeric hücreler 0 yerine null döner.
   */
  _parseOptions: {
    numericEmptyAsNull: false
  },

  setParseOptions(options = {}) {
    this._parseOptions = {
      ...this._parseOptions,
      ...options
    };
    console.log(`⚙️ Parse options güncellendi: ${JSON.stringify(this._parseOptions)}`);
  },

  getParseOptions() {
    return { ...this._parseOptions };
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
   * Karşılaştırma için değeri normalize et
   */
  _normalizeForCompare(value) {
    if (value === null || value === undefined || value === '') return '';
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? Number(value.toFixed(8)) : 0;
    }
    return value.toString().trim();
  },

  /**
   * Cache satırı için özet bilgi üret
   */
  _getCacheStatus(cacheKey, lastFetchKey, label) {
    const cacheData = this._cache[cacheKey];
    const lastFetch = this._cache[lastFetchKey];
    const now = new Date().getTime();
    const ttlMs = this._cache.CACHE_DURATION;

    const count = Array.isArray(cacheData) ? cacheData.length : 0;
    const ageMs = lastFetch ? now - lastFetch.getTime() : null;

    return {
      label: label,
      cacheKey: cacheKey,
      count: count,
      ageSec: ageMs !== null ? Math.floor(ageMs / 1000) : null,
      remainingSec: ageMs !== null ? Math.max(0, Math.floor((ttlMs - ageMs) / 1000)) : null,
      isExpired: ageMs !== null ? ageMs >= ttlMs : false,
      lastFetchIso: lastFetch ? lastFetch.toISOString() : null,
      sample: Array.isArray(cacheData) && cacheData.length > 0 ? cacheData[0] : null
    };
  },

  /**
   * Cache'e basılan verileri göster (özet + örnek)
   */
  debugCacheStatus(options = {}) {
    const showSamples = options.showSamples !== false;

    console.log('💾 DATA READER CACHE KONTROLÜ');

    const rows = [
      this._getCacheStatus('portfolio', 'lastFetchPortfolio', 'PORTFÖY'),
      this._getCacheStatus('historicalSTOCK', 'lastFetchSTOCK', 'HİSSE GEÇMİŞ'),
      this._getCacheStatus('historicalCURRENCY', 'lastFetchCURRENCY', 'DÖVİZ GEÇMİŞ'),
      this._getCacheStatus('historicalGOLD', 'lastFetchGOLD', 'ALTIN GEÇMİŞ')
    ];

    rows.forEach(row => {
      const ageText = row.ageSec === null ? '-' : `${row.ageSec}s`;
      const ttlText = row.remainingSec === null ? '-' : `${row.remainingSec}s`;
      const state = row.count === 0 ? 'BOŞ' : row.isExpired ? 'SÜRESİ DOLDU' : 'AKTİF';
      console.log(`   ${row.label.padEnd(14)} | durum=${state.padEnd(12)} | kayıt=${String(row.count).padStart(5)} | yaş=${ageText.padStart(6)} | ttl=${ttlText.padStart(6)}`);

      if (showSamples) {
        if (row.sample) {
          if (row.cacheKey === 'portfolio') {
            console.log(`      ↳ örnek: id=${row.sample.id || '-'}, başlık=${row.sample.baslik || '-'}, kategori=${row.sample.kategori || '-'}, adet=${row.sample.adet || 0}`);
          } else {
            console.log(`      ↳ örnek: symbol=${row.sample.symbol || '-'}, date=${row.sample.date || '-'}, close=${row.sample.close || '-'}`);
          }
        } else {
          console.log('      ↳ örnek: -');
        }
      }
    });
  },

  /**
   * Ham portföy satırı ile parse edilmiş objeyi karşılaştır
   */
  debugRawVsParsed(options = {}) {
    const forceRefresh = options.forceRefresh === true;
    const limit = options.limit || 5;

    console.log('🔎 HAM VERİ vs PARSE EDİLEN VERİ (PORTFÖY)');

    try {
      const sheet = this._getPortfolioSheet();
      if (!sheet) {
        console.log('   ❌ Portföy sheet bulunamadı');
        return;
      }

      const rawData = this._readAllData(sheet);
      const parsedData = this.readPortfolio(forceRefresh);

      console.log(`   Ham satır: ${rawData.length}`);
      console.log(`   Parse kayıt: ${parsedData.length}`);

      const checks = [
        ['id', 'ID'],
        ['baslik', 'BASLIK'],
        ['kategori', 'KATEGORI'],
        ['birimi', 'BIRIMI'],
        ['adet', 'ADET'],
        ['birimFiyat', 'BIRIM_FIYAT'],
        ['yatirilanTutar', 'YATIRILAN_TUTAR']
      ];

      const rowCount = Math.min(limit, rawData.length, parsedData.length);
      let mismatchCount = 0;

      for (let i = 0; i < rowCount; i++) {
        const raw = rawData[i];
        const parsed = parsedData[i];
        if (!parsed) continue;

        const errors = [];
        checks.forEach(([field, columnKey]) => {
          const colIndex = CONFIG.COLUMNS[columnKey];
          const rawValue = colIndex !== undefined ? this._normalizeForCompare(raw[colIndex]) : '';
          const parsedValue = this._normalizeForCompare(parsed[field]);
          if (rawValue !== parsedValue) {
            errors.push(`${field}: raw="${rawValue}" parsed="${parsedValue}"`);
          }
        });

        if (errors.length > 0) {
          mismatchCount += 1;
          console.log(`   ⚠️ Satır ${i + 1} farkları:`);
          errors.forEach(err => console.log(`      - ${err}`));
        }
      }

      if (mismatchCount === 0) {
        console.log(`   ✅ İlk ${rowCount} satırda kritik alanlarda fark yok`);
      } else {
        console.log(`   ⚠️ İlk ${rowCount} satırda ${mismatchCount} satırda fark var`);
      }

    } catch (error) {
      console.error('❌ Ham/parse karşılaştırma hatası:', error);
    }
  },

  /**
   * Geçmiş veriler için ham satır/kayıt sayısı kontrolü
   */
  debugHistoricalData(options = {}) {
    const forceRefresh = options.forceRefresh === true;

    console.log('🔍 GEÇMİŞ VERİ KONTROLÜ (HAM vs PARSE)');

    const checks = [
      ['HISSE_GECMIS_GUNLUK', 'STOCK', this.readHistoricalStockPrices.bind(this)],
      ['DOVIZ_GECMIS_GUNLUK', 'CURRENCY', this.readHistoricalCurrencyPrices.bind(this)],
      ['ALTIN_GECMIS_GUNLUK', 'GOLD', this.readHistoricalGoldPrices.bind(this)]
    ];

    checks.forEach(([sheetType, label, readerFn]) => {
      try {
        const sheet = this._getHistoricalSheet(sheetType);
        const rawRows = sheet ? this._readHistoricalSheetData(sheet, sheetType) : [];
        const parsed = readerFn(forceRefresh);

        console.log(`   ${label.padEnd(8)} | ham=${rawRows.length} | parse=${parsed.length}`);
        if (parsed.length > 0) {
          const item = parsed[0];
          console.log(`      ↳ örnek: symbol=${item.symbol || '-'}, date=${item.date || '-'}, close=${item.close || '-'}`);
        }
      } catch (e) {
        console.log(`   ❌ ${label} kontrolünde hata: ${e.message}`);
      }
    });

    this.debugCacheStatus({ showSamples: true });
  },

  /**
   * Ana debug fonksiyonu: ham/parse doğruluğu + cache kontrolü
   */
  debugDataStructure(options = {}) {
    this.debugRawVsParsed({
      forceRefresh: options.forceRefresh === true,
      limit: options.limit || 5
    });

    this.debugCacheStatus({
      showSamples: options.showSamples !== false
    });
  },

  /**
   * Tüm debug kontrollerini sırayla çalıştır
   */
  debugAllData(options = {}) {
    console.log('🧪 DATA READER DEBUG (TAM KONTROL)');
    this.debugDataStructure(options);
    this.debugHistoricalData(options);
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
  if (!row || index < 0 || index >= row.length) return 0;

  const rawValue = row[index];
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return this._parseOptions && this._parseOptions.numericEmptyAsNull ? null : 0;
  }
  if (typeof rawValue === 'number') return Number.isFinite(rawValue) ? rawValue : 0;

  const str = rawValue.toString().trim();
  if (str === '') return 0;

  let cleanStr = str.replace(/\s/g, '');

  // Türkçe binlik/ondalık: 1.234,56
  if (/^[-+]?\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleanStr)) {
    cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleanStr);
    return Number.isNaN(num) ? 0 : num;
  }

  // İngilizce binlik/ondalık: 1,234.56
  if (/^[-+]?\d{1,3}(,\d{3})*(\.\d+)?$/.test(cleanStr)) {
    cleanStr = cleanStr.replace(/,/g, '');
    const num = parseFloat(cleanStr);
    return Number.isNaN(num) ? 0 : num;
  }

  // Basit ondalık: 1234.56 / 30.67
  if (/^[-+]?\d+\.\d+$/.test(cleanStr)) {
    const num = parseFloat(cleanStr);
    return Number.isNaN(num) ? 0 : num;
  }

  // Virgüllü basit ondalık: 30,67
  if (/^[-+]?\d+,\d+$/.test(cleanStr)) {
    cleanStr = cleanStr.replace(',', '.');
    const num = parseFloat(cleanStr);
    return Number.isNaN(num) ? 0 : num;
  }

  // Tam sayı
  if (/^[-+]?\d+$/.test(cleanStr)) {
    const num = parseFloat(cleanStr);
    return Number.isNaN(num) ? 0 : num;
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
 * ==================== DATAREADER TEST YARDIMCILARI ====================
 */
function _drNormalizeCompare(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? Number(value.toFixed(8)) : '';

  const str = String(value).trim();
  if (str === '') return '';

  const compact = str.replace(/\s/g, '');
  const maybeNumber = Number(compact.replace(',', '.'));
  if (!Number.isNaN(maybeNumber) && /^[-+]?\d+(?:[\.,]\d+)?$/.test(compact)) {
    return Number(maybeNumber.toFixed(8));
  }

  return str;
}

function _drValuesEquivalent(rawValue, parsedValue, fieldType) {
  if (fieldType === 'numeric') {
    const rawEmpty = rawValue === '' || rawValue === null || rawValue === undefined;
    if (rawEmpty && (parsedValue === 0 || parsedValue === null)) return true;
  }
  return rawValue === parsedValue;
}

function _drSideBySideValue(rawValue, parsedValue) {
  return `raw="${rawValue}" | parsed="${parsedValue}"`;
}

function _drCountNonEmptyRawColumn(rows, colIndex) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;

  let count = 0;
  rows.forEach(item => {
    const row = item && item.__rawRow;
    if (!Array.isArray(row)) return;
    const value = row[colIndex];
    if (value !== '' && value !== null && value !== undefined) {
      count++;
    }
  });

  return count;
}

function _drFindLatestRecord(records) {
  if (!Array.isArray(records) || records.length === 0) return null;
  return [...records].sort((a, b) => {
    const tA = a && a.date ? new Date(a.date).getTime() : 0;
    const tB = b && b.date ? new Date(b.date).getTime() : 0;
    return tB - tA;
  })[0] || null;
}

function _drFindLatestBySymbol(records, symbol) {
  if (!Array.isArray(records) || records.length === 0) return null;
  const search = String(symbol || '').trim().toLowerCase();
  const filtered = records.filter(item => String(item && item.symbol ? item.symbol : '').trim().toLowerCase() === search);
  return _drFindLatestRecord(filtered);
}

function _drAgeInDays(dateValue) {
  if (!dateValue) return Infinity;
  const time = new Date(dateValue).getTime();
  if (isNaN(time)) return Infinity;
  return (Date.now() - time) / (24 * 60 * 60 * 1000);
}

/**
 * ✅ TEST 1: Ham veri -> parse edilen obje tutarlılığı
 *
 * Amaç:
 * - Portföy satırları için kritik alanlarda ham hücre değeri ile objeye yazılan alanları karşılaştırmak
 * - Numeric alanlarda "" ve 0'ı eşdeğer kabul ederek false-positive farkları azaltmak
 * - Test sonunda ham/parsed değerleri yan yana gösteren bir özet basmak
 */
function test_DataReader_RawVsParsedConsistency(options) {
  const opts = options || {};
  const limit = opts.limit || 50;
  const previewRows = opts.previewRows || 5;
  const forceRefresh = opts.forceRefresh === true;

  console.log('🧪 TEST 1 - HAM VERİ / PARSED VERİ TUTARLILIK KONTROLÜ');
  console.log('='.repeat(90));

  const compareFields = [
    { key: 'id', col: CONFIG.COLUMNS.ID, type: 'text' },
    { key: 'baslik', col: CONFIG.COLUMNS.BASLIK, type: 'text' },
    { key: 'kategori', col: CONFIG.COLUMNS.KATEGORI, type: 'text' },
    { key: 'birimi', col: CONFIG.COLUMNS.BIRIMI, type: 'text' },
    { key: 'adet', col: CONFIG.COLUMNS.ADET, type: 'numeric' },
    { key: 'birimFiyat', col: CONFIG.COLUMNS.BIRIM_FIYAT, type: 'numeric' },
    { key: 'yatirilanTutar', col: CONFIG.COLUMNS.YATIRILAN_TUTAR, type: 'numeric' },
    { key: 'guncelTutar', col: CONFIG.COLUMNS.GUNCEL_TUTAR, type: 'numeric' }
  ];

  try {
    const sheet = DataReader._getPortfolioSheet();
    if (!sheet) {
      console.error('❌ Portföy sheet bulunamadı');
      return { success: false, reason: 'sheet-not-found' };
    }

    const rawRows = DataReader._readAllData(sheet);
    const parsedRows = DataReader.readPortfolio(forceRefresh);

    const rowCount = Math.min(limit, rawRows.length, parsedRows.length);
    const mismatches = [];

    for (let i = 0; i < rowCount; i++) {
      const raw = rawRows[i];
      const parsed = parsedRows[i];
      if (!parsed) continue;

      compareFields.forEach(field => {
        const rawValue = _drNormalizeCompare(raw[field.col]);
        const parsedValue = _drNormalizeCompare(parsed[field.key]);

        if (!_drValuesEquivalent(rawValue, parsedValue, field.type)) {
          mismatches.push({
            rowNumber: CONFIG.SHEETS.PORTFOY.FIRST_DATA_ROW + i,
            field: field.key,
            rawValue: rawValue,
            parsedValue: parsedValue
          });
        }
      });
    }

    console.log(`📊 Kontrol edilen satır: ${rowCount}`);
    console.log(`📊 Kontrol edilen alan/satır: ${compareFields.length}`);
    console.log(`❗ Toplam fark: ${mismatches.length}`);

    if (mismatches.length > 0) {
      console.log('🔎 İlk 20 fark:');
      mismatches.slice(0, 20).forEach((m, idx) => {
        console.log(`${idx + 1}. satır=${m.rowNumber} alan=${m.field} | ${_drSideBySideValue(m.rawValue, m.parsedValue)}`);
      });
    } else {
      console.log('✅ Ham veri ile parse edilen veri tutarlı görünüyor.');
    }

    const previewCount = Math.min(previewRows, rowCount);
    console.log('\n📌 HAM vs PARSED ÖNİZLEME (YAN YANA):');
    for (let i = 0; i < previewCount; i++) {
      const raw = rawRows[i];
      const parsed = parsedRows[i] || {};
      const rowNo = CONFIG.SHEETS.PORTFOY.FIRST_DATA_ROW + i;
      console.log(`\n   Satır ${rowNo}:`);
      compareFields.forEach(field => {
        const rawValue = _drNormalizeCompare(raw[field.col]);
        const parsedValue = _drNormalizeCompare(parsed[field.key]);
        console.log(`   - ${field.key}: ${_drSideBySideValue(rawValue, parsedValue)}`);
      });
    }

    return {
      success: mismatches.length === 0,
      checkedRows: rowCount,
      checkedFields: compareFields.length,
      mismatchCount: mismatches.length,
      mismatches: mismatches
    };

  } catch (error) {
    console.error('❌ TEST 1 hata:', error);
    return { success: false, error: error.message };
  } finally {
    console.log('='.repeat(90));
  }
}

/**
 * ✅ TEST 2: Cache'e basılan payload doğrulaması
 *
 * Amaç:
 * - Portföy/hisse/döviz/altın verisi cache'e gerçekten yazılıyor mu?
 * - Cache'teki ilk kayıt ile ilgili okuyucu fonksiyonunun ilk kaydı tutarlı mı?
 * - Cache zaman damgaları oluşuyor mu?
 */
function test_DataReader_CachePayloadIntegrity(options) {
  const opts = options || {};
  const forceRefresh = opts.forceRefresh !== false; // default true
  const includeAllRecords = opts.includeAllRecords === true;
  const recordLimit = opts.recordLimit || 10;
  const freshnessDays = opts.freshnessDays || 3;

  console.log('🧪 TEST 2 - CACHE PAYLOAD BÜTÜNLÜK KONTROLÜ');
  console.log('='.repeat(90));

  try {
    DataReader.clearCache();

    const portfolio = DataReader.readPortfolio(forceRefresh);
    const stocks = DataReader.readHistoricalStockPrices(forceRefresh);
    const currencies = DataReader.readHistoricalCurrencyPrices(forceRefresh);
    const golds = DataReader.readHistoricalGoldPrices(forceRefresh);

    const checks = [
      {
        label: 'portfolio',
        loaded: portfolio,
        cache: DataReader._cache.portfolio,
        lastFetch: DataReader._cache.lastFetchPortfolio
      },
      {
        label: 'historicalSTOCK',
        loaded: stocks,
        cache: DataReader._cache.historicalSTOCK,
        lastFetch: DataReader._cache.lastFetchSTOCK
      },
      {
        label: 'historicalCURRENCY',
        loaded: currencies,
        cache: DataReader._cache.historicalCURRENCY,
        lastFetch: DataReader._cache.lastFetchCURRENCY
      },
      {
        label: 'historicalGOLD',
        loaded: golds,
        cache: DataReader._cache.historicalGOLD,
        lastFetch: DataReader._cache.lastFetchGOLD
      }
    ];

    const issues = [];

    checks.forEach(item => {
      const loadedCount = Array.isArray(item.loaded) ? item.loaded.length : 0;
      const cacheCount = Array.isArray(item.cache) ? item.cache.length : 0;
      const hasTimestamp = item.lastFetch instanceof Date && !isNaN(item.lastFetch.getTime());

      console.log(`📦 ${item.label}: loaded=${loadedCount}, cache=${cacheCount}, timestamp=${hasTimestamp ? 'OK' : 'YOK'}`);

      if (loadedCount !== cacheCount) {
        issues.push(`${item.label}: loaded/cache count farklı (${loadedCount}/${cacheCount})`);
      }

      if (!hasTimestamp) {
        issues.push(`${item.label}: lastFetch timestamp yok`);
      }

      if (loadedCount > 0 && cacheCount > 0) {
        const loadedFirst = _drNormalizeCompare(JSON.stringify(item.loaded[0]));
        const cacheFirst = _drNormalizeCompare(JSON.stringify(item.cache[0]));
        if (loadedFirst !== cacheFirst) {
          issues.push(`${item.label}: ilk kayıt loaded/cache farklı`);
        }
      }
    });

    console.log(`\n❗ Toplam issue: ${issues.length}`);
    if (issues.length > 0) {
      issues.forEach((msg, idx) => console.log(`${idx + 1}. ${msg}`));
    } else {
      console.log('✅ Cache payload ve zaman damgaları tutarlı görünüyor.');
    }

    console.log('\n📌 DB\'DEN OKUNUP CACHE\'E YAZILAN KAYITLAR (YAN YANA):');
    checks.forEach(item => {
      const loadedRows = Array.isArray(item.loaded) ? item.loaded : [];
      const cacheRows = Array.isArray(item.cache) ? item.cache : [];
      const printCount = includeAllRecords
        ? Math.min(loadedRows.length, cacheRows.length)
        : Math.min(recordLimit, loadedRows.length, cacheRows.length);

      console.log(`\n   🔹 ${item.label} | yazdırılan kayıt: ${printCount}/${cacheRows.length}`);
      for (let i = 0; i < printCount; i++) {
        const loadedJson = JSON.stringify(loadedRows[i]);
        const cacheJson = JSON.stringify(cacheRows[i]);
        console.log(`   ${i + 1}. loaded=${loadedJson}`);
        console.log(`      cache =${cacheJson}`);
      }
    });

    console.log('\n📌 PORTFÖY KOLON DOLULUK KONTROLÜ (DB RAW ROW ÜZERİNDEN):');
    const portfolioCache = Array.isArray(DataReader._cache.portfolio) ? DataReader._cache.portfolio : [];
    const trackedColumns = [
      ['ID', CONFIG.COLUMNS.ID],
      ['TARIH', CONFIG.COLUMNS.TARIH],
      ['ISLEM_TURU', CONFIG.COLUMNS.ISLEM_TURU],
      ['BIRIMI', CONFIG.COLUMNS.BIRIMI],
      ['BIRIM_FIYAT', CONFIG.COLUMNS.BIRIM_FIYAT],
      ['BASLIK', CONFIG.COLUMNS.BASLIK],
      ['ADET', CONFIG.COLUMNS.ADET],
      ['KATEGORI', CONFIG.COLUMNS.KATEGORI],
      ['YATIRILAN_TUTAR', CONFIG.COLUMNS.YATIRILAN_TUTAR],
      ['GUNCEL_TUTAR', CONFIG.COLUMNS.GUNCEL_TUTAR],
      ['KAR_ZARAR_TUTAR', CONFIG.COLUMNS.KAR_ZARAR_TUTAR],
      ['VERI_KAYNAGI', CONFIG.COLUMNS.VERI_KAYNAGI]
    ];

    trackedColumns.forEach(([name, index]) => {
      const nonEmptyCount = _drCountNonEmptyRawColumn(portfolioCache, index);
      console.log(`   - ${name} (index=${index}): dolu=${nonEmptyCount}/${portfolioCache.length}`);
    });

    console.log('\n📌 DÖVİZ GÜNCELLİK KONTROLÜ (LATEST BY SYMBOL):');
    const latestUsd = _drFindLatestBySymbol(currencies, 'USDTRY=X');
    const latestEur = _drFindLatestBySymbol(currencies, 'EURTRY=X');
    const latestCurrencyAny = _drFindLatestRecord(currencies);

    const latestRows = [
      ['USDTRY=X', latestUsd],
      ['EURTRY=X', latestEur],
      ['ANY_CURRENCY_LATEST', latestCurrencyAny]
    ];

    const freshnessWarnings = [];
    latestRows.forEach(([label, row]) => {
      if (!row) {
        const warn = `⚠️ ${label}: kayıt bulunamadı`;
        freshnessWarnings.push(warn);
        console.warn(warn);
        return;
      }

      const ageDays = _drAgeInDays(row.date);
      const dateIso = row.date ? new Date(row.date).toISOString() : 'YOK';
      const price = row.close !== undefined ? row.close : row.price;
      console.log(`   - ${label}: date=${dateIso}, ageDays=${ageDays.toFixed(2)}, price=${price}`);

      if (ageDays > freshnessDays) {
        const warn = `⚠️ ${label} güncellik alarmı: ${ageDays.toFixed(2)} gün (eşik=${freshnessDays})`;
        freshnessWarnings.push(warn);
        console.warn(warn);
      }
    });

    return {
      success: issues.length === 0,
      issues: issues,
      freshnessWarnings: freshnessWarnings,
      snapshot: {
        portfolio: DataReader._cache.portfolio ? DataReader._cache.portfolio.length : 0,
        historicalSTOCK: DataReader._cache.historicalSTOCK ? DataReader._cache.historicalSTOCK.length : 0,
        historicalCURRENCY: DataReader._cache.historicalCURRENCY ? DataReader._cache.historicalCURRENCY.length : 0,
        historicalGOLD: DataReader._cache.historicalGOLD ? DataReader._cache.historicalGOLD.length : 0
      }
    };

  } catch (error) {
    console.error('❌ TEST 2 hata:', error);
    return { success: false, error: error.message };
  } finally {
    console.log('='.repeat(90));
  }
}
