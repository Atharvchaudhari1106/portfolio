import urllib.request
import json

url = "https://api.github.com/repos/Atharvchaudhari1106/portfolio/actions/runs?per_page=1"
req = urllib.request.Request(
    url, 
    headers={'User-Agent': 'Mozilla/5.0'}
)

try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        if 'workflow_runs' in data and len(data['workflow_runs']) > 0:
            run = data['workflow_runs'][0]
            print(f"Run ID: {run['id']}")
            print(f"Status: {run['status']}")
            print(f"Conclusion: {run['conclusion']}")
            print(f"Commit Message: {run.get('head_commit', {}).get('message')}")
        else:
            print("No workflow runs found.")
except Exception as e:
    print(f"Error: {e}")
