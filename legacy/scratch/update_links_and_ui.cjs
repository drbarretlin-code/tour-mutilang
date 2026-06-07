const fs = require('fs');
const path = require('path');

const appJsxPath = path.join(__dirname, '..', 'src', 'App.jsx');
let content = fs.readFileSync(appJsxPath, 'utf8');

// 1. 替換整個 initialTripData 與 HOTSPOT_CONFIGS
const tripDataStartToken = 'const initialTripData = {';
const hotspotEndToken = '  }\n];'; // matches the end of HOTSPOT_CONFIGS array

const startIdx = content.indexOf(tripDataStartToken);
const endIdx = content.indexOf(hotspotEndToken, startIdx);

if (startIdx === -1 || endIdx === -1) {
  console.error("Could not find initialTripData or HOTSPOT_CONFIGS in App.jsx");
  process.exit(1);
}

const replaceEndLimit = endIdx + hotspotEndToken.length;

const initialTripDataNew = `const initialTripData = {
  title: "B&B泰國家庭旅遊",
  dates: "2026/07/14 - 2026/07/20",
  pax: "4人 (家庭旅遊)",
  requirements: [
    "7/15 需在 One Bangkok (SDConference) 附近",
    "住宿房型：兩間單人床 (Twin Room) x 2間",
    "必去：羅勇素芭他水果園、Pa Dee 咖啡、Kliff 餐廳、Cross Pattaya",
    "飯店等級：3星級以上"
  ],
  days: [
    {
      day: 1,
      date: "7/14 (日)",
      title: "抵達曼谷、初探都會魅力",
      summary: "班機抵達曼谷，專車接送或搭乘快線至市區飯店。下午探索全新地標 One Bangkok。",
      region: "曼谷",
      hotelName: "Centre Point Hotel Terminal 21",
      hotelMapQuery: "Centre+Point+Hotel+Terminal+21",
      activities: [
        {
          id: "d1-1",
          time: "10:00",
          title: "抵達曼谷機場 (BKK / DMK)",
          type: "transport",
          region: "曼谷",
          desc: "辦理入境手續、領取行李。如未包車，可搭乘機場快線(ARL)至 Makkasan站 (A6)，轉乘 MRT 藍線至 Phetchaburi 站 (BL21) / Sukhumvit 站 (BL22)。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/yJbF15B7nrcx8u81A", icon: MapPin },
            { text: "景點介紹", url: "https://itravelblog.net/bangkok-suvarnabhumi-airport/", icon: Info },
            { text: "預訂接送", url: "https://www.klook.com/zh-TW/", icon: Car }
          ]
        },
        {
          id: "d1-2",
          time: "12:00",
          title: "辦理入住：Centre Point Hotel Terminal 21",
          type: "hotel",
          region: "曼谷",
          desc: "🚇 交通：位於 BTS 淺綠線 Asok 站 (E4) 與 MRT 藍線 Sukhumvit 站 (BL22) 交會處，出站步行1分鐘即達。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/GrandeCentrePointT21", icon: MapPin },
            { text: "景點介紹", url: "https://itravelblog.net/centre-point-hotel-terminal-21/", icon: Info },
            { text: "飯店訂房", url: "https://www.agoda.com/zh-tw/grande-centre-point-hotel-terminal-21/hotel/bangkok-th.html", icon: Hotel },
            { text: "機場至飯店路線", url: "https://www.google.com/maps/dir/Suvarnabhumi+Airport/Centre+Point+Hotel+Terminal+21/", icon: Navigation }
          ]
        },
        {
          id: "d1-3",
          time: "14:00",
          title: "午餐 & 逛街：One Bangkok (曼谷一號)",
          type: "shopping",
          region: "曼谷",
          desc: "🚇 交通：搭乘 MRT 藍線由 Sukhumvit 站 (BL22) 至 Lumphini 站 (BL25)，3號出口直達。曼谷全新奢華造鎮中心，先來熟悉環境並享用午餐。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/OneBangkokMap", icon: MapPin },
            { text: "景點介紹", url: "https://itravelblog.net/one-bangkok/", icon: Info },
            { text: "飯店至商場路線", url: "https://www.google.com/maps/dir/Centre+Point+Hotel+Terminal+21/One+Bangkok/", icon: Navigation }
          ]
        },
        {
          id: "d1-4",
          time: "18:00",
          title: "晚餐：Terminal 21 美食街 (Pier 21)",
          type: "food",
          region: "曼谷",
          desc: "🚇 交通：搭乘 MRT 藍線由 Lumphini 站 (BL25) 回 Sukhumvit 站 (BL22)。曼谷CP值最高的美食街，各種泰式小吃應有盡有。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/Terminal21Asok", icon: MapPin },
            { text: "景點介紹", url: "https://itravelblog.net/terminal-21-food-court/", icon: Info },
            { text: "食記參考", url: "https://www.viviyu.com/archives/26978", icon: ExternalLink }
          ]
        }
      ]
    },
    {
      day: 2,
      date: "7/15 (一)",
      title: "研討會日 & 昭披耶河畔風光",
      summary: "一位家庭成員參加快捷研討會，其他成員可前往 Iconsiam 與水門市場。晚上全家會合共進晚餐。",
      region: "曼谷",
      hotelName: "Centre Point Hotel Terminal 21",
      hotelMapQuery: "Centre+Point+Hotel+Terminal+21",
      activities: [
        {
          id: "d2-1",
          time: "09:00",
          title: "SDConference 研討會 (One Bangkok)",
          type: "info",
          region: "曼谷",
          desc: "🚇 交通：搭乘 MRT 藍線由 Sukhumvit 站 (BL22) 至 Lumphini 站 (BL25)。參加研討會。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/OneBangkokMap", icon: MapPin },
            { text: "景點介紹", url: "https://itravelblog.net/one-bangkok/", icon: Info },
            { text: "飯店至研討會路線", url: "https://www.google.com/maps/dir/Centre+Point+Hotel+Terminal+21/One+Bangkok/", icon: Navigation }
          ]
        },
        {
          id: "d2-2",
          time: "10:00",
          title: "家屬行程：水門市場 & Platinum Fashion Mall",
          type: "shopping",
          region: "曼谷",
          desc: "🚇 交通：搭乘 BTS 淺綠線 (Sukhumvit Line) 至 Chit Lom 站 (E1)，由 6 號出口經 R-Walk 空橋步行約 10 分鐘。泰國最大的服飾批發市場，室內有冷氣。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/PlatinumMall", icon: MapPin },
            { text: "景點介紹", url: "https://itravelblog.net/platinum-fashion-mall-bangkok/", icon: Info },
            { text: "飯店至水門市場路線", url: "https://www.google.com/maps/dir/Centre+Point+Hotel+Terminal+21/The+Platinum+Fashion+Mall/", icon: Navigation }
          ]
        },
        {
          id: "d2-3",
          time: "15:00",
          title: "家屬行程：ICONSIAM 暹羅天地",
          type: "shopping",
          region: "曼谷",
          desc: "🚇 交通：搭乘 BTS 淺綠線至 Siam 站 (CEN) 轉深綠線 (Silom Line) 至 Saphan Taksin 站 (S6)，由 2 號出口轉乘免費接駁船；或搭 BTS 金線至 Charoen Nakhon 站 (G2) 直達。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/IconsiamMap", icon: MapPin },
            { text: "景點介紹", url: "https://itravelblog.net/iconsiam/", icon: Info },
            { text: "水門至ICONSIAM路線", url: "https://www.google.com/maps/dir/The+Platinum+Fashion+Mall/ICONSIAM/", icon: Navigation }
          ]
        },
        {
          id: "d2-4",
          time: "18:30",
          title: "晚餐：昭披耶河遊船晚餐 / 高空酒吧",
          type: "food",
          region: "曼谷",
          desc: "全家會合。搭乘豪華遊船一邊享用 Buffet 一邊欣賞鄭王廟、大皇宮夜景。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/RiverCityMap", icon: MapPin },
            { text: "景點介紹", url: "https://itravelblog.net/chao-phraya-princess-cruise/", icon: Info },
            { text: "遊船預訂參考", url: "https://www.klook.com/", icon: ExternalLink }
          ]
        }
      ]
    },
    {
      day: 3,
      date: "7/16 (二)",
      title: "前往羅勇：鮮果饗宴與絕美花園",
      summary: "包車前往羅勇，完成您指定的願望清單！入住海景度假村。",
      region: "羅勇",
      hotelName: "Cross Pattaya Oceanphere",
      hotelMapQuery: "Cross+Pattaya+Oceanphere",
      activities: [
        {
          id: "d3-1",
          time: "09:00",
          title: "包車出發前往羅勇 (Rayong)",
          type: "transport",
          region: "曼谷-羅勇",
          desc: "🚗 交通：車程約 2.5 小時，今日皆為專車點對點接送，確保舒適度。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/SuphattraLand", icon: MapPin },
            { text: "景點介紹", url: "https://bkk.com.tw/suphattra-land/", icon: Info },
            { text: "曼谷至羅勇路線", url: "https://www.google.com/maps/dir/Centre+Point+Hotel+Terminal+21/Suphattra+Land/", icon: Navigation }
          ]
        },
        {
          id: "d3-2",
          time: "11:30",
          title: "指定景點：素芭他水果園 (Suphattra Land)",
          type: "camera",
          region: "羅勇",
          desc: "水果大餐吃到飽，現摘榴槤與山竹，非常適合家庭遊客！",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/SuphattraLand", icon: MapPin },
            { text: "景點介紹", url: "https://bkk.com.tw/suphattra-land/", icon: Info }
          ]
        },
        {
          id: "d3-3",
          time: "15:00",
          title: "指定景點：ร้านปาฎี Pa Dee 網美咖啡館",
          type: "coffee",
          region: "羅勇",
          desc: "絕美歐式鄉村風花園咖啡館，坐在花園裡享受悠閒的英式下午茶。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/PaDeeRayongMap", icon: MapPin },
            { text: "景點介紹", url: "https://tw.trip.com/travel-guide/attraction/rayong/pa-dee-55694248/", icon: Info },
            { text: "水果園至咖啡館路線", url: "https://www.google.com/maps/dir/Suphattra+Land/Pa+Dee+Rayong/", icon: Navigation }
          ]
        },
        {
          id: "d3-4",
          time: "17:00",
          title: "辦理入住：Cross Pattaya Oceanphere 飯店",
          type: "hotel",
          region: "芭達雅",
          desc: "入住指定的質感度假村，享受極致的放鬆與私人泳池時光。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/CrossPattayaMap", icon: MapPin },
            { text: "景點介紹", url: "https://itravelblog.net/cross-pattaya-oceanphere/", icon: Info },
            { text: "飯店訂房", url: "https://www.agoda.com/zh-tw/cross-pattaya-oceanphere_2/hotel/pattaya-th.html", icon: Hotel },
            { text: "咖啡館至飯店路線", url: "https://www.google.com/maps/dir/Pa+Dee+Rayong/Cross+Pattaya+Oceanphere/", icon: Navigation }
          ]
        }
      ]
    },
    {
      day: 4,
      date: "7/17 (三)",
      title: "芭達雅歡樂時光",
      summary: "享受飯店設施，前往主題樂園，傍晚在指定的 Kliff 懸崖餐廳看海吃晚餐。",
      region: "芭達雅",
      hotelName: "Cross Pattaya Oceanphere",
      hotelMapQuery: "Cross+Pattaya+Oceanphere",
      activities: [
        {
          id: "d4-1",
          time: "09:00",
          title: "飯店悠閒早餐 & 泳池時光",
          type: "hotel",
          region: "芭達雅",
          desc: "享受 Cross Pattaya 度假村設施與豐富早餐。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/CrossPattayaMap", icon: MapPin },
            { text: "景點介紹", url: "https://itravelblog.net/cross-pattaya-oceanphere/", icon: Info },
            { text: "飯店訂房", url: "https://www.agoda.com/zh-tw/cross-pattaya-oceanphere_2/hotel/pattaya-th.html", icon: Hotel }
          ]
        },
        {
          id: "d4-2",
          time: "11:00",
          title: "哥倫比亞電影主題樂園 Aquaverse",
          type: "camera",
          region: "芭達雅",
          desc: "🚗 交通：建議包車或使用 Grab 前往。全球首座哥倫比亞影業主題水上樂園，全家玩水消暑。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/AquaverseMap", icon: MapPin },
            { text: "景點介紹", url: "https://itravelblog.net/columbia-pictures-aquaverse/", icon: Info },
            { text: "飯店至樂園路線", url: "https://www.google.com/maps/dir/Cross+Pattaya+Oceanphere/Columbia+Pictures+Aquaverse/", icon: Navigation }
          ]
        },
        {
          id: "d4-3",
          time: "17:30",
          title: "晚餐：Kliff Beach Club 懸崖餐廳",
          type: "food",
          region: "芭達雅",
          desc: "指定朝聖景點！芭達雅人氣懸崖海景餐廳，遠眺海景與夕陽，享用精緻料理。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/KliffMap", icon: MapPin },
            { text: "景點介紹", url: "https://lyes.tw/kliff-beach-club/", icon: Info },
            { text: "樂園至餐廳路線", url: "https://www.google.com/maps/dir/Columbia+Pictures+Aquaverse/Kliff+Beach+Club+Pattaya/", icon: Navigation }
          ]
        }
      ]
    },
    {
      day: 5,
      date: "7/18 (四)",
      title: "動物世界探索、返回曼谷",
      summary: "離開海邊，前往賽福瑞野生動物園，傍晚回到曼谷市區。",
      region: "曼谷",
      hotelName: "Centre Point Hotel Terminal 21",
      hotelMapQuery: "Centre+Point+Hotel+Terminal+21",
      activities: [
        {
          id: "d5-1",
          time: "09:30",
          title: "包車前往 Safari World 賽福瑞動物園",
          type: "transport",
          region: "曼谷近郊",
          desc: "🚗 交通：包車北上返回曼谷近郊。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/SafariWorldMap", icon: MapPin },
            { text: "景點介紹", url: "https://itravelblog.net/safari-world/", icon: Info },
            { text: "飯店至動物園路線", url: "https://www.google.com/maps/dir/Cross+Pattaya+Oceanphere/Safari+World+Bangkok/", icon: Navigation }
          ]
        },
        {
          id: "d5-2",
          time: "11:00",
          title: "Safari World 野生動物園",
          type: "camera",
          region: "曼谷近郊",
          desc: "搭乘遊園車近距離觀賞野生動物，並觀賞各項精彩表演。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/SafariWorldMap", icon: MapPin },
            { text: "景點介紹", url: "https://itravelblog.net/safari-world/", icon: Info },
            { text: "預訂門票", url: "https://www.klook.com/zh-TW/activity/365-safari-world-bangkok/", icon: ExternalLink }
          ]
        },
        {
          id: "d5-3",
          time: "16:30",
          title: "返回曼谷市區辦理入住",
          type: "hotel",
          region: "曼谷",
          desc: "🚗 交通：專車接送回到曼谷市區飯店。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/GrandeCentrePointT21", icon: MapPin },
            { text: "景點介紹", url: "https://itravelblog.net/centre-point-hotel-terminal-21/", icon: Info },
            { text: "飯店訂房", url: "https://www.agoda.com/zh-tw/grande-centre-point-hotel-terminal-21/hotel/bangkok-th.html", icon: Hotel },
            { text: "動物園至飯店路線", url: "https://www.google.com/maps/dir/Safari+World+Bangkok/Centre+Point+Hotel+Terminal+21/", icon: Navigation }
          ]
        },
        {
          id: "d5-4",
          time: "18:30",
          title: "晚餐：Savoey 上味泰餐館",
          type: "food",
          region: "曼谷",
          desc: "🚇 交通：從飯店步行可達，或搭乘 BTS 淺綠線至 Asok (E4)。經典泰式海鮮餐廳，必點咖哩螃蟹。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/SavoeyMap", icon: MapPin },
            { text: "景點介紹", url: "https://itravelblog.net/savoey-seafood/", icon: Info },
            { text: "飯店至餐廳路線", url: "https://www.google.com/maps/dir/Centre+Point+Hotel+Terminal+21/Savoey+Terminal21/", icon: Navigation }
          ]
        }
      ]
    },
    {
      day: 6,
      date: "7/19 (五)",
      title: "雙市場體驗 & 伴手禮大採購",
      summary: "體驗美功鐵道市場與傳統水上風情，下午安排超市採買泰國必買零食與藥妝。",
      region: "曼谷",
      hotelName: "Centre Point Hotel Terminal 21",
      hotelMapQuery: "Centre+Point+Hotel+Terminal+21",
      activities: [
        {
          id: "d6-1",
          time: "08:00",
          title: "美功鐵道市場 & 丹能莎朵水上市場",
          type: "camera",
          region: "曼谷近郊",
          desc: "🚗 交通：建議包車或使用 Klook 一日遊。近距離觀賞火車穿梭於菜市場的奇景，並體驗手搖船水上交易。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/MaeklongMap", icon: MapPin },
            { text: "景點介紹", url: "https://itravelblog.net/maeklong-railway-market/", icon: Info }
          ]
        },
        {
          id: "d6-2",
          time: "15:00",
          title: "Big C / 7-11 伴手禮採購",
          type: "shopping",
          region: "曼谷",
          desc: "🚇 交通：搭乘 BTS 淺綠線 (Sukhumvit Line) 至 Chit Lom 站 (E1)，由 9 號出口經天橋步行約 5 分鐘。防谷必買伴手禮大採購。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/BigCMap", icon: MapPin },
            { text: "景點介紹", url: "https://itravelblog.net/big-c-supercenter/", icon: Info },
            { text: "水上市場至商場路線", url: "https://www.google.com/maps/dir/Damnoen+Saduak+Floating+Market/Big+C+Supercenter+Ratchadamri/", icon: Navigation }
          ]
        },
        {
          id: "d6-3",
          time: "18:30",
          title: "晚餐 & 泰式古法按摩 SPA",
          type: "info",
          region: "曼谷",
          desc: "🚇 交通：搭乘 BTS 淺綠線回 Asok 站 (E4)。慰勞這幾天的疲憊，安排 Let's Relax 進行按摩。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/LetsRelaxMap", icon: MapPin },
            { text: "景點介紹", url: "https://itravelblog.net/lets-relax-spa/", icon: Info },
            { text: "商場至按摩店路線", url: "https://www.google.com/maps/dir/Big+C+Supercenter+Ratchadamri/Lets+Relax+Spa+Terminal+21/", icon: Navigation }
          ]
        }
      ]
    },
    {
      day: 7,
      date: "7/20 (六)",
      title: "網美咖啡館、帶著回憶返家",
      summary: "把握最後時光，造訪曼谷人氣咖啡廳，準備搭機返台。",
      region: "曼谷",
      hotelName: "機場",
      hotelMapQuery: "Suvarnabhumi+Airport",
      activities: [
        {
          id: "d7-1",
          time: "10:00",
          title: "退房與行李寄放",
          type: "hotel",
          region: "曼谷",
          desc: "整理行囊，將行李寄放在飯店大廳。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/GrandeCentrePointT21", icon: MapPin },
            { text: "景點介紹", url: "https://itravelblog.net/centre-point-hotel-terminal-21/", icon: Info }
          ]
        },
        {
          id: "d7-2",
          time: "11:00",
          title: "FO SHO BRO 摩洛哥風咖啡館",
          type: "coffee",
          region: "曼谷",
          desc: "🚇 交通：搭乘 BTS 淺綠線 (Sukhumvit Line) 至 Udom Suk 站 (E12)，出站轉乘計程車/Grab 約 5-8 分鐘。人氣咖啡廳拍美照。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/FoShoBroMap", icon: MapPin },
            { text: "景點介紹", url: "https://mimihan.tw/fo-sho-bro/", icon: Info },
            { text: "飯店至咖啡廳路線", url: "https://www.google.com/maps/dir/Centre+Point+Hotel+Terminal+21/FO+SHO+BRO+Bangkok/", icon: Navigation }
          ]
        },
        {
          id: "d7-3",
          time: "16:00",
          title: "搭車前往機場",
          type: "transport",
          region: "曼谷",
          desc: "🚗 交通: 返回飯店領取行李，搭乘預約專車或 Grab 前往機場，最晚於起飛前 3 小時抵達。",
          links: [
            { text: "景點地圖", url: "https://maps.app.goo.gl/yJbF15B7nrcx8u81A", icon: MapPin },
            { text: "景點介紹", url: "https://itravelblog.net/bangkok-suvarnabhumi-airport/", icon: Info },
            { text: "咖啡廳至機場路線", url: "https://www.google.com/maps/dir/FO+SHO+BRO+Bangkok/Suvarnabhumi+Airport/", icon: Navigation }
          ]
        },
        {
          id: "d7-4",
          time: "23:59 前",
          title: "抵達台灣，旅途圓滿結束",
          type: "info",
          region: "台灣",
          desc: "帶著滿滿的回憶平安抵達溫暖的家。",
          links: [
            { text: "景點地圖", url: "https://www.google.com/maps/place/Taiwan+Taoyuan+International+Airport", icon: MapPin },
            { text: "景點介紹", url: "https://www.customs.gov.tw/", icon: Info }
          ]
        }
      ]
    }
  ],
  emergencyInfo: [
    { name: "泰國旅遊警察", number: "1155", desc: "24小時英語服務，旅遊糾紛首選" },
    { name: "泰國急救", number: "1669", desc: "緊急醫療救援" },
    { name: "泰國報警", number: "191", desc: "一般警察局" },
    { name: "台灣駐泰國代表處", number: "+66-81-8340919", desc: "護照遺失或重大意外" }
  ]
};

const HOTSPOT_CONFIGS = [
  {
    key: 'terminal21',
    keywords: ['Terminal 21', 'Terminal21', 'Pier 21'],
    name: 'Terminal 21',
    style: { left: '8%', top: '10%', width: '25%', height: '18%' },
    mapUrl: 'https://maps.app.goo.gl/Terminal21Asok',
    infoUrl: 'https://itravelblog.net/centre-point-hotel-terminal-21/'
  },
  {
    key: 'iconsiam',
    keywords: ['ICONSIAM', '暹羅天地'],
    name: 'ICONSIAM',
    style: { left: '34%', top: '15%', width: '20%', height: '18%' },
    mapUrl: 'https://maps.app.goo.gl/IconsiamMap',
    infoUrl: 'https://itravelblog.net/iconsiam/'
  },
  {
    key: 'floating_market',
    keywords: ['水上市場', '丹能莎朵'],
    name: '丹能莎朵水上市場',
    style: { left: '5%', top: '28%', width: '25%', height: '18%' },
    mapUrl: 'https://maps.app.goo.gl/DamnoenMap',
    infoUrl: 'https://itravelblog.net/damnoen-saduak-floating-market/'
  },
  {
    key: 'railway_market',
    keywords: ['鐵道市場', '美功'],
    name: '美功鐵道市場',
    style: { left: '5%', top: '48%', width: '25%', height: '18%' },
    mapUrl: 'https://maps.app.goo.gl/MaeklongMap',
    infoUrl: 'https://itravelblog.net/maeklong-railway-market/'
  },
  {
    key: 'cross_pattaya',
    keywords: ['Cross Pattaya', 'CrossPattaya'],
    name: 'Cross Pattaya',
    style: { left: '42%', top: '38%', width: '18%', height: '18%' },
    mapUrl: 'https://maps.app.goo.gl/CrossPattayaMap',
    infoUrl: 'https://itravelblog.net/cross-pattaya-oceanphere/'
  },
  {
    key: 'kliff',
    keywords: ['Kliff'],
    name: 'Kliff 懸崖餐廳',
    style: { left: '60%', top: '45%', width: '15%', height: '16%' },
    mapUrl: 'https://maps.app.goo.gl/KliffMap',
    infoUrl: 'https://lyes.tw/kliff-beach-club/'
  },
  {
    key: 'suphattra',
    keywords: ['素芭他', '水果園', 'Suphattra'],
    name: '素芭他水果園',
    style: { left: '54%', top: '70%', width: '20%', height: '16%' },
    mapUrl: 'https://maps.app.goo.gl/SuphattraLand',
    infoUrl: 'https://bkk.com.tw/suphattra-land/'
  },
  {
    key: 'padee',
    keywords: ['Pa Dee', 'ร้านปาฎี'],
    name: 'Pa Dee 咖啡館',
    style: { left: '77%', top: '76%', width: '18%', height: '16%' },
    mapUrl: 'https://maps.app.goo.gl/PaDeeRayongMap',
    infoUrl: 'https://tw.trip.com/travel-guide/attraction/rayong/pa-dee-55694248/'
  },
  {
    key: 'one_bangkok',
    keywords: ['One Bangkok', 'SDConference', '曼谷一號'],
    name: 'One Bangkok',
    style: { left: '22%', top: '10%', width: '10%', height: '10%' },
    mapUrl: 'https://maps.app.goo.gl/OneBangkokMap',
    infoUrl: 'https://itravelblog.net/one-bangkok/'
  },
  {
    key: 'safari_world',
    keywords: ['Safari World', '野生動物園', '賽福瑞'],
    name: 'Safari World 賽福瑞動物園',
    style: { left: '20%', top: '2%', width: '15%', height: '10%' },
    mapUrl: 'https://maps.app.goo.gl/SafariWorldMap',
    infoUrl: 'https://itravelblog.net/safari-world/'
  },
  {
    key: 'water_market',
    keywords: ['水門市場', 'Platinum'],
    name: '水門市場',
    style: { left: '12%', top: '20%', width: '10%', height: '8%' },
    mapUrl: 'https://maps.app.goo.gl/PlatinumMall',
    infoUrl: 'https://itravelblog.net/platinum-fashion-mall-bangkok/'
  },
  {
    key: 'savoey',
    keywords: ['Savoey', '上味泰'],
    name: 'Savoey 上味泰餐館',
    style: { left: '5%', top: '2%', width: '12%', height: '8%' },
    mapUrl: 'https://maps.app.goo.gl/SavoeyMap',
    infoUrl: 'https://itravelblog.net/savoey-seafood/'
  },
  {
    key: 'fosho_bro',
    keywords: ['FO SHO BRO', '摩洛哥風咖啡館'],
    name: 'FO SHO BRO 咖啡館',
    style: { left: '38%', top: '28%', width: '12%', height: '8%' },
    mapUrl: 'https://maps.app.goo.gl/FoShoBroMap',
    infoUrl: 'https://mimihan.tw/fo-sho-bro/'
  }
];`;

