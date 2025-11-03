# Monitoramento de Rede via Event Sources

Guia completo para configurar agentes externos que enviam dados de navegação para o SentinelScope.

## Visão Geral

Este sistema permite que você colete dados de atividade de rede e navegação do seu computador e os envie para o SentinelScope usando Event Sources e uma API Key segura.

## Configuração Passo a Passo

### 1. Habilitar Monitoramento de Rede no SentinelScope

1. Faça login no SentinelScope
2. Vá em **Settings** (Configurações)
3. Encontre a seção **Privacy & Data Collection**
4. Ative as seguintes opções:
   - ✅ **Browsing Monitoring Consent** (Consentimento de Monitoramento)
   - ✅ **Enable Browsing History Tracking** (Habilitar Rastreamento de Histórico)
5. Clique em **Save Preferences**

### 2. Criar um Event Source

1. Navegue até **Event Sources** no menu lateral
2. Clique em **Create New Source**
3. Preencha os campos:
   - **Name**: "Network Monitoring Agent" (ou qualquer nome descritivo)
   - **Type**: Selecione "API" ou "Agent"
   - **Description**: Opcional - descreva o propósito deste agente
4. Clique em **Create**
5. **IMPORTANTE**: Uma API Key será exibida **apenas uma vez**
   - Copie e salve esta chave imediatamente
   - Você não poderá vê-la novamente
   - Se perder a chave, terá que criar um novo Event Source

### 3. Instalar e Configurar o Agente

#### Opção A: Python

```bash
# Instalar dependências
pip install requests

# Executar em modo de teste
python network-monitoring-agent.py \
  --api-key SUA_API_KEY_AQUI \
  --api-url https://seu-app.replit.app/api/browsing/ingest \
  --simulate

# Executar em modo de produção (requer implementação completa)
python network-monitoring-agent.py --api-key SUA_API_KEY_AQUI
```

#### Opção B: Node.js

```bash
# Instalar dependências
npm install axios

# Executar em modo de teste
node network-monitoring-agent.js \
  --api-key SUA_API_KEY_AQUI \
  --api-url https://seu-app.replit.app/api/browsing/ingest \
  --simulate

# Executar em modo de produção (requer implementação completa)
node network-monitoring-agent.js --api-key SUA_API_KEY_AQUI
```

### 4. Verificar no Dashboard

Após executar o agente:

1. Acesse a página **Network Activity** no SentinelScope
2. Você verá os dados de navegação sendo coletados
3. Use os filtros para buscar por:
   - Domínio específico
   - Endereço IP
   - Navegador
   - Intervalo de datas

## Como Funciona

### Arquitetura

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Seu Computador │         │  Event Source    │         │  SentinelScope  │
│                 │         │  API             │         │  Dashboard      │
│  ┌───────────┐  │         │                  │         │                 │
│  │  Agente   │──┼────────▶│  Valida API Key  │────────▶│  Armazena       │
│  │  Monitor  │  │  HTTPS  │  Verifica        │         │  e Exibe        │
│  └───────────┘  │         │  Permissões      │         │  Dados          │
│                 │         │                  │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

### Formato dos Dados

O agente envia eventos em lotes (JSON):

```json
{
  "events": [
    {
      "domain": "google.com",
      "fullUrl": null,
      "ipAddress": "192.168.1.1",
      "browser": "Chrome (Windows)",
      "protocol": "https"
    },
    {
      "domain": "github.com",
      "ipAddress": "140.82.121.4",
      "browser": "Chrome (Windows)",
      "protocol": "https"
    }
  ]
}
```

### Endpoint da API

```
POST /api/browsing/ingest
```

**Headers:**
```
X-API-Key: sua-api-key-aqui
Content-Type: application/json
```

**Limites:**
- Máximo de 100 eventos por requisição
- Rate limiting aplicado automaticamente
- Eventos duplicados são aceitos

## Privacidade e Segurança

### Proteções Implementadas

1. **Consentimento Explícito**
   - O usuário deve ativar manualmente o monitoramento
   - Pode desativar a qualquer momento

2. **Privacidade de HTTPS**
   - Sites HTTPS: apenas o domínio é armazenado
   - Sites HTTP: URL completa pode ser armazenada
   - Conforme GDPR/LGPD

3. **Autenticação Segura**
   - API Keys com hash SHA-256
   - Verificação timing-safe
   - Chaves únicas por Event Source

4. **Retenção de Dados**
   - Configurável nas Settings
   - Opções: 7, 30, 90 dias ou nunca excluir
   - Exclusão automática conforme política

## Desenvolvimento

### Criar Seu Próprio Agente

Para criar um agente personalizado, implemente:

1. **Captura de Eventos**
   - Monitore conexões DNS
   - Capture requisições HTTP/HTTPS
   - Identifique o navegador usado

2. **Envio de Dados**
   ```python
   import requests
   
   def send_events(api_key, events):
       response = requests.post(
           "https://seu-app.replit.app/api/browsing/ingest",
           headers={"X-API-Key": api_key},
           json={"events": events}
       )
       return response.json()
   ```

3. **Tratamento de Erros**
   - HTTP 401: API Key inválida
   - HTTP 403: Monitoramento não habilitado
   - HTTP 400: Formato de dados inválido

### Exemplos de Uso

#### Monitorar Navegador Chrome (Windows)

Use a extensão [Puppeteer](https://pptr.dev/) ou [Playwright](https://playwright.dev/) para capturar navegação:

```javascript
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('request', request => {
    const url = new URL(request.url());
    captureEvent({
      domain: url.hostname,
      protocol: url.protocol.replace(':', '')
    });
  });
  
  // ... resto do código
})();
```

#### Monitorar Tráfego DNS (Linux)

Use `tcpdump` ou `scapy` para capturar consultas DNS:

```python
from scapy.all import sniff, DNS

def process_packet(packet):
    if packet.haslayer(DNS):
        domain = packet[DNS].qd.qname.decode()
        capture_event(domain)

sniff(filter="udp port 53", prn=process_packet)
```

## Solução de Problemas

### Erro: "API key required"
- Verifique se o header `X-API-Key` está presente
- Certifique-se de copiar a chave completa

### Erro: "Browsing monitoring not enabled"
- Vá em Settings → Privacy & Data Collection
- Ative "Browsing Monitoring Consent"
- Salve as preferências

### Erro: "Invalid API key"
- A API Key pode estar incorreta
- Crie um novo Event Source se necessário

### Eventos não aparecem no Dashboard
- Verifique se o Event Source está ativo
- Confirme que a API URL está correta
- Veja os logs do agente para erros

## Recursos Adicionais

- [Documentação da API](/api-docs)
- [Página de Settings](/settings)
- [Installation Guide](/install-guide)
- [Event Sources](/event-sources)

## Suporte

Se tiver problemas ou dúvidas:

1. Verifique este guia primeiro
2. Consulte a página de Installation Guide
3. Entre em contato via página de Contact

---

**Desenvolvido com ❤️ para SentinelScope**
