import { z } from 'zod';

const geolocationResponseSchema = z.object({
  success: z.boolean().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  message: z.string().optional(),
});

export interface GeolocationData {
  country?: string;
  city?: string;
  lat?: string;
  lon?:string;
}

export async function getGeolocation(ip: string): Promise<GeolocationData | null> {
  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`);
    if (!response.ok) {
      console.error(`Geolocation API error for IP ${ip}: ${response.statusText}`);
      return null;
    }

    const data = geolocationResponseSchema.parse(await response.json());

    if (data.success !== false) {
      return {
        country: data.country,
        city: data.city,
        lat: data.latitude?.toString(),
        lon: data.longitude?.toString(),
      };
    }
    return null;
  } catch (error) {
    console.error(`Failed to fetch geolocation for IP ${ip}:`, error);
    return null;
  }
}