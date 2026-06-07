import re
import urllib.parse
import base64

with open('scratch/bing_results.html', 'r') as f:
    html = f.read()

# Find all hrefs
hrefs = re.findall(r'href="([^"]+)"', html)
print("Total hrefs found:", len(hrefs))
for h in hrefs[:30]:
    print(h)

print("\nChecking for any b64 patterns in hrefs:")
for h in hrefs:
    if 'bing.com' in h or h.startswith('/'):
        continue
    print("External href:", h)
