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
 *          > 兩節點座標的 Haversine 直線距離（避免每天顯示相同的固定距離）
 *          > 依交通方式與時間估算的距離（無座標資料時的最終備援）。
 */
export function getRouteDistanceKm(transport: any, from?: LatLng, to?: LatLng): number {
  if (transport?.distance > 0) {
    return transport.distance / 1000;
  }

  if (from && to) {
    const geoDist = haversineDistanceKm(from, to);
    if (geoDist > 0.1) return geoDist;
  }

  const duration = transport?.duration || 10;
  const mode = transport?.mode || 'drive';

  let speedKmh = 40;
  if (mode === 'walk') {
    speedKmh = 4.5;
  } else if (mode === 'public') {
    speedKmh = 20;
  } else if (mode === 'taxi' || mode === 'charter' || mode === 'drive') {
    speedKmh = 40;
  }

  return (duration / 60) * speedKmh;
}
