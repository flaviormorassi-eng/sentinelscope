import time
import json
import socket
import os
import sys
import datetime
import subprocess

# Try to import requests and psutil
try:
    import requests
    import psutil
except ImportError:
    print("Error: Missing required packages.")
    print("Please install them using:")
    print("pip install requests psutil")
    sys.exit(1)

# --- Configuration ---
API_BASE_URL = "http://localhost:3001"
# API key must come from env; accept both canonical and legacy names.
API_KEY = os.environ.get("SENTINELSCOPE_API_KEY") or os.environ.get("SentinelScope_API_KEY")
EVENTS_INGEST_URL = f"{API_BASE_URL}/api/ingest/events"

# How often to scan connections (seconds)
SCAN_INTERVAL = 2
# How often to flush the batch to the server (seconds)
FLUSH_INTERVAL = 10
# Max events per flush
batch_size = 50

# Track seen connections to avoid duplicate spam within short windows
# Key: (remote_ip, remote_port), Value: timestamp
recent_connections = {}
SEEN_WINDOW = 60  # Don't report same connection for 60 seconds

# Cache for DNS lookups: {ip: (hostname, timestamp)}
dns_cache = {}
DNS_CACHE_TTL = 3600  # 1 hour cache

SUSPICIOUS_PORTS = {21, 22, 23, 25, 3389, 445, 1433, 3306, 5432}

def extract_port_from_event(ev):
    """Try to extract destination port from fullUrl (tcp://host:port)"""
    full_url = ev.get("fullUrl")
    if not full_url or ":" not in full_url:
        return None
    try:
        tail = str(full_url).rsplit(':', 1)[1]
        return int(tail)
    except Exception:
        return None

def classify_connection_severity(ev):
    port = extract_port_from_event(ev)
    if port in SUSPICIOUS_PORTS:
        return "medium"
    return "low"

def resolve_ip(ip):
    """Resolve IP to hostname with caching"""
    now = time.time()
    if ip in dns_cache:
        hostname, ts = dns_cache[ip]
        if now - ts < DNS_CACHE_TTL:
            return hostname
            
    try:
        # Set a short timeout for DNS lookups
        original_timeout = socket.getdefaulttimeout()
        socket.setdefaulttimeout(2)
        try:
            hostname = socket.gethostbyaddr(ip)[0]
            dns_cache[ip] = (hostname, now)
        except Exception:
            hostname = ip
            dns_cache[ip] = (ip, now)
        finally:
            socket.setdefaulttimeout(original_timeout)
            
        return hostname
    except Exception:
        return ip

def get_process_name(pid):
    try:
        proc = psutil.Process(pid)
        return proc.name()
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
        return "unknown"

def collect_connections_lsof():
    """Fallback using lsof when psutil access is denied"""
    events = []
    current_time = time.time()
    
    # Clean up old entries in recent_connections
    to_remove = [k for k, t in recent_connections.items() if current_time - t > SEEN_WINDOW]
    for k in to_remove:
        del recent_connections[k]
    
    try:
        # -iTCP -sTCP:ESTABLISHED -P -n
        cmd = ["lsof", "-iTCP", "-sTCP:ESTABLISHED", "-P", "-n"]
        # Use subprocess to capturing stdout
        output = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode('utf-8')
        
        # Output format: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
        lines = output.strip().split('\n')
        for line in lines[1:]: # Skip header
            parts = line.split()
            if len(parts) < 8: continue
            
            command = parts[0]
            
            # Find the part that looks like a connection (contains ->)
            name_field = ""
            for part in parts:
                if "->" in part:
                    name_field = part
                    break
            
            if not name_field: continue
            
            try:
                # name_field is like 192.168.1.5:49448->1.1.1.1:443
                local, remote = name_field.split("->")
                if ":" not in remote: continue
                
                # Handle IPv6 brackets if present
                r_ip, r_port = remote.rsplit(':', 1)
                r_ip = r_ip.strip("[]")
                
                # Skip loopback
                if r_ip.startswith("127.") or r_ip == "::1" or r_ip == "localhost":
                    continue
                    
                conn_key = (r_ip, r_port)
                if conn_key in recent_connections:
                    continue

                recent_connections[conn_key] = current_time
                
                # Resolve hostname
                hostname = resolve_ip(r_ip)
                
                # Construct event
                timestamp_iso = datetime.datetime.now().isoformat()
                
                # Better URL formatting using resolved hostname
                if hostname != r_ip:
                    domain = hostname
                    # Try to guess protocol
                    if str(r_port) == '443':
                        full_url = f"https://{hostname}"
                    elif str(r_port) == '80':
                        full_url = f"http://{hostname}"
                    else:
                        full_url = f"tcp://{hostname}:{r_port}"
                else:
                    domain = r_ip
                    full_url = f"tcp://{r_ip}:{r_port}"
                
                event = {
                    "domain": domain,
                    "fullUrl": full_url,
                    "browser": command,
                    "ipAddress": r_ip,
                    "detectedAt": timestamp_iso
                }
                events.append(event)
            except ValueError:
                continue
            
    except Exception as e:
        # lsof might not be installed or return non-zero exit code if no files found
        pass
        
    return events