content = content.substring(0, startIdx) + initialTripDataNew + content.substring(replaceEndLimit);

// 2. 宣告 HOTEL_BOOKING_URLS 常數 (在 HOTSPOT_CONFIGS 下方)
const hotspotEndLimit = content.indexOf('const HOTSPOT_CONFIGS =') + initialTripDataNew.substring(initialTripDataNew.indexOf('const HOTSPOT_CONFIGS =')).length;
const hotelBookingUrlsDecl = `\n\nconst HOTEL_BOOKING_URLS = {
  "Centre Point Hotel Terminal 21": "https://www.agoda.com/zh-tw/grande-centre-point-hotel-terminal-21/hotel/bangkok-th.html",
  "Cross Pattaya Oceanphere": "https://www.agoda.com/zh-tw/cross-pattaya-oceanphere_2/hotel/pattaya-th.html",
  "Grande Centre Point Hotel Terminal 21": "https://www.agoda.com/zh-tw/grande-centre-point-hotel-terminal-21/hotel/bangkok-th.html"
};`;

content = content.substring(0, hotspotEndLimit) + hotelBookingUrlsDecl + content.substring(hotspotEndLimit);

// 3. 在 App 組件內部插入 handleResetToDefault 函數
const updateTripScheduleOld = `  const updateTripSchedule = (newScheduleOrFn) => {
    setTripSchedule(prev => {
      const next = typeof newScheduleOrFn === 'function' ? newScheduleOrFn(prev) : newScheduleOrFn;
      saveTripToCloud(next);
      return next;
    });
  };`;

