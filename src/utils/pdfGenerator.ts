import { Itinerary } from '../types/itinerary';

export const generateItineraryHtml = (itinerary: Itinerary): string => {
  const { title, days } = itinerary;

  const fallbackMapUrl = "https://images.unsplash.com/photo-1583507119045-84615ecb91ee?auto=format&fit=crop&q=80&w=1200";
  const finalMapUrl = itinerary.mapImageUrl || fallbackMapUrl;
  
  const mapHtml = `<div class="map-container"><img src="${finalMapUrl}" class="map-image" alt="3D Itinerary Map" /></div>`;

  let daysHtml = '';
  days.forEach((day) => {
    let activitiesHtml = '';
    (day.activities || []).forEach((act) => {
      activitiesHtml += `
        <div class="activity-card">
          <div class="card-header">
            <span class="time">${act.startTime} - ${act.endTime}</span>
            <span class="type-badge">${act.type.toUpperCase()}</span>
          </div>
          <h3 class="title">${act.title} ${act.localTitle ? `<span class="local-title">(${act.localTitle})</span>` : ''}</h3>
          <div class="meta-info">
            <span>⏱️ 停留: ${act.duration} 分鐘</span>
            <span>💰 花費: ${act.cost ? `${act.cost.currency} ${act.cost.amount}` : '免費'}</span>
          </div>
          ${act.description ? `<p class="desc">${act.description}</p>` : ''}
          ${act.location?.address ? `<div class="address">📍 ${act.location.address}</div>` : ''}
        </div>
      `;
    });

    daysHtml += `
      <div class="day-section">
        <h2 class="day-title">Day ${day.dayNumber} - ${day.title}</h2>
        <p class="day-summary">${day.summary || ''}</p>
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
      <title>${title} - 列印版行程表</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        
        * {
          box-sizing: border-box;
        }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #0F172A;
          line-height: 1.6;
          padding: 40px;
          margin: 0 auto;
          max-width: 1000px;
          background-color: #F8FAFC;
        }
        .cover {
          text-align: center;
          padding: 20px 0 40px 0;
          border-bottom: 2px solid #E2E8F0;
          margin-bottom: 40px;
        }
        .cover h1 {
          font-size: 38px;
          color: #1E293B;
          font-weight: 800;
          margin: 0 0 12px 0;
          letter-spacing: -0.5px;
        }
        .cover p {
          font-size: 18px;
          color: #64748B;
          margin: 0;
        }
        .map-container {
          width: 100%;
          margin-bottom: 40px;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          background-color: #E2E8F0;
        }
        .map-image {
          width: 100%;
          height: auto;
          display: block;
          object-fit: cover;
          max-height: 400px;
        }
        .day-section {
          background: #FFFFFF;
          border-radius: 16px;
          padding: 30px;
          margin-bottom: 40px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          page-break-inside: auto;
        }
        .day-title {
          color: #2563EB;
          font-size: 28px;
          font-weight: 800;
          border-bottom: 2px solid #DBEAFE;
          padding-bottom: 12px;
          margin-top: 0;
          margin-bottom: 12px;
        }
        .day-summary {
          color: #475569;
          font-size: 16px;
          margin-bottom: 30px;
        }
        .activity-card {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .card-header {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
        }
        .time {
          font-size: 16px;
          font-weight: 700;
          color: #3B82F6;
          margin-right: 12px;
        }
        .type-badge {
          background-color: #EFF6FF;
          color: #1D4ED8;
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 9999px;
          border: 1px solid #BFDBFE;
        }
        .title {
          margin: 0 0 10px 0;
          font-size: 22px;
          font-weight: 800;
          color: #0F172A;
        }
        .local-title {
          font-weight: 400;
          color: #64748B;
          font-size: 16px;
        }
        .meta-info {
          display: flex;
          gap: 20px;
          font-size: 14px;
          color: #475569;
          font-weight: 600;
          margin-bottom: 16px;
          padding: 12px 16px;
          background-color: #F8FAFC;
          border-radius: 8px;
        }
        .desc {
          color: #334155;
          font-size: 15px;
          margin: 0;
          line-height: 1.7;
        }
        .address {
          color: #64748B;
          font-size: 14px;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px dashed #E2E8F0;
        }
        @page {
          size: A4;
          margin: 15mm;
          @bottom-right {
            content: "Page " counter(page) " of " counter(pages);
            font-family: 'Inter', sans-serif;
            font-size: 10px;
            color: #64748B;
          }
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
          }
          .map-container {
            box-shadow: none;
            border: 1px solid #E2E8F0;
          }
          .activity-card {
            border: 1px solid #CBD5E1;
            break-inside: auto;
            page-break-inside: auto;
          }
        }
      </style>
    </head>
    <body>
      <div class="cover">
        <h1>${title}</h1>
        <p>您的專屬 AI 規劃行程</p>
      </div>
      ${mapHtml}
      ${daysHtml}
    </body>
    </html>
  `;
};
