import { Itinerary } from '../types/itinerary';
import { TripSurvey } from '../types/survey';

export const generateItineraryHtml = (itinerary: Itinerary, survey?: TripSurvey | null): string => {
  const { title, days } = itinerary;

  const start = survey?.dates?.startDate ? new Date(survey.dates.startDate) : (days[0]?.date ? new Date(days[0].date) : new Date());
  const end = survey?.dates?.endDate ? new Date(survey.dates.endDate) : (days[days.length - 1]?.date ? new Date(days[days.length - 1].date) : new Date(start.getTime() + 86400000 * 3));
  const dayCount = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  // 1. 行前準備卡片 (基於 survey 資料)
  let preparationCardHtml = '';
  if (survey) {
    const adults = survey.travelers?.adults || 2;
    const childrenCount = survey.travelers?.children?.length || 0;
    const infants = survey.travelers?.infants || 0;
    const seniors = survey.travelers?.seniors || 0;
    
    let travelersStr = `${adults} 位成人`;
    if (childrenCount > 0) travelersStr += `，${childrenCount} 位孩童`;
    if (infants > 0) travelersStr += `，${infants} 位嬰幼兒`;
    if (seniors > 0) travelersStr += `，${seniors} 位長輩`;

    const paceLabel = survey.pace === 'packed' ? '緊湊高效' : survey.pace === 'relaxed' ? '放鬆慢活' : '平衡適中';
    const budgetLabel = survey.budgetLevel === 'economy' ? '小資經濟' : survey.budgetLevel === 'moderate' ? '標準舒適' : survey.budgetLevel === 'luxury' ? '奢華尊榮' : '預算無上限';
    const notesStr = survey.notes ? survey.notes : '無特殊備註';

    const mustVisits = survey.mustVisitAttractions && survey.mustVisitAttractions.length > 0
      ? survey.mustVisitAttractions.map(item => `<li>${item.value}</li>`).join('')
      : '';

    preparationCardHtml = `
      <div class="prep-card">
        <h2 class="section-title">📋 旅程行前重點與旅客資訊</h2>
        <div class="prep-grid">
          <div class="prep-col">
            <p><strong>👥 旅客組成：</strong>${travelersStr}</p>
            <p><strong>🏃 每日步調：</strong>${paceLabel}</p>
          </div>
          <div class="prep-col">
            <p><strong>💰 預算等級：</strong>${budgetLabel}</p>
            <p><strong>📝 行前備註：</strong>${notesStr}</p>
          </div>
        </div>
        ${mustVisits ? `
        <div class="must-visit-section">
          <strong>🎯 必去願望清單：</strong>
          <ul>${mustVisits}</ul>
        </div>
        ` : ''}
      </div>
    `;
  }

  // 1b. 目的地氣候與穿搭建議
  let weatherGuideHtml = '';
  if (survey) {
    const mainDest = survey.destinations?.[0]?.name || '台北';
    const month = start.getMonth(); // 0-indexed
    const isEn = !survey.locale?.startsWith('zh');

    let seasonLabel = '';
    let weatherDesc = '';
    let clothingAdvice = '';

    const isThailand = /曼谷|芭達雅|芭提雅|羅勇|泰國|bangkok|pattaya|phuket|thailand/i.test(mainDest);
    const isJapan = /東京|大阪|京都|沖繩|北海道|日本|tokyo|osaka|kyoto|japan/i.test(mainDest);
    const isKorea = /首爾|釜山|韓國|seoul|busan|korea/i.test(mainDest);

    if (isThailand) {
      if (month >= 2 && month <= 4) { // Mar-May
        seasonLabel = isEn ? 'Hot Season' : '熱季 (夏季)';
        weatherDesc = isEn ? 'Very hot and dry, average temp 30-38°C.' : '氣候炎熱乾燥，平均氣溫介於 30-38°C 之間。';
        clothingAdvice = isEn ? 'Lightweight, breathable cotton clothes. Sunhat, sunglasses, and high-SPF sunscreen.' : '建議穿著輕便、透氣的棉質或麻質衣物。備妥遮陽帽、太陽眼鏡與高係數防曬乳。';
      } else if (month >= 5 && month <= 9) { // Jun-Oct
        seasonLabel = isEn ? 'Rainy Season' : '雨季';
        weatherDesc = isEn ? 'Humid with sudden heavy downpours, average temp 28-34°C.' : '氣候潮濕，常有午後短暫雷陣雨或強降雨，氣溫約 28-34°C。';
        clothingAdvice = isEn ? 'Short sleeves, shorts, and quick-dry apparel. Carry an umbrella and wear waterproof sandals.' : '穿著短袖、短褲及易乾衣物，出門務必攜帶折疊傘或雨衣，建議搭配防水涼鞋。';
      } else { // Nov-Feb
        seasonLabel = isEn ? 'Cool Season' : '涼季';
        weatherDesc = isEn ? 'Pleasant and dry, average temp 24-30°C. Best time to visit.' : '氣候溫和舒適且乾燥，白天氣溫約 24-30°C，夜晚清涼。為最佳旅遊季節。';
        clothingAdvice = isEn ? 'Summer wear for daytime. A light jacket is recommended for air-conditioned rooms or cool evenings.' : '白天穿著夏裝，但強烈建議攜帶薄外套，以因應強冷氣室內或夜晚的涼意。';
      }
    } else if (isJapan || isKorea) {
      if (month >= 2 && month <= 4) { // Spring (Mar-May)
        seasonLabel = isEn ? 'Spring (Cherry Blossoms)' : '春季 (櫻花季)';
        weatherDesc = isEn ? 'Warm days but cool evenings, average temp 10-18°C.' : '氣候溫和，但早晚溫差較大，平均氣溫約 10-18°C。';
        clothingAdvice = isEn ? 'Layered outfits: long-sleeve shirts, sweater, and a windbreaker or light coat.' : '建議採用洋蔥式穿法：長袖襯衫、針織衫/毛衣，搭配防風外套或春季大衣。';
      } else if (month >= 5 && month <= 7) { // Summer / Rainy (Jun-Aug)
        seasonLabel = isEn ? 'Summer (Festival Season)' : '夏季 (祭典季)';
        weatherDesc = isEn ? 'Hot and humid with rainy periods, average temp 26-33°C.' : '高溫潮濕，梅雨過後較為炎熱，平均氣溫約 26-33°C。';
        clothingAdvice = isEn ? 'Breathable t-shirts, shorts or skirts, sunglasses, and a sunhat. Keep an umbrella handy.' : '穿著透氣涼爽的 T-shirt、短褲或裙子，備妥防曬用品及折疊雨傘。';
      } else if (month >= 8 && month <= 10) { // Autumn (Sep-Nov)
        seasonLabel = isEn ? 'Autumn (Maple Foliage)' : '秋季 (楓葉季)';
        weatherDesc = isEn ? 'Cool and pleasant, beautiful maple leaves, average temp 12-20°C.' : '氣候清涼舒適，晴空萬里，平均氣溫約 12-20°C。';
        clothingAdvice = isEn ? 'Long sleeves, cardigan, light jacket or denim coat. A scarf might be useful in late autumn.' : '建議長袖、薄毛衣搭配夾克或牛仔大衣，深秋時段建議攜帶圍巾。';
      } else { // Winter (Dec-Feb)
        seasonLabel = isEn ? 'Winter (Snow Season)' : '冬季 (雪季)';
        weatherDesc = isEn ? 'Cold, dry, and snowy in northern parts, average temp -2-8°C.' : '寒冷乾燥，部分地區會雪，平均氣溫約 -2 至 8°C。';
        clothingAdvice = isEn ? 'Thermal innerwear, thick sweaters, heavy down jacket, gloves, wool hat, and boots.' : '發熱衣、厚毛衣、防寒羽絨大衣，並戴上毛帽、圍巾、手套，做好全方位防寒。';
      }
    } else {
      seasonLabel = isEn ? 'General Season' : '通用季節指引';
      weatherDesc = isEn ? 'Average seasonal climate conditions.' : '根據您出發的月份所規劃的當地氣候參考。';
      clothingAdvice = isEn ? 'Wear comfortable clothes matching local weather. Bring a light jacket.' : '請穿著合適且舒適的休閒衣物，建議隨身攜帶一件防風薄外套。';
    }

    weatherGuideHtml = `
      <div class="prep-card weather-card">
        <h2 class="section-title">☀️ 目的地氣候與穿搭建議 (${mainDest})</h2>
        <div class="prep-grid">
          <div class="prep-col">
            <p><strong>📅 出發月份：</strong>${month + 1} 月 (${seasonLabel})</p>
            <p><strong>🌡️ 氣候概況：</strong>${weatherDesc}</p>
          </div>
          <div class="prep-col">
            <p><strong>🧥 穿著建議：</strong>${clothingAdvice}</p>
          </div>
        </div>
      </div>
    `;
  }

  // 1c. 智慧打包行李確認單
  let packingListHtml = '';
  if (survey) {
    const isEn = !survey.locale?.startsWith('zh');

    const essentialItems = [
      isEn ? 'Local Currency Cash' : '當地外幣現金',
      isEn ? 'Passport (valid for 6 months)' : '護照正本 (效期大於6個月)',
      isEn ? 'Credit / Debit Cards' : '信用卡 / 提款卡',
      isEn ? 'Toothbrush & Toothpaste' : '個人盥洗用具 (牙刷/牙膏)',
      isEn ? 'Personal Medication / First Aid' : '常備藥品 / 急救包',
      isEn ? 'Sunscreen' : '防曬乳',
      isEn ? 'Sanitizer / Wet Wipes' : '乾洗手 / 濕紙巾'
    ];

    const clothingItems = [
      isEn ? `Underwear (${dayCount} sets)` : `內衣褲 (${dayCount} 套)`,
      isEn ? `Socks (${dayCount} pairs)` : `襪子 (${dayCount} 雙)`,
      isEn ? `Tops (${dayCount} shirts)` : `上衣 (${dayCount} 件)`,
      isEn ? `Pants / Shorts (${Math.ceil(dayCount / 2)} pairs)` : `褲子 / 短褲 (${Math.ceil(dayCount / 2)} 件)`,
      isEn ? 'Comfortable Walking Shoes' : '好走好穿的運動鞋',
      isEn ? 'Lightweight Jacket' : '防風外套 / 薄外套'
    ];

    const electronicItems = [
      isEn ? 'Mobile Phone & Charger' : '手機與充電頭 / 線材',
      isEn ? 'Power Bank' : '行動電源 (需置於隨身行李)',
      isEn ? 'Universal Travel Adapter' : '萬國轉接頭',
      isEn ? 'Headphones / Earbuds' : '耳機'
    ];

    if (survey.travelers?.children?.length && survey.travelers.children.length > 0) {
      essentialItems.push(isEn ? 'Kid Snacks & Toys' : '孩童零食與安撫玩具');
      essentialItems.push(isEn ? 'Kid Toiletries / Diapers' : '孩童專用盥洗用品 / 尿布');
    }

    if (survey.transportModes?.includes('rental')) {
      essentialItems.push(isEn ? 'International Driving Permit' : '國際駕照正本');
      electronicItems.push(isEn ? 'Car Phone Mount' : '車用手機架');
    }

    const interests = (survey.interests || []) as string[];
    if (interests.includes('water') || interests.includes('beach')) {
      clothingItems.push(isEn ? 'Swimsuit & Goggles' : '泳裝與泳鏡');
      clothingItems.push(isEn ? 'Sandals / Slippers' : '海灘拖鞋 / 涼鞋');
      essentialItems.push(isEn ? 'Waterproof Phone Pouch' : '手機防水袋');
    }

    if (interests.includes('nature') || interests.includes('adventure')) {
      essentialItems.push(isEn ? 'Insect Repellent' : '防蚊液 / 驅蚊貼片');
      clothingItems.push(isEn ? 'Hiking / Trail Shoes' : '防滑登山鞋 / 健行鞋');
      clothingItems.push(isEn ? 'Raincoat / Poncho' : '便攜型雨衣');
    }

    packingListHtml = `
      <div class="prep-card packing-card">
        <h2 class="section-title">🧳 智慧打包行李確認單 (紙本備查)</h2>
        <div class="packing-grid">
          <div class="packing-col">
            <span class="packing-sub">💳 證件與重要物品</span>
            <ul class="packing-list-items">
              ${essentialItems.map(item => `<li><input type="checkbox" style="margin-right:6px;" /> ${item}</li>`).join('')}
            </ul>
          </div>
          <div class="packing-col">
            <span class="packing-sub">👕 衣物與穿著</span>
            <ul class="packing-list-items">
              ${clothingItems.map(item => `<li><input type="checkbox" style="margin-right:6px;" /> ${item}</li>`).join('')}
            </ul>
          </div>
          <div class="packing-col">
            <span class="packing-sub">🔌 數位電子配件</span>
            <ul class="packing-list-items">
              ${electronicItems.map(item => `<li><input type="checkbox" style="margin-right:6px;" /> ${item}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  // 2. 匯率與緊急求助指南
  const financeEmergencyHtml = `
    <div class="prep-card emergency-card">
      <h2 class="section-title">🚨 緊急聯絡與求助指南</h2>
      <div class="prep-grid">
        <div class="prep-col">
          <p><strong>🚨 緊急聯絡專線：</strong></p>
          <ul class="emergency-list">
            <li><strong>旅遊警察/求助專線：</strong>1155 (泰國) / 110 (日本) / 112 (韓國)</li>
            <li><strong>急救與消防：</strong>1669 (泰國) / 119 (日本/韓國)</li>
            <li><strong>24 小時通用緊急救難：</strong>191 (泰國) / 112 (歐美)</li>
          </ul>
        </div>
        <div class="prep-col">
          <p><strong>💡 貼心提醒：</strong></p>
          <p>出發前請確保護照有 6 個月以上效期，並將機票、飯店確認單與旅遊保險單截圖保存於手機，以防離線時無法讀取。</p>
        </div>
      </div>
    </div>
  `;

  // 3. 每天日程與活動卡片 (包含外鏈 QR Code 與隨手筆記)
  let daysHtml = '';
  days.forEach((day) => {
    let activitiesHtml = '';
    (day.activities || []).forEach((act, index) => {
      // 外部連結與地圖 QR Code 生成
      let qrCodeSectionHtml = '';
      const actLinks = act.links || [];
      
      // 如果景點有經緯度，自動生成 Google 地圖導航連結，若無則生成搜尋連結
      const destQuery = act.location?.latitude && act.location?.longitude
        ? `${act.location.latitude},${act.location.longitude}`
        : encodeURIComponent(act.title);
      const googleMapUrl = `https://www.google.com/maps/search/?api=1&query=${destQuery}`;

      // 組合連結列表 (排除空值)
      const allLinks = [
        { label: '🗺️ 地圖導航', url: act.location?.mapUrl || googleMapUrl },
        ...actLinks.map(l => ({ label: `🔗 ${l.label}`, url: l.url }))
      ].filter(l => l.url && l.url.startsWith('http'));

      if (allLinks.length > 0) {
        qrCodeSectionHtml = `
          <div class="qrcode-section">
            ${allLinks.slice(0, 3).map(link => `
              <div class="qrcode-box">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(link.url)}" class="qrcode-img" alt="QR Code" />
                <span class="qrcode-label">${link.label}</span>
              </div>
            `).join('')}
          </div>
        `;
      }

      activitiesHtml += `
        <div class="activity-card">
          <div class="card-header">
            <span class="time">⏰ ${act.startTime} - ${act.endTime}</span>
            <span class="type-badge">${act.type.toUpperCase()}</span>
          </div>
          <h3 class="title">${act.title} ${act.localTitle ? `<span class="local-title">(${act.localTitle})</span>` : ''}</h3>
          
          <div class="meta-info">
            <span>⏱️ 停留: ${act.duration || 90} 分鐘</span>
            <span>💰 估計費用: ${act.cost && act.cost.amount > 0 ? `${act.cost.currency} ${act.cost.amount}` : '免費'}</span>
          </div>
          
          ${act.description ? `<p class="desc">${act.description}</p>` : ''}
          ${act.location?.address ? `<div class="address">📍 ${act.location.address}</div>` : ''}
          ${act.notes ? `<div class="notes-box">📝 <strong>隨手備註：</strong>${act.notes}</div>` : ''}
          
          ${qrCodeSectionHtml}
        </div>
      `;
    });

    daysHtml += `
      <div class="day-section">
        <h2 class="day-title">Day ${day.dayNumber} - ${day.title}</h2>
        <p class="day-summary">📍 主要區域：${day.region || '泰國'} ${day.summary ? `| ${day.summary}` : ''}</p>
        <div class="activities-container">
          ${activitiesHtml}
        </div>
      </div>
    `;
  });

  return `
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - 精美列印版行程表</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        
        * {
          box-sizing: border-box;
        }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #0F172A;
          line-height: 1.6;
          padding: 30px;
          margin: 0 auto;
          max-width: 900px;
          background-color: #F8FAFC;
        }
        .cover {
          text-align: center;
          padding: 20px 0 30px 0;
          border-bottom: 3px solid #3B82F6;
          margin-bottom: 30px;
        }
        .cover h1 {
          font-size: 34px;
          color: #1E293B;
          font-weight: 800;
          margin: 0 0 10px 0;
          letter-spacing: -0.5px;
        }
        .cover p {
          font-size: 16px;
          color: #64748B;
          margin: 0;
          font-weight: 600;
        }
        .prep-card {
          background: #FFFFFF;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 25px;
          border: 1px solid #E2E8F0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          page-break-inside: avoid;
        }
        .emergency-card {
          border-left: 4px solid #F59E0B;
        }
        .section-title {
          font-size: 18px;
          font-weight: 800;
          color: #1E293B;
          margin-top: 0;
          margin-bottom: 12px;
          border-bottom: 1px solid #F1F5F9;
          padding-bottom: 8px;
        }
        .prep-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
        }
        .prep-col {
          flex: 1;
          min-width: 250px;
        }
        .prep-col p {
          margin: 6px 0;
          font-size: 14px;
        }
        .emergency-list {
          padding-left: 20px;
          margin: 4px 0;
          font-size: 13px;
        }
        .emergency-list li {
          margin-bottom: 4px;
        }
        .must-visit-section {
          margin-top: 15px;
          padding-top: 12px;
          border-top: 1px dashed #E2E8F0;
          font-size: 13px;
        }
        .must-visit-section ul {
          margin: 6px 0 0 0;
          padding-left: 20px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
        }
        .day-section {
          background: #FFFFFF;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 30px;
          border: 1px solid #E2E8F0;
          page-break-inside: auto;
        }
        .day-title {
          color: #2563EB;
          font-size: 24px;
          font-weight: 800;
          border-bottom: 2px solid #DBEAFE;
          padding-bottom: 8px;
          margin-top: 0;
          margin-bottom: 6px;
        }
        .day-summary {
          color: #64748B;
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 20px 0;
        }
        .activity-card {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 20px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .time {
          font-size: 15px;
          font-weight: 700;
          color: #2563EB;
        }
        .type-badge {
          background-color: #EFF6FF;
          color: #1D4ED8;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 9999px;
          border: 1px solid #BFDBFE;
        }
        .title {
          margin: 0 0 8px 0;
          font-size: 18px;
          font-weight: 800;
          color: #0F172A;
        }
        .local-title {
          font-weight: 400;
          color: #64748B;
          font-size: 14px;
        }
        .meta-info {
          display: flex;
          gap: 15px;
          font-size: 13px;
          color: #475569;
          font-weight: 600;
          margin-bottom: 12px;
          padding: 8px 12px;
          background-color: #F8FAFC;
          border-radius: 6px;
        }
        .desc {
          color: #334155;
          font-size: 14px;
          margin: 0;
          line-height: 1.6;
        }
        .address {
          color: #64748B;
          font-size: 13px;
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px dashed #E2E8F0;
        }
        .notes-box {
          background-color: #FEF3C7;
          border-left: 3px solid #D97706;
          padding: 10px 14px;
          border-radius: 4px;
          font-size: 13px;
          margin-top: 12px;
          color: #78350F;
        }
        .qrcode-section {
          display: flex;
          gap: 20px;
          margin-top: 15px;
          padding-top: 12px;
          border-top: 1px solid #F1F5F9;
        }
        .qrcode-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          width: 90px;
        }
        .qrcode-img {
          width: 70px;
          height: 70px;
          border: 1px solid #E2E8F0;
          border-radius: 4px;
          padding: 2px;
          background-color: #FFFFFF;
        }
        .qrcode-label {
          font-size: 10px;
          font-weight: 600;
          color: #475569;
          margin-top: 4px;
        }
        @page {
          size: A4;
          margin: 10mm;
        }
        @media print {
          body {
            background-color: #FFFFFF;
            padding: 0;
            max-width: 100%;
          }
          .day-section {
            box-shadow: none;
            padding: 10px 0;
            border: none;
            border-bottom: 2px solid #E2E8F0;
          }
          .prep-card {
            box-shadow: none;
            border: 1px solid #CBD5E1;
          }
          .activity-card {
            border: 1px solid #CBD5E1;
          }
        }
      </style>
    </head>
    <body>
      <div class="cover">
        <h1>${title}</h1>
        <p>您的專屬 AI 規劃行程表</p>
      </div>
      ${preparationCardHtml}
      ${weatherGuideHtml}
      ${packingListHtml}
      ${financeEmergencyHtml}
      ${daysHtml}
    </body>
    </html>
  `;
};
