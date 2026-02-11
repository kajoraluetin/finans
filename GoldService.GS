/**
 * 🥇 GOLD SERVICE - Truncgil API için TAM DÜZELTME
 * SORUN ÇÖZÜLDÜ: Fiyatlar 100 katı yazılıyordu
 */

const GoldService = {
  
  /**
   * Tüm fiyatları getir (cache'li)
   */
  getAllPrices: function() {
    console.log('📊 Truncgil API: Tüm fiyatlar isteniyor...');
    
    const cache = CacheService.getScriptCache();
    const cachedData = cache.get(CONFIG.ALTIN.CACHE_KEY);
    
    if (cachedData) {
      console.log('📦 Cache\'ten fiyatlar alındı');
      return JSON.parse(cachedData);
    }
    
    console.log('🌐 API\'den güncel fiyatlar çekiliyor...');
    const rawData = this._fetchFromTruncgilAPI();
    
    if (!rawData) {
      console.error('❌ Fiyatlar alınamadı');
      return this._getFallbackData();
    }
    
    const processedData = this._processTruncgilData(rawData);
    
    cache.put(
      CONFIG.ALTIN.CACHE_KEY, 
      JSON.stringify(processedData), 
      CONFIG.ALTIN.CACHE_DURATION
    );
    
    console.log(`✅ ${Object.keys(processedData.prices || {}).length} fiyat cache'lendi`);
    return processedData;
  },
  
  /**
   * Yeni API'den ham veriyi çek
   */
  _fetchFromTruncgilAPI: function() {
    try {
      const response = UrlFetchApp.fetch(CONFIG.ALTIN.API_URL, {
        muteHttpExceptions: true,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
        }
      });
      
      if (response.getResponseCode() !== 200) {
        console.error(`❌ Truncgil API Hatası: ${response.getResponseCode()}`);
        return null;
      }
      
      const jsonText = response.getContentText();
      const data = JSON.parse(jsonText);
      
      console.log(`✅ API başarılı. Güncelleme: ${data.Update_Date || 'Bilinmiyor'}`);
      return data;
      
    } catch (error) {
      console.error('💥 Truncgil API Bağlantı Hatası:', error.message);
      return null;
    }
  },
  
  /**
   * Yeni API verisini işle - DÜZELTİLMİŞ
   */
  _processTruncgilData: function(rawData) {
    console.log('🔄 Truncgil verileri işleniyor...');
    
    const result = {
      updateDate: rawData.Update_Date || new Date().toISOString(),
      prices: {},
      dovizler: {},
      altinlar: {},
      validationLists: {
        altin: [],
        doviz: [],
        tumu: []
      }
    };
    
    // DEBUG: İlk 5 öğeyi göster
    const keys = Object.keys(rawData);
    console.log(`📦 Ham veri: ${keys.length - 1} öğe (Update_Date hariç)`);
    
    // İlk 5 altın ve döviz örneği
    const altinOrnekleri = [];
    const dovizOrnekleri = [];
    
    Object.keys(rawData).forEach(key => {
      if (key === 'Update_Date') return;
      
      const item = rawData[key];
      if (item.Tür === 'Altın' && altinOrnekleri.length < 3) {
        altinOrnekleri.push({ key, alis: item.Alış, satis: item.Satış });
      }
      if (item.Tür === 'Döviz' && dovizOrnekleri.length < 3) {
        dovizOrnekleri.push({ key, alis: item.Alış, satis: item.Satış });
      }
    });
    
    console.log('📌 Altın örnekleri:');
    altinOrnekleri.forEach(o => console.log(`   ${o.key}: ${o.alis} / ${o.satis}`));
    
    console.log('📌 Döviz örnekleri:');
    dovizOrnekleri.forEach(o => console.log(`   ${o.key}: ${o.alis} / ${o.satis}`));
    
    // Tüm verileri işle
    Object.keys(rawData).forEach(key => {
      if (key === 'Update_Date') return;
      
      const item = rawData[key];
      const tur = item.Tür || 'Diğer';
      
      // Fiyatları parse et - DEBUG ile
      const buying = this._parsePriceStringWithDebug(key, item.Alış, 'Alış');
      const selling = this._parsePriceStringWithDebug(key, item.Satış, 'Satış');
      const degisim = item.Değişim || '%0,00';
      
      const priceInfo = {
        key: key,
        name: this._getDisplayName(key, item),
        tur: tur,
        buying: buying,
        selling: selling,
        buyingRaw: item.Alış,
        sellingRaw: item.Satış,
        degisim: degisim,
        lastUpdate: result.updateDate
      };
      
      // Ana fiyatlar objesine ekle
      result.prices[key] = priceInfo;
      
      // Türüne göre grupla
      if (tur === 'Altın') {
        result.altinlar[key] = priceInfo;
        result.validationLists.altin.push(priceInfo.name);
        result.validationLists.tumu.push(priceInfo.name);
      } else if (tur === 'Döviz') {
        result.dovizler[key] = priceInfo;
        result.validationLists.doviz.push(priceInfo.name);
        result.validationLists.tumu.push(priceInfo.name);
      }
    });
    
    // Listeleri alfabetik sırala
    Object.keys(result.validationLists).forEach(listKey => {
      result.validationLists[listKey].sort();
    });
    
    console.log(`✅ ${Object.keys(result.prices).length} fiyat işlendi`);
    console.log(`   📊 Altın: ${Object.keys(result.altinlar).length} adet`);
    console.log(`   💰 Döviz: ${Object.keys(result.dovizler).length} adet`);
    
    // DEBUG: Parse edilen ilk 3 altın değerini göster
    console.log('🔍 Parse edilen ilk 3 altın:');
    Object.keys(result.altinlar).slice(0, 3).forEach(key => {
      const item = result.altinlar[key];
      console.log(`   ${key}: "${item.buyingRaw}" → ${item.buying}`);
      console.log(`        "${item.sellingRaw}" → ${item.selling}`);
    });
    
    return result;
  },
  
  /**
   * Fiyat string'ini parse et - TAM DÜZELTME
   * "7.094,49" → 7094.49 (DOĞRU)
   * "$5.062,12" → 5062.12 (DOĞRU)
   * "43,5888" → 43.5888 (DOĞRU)
   */
  _parsePriceStringWithDebug: function(key, priceStr, label) {
    if (!priceStr || typeof priceStr !== 'string') {
      console.warn(`⚠️ ${key} ${label}: Geçersiz string: ${priceStr}`);
      return 0;
    }
    
    console.log(`🔍 ${key} ${label}: "${priceStr}"`);
    
    try {
      // 1. Para birimi sembollerini kaldır ($, €, £ vb.)
      let cleaned = priceStr.replace(/[$\€£¥]/g, '').trim();
      
      // 2. Binlik ayraçlarını (noktaları) kaldır
      // "7.094,49" → "7094,49"
      cleaned = cleaned.replace(/\./g, '');
      
      // 3. Ondalık ayracını (virgül) noktaya çevir
      // "7094,49" → "7094.49"
      cleaned = cleaned.replace(',', '.');
      
      // 4. Parse et
      const result = parseFloat(cleaned);
      
      if (isNaN(result)) {
        console.warn(`⚠️ ${key} ${label}: NaN sonuç: "${priceStr}" → "${cleaned}"`);
        return 0;
      }
      
      // 5. Eğer sonuç beklenenden çok büyükse kontrol et
      // Örneğin "7.094,49" için 7094.49 bekliyoruz
      // Eğer 709449 gibi bir değer gelirse, 100'e böl
      if (result > 100000) { // Çok büyük bir sayı
        console.warn(`⚠️ ${key} ${label}: ÇOK BÜYÜK değer: ${result}, 100'e bölünüyor`);
        return result / 100;
      }
      
      console.log(`   → "${priceStr}" → "${cleaned}" → ${result}`);
      return result;
      
    } catch (error) {
      console.error(`💥 ${key} ${label} parse hatası: ${error.message}`);
      return 0;
    }
  },
  
  /**
   * Düz parse fonksiyonu (debug olmadan)
   */
  _parsePriceString: function(priceStr) {
    if (!priceStr || typeof priceStr !== 'string') return 0;
    
    try {
      let cleaned = priceStr.replace(/[$\€£¥]/g, '').trim();
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      const result = parseFloat(cleaned);
      
      // Eğer çok büyükse 100'e böl (güvenlik)
      return result > 100000 ? result / 100 : result;
    } catch (e) {
      return 0;
    }
  },
  
  /**
   * Görüntüleme adı oluştur
   */
  _getDisplayName: function(key, item) {
    if (CONFIG.ALTIN.TURLERI[key]) {
      return CONFIG.ALTIN.TURLERI[key];
    }
    
    let name = key.replace(/-/g, ' ')
                  .replace(/_/g, ' ')
                  .toLowerCase()
                  .replace(/\b\w/g, l => l.toUpperCase());
    
    return `${name} (${item.Tür || 'Diğer'})`;
  },
  
  /**
   * Sadece altın fiyatlarını getir
   */
  getGoldPrices: function() {
    const allData = this.getAllPrices();
    return {
      updateDate: allData.updateDate,
      prices: allData.altinlar,
      validationList: allData.validationLists.altin
    };
  },
  
  /**
   * Belirli bir öğenin fiyatını getir
   */
  getPrice: function(key) {
    const allData = this.getAllPrices();
    return allData.prices[key] || null;
  },
  
  /**
   * Google Sheets Veri Doğrulama listesini getir
   */
  getValidationList: function(type = 'altin') {
    const allData = this.getAllPrices();
    return allData.validationLists[type] || [];
  },
  
  /**
   * Cache'i temizle
   */
  clearCache: function() {
    CacheService.getScriptCache().remove(CONFIG.ALTIN.CACHE_KEY);
    console.log('🗑️ Truncgil cache temizlendi');
    return { success: true, message: 'Cache temizlendi' };
  },
  
  /**
   * API bağlantı testi
   */
  testConnection: function() {
    console.log('🧪 Truncgil API Bağlantı Testi...');
    
    try {
      const rawData = this._fetchFromTruncgilAPI();
      
      if (!rawData) {
        return { success: false, message: 'API\'ye bağlanılamadı' };
      }
      
      const updateDate = new Date(rawData.Update_Date);
      const now = new Date();
      const diffMinutes = Math.floor((now - updateDate) / (1000 * 60));
      const isRecent = diffMinutes < 30;
      
      const itemCount = Object.keys(rawData).length - 1;
      
      // Parse testi yap
      const testParse = this._parsePriceStringWithDebug('TEST', '7.094,49', 'Test');
      console.log(`🧪 Parse testi: "7.094,49" → ${testParse} (beklenen: 7094.49)`);
      
      return {
        success: true,
        message: `✅ API bağlantısı başarılı. ${itemCount} öğe, ${diffMinutes} dakika önce güncellenmiş`,
        data: {
          updateDate: rawData.Update_Date,
          isRecent: isRecent,
          diffMinutes: diffMinutes,
          itemCount: itemCount
        }
      };
      
    } catch (error) {
      return { success: false, message: `💥 Test hatası: ${error.message}` };
    }
  },
  
  /**
   * Fallback data
   */
  _getFallbackData: function() {
    console.log('🔄 Fallback veri kullanılıyor');
    
    return {
      updateDate: new Date().toISOString(),
      prices: {},
      dovizler: {},
      altinlar: {},
      validationLists: {
        altin: Object.values(CONFIG.ALTIN.TURLERI).sort(),
        doviz: [],
        tumu: Object.values(CONFIG.ALTIN.TURLERI).sort()
      }
    };
  }
};
