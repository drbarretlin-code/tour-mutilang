import { Itinerary, Activity } from '../types/itinerary';
import { repairItineraryTimes, swapOutdoorWithIndoor } from './itineraryRepairer';

// 建立模擬 Itinerary 資料
function createMockItinerary(): Itinerary {
  return {
    id: 'test-itin-123',
    surveyId: 'survey-123',
    userId: 'user-123',
    title: '曼谷 3 天智慧之旅',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'ready',
    currency: 'TWD',
    totalEstimatedCost: { amount: 5000, currency: 'TWD' },
    emergencyContacts: [],
    days: [
      {
        dayNumber: 1,
        date: '2026-07-14',
        title: 'Day 1 - 曼谷探索',
        summary: '曼谷核心景點遊覽',
        region: '曼谷',
        estimatedCost: { amount: 1000, currency: 'TWD' },
        walkingDistance: 2000,
        activities: [
          {
            id: 'act-1',
            order: 0,
            startTime: '09:00',
            endTime: '11:00',
            title: '大皇宮',
            type: 'attraction',
            description: '曼谷著名地標',
            location: { name: '大皇宮', address: '曼谷市區', latitude: 13.75, longitude: 100.49 },
            duration: 120,
            links: [],
            notes: '',
            isMustVisit: true,
            environment: 'outdoor'
          },
          {
            id: 'act-2',
            order: 1,
            startTime: '11:15',
            endTime: '12:45',
            title: '特色咖啡廳',
            type: 'cafe',
            description: '午間休憩咖啡廳',
            location: { name: '咖啡廳', address: '捷運站旁', latitude: 13.76, longitude: 100.50 },
            duration: 90,
            links: [],
            notes: '',
            isMustVisit: false,
            environment: 'indoor'
          },
          {
            id: 'act-3',
            order: 2,
            startTime: '13:00',
            endTime: '14:30',
            title: '臥佛寺',
            type: 'attraction',
            description: '歷史悠久的寺廟',
            location: { name: '臥佛寺', address: '大皇宮旁', latitude: 13.74, longitude: 100.49 },
            duration: 90,
            links: [],
            notes: '',
            isMustVisit: false,
            environment: 'outdoor'
          }
        ]
      },
      {
        dayNumber: 2,
        date: '2026-07-15',
        title: 'Day 2 - 購物與藝術',
        summary: '室內購物與美術館',
        region: '曼谷',
        estimatedCost: { amount: 1500, currency: 'TWD' },
        walkingDistance: 1500,
        activities: [
          {
            id: 'act-4',
            order: 0,
            startTime: '10:00',
            endTime: '12:00',
            title: '當代藝術館 MOCA',
            type: 'attraction',
            description: '當代藝術展出',
            location: { name: 'MOCA', address: '曼谷北部', latitude: 13.84, longitude: 100.56 },
            duration: 120,
            links: [],
            notes: '',
            isMustVisit: false,
            environment: 'indoor'
          }
        ]
      }
    ]
  };
}

export function runTests() {
  console.log('--- 開始執行 ItineraryRepairer 測試 ---');

  // 測試 1: 測試時間自癒與衝突修復 (順延後壓縮非必訪)
  const itin = createMockItinerary();
  // 模擬將第一個活動的時間推遲到 19:00 開始，這會導致後續行程延遲到深夜
  console.log('測試 1: 將起點活動大皇宮的開始時間從 09:00 推遲到 19:00');
  const repaired = repairItineraryTimes(itin, 1, 'act-1', '19:00');

  const day1Acts = repaired.days[0].activities;
  const lastAct = day1Acts[day1Acts.length - 1];
  
  console.log(`修復後的活動數量: ${day1Acts.length}`);
  console.log(`最後一個活動的結束時間: ${lastAct.endTime}`);
  
  // 驗證非必訪的臥佛寺 (act-3) 是否被移除了，或是停留時間被縮短
  const hasAct3 = day1Acts.some(a => a.id === 'act-3');
  console.log(`非必訪景點臥佛寺 (act-3) 是否被移除（因為超時）: ${!hasAct3 ? '是 (通過)' : '否 (失敗)'}`);

  // 測試 2: 雨天備案一鍵對調測試
  console.log('\n測試 2: 雨天備案一鍵切換，將 Day 1 的戶外景點對調為 Day 2 的室內景點');
  const rainFallbackItin = swapOutdoorWithIndoor(itin, 1);
  
  const originalDay1Outdoors = itin.days[0].activities.filter(a => a.environment === 'outdoor');
  const newDay1Outdoors = rainFallbackItin.days[0].activities.filter(a => a.environment === 'outdoor');

  console.log(`原始 Day 1 戶外活動數量: ${originalDay1Outdoors.length}`);
  console.log(`切換雨天備案後 Day 1 戶外活動數量: ${newDay1Outdoors.length}`);
  
  // 檢驗 Day 1 第一個原本為大皇宮 (outdoor) 的活動是否換成了 MOCA (indoor)
  const firstAct = rainFallbackItin.days[0].activities[0];
  console.log(`Day 1 的第一個景點對調結果: 「${firstAct.title}」 (環境: ${firstAct.environment || '未設定'})`);
  console.log(`對調驗證結果: ${firstAct.environment === 'indoor' ? '成功 (通過)' : '失敗'}`);

  console.log('--- 測試結束 ---');
}

// 如果直接執行此檔案，執行測試
// @ts-ignore
if (require.main === module) {
  runTests();
}