const updateTripScheduleNew = `  const updateTripSchedule = (newScheduleOrFn) => {
    setTripSchedule(prev => {
      const next = typeof newScheduleOrFn === 'function' ? newScheduleOrFn(prev) : newScheduleOrFn;
      saveTripToCloud(next);
      return next;
    });
  };

  const handleResetToDefault = async () => {
    if (window.confirm("確定要將行程重置為預設行程嗎？這將覆蓋您所有的修改與自訂行程。")) {
      setSyncStatus('syncing');
      try {
        await saveTripToCloud(initialTripData);
        setTripSchedule(initialTripData);
        setSyncStatus('synced');
        alert("已成功重置為預設行程！");
      } catch (err) {
        console.error("重置失敗:", err);
        setSyncStatus('error');
      }
    }
  };`;

if (!content.includes(updateTripScheduleOld)) {
  console.error("Could not find updateTripScheduleOld in App.jsx");
  process.exit(1);
}
content = content.replace(updateTripScheduleOld, updateTripScheduleNew);

// 4. 更新同步狀態指示器，加上重置垃圾桶按鈕
const syncIndicatorOld = `<button 
                  onClick={fetchTripFromCloud}
                  title="從雲端重新載入資料"
                  className="p-0.5 ml-0.5 text-slate-400 hover:text-teal-600 hover:bg-slate-100 rounded transition"
                  disabled={syncStatus === 'loading' || syncStatus === 'syncing'}
                >
                  <RefreshCw className={\`w-2.5 h-2.5 sm:w-3 sm:h-3 \${syncStatus === 'loading' ? 'animate-spin' : ''}\`} />
                </button>`;

