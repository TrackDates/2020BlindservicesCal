(() => {
  const authEl = document.getElementById('auth');
  function render() {
    if (!window.netlifyIdentity || !authEl) return;
    const user = window.netlifyIdentity.currentUser();
    authEl.innerHTML = '';

    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary';

    if (user) {
      const span = document.createElement('span');
      span.className = 'pill';
      span.textContent = user.email;
      authEl.appendChild(span);

      btn.textContent = 'Log out';
      btn.addEventListener('click', () => window.netlifyIdentity.logout());
      authEl.appendChild(btn);
    } else {
      btn.textContent = 'Sign in';
      btn.addEventListener('click', () => window.netlifyIdentity.open('login'));
      authEl.appendChild(btn);
    }
  }

  window.addEventListener('load', () => {
    if (!window.netlifyIdentity) return;
    window.netlifyIdentity.on('init', render);
    window.netlifyIdentity.on('login', () => { render(); window.netlifyIdentity.close(); });
    window.netlifyIdentity.on('logout', render);
    window.netlifyIdentity.init();
  });
})();
