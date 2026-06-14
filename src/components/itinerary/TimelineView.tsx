import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Image, TextInput, Platform, Alert } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../common/Card';
import { ItineraryDay, Activity } from '../../types/itinerary';
import i18n, { t } from '../../i18n';
import { Ionicons } from '@expo/vector-icons';
import { getRouteDistanceKm } from '../../utils/distance';
import { useResponsive } from '../../hooks/useResponsive';
import { findLocalizedName } from '../../data/destinations';

function getAirportData(regionName: string, locationName: string, activityTitle: string, isArrival: boolean, isEn: boolean) {
  const rName = (regionName || '').toLowerCase();
  const lName = (locationName || '').toLowerCase();
  const aTitle = (activityTitle || '').toLowerCase();
  const combined = `${rName} ${lName} ${aTitle}`;

  // 1. 主要機場資料庫
  const airportsDb = [
    {
      keys: ['narita', '成田', 'nrt'],
      flag: '🇯🇵',
      code: 'NRT',
      names: { tw: '東京成田國際機場', en: 'Narita International Airport' },
      arrival: {
        tw: '💡 抵達指引：下飛機後順著「Arrival (入境)」指標前進，至入境審查處辦理入境手續與提取行李。通關後，出口位於抵達大廳。若欲搭乘成田特快 (NEX) 或京成電鐵 (Keisei Skyliner)，請搭手扶梯下至 B1 層乘車。',
        en: '💡 Arrival Guide: Follow the "Arrival / Immigration" signs after deplaning to proceed to immigration and baggage claim. After exiting, take the Narita Express (NEX) or Keisei Skyliner from the B1 train station.'
      },
      departure: {
        tw: '💡 離境指引：接送專車或計程車將在出境大廳入口停靠。請依據您的航空公司前往對應的航廈與 Check-in 櫃檯辦理登機與行李託運。完成安檢與證照查驗後即可前往登機門。',
        en: '💡 Departure Guide: Taxis or airport transfers will drop you off at the departure floor entrance. Proceed to the check-in counters of your airline (Terminal 1/2/3). Security and passport control are located in the center.'
      }
    },
    {
      keys: ['haneda', '羽田', 'hnd'],
      flag: '🇯🇵',
      code: 'HND',
      names: { tw: '東京羽田國際機場', en: 'Haneda Airport' },
      arrival: {
        tw: '💡 抵達指引：下飛機後順著「Arrival (入境)」指標前進，至入境審查處辦理入境手續與提取行李。通關後，出口位於抵達大廳。若欲搭乘東京單軌電車 (Tokyo Monorail) 或京急線，請往聯絡通道前進搭乘。',
        en: '💡 Arrival Guide: Follow the "Arrival / Immigration" signs after deplaning to proceed to immigration and baggage claim. After exiting, take the Tokyo Monorail or Keikyu Line at the underground railway station.'
      },
      departure: {
        tw: '💡 離境指引：接送專車或計程車將在出境大廳入口停靠。請前往第三航廈 (或對應航廈) 的 Check-in 櫃檯辦理登機與行李託運。完成安檢與證照查驗後即可前往登機門。',
        en: '💡 Departure Guide: Taxis or airport transfers will drop you off at the departure floor entrance. Proceed to the check-in counters of your airline (usually Terminal 3). Security and passport control are located in the center.'
      }
    },
    {
      keys: ['kansai', '關西', 'kix'],
      flag: '🇯🇵',
      code: 'KIX',
      names: { tw: '大阪關西國際機場', en: 'Kansai International Airport' },
      arrival: {
        tw: '💡 抵達指引：下飛機後搭乘航廈接駁電車前往主航廈，辦理入境審查與行李提取。通關後，可前往關西機場車站搭乘 JR 關空特急 (Haruka) 或南海電鐵 (Nankai Railway) 前往大阪/京都。',
        en: '💡 Arrival Guide: Take the wing shuttle to the main terminal building after deplaning, proceed through immigration and baggage claim. After customs, head to Kansai-Airport Station to take JR Haruka or Nankai Railway.'
      },
      departure: {
        tw: '💡 離境指引：前往第一航廈（或第二航廈國際線）出境大廳。在航空公司櫃檯辦理登機與行李託運，隨後通過安全檢查與出境審查，前往登機門。',
        en: '💡 Departure Guide: Proceed to the international departure floor (Terminal 1 or 2). Check in and drop baggage at your airline counters. Pass through security and customs to reach your gate.'
      }
    },
    {
      keys: ['taoyuan', '桃園', 'tpe'],
      flag: '🇹🇼',
      code: 'TPE',
      names: { tw: '台灣桃園國際機場', en: 'Taoyuan International Airport' },
      arrival: {
        tw: '💡 抵達指引：下飛機後順著「Immigration (證照查驗)」指標前進，通關並提取行李。出關後即為抵達大廳。若欲搭乘桃園機場捷運，請依指標下樓前往捷運站乘車。',
        en: '💡 Arrival Guide: Follow the "Immigration" signs after deplaning, clear customs and retrieve your baggage. After exiting, proceed downstairs to take the Taoyuan Airport MRT.'
      },
      departure: {
        tw: '💡 離境指引：專車或計程車將在出境大廳入口停靠。進入航廈後請至對應的航空公司 Check-in 櫃檯辦理登機與行李託運。安檢與證照查驗位於出境大廳後方。',
        en: '💡 Departure Guide: Taxis or airport transfers will drop you off at the departure floor. Proceed to your airline check-in counters for check-in and baggage drop. Security and passport control are located at the back.'
      }
    },
    {
      keys: ['songshan', '松山', 'tsa'],
      flag: '🇹🇼',
      code: 'TSA',
      names: { tw: '台北松山機場', en: 'Taipei Songshan Airport' },
      arrival: {
        tw: '💡 抵達指引：通關並提取行李後即可步入抵達大廳。松山機場緊鄰台北市區，出站後可直接搭乘台北捷運文湖線（松山機場站），或在門口搭乘計程車。',
        en: '💡 Arrival Guide: Clear customs, retrieve baggage and exit to the arrival hall. Conveniently located inside Taipei, you can take Taipei Metro Wenhu Line (Songshan Airport Station) or catch a taxi at the gate.'
      },
      departure: {
        tw: '💡 離境指引：前往第一航廈（國際線）或第二航廈（國內線）辦理登機。完成行李託運後通過安檢與證照查驗即可。',
        en: '💡 Departure Guide: Proceed to Terminal 1 (International) or Terminal 2 (Domestic) for check-in. Complete baggage drop, then pass through security and passport control.'
      }
    },
    {
      keys: ['suvarnabhumi', '蘇凡納布', 'bkk'],
      flag: '🇹🇭',
      code: 'BKK',
      names: { tw: '曼谷蘇凡納布機場', en: 'Suvarnabhumi Airport' },
      arrival: {
        tw: '💡 抵達指引：下飛機後順著「Immigration (入境)」指標前進，至 Level 2 辦理入境與行李提取。提取行李後，出口位於 Level 2 大廳。若欲搭乘機場快線 (ARL)，請搭手扶梯下至 B1 層。',
        en: '💡 Arrival Guide: Follow the "Immigration" signs after deplaning to Level 2 for passport control and baggage claim. Exits are on Level 2. For Airport Rail Link (ARL), go down to B1.'
      },
      departure: {
        tw: '💡 離境指引：專車或 Grab 將在 Level 4 離境大廳入口停靠。進入航廈後請尋找對應航空公司的 Check-in 櫃檯辦理登機。安檢與證照查驗位於 Level 4 後方中央。',
        en: '💡 Departure Guide: Taxis or Grab will drop you off at the Level 4 departure gates. Check in at your airline counter. Security and passport control are at the rear of Level 4.'
      }
    },
    {
      keys: ['don mueang', '廊曼', 'dmk'],
      flag: '🇹🇭',
      code: 'DMK',
      names: { tw: '曼谷廊曼國際機場', en: 'Don Mueang International Airport' },
      arrival: {
        tw: '💡 抵達指引：下飛機後前往入境大廳，完成證照查驗並提取行李。若欲前往市區，可在航廈門口搭乘機場巴士 A1/A2，或前往 SRT 紅線火車站搭乘捷運。',
        en: '💡 Arrival Guide: Proceed to immigration and baggage claim after deplaning. To head to the city, take Airport Bus A1/A2 outside the terminal or walk to the SRT Red Line station.'
      },
      departure: {
        tw: '💡 離境指引：前往第一航廈（國際線）或第二航廈（國內線）出境大廳辦理登機。安檢後辦理出境審查即可。',
        en: '💡 Departure Guide: Go to Terminal 1 (International) or Terminal 2 (Domestic) check-in counters. After baggage drop, pass through security and immigration.'
      }
    },
    {
      keys: ['incheon', '仁川', 'icn'],
      flag: '🇰🇷',
      code: 'ICN',
      names: { tw: '首爾仁川國際機場', en: 'Incheon International Airport' },
      arrival: {
        tw: '💡 抵達指引：下飛機後若在登機廊，需搭乘接駁軌道電車至第一航廈，通過入境審查與提取行李。出關後可前往交通中心搭乘機場鐵路 (AREX) 直達首爾站。',
        en: '💡 Arrival Guide: If arriving at Concourse, take the shuttle train to Terminal 1, then proceed to immigration and baggage claim. Take the Airport Railroad (AREX) from the Transportation Center to Seoul Station.'
      },
      departure: {
        tw: '💡 離境指引：請至第一或第二航廈 3 樓出境大廳辦理航空公司登機與行李託運。通過安全檢查與海關手續後，即可前往登機門。',
        en: '💡 Departure Guide: Head to the 3rd-floor departure hall of Terminal 1 or 2. Complete check-in and baggage drop, then clear security and customs before heading to your gate.'
      }
    },
    {
      keys: ['gimpo', '金浦', 'gmp'],
      flag: '🇰🇷',
      code: 'GMP',
      names: { tw: '首爾金浦國際機場', en: 'Gimpo International Airport' },
      arrival: {
        tw: '💡 抵達指引：下飛機後前往入境大廳，完成證照查驗與行李提取。金浦機場距離首爾市區非常近，您可以直接搭乘地鐵 5 號線、9 號線或機場鐵道 (AREX) 前往市區。',
        en: '💡 Arrival Guide: Clear immigration and retrieve baggage. Gimpo Airport is very close to downtown Seoul; you can take subway line 5, line 9, or the AREX train directly to the city.'
      },
      departure: {
        tw: '💡 離境指引：前往國際線或國內線出境大廳。在航空公司櫃檯辦理登機與行李託運，隨後通過安全檢查與出境審查即可前往登機口。',
        en: '💡 Departure Guide: Go to the departure floor. Check in and drop baggage at your airline counters. Clear security and customs, then proceed to your gate.'
      }
    },
    {
      keys: ['changi', '樟宜', 'sin'],
      flag: '🇸🇬',
      code: 'SIN',
      names: { tw: '新加坡樟宜機場', en: 'Changi Airport' },
      arrival: {
        tw: '💡 抵達指引：通關與提取行李後，出口即為入境大廳。樟宜機場各航廈與星耀樟宜 (Jewel) 相連，可在此觀賞雨漩渦瀑布。若欲搭乘地鐵 (MRT)，可依指標前往 Terminal 2/3 地下地鐵站。',
        en: '💡 Arrival Guide: Pass through automated immigration, claim baggage, and exit. Explore Jewel Changi (famous rain vortex waterfall) connected to terminals. Walk to Terminal 2/3 basement to board the MRT.'
      },
      departure: {
        tw: '💡 離境指引：依航空前往第一至第四航廈，至出境大廳辦理自助或櫃檯登機與行李託運。樟宜機場的安檢通常設在各個登機門前，請預留充足時間。',
        en: '💡 Departure Guide: Go to the departure hall of Terminal 1-4. Check in at counters or self-service kiosks. Note that security checks at Changi are usually performed at individual boarding gates.'
      }
    },
    {
      keys: ['heathrow', '希斯洛', 'lhr'],
      flag: '🇬🇧',
      code: 'LHR',
      names: { tw: '倫敦希斯洛機場', en: 'Heathrow Airport' },
      arrival: {
        tw: '💡 抵達指引：遵循「Arrivals」指標前往入境大廳，完成英國邊境證照查驗（eGates）與行李提取。可搭乘希斯洛機場快線 (Heathrow Express) 或地鐵皮卡迪利線 (Piccadilly Line) 前往倫敦市區。',
        en: '💡 Arrival Guide: Follow "Arrivals" signs for passport control (UK border eGates) and baggage claim. Take the Heathrow Express or London Underground (Piccadilly Line) to central London.'
      },
      departure: {
        tw: '💡 離境指引：前往第二、三、四或五航廈出境大廳。辦理航空公司登機與行李託運後，通過安全檢查即可前往登機門。',
        en: '💡 Departure Guide: Head to the departure floor of Terminal 2, 3, 4, or 5. Complete airline check-in and bag drop, then proceed through security to your gate.'
      }
    },
    {
      keys: ['kennedy', 'jfk', '甘迺迪'],
      flag: '🇺🇸',
      code: 'JFK',
      names: { tw: '紐約甘迺迪國際機場', en: 'John F. Kennedy International Airport' },
      arrival: {
        tw: '💡 抵達指引：通過美國海關與邊境保護局（CBP）審查並提取行李。通關後，可搭乘機場輕軌 (AirTrain JFK) 連接至牙買加站 (Jamaica) 轉乘紐約地鐵或長島鐵路。',
        en: '💡 Arrival Guide: Clear US Customs (CBP) and retrieve your baggage. Take the AirTrain JFK to Jamaica Station or Howard Beach Station to transfer to the NYC Subway or LIRR.'
      },
      departure: {
        tw: '💡 離境指引：前往對應的航廈（JFK 有多個航廈，請務必確認）。在航空公司櫃檯辦理登機，隨後進行 TSA 安全檢查並前往登機口。',
        en: '💡 Departure Guide: Arrive at your specific terminal (JFK has multiple active terminals). Check in at your airline counter, pass through TSA security checkpoint and head to your gate.'
      }
    },
    {
      keys: ['charles de gaulle', 'roissy', '戴高樂', 'cdg'],
      flag: '🇫🇷',
      code: 'CDG',
      names: { tw: '巴黎戴高樂機場', en: 'Charles de Gaulle Airport' },
      arrival: {
        tw: '💡 抵達指引：跟隨「Sortie / Baggage」指標完成入境證照查驗與行李領取。可搭乘 RER B 線輕軌火車或 RoissyBus 機場巴士前往巴黎市中心。',
        en: '💡 Arrival Guide: Follow the "Sortie / Baggage" signs for passport control and baggage claim. You can take the RER B train or RoissyBus from the terminal station to central Paris.'
      },
      departure: {
        tw: '💡 離境指引：前往第一、二或三航廈的出境層辦理登機。完成行李託運後，通過邊境警察證照查驗與安全檢查。',
        en: '💡 Departure Guide: Head to the departure level of Terminal 1, 2, or 3. Check in and drop baggage, then proceed through border control and security screening.'
      }
    }
  ];

  // 2. 比對資料庫
  for (const ap of airportsDb) {
    if (ap.keys.some(k => combined.includes(k))) {
      return {
        code: ap.code,
        title: isEn
          ? `${ap.flag} ${ap.names.en} (${ap.code}) ${isArrival ? 'Arrival Guide' : 'Departure Guide'}`
          : `${ap.flag} ${ap.names.tw} (${ap.code}) ${isArrival ? '入境大廳指引' : '出境大廳指引'}`,
        description: isArrival
          ? (isEn ? ap.arrival.en : ap.arrival.tw)
          : (isEn ? ap.departure.en : ap.departure.tw)
      };
    }
  }

  // 3. 通用解析器 fallback
  // 3.1 嘗試從字串中擷取連續的 3 個大寫英文字母，當作機場三字代碼
  let matchedCode = 'APT';
  const codeRegex = /\b([a-z]{3})\b/i;
  const codesInString = combined.match(codeRegex);
  if (codesInString && codesInString[1]) {
    matchedCode = codesInString[1].toUpperCase();
  }

  // 3.2 判斷國旗
  let flag = '🌐';
  if (combined.includes('japan') || combined.includes('日本') || combined.includes('tokyo') || combined.includes('東京') || combined.includes('osaka') || combined.includes('大阪') || combined.includes('kyoto') || combined.includes('京都')) {
    flag = '🇯🇵';
  } else if (combined.includes('taiwan') || combined.includes('台灣') || combined.includes('taipei') || combined.includes('台北') || combined.includes('kaohsiung') || combined.includes('高雄')) {
    flag = '🇹🇼';
  } else if (combined.includes('thailand') || combined.includes('泰國') || combined.includes('bangkok') || combined.includes('曼谷')) {
    flag = '🇹🇭';
  } else if (combined.includes('korea') || combined.includes('韓國') || combined.includes('seoul') || combined.includes('首爾')) {
    flag = '🇰🇷';
  } else if (combined.includes('singapore') || combined.includes('新加坡')) {
    flag = '🇸🇬';
  } else if (combined.includes('uk') || combined.includes('united kingdom') || combined.includes('英國') || combined.includes('london') || combined.includes('倫敦')) {
    flag = '🇬🇧';
  } else if (combined.includes('usa') || combined.includes('america') || combined.includes('美國') || combined.includes('new york') || combined.includes('紐約')) {
    flag = '🇺🇸';
  } else if (combined.includes('france') || combined.includes('法國') || combined.includes('paris') || combined.includes('巴黎')) {
    flag = '🇫🇷';
  } else if (combined.includes('australia') || combined.includes('澳洲') || combined.includes('sydney') || combined.includes('雪梨')) {
    flag = '🇦🇺';
  } else if (combined.includes('vietnam') || combined.includes('越南')) {
    flag = '🇻🇳';
  } else if (combined.includes('hong kong') || combined.includes('香港')) {
    flag = '🇭🇰';
  } else if (combined.includes('malaysia') || combined.includes('馬來西亞') || combined.includes('kuala lumpur')) {
    flag = '🇲🇾';
  }

  // 3.3 產生機場美化名稱
  let aptTwName = '';
  let aptEnName = '';
  
  const nameToClean = activityTitle || locationName || regionName || '當地';
  const cleanName = nameToClean.replace(/(airport|international airport|機場|國際機場|的)/ig, '').trim();
  
  if (isEn) {
    aptEnName = `${cleanName} Airport`;
    aptTwName = `${cleanName}機場`;
  } else {
    aptTwName = `${cleanName}國際機場`;
    aptEnName = `${cleanName} International Airport`;
  }

  const arrivalGuide = {
    tw: `💡 抵達指引：下飛機後順著「Arrival (入境)」指標前進，至證照查驗處辦理入境審查與行李提取。通關後，出口即為抵達大廳。您可以選擇搭乘機場捷運、快捷巴士或計程車前往市區。`,
    en: `💡 Arrival Guide: Follow the "Arrival / Immigration" signs after deplaning to proceed to immigration and baggage claim. After exiting, take the airport express train, shuttle bus, or taxi to the city center.`
  };

  const departureGuide = {
    tw: `💡 離境指引：接送專車或計程車將在出境大廳入口停靠。進入航廈後，請至對應的航空公司 Check-in 櫃檯辦理登機與行李託運。完成安檢與證照查驗後，即可前往登機門。`,
    en: `💡 Departure Guide: Taxis or airport transfers will drop you off at the departure floor entrance. Proceed to the check-in counters of your airline for check-in and baggage drop. Security and passport control are located in the center.`
  };

  return {
    code: matchedCode,
    title: isEn
      ? `${flag} ${aptEnName} (${matchedCode}) ${isArrival ? 'Arrival Guide' : 'Departure Guide'}`
      : `${flag} ${aptTwName} (${matchedCode}) ${isArrival ? '入境大廳指引' : '出境大廳指引'}`,
    description: isArrival
      ? (isEn ? arrivalGuide.en : arrivalGuide.tw)
      : (isEn ? departureGuide.en : departureGuide.tw)
  };
}

