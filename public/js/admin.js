(function () {
  const loginScreen = document.getElementById('login-screen');
  const panelScreen = document.getElementById('panel-screen');
  const logoutBtn = document.getElementById('logout-btn');

  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('login-btn');
  const loginError = document.getElementById('login-error');

  const preview = document.getElementById('preview');
  const fileInput = document.getElementById('file-input');
  const uploadBtn = document.getElementById('upload-btn');
  const uploadStatus = document.getElementById('upload-status');

  function showLogin() {
    loginScreen.classList.remove('hidden');
    panelScreen.classList.add('hidden');
    logoutBtn.classList.add('hidden');
  }

  function showPanel() {
    loginScreen.classList.add('hidden');
    panelScreen.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    loadCurrentImage();
  }

  function loadCurrentImage() {
    fetch('/api/current-image')
      .then((r) => r.json())
      .then(({ url }) => {
        preview.src = url || '';
        preview.style.display = url ? 'block' : 'none';
      });
  }

  loginBtn.addEventListener('click', () => {
    loginError.classList.add('hidden');
    fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput.value }),
    })
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (ok && data.ok) {
          sessionStorage.setItem('alfa_admin', '1');
          showPanel();
        } else {
          loginError.textContent = data.error || 'Wrong password';
          loginError.classList.remove('hidden');
        }
      })
      .catch(() => {
        loginError.textContent = 'Could not reach server';
        loginError.classList.remove('hidden');
      });
  });

  uploadBtn.addEventListener('click', () => {
    const file = fileInput.files[0];
    if (!file) {
      uploadStatus.textContent = 'Choose an image first.';
      return;
    }
    const formData = new FormData();
    formData.append('image', file);

    uploadStatus.textContent = 'Uploading...';
    fetch('/api/upload', { method: 'POST', body: formData })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          uploadStatus.textContent = 'Updated! The display screen now shows this image.';
          preview.src = data.url;
          preview.style.display = 'block';
          fileInput.value = '';
        } else {
          uploadStatus.textContent = data.error || 'Upload failed';
        }
      })
      .catch(() => {
        uploadStatus.textContent = 'Could not reach server';
      });
  });

  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('alfa_admin');
    showLogin();
  });

  // ---- init ----
  if (sessionStorage.getItem('alfa_admin') === '1') {
    showPanel();
  } else {
    showLogin();
  }
})();
