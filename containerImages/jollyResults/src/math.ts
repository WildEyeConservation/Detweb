export function trimmedMean(values: number[], trimRatio = 0.2): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * trimRatio);
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  const valuesToAverage = trimmed.length > 0 ? trimmed : sorted;
  return (
    valuesToAverage.reduce((sum, value) => sum + value, 0) /
    valuesToAverage.length
  );
}

// Ground strip width covered by one camera. Each camera is treated as an
// independent strip: multi-camera swaths are the SUM of per-camera widths, with
// overlap deliberately not subtracted. Any overlap is then present in both the
// surveyed area and the animal counts, so density stays consistent. Because
// only the width matters, the result is identical for tilt +t and -t and tilt
// signs do not need to be known.
export function cameraFootprintWidth(
  altitudeAgl: number,
  sensorWidthMm: number,
  focalLengthMm: number,
  tiltDegrees: number
): number {
  if (
    !Number.isFinite(altitudeAgl) ||
    altitudeAgl < 0 ||
    !Number.isFinite(sensorWidthMm) ||
    sensorWidthMm <= 0 ||
    !Number.isFinite(focalLengthMm) ||
    focalLengthMm <= 0 ||
    !Number.isFinite(tiltDegrees)
  ) {
    throw new Error('Invalid camera footprint inputs');
  }

  const tiltRadians = (tiltDegrees * Math.PI) / 180;
  const fieldOfView =
    2 * Math.atan(sensorWidthMm / (2 * focalLengthMm));
  // Math.tan never overflows to Infinity in floating point — past 90° it just
  // goes negative — so the far edge must be bounds-checked geometrically.
  if (Math.abs(tiltRadians) + fieldOfView / 2 >= Math.PI / 2) {
    throw new Error('Camera footprint crosses the horizon');
  }
  const near = altitudeAgl * Math.tan(tiltRadians - fieldOfView / 2);
  const far = altitudeAgl * Math.tan(tiltRadians + fieldOfView / 2);

  return far - near;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function vincentyDistance(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
): number {
  const semiMajorAxis = 6378137;
  const semiMinorAxis = 6356752.314245;
  const flattening = 1 / 298.257223563;
  const longitudeDelta = toRadians(longitude2 - longitude1);
  const reducedLatitude1 = Math.atan(
    (1 - flattening) * Math.tan(toRadians(latitude1))
  );
  const reducedLatitude2 = Math.atan(
    (1 - flattening) * Math.tan(toRadians(latitude2))
  );
  const sinU1 = Math.sin(reducedLatitude1);
  const cosU1 = Math.cos(reducedLatitude1);
  const sinU2 = Math.sin(reducedLatitude2);
  const cosU2 = Math.cos(reducedLatitude2);

  let lambda = longitudeDelta;
  let previousLambda = 0;
  let iterations = 100;
  let cosSquaredAlpha = 0;
  let sinSigma = 0;
  let cosTwoSigmaM = 0;
  let cosSigma = 0;
  let sigma = 0;

  do {
    const sinLambda = Math.sin(lambda);
    const cosLambda = Math.cos(lambda);
    sinSigma = Math.sqrt(
      cosU2 * sinLambda * (cosU2 * sinLambda) +
        (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) *
          (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda)
    );
    if (sinSigma === 0) return 0;
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cosSquaredAlpha = 1 - sinAlpha * sinAlpha;
    cosTwoSigmaM =
      cosSquaredAlpha === 0
        ? 0
        : cosSigma - (2 * sinU1 * sinU2) / cosSquaredAlpha;
    const correction =
      (flattening / 16) *
      cosSquaredAlpha *
      (4 + flattening * (4 - 3 * cosSquaredAlpha));
    previousLambda = lambda;
    lambda =
      longitudeDelta +
      (1 - correction) *
        flattening *
        sinAlpha *
        (sigma +
          correction *
            sinSigma *
            (cosTwoSigmaM +
              correction *
                cosSigma *
                (-1 + 2 * cosTwoSigmaM * cosTwoSigmaM)));
  } while (
    Math.abs(lambda - previousLambda) > 1e-12 &&
    --iterations > 0
  );

  if (iterations === 0) {
    throw new Error('Distance calculation did not converge');
  }

  const uSquared =
    (cosSquaredAlpha *
      (semiMajorAxis * semiMajorAxis - semiMinorAxis * semiMinorAxis)) /
    (semiMinorAxis * semiMinorAxis);
  const coefficientA =
    1 +
    (uSquared / 16384) *
      (4096 +
        uSquared *
          (-768 + uSquared * (320 - 175 * uSquared)));
  const coefficientB =
    (uSquared / 1024) *
    (256 +
      uSquared * (-128 + uSquared * (74 - 47 * uSquared)));
  const deltaSigma =
    coefficientB *
    sinSigma *
    (cosTwoSigmaM +
      (coefficientB / 4) *
        (cosSigma * (-1 + 2 * cosTwoSigmaM * cosTwoSigmaM) -
          (coefficientB / 6) *
            cosTwoSigmaM *
            (-3 + 4 * sinSigma * sinSigma) *
            (-3 + 4 * cosTwoSigmaM * cosTwoSigmaM)));

  return semiMinorAxis * coefficientA * (sigma - deltaSigma);
}

export function covariance(first: number[], second: number[]): number {
  if (first.length !== second.length) {
    throw new Error('Covariance arrays must have equal lengths');
  }
  if (first.length < 2) return 0;
  const firstMean =
    first.reduce((sum, value) => sum + value, 0) / first.length;
  const secondMean =
    second.reduce((sum, value) => sum + value, 0) / second.length;
  return (
    first.reduce(
      (sum, value, index) =>
        sum +
        (value - firstMean) *
          (second[index]! - secondMean),
      0
    ) /
    (first.length - 1)
  );
}