function getRideHailingInfo(regionName: string, isEn: boolean) {
  const rName = (regionName || '').toLowerCase();
  
  if (rName.includes('東京') || rName.includes('日本') || rName.includes('tokyo') || rName.includes('japan') || rName.includes('成田') || rName.includes('羽田') || rName.includes('nrt') || rName.includes('hnd')) {
    return {
      platform1Name: isEn ? 'GO' : 'GO App',
      platform1Url: 'https://go.mo-t.com/',
      platform1Color: '#005CAF',
      platform2Name: isEn ? 'Uber' : 'Uber App',
      platform2Url: 'https://www.uber.com/jp/zh-tw/',
      platform2Color: '#1A1A1A',
      transitLabel: isEn ? 'GO / Uber' : 'GO / Uber',
    };
  } else if (rName.includes('台灣') || rName.includes('台北') || rName.includes('高雄') || rName.includes('taiwan') || rName.includes('taipei') || rName.includes('tpe')) {
    return {
      platform1Name: isEn ? 'yoxi' : 'yoxi App',
      platform1Url: 'https://www.yoxi.app/',
      platform1Color: '#FF3B30',
      platform2Name: isEn ? 'Uber' : 'Uber App',
      platform2Url: 'https://www.uber.com/tw/zh-tw/',
      platform2Color: '#1A1A1A',
      transitLabel: isEn ? 'yoxi / Uber' : 'yoxi / Uber',
    };
  } else if (rName.includes('泰國') || rName.includes('曼谷') || rName.includes('thailand') || rName.includes('bangkok') || rName.includes('bkk')) {
    return {
      platform1Name: isEn ? 'Grab' : 'Grab App',
      platform1Url: 'https://www.grab.com/',
      platform1Color: '#00B14F',
      platform2Name: isEn ? 'Bolt' : 'Bolt App',
      platform2Url: 'https://bolt.eu/',
      platform2Color: '#34D399',
      transitLabel: isEn ? 'Grab / Bolt' : 'Grab / Bolt',
    };
  } else {
    return {
      platform1Name: isEn ? 'Uber' : 'Uber App',
      platform1Url: 'https://www.uber.com/',
      platform1Color: '#1A1A1A',
      platform2Name: isEn ? 'Google Maps' : 'Google 地圖叫車',
      platform2Url: 'https://maps.google.com/',
      platform2Color: '#4285F4',
      transitLabel: isEn ? 'Uber / Taxi' : 'Uber / 計程車',
    };
  }
}

