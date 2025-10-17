export function attachErrorOverlay() {
  if ((window as any).__nabdOverlayAttached) return;
  (window as any).__nabdOverlayAttached = true;
  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;z-index:999999;bottom:10px;left:10px;max-width:50vw;background:#111827;color:#fff;padding:10px 12px;border-radius:10px;border:1px solid #ef4444;font:12px/1.4 system-ui;display:none;white-space:pre-wrap;';
  document.addEventListener('DOMContentLoaded', () =>
    document.body.appendChild(box)
  );
  const show = (msg: string) => {
    box.textContent = msg;
    box.style.display = 'block';
  };
  window.addEventListener('error', (e) =>
    show('[Error] ' + (e?.error?.stack || e.message || 'unknown'))
  );
  window.addEventListener('unhandledrejection', (e: any) =>
    show('[Promise] ' + (e?.reason?.stack || e?.reason || 'rejection'))
  );
}