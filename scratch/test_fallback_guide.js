// 測試 getFallbackGuideInfo 函式防呆、語系與國家比對邏輯

// Mock i18n
const i18n = {
  locale: 'zh-TW'
};

function getFallbackGuideInfo(country) {
  const safeCountry = country || '泰國';
  const locale = i18n.locale || 'zh-TW';
  const isEn = !locale.startsWith('zh');

  const normalized = safeCountry.toLowerCase();
  
  const isJapan = normalized.includes('日') || normalized.includes('japan') || normalized.includes('tokyo') || normalized.includes('東京') || normalized.includes('大阪') || normalized.includes('京都');
  const isKorea = normalized.includes('韓') || normalized.includes('korea') || normalized.includes('seoul') || normalized.includes('首爾') || normalized.includes('釜山');
  const isThailand = normalized.includes('泰') || normalized.includes('thai') || normalized.includes('bangkok') || normalized.includes('曼谷') || normalized.includes('清邁') || normalized.includes('芭達雅');
  const isVietnam = normalized.includes('越') || normalized.includes('viet') || normalized.includes('hanoi') || normalized.includes('河內') || normalized.includes('胡志明');
  const isTaiwan = normalized.includes('台') || normalized.includes('臺') || normalized.includes('taiwan') || normalized.includes('taipei') || normalized.includes('台北');
  const isSingapore = normalized.includes('新') || normalized.includes('singapore') || normalized.includes('新加坡');

  if (isJapan) {
    return {
      currencyCode: "JPY",
      currencyName: isEn ? "Japanese Yen" : "日圓",
      emergencyContacts: [
        { title: isEn ? "Police" : "警察局 (報案)", subTitle: isEn ? "24-hour service" : "24小時免費服務", phone: "110" },
        { title: isEn ? "Ambulance/Fire" : "消防/救護車 (急救)", subTitle: isEn ? "24-hour service" : "24小時免費服務", phone: "119" },
        { title: isEn ? "Foreigner Hotline" : "外國人熱線 (諮詢)", subTitle: isEn ? "Tokyo English Help" : "東京都外籍諮詢", phone: "03-5320-7744" }
      ],
      usefulPhrases: [
        { local: "Konnichiwa", zh: isEn ? "Hello" : "你好", isHighlight: false },
        { local: "Arigatou gozaimasu", zh: isEn ? "Thank you" : "謝謝", isHighlight: false },
        { local: "Kore wa ikura desu ka?", zh: isEn ? "How much is this?" : "這多少錢？", isHighlight: true }
      ],
      guideItems: [
        { item: isEn ? "Ramen (1 Bowl)" : "拉麵一碗", priceRange: "800 - 1200 JPY" },
        { item: isEn ? "Convenience Store Rice Ball" : "便利商店飯糰", priceRange: "130 - 200 JPY" },
        { item: isEn ? "Subway 1-Day Pass" : "地鐵一日券", priceRange: "800 JPY" }
      ]
    };
  }

  if (isKorea) {
    return {
      currencyCode: "KRW",
      currencyName: isEn ? "South Korean Won" : "韓元",
      emergencyContacts: [
        { title: isEn ? "Police" : "警察局 (報案)", subTitle: isEn ? "24-hour service" : "24小時免費服務", phone: "112" },
        { title: isEn ? "Ambulance/Fire" : "消防/救護車 (急救)", subTitle: isEn ? "24-hour service" : "24小時免費服務", phone: "119" },
        { title: isEn ? "Tourist Guide" : "觀光諮詢熱線", subTitle: isEn ? "English/Chinese Support" : "多國語系觀光諮詢", phone: "1330" }
      ],
      usefulPhrases: [
        { local: "An-nyeong-ha-se-yo", zh: isEn ? "Hello" : "你好", isHighlight: false },
        { local: "Gam-sa-ham-ni-da", zh: isEn ? "Thank you" : "謝謝", isHighlight: false },
        { local: "I-geo-eol-ma-yeo-yo?", zh: isEn ? "How much is this?" : "這多少錢？", isHighlight: true }
      ],
      guideItems: [
        { item: isEn ? "Korean Fried Chicken" : "韓式炸雞", priceRange: "18000 - 22000 KRW" },
        { item: isEn ? "Street Food (Tteokbokki)" : "路邊攤辣炒年糕", priceRange: "3000 - 5000 KRW" },
        { item: isEn ? "Cafe Americano" : "咖啡店美式咖啡", priceRange: "4000 - 5000 KRW" }
      ]
    };
  }

  if (isTaiwan) {
    return {
      currencyCode: "TWD",
      currencyName: isEn ? "New Taiwan Dollar" : "新台幣",
      emergencyContacts: [
        { title: isEn ? "Police" : "警察局 (報案)", subTitle: isEn ? "24-hour service" : "24小時免費服務", phone: "110" },
        { title: isEn ? "Ambulance/Fire" : "消防/救護車 (急救)", subTitle: isEn ? "24-hour service" : "24小時免費服務", phone: "119" },
        { title: isEn ? "Tourist Hotline" : "觀光局旅遊熱線", subTitle: isEn ? "English/Chinese/Japanese" : "多國語系服務", phone: "0800-011-765" }
      ],
      usefulPhrases: [
        { local: "Ni hao", zh: isEn ? "Hello" : "你好", isHighlight: false },
        { local: "Xie xie", zh: isEn ? "Thank you" : "謝謝", isHighlight: false },
        { local: "Zhe ge duo shao qian?", zh: isEn ? "How much is this?" : "這多少錢？", isHighlight: true }
      ],
      guideItems: [
        { item: isEn ? "Bubble Milk Tea" : "珍珠奶茶", priceRange: "55 - 80 TWD" },
        { item: isEn ? "Beef Noodles" : "牛肉麵一碗", priceRange: "150 - 250 TWD" },
        { item: isEn ? "Taipei MRT 1-Day Pass" : "台北捷運一日票", priceRange: "150 TWD" }
      ]
    };
  }

  // Default Fallback is Thailand
  return {
    currencyCode: "THB",
    currencyName: isEn ? "Thai Baht" : "泰銖",
    emergencyContacts: [
      { title: isEn ? "Tourist Police" : "觀光警察", subTitle: isEn ? "English Support" : "中英文與24小時服務", phone: "1155" },
      { title: isEn ? "Police" : "報警與緊急求助", subTitle: isEn ? "24-hour service" : "24小時免費服務", phone: "191" },
      { title: isEn ? "Ambulance/Fire" : "救護車與火警", subTitle: isEn ? "24-hour service" : "24小時免費服務", phone: "199" }
    ],
    usefulPhrases: [
      { local: "Sawasdee krub/ka", zh: isEn ? "Hello" : "你好", isHighlight: false },
      { local: "Khob khun krub/ka", zh: isEn ? "Thank you" : "謝謝", isHighlight: false },
      { local: "Nee tao rai?", zh: isEn ? "How much is this?" : "這多少錢？", isHighlight: true }
    ],
    guideItems: [
      { item: isEn ? "Pad Thai" : "路邊攤泰式炒河粉", priceRange: "50 - 80 THB" },
      { item: isEn ? "Coconut (1 Pcs)" : "椰子水 (一粒)", priceRange: "40 - 60 THB" },
      { item: isEn ? "Thai Massage (1 Hour)" : "泰式古法按摩 (1小時)", priceRange: "250 - 400 THB" }
    ]
  };
}

