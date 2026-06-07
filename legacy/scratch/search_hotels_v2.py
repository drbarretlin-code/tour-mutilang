import urllib.request
import urllib.parse
import re

def get_hotels_url(query):
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
    url = f"https://www.ask.com/web?q={urllib.parse.quote(query)}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8', errors='ignore')
            urls = re.findall(r'href="([^"]+)"', html)
            clean_urls = []
            for u in urls:
                if 'hotels.com/' in u or 'hotels%2ecom/' in u or 'hotels%2Ecom/' in u:
                    decoded = urllib.parse.unquote(u)
                    if decoded not in clean_urls:
                        clean_urls.append(decoded)
            return clean_urls
    except Exception as e:
        return [str(e)]

print("Terminal 21 Hotels.com URLs:")
for u in get_hotels_url("Grande Centre Point Hotel Terminal 21 hotels.com"):
    print(u)

print("\nCross Pattaya Hotels.com URLs:")
for u in get_hotels_url("Cross Pattaya Oceanphere hotels.com"):
    print(u)