const syncIndicatorNew = `<button 
                  onClick={fetchTripFromCloud}
                  title="從雲端重新載入資料"
                  className="p-0.5 ml-0.5 text-slate-400 hover:text-teal-600 hover:bg-slate-100 rounded transition"
                  disabled={syncStatus === 'loading' || syncStatus === 'syncing'}
                >
                  <RefreshCw className={\`w-2.5 h-2.5 sm:w-3 sm:h-3 \${syncStatus === 'loading' ? 'animate-spin' : ''}\`} />
                </button>
                <button 
                  onClick={handleResetToDefault}
                  title="重置回預設行程"
                  className="p-0.5 ml-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                  disabled={syncStatus === 'loading' || syncStatus === 'syncing'}
                >
                  <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </button>`;

if (!content.includes(syncIndicatorOld)) {
  console.error("Could not find syncIndicatorOld in App.jsx");
  process.exit(1);
}
content = content.replace(syncIndicatorOld, syncIndicatorNew);

// 5. 替換 Hero 圖片背景、刪除 Sawasdee 標籤、刪除 4人 (家庭旅遊)
const heroSectionOld = `      {/* Hero 圖片區塊 */}
      {activeTab === 'overview' && (
        <div className="relative bg-teal-800 h-64 sm:h-80 w-full overflow-hidden">
          <img 
            src="https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&q=80&w=2000" 
            alt="Thailand" 
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white px-4 text-center">
            <span className="bg-teal-600/80 px-3 py-1 rounded-full text-sm font-semibold tracking-wider mb-4 shadow-sm">
              Sawasdee Krap / Ka
            </span>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-2 drop-shadow-md">
              {tripSchedule.title}
            </h1>
            <p className="text-lg sm:text-xl font-medium drop-shadow-sm flex items-center gap-2">
              <Calendar className="w-5 h-5" /> {tripSchedule.dates} | {tripSchedule.pax}
            </p>
          </div>
        </div>
      )}`;

