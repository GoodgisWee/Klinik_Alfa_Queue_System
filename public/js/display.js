(function () {
  const rowsEl = document.getElementById('rows');
  const imageEl = document.getElementById('display-image');
  const noImageEl = document.getElementById('no-image-msg');
  const soundOverlay = document.getElementById('enable-sound-overlay');
  const soundOverlayText = document.getElementById('enable-sound-text');

  // ---- Audio ----
  let audioUnlocked = false;

  // Keep-alive: a looping silent stream prevents the TV's audio device going
  // idle between calls, which would clip the start of the next chime.
  const keepAliveAudio = new Audio('/sounds/silence.wav');
  keepAliveAudio.loop = true;
  keepAliveAudio.preload = 'auto';

  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    // Start keep-alive to warm the audio device. Skipping the muted-chime
    // trick because some TV browsers (e.g. VIDAA OS) ignore the muted flag
    // and play it audibly, causing an unwanted sound on tap.
    keepAliveAudio.play().catch(() => {});
    soundOverlayText.textContent = 'Sound enabled';
    soundOverlay.classList.add('confirmed');
    setTimeout(() => soundOverlay.classList.add('hidden'), 700);
  }

  // Listen on the overlay itself, and also on the whole document (capture
  // phase) as a fallback in case anything ever stops the click from
  // reaching the overlay - any tap/click/keypress anywhere unlocks audio.
  soundOverlay.addEventListener('click', unlockAudio);
  document.addEventListener('click', unlockAudio, true);
  document.addEventListener('touchstart', unlockAudio, true);
  document.addEventListener('keydown', unlockAudio, true);

  function playCallChime() {
    if (!audioUnlocked) return;
    // Create a fresh Audio element each time — TV browsers (e.g. VIDAA OS)
    // often silently fail when replaying a reused element.
    const chime = new Audio('/sounds/chime.mp3');
    chime.play().catch(() => {});
  }

  // ---- Display image ----
  function setImage(url) {
    if (url) {
      imageEl.src = url;
      imageEl.style.display = 'block';
      noImageEl.style.display = 'none';
    } else {
      imageEl.style.display = 'none';
      noImageEl.style.display = 'block';
    }
  }

  fetch('/api/current-image')
    .then((r) => r.json())
    .then((data) => setImage(data.url))
    .catch(() => {});

  // ---- Queue rows ----
  function renderRows(top3, justCalledId) {
    rowsEl.innerHTML = '';
    top3.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'row';

      row.innerHTML = `
        <div class="room-label">${escapeHtml(entry.room.toUpperCase())}</div>
        <div class="number-chip">${escapeHtml(entry.number)}</div>
      `;

      rowsEl.appendChild(row);

      if (justCalledId && entry.id === justCalledId) {
        row.classList.add('blinking');
        setTimeout(() => row.classList.remove('blinking'), 5000);
      }
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Socket.IO ----
  const socket = io();

  socket.on('queue-update', ({ top3, justCalledId }) => {
    renderRows(top3, justCalledId);
    if (justCalledId) playCallChime();
  });

  socket.on('image-updated', ({ url }) => {
    setImage(url);
  });
})();
