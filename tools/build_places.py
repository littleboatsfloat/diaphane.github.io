#!/usr/bin/env python3
"""Build the Places field archive from its canonical media manifest."""

from collections import OrderedDict
from datetime import datetime
from html import escape
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "assets" / "places" / "places-manifest.json"

REGION_NAMES = {
    "alaska": "Alaska",
    "california": "California",
    "colorado": "Colorado",
    "iceland": "Iceland",
    "ireland": "Ireland",
    "italy": "Italy",
    "montana": "Montana",
    "north-carolina": "North Carolina",
    "oregon": "Oregon",
    "switzerland": "Switzerland",
    "washington": "Washington",
    "wyoming": "Wyoming",
}

PLACE_NAMES = {
    "aerial": "From the air",
    "akureyri": "Akureyri",
    "bald-head-island": "Bald Head Island",
    "bainbridge-island": "Bainbridge Island",
    "belpberg": "Belpberg",
    "bern": "Bern",
    "big-sky": "Big Sky",
    "big-sur": "Big Sur",
    "blaskogabyggd": "Bláskógabyggð",
    "blue-lakes-mount-sneffels": "Blue Lakes · Mount Sneffels",
    "boulder": "Boulder",
    "bryson-city": "Bryson City",
    "byron-glacier": "Byron Glacier",
    "cannon-beach": "Cannon Beach",
    "ceann-tra-glanfahan": "Ceann Trá · Glanfahan",
    "darrington": "Darrington",
    "diamond-lake-indian-peaks": "Diamond Lake · Indian Peaks",
    "durham": "Durham",
    "eldora": "Eldora",
    "flateyri": "Flateyri",
    "florence": "Florence",
    "fontana-lake": "Fontana Lake",
    "geneva": "Geneva",
    "girdwood": "Girdwood",
    "grimsey": "Grímsey",
    "hope": "Hope",
    "index": "Index",
    "isafjordur": "Ísafjörður",
    "kandersteg": "Kandersteg",
    "kenai-fjords-national-park": "Kenai Fjords",
    "kerid": "Kerið",
    "lauterbrunnen": "Lauterbrunnen",
    "lucerne": "Lucerne",
    "murren": "Mürren",
    "nederland": "Nederland",
    "oswald-west-state-park": "Oswald West",
    "pine-creek-falls": "Pine Creek Falls",
    "rangarthing-eystra": "Rangárþing eystra",
    "reykjavik": "Reykjavík",
    "riomaggiore": "Riomaggiore",
    "rome": "Rome",
    "seattle": "Seattle",
    "siglufjordur": "Siglufjörður",
    "skaftafell": "Skaftafell",
    "skalanes": "Skálanes",
    "steamboat-springs": "Steamboat Springs",
    "stechelberg-lengwald": "Stechelberg · Lengwald",
    "telluride": "Telluride",
    "thun": "Thun",
    "trummelbach-falls": "Trümmelbach Falls",
    "whittier": "Whittier",
    "yellowstone": "Yellowstone",
}


def dimensions(path: Path) -> tuple[int, int]:
    """Read JPEG dimensions without requiring an imaging dependency."""
    with path.open("rb") as image:
        image.read(2)
        while True:
            marker_start = image.read(1)
            if not marker_start:
                break
            if marker_start != b"\xff":
                continue
            marker = image.read(1)
            while marker == b"\xff":
                marker = image.read(1)
            if marker in (b"\xd8", b"\xd9"):
                continue
            length_bytes = image.read(2)
            if len(length_bytes) != 2:
                break
            length = int.from_bytes(length_bytes, "big")
            if marker and 0xC0 <= marker[0] <= 0xC3:
                image.read(1)
                height = int.from_bytes(image.read(2), "big")
                width = int.from_bytes(image.read(2), "big")
                return width, height
            image.seek(length - 2, 1)
    return 4, 3


def date_label(value: str) -> str:
    return datetime.strptime(value, "%Y-%m-%d").strftime("%B %-d, %Y")


def range_label(items: list[dict]) -> str:
    dates = sorted(item["capture_date"] for item in items if item.get("capture_date"))
    if not dates:
        return "Date unrecorded"
    first, last = date_label(dates[0]), date_label(dates[-1])
    return first if first == last else f"{first} — {last}"


