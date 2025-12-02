# 🛡️ SentinelScope Browser Extension

Extensão de navegador que captura **automaticamente** seu histórico de navegação e envia para o SentinelScope em tempo real.

## 🚀 Instalação Rápida

### Passo 1: Configurar o SentinelScope

1. Acesse o **SentinelScope** no navegador
2. Vá em **Settings** → **Privacy & Data Collection**
3. Ative:
   - ✅ **Browsing Monitoring Consent**
   - ✅ **Enable Browsing History Tracking**
4. Clique em **Save Preferences**

### Passo 2: Criar Event Source

1. No SentinelScope, vá em **Event Sources**
2. Clique em **Create New Source**
3. Preencha:
   - **Name**: "Browser Extension"
   - **Type**: "Agent"
4. Clique em **Create**
5. **⚠️ COPIE A API KEY** (mostrada apenas uma vez!)

### Passo 3: Instalar a Extensão

#### Chrome / Edge / Brave

1. Abra o navegador
2. Digite na barra de endereços:
   - **Chrome**: `chrome://extensions/`
   - **Edge**: `edge://extensions/`
   - **Brave**: `brave://extensions/`
3. Ative o **Modo do desenvolvedor** (canto superior direito)
4. Clique em **Carregar sem compactação**
5. Selecione a pasta `browser-extension`
6. Pronto! A extensão foi instalada ✓

#### Firefox

1. Digite na barra de endereços: `about:debugging#/runtime/this-firefox`
2. Clique em **Carregar extensão temporária**
3. Selecione o arquivo `manifest.json` dentro da pasta `browser-extension`
4. Pronto! A extensão foi instalada ✓

### Passo 4: Configurar a Extensão

1. Clique no ícone da extensão **🛡️ SentinelScope** na barra de ferramentas
2. Preencha:
   - **URL do SentinelScope**: sua URL base (ex: `http://localhost:3001` em desenvolvimento ou o domínio de produção)
   - **API Key**: Cole a chave que você copiou no Passo 2
3. Marque **✓ Ativar monitoramento**
4. Clique em **💾 Salvar Configuração**

## ✅ Pronto!

A partir de agora, **toda página que você visitar** será automaticamente registrada no SentinelScope!

Acesse **Network Activity** no SentinelScope para ver seus dados em tempo real.

## 🔧 Recursos

- ✅ **Captura automática** de todas as páginas visitadas
- ✅ **Privacidade HTTPS**: Sites seguros mostram apenas o domínio
- ✅ **Envio em lotes**: Otimizado para não sobrecarregar a rede
- ✅ **Offline support**: Mantém fila de eventos se perder conexão
- ✅ **Leve e rápido**: Não afeta a performance do navegador

## 📊 Como Funciona

```
Você visita uma página
       ↓
Extensão captura URL, domínio, protocolo
       ↓
Adiciona à fila de eventos
       ↓
Envia em lotes para SentinelScope (a cada 30s ou 20 eventos)
       ↓
Aparece em Network Activity
```

## 🔐 Privacidade

- **Sites HTTPS**: Apenas o domínio é armazenado (ex: `github.com`)
- **Sites HTTP**: URL completa pode ser armazenada
- **Controle total**: Você pode pausar/desativar a qualquer momento
- **Seus dados**: Tudo fica no SEU SentinelScope

## 🛠️ Botões do Popup

- **💾 Salvar Configuração**: Salva URL e API Key
- **📤 Enviar Agora**: Envia eventos da fila imediatamente
- **📊 Abrir Dashboard**: Abre a página Network Activity

## ⚙️ Indicadores de Status

- **Status**: ✅ Ativo ou ❌ Inativo
- **Configurado**: Se URL e API Key estão salvos
- **Fila**: Quantos eventos estão aguardando envio

## 🐛 Solução de Problemas

### Eventos não aparecem no SentinelScope

1. Verifique se a extensão está **ativa** (popup deve mostrar "Status: Ativo")
2. Confirme que o monitoramento está **habilitado** em Settings
3. Verifique se a **API Key** está correta
4. Abra o console do navegador (F12) e procure por erros

### "Monitoramento não habilitado"

- Vá em **Settings** do SentinelScope
- Ative **Browsing Monitoring Consent**
- Salve as preferências

### Extensão não aparece na barra de ferramentas

- Clique no ícone de **extensões** (🧩)
- Procure por "SentinelScope Monitor"
- Clique no ícone de **pin** para fixar na barra

## 🔄 Desinstalar

1. Vá em `chrome://extensions/`
2. Encontre "SentinelScope Monitor"
3. Clique em **Remover**
4. (Opcional) Vá em Event Sources no SentinelScope e delete o source

---

**Desenvolvido com ❤️ para SentinelScope**
