export const PICKOLO_PILOT_RADIUS_KM = 15;

export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

export function isWithinPilotRadius(
  customerLat: number,
  customerLong: number,
  partnerLat: number,
  partnerLong: number,
  radiusKm = PICKOLO_PILOT_RADIUS_KM,
) {
  return distanceKm(customerLat, customerLong, partnerLat, partnerLong) <= radiusKm;
}
