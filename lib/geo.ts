// Lightweight geo helpers for technician↔client proximity (call 2026-06-10).
// No external geocoding API: we approximate a location by its French
// département centroid and measure great-circle (haversine) distance. Accuracy
// is coarse (~département scale) but plenty for a "nearest intervenant within
// 100 km, widen if none" heuristic. Pure module — safe to import client-side.

// Approximate [lat, lon] centroid per département (metropolitan + Corsica +
// DOM). Values are rounded; sub-département precision isn't needed here.
const DEPT_CENTROIDS: Record<string, [number, number]> = {
  "01": [46.10, 5.33], "02": [49.56, 3.55], "03": [46.39, 3.19], "04": [44.10, 6.24],
  "05": [44.66, 6.26], "06": [43.94, 7.17], "07": [44.75, 4.42], "08": [49.70, 4.72],
  "09": [42.96, 1.52], "10": [48.31, 4.17], "11": [43.06, 2.55], "12": [44.32, 2.58],
  "13": [43.53, 5.09], "14": [49.10, -0.25], "15": [45.05, 2.66], "16": [45.72, 0.20],
  "17": [45.75, -0.80], "18": [47.02, 2.51], "19": [45.35, 1.87],
  "2A": [41.86, 8.99], "2B": [42.49, 9.28],
  "21": [47.46, 4.79], "22": [48.40, -2.80], "23": [46.05, 2.02], "24": [45.13, 0.72],
  "25": [47.16, 6.36], "26": [44.73, 5.09], "27": [49.08, 0.98], "28": [48.44, 1.39],
  "29": [48.25, -4.05], "30": [43.99, 4.22], "31": [43.42, 1.29], "32": [43.66, 0.44],
  "33": [44.87, -0.58], "34": [43.60, 3.42], "35": [48.18, -1.70], "36": [46.81, 1.55],
  "37": [47.23, 0.68], "38": [45.28, 5.58], "39": [46.72, 5.77], "40": [43.99, -0.76],
  "41": [47.62, 1.34], "42": [45.73, 4.25], "43": [45.09, 3.83], "44": [47.35, -1.60],
  "45": [47.91, 2.34], "46": [44.62, 1.60], "47": [44.35, 0.45], "48": [44.53, 3.50],
  "49": [47.39, -0.55], "50": [49.10, -1.30], "51": [48.96, 4.19], "52": [48.11, 5.14],
  "53": [48.15, -0.66], "54": [48.78, 6.15], "55": [48.99, 5.37], "56": [47.84, -2.80],
  "57": [49.02, 6.67], "58": [47.12, 3.52], "59": [50.53, 3.24], "60": [49.42, 2.42],
  "61": [48.59, 0.13], "62": [50.51, 2.30], "63": [45.72, 3.14], "64": [43.30, -0.76],
  "65": [43.10, 0.15], "66": [42.60, 2.60], "67": [48.65, 7.60], "68": [47.87, 7.22],
  "69": [45.88, 4.55], "70": [47.63, 6.09], "71": [46.65, 4.53], "72": [48.02, 0.19],
  "73": [45.49, 6.42], "74": [46.05, 6.42], "75": [48.86, 2.34], "76": [49.66, 1.00],
  "77": [48.62, 2.95], "78": [48.82, 1.90], "79": [46.55, -0.35], "80": [49.92, 2.30],
  "81": [43.78, 2.10], "82": [44.02, 1.34], "83": [43.39, 6.22], "84": [44.05, 5.15],
  "85": [46.67, -1.35], "86": [46.56, 0.46], "87": [45.89, 1.25], "88": [48.16, 6.42],
  "89": [47.85, 3.56], "90": [47.63, 6.87], "91": [48.53, 2.24], "92": [48.84, 2.24],
  "93": [48.91, 2.48], "94": [48.78, 2.46], "95": [49.08, 2.22],
  "971": [16.24, -61.55], "972": [14.64, -61.02], "973": [4.00, -53.00],
  "974": [-21.13, 55.53], "976": [-12.82, 45.17],
};

// French département code from a postal code. Metropolitan = first 2 digits;
// Corsica 20xxx splits into 2A (Corse-du-Sud) / 2B (Haute-Corse); DOM = first 3.
export function departmentOf(postalCode: string | null | undefined): string | null {
  const s = (postalCode ?? "").replace(/\s/g, "");
  if (!/^\d{4,5}$/.test(s)) return null;
  const p = s.padStart(5, "0");
  const two = p.slice(0, 2);
  if (two === "20") return Number(p) < 20200 ? "2A" : "2B";
  if (two === "97" || two === "98") return p.slice(0, 3);
  return two;
}

const R_EARTH_KM = 6371;
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Approximate km between two postal codes via their département centroids.
// Returns null when either code can't be resolved to a known département.
export function distanceByPostalCodeKm(
  a: string | null | undefined,
  b: string | null | undefined,
): number | null {
  const da = departmentOf(a);
  const db = departmentOf(b);
  if (!da || !db) return null;
  const ca = DEPT_CENTROIDS[da];
  const cb = DEPT_CENTROIDS[db];
  if (!ca || !cb) return null;
  return Math.round(haversineKm(ca[0], ca[1], cb[0], cb[1]));
}

// Whether a client postal code falls inside a technician's declared coverage
// (list of département codes). Empty coverage = no restriction (false here;
// callers treat "no declared zone" separately).
export function isInServiceZone(
  clientPostalCode: string | null | undefined,
  serviceDepartments: string[],
): boolean {
  const dept = departmentOf(clientPostalCode);
  if (!dept || serviceDepartments.length === 0) return false;
  return serviceDepartments.includes(dept);
}