// 測試案例 1：正常繁體中文與日本國家比對
i18n.locale = 'zh-TW';
const res1 = getFallbackGuideInfo('日本東京');
console.log("Case 1 (日本 - 繁中):");
console.log(`貨幣名稱: ${res1.currencyName} (預期: 日圓)`);
console.log(`緊急聯絡人[0]: ${res1.emergencyContacts[0].title} (預期: 警察局 (報案))`);
if (res1.currencyCode === 'JPY' && res1.currencyName === '日圓' && res1.emergencyContacts[0].title === '警察局 (報案)') {
  console.log("-> Case 1 通過\n");
} else {
  console.error("-> Case 1 失敗！\n");
}

// 測試案例 2：英文語系與韓國比對
i18n.locale = 'en-US';
const res2 = getFallbackGuideInfo('South Korea');
console.log("Case 2 (韓國 - 英文):");
console.log(`貨幣名稱: ${res2.currencyName} (預期: South Korean Won)`);
console.log(`緊急聯絡人[0]: ${res2.emergencyContacts[0].title} (預期: Police)`);
if (res2.currencyCode === 'KRW' && res2.currencyName === 'South Korean Won' && res2.emergencyContacts[0].title === 'Police') {
  console.log("-> Case 2 通過\n");
} else {
  console.error("-> Case 2 失敗！\n");
}

// 測試案例 3：防呆測試 (傳入 null/undefined)
i18n.locale = 'zh-TW';
const res3 = getFallbackGuideInfo(null);
console.log("Case 3 (防呆測試 - 傳入 null):");
console.log(`貨幣名稱: ${res3.currencyName} (預期: 泰銖)`);
if (res3.currencyCode === 'THB' && res3.currencyName === '泰銖') {
  console.log("-> Case 3 通過\n");
} else {
  console.error("-> Case 3 失敗！\n");
}