def main() -> None:
    manifest = json.loads(MANIFEST.read_text())
    regions: OrderedDict[str, OrderedDict[str, list[dict]]] = OrderedDict()
    for item in manifest["media"]:
        parts = item["file"].split("/")
        region, place = parts[0], parts[-2]
        regions.setdefault(region, OrderedDict()).setdefault(place, []).append(item)

    total = len(manifest["media"])
    year_values = [int(item["capture_date"][:4]) for item in manifest["media"] if item.get("capture_date")]
    region_nav = "".join(
        f'<a href="#region-{escape(region)}"><span>{escape(REGION_NAMES.get(region, region.title()))}</span>'
        f'<small>{sum(len(items) for items in places.values()):02d}</small></a>'
        for region, places in regions.items()
    )

    media_index = 0
    region_markup = []
    for region_number, (region, places) in enumerate(regions.items(), 1):
        region_count = sum(len(items) for items in places.values())
        place_markup = []
        for place, items in places.items():
            cards = []
            for item in items:
                relative = f'assets/places/{item["file"]}'
                is_video = item["file"].endswith(".mp4")
                if is_video:
                    width, height, shape = 9, 16, "portrait"
                    media = (
                        f'<video src="{escape(relative)}" muted playsinline preload="metadata" '
                        f'aria-label="{escape(item["subject"])}"></video><span class="play-mark" aria-hidden="true">play</span>'
                    )
                else:
                    width, height = dimensions(ROOT / relative)
                    ratio = width / height
                    shape = "wide" if ratio > 1.55 else "landscape" if ratio > 1.08 else "portrait" if ratio < .82 else "square"
                    loading = "eager" if media_index < 3 else "lazy"
                    media = (
                        f'<img src="{escape(relative)}" alt="{escape(item["subject"])}" '
                        f'width="{width}" height="{height}" loading="{loading}" decoding="async">'
                    )
                cards.append(
                    f'<figure class="place-card {shape}"><button class="place-open" type="button" '
                    f'data-index="{media_index}" data-src="{escape(relative)}" data-kind="{"video" if is_video else "image"}" '
                    f'data-subject="{escape(item["subject"])}" data-location="{escape(item["location"])}" '
                    f'data-date="{escape(date_label(item["capture_date"]))}" aria-label="View {escape(item["subject"])}">'
                    f'<span class="place-frame">{media}</span></button>'
                    f'<figcaption><span>{escape(item["subject"])}</span><time datetime="{escape(item["capture_date"])}">'
                    f'{escape(date_label(item["capture_date"]))}</time></figcaption></figure>'
                )
                media_index += 1
            place_markup.append(
                f'<section class="place-group" aria-labelledby="place-{escape(region)}-{escape(place)}">'
                f'<header class="place-group-heading"><h3 id="place-{escape(region)}-{escape(place)}">'
                f'{escape(PLACE_NAMES.get(place, place.replace("-", " ").title()))}</h3>'
                f'<p>{escape(range_label(items))}</p></header><div class="place-grid">{"".join(cards)}</div></section>'
            )
        region_markup.append(
            f'<section class="place-region" id="region-{escape(region)}" aria-labelledby="heading-{escape(region)}">'
            f'<div class="region-heading"><span>{region_number:02d}</span><h2 id="heading-{escape(region)}">'
            f'{escape(REGION_NAMES.get(region, region.title()))}</h2><p>{region_count} image{"s" if region_count != 1 else ""}</p></div>'
            f'{"".join(place_markup)}</section>'
        )

    html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="A field archive of places photographed across mountains, coasts, towns, and trails.">
<title>places — the basin</title><link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
<link rel="stylesheet" href="style.css"><script src="script.js" defer></script><script src="places.js" defer></script></head>
<body class="places-archive"><a class="skip" href="#main">Skip to content</a><header id="top"><a class="site-name" href="index.html">the basin</a>
<nav aria-label="Main navigation"><a href="index.html#archive">archive</a><a href="index.html#writings">writings</a><a href="projects.html">projects</a></nav>
<button class="motion-button" id="motion" type="button" aria-pressed="false" hidden>pause movement</button></header>
<main id="main"><section class="places-intro"><div class="page-heading"><a class="back" href="index.html#archive">← archive</a><h1>places</h1></div>
<div class="places-preface"><p>A field archive of places passed through,<br>returned to, and carried onward.</p>
<dl><div><dt>fragments</dt><dd>{total}</dd></div><div><dt>regions</dt><dd>{len(regions)}</dd></div><div><dt>years</dt><dd>{min(year_values)}—{max(year_values)}</dd></div></dl></div></section>
<nav class="place-index" aria-label="Jump to a region">{region_nav}</nav>
<div class="place-regions">{"".join(region_markup)}</div></main>
<dialog class="place-lightbox" id="place-lightbox" aria-labelledby="place-lightbox-title"><button class="place-close" type="button" aria-label="Close image">×</button>
<div class="lightbox-stage"></div><div class="lightbox-notes"><span class="lightbox-counter" aria-live="polite"></span>
<h2 id="place-lightbox-title"></h2><p class="lightbox-location"></p><time class="lightbox-date"></time>
<div class="lightbox-nav"><button class="lightbox-prev" type="button" aria-label="Previous image">← previous</button><button class="lightbox-next" type="button" aria-label="Next image">next →</button></div></div></dialog>
<footer><a href="index.html">the basin</a><a href="#top">↑ back to top</a></footer></body></html>'''
    (ROOT / "places.html").write_text(html)
    print(f"Built places.html with {total} media items in {len(regions)} regions.")


if __name__ == "__main__":
    main()