const heroSectionNew = `      {/* Hero 圖片區塊 */}
      {activeTab === 'overview' && (
        <div className="relative bg-teal-800 h-64 sm:h-80 w-full overflow-hidden">
          <img 
            src="https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&q=80&w=2000" 
            alt="Thailand Golden Temple" 
            className="w-full h-full object-cover opacity-75"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white px-4 text-center bg-black/10">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-3 drop-shadow-lg">
              {tripSchedule.title}
            </h1>
            <p className="text-lg sm:text-xl font-medium drop-shadow-md flex items-center gap-2 bg-black/25 px-4 py-1.5 rounded-full backdrop-blur-sm">
              <Calendar className="w-5 h-5 text-teal-300" /> {tripSchedule.dates}
            </p>
          </div>
        </div>
      )}`;

if (!content.includes(heroSectionOld)) {
  console.error("Could not find heroSectionOld in App.jsx");
  process.exit(1);
}
content = content.replace(heroSectionOld, heroSectionNew);

// 6. 替換地圖熱區 Overlay 渲染邏輯，移除 overflow-hidden 並增加點擊圓點引導、StopPropagation 以及點擊連結功能
const overlayMarkerStart = '                    {!generateError && (';
const overlayMarkerEnd = '                          </>\n                    )'; // original close

