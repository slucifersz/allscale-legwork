/**
 * Structural checks on a submitted photo. ADVISORY ONLY: they gate the "accept" button, they do not prove delivery.
 * A human still clicks accept (plan §5 step 6).
 */
import exifr from "exifr";

export interface CheckResult {
  ok: boolean;
  checks: { name: string; ok: boolean; detail: string }[];
  exif?: { takenAt?: string; lat?: number; lon?: number };
}

export async function checkPhoto(buf: Buffer, opts: { windowStart: Date; windowEnd: Date; near?: { lat: number; lon: number; radiusM: number } }): Promise<CheckResult> {
  const checks: CheckResult["checks"] = [];
  let takenAt: Date | undefined;
  let lat: number | undefined;
  let lon: number | undefined;
  try {
    const ex = (await exifr.parse(buf, { gps: true, pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude"] })) ?? {};
    takenAt = ex.DateTimeOriginal ?? ex.CreateDate;
    lat = ex.latitude;
    lon = ex.longitude;
  } catch {
    /* no exif */
  }
  checks.push({ name: "file", ok: buf.length > 10_000, detail: `${buf.length} bytes` });
  const hasTime = takenAt instanceof Date && !isNaN(takenAt.getTime());
  const inWindow = hasTime && takenAt! >= opts.windowStart && takenAt! <= opts.windowEnd;
  checks.push({ name: "exif_time_in_window", ok: inWindow, detail: hasTime ? takenAt!.toISOString() : "no EXIF timestamp" });
  const hasGps = typeof lat === "number" && typeof lon === "number";
  if (opts.near) {
    const d = hasGps ? haversineM(lat!, lon!, opts.near.lat, opts.near.lon) : NaN;
    checks.push({ name: "gps_near_location", ok: hasGps && d <= opts.near.radiusM, detail: hasGps ? `${Math.round(d)} m away` : "no GPS" });
  } else {
    checks.push({ name: "gps_present", ok: hasGps, detail: hasGps ? `${lat},${lon}` : "no GPS" });
  }
  return { ok: checks.every((c) => c.ok), checks, exif: { takenAt: hasTime ? takenAt!.toISOString() : undefined, lat, lon } };
}

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
