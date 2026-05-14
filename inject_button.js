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
      button.selecting { background: #ea4335; }
      button.selecting:hover { background: #c5221f; }
    </style>
    <button title="Select area to save">
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

  // ── Selection mode ──────────────────────────────────────────────────────────

  let selMode = false;
  let hovered = null;
  const fab = shadow.querySelector('button');

  const selCSS = document.createElement('style');
  selCSS.textContent = '[data-dshover]{outline:2px solid #34a853!important;outline-offset:2px!important;cursor:crosshair!important;}';

  function enterSelMode() {
    selMode = true;
    fab.classList.add('selecting');
    fab.title = 'Cancel (Esc)';
    document.documentElement.appendChild(selCSS);
    document.addEventListener('mouseover', onOver, true);
    document.addEventListener('mouseout', onOut, true);
    document.addEventListener('click', onPick, true);
    document.addEventListener('keydown', onKey, true);
    showFabToast('🖱 Click area to save<br><span style="font-size:10px;opacity:.7">Esc to cancel</span>', 15000);
  }

  function exitSelMode() {
    selMode = false;
    fab.classList.remove('selecting');
    fab.title = 'Select area to save';
    selCSS.remove();
    document.removeEventListener('mouseover', onOver, true);
    document.removeEventListener('mouseout', onOut, true);
    document.removeEventListener('click', onPick, true);
    document.removeEventListener('keydown', onKey, true);
    if (hovered) { hovered.removeAttribute('data-dshover'); hovered = null; }
  }

  function onOver(e) {
    if (e.target === host || host.contains(e.target) || e.target === toast) return;
    if (hovered) hovered.removeAttribute('data-dshover');
    hovered = e.target;
    hovered.setAttribute('data-dshover', '');
  }

  function onOut(e) {
    if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-dshover')) {
      e.target.removeAttribute('data-dshover');
    }
  }

  function onPick(e) {
    if (e.target === host || host.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    const el = hovered || e.target;
    if (el) el.removeAttribute('data-dshover');
    exitSelMode();
    if (el) showTitleDialog(el.outerHTML);
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      exitSelMode();
      showFabToast('Cancelled', 2000);
    }
  }

  // ── Title dialog ────────────────────────────────────────────────────────────

  function showTitleDialog(html) {
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
        .dlg-title {
          font-size: 14px; font-weight: 700; color: #202124;
          margin-bottom: 4px;
        }
        .dlg-sub {
          font-size: 11px; color: #80868b; margin-bottom: 12px;
        }
        input {
          width: 100%; padding: 9px 12px;
          border: 1.5px solid #dadce0; border-radius: 8px;
          font-size: 13px; font-family: inherit; outline: none;
          color: #202124;
        }
        input:focus { border-color: #34a853; }
        .buttons {
          display: flex; gap: 8px; margin-top: 14px; justify-content: center;
        }
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
      </style>
      <div class="overlay" id="overlay">
        <div class="dialog">
          <div class="dlg-title">📝 File Title</div>
          <div class="dlg-sub">Name your Markdown file before saving</div>
          <input id="titleInput" type="text" placeholder="Enter title..." />
          <div class="buttons">
            <button class="cancel" id="cancelBtn">Cancel</button>
            <button class="save-local" id="saveLocalBtn">💾 ↓ Local</button>
            <button class="save-drive" id="saveDriveBtn">☁️ ↑ Drive</button>
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
      const title = titleInput.value.trim() || document.title || 'Untitled';
      closeDialog();
      doSave(html, title, method);
    }

    ds.getElementById('cancelBtn').addEventListener('click', closeDialog);
    ds.getElementById('saveLocalBtn').addEventListener('click', () => confirmSave('local'));
    ds.getElementById('saveDriveBtn').addEventListener('click', () => confirmSave('drive'));
    ds.getElementById('overlay').addEventListener('click', (e) => {
      if (e.target === ds.getElementById('overlay')) closeDialog();
    });
    titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirmSave('drive');
      if (e.key === 'Escape') closeDialog();
    });
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  function doSave(html, customTitle, method) {
    if (method === 'local') {
      showFabToast('Converting...', 8000);
      chrome.runtime.sendMessage({ action: 'saveSelectedContent', html, folderId: null, customTitle, saveMethod: 'local' });
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
      chrome.runtime.sendMessage({ action: 'saveSelectedContent', html, folderId, customTitle, saveMethod: 'drive' });
    });
  }

  // FAB click: toggle selection mode
  fab.addEventListener('click', () => {
    if (selMode) { exitSelMode(); showFabToast('Cancelled', 2000); }
    else enterSelMode();
  });

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
  });

  document.documentElement.appendChild(host);
  document.documentElement.appendChild(toast);
})();
