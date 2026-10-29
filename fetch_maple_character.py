import urllib.request
import urllib.parse
import json

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

titles_list = [
    'File:Class Mercedes.png',
    'File:Class Hero.png',
    'File:Class Night Lord.png',
    'File:Class Bishop.png',
    'File:Class Bowmaster.png',
    'File:Class Dual Blade.png',
    'File:Class Phantom.png',
    'File:Class Adele.png',
    'File:Class Lara.png',
    'File:Class Hoyoung.png',
    'File:Class Aran.png',
    'File:Class Evan.png',
    'File:Character Maya.png',
    'File:NPC Maya.png',
    'File:NPC Cody.png',
]

titles = "|".join(titles_list)
url = 'https://maplestory.fandom.com/api.php?action=query&titles=' + urllib.parse.quote(titles) + '&prop=imageinfo&iiprop=url|size&format=json'

req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        for pid, page in data.get('query', {}).get('pages', {}).items():
            if 'imageinfo' in page:
                info = page['imageinfo'][0]
                print(f"FOUND: {page['title']} | {info.get('width')}x{info.get('height')} | {info.get('url')}")
except Exception as e:
    print('Error:', e)
