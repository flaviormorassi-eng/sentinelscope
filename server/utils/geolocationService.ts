// Placeholder geolocationService
// Replace with real implementation as needed

export async function getGeolocation(ip: string): Promise<{ country: string; city: string; lat?: number; lon?: number } | null> {
  // Check if IP is private
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.)/.test(ip)) {
    return null;
  }

  // For demo/dev purposes, return random coordinates if no real service is configured
  // In production, you would use MaxMind or an API like ip-api.com
  
  // Deterministic random based on IP to keep markers stable
  const hash = ip.split('.').reduce((acc, part) => acc + parseInt(part), 0);
  const lat = (hash % 180) - 90;
  const lon = (hash % 360) - 180;

  return { 
    country: "Demo Country", 
    city: "Demo City",
    lat,
    lon
  };
}
