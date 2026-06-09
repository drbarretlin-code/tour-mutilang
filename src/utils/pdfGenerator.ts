import { Itinerary } from '../types/itinerary';
import { TripSurvey } from '../types/survey';

export const generateItineraryHtml = (itinerary: Itinerary, survey?: TripSurvey | null): string => {
  const { title, days } = itinerary;

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

  // 2. 匯率與緊急求助指南
  const financeEmergencyHtml = `
    <div class="prep-card emergency-card">
      <h2 class="section-title">🇹🇭 匯率消費與緊急求助指南</h2>
      <div class="prep-grid">
        <div class="prep-col">
          <p><strong>💵 預估匯率：</strong>1 TWD ≈ 1.10 THB（以當地實際換匯為準）</p>
          <p><strong>🍔 每日生活費：</strong>預估約 1,500 ฿（約 1,364 NTD）/ 人</p>
        </div>
        <div class="prep-col">
          <p><strong>🚨 24 小時緊急求助熱線：</strong></p>
          <ul class="emergency-list">
            <li><strong>泰國旅遊警察 (英語服務)：</strong>1155</li>
            <li><strong>泰國醫療急救：</strong>1669</li>
            <li><strong>台灣駐泰國代表處：</strong>+66-81-8340919</li>
          </ul>
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
      ${financeEmergencyHtml}
      ${daysHtml}
    </body>
    </html>
  `;
};
