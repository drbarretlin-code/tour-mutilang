import urllib.request
import urllib.parse
import re

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
url = f"https://www.bing.com/search?q={urllib.parse.quote('Grande Centre Point Hotel Terminal 21 hotels.com')}"
req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8', errors='ignore')
        print("Length of HTML:", len(html))
        print("hotels.com in html:", 'hotels.com' in html.lower())
        with open('scratch/bing_results.html', 'w') as f:
            f.write(html)
except Exception as e:
    print(str(e))