interface TimelineViewProps {
  day: ItineraryDay;
  onMoveActivity: (activityId: string, direction: 'up' | 'down') => void;
  onAddRecommendedActivity: (gapStartIndex: number) => void;
  onNavigate: (location: NonNullable<Activity['location']>, origin?: NonNullable<Activity['location']>) => void;
  onUpdateNote?: (activityId: string, note: string) => void;
  onEditActivity?: (activityId: string) => void;
  onReRollActivity?: (activityId: string) => void;
  onToggleRainFallback?: (dayNumber: number) => void;
}

const TRANSIT_LABELS: Record<string, {
  prefix: string;
  estLabel: string;
  minLabel: string;
  distLabel: string;
  walkRec: string;
  publicRec: string;
  taxiRec: string;
}> = {
  'zh-TW': {
    prefix: '交通指引：',
    estLabel: '預估時間',
    minLabel: '分鐘',
    distLabel: '距離約',
    walkRec: '前往下一站距離較近，建議步行前往',
    publicRec: '前往下一站大眾運輸便利，建議搭乘地鐵、公車或輕軌前往',
    taxiRec: '前往下一站大眾運輸不便，建議搭乘包車、計程車或使用 %{platforms} 叫車'
  },
  'zh-CN': {
    prefix: '交通指引：',
    estLabel: '预估时间',
    minLabel: '分钟',
    distLabel: '距离约',
    walkRec: '前往下一站距离较近，建议步行前往',
    publicRec: '前往下一站大众运输便利，建议搭乘地铁、公交或轻轨前往',
    taxiRec: '前往下一站大众运输不便，建议搭乘包车、出租车或使用 %{platforms} 叫车'
  },
  'ja': {
    prefix: '交通案内：',
    estLabel: '所要時間約',
    minLabel: '分',
    distLabel: '距離約',
    walkRec: '次の目的地まで近いため、徒歩での移動をお勧めします',
    publicRec: '次の目的地まで公共交通機関が便利です。地下鉄やバス、ライトレールの利用をお勧めします',
    taxiRec: '次の目的地まで公共交通機関が不便なため、チャーター車、タクシー、または %{platforms} での配車をお勧めします'
  },
  'ko': {
    prefix: '교통 안내: ',
    estLabel: '예상 시간',
    minLabel: '분',
    distLabel: '거리 약',
    walkRec: '다음 목적지까지 거리가 가까우므로 도보 이동을 권장합니다',
    publicRec: '다음 목적지까지 대중교통이 편리하므로 지하철, 버스 또는 경전철 이용을 권장합니다',
    taxiRec: '다음 목적지까지 대중교통이 불편하므로 전세차, 택시 또는 %{platforms} 호출을 권장합니다'
  },
  'es': {
    prefix: 'Guía de transporte: ',
    estLabel: 'tiempo estimado',
    minLabel: 'min',
    distLabel: 'distancia aprox.',
    walkRec: 'Se recomienda caminar hasta la siguiente parada',
    publicRec: 'El transporte público es conveniente, se recomienda metro/autobús',
    taxiRec: 'El transporte público es limitado, se recomienda alquiler/taxi/%{platforms}'
  },
  'ms': {
    prefix: 'Panduan Pengangkutan: ',
    estLabel: 'anggaran masa',
    minLabel: 'min',
    distLabel: 'jarak anggaran',
    walkRec: 'Berjalan kaki disyorkan ke perhentian seterusnya',
    publicRec: 'Pengangkutan awam adalah mudah, disyorkan metro/bas',
    taxiRec: 'Pengangkutan awam adalah terhad, disyorkan sewa/teksi/%{platforms}'
  },
  'pt': {
    prefix: 'Guia de transporte: ',
    estLabel: 'tempo estimado',
    minLabel: 'minutos',
    distLabel: 'distância aprox.',
    walkRec: 'Recomenda-se caminhar até a próxima paragem',
    publicRec: 'O transporte público é conveniente, recomenda-se metro/autocarro',
    taxiRec: 'O transporte público é limitado, recomenda-se aluguer/táxi/%{platforms}'
  },
  'th': {
    prefix: 'คำแนะนำการเดินทาง: ',
    estLabel: 'เวลาโดยประมาณ',
    minLabel: 'นาที',
    distLabel: 'ระยะทางประมาณ',
    walkRec: 'แนะนำให้เดินไปยังจุดหมายถัดไป',
    publicRec: 'การเดินทางด้วยขนส่งสาธารณะสะดวก แนะนำให้ขึ้นรถไฟใต้ดิน/รถประจำทาง',
    taxiRec: 'การเดินทางด้วยขนส่งสาธารณะไม่สะดวก แนะนำให้เช่ารถ, แท็กซี่ หรือเรียก %{platforms}'
  },
  'vi': {
    prefix: 'Hướng dẫn di chuyển: ',
    estLabel: 'thời gian ước tính',
    minLabel: 'phút',
    distLabel: 'khoảng cách khoảng',
    walkRec: 'Khuyến khích đi bộ đến điểm dừng tiếp theo',
    publicRec: 'Giao thông công cộng thuận tiện, khuyến nghị đi tàu điện ngầm/xe buýt',
    taxiRec: 'Giao thông công cộng hạn chế, khuyến nghị thuê xe/taxi/gọi %{platforms}'
  },
  'en': {
    prefix: 'Transport Guide: ',
    estLabel: 'estimated',
    minLabel: 'mins',
    distLabel: 'distance approx.',
    walkRec: 'Walk recommended to the next stop',
    publicRec: 'Public transit is convenient, metro/bus recommended',
    taxiRec: 'Public transit is limited, charter/taxi/%{platforms} recommended'
  }
};

