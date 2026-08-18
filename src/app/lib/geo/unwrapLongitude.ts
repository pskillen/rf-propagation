/**
 * Unwraps `lonDeg` to the representative within 180deg of `referenceLonDeg`,
 * by adding/subtracting whole turns of 360deg — i.e. it undoes the
 * normalise-to-(-180,180] step so a value that's "really" just past the
 * antimeridian from the reference (e.g. reference 179.9, raw -179.8) comes
 * back as a continuous value (180.2) instead of jumping to the far side.
 *
 * Needed wherever several geographically-close points (e.g. one grid cell's
 * four corners) are projected independently and then connected into a
 * shape: each point's raw longitude gets normalised on its own by
 * `destinationPoint`, so two corners of the same small cell can land on
 * opposite sides of the +-180 seam even though they're metres apart on the
 * ground. Projecting the unwrapped value instead keeps them close in screen
 * space too, since Leaflet's projection is linear (not clamped) in
 * longitude beyond +-180.
 */
export function unwrapLongitudeRelativeTo(lonDeg: number, referenceLonDeg: number): number {
  let lon = lonDeg;
  while (lon - referenceLonDeg > 180) lon -= 360;
  while (lon - referenceLonDeg < -180) lon += 360;
  return lon;
}
