const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY;
const VT_BASE_URL = 'https://www.virustotal.com/api/v3';

export interface VirusTotalResult {
  status: 'clean' | 'malicious' | 'suspicious' | 'undetected' | 'error';
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  total: number;
  permalink?: string;
  analysisDate?: string;
  error?: string;
}

// Input validation patterns
const HASH_PATTERN = /^[a-fA-F0-9]{32}$|^[a-fA-F0-9]{40}$|^[a-fA-F0-9]{64}$/;
const IP_PATTERN = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const URL_PATTERN = /^https?:\/\/.+/;

export function validateHash(hash: string): boolean {
  return HASH_PATTERN.test(hash.trim());
}

export function validateIP(ip: string): boolean {
  return IP_PATTERN.test(ip.trim());
}

export function validateURL(url: string): boolean {
  return URL_PATTERN.test(url.trim());
}

async function makeVTRequest(endpoint: string): Promise<any> {
  if (!VIRUSTOTAL_API_KEY) {
    throw new Error('VirusTotal API key not configured');
  }

  const response = await fetch(`${VT_BASE_URL}${endpoint}`, {
    headers: {
      'x-apikey': VIRUSTOTAL_API_KEY,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    if (response.status === 429) {
      throw new Error('VirusTotal rate limit exceeded. Please try again later.');
    }
    throw new Error(`VirusTotal API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

function parseAnalysisStats(stats: any): VirusTotalResult {
  const malicious = stats.malicious || 0;
  const suspicious = stats.suspicious || 0;
  const harmless = stats.harmless || 0;
  const undetected = stats.undetected || 0;
  const total = malicious + suspicious + harmless + undetected;

  let status: VirusTotalResult['status'] = 'undetected';
  if (malicious > 0) {
    status = 'malicious';
  } else if (suspicious > 0) {
    status = 'suspicious';
  } else if (harmless > 0 || undetected > 0) {
    status = 'clean';
  }

  return {
    status,
    malicious,
    suspicious,
    harmless,
    undetected,
    total,
  };
}

/**
 * Check a file hash (MD5, SHA-1, or SHA-256) against VirusTotal database
 */
export async function checkFileHash(hash: string): Promise<VirusTotalResult> {
  try {
    const data = await makeVTRequest(`/files/${hash}`);
    
    if (!data) {
      return {
        status: 'undetected',
        malicious: 0,
        suspicious: 0,
        harmless: 0,
        undetected: 0,
        total: 0,
      };
    }

    const stats = data.data?.attributes?.last_analysis_stats || {};
    const result = parseAnalysisStats(stats);
    
    return {
      ...result,
      permalink: `https://www.virustotal.com/gui/file/${hash}`,
      analysisDate: data.data?.attributes?.last_analysis_date 
        ? new Date(data.data.attributes.last_analysis_date * 1000).toISOString()
        : undefined,
    };
  } catch (error: any) {
    return {
      status: 'error',
      malicious: 0,
      suspicious: 0,
      harmless: 0,
      undetected: 0,
      total: 0,
      error: error.message,
    };
  }
}

/**
 * Check a URL against VirusTotal database
 */
export async function checkURL(url: string): Promise<VirusTotalResult> {
  try {
    // URL needs to be base64 encoded without padding
    const urlId = Buffer.from(url).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    const data = await makeVTRequest(`/urls/${urlId}`);
    
    if (!data) {
      return {
        status: 'undetected',
        malicious: 0,
        suspicious: 0,
        harmless: 0,
        undetected: 0,
        total: 0,
      };
    }

    const stats = data.data?.attributes?.last_analysis_stats || {};
    const result = parseAnalysisStats(stats);
    
    return {
      ...result,
      permalink: `https://www.virustotal.com/gui/url/${urlId}`,
      analysisDate: data.data?.attributes?.last_analysis_date
        ? new Date(data.data.attributes.last_analysis_date * 1000).toISOString()
        : undefined,
    };
  } catch (error: any) {
    return {
      status: 'error',
      malicious: 0,
      suspicious: 0,
      harmless: 0,
      undetected: 0,
      total: 0,
      error: error.message,
    };
  }
}

/**
 * Check an IP address against VirusTotal database
 */
export async function checkIPAddress(ip: string): Promise<VirusTotalResult> {
  try {
    const data = await makeVTRequest(`/ip_addresses/${ip}`);
    
    if (!data) {
      return {
        status: 'clean',
        malicious: 0,
        suspicious: 0,
        harmless: 0,
        undetected: 0,
        total: 0,
      };
    }

    const stats = data.data?.attributes?.last_analysis_stats || {};
    const result = parseAnalysisStats(stats);
    
    return {
      ...result,
      permalink: `https://www.virustotal.com/gui/ip-address/${ip}`,
      analysisDate: data.data?.attributes?.last_analysis_date
        ? new Date(data.data.attributes.last_analysis_date * 1000).toISOString()
        : undefined,
    };
  } catch (error: any) {
    return {
      status: 'error',
      malicious: 0,
      suspicious: 0,
      harmless: 0,
      undetected: 0,
      total: 0,
      error: error.message,
    };
  }
}

/**
 * Submit a URL for scanning (useful for new/unknown URLs)
 */
export async function submitURL(url: string): Promise<{ analysisId: string }> {
  if (!VIRUSTOTAL_API_KEY) {
    throw new Error('VirusTotal API key not configured');
  }

  const formData = new URLSearchParams();
  formData.append('url', url);

  const response = await fetch(`${VT_BASE_URL}/urls`, {
    method: 'POST',
    headers: {
      'x-apikey': VIRUSTOTAL_API_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`VirusTotal API error: ${response.status} ${response.statusText}`);
  }

  const data: any = await response.json();
  return { analysisId: data.data?.id || '' };
}