const getDayOfWeek = (dateStr: string): number => {
  const d = new Date(dateStr);
  return d.getDay();
};

const isTimeConflict = (startTime: string, endTime: string, openingHours?: string): boolean => {
  if (!openingHours || openingHours === '24小時開放' || openingHours.includes('24小時') || openingHours.toLowerCase().includes('24 hours')) {
    return false;
  }
  const parseTime = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
  };
  const parts = openingHours.split('-');
  if (parts.length !== 2) return false;
  const openMin = parseTime(parts[0].trim());
  const closeMin = parseTime(parts[1].trim());
  const startMin = parseTime(startTime);
  const endMin = parseTime(endTime);
  if (closeMin < openMin) {
    return !(startMin >= openMin || startMin <= closeMin) || !(endMin >= openMin || endMin <= closeMin);
  }
  return startMin < openMin || endMin > closeMin;
};

const checkAttractionWarning = (act: any, dateStr: string, isEn: boolean): string[] => {
  const warnings: string[] = [];
  if (!act || (act.type !== 'activity' && act.type !== 'attraction')) return warnings;
  
  if (act.openingHours) {
    if (isTimeConflict(act.startTime, act.endTime, act.openingHours)) {
      warnings.push(isEn 
        ? `⚠️ Warning: Scheduled outside opening hours (${act.openingHours}).` 
        : `⚠️ 警示：此時間段景點已關閉（營業時間：${act.openingHours}）。`
      );
    }
  }

  const dayOfWeek = getDayOfWeek(dateStr); // 0 = Sun, 1 = Mon, etc.
  const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayNamesTw = ['日', '一', '二', '三', '四', '五', '六'];
  const currentDayName = dayNamesEn[dayOfWeek];

  if (act.closedDays && act.closedDays.length > 0) {
    if (act.closedDays.includes(currentDayName) || act.closedDays.some((d: string) => d.toLowerCase() === currentDayName.toLowerCase())) {
      warnings.push(isEn 
        ? `⚠️ Warning: Closed on ${currentDayName}s.` 
        : `⚠️ 警示：此景點在星期${dayNamesTw[dayOfWeek]} (${currentDayName}) 公休。`
      );
    }
  } else {
    // Default museum check if no explicit closedDays
    const titleLower = (act.title || '').toLowerCase();
    const typeLower = (act.type || '').toLowerCase();
    const isMuseum = titleLower.includes('博物館') || titleLower.includes('museum') || typeLower.includes('museum');
    if (dayOfWeek === 1 && isMuseum) {
      warnings.push(isEn 
        ? `⚠️ Attention: Museums are often closed on Mondays.` 
        : `⚠️ 注意：此時間段景點可能公休（部分博物館週一公休）。`
      );
    }
  }

  return warnings;
};

