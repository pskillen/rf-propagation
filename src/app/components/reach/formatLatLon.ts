/** Formats a coordinate as "51.2°N 3.1°W" -- one decimal place, signed hemisphere letters, no negative numbers. */
export function formatLatLon(lat: number, lon: number): string {
  const latHemisphere = lat >= 0 ? 'N' : 'S';
  const lonHemisphere = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(1)}°${latHemisphere} ${Math.abs(lon).toFixed(1)}°${lonHemisphere}`;
}
