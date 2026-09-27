import json
from pathlib import Path
path = Path('data/books.json')
books = json.loads(path.read_text())
for book in books:
    if book['rating'] == 4:
        author = book['creator']
        if author in ['Epictetus', 'Nick Land', 'Nick Srnicek', 'Lao Tzu', 'Martin Heidegger', 'Georg Wilhelm Friedrich Hegel', 'Mark Fisher', 'Amy Ireland', 'Sigmund Freud', 'Gilles Deleuze']:
            book['genre'] = 'Philosophy'
        if author in ['Shel Silverstein', 'Mary Oliver', 'Homer']:
            book['genre'] = 'Poetry'
        if author in ['Jeannette Walls', 'D.T. Max']:
            book['genre'] = 'Memoir & biography'
        if author in ['Richard Connell', 'Leo Tolstoy', 'Ursula K. Le Guin', 'James Joyce']:
            book['genre'] = 'Short stories'
        if author in ['Orson Scott Card', 'Andy Weir', 'E.B. White', 'Dima Zales', 'Ransom Riggs', 'Suzanne Collins', 'Lewis Carroll', 'J.K. Rowling', 'Jonathan Swift']:
            book['genre'] = 'Fantasy & science fiction'
        if author == 'Stephen King':
            book['genre'] = 'Horror & the uncanny'
        if author in ['John Green', 'Stephen Chbosky']:
            book['genre'] = 'Coming of age'
path.write_text(json.dumps(books, ensure_ascii=False, indent=2))
