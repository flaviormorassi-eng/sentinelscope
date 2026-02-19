
import subprocess
import datetime
import time

def collect_connections_lsof():
    """Fallback using lsof when psutil access is denied"""
    events = []
    current_time = time.time()
    
    try:
        # -iTCP -sTCP:ESTABLISHED -P -n
        cmd = ["lsof", "-iTCP", "-sTCP:ESTABLISHED", "-P", "-n"]
        # Use subprocess to capturing stdout
        output = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode('utf-8')
        
        # Output format: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
        lines = output.strip().split('\n')
        print(f"LSOF returned {len(lines)} lines")
        
        for line in lines[1:]: # Skip header
            print(f"DEBUG LINE: {line}")
            parts = line.split()
            if len(parts) < 9: 
                print("DEBUG: too short")
                continue
            
            command = parts[0]
            name_field = parts[-1] 
            
            if "->" not in name_field: 
                print("DEBUG: no arrow")
                continue
            
            try:
                # name_field is like 192.168.1.5:49448->1.1.1.1:443
                local, remote = name_field.split("->")
                if ":" not in remote: 
                    print(f"Skipping remote: {remote}")
                    continue
                
                # Handle IPv6 brackets if present
                r_ip, r_port = remote.rsplit(':', 1)
                r_ip = r_ip.strip("[]")
                
                # Skip loopback
                if r_ip.startswith("127.") or r_ip == "::1" or r_ip == "localhost":
                    print(f"Skipping loopback: {r_ip}")
                    continue
                
                print(f"Found candidate: {r_ip}:{r_port} ({command})")
                
                # Construct event
                timestamp_iso = datetime.datetime.now().isoformat()
                full_url = f"tcp://{r_ip}:{r_port}"
                
                event = {
                    "domain": r_ip,
                    "fullUrl": full_url,
                    "browser": command,
                    "ipAddress": r_ip,
                    "detectedAt": timestamp_iso
                }
                events.append(event)
            except ValueError as e:
                print(f"ValueError: {e}")
                continue
            
    except Exception as e:
        print(f"[!] Error running lsof fallback: {e}")
        
    return events

print("Testing lsof collection...")
events = collect_connections_lsof()
print(f"Events found: {len(events)}")
