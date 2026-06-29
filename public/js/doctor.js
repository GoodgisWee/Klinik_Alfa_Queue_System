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

  let socket = null;
  let myRoom = localStorage.getItem('alfa_room');

  function loadRooms(selected) {
    return fetch('/api/rooms')
      .then((r) => r.json())
      .then(({ rooms }) => {
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
    socket.emit('call', { room: myRoom, number });
    queueInput.value = '';
    queueInput.focus();
  });

  queueInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') callBtn.click();
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
