// A small "Install app" affordance on the title screen.
// Chromium browsers fire `beforeinstallprompt`, which we hold until the player taps our button.
// iOS Safari has no such event (install is Share > Add to Home Screen), so it gets a one-time hint instead.

const HINT_KEY = 'hollow-tide.install-hint';

function isStandalone() {
  const mm = (q) => typeof matchMedia === 'function' && matchMedia(q).matches;
  return mm('(display-mode: standalone)') || mm('(display-mode: fullscreen)') || navigator.standalone === true;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function setupInstall(getMode, storage) {
  if (typeof document === 'undefined' || isStandalone()) return;
  let deferred = null;
  let dismissed = false;
  let hinted = false;
  try {
    hinted = !!storage?.getItem(HINT_KEY);
  } catch {
    hinted = false;
  }

  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.style.cssText =
    "position:fixed;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));z-index:5;display:none;align-items:center;gap:10px;" +
    "padding:8px 10px 8px 14px;border-radius:18px;background:#34306b;border:2px solid #d9b25a;color:#fdf4dc;" +
    "font:600 14px/1.25 'Poppins','Trebuchet MS',sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.45);max-width:min(86vw,360px);";
  const label = document.createElement('button');
  label.type = 'button';
  label.style.cssText = 'all:unset;cursor:pointer;color:inherit;font:inherit;';
  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', 'Dismiss');
  close.textContent = '×';
  close.style.cssText = 'all:unset;cursor:pointer;font:700 20px/1 sans-serif;padding:2px 6px;opacity:.7;';
  el.append(label, close);
  document.body.appendChild(el);

  const hide = () => {
    dismissed = true;
    el.style.display = 'none';
  };
  close.addEventListener('click', () => {
    if (!deferred && isIOS()) {
      try {
        storage?.setItem(HINT_KEY, '1');
      } catch {
        /* private mode: the hint just comes back next time */
      }
    }
    hide();
  });
  label.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* closed without choosing */
    }
    deferred = null;
    hide();
  });

  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();
    deferred = ev;
  });
  window.addEventListener('appinstalled', hide);

  // update on a slow timer: cheap, and the game state changes rarely
  setInterval(() => {
    const onTitle = getMode() === 'title';
    let msg = '';
    if (!dismissed && onTitle) {
      if (deferred) msg = 'Install Hollow Tide as an app';
      else if (isIOS() && !hinted) msg = 'To install: tap Share, then “Add to Home Screen”';
    }
    if (msg) {
      if (label.textContent !== msg) label.textContent = msg;
      el.style.display = 'flex';
    } else {
      el.style.display = 'none';
    }
  }, 500);
}
