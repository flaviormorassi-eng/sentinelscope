import { z } from 'zod';

const geolocationResponseSchema = z.object({
  status: z.string(),
  countryCode: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  message: z.string().optional(), // for failed requests
});

export interface GeolocationData {
  countryCode?: string;
  country?: string;
  city?: string;
  lat?: string;
  lon?:string;
}

export async function getGeolocation(ip: string): Promise<GeolocationData | null> {
  try {
    // Use a free, no-key-required geolocation API for this example
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,city,lat,lon`);
    if (!response.ok) {
      console.error(`Geolocation API error for IP ${ip}: ${response.statusText}`);
      return null;
    }

    const data = geolocationResponseSchema.parse(await response.json());

    if (data.status === 'success') {
      return {
        countryCode: data.countryCode,
        country: data.country,
        city: data.city,
        lat: data.lat?.toString(),
        lon: data.lon?.toString(),
      };
    }
    return null;
  } catch (error) {
    console.error(`Failed to fetch geolocation for IP ${ip}:`, error);
    return null;
  }
}