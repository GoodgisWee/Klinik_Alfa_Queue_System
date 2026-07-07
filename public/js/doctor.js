(function () {
  const loginScreen = document.getElementById('login-screen');
  const panelScreen = document.getElementById('panel-screen');
  const logoutBtn = document.getElementById('logout-btn');

  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const roomSelect = document.getElementById('room-select');
  const loginBtn = document.getElementById('login-btn');
  const loginError = document.getElementById('login-error');

  const roomNameEl = document.getElementById('room-name');
  const currentNumberEl = document.getElementById('current-number');
  const queueInput = document.getElementById('queue-input');
  const callBtn = document.getElementById('call-btn');
  const recallBtn = document.getElementById('recall-btn');
  const callError = document.getElementById('call-error');
  const roomStatusTbody = document.querySelector('#room-status-table tbody');

  let allRooms = [];
  const roomStatusMap = {};
  const roomStatusTime = {};

  let socket = null;
  let myRoom = localStorage.getItem('alfa_room');

  function playErrorSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18].forEach((startOffset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.value = 220;
        gain.gain.setValueAtTime(0.35, ctx.currentTime + startOffset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + 0.14);
        osc.start(ctx.currentTime + startOffset);
        osc.stop(ctx.currentTime + startOffset + 0.14);
      });
    } catch (_) {}
  }

  function loadRooms(selected) {
    return fetch('/api/rooms')
      .then((r) => r.json())
      .then(({ rooms }) => {
        allRooms = rooms;
        roomSelect.innerHTML = '';
        rooms.forEach((room) => {
          const opt = document.createElement('option');
          opt.value = room;
          opt.textContent = room;
          if (room === selected) opt.selected = true;
          roomSelect.appendChild(opt);
        });
      });
  }

  function renderRoomOverview() {
    // Find numbers that appear in more than one room
    const numberRooms = {};
    allRooms.forEach((room) => {
      const num = roomStatusMap[room];
      if (!num) return;
      if (!numberRooms[num]) numberRooms[num] = [];
      numberRooms[num].push(room);
    });
    // For each duplicate number, the room with the latest timestamp is (current)
    const roomTag = {};
    Object.values(numberRooms).forEach((rooms) => {
      if (rooms.length < 2) return;
      const newest = rooms.reduce((a, b) =>
        (roomStatusTime[a] || 0) >= (roomStatusTime[b] || 0) ? a : b
      );
      rooms.forEach((room) => {
        roomTag[room] = room === newest ? 'current' : 'old';
      });
    });

    roomStatusTbody.innerHTML = '';
    allRooms.forEach((room) => {
      const number = roomStatusMap[room] || '—';
      const isMyRoom = room === myRoom;
      const tag = roomTag[room];
      const tagHtml = tag
        ? `<span class="ov-tag ov-tag-${tag}">${tag}</span>`
        : '';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="ov-room${isMyRoom ? ' ov-my-room' : ''}">${room}</td><td class="ov-number${number !== '—' ? ' ov-active' : ''}">${tagHtml}${number}</td>`;
      roomStatusTbody.appendChild(tr);
    });
  }

  function initRoomOverview() {
    allRooms.forEach((room) => {
      fetch(`/api/room-status/${encodeURIComponent(room)}`)
        .then((r) => r.json())
        .then(({ number }) => {
          roomStatusMap[room] = number || null;
          if (number) roomStatusTime[room] = Date.now();
          renderRoomOverview();
        });
    });
  }

  function showLogin() {
    loginScreen.classList.remove('hidden');
    panelScreen.classList.add('hidden');
    logoutBtn.classList.add('hidden');
  }

  function showPanel(room) {
    myRoom = room;
    roomNameEl.textContent = room;
    loginScreen.classList.add('hidden');
    panelScreen.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    connectSocket();
    refreshRoomStatus();
    initRoomOverview();
  }

  function refreshRoomStatus() {
    fetch(`/api/room-status/${encodeURIComponent(myRoom)}`)
      .then((r) => r.json())
      .then(({ number }) => updateCurrentNumber(number));
  }

  function updateCurrentNumber(number) {
    currentNumberEl.textContent = number || '—';
    recallBtn.disabled = !number;
  }

  function connectSocket() {
    if (socket) return;
    socket = io();
    socket.on('room-status', (data) => {
      if (data.room === myRoom) updateCurrentNumber(data.number);
      roomStatusMap[data.room] = data.number || null;
      if (data.number) roomStatusTime[data.room] = Date.now();
      renderRoomOverview();
    });
    socket.on('call-error', ({ message }) => {
      callError.textContent = message;
      callError.classList.remove('hidden');
      setTimeout(() => callError.classList.add('hidden'), 5000);
      playErrorSound();
    });
  }

  loginBtn.addEventListener('click', () => {
    loginError.classList.add('hidden');
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const room = roomSelect.value;

    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, room }),
    })
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (ok && data.ok) {
          localStorage.setItem('alfa_room', room);
          showPanel(room);
        } else {
          loginError.textContent = data.error || 'Login failed';
          loginError.classList.remove('hidden');
        }
      })
      .catch(() => {
        loginError.textContent = 'Could not reach server';
        loginError.classList.remove('hidden');
      });
  });

  callBtn.addEventListener('click', () => {
    const number = queueInput.value.trim();
    if (!number || !socket) return;
    callError.classList.add('hidden');
    socket.emit('call', { room: myRoom, number });
    queueInput.value = '';
    queueInput.focus();
  });

  queueInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') callBtn.click();
  });

  queueInput.addEventListener('input', () => {
    callError.classList.add('hidden');
  });

  recallBtn.addEventListener('click', () => {
    if (!socket) return;
    socket.emit('recall', { room: myRoom });
  });

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('alfa_room');
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    myRoom = null;
    showLogin();
  });

  // ---- init ----
  if (myRoom) {
    loadRooms(myRoom).then(() => showPanel(myRoom));
  } else {
    loadRooms().then(showLogin);
  }
})();
