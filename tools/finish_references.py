import json,time,re,html,urllib.parse
from pathlib import Path
from enrich_catalogue import ROOT,get
from reference_catalogue import fetch,film_pages,album_pages
for kind in ['films','records']:
 p=ROOT/'data'/(kind+'.json');entries=json.loads(p.read_text())
 for i,e in enumerate(entries):
  replacements={'record-034':'The Dark Side of the Moon','record-048':'Currents (Tame Impala album)','record-119':"Dick's Picks Volume 18"}
  if e['id'] in replacements:
   e.pop('cover',None);e.pop('source',None)
  if e.get('cover'):continue
  page=(film_pages[i] if kind=='films' else album_pages.get(e['title']))
  if e['id']=='film-30':page='Her (2013 film)'
  if e['id'] in replacements:page=replacements[e['id']]
  if not page:continue
  time.sleep(2)
  cache=ROOT/'data/lookup-cache'/('wiki-'+e['id']+'.html')
  if e['id']=='film-30' and cache.exists():cache.unlink()
  # Cached reference pages are reused; retry artwork after the server's cooldown.
  if cache.exists():
   s=cache.read_text();box=re.search(r'<table\b[^>]*class="[^"]*infobox',s)
   if box:
    segment=s[box.start():]; segment=segment[:segment.find('</table>')+8]
    im=re.search(r'<img\b[^>]*src="([^"]+)"',segment)
    if im:
     src=html.unescape(im[1]);src='https:'+src if src.startswith('//') else src;src=src.split('?')[0]
     try:
      body,typ=get(src)
      if 'image' in typ:
       dest=ROOT/'assets/covers'/(e['id']+'.jpg');dest.write_bytes(body);e['cover']=str(dest.relative_to(ROOT));e['artSource']='https://en.wikipedia.org/wiki/'+urllib.parse.quote(page.replace(' ','_'));e.setdefault('source',e['artSource'])
     except Exception as ex:print('art retry',e['id'],str(ex),flush=True)
  if not e.get('cover'):e=fetch((kind,e,page))
  entries[i]=e;p.write_text(json.dumps(entries,ensure_ascii=False,indent=2)+'\n');print(kind,e['id'],'OK' if e.get('cover') else 'MISSING',flush=True)
