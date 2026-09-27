import json,re,html,time,urllib.parse
from pathlib import Path
from enrich_catalogue import ROOT,get
pages={
'book-206601357':'https://www.urbanomic.com/book/cute-accelerationism/',
'book-4929':'https://www.penguinrandomhouse.com/books/118718/kafka-on-the-shore-by-haruki-murakami/',
'book-19499462':'https://www.goodreads.com/en/book/show/19499462-postscript-on-the-societies-of-control',
'book-25463302':'https://www.goodreads.com/en/book/show/25463302-the-elders',
'record-087':'https://music.apple.com/us/album/housecat-sisyphus-55-vol-2/1617863062',
'record-103':'https://classical.music.apple.com/us/album/1452522947',
'record-118':'https://www.livephish.com/LP-378.html',
'record-006':'https://concord.com/concord-albums/vince-and-bola/',
'record-023':'https://album.link/i/1154110761',
'record-072':'https://alicephoebelou.bandcamp.com/album/live-at-funkhaus',
'record-076':'https://pcrc.bandcamp.com/album/bismillah/',
'record-106':'https://domeniquedumont.bandcamp.com/album/people-on-sunday',
'record-109':'https://starfucker.bandcamp.com/album/ambient-1',
'record-121':'https://www.nugs.net/live-download-of-phish-greek-theatre-berkeley-ca-08-06-2010-mp3-flac-or-online-music-streaming/6040.html'
}
for kind in ['books','records','films']:
 p=ROOT/'data'/(kind+'.json');entries=json.loads(p.read_text())
 for e in entries:
  if e.get('cover') and e['id']!='record-006':continue
  time.sleep(1.5)
  try:
   url=pages.get(e['id']) or (e.get('source') if kind=='books' else None)
   if url:
    s=get(url)[0].decode()
    m=re.search(r'<meta[^>]+(?:property|name)=["\']og:image["\'][^>]+content=["\']([^"\']+)',s)
    if not m:m=re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image',s)
    if not m:raise ValueError('No cover metadata')
    src=html.unescape(m[1]);src=urllib.parse.urljoin(url,src)
   elif kind=='films':
    s=(ROOT/'data/lookup-cache'/('wiki-'+e['id']+'.html')).read_text();box=re.search(r'<table\b[^>]*class="[^"]*infobox',s);s=s[box.start():]
    src='https:'+html.unescape(re.search(r'<img[^>]+src="([^"]+)',s)[1]).split('?')[0]
    # Prefer a small display rendition to the original poster file.
    bits=src.split('/wikipedia/en/');src=bits[0]+'/wikipedia/en/thumb/'+bits[1]+'/250px-'+bits[1].split('/')[-1]
    url='https://en.wikipedia.org/wiki/'+e['title'].replace(' ','_')
   else:continue
   body,typ=get(src)
   if 'image' not in typ:raise ValueError('Not an image')
   dest=ROOT/'assets/covers'/(e['id']+'.jpg');dest.write_bytes(body)
   e['cover']=str(dest.relative_to(ROOT));e['artSource']=url
   if kind=='records':e['source']=url
   print(e['id'],'OK',flush=True)
  except Exception as ex:print(e['id'],str(ex),flush=True)
  p.write_text(json.dumps(entries,ensure_ascii=False,indent=2))
