// SentinelScope Background Service Worker

let apiKey = null;
let apiUrl = null;
let isEnabled = false;
let eventQueue = [];
const BATCH_SIZE = 20;
const SEND_INTERVAL = 30000; // 30 segundos

// Carrega configurações ao iniciar
chrome.storage.local.get(['apiKey', 'apiUrl', 'isEnabled'], (result) => {
  apiKey = result.apiKey || null;
  apiUrl = result.apiUrl || null;
  isEnabled = result.isEnabled || false;
  
  if (isEnabled && apiKey && apiUrl) {
    console.log('✓ SentinelScope Monitor ativado');
    startMonitoring();
  }
});

// Escuta mudanças nas configurações
chrome.storage.onChanged.addListener((changes) => {
  if (changes.apiKey) apiKey = changes.apiKey.newValue;
  if (changes.apiUrl) apiUrl = changes.apiUrl.newValue;
  if (changes.isEnabled) {
    isEnabled = changes.isEnabled.newValue;
    if (isEnabled && apiKey && apiUrl) {
      startMonitoring();
    }
  }
});

// Detecta quando uma aba carrega uma nova página
function startMonitoring() {
  chrome.webNavigation.onCompleted.addListener((details) => {
    // Ignora iframes e sub-frames
    if (details.frameId !== 0) return;
    
    // Ignora URLs internas do Chrome
    if (details.url.startsWith('chrome://') || 
        details.url.startsWith('chrome-extension://') ||
        details.url.startsWith('about:')) {
      return;
    }
    
    capturePageVisit(details);
  });
}

// Captura informações da página visitada
async function capturePageVisit(details) {
  if (!isEnabled || !apiKey || !apiUrl) return;
  
  try {
    const url = new URL(details.url);
    const tab = await chrome.tabs.get(details.tabId);
    
    const event = {
      domain: url.hostname,
      fullUrl: url.protocol === 'https:' ? null : details.url, // Privacidade HTTPS
      ipAddress: null, // Não disponível via extension API
      browser: getBrowserName(),
      protocol: url.protocol.replace(':', '')
    };
    
    eventQueue.push(event);
    
    // Envia em lotes quando atinge o limite
    if (eventQueue.length >= BATCH_SIZE) {
      await sendEvents();
    }
  } catch (error) {
    console.error('Erro ao capturar visita:', error);
  }
}

// Detecta o navegador
function getBrowserName() {
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Edg/')) return 'Microsoft Edge';
  if (userAgent.includes('Chrome/')) return 'Google Chrome';
  if (userAgent.includes('Firefox/')) return 'Mozilla Firefox';
  if (userAgent.includes('Safari/')) return 'Safari';
  return 'Unknown Browser';
}

// Envia eventos para o SentinelScope
async function sendEvents() {
  if (eventQueue.length === 0 || !apiKey || !apiUrl) return;
  
  const batch = eventQueue.splice(0, BATCH_SIZE);
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({ events: batch })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✓ ${result.received} eventos enviados para SentinelScope`);
      
      // Atualiza badge
      chrome.action.setBadgeText({ text: result.received.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);
    } else if (response.status === 403) {
      console.error('⚠️  Monitoramento não habilitado no SentinelScope');
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    } else {
      console.error('Erro ao enviar eventos:', response.status);
      // Re-adiciona eventos à fila
      eventQueue.unshift(...batch);
    }
  } catch (error) {
    console.error('Erro de rede:', error);
    // Re-adiciona eventos à fila
    eventQueue.unshift(...batch);
  }
}

// Envia eventos periodicamente
setInterval(() => {
  if (isEnabled && eventQueue.length > 0) {
    sendEvents();
  }
}, SEND_INTERVAL);

// Escuta mensagens do popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getStatus') {
    sendResponse({
      isEnabled,
      hasConfig: !!(apiKey && apiUrl),
      queueSize: eventQueue.length
    });
  } else if (message.action === 'sendNow') {
    sendEvents().then(() => sendResponse({ success: true }));
    return true; // Mantém a conexão aberta para resposta assíncrona
  }
});
