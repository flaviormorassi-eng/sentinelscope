#!/usr/bin/env python3
"""
SentinelScope Network Monitoring Agent
---------------------------------------
Este script monitora a atividade de rede e envia dados para o SentinelScope.

Requisitos:
- Python 3.7+
- pip install requests psutil scapy (opcional)

Como usar:
1. Crie um Event Source no SentinelScope (Event Sources page)
2. Copie a API Key gerada
3. Execute: python network-monitoring-agent.py --api-key SUA_API_KEY
"""

import argparse
import json
import time
import requests
import socket
from datetime import datetime
from urllib.parse import urlparse

# Configuração
API_URL = "https://seu-dominio.replit.app/api/browsing/ingest"
BATCH_SIZE = 50  # Envia dados em lotes de 50 eventos
CHECK_INTERVAL = 60  # Verifica a cada 60 segundos

class NetworkMonitorAgent:
    def __init__(self, api_key, api_url=API_URL):
        self.api_key = api_key
        self.api_url = api_url
        self.event_queue = []
        
    def get_browser_name(self):
        """Detecta o navegador em uso (simplificado)"""
        import platform
        system = platform.system()
        
        # Em produção, você deveria detectar o processo do navegador
        # Este é apenas um exemplo
        if system == "Windows":
            return "Chrome (Windows)"
        elif system == "Darwin":
            return "Safari (macOS)"
        else:
            return "Firefox (Linux)"
    
    def monitor_dns_queries(self):
        """
        Monitora consultas DNS (requer permissões de root/admin)
        
        NOTA: Este é um exemplo simplificado. Em produção,
        você deve usar ferramentas como tcpdump ou Wireshark API.
        """
        # Placeholder - implementação real requer scapy ou similar
        pass
    
    def capture_browsing_event(self, domain, full_url=None, ip_address=None, protocol="https"):
        """Captura um evento de navegação"""
        event = {
            "domain": domain,
            "browser": self.get_browser_name(),
            "protocol": protocol
        }
        
        if full_url:
            # Para HTTPS, enviamos apenas o domínio por privacidade
            if protocol == "https":
                event["fullUrl"] = None
            else:
                event["fullUrl"] = full_url
        
        if ip_address:
            event["ipAddress"] = ip_address
            
        self.event_queue.append(event)
        
    def send_events(self):
        """Envia eventos em lote para a API"""
        if not self.event_queue:
            return
        
        # Envia em lotes
        while self.event_queue:
            batch = self.event_queue[:BATCH_SIZE]
            self.event_queue = self.event_queue[BATCH_SIZE:]
            
            try:
                response = requests.post(
                    self.api_url,
                    headers={
                        "X-API-Key": self.api_key,
                        "Content-Type": "application/json"
                    },
                    json={"events": batch},
                    timeout=10
                )
                
                if response.status_code == 200:
                    result = response.json()
                    print(f"✓ Enviados {result.get('received', 0)} eventos com sucesso")
                elif response.status_code == 403:
                    error = response.json()
                    print(f"✗ Erro: {error.get('message', 'Permissão negada')}")
                    print("  → Ative o monitoramento de rede nas Configurações do SentinelScope")
                else:
                    print(f"✗ Erro HTTP {response.status_code}: {response.text}")
                    
            except Exception as e:
                print(f"✗ Erro ao enviar eventos: {e}")
                # Re-adiciona eventos à fila para tentar novamente
                self.event_queue = batch + self.event_queue
                break
    
    def simulate_browsing_data(self):
        """Gera dados de exemplo para teste"""
        example_sites = [
            ("google.com", "192.168.1.1", "https"),
            ("github.com", "140.82.121.4", "https"),
            ("stackoverflow.com", "151.101.1.69", "https"),
            ("youtube.com", "172.217.14.206", "https"),
        ]
        
        for domain, ip, protocol in example_sites:
            self.capture_browsing_event(domain, None, ip, protocol)
    
    def run(self, simulation_mode=False):
        """Executa o agente de monitoramento"""
        print(f"🔍 SentinelScope Network Monitoring Agent iniciado")
        print(f"📡 API URL: {self.api_url}")
        print(f"{'🧪 Modo de Simulação' if simulation_mode else '✓ Modo de Produção'}")
        print()
        
        try:
            while True:
                if simulation_mode:
                    # Modo de teste: gera dados de exemplo
                    self.simulate_browsing_data()
                    print(f"📊 Gerados {len(self.event_queue)} eventos de teste")
                else:
                    # Modo real: monitora tráfego de rede
                    # NOTA: Implementação real requer permissões e bibliotecas especializadas
                    print("⚠️  Monitoramento real ainda não implementado neste exemplo")
                    print("   Use --simulate para testar com dados de exemplo")
                    break
                
                # Envia eventos coletados
                self.send_events()
                
                if simulation_mode:
                    print(f"\n⏳ Aguardando {CHECK_INTERVAL} segundos...\n")
                    time.sleep(CHECK_INTERVAL)
                else:
                    break
                    
        except KeyboardInterrupt:
            print("\n\n⏹️  Agente interrompido pelo usuário")
            # Envia eventos restantes antes de sair
            if self.event_queue:
                print("📤 Enviando eventos restantes...")
                self.send_events()

def main():
    parser = argparse.ArgumentParser(
        description="SentinelScope Network Monitoring Agent"
    )
    parser.add_argument(
        "--api-key",
        required=True,
        help="API Key do Event Source (obtenha em Event Sources > Create)"
    )
    parser.add_argument(
        "--api-url",
        default=API_URL,
        help=f"URL da API (padrão: {API_URL})"
    )
    parser.add_argument(
        "--simulate",
        action="store_true",
        help="Modo de simulação com dados de exemplo"
    )
    
    args = parser.parse_args()
    
    agent = NetworkMonitorAgent(args.api_key, args.api_url)
    agent.run(simulation_mode=args.simulate)

if __name__ == "__main__":
    main()
