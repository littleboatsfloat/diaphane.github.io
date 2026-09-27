"""Read public reference pages for first-publication dates and catalogue artwork."""
import json,re,html,urllib.parse,concurrent.futures
from pathlib import Path
from enrich_catalogue import get,ROOT
book_pages=['The Ocean at the End of the Lane','Harry Potter and the Goblet of Fire',None,'Tractatus Logico-Philosophicus','Hatchet (novel)','Ready Player One','A Breath of Life','Difference and Repetition','Oblivion: Stories','Flowers for Algernon','Simulacra and Simulation','The Lightning Thief','The Complete Stories (Kafka)','The Prisoner of the Caucasus (story)','Looking for Alaska','Ethics (Spinoza book)','The Death of Ivan Ilyich','The Solar Anus','The Waves','Notes from Underground','Either/Or','The Little Prince','Structure, Sign, and Play','Parerga and Paralipomena','Anti-Oedipus','The Decay of Lying','Gravity\'s Rainbow','Where the Sidewalk Ends','Civilization and Its Discontents',None,'Labyrinths',None,'The Dharma Bums','The Laugh of the Medusa',None,'Infinite Jest','Lolita','Naked Lunch','Harry Potter and the Philosopher\'s Stone','The Dead (short story)','Night Shift (short story collection)',None,'Franny and Zooey','A Thousand Plateaus','Freedom from the Known','Intercourse (book)']
film_pages=['Borat','Kingsman: The Secret Service','The Fifth Element','Grosse Pointe Blank','The Love That Remains','Almost Famous','Oldboy (2003 film)','Baby Driver','Poor Things (film)','Rushmore (film)','The Graduate','The Queen\'s Gambit (miniseries)','The Royal Tenenbaums','Eyes Wide Shut','American Beauty (1999 film)','Scarface (1983 film)','Ferris Bueller\'s Day Off','Léon: The Professional','The Big Lebowski','The Departed','The French Dispatch','Doctor Strange (2016 film)','A Clockwork Orange (film)','Coraline (film)','Catch Me If You Can','Good Will Hunting','Up (2009 film)','Arrival (film)','Ratatouille (film)','Her (film)','Hereditary (film)','Django Unchained','The Silence of the Lambs (film)','Inglourious Basterds','Once Upon a Time in Hollywood','The Wolf of Wall Street (2013 film)','Midsommar','Whiplash (2014 film)']
album_pages={'Pink Moon':'Pink Moon','Yankee Hotel Foxtrot':'Yankee Hotel Foxtrot','Sky Blue Sky':'Sky Blue Sky','Painting of a Panic Attack':'Painting of a Panic Attack','Sketches of Brunswick East':'Sketches of Brunswick East','Bryter Layter':'Bryter Layter','Harvest Moon':'Harvest Moon (album)','Elliott Smith':'Elliott Smith (album)','Either/Or':'Either/Or (album)','In Between Dreams':'In Between Dreams','For Emma, Forever Ago':'For Emma, Forever Ago','Blood Bank':'Blood Bank (EP)','Every Kingdom':'Every Kingdom','Repave':'Repave','Carrie & Lowell':'Carrie & Lowell','Capacity':'Capacity (album)','abysskiss / b-sides':'Abysskiss','songs':'Songs (Adrianne Lenker album)','Dragon New Warm Mountain I Believe In You':'Dragon New Warm Mountain I Believe in You','LONG SEASON':'Long Season','Bismillah':'Bismillah (album)','2':'2 (Mac DeMarco album)','Trick':'Trick (Alex G album)','Being So Normal':'Being So Normal','This Old Dog':'This Old Dog','Oncle Jazz':'Oncle Jazz','When We Were Friends':'When We Were Friends','Summer\'s Over':'Summer\'s Over','The Low End Theory':'The Low End Theory','good kid, m.A.A.d city':'Good Kid, M.A.A.D City','Modal Soul':'Modal Soul','Flower Boy':'Flower Boy','DAMN.':'Damn (Kendrick Lamar album)','ye':'Ye (album)','IGOR':'Igor (album)','Circles':'Circles (Mac Miller album)','CALL ME IF YOU GET LOST':'Call Me If You Get Lost','CHROMAKOPIA':'Chromakopia','Music for 18 Musicians':'Music for 18 Musicians','The Moon and the Melodies':'The Moon and the Melodies','Different Trains / Electric Counterpoint':'Different Trains','This Is Happening':'This Is Happening','Random Access Memories':'Random Access Memories','Sylvan Esso':'Sylvan Esso (album)','22, A Million':'22, A Million','Kaya':'Kaya (album)','Junta':'Junta (album)','Without a Net (Live)':'Without a Net','A Live One':'A Live One','Dozin\' at the Knick':'Dozin\' at the Knick','Dick\'s Picks Vol. 12: Providence':'Dick\'s Picks Volume 12','Dick\'s Picks Vol. 18: Dane County':'Dick\'s Picks Volume 18','Farmhouse':'Farmhouse (album)','Veneta, OR 8/27/72':'Sunshine Daydream','Amsterdam':'Amsterdam (Phish album)','Cornell 5/8/77':'Cornell 5/8/77','Rushmore':'Rushmore (soundtrack)','Almost Famous':'Almost Famous (soundtrack)','Garden State':'Garden State (soundtrack)','Troupeau bleu':'Troupeau bleu','Vince & Bola':'Vince Guaraldi, Bola Sete and Friends'}
def clean(s):return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',s))).strip()
def fetch(job):
 kind,e,page=job
 if not page:return e
 try:
  url='https://en.wikipedia.org/wiki/'+urllib.parse.quote(page.replace(' ','_'))
  cp=ROOT/'data/lookup-cache'/('wiki-'+e['id']+'.html')
  if cp.exists():s=cp.read_text()
  else:s=get(url)[0].decode();cp.write_text(s)
  box=re.search(r'<table\b[^>]*class="[^"]*infobox',s)
  if not box:return e
  fragment=s[box.start():];fragment=fragment[:fragment.find('</table>')+8]
  for row in re.findall(r'<tr\b.*?</tr>',fragment,re.S):
   cells=re.findall(r'<t[hd]\b[^>]*>(.*?)</t[hd]>',row,re.S)
   if len(cells)<2:continue
   k=clean(cells[0]);val=clean(cells[1]);val=re.sub(r'\[\d+\]','',val)
   if kind=='books' and k in ['Publication date','Published','Publication dates']:
    e['publicationDate']=val;e['dateSource']=url
   if kind=='records' and k=='Released':e['referenceRelease']=val;e['dateSource']=url
   if kind=='films' and k=='Directed by':e['creator']=val
  if not e.get('cover'):
   im=re.search(r'<img\b[^>]*src="([^"]+)"',fragment)
   if im:
    src=html.unescape(im[1]);src='https:'+src if src.startswith('//') else src
    body,typ=get(src)
    if 'image' in typ and len(body)>1500:
     p=ROOT/'assets/covers'/(e['id']+'.jpg');p.write_bytes(body);e['cover']=str(p.relative_to(ROOT));e['artSource']=url
  e.setdefault('source',url)
 except Exception as ex:e['referenceError']=str(ex)
 return e
if __name__=='__main__':
 for kind in ['films','books','records']:
  path=ROOT/'data'/(kind+'.json');entries=json.loads(path.read_text())
  pages=film_pages if kind=='films' else book_pages if kind=='books' else [album_pages.get(e['title']) if not e.get('cover') else None for e in entries]
  with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:result=list(pool.map(fetch,[(kind,e,p) for e,p in zip(entries,pages)]))
  path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(kind,'covers',sum(bool(e.get('cover')) for e in result),'dates',sum(bool(e.get('publicationDate')) for e in result),flush=True)
