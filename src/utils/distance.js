export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const latitude1 = Number(lat1);
  const longitude1 = Number(lon1);
  const latitude2 = Number(lat2);
  const longitude2 = Number(lon2);

  const hasInvalidCoordinate = [
    latitude1,
    longitude1,
    latitude2,
    longitude2,
  ].some((value) => Number.isNaN(value));

  if (hasInvalidCoordinate) {
    return 0;
  }

  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRad(latitude2 - latitude1);
  const dLon = toRad(longitude2 - longitude1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(latitude1)) *
      Math.cos(toRad(latitude2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}