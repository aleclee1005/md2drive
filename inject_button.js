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
    <button title="Save page as Markdown">
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
    'max-width:260px',
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

  // ── Title dialog ────────────────────────────────────────────────────────────

  function showTitleDialog() {
    const dialogHost = document.createElement('div');
    dialogHost.id = 'ds-dialog-host';
    dialogHost.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647';

    const ds = dialogHost.attachShadow({ mode: 'open' });
    ds.innerHTML = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,.45);
          display: flex; align-items: center; justify-content: center;
        }
        .dialog {
          background: #fff; border-radius: 14px;
          padding: 22px 20px 18px; width: 340px;
          box-shadow: 0 8px 40px rgba(0,0,0,.25);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .dlg-title { font-size: 14px; font-weight: 700; color: #202124; margin-bottom: 4px; }
        .dlg-sub { font-size: 11px; color: #80868b; margin-bottom: 12px; }
        input {
          width: 100%; padding: 9px 12px;
          border: 1.5px solid #dadce0; border-radius: 8px;
          font-size: 13px; font-family: inherit; outline: none; color: #202124;
        }
        input:focus { border-color: #34a853; }
        .buttons { display: flex; gap: 8px; margin-top: 14px; justify-content: center; }
        button {
          padding: 8px 18px; border: none; border-radius: 8px;
          font-size: 13px; font-family: inherit; cursor: pointer; font-weight: 600;
        }
        .cancel { background: #f1f3f4; color: #202124; }
        .cancel:hover { background: #e8eaed; }
        .save-local { background: #1a73e8; color: #fff; }
        .save-local:hover { background: #1557b0; }
        .save-drive { background: #34a853; color: #fff; }
        .save-drive:hover { background: #2d9249; }
        .save-clip { background: #5f6368; color: #fff; }
        .save-clip:hover { background: #3c4043; }
      </style>
      <div class="overlay" id="overlay">
        <div class="dialog">
          <div class="dlg-title">📝 File Title</div>
          <div class="dlg-sub">Name your Markdown file before saving</div>
          <input id="titleInput" type="text" placeholder="Enter title..." />
          <div class="buttons">
            <button class="cancel" id="cancelBtn">Cancel</button>
            <button class="save-local" id="saveLocalBtn">💻 Local</button>
            <button class="save-drive" id="saveDriveBtn">☁️ Drive</button>
            <button class="save-clip" id="saveClipBtn">📋 Copy</button>
          </div>
        </div>
      </div>
    `;

    document.documentElement.appendChild(dialogHost);

    const titleInput = ds.getElementById('titleInput');
    titleInput.value = document.title || '';
    titleInput.focus();
    titleInput.select();

    function closeDialog() { dialogHost.remove(); }

    function confirmSave(method) {
      const customTitle = titleInput.value.trim() || document.title || 'Untitled';
      closeDialog();
      doSave(customTitle, method);
    }

    ds.getElementById('cancelBtn').addEventListener('click', closeDialog);
    ds.getElementById('saveLocalBtn').addEventListener('click', () => confirmSave('local'));
    ds.getElementById('saveDriveBtn').addEventListener('click', () => confirmSave('drive'));
    ds.getElementById('saveClipBtn').addEventListener('click', () => {
      closeDialog();
      chrome.tabs.getCurrent?.();
      sendMsg({ action: 'clipPageToClipboard' });
    });
    ds.getElementById('overlay').addEventListener('click', (e) => {
      if (e.target === ds.getElementById('overlay')) closeDialog();
    });
    titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirmSave('drive');
      if (e.key === 'Escape') closeDialog();
    });
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  function sendMsg(payload) {
    try {
      chrome.runtime.sendMessage(payload);
    } catch (e) {
      if (e.message?.includes('Extension context invalidated')) {
        showFabToast('⚠️ Please refresh the page and try again.', 5000);
      }
    }
  }

  function doSave(customTitle, method) {
    if (method === 'local') {
      showFabToast('Converting...', 8000);
      sendMsg({ action: 'saveCurrentPageLocal', customTitle });
      return;
    }
    chrome.storage.sync.get(['driveFolders', 'activeFolder'], (result) => {
      const folders = result.driveFolders || [];
      if (folders.length === 0) {
        showFabToast('⚠️ Set a Drive folder in the popup first', 4000);
        return;
      }
      const idx = result.activeFolder || 0;
      const folderId = folders[idx]?.id || folders[0].id;
      showFabToast('Converting & uploading...', 8000);
      sendMsg({ action: 'saveCurrentPage', folderId, customTitle });
    });
  }

  // FAB click: open title dialog directly
  const fab = shadow.querySelector('button');
  fab.addEventListener('click', () => showTitleDialog());

  // Result listener
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'saveResult') {
      if (msg.ok) {
        if (msg.fileUrl) {
          toast.style.pointerEvents = 'auto';
          const link = `<a href="${msg.fileUrl}" target="_blank" style="color:#86efac;pointer-events:auto;">Open file</a>`;
          showFabToast(`✓ Saved to Drive! ${link}`, 6000);
          setTimeout(() => { toast.style.pointerEvents = 'none'; }, 6100);
        } else {
          showFabToast('✓ Saved locally!', 4000);
        }
      } else if (msg.error === 'no_folder') {
        showFabToast('⚠️ Set a target folder first', 4000);
      } else {
        showFabToast('✗ Failed: ' + msg.error, 4000);
      }
    }
    if (msg.action === 'clipboardReady') {
      navigator.clipboard.writeText(msg.markdown).then(() => {
        showFabToast('📋 Copied to clipboard!', 3000);
      }).catch(() => {
        showFabToast('✗ Copy failed', 3000);
      });
    }
  });

  document.documentElement.appendChild(host);
  document.documentElement.appendChild(toast);
})();