const overlayIndex = content.indexOf('{/* 互動點擊區域 */}');
if (overlayIndex === -1) {
  console.error("Could not find 互動點擊區域 comment in App.jsx");
  process.exit(1);
}

const originalOverlayBlock = `                    {!generateError && (
                      <>
                        {/* 動態渲染行程中包含的景點熱區 */}
                        {HOTSPOT_CONFIGS.filter(cfg => isKeywordInItinerary(cfg.keywords)).map(cfg => (
                          <div 
                            key={cfg.key}
                            className="absolute group border-2 border-transparent hover:border-teal-400 hover:bg-teal-500/10 hover:shadow-[0_0_15px_rgba(20,184,166,0.3)] transition-all duration-300 rounded-xl"
                            style={cfg.style}
                          >
                            <div className="absolute hidden group-hover:flex flex-col gap-1.5 bg-teal-950/95 text-white p-2.5 rounded-lg shadow-xl -top-20 left-1/2 transform -translate-x-1/2 z-30 font-semibold border border-teal-500/50 backdrop-blur-sm min-w-[140px]">
                              <span className="text-xs border-b border-teal-800 pb-1 text-center font-bold">{cfg.name}</span>
                              <div className="flex gap-1.5 justify-center">
                                <a 
                                  href={cfg.mapUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="bg-teal-600 hover:bg-teal-500 text-[10px] px-2 py-1 rounded flex items-center gap-0.5 whitespace-nowrap transition"
                                >
                                  🗺️ 地圖
                                </a>
                                <a 
                                  href={cfg.infoUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="bg-indigo-600 hover:bg-indigo-500 text-[10px] px-2 py-1 rounded flex items-center gap-0.5 whitespace-nowrap transition"
                                >
                                  ℹ️ 介紹
                                </a>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* 動態渲染路線熱區 */}
                        {ROUTE_CONFIGS.filter(r => r.show).map(r => (
                          <div 
                            key={r.key}
                            className="absolute group border-2 border-transparent hover:border-amber-400 hover:bg-amber-500/10 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all duration-300 rounded-full"
                            style={r.style}
                          >
                            <div className="absolute hidden group-hover:flex flex-col gap-1.5 bg-amber-955/95 text-white p-2.5 rounded-lg shadow-xl -top-20 left-1/2 transform -translate-x-1/2 z-30 font-semibold border border-amber-500/50 backdrop-blur-sm min-w-[140px]">
                              <span className="text-xs border-b border-amber-800 pb-1 text-center font-bold">{r.name}</span>
                              <div className="flex gap-1.5 justify-center">
                                <a 
                                  href={r.navUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="bg-amber-600 hover:bg-amber-500 text-[10px] px-2 py-1 rounded flex items-center gap-0.5 whitespace-nowrap transition"
                                >
                                  🧭 導航
                                </a>
                                <a 
                                  href={r.infoUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="bg-indigo-600 hover:bg-indigo-500 text-[10px] px-2 py-1 rounded flex items-center gap-0.5 whitespace-nowrap transition"
                                >
                                  ℹ️ 介紹
                                </a>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )`;

