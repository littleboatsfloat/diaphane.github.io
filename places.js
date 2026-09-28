(() => {
  const dialog = document.querySelector('#place-lightbox');
  if (!dialog) return;

  const cards = [...document.querySelectorAll('.place-open')];
  const stage = dialog.querySelector('.lightbox-stage');
  const title = dialog.querySelector('h2');
  const location = dialog.querySelector('.lightbox-location');
  const date = dialog.querySelector('.lightbox-date');
  const counter = dialog.querySelector('.lightbox-counter');
  const previous = dialog.querySelector('.lightbox-prev');
  const next = dialog.querySelector('.lightbox-next');
  let current = 0;

  function show(index) {
    current = (index + cards.length) % cards.length;
    const card = cards[current];
    stage.replaceChildren();
    const media = document.createElement(card.dataset.kind === 'video' ? 'video' : 'img');
    media.src = card.dataset.src;
    if (card.dataset.kind === 'video') {
      media.controls = true;
      media.autoplay = true;
      media.playsInline = true;
    } else {
      media.alt = card.dataset.subject;
      media.decoding = 'async';
    }
    stage.append(media);
    title.textContent = card.dataset.subject;
    location.textContent = card.dataset.location;
    date.textContent = card.dataset.date;
    date.dateTime = card.querySelector('time')?.dateTime || '';
    counter.textContent = `${String(current + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
  }

  cards.forEach((card, index) => card.addEventListener('click', () => {
    show(index);
    dialog.showModal();
  }));
  dialog.querySelector('.place-close').addEventListener('click', () => dialog.close());
  previous.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') show(current - 1);
    if (event.key === 'ArrowRight') show(current + 1);
  });
  dialog.addEventListener('close', () => stage.replaceChildren());
})();
