import urllib.request
import urllib.parse
import re
import base64

def get_hotels_url(query):
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
    url = f"https://www.bing.com/search?q={urllib.parse.quote(query)}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8', errors='ignore')
            # Look for bing redirection URLs
            matches = re.findall(r'href="https://www\.bing\.com/ck/a[^\s"\'<>]*"', html)
            clean_urls = []
            for m in matches:
                m = m.replace('href="', '').replace('"', '')
                parsed = urllib.parse.urlparse(m)
                params = urllib.parse.parse_qs(parsed.query)
                u_param = params.get('u')
                if u_param:
                    u_val = u_param[0]
                    if u_val.startswith('a1'):
                        b64_str = u_val[2:]
                        # Add padding if needed
                        b64_str += '=' * (-len(b64_str) % 4)
                        try:
                            decoded = base64.b64decode(b64_str).decode('utf-8', errors='ignore')
                            if 'hotels.com' in decoded and decoded not in clean_urls:
                                clean_urls.append(decoded)
                        except Exception as e:
                            pass
            return clean_urls
    except Exception as e:
        return [str(e)]

print("Terminal 21 Hotels.com URLs:")
for u in get_hotels_url("Grande Centre Point Hotel Terminal 21 site:tw.hotels.com"):
    print(u)

print("\nCross Pattaya Hotels.com URLs:")
for u in get_hotels_url("Cross Pattaya Oceanphere site:tw.hotels.com"):
    print(u)
