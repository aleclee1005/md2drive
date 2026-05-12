(function () {
  if (document.getElementById('ds-fab-host')) return;

  const host = document.createElement('div');
  host.id = 'ds-fab-host';
  host.style.cssText = 'all:initial;position:fixed;right:0;top:calc(50% + 88px);z-index:2147483646';

  const shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      button {
        all: unset; box-sizing: border-box;
        display: flex; align-items: center; justify-content: center;
        width: 28px; height: 44px;
        background: #34a853;
        border-radius: 8px 0 0 8px;
        cursor: pointer;
        box-shadow: -2px 0 8px rgba(0,0,0,.25);
        transition: background 0.15s;
      }
      button:hover { background: #2d9249; }
    </style>
    <button title="Save page to Drive (MD)">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z"
              stroke="white" stroke-width="1.4"/>
        <path d="M9 2v4h4M5 8h6M5 11h6M5 5.5h2"
              stroke="white" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
    </button>
  `;

  const toast = document.createElement('div');
  toast.style.cssText = [
    'all:initial',
    'display:none',
    'position:fixed',
    'right:36px',
    'top:calc(50% + 82px)',
    'z-index:2147483645',
    'background:rgba(0,0,0,.82)',
    'color:#fff',
    'border-radius:10px',
    'padding:9px 14px',
    'font-size:12px',
    'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
    'line-height:1.5',
    'max-width:240px',
    'box-shadow:0 2px 10px rgba(0,0,0,.2)',
    'white-space:nowrap',
    'pointer-events:none',
  ].join(';');

  let toastTimer;
  function showFabToast(html, duration) {
    toast.innerHTML = html;
    toast.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.display = 'none'; }, duration || 3500);
  }

  shadow.querySelector('button').addEventListener('click', () => {
    chrome.storage.sync.get(['driveFolders', 'activeFolder'], (result) => {
      const folders = result.driveFolders || [];
      if (folders.length === 0) {
        showFabToast('⚠️ Please set a Drive folder in the extension popup first', 4000);
        return;
      }
      const idx = result.activeFolder || 0;
      const folderId = folders[idx]?.id || folders[0].id;
      showFabToast('Converting & uploading...', 8000);
      chrome.runtime.sendMessage({ action: 'saveCurrentPage', folderId });
    });
  });

  // Listen for result
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'saveResult') {
      if (msg.ok) {
        toast.style.pointerEvents = 'auto';
        const link = msg.fileUrl
          ? `<a href="${msg.fileUrl}" target="_blank" style="color:#86efac;pointer-events:auto;">Open file</a>`
          : '';
        showFabToast(`✓ Saved to Drive! ${link}`, 6000);
        setTimeout(() => { toast.style.pointerEvents = 'none'; }, 6100);
      } else if (msg.error === 'no_folder') {
        showFabToast('⚠️ Please set a target folder first', 4000);
      } else {
        showFabToast('✗ Upload failed: ' + msg.error, 4000);
      }
    }
  });

  document.documentElement.appendChild(host);
  document.documentElement.appendChild(toast);
})();
