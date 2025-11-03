#!/usr/bin/env node
/**
 * SentinelScope Network Monitoring Agent (Node.js)
 * -------------------------------------------------
 * Monitora atividade de rede e envia dados para o SentinelScope.
 * 
 * Requisitos:
 * - Node.js 14+
 * - npm install axios
 * 
 * Como usar:
 * 1. Crie um Event Source no SentinelScope (Event Sources page)
 * 2. Copie a API Key gerada
 * 3. Execute: node network-monitoring-agent.js --api-key SUA_API_KEY --simulate
 */

const axios = require('axios');
const os = require('os');

// Configuração
const API_URL = process.env.SENTINELSCOPE_API_URL || 'https://seu-dominio.replit.app/api/browsing/ingest';
const BATCH_SIZE = 50;
const CHECK_INTERVAL = 60000; // 60 segundos

class NetworkMonitorAgent {
  constructor(apiKey, apiUrl = API_URL) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
    this.eventQueue = [];
  }

  getBrowserName() {
    const platform = os.platform();
    
    // Em produção, detectar o processo real do navegador
    if (platform === 'win32') {
      return 'Chrome (Windows)';
    } else if (platform === 'darwin') {
      return 'Safari (macOS)';
    } else {
      return 'Firefox (Linux)';
    }
  }

  captureBrowsingEvent(domain, fullUrl = null, ipAddress = null, protocol = 'https') {
    const event = {
      domain,
      browser: this.getBrowserName(),
      protocol
    };

    if (fullUrl) {
      // Para HTTPS, enviamos apenas o domínio por privacidade
      event.fullUrl = protocol === 'https' ? null : fullUrl;
    }

    if (ipAddress) {
      event.ipAddress = ipAddress;
    }

    this.eventQueue.push(event);
  }

  async sendEvents() {
    if (this.eventQueue.length === 0) {
      return;
    }

    // Envia em lotes
    while (this.eventQueue.length > 0) {
      const batch = this.eventQueue.splice(0, BATCH_SIZE);

      try {
        const response = await axios.post(
          this.apiUrl,
          { events: batch },
          {
            headers: {
              'X-API-Key': this.apiKey,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );

        if (response.status === 200) {
          console.log(`✓ Enviados ${response.data.received || 0} eventos com sucesso`);
        }
      } catch (error) {
        if (error.response) {
          if (error.response.status === 403) {
            console.error('✗ Erro:', error.response.data.message || 'Permissão negada');
            console.error('  → Ative o monitoramento de rede nas Configurações do SentinelScope');
          } else {
            console.error(`✗ Erro HTTP ${error.response.status}:`, error.response.data);
          }
        } else {
          console.error('✗ Erro ao enviar eventos:', error.message);
          // Re-adiciona eventos à fila para tentar novamente
          this.eventQueue.unshift(...batch);
        }
        break;
      }
    }
  }

  simulateBrowsingData() {
    const exampleSites = [
      { domain: 'google.com', ip: '192.168.1.1', protocol: 'https' },
      { domain: 'github.com', ip: '140.82.121.4', protocol: 'https' },
      { domain: 'stackoverflow.com', ip: '151.101.1.69', protocol: 'https' },
      { domain: 'youtube.com', ip: '172.217.14.206', protocol: 'https' },
      { domain: 'reddit.com', ip: '151.101.65.140', protocol: 'https' },
    ];

    exampleSites.forEach(site => {
      this.captureBrowsingEvent(site.domain, null, site.ip, site.protocol);
    });
  }

  async run(simulationMode = false) {
    console.log('🔍 SentinelScope Network Monitoring Agent iniciado');
    console.log(`📡 API URL: ${this.apiUrl}`);
    console.log(simulationMode ? '🧪 Modo de Simulação' : '✓ Modo de Produção');
    console.log('');

    const runCycle = async () => {
      if (simulationMode) {
        // Modo de teste: gera dados de exemplo
        this.simulateBrowsingData();
        console.log(`📊 Gerados ${this.eventQueue.length} eventos de teste`);
      } else {
        // Modo real: monitora tráfego de rede
        console.log('⚠️  Monitoramento real ainda não implementado neste exemplo');
        console.log('   Use --simulate para testar com dados de exemplo');
        process.exit(0);
      }

      // Envia eventos coletados
      await this.sendEvents();

      if (simulationMode) {
        console.log(`\n⏳ Aguardando ${CHECK_INTERVAL / 1000} segundos...\n`);
      }
    };

    // Primeira execução
    await runCycle();

    // Continua se estiver em modo de simulação
    if (simulationMode) {
      const intervalId = setInterval(runCycle, CHECK_INTERVAL);

      // Tratamento de interrupção
      process.on('SIGINT', async () => {
        console.log('\n\n⏹️  Agente interrompido pelo usuário');
        clearInterval(intervalId);
        
        // Envia eventos restantes antes de sair
        if (this.eventQueue.length > 0) {
          console.log('📤 Enviando eventos restantes...');
          await this.sendEvents();
        }
        process.exit(0);
      });
    }
  }
}

// CLI
const args = process.argv.slice(2);
const getArg = (name) => {
  const index = args.indexOf(name);
  return index !== -1 ? args[index + 1] : null;
};

const apiKey = getArg('--api-key');
const apiUrl = getArg('--api-url') || API_URL;
const simulate = args.includes('--simulate');

if (!apiKey) {
  console.error('❌ Erro: --api-key é obrigatório\n');
  console.log('Uso:');
  console.log('  node network-monitoring-agent.js --api-key SUA_API_KEY [--simulate] [--api-url URL]\n');
  console.log('Opções:');
  console.log('  --api-key    API Key do Event Source (obrigatório)');
  console.log('  --simulate   Modo de simulação com dados de exemplo');
  console.log('  --api-url    URL da API (padrão: env SENTINELSCOPE_API_URL)');
  process.exit(1);
}

const agent = new NetworkMonitorAgent(apiKey, apiUrl);
agent.run(simulate);
