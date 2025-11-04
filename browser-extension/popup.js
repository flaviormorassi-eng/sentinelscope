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
function updateStatus() {
  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (response) {
      // Status ativo/inativo
      if (response.isEnabled) {
        statusBadge.textContent = 'Ativo';
        statusBadge.className = 'badge active';
      } else {
        statusBadge.textContent = 'Inativo';
        statusBadge.className = 'badge inactive';
      }
      
      // Configurado
      configStatus.textContent = response.hasConfig ? 'Sim' : 'Não';
      
      // Fila
      queueSize.textContent = `${response.queueSize} eventos`;
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
  
  // Adiciona /api/browsing/ingest se não estiver presente
  if (!apiUrl.includes('/api/browsing/ingest')) {
    apiUrl += '/api/browsing/ingest';
  }
  
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
