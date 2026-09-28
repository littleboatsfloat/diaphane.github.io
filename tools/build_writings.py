"""Render the writing archive and its individual reading pages."""
import json
import re
from html import escape


def build_writings(root, head, foot, write):
    entries = json.loads((root / 'data/writings.json').read_text())
    (root / 'writings').mkdir(exist_ok=True)

    def metadata(entry):
        detail = entry.get('format', f'{entry.get("minutes", 1)} min read')
        return f'<p class="writing-meta"><time datetime="{entry["datetime"]}">{entry["date"]}</time><span>{escape(detail)}</span></p>'

    for category in ('essays', 'fiction'):
        selection = sorted((e for e in entries if e['category'] == category), key=lambda e: e['title'].casefold())
        other = 'fiction' if category == 'essays' else 'essays'
        html = head(category, 'writing-archive')
        html += f'<main id="main"><div class="page-heading"><a class="back" href="index.html#writings">← writings</a><h1>{category}</h1><p class="writing-collection-note">{len(selection)} pieces · a–z</p><a class="writing-switch" href="{other}.html">browse {other} ↗</a></div><div class="writing-list">'
        for i, entry in enumerate(selection, 1):
            url = 'writings/' + entry['slug'] + '.html'
            html += f'<article class="writing-entry"><span class="writing-number" aria-hidden="true">{i:02}</span><div>{metadata(entry)}<h2><a href="{url}">{escape(entry["title"])}</a></h2><p class="writing-blurb">{entry["blurb"]}</p><a class="writing-read" href="{url}" aria-label="Read {escape(entry["title"], quote=True)}">read {"essay" if category == "essays" else "excerpt" if entry.get("format") else "story"} <span aria-hidden="true">↗</span></a></div></article>'
        html += '</div></main>' + foot()
        write(category + '.html', html)

    for entry in entries:
        category = entry['category']
        # Reading pages live one directory beneath the site shell.
        shell = re.sub(r'(href|src)="(?!https?:|#)([^"]+)"', r'\1="../\2"', head(entry['title'], 'writing-reader'))
        description = re.sub('<[^>]+>', '', entry['blurb'])
        shell = shell.replace('Books, films, records, writings, and projects collected by the basin.', escape(description, quote=True))
        html = shell + f'<main id="main"><article><div class="reading-heading"><a class="back" href="../{category}.html">← {category}</a>{metadata(entry)}<h1>{escape(entry["title"])}</h1><p class="reading-deck">{entry["blurb"]}</p></div>'
        if entry.get('pdf'):
            url = '../' + entry['pdf']
            html += f'<div class="pdf-reading"><div class="pdf-actions"><a class="writing-read" href="{url}">open full essay ↗</a><a class="writing-read" href="{url}" download>download PDF ↓</a></div><p class="pdf-note">The complete essay, with figures, footnotes, and references.</p><object class="essay-pdf" data="{url}#view=FitH" type="application/pdf" aria-label="Fossil Fuel Freezeout, complete essay"><p><a href="{url}">Read the complete essay as a PDF.</a></p></object></div>'
        else:
            if entry.get('sections'):
                html += '<details class="reading-contents"><summary>Contents <span aria-hidden="true">+</span></summary><ol>'
                for section in entry['sections']:
                    html += f'<li><a href="#{section["id"]}">{escape(section["title"])}</a></li>'
                html += '</ol></details>'
            html += '<div class="reading-prose">' + (root / 'data/writings' / (entry['slug'] + '.html')).read_text() + '</div>'
        html += f'<div class="reading-end"><span aria-hidden="true">∴</span><a href="../{category}.html">back to {category} ↗</a></div></article></main>'
        html += foot().replace('href="index.html"', 'href="../index.html"')
        write('writings/' + entry['slug'] + '.html', html)
