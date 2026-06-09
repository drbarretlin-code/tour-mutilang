// 測試 diffItinerary 增量比對邏輯

function diffItinerary(oldItin, newItin) {
  const updates = {};

  // 1. 比對行程基本屬性
  const baseKeys = ['title', 'status', 'currency', 'mapImageUrl'];
  for (const key of baseKeys) {
    if (newItin[key] !== oldItin[key]) {
      updates[key] = newItin[key] !== undefined ? newItin[key] : null;
    }
  }

  // 2. 比對總估算費用
  if (JSON.stringify(newItin.totalEstimatedCost) !== JSON.stringify(oldItin.totalEstimatedCost)) {
    updates['totalEstimatedCost'] = newItin.totalEstimatedCost !== undefined ? newItin.totalEstimatedCost : null;
  }

  // 3. 比對緊急聯絡人資訊
  if (JSON.stringify(newItin.emergencyContacts) !== JSON.stringify(oldItin.emergencyContacts)) {
    updates['emergencyContacts'] = newItin.emergencyContacts || [];
  }

  // 4. 比對每日行程 (days) 陣列
  const oldDays = oldItin.days || [];
  const newDays = newItin.days || [];

  if (oldDays.length !== newDays.length) {
    updates['days'] = newDays;
  } else {
    for (let i = 0; i < newDays.length; i++) {
      const oldDay = oldDays[i];
      const newDay = newDays[i];

      if (newDay.title !== oldDay.title) updates[`days/${i}/title`] = newDay.title;
      if (newDay.summary !== oldDay.summary) updates[`days/${i}/summary`] = newDay.summary;
      if (newDay.region !== oldDay.region) updates[`days/${i}/region`] = newDay.region;
      if (newDay.walkingDistance !== oldDay.walkingDistance) updates[`days/${i}/walkingDistance`] = newDay.walkingDistance;

      if (JSON.stringify(newDay.weather) !== JSON.stringify(oldDay.weather)) {
        updates[`days/${i}/weather`] = newDay.weather !== undefined ? newDay.weather : null;
      }
      if (JSON.stringify(newDay.estimatedCost) !== JSON.stringify(oldDay.estimatedCost)) {
        updates[`days/${i}/estimatedCost`] = newDay.estimatedCost !== undefined ? newDay.estimatedCost : null;
      }
      if (JSON.stringify(newDay.hotel) !== JSON.stringify(oldDay.hotel)) {
        updates[`days/${i}/hotel`] = newDay.hotel !== undefined ? newDay.hotel : null;
      }
      if (JSON.stringify(newDay.localTips) !== JSON.stringify(oldDay.localTips)) {
        updates[`days/${i}/localTips`] = newDay.localTips || [];
      }

      // 5. 比對當日活動 (activities) 列表
      const oldActs = oldDay.activities || [];
      const newActs = newDay.activities || [];

      if (oldActs.length !== newActs.length) {
        updates[`days/${i}/activities`] = newActs;
      } else {
        for (let j = 0; j < newActs.length; j++) {
          const oldAct = oldActs[j];
          const newAct = newActs[j];

          if (JSON.stringify(oldAct) !== JSON.stringify(newAct)) {
            updates[`days/${i}/activities/${j}`] = newAct;
          }
        }
      }
    }
  }

  return updates;
}

// Mock 資料
const mockOldItinerary = {
  id: "test-123",
  title: "東京五日遊",
  currency: "JPY",
  totalEstimatedCost: { amount: 50000, currency: "JPY" },
  emergencyContacts: [{ label: "警察", number: "110" }],
  days: [
    {
      dayNumber: 1,
      title: "出發與抵達",
      summary: "抵達東京成田機場",
      region: "成田",
      walkingDistance: 1000,
      activities: [
        { id: "act-1", order: 0, startTime: "14:00", endTime: "15:00", title: "機場通關" },
        { id: "act-2", order: 1, startTime: "16:00", endTime: "17:00", title: "搭乘特快電車" }
      ]
    }
  ]
};

// 測試案例 1：只修改第一天第二個活動的時間
const case1New = JSON.parse(JSON.stringify(mockOldItinerary));
case1New.days[0].activities[1].startTime = "16:30";

const diff1 = diffItinerary(mockOldItinerary, case1New);
console.log("Case 1 (修改單一活動屬性) Diff 結果:");
console.log(JSON.stringify(diff1, null, 2));
if (diff1["days/0/activities/1"] && diff1["days/0/activities/1"].startTime === "16:30" && Object.keys(diff1).length === 1) {
  console.log("-> Case 1 通過\n");
} else {
  console.error("-> Case 1 失敗！", diff1);
}

// 測試案例 2：刪除第一天的第二個活動
const case2New = JSON.parse(JSON.stringify(mockOldItinerary));
case2New.days[0].activities.pop();

const diff2 = diffItinerary(mockOldItinerary, case2New);
console.log("Case 2 (刪除活動導致列表長度不同) Diff 結果:");
console.log(JSON.stringify(diff2, null, 2));
if (diff2["days/0/activities"] && diff2["days/0/activities"].length === 1 && Object.keys(diff2).length === 1) {
  console.log("-> Case 2 通過\n");
} else {
  console.error("-> Case 2 失敗！", diff2);
}

// 測試案例 3：修改行程標題與新增緊急聯絡人
const case3New = JSON.parse(JSON.stringify(mockOldItinerary));
case3New.title = "東京酷炫六日遊";
case3New.emergencyContacts.push({ label: "救護車", number: "119" });

const diff3 = diffItinerary(mockOldItinerary, case3New);
console.log("Case 3 (修改基本屬性與緊急聯絡人列表) Diff 結果:");
console.log(JSON.stringify(diff3, null, 2));
if (diff3.title === "東京酷炫六日遊" && diff3.emergencyContacts.length === 2 && Object.keys(diff3).length === 2) {
  console.log("-> Case 3 通過\n");
} else {
  console.error("-> Case 3 失敗！", diff3);
}
