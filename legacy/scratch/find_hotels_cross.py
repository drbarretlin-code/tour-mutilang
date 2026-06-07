import re

with open('scratch/bing_results_cross.html', 'r') as f:
    html = f.read()

for m in re.finditer(r'hotels\.com', html, re.IGNORECASE):
    start = max(0, m.start() - 100)
    end = min(len(html), m.end() + 100)
    print("MATCH:", html[start:end])
    print("-" * 50)
