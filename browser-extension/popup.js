// SentinelScope Extension Popup

// Elementos
const apiUrlInput = document.getElementById('apiUrl');
const apiKeyInput = document.getElementById('apiKey');
const isEnabledCheckbox = document.getElementById('isEnabled');
const saveBtn = document.getElementById('saveBtn');
const sendNowBtn = document.getElementById('sendNowBtn');
const openDashboardBtn = document.getElementById('openDashboardBtn');
const helpLink = document.getElementById('helpLink');
const statusBadge = document.getElementById('statusBadge');
const configStatus = document.getElementById('configStatus');
const queueSize = document.getElementById('queueSize');
const messageDiv = document.getElementById('message');

// Carrega configurações salvas
chrome.storage.local.get(['apiKey', 'apiUrl', 'isEnabled'], (result) => {
  if (result.apiUrl) {
    apiUrlInput.value = result.apiUrl;
  }
  if (result.apiKey) {
    apiKeyInput.value = result.apiKey;
  }
  isEnabledCheckbox.checked = result.isEnabled || false;
  
  updateStatus();
});

// Atualiza status
async function updateStatus() {
  // First, rely on local storage for configuration
  chrome.storage.local.get(['isEnabled', 'apiKey', 'apiUrl'], async (local) => {
      const isConfigured = !!(local.apiKey && local.apiUrl);
      const isEnabled = local.isEnabled || false;
      
      let connectionStatus = 'unknown';

      if (isEnabled && isConfigured) {
         try {
             // Check connectivity
             let cleanUrl = local.apiUrl.replace('localhost', '127.0.0.1');
             if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
             if (!cleanUrl.startsWith('http')) cleanUrl = 'http://' + cleanUrl;
             
             // Try a lightweight endpoint
             const controller = new AbortController();
             const id = setTimeout(() => controller.abort(), 2000);
             
             const res = await fetch(`${cleanUrl}/health`, { signal: controller.signal });
             clearTimeout(id);
             
             if (res.ok) {
                 connectionStatus = 'connected';
             } else {
                 connectionStatus = 'error';
             }
         } catch (e) {
             console.log("Check failed", e);
             connectionStatus = 'unreachable';
         }
      }

      if (isEnabled && isConfigured) {
        if (connectionStatus === 'connected') {
            statusBadge.textContent = 'Ativo (Conectado)';
            statusBadge.className = 'badge active';
            statusBadge.style.backgroundColor = '#22c55e';
        } else if (connectionStatus === 'unreachable') {
            statusBadge.textContent = 'Erro de Conexão';
            statusBadge.className = 'badge inactive';
            statusBadge.style.backgroundColor = '#f59e0b'; // Orange
        } else {
            statusBadge.textContent = 'Ativo (Verificando...)';
            statusBadge.className = 'badge active';
        }
      } else {
        statusBadge.textContent = 'Inativo';
        statusBadge.className = 'badge inactive';
        statusBadge.style.backgroundColor = '#ef4444';
      }
      
      configStatus.textContent = isConfigured ? 'Sim' : 'Não';
  });

  // Then try to get dynamic stats (queue) from background
  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (chrome.runtime.lastError) {
      // Ignore errors (service worker might be waking up)
      return;
    }
    if (response) {
      queueSize.textContent = `${response.queueSize || 0} eventos`;
    }
  });
}

// Mostra mensagem temporária
function showMessage(text, isError = false) {
  messageDiv.textContent = text;
  messageDiv.className = `message ${isError ? 'error' : ''}`;
  messageDiv.classList.remove('hidden');
  
  setTimeout(() => {
    messageDiv.classList.add('hidden');
  }, 3000);
}

// Salva configuração
saveBtn.addEventListener('click', () => {
  let apiUrl = apiUrlInput.value.trim();
  const apiKey = apiKeyInput.value.trim();
  const isEnabled = isEnabledCheckbox.checked;
  
  if (!apiUrl || !apiKey) {
    showMessage('Preencha URL e API Key!', true);
    return;
  }
  
  // Remove barra final se houver
  if (apiUrl.endsWith('/')) {
    apiUrl = apiUrl.slice(0, -1);
  }

  // Remove specific endpoints if user pasted full path
  apiUrl = apiUrl.replace(/\/api\/browsing\/ingest\/?$/, '');
  apiUrl = apiUrl.replace(/\/dashboard\/?$/, '');
  
  chrome.storage.local.set({
    apiUrl,
    apiKey,
    isEnabled
  }, () => {
    showMessage('✓ Configuração salva!');
    updateStatus();
  });
});

// Envia eventos agora
sendNowBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'sendNow' }, (response) => {
    if (response && response.success) {
      showMessage('✓ Eventos enviados!');
      updateStatus();
    } else {
      showMessage('Nenhum evento para enviar', true);
    }
  });
});

// Abre dashboard
openDashboardBtn.addEventListener('click', () => {
  let dashboardUrl = apiUrlInput.value.trim();
  
  if (!dashboardUrl) {
    showMessage('Configure a URL primeiro!', true);
    return;
  }
  
  // Remove /api/browsing/ingest se houver
  dashboardUrl = dashboardUrl.replace('/api/browsing/ingest', '');
  
  // Adiciona /network-activity
  chrome.tabs.create({ url: dashboardUrl + '/network-activity' });
});

// Link de ajuda
helpLink.addEventListener('click', (e) => {
  e.preventDefault();
  let helpUrl = apiUrlInput.value.trim();
  
  if (!helpUrl) {
    helpUrl = 'https://github.com/yourusername/sentinelscope';
  } else {
    helpUrl = helpUrl.replace('/api/browsing/ingest', '') + '/install-guide';
  }
  
  chrome.tabs.create({ url: helpUrl });
});

// Atualiza status a cada 2 segundos
setInterval(updateStatus, 2000);
