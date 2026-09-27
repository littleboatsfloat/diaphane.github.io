"""Build the static site from the curated catalogue JSON files; no network required."""
from pathlib import Path
from html import escape as esc
import json,re
ROOT=Path(__file__).resolve().parent.parent

def e(s):return esc(str(s or ''),quote=True)
def art(name):
 if name not in ['bookshelf','films','records','places']:name='flow'
 suffix = 'supplied' if name != 'flow' else 'fine'
 return f'<img class="ink-drawing" src="assets/drawings/{name}-{suffix}.png" alt="" width="400" height="280">'
def head(title,bodyclass=''):
 return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Books, films, records, writings, and projects collected by the basin."><title>{e(title) if title == 'the basin' else e(title) + ' — the basin'}</title><link rel="stylesheet" href="style.css"><script src="script.js" defer></script></head>
<body class="{bodyclass}"><a class="skip" href="#main">Skip to content</a><header id="top"><a class="site-name" href="index.html">the basin</a><nav aria-label="Main navigation"><a href="index.html#archive">archive</a><a href="writings.html">writings</a><a href="projects.html">projects</a></nav><button class="motion-button" id="motion" type="button" aria-pressed="false" hidden>pause movement</button></header>'''
def foot():return '<footer><a href="index.html">the basin</a><a href="#top">↑ back to top</a></footer></body></html>'
def write(name,content): (ROOT/name).write_text(content)
def tile(title,url,drawing,number):return f'<a class="portal" href="{url}">{art(drawing)}<span class="portal-label"><span class="number">{number}</span><span class="portal-title">{title}</span><span class="arrow">↗</span></span></a>'
home = (ROOT/'data/home.html').read_text().replace('{{FIGURES}}', (ROOT/'data/background.html').read_text())
archive = ''.join(tile(name, name+'.html', name, '0'+str(i+1)) for i,name in enumerate(['bookshelf','films','places','records']))
home = home.replace('{{ARCHIVE}}', archive)
write('index.html', head('the basin','home')+'<main id="main">'+home+'</main>'+foot())

def quote(q):return f'<blockquote><p>“{e(q["text"])}”</p><cite>{e(q["attribution"])}</cite></blockquote>' if q else ''
def featured_section(kind,data):
 config=json.loads((ROOT/'data/featured.json').read_text())[kind]
 entries={entry['id']:entry for entry in data}
 picks=[entries[eid] for eid in config['ids']]
 if kind=='books':picks.sort(key=lambda entry:entry['title'].casefold())
 def cards(duplicate=False):
  result=''
  for entry in picks:
   title=e(entry['title']); cover=e(entry.get('cover',''))
   result+=f'<article class="featured-card"><button type="button" data-open="{entry["id"]}" aria-label="Details for {title}"'+(' tabindex="-1"' if duplicate else '')+f'><span class="featured-art"><img src="{cover}" alt="{title}" decoding="async"></span><span class="featured-title">{title}</span><span class="featured-creator">{e(entry["creator"])}</span></button></article>'
  return result
 text=e(config.get('quote','')).replace('\n','<br>')
 return f'<p class="collection-subtitle">{e(config["subtitle"])}</p><blockquote class="collection-quote"><p>{text}</p><cite>{e(config["attribution"])}</cite></blockquote><section class="featured-section" aria-labelledby="featured-heading"><div class="featured-heading"><h2 id="featured-heading">On my mind lately</h2><span>featured · {len(picks)}</span></div><div class="featured-window" tabindex="0" aria-label="Featured selections; focus to pause and scroll"><div class="featured-track" style="--pan-duration:{len(picks)*16}s"><div class="featured-set">{cards()}</div><div class="featured-set featured-copy" aria-hidden="true">{cards(True)}</div></div></div></section><h2 class="full-collection-heading">The collection</h2>'

def catalogue(name,kind):
 data=json.loads((ROOT/'data'/f'{kind}.json').read_text())
 groups={}
 for entry in data:groups.setdefault(entry['genre'],[]).append(entry)
 html=head(name,'catalogue '+kind)+f'<main id="main"><div class="page-heading"><a class="back" href="index.html#archive">← archive</a><h1>{name}</h1><span class="collection-count">{len(data)} '+('books' if kind=='books' else 'films & television' if kind=='films' else 'records')+'</span></div>'
 html+=featured_section(kind,data)
 html+='<div class="catalogue-controls"><label class="search-label" for="search">Search '+name+'</label><input id="search" type="search" placeholder="'+('Title or author' if kind=='books' else 'Title or artist' if kind=='records' else 'Title or director')+'…" autocomplete="off"><label class="sr-only" for="genre">Genre</label><select id="genre"><option value="">All genres</option>'+''.join(f'<option>{e(g)}</option>' for g in sorted(groups))+'</select><button id="clear-filters" type="button">clear</button><p id="result-count" role="status" aria-live="polite"></p></div>'
 if kind=='books':html+='<p class="catalogue-note">My four- and five-star reads, alongside a few personal additions. Original publication years; covers may show later editions.</p>'
 html+='<p id="no-results" hidden>No matches. Try another title or genre.</p>'
 for genre,entries in sorted(groups.items()):
  html+=f'<section class="genre-group" data-genre="{e(genre)}"><h2>{e(genre)} <span>{len(entries)}</span></h2><div class="shelf-grid">'
  for entry in sorted(entries,key=lambda x:x['title'].casefold()):
   eid=entry['id'];title=e(entry['title']);creator=e(entry['creator']);year=e(entry.get('publicationDate',entry.get('year')) or 'Date unconfirmed');cover=entry.get('cover')
   image=f'<img src="{e(cover)}" alt="{title} — '+('poster' if kind=='films' else 'cover')+'" loading="lazy" decoding="async">' if cover else f'<span class="cover-unavailable"><span>{title}</span><small>Artwork not yet located</small></span>'
   html+=f'<article class="shelf-item" data-search="{e(entry["title"]+" "+entry["creator"])}" data-genre="{e(genre)}"><button class="cover-button" type="button" data-open="{eid}" aria-label="Details for {title}"><span class="cover-frame">{image}</span></button><h3><button type="button" data-open="{eid}">{title}</button></h3><p class="creator">{creator}</p><p class="release-date">{year}</p>'
   if kind=='books' and entry.get('rating'):html+=f'<p class="shelf-rating" aria-label="{entry["rating"]} out of 5 stars">{"★" * entry["rating"]}</p>'
   if entry.get('quote'):html+='<span class="quote-marker">a passage kept ↗</span>'
   html+='</article>'
  html+='</div></section>'
 html+='</main>'
 for entry in data:
  eid=entry['id'];title=e(entry['title']);source=entry.get('source');date=entry.get('publicationDate',entry.get('year')) or 'Date unconfirmed'
  html+=f'<dialog id="{eid}" aria-labelledby="title-{eid}"><button class="close-dialog" aria-label="Close details" type="button">×</button><div class="detail-layout">'
  if entry.get('cover'):html+=f'<img class="detail-cover" src="{e(entry["cover"])}" alt="{title} cover" loading="lazy">'
  html+=f'<div><span class="detail-genre">{e(entry["genre"])}</span><h2 id="title-{eid}">{title}</h2><p class="detail-creator">{e(entry["creator"])}</p><dl><dt>'+('First published' if kind=='books' else 'Released')+f'</dt><dd>{e(date)}</dd>'
  if entry.get('type'):html+=f'<dt>Format</dt><dd>{e(entry["type"])}</dd>'
  if entry.get('rating'):html+=f'<dt>My rating</dt><dd aria-label="{entry["rating"]} out of 5 stars">{"★" * entry["rating"]}</dd>'
  html+='</dl>'
  if entry.get('dateNote'):html+=f'<p class="detail-note">{e(entry["dateNote"])}</p>'
  html+=quote(entry.get('quote'))
  html+='<div class="source-links">'
  if source:html+=f'<a href="{e(source)}" target="_blank" rel="noopener noreferrer">Catalogue reference ↗</a>'
  if entry.get('dateSource'):html+=f'<a href="{e(entry["dateSource"])}" target="_blank" rel="noopener noreferrer">Publication source ↗</a>'
  if entry.get('artSource'):html+=f'<a href="{e(entry["artSource"])}" target="_blank" rel="noopener noreferrer">Artwork source ↗</a>'
  html+='</div></div></div></dialog>'
 write(name+'.html',html+foot())
for name,kind in [('bookshelf','books'),('films','films'),('records','records')]:catalogue(name,kind)
for name,title,drawing,parent in [('places','places','places','archive'),('fiction','fiction','writings','writings'),('essays','essays','writings','writings')]:
 back='writings.html' if parent=='writings' else 'index.html#archive' if parent=='archive' else 'index.html'
 write(name+'.html',head(title)+f'<main id="main"><div class="page-heading"><a class="back" href="{back}">← {parent}</a><h1>{title}</h1></div><div class="quiet-page">{art(drawing)}</div></main>'+foot())
writing_quote = re.search(r'<blockquote class="writing-quote">.*?</blockquote>', home, re.S).group(0)
write('writings.html',head('writings')+'<main id="main"><div class="page-heading"><a class="back" href="index.html">← home</a><h1>writings</h1></div>'+writing_quote+'<div class="writing-index">'+tile('fiction','fiction.html','writings','01')+tile('essays','essays.html','writings','02')+'</div></main>'+foot())
write('projects.html',head('projects')+'<main id="main"><div class="page-heading"><a class="back" href="index.html">← home</a><h1>projects</h1></div><article class="project-feature"><a class="project-art" href="projects/tabline.html">'+art('projects')+'</a><div><h2><a href="projects/tabline.html">Tabline ↗</a></h2><p>A tool for learning music by ear. Load an audio file, slow it down, loop a phrase, and write tablature directly along the timeline as you listen.</p><p>For guitar, bass, and ukulele, with an optional beat grid, tab import and export, and a saved-tab library in your browser. Audio stays on your device.</p><a class="text-link" href="projects/tabline.html">open Tabline ↗</a></div></article></main>'+foot())
print('Built homepage, 3 catalogues, writings, projects, and reserved sections.')