export function TimelineView({
  day,
  onMoveActivity,
  onAddRecommendedActivity,
  onNavigate,
  onUpdateNote,
  onEditActivity,
  onReRollActivity,
  onToggleRainFallback,
}: TimelineViewProps) {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const { isLargeScreen } = useResponsive();
  const locale = i18n.locale || 'zh-TW';
  const isEn = !locale.startsWith('zh');

  const renderVerticalTransitBadge = (transport: any, from?: any, to?: any) => {
    const tData = transport || { mode: 'drive', duration: 10 };
    const distKm = getRouteDistanceKm(tData, from, to);
    const distStr = distKm > 0 ? `${distKm.toFixed(1)} km` : '';
    
    let iconName: any = 'car-outline';
    let modeLabel = t('itinerary.timelineView.transport.mode.drive', { defaultValue: '乘車' });
    let themeColor = '#6366F1'; // Indigo for drive
    let bgColor = '#EEF2FF';
    
    if (tData.mode === 'walk') {
      iconName = 'walk-outline';
      modeLabel = t('itinerary.timelineView.transport.mode.walk', { defaultValue: '步行' });
      themeColor = '#10B981'; // Green for walk
      bgColor = '#ECFDF5';
    } else if (tData.mode === 'public') {
      iconName = 'bus-outline';
      modeLabel = t('itinerary.timelineView.transport.mode.public', { defaultValue: '大眾運輸' });
      themeColor = '#3B82F6'; // Blue for public
      bgColor = '#EFF6FF';
    } else if (tData.mode === 'taxi' || tData.mode === 'charter') {
      iconName = 'car-sport-outline';
      modeLabel = tData.mode === 'taxi' 
        ? t('itinerary.timelineView.transport.mode.taxi', { defaultValue: '計程車' })
        : t('itinerary.timelineView.transport.mode.charter', { defaultValue: '包車' });
      themeColor = '#F59E0B'; // Amber
      bgColor = '#FFFBEB';
    }

    return (
      <View style={[styles.verticalTransitBadge, { backgroundColor: bgColor, borderColor: themeColor + '30' }]}>
        <Ionicons name={iconName} size={13} color={themeColor} />
        <Text style={[styles.verticalTransitText, { color: themeColor }]}>
          {modeLabel} • {tData.duration || 10} {t('common.minutes', { defaultValue: '分鐘' })}{distStr ? ` • ${distStr}` : ''}
        </Text>
      </View>
    );
  };

  // Local state to track notes input before saving
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [expandedTerminalMap, setExpandedTerminalMap] = useState<Record<string, boolean>>({});
  const [expandedDesc, setExpandedDesc] = useState<Record<string, boolean>>({});

  const handleNoteChange = (id: string, text: string) => {
    setLocalNotes(prev => ({ ...prev, [id]: text }));
  };

  const handleNoteBlur = (id: string) => {
    if (onUpdateNote && localNotes[id] !== undefined) {
      onUpdateNote(id, localNotes[id]);
    }
  };

  const parseTimeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const getActivityTypeLabel = (type: string) => {
    switch (type) {
      case 'transport': return t('itinerary.timelineView.types.transport');
      case 'meal': return t('itinerary.timelineView.types.meal');
      case 'hotel': return t('itinerary.timelineView.types.hotel');
      case 'attraction': return t('itinerary.timelineView.types.attraction');
      default: return t('itinerary.timelineView.types.default');
    }
  };

  const renderActivityTitle = (act: Activity) => {
    const titleType = getActivityTypeLabel(act.type);
    
    let localName = act.localTitle || act.location?.name || act.title || '';
    let uiName = act.title || act.location?.name || act.localTitle || '';

    // Remove any pre-existing brackets in title names to prevent nesting brackets
    if (localName.includes('[') && localName.includes(']')) {
      localName = localName.split('[')[0].trim();
    }
    if (uiName.includes('[') && uiName.includes(']')) {
      uiName = uiName.split('[')[0].trim();
    }

    // Resolve via findLocalizedName to get the localized blogger-style title for the active UI locale
    const localized = findLocalizedName(uiName, act.location?.latitude || 0, act.location?.longitude || 0, locale);
    if (localized.title && localized.title !== uiName) {
      uiName = localized.title;
    }

    if (localName === uiName) {
      return `${titleType}：${localName}`;
    }
    
    return `${titleType}：${localName} [${uiName}]`;
  };

  const handleOpenUrl = async (url: string) => {
    try {
      // 處理各國叫車 App 服務的特例
      if (url.includes('grab.com')) {
        if (Platform.OS === 'web') {
          alert(t('itinerary.timelineView.alerts.grabWebHint'));
          window.open(url, '_blank');
          return;
        } else {
          const grabAppUrl = 'grab://';
          const canOpenApp = await Linking.canOpenURL(grabAppUrl);
          if (canOpenApp) {
            await Linking.openURL(grabAppUrl);
            return;
          }
        }
      }

      if (url.includes('bolt.eu')) {
         if (Platform.OS === 'web') {
          alert(t('itinerary.timelineView.alerts.boltWebHint'));
          window.open(url, '_blank');
          return;
        } else {
          const boltAppUrl = 'bolt://';
          const canOpenApp = await Linking.canOpenURL(boltAppUrl);
          if (canOpenApp) {
            await Linking.openURL(boltAppUrl);
            return;
          }
        }
      }

      if (url.includes('yoxi.app')) {
        if (Platform.OS === 'web') {
          alert('請使用手機開啟 yoxi App 進行叫車');
          window.open(url, '_blank');
          return;
        } else {
          const yoxiAppUrl = 'yoxi://';
          const canOpenApp = await Linking.canOpenURL(yoxiAppUrl);
          if (canOpenApp) {
            await Linking.openURL(yoxiAppUrl);
            return;
          }
        }
      }

      if (url.includes('go.mo-t.com')) {
        if (Platform.OS === 'web') {
          alert('請使用手機開啟 GO App 進行叫車');
          window.open(url, '_blank');
          return;
        } else {
          const goAppUrl = 'taxigo://';
          const canOpenApp = await Linking.canOpenURL(goAppUrl);
          if (canOpenApp) {
            await Linking.openURL(goAppUrl);
            return;
          }
        }
      }

      // 一般網頁
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          Alert.alert(t('itinerary.timelineView.alerts.cannotOpenTitle'), t('itinerary.timelineView.alerts.cannotOpenMessage'));
        }
      }
    } catch (e) {
      console.warn('Failed to open url', e);
      if (Platform.OS !== 'web') {
        Alert.alert(t('itinerary.timelineView.alerts.errorTitle'), t('itinerary.timelineView.alerts.errorMessage'));
      }
    }
  };

  const activities = day.activities || [];

  return (
    <View style={styles.container}>
      {day.weather && (
        <View style={[styles.weatherCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.weatherHeader}>
            <Ionicons name="cloudy-outline" size={20} color={colors.text} />
            <Text style={[typography.bodyMedium, { color: colors.text, fontWeight: '700', marginLeft: 8 }]}>
              {t('itinerary.timelineView.weather.title', { defaultValue: '今日氣候預測' })}
            </Text>
          </View>
          <View style={styles.weatherInfoRow}>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
              {day.weather.condition} • {day.weather.temperature}°{day.weather.temperatureUnit} • {t('itinerary.timelineView.weather.rainChance', { defaultValue: '降雨率' })} {day.weather.rainChance}%
            </Text>
          </View>
          {day.weather.rainChance >= 70 && onToggleRainFallback && (
            <View style={[styles.rainAlertBox, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
              <Ionicons name="rainy-outline" size={18} color="#DC2626" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[typography.labelSmall, { color: '#991B1B', fontWeight: '700' }]}>
                  {t('itinerary.timelineView.weather.rainWarning', { defaultValue: '偵測到今日降雨機率偏高！' })}
                </Text>
                <Text style={[typography.labelSmall, { color: '#B91C1C', marginTop: 2 }]}>
                  {t('itinerary.timelineView.weather.rainHint', { defaultValue: '建議一鍵切換雨天備案，自動將戶外景點對調為室內景點。' })}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.rainButton, { backgroundColor: '#EF4444' }]}
                onPress={() => onToggleRainFallback(day.dayNumber)}
              >
                <Text style={[typography.labelSmall, { color: '#FFFFFF', fontWeight: '700' }]}>
                  {t('itinerary.timelineView.weather.swapBtn', { defaultValue: '一鍵切換室內備案' })}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      {activities.map((act, index) => {
        const isFirst = index === 0;
        const isLast = index === activities.length - 1;
        const noteValue = localNotes[act.id] !== undefined ? localNotes[act.id] : (act.notes || '');

        let gapMinutes = 0;
        let showGapRecommendation = false;
        const nextAct = !isLast ? activities[index + 1] : null;
        const nextTransport = nextAct ? nextAct.transport : null;
        if (!isLast && nextAct) {
          const thisEnd = parseTimeToMinutes(act.endTime);
          const nextStart = parseTimeToMinutes(nextAct.startTime);
          gapMinutes = nextStart - thisEnd;
          if (gapMinutes >= 120) {
            showGapRecommendation = true;
          }
        }

        // Special render for the very last item returning to hotel/airport
        if (isLast) {
          const hailingInfo = getRideHailingInfo(day.region, isEn);
          return (
            <View key={act.id} style={styles.timelineRow}>
              <View style={styles.leftColumn}>
                <View style={[styles.timelineIconWrapper, { backgroundColor: '#F3E8FF', borderColor: '#9333EA' }]}>
                  <Ionicons name="moon" size={14} color="#9333EA" />
                </View>
              </View>

              <View style={[styles.rightColumn, { paddingBottom: 0 }]}>
                <View style={[styles.card, { borderColor: '#E9D5FF', backgroundColor: '#FAF5FF', borderRadius: borderRadius.md }]}>
                  <View style={styles.cardHeader}>
                    <Text style={[typography.bodyMedium, { color: '#7E22CE', fontWeight: '700' }]}>
                      {t('itinerary.timelineView.endOfDay.title')}
                    </Text>
                  </View>
                  
                  <View style={[styles.endContentBox, { borderColor: '#E9D5FF', backgroundColor: '#F5F3FF' }]}>
                    <Text style={[typography.labelSmall, { color: '#6B21A8', marginBottom: 6 }]}>
                      {t('itinerary.timelineView.endOfDay.transportAdvice', { platforms: hailingInfo.transitLabel })}
                    </Text>
                    <View style={[styles.transportGuideBox, { backgroundColor: '#FFFFFF', borderColor: '#DDD6FE' }]}>
                      <Text style={[typography.labelSmall, { color: '#581C87', fontWeight: '700', marginBottom: 4 }]}>
                        {t('itinerary.timelineView.endOfDay.shuttleGuideTitle')}
                      </Text>
                      <Text style={[typography.caption, { color: '#4C1D95' }]}>
                        {t('itinerary.timelineView.endOfDay.shuttleGuideDesc', { platforms: hailingInfo.transitLabel, hotelName: act.location?.name || t('itinerary.timelineView.endOfDay.yourHotel') })}
                      </Text>
                    </View>
                    <Text style={[typography.caption, { color: '#6B21A8', marginTop: 8 }]}>
                      {t('itinerary.timelineView.endOfDay.tonightStay', { hotelName: act.location?.name || t('itinerary.timelineView.endOfDay.yourHotel') })}
                    </Text>

                    {(() => {
                      const isArrival = day.dayNumber === 1;
                      const airportInfo = getAirportData(day.region, act.location?.name || '', act.title || '', isArrival, isEn);
                      const isAirport = act.photoUrl === 'local-asset://airport_map' || act.title.includes('機場') || act.title.toLowerCase().includes('airport');
                      
                      return (
                        <>
                          {isAirport && (
                            <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12 }}>
                              <TouchableOpacity
                                onPress={() => setExpandedTerminalMap(prev => ({ ...prev, [act.id]: !prev[act.id] }))}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 8,
                                  paddingVertical: 10,
                                  paddingHorizontal: 16,
                                  backgroundColor: colors.backgroundSecondary,
                                  borderColor: colors.border,
                                  borderWidth: 1,
                                  borderRadius: borderRadius.md,
                                }}
                              >
                                <Ionicons name="airplane-outline" size={16} color={colors.primary500} />
                                <Text style={[typography.labelMedium, { color: colors.primary500, fontWeight: '700' }]}>
                                  {expandedTerminalMap[act.id] 
                                    ? (isEn ? 'Hide Terminal Map ▴' : '收起航站大廳導覽圖 ▴') 
                                    : (isEn ? `🗺️ Show Terminal Map (${airportInfo.code}) ▾` : `🗺️ 展開航站大廳導覽圖 (${airportInfo.code} Airport) ▾`)}
                                </Text>
                              </TouchableOpacity>

                              {expandedTerminalMap[act.id] && (
                                <View style={{ marginTop: 10, backgroundColor: colors.backgroundSecondary, borderColor: colors.border, borderWidth: 1, borderRadius: borderRadius.md, padding: 12 }}>
                                  <Text style={[typography.labelSmall, { color: colors.text, fontWeight: '700', marginBottom: 8 }]}>
                                    {airportInfo.title}
                                  </Text>
                                  <View style={{ borderRadius: borderRadius.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF' }}>
                                    <Image 
                                      source={require('../../../assets/images/airport_terminal_map.png')} 
                                      style={{ width: '100%', height: 350, resizeMode: 'contain' }} 
                                    />
                                  </View>
                                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8, lineHeight: 18 }]}>
                                    {airportInfo.description}
                                  </Text>
                                </View>
                              )}
                            </View>
                          )}

                          <View style={styles.endBtnRow}>
                            <TouchableOpacity 
                              style={[styles.endBtn, { backgroundColor: hailingInfo.platform1Color }]}
                              onPress={() => handleOpenUrl(hailingInfo.platform1Url)}
                            >
                              <Ionicons name="car" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                              <Text style={[typography.labelMedium, { color: '#FFFFFF', fontWeight: '700' }]}>
                                {isEn ? `Open ${hailingInfo.platform1Name}` : `點此開啟 ${hailingInfo.platform1Name}`}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={[styles.endBtn, { backgroundColor: hailingInfo.platform2Color }]}
                              onPress={() => handleOpenUrl(hailingInfo.platform2Url)}
                            >
                              <Ionicons name="car-sport" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                              <Text style={[typography.labelMedium, { color: '#FFFFFF', fontWeight: '700' }]}>
                                {isEn ? `Open ${hailingInfo.platform2Name}` : `點此開啟 ${hailingInfo.platform2Name}`}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      );
                    })()}
                  </View>
                </View>
              </View>
            </View>
          );
        }

        // Standard flat card design
        return (
          <View key={act.id} style={styles.timelineRow}>
            {/* Left Timeline Line & Icon indicator */}
            <View style={styles.leftColumn}>
              <View style={[styles.timelineIconWrapper, { backgroundColor: '#E0F2FE', borderColor: '#0284C7' }]}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#0284C7' }} />
              </View>
              <View style={[styles.line, { backgroundColor: '#E2E8F0' }]} />
            </View>

            {/* Right Activity Card */}
            <View style={[styles.rightColumn, { paddingBottom: spacing.lg }]}>
              <View style={[styles.card, { borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', borderRadius: borderRadius.md }]}>
                <View style={isLargeScreen ? { flexDirection: 'row', gap: 16 } : null}>
                  
                  {/* Left Column: Info & Action Buttons */}
                  <View style={isLargeScreen ? { flex: 2 } : { width: '100%' }}>
                    {/* 1. Header (Time & Region) */}
                    <View style={styles.flatHeader}>
                      <Text style={[typography.labelMedium, { color: '#334155', fontWeight: '700' }]}>
                        {act.startTime}
                      </Text>
                      <Text style={[typography.caption, { color: '#64748B', marginLeft: 8 }]}>
                        {t('itinerary.timelineView.activity.region', { region: day.region || t('itinerary.timelineView.activity.thisRegion') })}
                      </Text>
                      <View style={{ flex: 1 }} />
                      {!!act.location && (
                        <TouchableOpacity onPress={() => onNavigate(act.location!, isFirst ? undefined : activities[index - 1]?.location)} style={{ padding: 4 }}>
                          <Ionicons name="open-outline" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Schedule Conflicts & Day-off Warning Banner */}
                    {(() => {
                      const warnings = checkAttractionWarning(act, day.date, isEn);
                      if (!warnings.length) return null;
                      return (
                        <View style={{
                          backgroundColor: colors.warning50,
                          borderColor: colors.warning200,
                          borderWidth: 1,
                          borderRadius: borderRadius.sm,
                          padding: 8,
                          marginTop: 8,
                          gap: 4
                        }}>
                          {warnings.map((w, idx) => (
                            <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                              <Text style={[typography.bodySmall, { color: colors.warning800, flex: 1, lineHeight: 16 }]}>
                                {w}
                              </Text>
                            </View>
                          ))}
                        </View>
                      );
                    })()}

                    <Text style={[typography.titleMedium, { color: '#0F172A', fontWeight: '800', marginTop: 8 }]}>
                      {renderActivityTitle(act)}
                    </Text>

                    {/* 景點長介紹（約300字）：可展開／收合，預設顯示前幾行 */}
                    {!!act.description && (
                      <View style={{ marginTop: 6 }}>
                        <Text
                          style={[typography.bodySmall, { color: '#475569', lineHeight: 20 }]}
                          numberOfLines={expandedDesc[act.id] ? undefined : 4}
                        >
                          {act.description}
                        </Text>
                        {act.description.length > 80 && (
                          <TouchableOpacity onPress={() => setExpandedDesc(prev => ({ ...prev, [act.id]: !prev[act.id] }))} style={{ marginTop: 4 }}>
                            <Text style={[typography.caption, { color: colors.primary500, fontWeight: '700' }]}>
                              {expandedDesc[act.id] ? '收起 ▴' : '展開更多 ▾'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {(() => {
                      const isArrival = day.dayNumber === 1;
                      const airportInfo = getAirportData(day.region, act.location?.name || '', act.title || '', isArrival, isEn);
                      const isAirport = act.photoUrl === 'local-asset://airport_map' || act.title.includes('機場') || act.title.toLowerCase().includes('airport');
                      
                      if (!isAirport) return null;
                      
                      return (
                        <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12 }}>
                          <TouchableOpacity
                            onPress={() => setExpandedTerminalMap(prev => ({ ...prev, [act.id]: !prev[act.id] }))}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 8,
                              paddingVertical: 10,
                              paddingHorizontal: 16,
                              backgroundColor: colors.backgroundSecondary,
                              borderColor: colors.border,
                              borderWidth: 1,
                              borderRadius: borderRadius.md,
                            }}
                          >
                            <Ionicons name="airplane-outline" size={16} color={colors.primary500} />
                            <Text style={[typography.labelMedium, { color: colors.primary500, fontWeight: '700' }]}>
                              {expandedTerminalMap[act.id] 
                                ? (isEn ? 'Hide Terminal Map ▴' : '收起航站大廳導覽圖 ▴') 
                                : (isEn ? `🗺️ Show Terminal Map (${airportInfo.code}) ▾` : `🗺️ 展開航站大廳導覽圖 (${airportInfo.code} Airport) ▾`)}
                            </Text>
                          </TouchableOpacity>

                          {expandedTerminalMap[act.id] && (
                            <View style={{ marginTop: 10, backgroundColor: colors.backgroundSecondary, borderColor: colors.border, borderWidth: 1, borderRadius: borderRadius.md, padding: 12 }}>
                              <Text style={[typography.labelSmall, { color: colors.text, fontWeight: '700', marginBottom: 8 }]}>
                                {airportInfo.title}
                              </Text>
                              <View style={{ borderRadius: borderRadius.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF' }}>
                                <Image 
                                  source={require('../../../assets/images/airport_terminal_map.png')} 
                                  style={{ width: '100%', height: 350, resizeMode: 'contain' }} 
                                />
                              </View>
                              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8, lineHeight: 18 }]}>
                                {airportInfo.description}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })()}

                    {/* 3. Transport Guideline */}
                    {!isLast && (() => {
                      const transitDuration = nextTransport && nextTransport.duration 
                        ? nextTransport.duration 
                        : Math.max(10, gapMinutes);
                      const transitDistance = nextTransport ? getRouteDistanceKm(nextTransport, act.location, nextAct?.location) : 0;
                      const transitDistStr = transitDistance > 0 ? `${transitDistance.toFixed(1)} km` : '';
                      const transitMode = nextTransport ? nextTransport.mode : 'drive';

                      let transitText = '';
                      let transitIconName: any = 'car';
                      let transitIconColor = '#DC2626';

                      const targetL = TRANSIT_LABELS[locale] || TRANSIT_LABELS['en'];
                      const prefix = targetL.prefix;
                      const estLabel = targetL.estLabel;
                      const minLabel = targetL.minLabel;
                      const distLabel = targetL.distLabel;

                      if (nextTransport && nextTransport.description) {
                        const separator = (locale.startsWith('zh') || locale === 'ja') ? '，' : ', ';
                        const endChar = (locale.startsWith('zh') || locale === 'ja') ? '。' : '.';
                        transitText = `${prefix}${nextTransport.description}${separator}${estLabel} ${transitDuration} ${minLabel}${endChar}`;
                        
                        if (transitMode === 'walk') {
                          transitIconName = 'walk';
                          transitIconColor = '#10B981';
                        } else if (transitMode === 'public') {
                          transitIconName = 'bus';
                          transitIconColor = '#3B82F6';
                        }
                      } else {
                        const distSeparator = (locale.startsWith('zh') || locale === 'ja') ? '，' : ', ';
                        const distPart = transitDistStr 
                          ? `${distSeparator}${distLabel} ${transitDistStr}` 
                          : '';

                        const hailingInfo = getRideHailingInfo(day.region, isEn);
                        const endChar = (locale.startsWith('zh') || locale === 'ja') ? '。' : '.';
                        const separator = (locale.startsWith('zh') || locale === 'ja') ? '，' : ', ';

                        if (transitMode === 'walk') {
                          transitIconName = 'walk';
                          transitIconColor = '#10B981';
                          transitText = `${prefix}${targetL.walkRec}${distPart}${separator}${estLabel} ${transitDuration} ${minLabel}${endChar}`;
                        } else if (transitMode === 'public') {
                          transitIconName = 'bus';
                          transitIconColor = '#3B82F6';
                          transitText = `${prefix}${targetL.publicRec}${distPart}${separator}${estLabel} ${transitDuration} ${minLabel}${endChar}`;
                        } else {
                          transitIconName = 'car';
                          transitIconColor = '#DC2626';
                          const taxiRecFilled = targetL.taxiRec.replace('%{platforms}', hailingInfo.transitLabel);
                          transitText = `${prefix}${taxiRecFilled}${distPart}${separator}${estLabel} ${transitDuration} ${minLabel}${endChar}`;
                        }
                      }

                      if (!transitText) return null;

                      return (
                        <View style={[styles.transitGuideRow, { marginTop: 12 }]}>
                          <Ionicons name={transitIconName} size={16} color={transitIconColor} />
                          <Text style={[typography.caption, { color: '#475569', marginLeft: 6, flex: 1 }]}>
                            {transitText}
                          </Text>
                        </View>
                      );
                    })()}

                    {/* 4. Action Buttons (Nav & Booking) */}
                    <View style={[styles.actionBtnRow, { marginTop: 16 }]}>
                      <TouchableOpacity 
                        style={[styles.actionBtn, { borderColor: '#10B981', backgroundColor: '#ECFDF5' }]}
                        onPress={() => onNavigate(act.location || { latitude: 0, longitude: 0, address: '', name: act.title }, isFirst ? undefined : activities[index - 1]?.location)}
                      >
                        <Ionicons name="navigate-circle-outline" size={16} color="#059669" style={{ marginRight: 4 }} />
                        <Text style={[typography.caption, { color: '#059669', fontWeight: '700' }]}>{t('itinerary.timelineView.activity.navigate')}</Text>
                      </TouchableOpacity>

                      {(act.bookingRecommended || ['attraction', 'activity'].includes(act.type)) && (
                        <>
                          <TouchableOpacity 
                            style={[styles.actionBtn, { borderColor: '#FF5B00', backgroundColor: '#FFF0E5' }]}
                            onPress={() => handleOpenUrl(`https://www.klook.com/zh-TW/search/result/?query=${encodeURIComponent(act.localTitle || act.title)}`)}
                          >
                            <Ionicons name="ticket" size={14} color="#FF5B00" style={{ marginRight: 4 }} />
                            <Text style={[typography.caption, { color: '#FF5B00', fontWeight: '700' }]}>Klook 找票券</Text>
                          </TouchableOpacity>

                          <TouchableOpacity 
                            style={[styles.actionBtn, { borderColor: '#26C2D6', backgroundColor: '#E0FAFD' }]}
                            onPress={() => handleOpenUrl(`https://www.kkday.com/zh-tw/product/productlist?word=${encodeURIComponent(act.localTitle || act.title)}`)}
                          >
                            <Ionicons name="ticket" size={14} color="#26C2D6" style={{ marginRight: 4 }} />
                            <Text style={[typography.caption, { color: '#26C2D6', fontWeight: '700' }]}>KKday 找體驗</Text>
                          </TouchableOpacity>
                        </>
                      )}

                      <TouchableOpacity 
                        style={[styles.actionBtn, { borderColor: '#DBEAFE', backgroundColor: '#EFF6FF' }]}
                        onPress={() => handleOpenUrl(`https://www.google.com/search?q=${encodeURIComponent((act.localTitle || act.title) + ' ' + (day.region || ''))}`)}
                      >
                        <Ionicons name="search-outline" size={14} color="#2563EB" style={{ marginRight: 4 }} />
                        <Text style={[typography.caption, { color: '#2563EB', fontWeight: '600' }]}>{t('itinerary.timelineView.activity.googleSearch', { defaultValue: 'Google 搜尋' })}</Text>
                      </TouchableOpacity>
                      
                      {act.links && act.links.map((link, idx) => (
                        <TouchableOpacity 
                          key={idx}
                          style={[styles.actionBtn, { borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' }]}
                          onPress={() => handleOpenUrl(link.url)}
                        >
                          <Ionicons name="link-outline" size={14} color="#3B82F6" style={{ marginRight: 4 }} />
                          <Text style={[typography.caption, { color: '#3B82F6', fontWeight: '600' }]} numberOfLines={1}>{link.label}</Text>
                        </TouchableOpacity>
                      ))}

                      {onEditActivity && (
                        <TouchableOpacity 
                          style={[styles.actionBtn, { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }]}
                          onPress={() => onEditActivity(act.id)}
                        >
                          <Ionicons name="pencil-outline" size={14} color="#64748B" style={{ marginRight: 4 }} />
                          <Text style={[typography.caption, { color: '#475569', fontWeight: '600' }]}>{t('common.edit')}</Text>
                        </TouchableOpacity>
                      )}

                      {onReRollActivity && !['hotel', 'transport'].includes(act.type) && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { borderColor: '#FDE047', backgroundColor: '#FEF9C3' }]}
                          onPress={() => onReRollActivity(act.id)}
                        >
                          <Ionicons name="dice-outline" size={14} color="#A16207" style={{ marginRight: 4 }} />
                          <Text style={[typography.caption, { color: '#A16207', fontWeight: '600' }]}>{t('itinerary.timelineView.activity.reroll', { defaultValue: '換一個' })}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Right Column: Notes block */}
                  <View style={isLargeScreen ? { flex: 1, borderLeftWidth: 1, borderLeftColor: colors.divider, paddingLeft: 16, justifyContent: 'center' } : null}>
                    {/* 5. Notes Input */}
                    <View style={[styles.notesContainer, isLargeScreen ? { borderTopWidth: 0, marginTop: 0, paddingTop: 0 } : { borderTopColor: '#F1F5F9' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isLargeScreen ? 6 : 0 }}>
                        <Ionicons name="create-outline" size={16} color="#94A3B8" />
                        <Text style={[typography.caption, { color: '#64748B', marginLeft: 4 }]}>{t('itinerary.timelineView.activity.notesLabel')}</Text>
                      </View>
                      <TextInput
                        style={[styles.noteInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.backgroundSecondary, marginLeft: isLargeScreen ? 0 : 8, width: '100%' }]}
                        placeholder={t('itinerary.timelineView.activity.notesPlaceholder')}
                        placeholderTextColor={colors.textTertiary}
                        value={noteValue}
                        onChangeText={(text) => handleNoteChange(act.id, text)}
                        onBlur={() => handleNoteBlur(act.id)}
                        multiline={isLargeScreen}
                        numberOfLines={isLargeScreen ? 3 : 1}
                      />
                    </View>
                  </View>

                </View>
              </View>

              {/* Transit indicator if next activity is coming */}
              {!showGapRecommendation && !isLast && (
                <View style={styles.verticalTransitContainer}>
                  <View style={[styles.transitVerticalLine, { backgroundColor: '#E2E8F0', height: 48 }]} />
                  {renderVerticalTransitBadge(activities[index + 1].transport, act.location, activities[index + 1].location)}
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  leftColumn: {
    width: 32,
    alignItems: 'center',
  },
  timelineIconWrapper: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    marginTop: 8,
  },
  line: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: -8, // connect to next
  },
  rightColumn: {
    flex: 1,
    paddingLeft: 12,
  },
  card: {
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  flatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transitGuideRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  actionBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  notesContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  noteInput: {
    flex: 1,
    minWidth: 200,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
    fontSize: 13,
  },
  shortTransitRow: {
    height: 24,
    justifyContent: 'center',
  },
  transitVerticalLine: {
    width: 2,
    height: 24,
    marginLeft: -29,
  },
  cardHeader: {
    marginBottom: 8,
  },
  endContentBox: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    marginTop: 8,
  },
  transportGuideBox: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    marginTop: 8,
  },
  endBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
  },
  verticalTransitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    position: 'relative',
    marginTop: 8,
    marginBottom: 8,
  },
  verticalTransitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 16,
    gap: 4,
  },
  verticalTransitText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  weatherCard: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
  },
  weatherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  weatherInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rainAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    marginTop: 8,
  },
  rainButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 8,
  },
});
