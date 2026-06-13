interface LatLng {
  latitude?: number;
  longitude?: number;
}

/** 計算兩個經緯度座標間的直線距離（公里），使用 Haversine 公式。 */
export function haversineDistanceKm(from: LatLng, to: LatLng): number {
  const lat1 = from.latitude || 0;
  const lon1 = from.longitude || 0;
  const lat2 = to.latitude || 0;
  const lon2 = to.longitude || 0;
  if ((lat1 === 0 && lon1 === 0) || (lat2 === 0 && lon2 === 0)) return 0;
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = 6371; // 地球半徑（公里）
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 取得兩個行程節點間的路線距離（公里）。
 * 優先順序：transport.distance（規劃時已標註的實際距離）
 *          > 兩節點座標的 Haversine 直線距離。
 *
 * 重要：若兩節點皆退回城市中心而座標相同（缺乏真實 POI 座標），則回傳 0，
 * 代表「距離不明」——呼叫端應隱藏距離標籤，而非顯示以「時間×速度」捏造的
 * 固定估算值（過去會造成每天每段顯示相同且不可信的距離）。
 */
export function getRouteDistanceKm(transport: any, from?: LatLng, to?: LatLng): number {
  if (transport?.distance > 0) {
    return transport.distance / 1000;
  }

  if (from && to) {
    const geoDist = haversineDistanceKm(from, to);
    if (geoDist > 0.1) return geoDist;
  }

  // 無可信來源（無標註距離、且座標缺失或相同）→ 距離不明
  return 0;
}