const newOverlayBlock = `                    {!generateError && (
                      <>
                        {/* 動態渲染行程中包含的景點熱區 */}
                        {HOTSPOT_CONFIGS.filter(cfg => isKeywordInItinerary(cfg.keywords)).map(cfg => (
                          <div 
                            key={cfg.key}
                            onClick={() => window.open(cfg.infoUrl, '_blank', 'noopener,noreferrer')}
                            className="absolute group border border-teal-500/30 hover:border-teal-400 bg-teal-500/5 hover:bg-teal-500/20 hover:shadow-[0_0_15px_rgba(20,184,166,0.3)] transition-all duration-300 rounded-xl cursor-pointer flex items-center justify-center"
                            style={cfg.style}
                          >
                            {/* 點擊與視覺引導小圓點 */}
                            <span className="w-2.5 h-2.5 bg-teal-400 rounded-full animate-ping absolute opacity-70 group-hover:hidden" />
                            <span className="w-1.5 h-1.5 bg-teal-500 rounded-full absolute group-hover:hidden" />
                            
                            <div 
                              onClick={(e) => e.stopPropagation()}
                              className="absolute hidden group-hover:flex flex-col gap-1.5 bg-teal-950/95 text-white p-2.5 rounded-lg shadow-xl -top-20 left-1/2 transform -translate-x-1/2 z-30 font-semibold border border-teal-500/50 backdrop-blur-sm min-w-[140px]"
                            >
                              <span className="text-xs border-b border-teal-800 pb-1 text-center font-bold">{cfg.name}</span>
                              <div className="flex gap-1.5 justify-center">
                                <a 
                                  href={cfg.mapUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="bg-teal-600 hover:bg-teal-500 text-[10px] px-2 py-1 rounded flex items-center gap-0.5 whitespace-nowrap transition"
                                >
                                  🗺️ 地圖
                                </a>
                                <a 
                                  href={cfg.infoUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="bg-indigo-600 hover:bg-indigo-500 text-[10px] px-2 py-1 rounded flex items-center gap-0.5 whitespace-nowrap transition"
                                >
                                  ℹ️ 介紹
                                </a>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* 動態渲染路線熱區 */}
                        {ROUTE_CONFIGS.filter(r => r.show).map(r => (
                          <div 
                            key={r.key}
                            onClick={() => window.open(r.infoUrl, '_blank', 'noopener,noreferrer')}
                            className="absolute group border border-amber-500/30 hover:border-amber-400 bg-amber-500/5 hover:bg-amber-500/20 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all duration-300 rounded-full cursor-pointer flex items-center justify-center"
                            style={r.style}
                          >
                            {/* 點擊與視覺引導小圓點 */}
                            <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping absolute opacity-70 group-hover:hidden" />
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full absolute group-hover:hidden" />

                            <div 
                              onClick={(e) => e.stopPropagation()}
                              className="absolute hidden group-hover:flex flex-col gap-1.5 bg-amber-955/95 text-white p-2.5 rounded-lg shadow-xl -top-20 left-1/2 transform -translate-x-1/2 z-30 font-semibold border border-amber-500/50 backdrop-blur-sm min-w-[140px]"
                            >
                              <span className="text-xs border-b border-amber-800 pb-1 text-center font-bold">{r.name}</span>
                              <div className="flex gap-1.5 justify-center">
                                <a 
                                  href={r.navUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="bg-amber-600 hover:bg-amber-500 text-[10px] px-2 py-1 rounded flex items-center gap-0.5 whitespace-nowrap transition"
                                >
                                  🧭 導航
                                </a>
                                <a 
                                  href={r.infoUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="bg-indigo-600 hover:bg-indigo-500 text-[10px] px-2 py-1 rounded flex items-center gap-0.5 whitespace-nowrap transition"
                                >
                                  ℹ️ 介紹
                                </a>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )`;

