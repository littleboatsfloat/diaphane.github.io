"""Resolve public catalogue artwork. Run deliberately; never reads the Obsidian vault."""
import concurrent.futures,json,re,time,urllib.request,urllib.parse,unicodedata
from pathlib import Path
from difflib import SequenceMatcher
ROOT=Path(__file__).resolve().parent.parent
CACHE=ROOT/'data'/'lookup-cache';CACHE.mkdir(exist_ok=True)
def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'littleboatsfloat/1.0 personal catalogue','Accept':'application/json,image/*;q=0.9,*/*;q=0.8'})
 with urllib.request.urlopen(req,timeout=18) as r:return r.read(),r.headers.get('Content-Type','')
def norm(s):return re.sub(r'[^a-z0-9]+',' ',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()).strip()
def lookup(term,entity):
 key=re.sub('[^a-zA-Z0-9]','_',term+'_'+entity)
 p=CACHE/(key+'.json')
 if p.exists():return json.loads(p.read_text())
 url='https://itunes.apple.com/search?'+urllib.parse.urlencode({'term':term,'entity':entity,'limit':8,'country':'US'})
 data=json.loads(get(url)[0]);p.write_text(json.dumps(data));return data
queries={'Ahmad Jamal At The Pershing':'Ahmad Jamal at the Pershing','キャット':'Hiroshi Suzuki Cat','Vince & Bola':'Vince Guaraldi Bola','La Rana':'Agustin Pereyra Lucena La Rana','abysskiss / b-sides':'Adrianne Lenker abysskiss','LivePhish 04/03/98 & 04/05/98':'Phish Island Tour','Veneta, OR 8/27/72':'Grateful Dead Sunshine Daydream','Dick\'s Picks Vol. 12: Providence':'Grateful Dead Dicks Picks 12','Dick\'s Picks Vol. 18: Dane County':'Grateful Dead Dicks Picks 18','Debussy / Ravel: String Quartets':'Emerson String Quartet Debussy Ravel','Housecat & Sisyphus 55, Vol. 2':'Housecat Sisyphus 55 Vol 2','Borat: Cultural Learnings of America for Make Benefit Glorious Nation of Kazakhstan':'Borat','The French Dispatch of the Liberty, Kansas Evening Sun':'The French Dispatch'}
def resolve(pair):
 kind,e=pair
 if e.get('cover'):return e
 try:
  if kind=='books':
   if e.get('isbn'):
    url=f"https://covers.openlibrary.org/b/isbn/{e['isbn']}-M.jpg?default=false"
    try:
     body,typ=get(url)
     if 'image' in typ and len(body)>1500:
      p=ROOT/'assets/covers'/(e['id']+'.jpg');p.write_bytes(body);e.update(cover=str(p.relative_to(ROOT)),artSource=url);return e
    except Exception:pass
   url='https://openlibrary.org/search.json?'+urllib.parse.urlencode({'title':e['title'].split(' (')[0].split(':')[0],'author':e['creator'],'limit':3,'fields':'key,title,author_name,cover_i,first_publish_year'})
   data=json.loads(get(url)[0]); matches=data.get('docs',[])
   for m in matches:
    if m.get('cover_i'):
     e['cover']=f"https://covers.openlibrary.org/b/id/{m['cover_i']}-M.jpg";e['artSource']='https://openlibrary.org'+m['key'];break
  else:
   term=queries.get(e['title'],e['title']+' '+(e['creator'] if kind=='records' else ''))
   entity='album' if kind=='records' else ('tvSeason' if e['genre']=='Television' else 'movie')
   results=lookup(term,entity).get('results',[])
   def score(m):
    title=m.get('collectionName','') if kind=='records' or entity=='tvSeason' else m.get('trackName','')
    ts=SequenceMatcher(None,norm(e['title']),norm(title)).ratio()
    if norm(e['title']) in norm(title):ts=max(ts,.92)
    cs=SequenceMatcher(None,norm(e.get('creator','')),norm(m.get('artistName',''))).ratio() if kind=='records' else (1 if str(e['year'])==m.get('releaseDate','')[:4] else 0)
    return .7*ts+.3*cs
   if results:
    m=max(results,key=score);s=score(m)
    e['matchScore']=round(s,2);e['matchedTitle']=m.get('collectionName') if kind=='records' else m.get('trackName',m.get('collectionName'));e['matchedArtist']=m.get('artistName')
    if s>=.63:
     e['cover']=m.get('artworkUrl100','').replace('100x100bb','600x600bb');e['source']=m.get('collectionViewUrl') if kind=='records' else m.get('trackViewUrl',m.get('collectionViewUrl'));e['artSource']=e['source'];e['catalogueYear']=m.get('releaseDate','')[:4];e['catalogueGenre']=m.get('primaryGenreName')
     if kind=='films':e['creator']=m.get('artistName','')
  if e.get('cover') and e['cover'].startswith('http'):
   body,typ=get(e['cover'])
   if 'image' in typ and len(body)>1500:
    p=ROOT/'assets/covers'/(e['id']+'.jpg');p.write_bytes(body);e['remoteCover']=e['cover'];e['cover']=str(p.relative_to(ROOT))
   else:e.pop('cover',None)
 except Exception as ex:e['lookupError']=str(ex)
 return e
if __name__=='__main__':
 for kind in (__import__('sys').argv[1:] or ['records','films','books']):
  path=ROOT/'data'/(kind+'.json');entries=json.loads(path.read_text())
  with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
   result=list(pool.map(resolve,[(kind,e) for e in entries]))
  path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
  print(kind,len(result),'covers',sum(bool(e.get('cover')) for e in result),flush=True)
