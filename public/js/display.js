(function () {
  const rowsEl = document.getElementById('rows');
  const imageEl = document.getElementById('display-image');
  const noImageEl = document.getElementById('no-image-msg');
  const soundOverlay = document.getElementById('enable-sound-overlay');
  const soundOverlayText = document.getElementById('enable-sound-text');

  // ---- Audio (uploaded chime file) ----
  const chimeAudio = new Audio('/sounds/chime.mp3');
  chimeAudio.preload = 'auto';
  let audioUnlocked = false;

  // After a stretch with no sound, the OS audio output device can go idle
  // and "cold start" on the next play() - clipping the first fraction of a
  // second of audio while it spins back up (the symptom: room switches or
  // idle gaps cause the chime's beginning to get cut off, only the second
  // call sounds right). A continuously looping, genuinely silent stream
  // keeps the device warm so real chimes never hit a cold start.
  const keepAliveAudio = new Audio('/sounds/silence.wav');
  keepAliveAudio.loop = true;
  keepAliveAudio.preload = 'auto';

  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true; // set immediately so a second rapid tap can't double-fire
    // Play once (muted) so the browser counts this as the user gesture that
    // unlocks audio - later programmatic play() calls then work without a
    // fresh gesture each time.
    chimeAudio.muted = true;
    chimeAudio.play()
      .then(() => {
        chimeAudio.pause();
        chimeAudio.currentTime = 0;
        chimeAudio.muted = false;
      })
      .catch(() => {
        chimeAudio.muted = false;
      })
      .finally(() => {
        keepAliveAudio.play().catch(() => {});
        // Visible confirmation it worked, instead of the overlay just
        // silently vanishing - then hide it a moment later.
        soundOverlayText.textContent = 'Sound enabled';
        soundOverlay.classList.add('confirmed');
        setTimeout(() => soundOverlay.classList.add('hidden'), 700);
      });
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
    chimeAudio.currentTime = 0;
    chimeAudio.play().catch(() => {});
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