if (!content.includes(originalOverlayBlock)) {
  console.error("Could not find originalOverlayBlock in App.jsx");
  process.exit(1);
}
content = content.replace(originalOverlayBlock, newOverlayBlock);

// 移除圖片容器的外層 overflow-hidden 避免 tooltip 被裁剪
const imgContainerOld = `<div className="relative w-full max-w-[500px] aspect-square overflow-hidden rounded-md shadow-inner bg-white">`;
const imgContainerNew = `<div className="relative w-full max-w-[500px] aspect-square rounded-md shadow-inner bg-white">`;

if (!content.includes(imgContainerOld)) {
  console.error("Could not find imgContainerOld in App.jsx");
  process.exit(1);
}
content = content.replace(imgContainerOld, imgContainerNew);

// 7. 更新每日住宿卡片，增加「點此線上訂房」按鈕
const returnHotelOld = `<a 
                        href={\`https://www.google.com/maps/dir/?api=1&destination=\${day.hotelMapQuery}\`} 
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition shadow-sm"
                      >
                        <Navigation className="w-4 h-4" /> 點此導航回飯店
                      </a>`;

const returnHotelNew = `<div className="flex flex-wrap gap-2">
                        <a 
                          href={\`https://www.google.com/maps/dir/?api=1&destination=\${day.hotelMapQuery}\`} 
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition shadow-sm"
                        >
                          <Navigation className="w-4 h-4" /> 點此導航回飯店
                        </a>
                        {HOTEL_BOOKING_URLS[day.hotelName] && (
                          <a 
                            href={HOTEL_BOOKING_URLS[day.hotelName]} 
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-pink-600 text-white text-sm font-medium rounded-lg hover:bg-pink-700 transition shadow-sm"
                          >
                            <Hotel className="w-4 h-4" /> 點此線上訂房
                          </a>
                        )}
                      </div>`;

if (!content.includes(returnHotelOld)) {
  console.error("Could not find returnHotelOld in App.jsx");
  process.exit(1);
}
content = content.replace(returnHotelOld, returnHotelNew);

fs.writeFileSync(appJsxPath, content, 'utf8');
console.log("App.jsx links and UI details updated successfully!");
