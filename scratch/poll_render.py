import urllib.request
import json
import time

url = "https://aestheticore-backend.onrender.com/api/youtube/batch-stream"
data = json.dumps({"videoIds": ["dQw4w9WgXcQ"]}).encode('utf-8')

req = urllib.request.Request(
    url,
    data=data,
    headers={
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/json'
    },
    method='POST'
)

print(f"Monitoring Render backend stream resolution at: {url}")
start_time = time.time()
max_duration = 300  # 5 minutes max

while time.time() - start_time < max_duration:
    try:
        print(f"[{time.strftime('%H:%M:%S')}] Sending request...")
        with urllib.request.urlopen(req, timeout=30) as response:
            res_data = json.loads(response.read().decode())
            if "dQw4w9WgXcQ" in res_data and "streamUrl" in res_data["dQw4w9WgXcQ"]:
                print("\nSUCCESS! Render resolved YouTube stream URL successfully!")
                print(json.dumps(res_data, indent=2))
                break
            else:
                print(f"Response: {res_data}")
    except Exception as e:
        print(f"Attempt failed: {e}")
    
    print("Waiting 10 seconds before retrying...")
    time.sleep(10)
else:
    print("Failed: Monitoring timed out after 5 minutes.")
