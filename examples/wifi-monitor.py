import time
import json
import socket
import os
import sys
import datetime
import subprocess
import re

# Try to import requests
try:
    import requests
except ImportError:
    print("Error: Missing 'requests' package.")
    print("pip install requests")
    sys.exit(1)

# --- Configuration ---
API_BASE_URL = "http://localhost:3001" 
API_KEY = os.environ.get("SENTINELSCOPE_API_KEY") or os.environ.get("SentinelScope_API_KEY")
SCAN_INTERVAL = 10  # Seconds between scans

# simple MAC OUI lookup (Top common vendors)
VENDORS = {
    "ac:de:48": "Private",
    "b8:5e:71": "Intel",
    "7a:15:59": "Unknown",
    "de:be:b6": "Apple",
    "9e:5d:8f": "Apple",
    "a8:fe:9d": "Apple",
    "bc:d0:74": "Samsung",
    "00:0c:29": "VMware"
    # Add more as needed
}

def get_vendor(mac):
    clean_mac = mac.lower().replace(":", "")
    prefix = mac.lower()[:8] # xx:xx:xx
    # Simplified lookup
    for oui, vendor in VENDORS.items():
        if mac.lower().startswith(oui):
            return vendor
    return "Unknown Vendor"

def scan_network():
    """
    Scans the network using ARP table to find connected devices.
    Returns list of devices.
    """
    devices = []
    try:
        # Run arp -a
        output = subprocess.check_output(["arp", "-a"], stderr=subprocess.DEVNULL).decode('utf-8')
        
        # Regex to parse: ? (10.0.0.1) at b8:xx:xx:xx:xx:xx on en0 ...
        # Standard BSD/MacOS format: ? (IP) at MAC on IFACE
        # Windows format: Interface: ... \n  IP ... MAC ...
        
        lines = output.split('\n')
        for line in lines:
            # MacOS / Linux style
            match = re.search(r"\? \(([\d\.]+)\) at ([0-9a-fA-F:]+) on", line)
            if match:
                ip = match.group(1)
                mac = match.group(2)
                
                # Filter out multicast/broadcast
                if mac == "ff:ff:ff:ff:ff:ff" or ip.startswith("224.") or ip == "255.255.255.255":
                    continue
                
                # Filter out incomplete
                if "incomplete" in mac:
                    continue
                    
                devices.append({"ip": ip, "mac": mac})
                continue
                
            # Windows Style (Simple check)
            # 192.168.1.1       b8-5e-71...     dynamic
            parts = line.split()
            if len(parts) >= 2:
                # Check if first part is IP
                if re.match(r"^[\d\.]+$", parts[0]) and re.match(r"^([0-9a-fA-F]{2}[:-]){5}([0-9a-fA-F]{2})$", parts[1]):
                     devices.append({"ip": parts[0], "mac": parts[1]})

    except Exception as e:
        print(f"[!] Error scanning network: {e}")
        
    return devices

def send_events(devices):
    if not devices:
        return

    url = f"{API_BASE_URL}/api/browsing/ingest"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
    }
    
    events = []
    timestamp = datetime.datetime.now().isoformat()
    
    for device in devices:
        vendor = get_vendor(device['mac'])
        
        # We format it to fit into the 'BrowsingActivity' model for now
        # Domain -> Identifier (MAC)
        # Browser -> Vendor
        # IP -> IP
        event = {
            "domain": f"Device: {device['mac']}", 
            "fullUrl": f"tcp://{device['ip']}",
            "browser": f"NetScan ({vendor})",
            "ipAddress": device['ip'],
            "detectedAt": timestamp,
            "protocol": "arp"
        }
        events.append(event)
        
    print(f"[*] Sending {len(events)} device reports...")
    try:
        response = requests.post(url, json=events, headers=headers, timeout=5)
        if response.status_code not in (200, 201):
             print(f"[!] Server returned {response.status_code}")
    except Exception as e:
        print(f"[!] Failed to send: {e}")

def send_test_threat():
    """Sends a simulated threat event to verify Security Center visibility"""
    url = f"{API_BASE_URL}/api/ingest/events"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
    }
    
    event = {
        "eventType": "network_scan",
        "severity": "high",
        "message": "SIMULATED THREAT: Suspicious device detected performing SQL Injection scanning (from wifi-monitor)",
        "sourceIp": "192.168.1.66",
        "metadata": {
            "tool": "wifi-monitor",
            "simulation": True
        }
    }
    
    print(f"[*] Sending SIMULATED THREAT to Security Center...")
    try:
        # Send as a single object because /api/ingest/events expects an object, not a list
        requests.post(url, json=event, headers=headers, timeout=5)
    except Exception as e:
        print(f"[!] Failed to send simulation: {e}")

def main():
    if not API_KEY:
        print("[!] Missing API key.")
        print("    Export SENTINELSCOPE_API_KEY=<your_key> and restart the agent.")
        sys.exit(1)

    print("--- SentinelScope Wi-Fi Monitor ---")
    print(f"Tracking devices on local network...")
    
    # Send one test threat on startup so the user sees something in Security Center
    send_test_threat()
    
    # Cache to avoid spamming the log with the same static devices every 2 seconds
    # We will only report them once every minute
    seen_devices = {} # mac: last_reported_time
    
    while True:
        try:
            current_time = time.time()
            found_devices = scan_network()
            
            # Filter: only report if new or haven't reported in 60s
            report_batch = []
            
            for dev in found_devices:
                mac = dev['mac']
                if mac not in seen_devices or (current_time - seen_devices[mac] > 60):
                    report_batch.append(dev)
                    seen_devices[mac] = current_time
            
            if report_batch:
                print(f"[+] Detected {len(report_batch)} active devices.")
                # Print them nicely
                for d in report_batch:
                    vendor = get_vendor(d['mac'])
                    print(f"    - {d['ip']} [{d['mac']}] ({vendor})")
                
                send_events(report_batch)
            else:
                # No changes
                pass
                
            time.sleep(SCAN_INTERVAL)
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"[!] Loop error: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()
