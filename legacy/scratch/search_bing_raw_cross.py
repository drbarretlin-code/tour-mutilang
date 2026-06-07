import urllib.request
import urllib.parse
import re

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
query = '"Cross Pattaya" "hotels.com/ho"'
url = f"https://www.bing.com/search?q={urllib.parse.quote(query)}"
req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8', errors='ignore')
        print("Length of HTML:", len(html))
        # Find any substring starting with 'ho' and followed by digits
        ho_ids = re.findall(r'ho\d+', html.lower())
        print("ho IDs found:", list(set(ho_ids)))
except Exception as e:
    print(str(e))