def collect_connections():
    """
    Scans active TCP connections on the system.
    Returns a list of event dictionaries suitable for the 'browsing/ingest' endpoint.
    """
    events = []
    current_time = time.time()
    
    # Clean up old entries in recent_connections
    to_remove = [k for k, t in recent_connections.items() if current_time - t > SEEN_WINDOW]
    for k in to_remove:
        del recent_connections[k]
        
    try:
        # scan for established TCP connections
        connections = psutil.net_connections(kind='inet')
    except psutil.AccessDenied:
        print("[!] Access Denied (psutil). Falling back to lsof...")
        return collect_connections_lsof()

    for conn in connections:
        # We only care about ESTABLISHED connections going to remote locations
        if conn.status == 'ESTABLISHED' and conn.raddr:
            remote_ip = conn.raddr.ip
            remote_port = conn.raddr.port
            
            # Skip loopback/local traffic usually
            if remote_ip.startswith("127.") or remote_ip == "::1":
                continue
                
            conn_key = (remote_ip, remote_port)
            
            # If we've seen this exact connection recently, skip it
            if conn_key in recent_connections:
                continue
                
            # Log it
            recent_connections[conn_key] = current_time
            
            pid = conn.pid
            proc_name = get_process_name(pid) if pid else "unknown"
            
            # Resolve hostname
            hostname = resolve_ip(remote_ip)
            
            # Construct the event payload matching BrowsingActivity schema
            timestamp_iso = datetime.datetime.now().isoformat()
            
            # Better URL formatting using resolved hostname
            if hostname != remote_ip:
                domain = hostname
                # Try to guess protocol
                if str(remote_port) == '443':
                    full_url = f"https://{hostname}"
                elif str(remote_port) == '80':
                    full_url = f"http://{hostname}"
                else:
                    full_url = f"tcp://{hostname}:{remote_port}"
            else:
                domain = remote_ip
                full_url = f"tcp://{remote_ip}:{remote_port}"
            
            event = {
                "domain": domain,  # Use Hostname if available
                "fullUrl": full_url,
                "browser": proc_name,
                "ipAddress": remote_ip,
                "detectedAt": timestamp_iso
            }
            events.append(event)
            
    return events

def send_batch(events):
    if not events:
        return
        
    url = f"{API_BASE_URL}/api/browsing/ingest"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
    }
    
    # Send as batch array which server accepts
    print(f"[*] Sending {len(events)} events...")
    
    try:
        response = requests.post(url, json=events, headers=headers, timeout=5)
        if response.status_code in (200, 201):
            print(f"[+] Successfully sent {len(events)} events.")
            # Also send a subset as normalized raw events so real-mode Network Flow can stay populated.
            send_flow_events(events[: min(10, len(events))])
        elif response.status_code == 401:
            print("[!] Send Failed 401: Invalid or missing API key.")
            print("    Set SENTINELSCOPE_API_KEY (or legacy SentinelScope_API_KEY) with a valid key.")
        else:
            print(f"[!] Send Failed {response.status_code}: {response.text}")
    except Exception as e:
        print(f"[!] Error sending batch: {e}")

def send_flow_events(events):
    if not events:
        return

    headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
    }

    for ev in events:
        ip = ev.get("ipAddress")
        if not ip:
            continue

        payload = {
            "timestamp": ev.get("detectedAt"),
            "severity": classify_connection_severity(ev),
            "eventType": "network_connection",
            "sourceIp": ip,
            "protocol": ev.get("protocol") or "tcp",
            "action": "observed",
            "message": f"Outbound connection observed: {ev.get('browser','unknown')} -> {ev.get('domain','unknown')}",
            "sourceURL": ev.get("fullUrl"),
            "deviceName": ev.get("browser"),
            "threatVector": "network",
            "rawData": {
                "connection": ev,
                "collector": "network-monitoring-agent.py"
            }
        }

        source_port = extract_port_from_event(ev)
        if source_port is not None:
            payload["sourcePort"] = source_port

        try:
            response = requests.post(EVENTS_INGEST_URL, json=payload, headers=headers, timeout=5)
            if response.status_code not in (200, 201):
                print(f"[!] Flow ingest failed {response.status_code}: {response.text[:120]}")
        except Exception as e:
            print(f"[!] Error sending flow event: {e}")

def main():
    if not API_KEY:
        print("[!] Missing API key.")
        print("    Export SENTINELSCOPE_API_KEY=<your_key> and restart the agent.")
        sys.exit(1)

    print(f"--- SentinelScope Network Agent (Real Mode) ---")
    print(f"Target: {API_BASE_URL}")
    print(f"API Key: {API_KEY[:6]}...")
    print(f"Scanning every {SCAN_INTERVAL}s. Ctrl+C to stop.")
    
    pending_events = []
    last_flush = time.time()
    
    while True:
        try:
            new_events = collect_connections()
            if new_events:
                print(f"Found {len(new_events)} new connections.")
                pending_events.extend(new_events)
            
            # Flush if time or size limit reached
            if (time.time() - last_flush > FLUSH_INTERVAL) or (len(pending_events) >= batch_size):
                if pending_events:
                    send_batch(pending_events)
                    pending_events = []
                last_flush = time.time()
                
            time.sleep(SCAN_INTERVAL)
            
        except KeyboardInterrupt:
            print("\nStopping agent...")
            break
        except Exception as e:
            print(f"\n[!] Unexpected error: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()
