import json,time
from enrich_catalogue import ROOT,resolve
for kind in ['films','records']:
 p=ROOT/'data'/(kind+'.json');entries=json.loads(p.read_text())
 for i,e in enumerate(entries):
  if e.get('cover'):continue
  time.sleep(4)
  e.pop('lookupError',None)
  entries[i]=resolve((kind,e))
  p.write_text(json.dumps(entries,ensure_ascii=False,indent=2)+'\n')
  print(e['id'],e['title'],'OK' if e.get('cover') else (e.get('lookupError') or e.get('matchedTitle') or 'no match'),flush=True)
