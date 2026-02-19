import { z } from 'zod';

const geolocationResponseSchema = z.object({
  status: z.string(),
  country: z.string().optional(),
  city: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  message: z.string().optional(),
});

// Internal cache to avoid excessive external lookups.
const cache = new Map<string, { ts: number; data: { country: string; city: string; lat?: number; lon?: number } | null }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

function isPrivateOrLocalIp(ip: string): boolean {
  const normalized = String(ip || '').trim();
  return /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.|0\.|169\.254\.)/.test(normalized)
    || normalized === '::1'
    || normalized.startsWith('fe80:')
    || normalized.startsWith('fc')
    || normalized.startsWith('fd');
}

export async function getGeolocation(ip: string): Promise<{ country: string; city: string; lat?: number; lon?: number } | null> {
  const cleanIp = String(ip || '').trim();
  if (!cleanIp || isPrivateOrLocalIp(cleanIp)) return null;

  const now = Date.now();
  const cached = cache.get(cleanIp);
  if (cached && (now - cached.ts) < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(cleanIp)}?fields=status,message,country,city,lat,lon`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      cache.set(cleanIp, { ts: now, data: null });
      return null;
    }

    const parsed = geolocationResponseSchema.parse(await response.json());
    if (parsed.status !== 'success') {
      cache.set(cleanIp, { ts: now, data: null });
      return null;
    }

    const data = {
      country: parsed.country || 'Unknown',
      city: parsed.city || 'Unknown',
      lat: parsed.lat,
      lon: parsed.lon,
    };
    cache.set(cleanIp, { ts: now, data });
    return data;
  } catch {
    cache.set(cleanIp, { ts: now, data: null });
    return null;
  }
}
