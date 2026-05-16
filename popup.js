(function () {
  const saveBtn           = document.getElementById('saveBtn');
  const saveLocalBtn      = document.getElementById('saveLocalBtn');
  const folderPicker      = document.getElementById('folderPicker');
  const localFolderPicker = document.getElementById('localFolderPicker');
  const nameInput         = document.getElementById('nameInput');
  const urlInput          = document.getElementById('urlInput');
  const addBtn            = document.getElementById('addBtn');
  const addStatus         = document.getElementById('addStatus');
  const localPathInput    = document.getElementById('localPathInput');
  const localAddBtn       = document.getElementById('localAddBtn');
  const localAddStatus    = document.getElementById('localAddStatus');
  const addDriveToggle      = document.getElementById('addDriveToggle');
  const addDriveForm        = document.getElementById('addDriveForm');
  const addLocalToggle      = document.getElementById('addLocalToggle');
  const addLocalForm        = document.getElementById('addLocalForm');
  const driveConnectSection    = document.getElementById('driveConnectSection');
  const driveConnectBtn        = document.getElementById('driveConnectBtn');
  const driveConnectStatus     = document.getElementById('driveConnectStatus');
  const driveDisconnectSection = document.getElementById('driveDisconnectSection');
  const driveDisconnectBtn     = document.getElementById('driveDisconnectBtn');

  // ── Google Drive auth check ───────────────────────────────────────────────
  function setConnected(connected) {
    driveConnectSection.style.display    = connected ? 'none'  : 'block';
    driveDisconnectSection.style.display = connected ? 'block' : 'none';
    if (!connected) saveBtn.disabled = true;
    else saveBtn.disabled = folders.length === 0;
  }

  chrome.identity.getAuthToken({ interactive: false }, (token) => {
    setConnected(!chrome.runtime.lastError && !!token);
  });

  driveConnectBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'connectDrive' });
    setTimeout(() => window.close(), 300);
  });

  driveDisconnectBtn.addEventListener('click', () => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        chrome.identity.removeCachedAuthToken({ token }, () => {
          fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`).catch(() => {});
          setConnected(false);
        });
      } else {
        setConnected(false);
      }
    });
  });

  // ── Add folder inline toggles ─────────────────────────────────────────────
  addDriveToggle.addEventListener('click', () => {
    const open = addDriveForm.style.display === 'none';
    addDriveForm.style.display = open ? 'block' : 'none';
    addDriveToggle.textContent = open ? '✕ Cancel' : '＋ Add Folder';
    if (open) nameInput.focus();
  });

  addLocalToggle.addEventListener('click', () => {
    const open = addLocalForm.style.display === 'none';
    addLocalForm.style.display = open ? 'block' : 'none';
    addLocalToggle.textContent = open ? '✕ Cancel' : '＋ Add Folder';
    if (open) localPathInput.focus();
  });

  // ── Drive folders ─────────────────────────────────────────────────────────
  let folders = [];
  let selectedIndex = 0;

  function extractFolderId(input) {
    const s = input.trim();
    const m = s.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    if (/^[a-zA-Z0-9_-]{10,}$/.test(s)) return s;
    return null;
  }

  function setStatus(msg, type) {
    addStatus.textContent = msg;
    addStatus.className = 'status ' + (type || '');
  }

  function saveFolders() {
    chrome.storage.sync.set({ driveFolders: folders, activeFolder: selectedIndex });
  }

  function renderPicker() {
    folderPicker.innerHTML = '';
    if (folders.length === 0) { folderPicker.classList.remove('visible'); return; }
    folderPicker.classList.add('visible');
    folders.forEach((f, i) => {
      const div = document.createElement('label');
      div.className = 'folder-option drive-option' + (i === selectedIndex ? ' selected' : '');
      div.style.cssText = 'padding:5px 7px;gap:5px;';
      div.innerHTML = `
        <input type="radio" name="driveFolder" value="${i}" ${i === selectedIndex ? 'checked' : ''}>
        <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:500;">☁️ ${f.name}</div>
        <button class="btn-danger" style="padding:1px 4px;font-size:10px;flex-shrink:0;" title="Remove">✕</button>
      `;
      div.addEventListener('change', () => {
        selectedIndex = i;
        document.querySelectorAll('.drive-option').forEach((el, j) => el.classList.toggle('selected', j === i));
        saveFolders();
      });
      div.querySelector('.btn-danger').addEventListener('click', (e) => {
        e.preventDefault();
        folders.splice(i, 1);
        if (selectedIndex >= folders.length) selectedIndex = Math.max(0, folders.length - 1);
        saveFolders();
        render();
      });
      folderPicker.appendChild(div);
    });
  }

  function render() {
    renderPicker();
    saveBtn.disabled = folders.length === 0;
  }

  // ── Local folders ─────────────────────────────────────────────────────────
  let localFolders = [];
  let localSelectedIndex = 0;

  function setLocalStatus(msg, type) {
    localAddStatus.textContent = msg;
    localAddStatus.className = 'status ' + (type || '');
  }

  function saveLocalFolders() {
    chrome.storage.sync.set({ localFolders, activeLocalFolder: localSelectedIndex });
  }

  function renderLocalPicker() {
    localFolderPicker.innerHTML = '';
    if (localFolders.length === 0) { localFolderPicker.classList.remove('visible'); return; }
    localFolderPicker.classList.add('visible');
    localFolders.forEach((f, i) => {
      const div = document.createElement('label');
      div.className = 'folder-option local-option' + (i === localSelectedIndex ? ' selected' : '');
      div.style.cssText = 'padding:5px 7px;gap:5px;';
      div.innerHTML = `
        <input type="radio" name="localFolder" value="${i}" ${i === localSelectedIndex ? 'checked' : ''}>
        <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:500;">💻 ${f.name}</div>
        <button class="btn-danger" style="padding:1px 4px;font-size:10px;flex-shrink:0;" title="Remove">✕</button>
      `;
      div.addEventListener('change', () => {
        localSelectedIndex = i;
        document.querySelectorAll('.local-option').forEach((el, j) => el.classList.toggle('selected', j === i));
        saveLocalFolders();
      });
      div.querySelector('.btn-danger').addEventListener('click', (e) => {
        e.preventDefault();
        localFolders.splice(i, 1);
        if (localSelectedIndex >= localFolders.length) localSelectedIndex = Math.max(0, localFolders.length - 1);
        saveLocalFolders();
        renderLocal();
      });
      localFolderPicker.appendChild(div);
    });
  }

  function renderLocal() {
    renderLocalPicker();
    saveLocalBtn.disabled = localFolders.length === 0;
  }

  // ── Page preview ──────────────────────────────────────────────────────────
  chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
    if (!tab?.id) return;

    const titleEl     = document.getElementById('previewTitle');
    const sourceEl    = document.getElementById('previewSource');
    const authorEl    = document.getElementById('previewAuthor');
    const publishedEl = document.getElementById('previewPublished');
    const snippetEl   = document.getElementById('previewSnippet');
    const faviconEl   = document.getElementById('previewFavicon');

    titleEl.textContent = tab.title || 'Untitled';
    try {
      const u = new URL(tab.url || '');
      sourceEl.textContent = '🔗 ' + u.hostname + u.pathname;
    } catch { sourceEl.textContent = tab.url || ''; }
    if (tab.favIconUrl) {
      faviconEl.src = tab.favIconUrl;
      faviconEl.onerror = () => { faviconEl.style.display = 'none'; };
    } else { faviconEl.style.display = 'none'; }

    if (!tab.url?.startsWith('http')) return;
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const m = (names) => {
            for (const n of names) {
              const el = document.querySelector(`meta[property="${n}"],meta[name="${n}"]`);
              if (el?.content) return el.content;
            }
            return '';
          };
          const paraEl = [...document.querySelectorAll('article p, main p, p')]
            .find(p => p.textContent.trim().length > 80);
          return {
            author:    m(['article:author','author','og:article:author','twitter:creator']),
            published: m(['article:published_time','og:article:published_time','datePublished']),
            snippet:   paraEl?.textContent.trim().slice(0, 220) || '',
          };
        },
      });
      if (result.author) {
        authorEl.textContent = '👤 ' + result.author;
        authorEl.style.display = 'block';
      }
      if (result.published) {
        publishedEl.textContent = '📅 ' + result.published.slice(0, 10);
        publishedEl.style.display = 'block';
      }
      if (result.snippet) {
        snippetEl.textContent = result.snippet;
        snippetEl.style.display = '-webkit-box';
      }
    } catch (_) {}

    // MD preview toggle
    const mdToggle  = document.getElementById('mdPreviewToggle');
    const mdBox     = document.getElementById('mdPreviewBox');
    const mdArrow   = document.getElementById('mdPreviewArrow');
    let mdLoaded = false;
    let mdOpen   = true;
    mdArrow.textContent = '▼';
    mdBox.style.display = 'block';

    async function loadMdPreview() {
      if (mdLoaded) return;
      mdLoaded = true;
      try {
        const [{ result: html }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const clone = document.documentElement.cloneNode(true);
            ['script','style','noscript','svg','nav','footer','header','aside'].forEach(tag =>
              clone.querySelectorAll(tag).forEach(el => el.remove())
            );
            return (clone.querySelector('body') || clone).innerHTML;
          },
        });
        const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
        mdBox.textContent = td.turndown(html);
      } catch (e) {
        mdBox.textContent = 'Preview unavailable: ' + e.message;
      }
    }

    loadMdPreview();

    mdToggle.addEventListener('click', async () => {
      mdOpen = !mdOpen;
      mdArrow.textContent = mdOpen ? '▼' : '▶';
      mdBox.style.display = mdOpen ? 'block' : 'none';
      if (mdOpen) loadMdPreview();
    });
  });

  // ── Load from storage ─────────────────────────────────────────────────────
  chrome.storage.sync.get(
    ['driveFolders', 'activeFolder', 'driveFolderId', 'localFolders', 'activeLocalFolder', 'localSubfolder'],
    (result) => {
      // Drive folders (migrate from old single-folder format)
      if (result.driveFolders?.length) {
        folders = result.driveFolders;
        selectedIndex = result.activeFolder || 0;
      } else if (result.driveFolderId) {
        folders = [{ id: result.driveFolderId, name: 'My Folder' }];
        selectedIndex = 0;
        saveFolders();
      }
      render();

      // Local folders (migrate from old single-subfolder format)
      if (result.localFolders?.length) {
        localFolders = result.localFolders;
        localSelectedIndex = result.activeLocalFolder || 0;
      } else if (result.localSubfolder) {
        localFolders = [{ name: 'Local Folder', path: result.localSubfolder }];
        localSelectedIndex = 0;
        saveLocalFolders();
      }
      renderLocal();
    }
  );

  // ── Add Drive folder ──────────────────────────────────────────────────────
  addBtn.addEventListener('click', () => {
    const id = extractFolderId(urlInput.value);
    if (!id) { setStatus('Invalid URL or ID', 'error'); return; }
    const name = nameInput.value.trim() || `Folder ${folders.length + 1}`;
    folders.push({ id, name });
    saveFolders();
    nameInput.value = '';
    urlInput.value = '';
    addDriveForm.style.display = 'none';
    addDriveToggle.textContent = '＋ Add Folder';
    setStatus(`✓ Added: ${name}`, 'ok');
    render();
    setTimeout(() => setStatus(''), 3000);
  });

  // ── Add Local folder ──────────────────────────────────────────────────────
  localAddBtn.addEventListener('click', () => {
    const path = localPathInput.value.trim().replace(/^\/+|\/+$/g, '');
    if (!path) { setLocalStatus('Enter a subfolder name', 'error'); return; }
    localFolders.push({ name: path, path });
    saveLocalFolders();
    localPathInput.value = '';
    addLocalForm.style.display = 'none';
    addLocalToggle.textContent = '＋ Add Folder';
    setLocalStatus(`✓ Added: ${path}`, 'ok');
    renderLocal();
    setTimeout(() => setLocalStatus(''), 3000);
  });

  // ── Save state helpers ────────────────────────────────────────────────────
  const copyClipBtn   = document.getElementById('copyClipBtn');
  const saveStatusMsg = document.getElementById('saveStatusMsg');
  let isSaving = false;

  function setSaving(label) {
    isSaving = true;
    saveBtn.disabled = true;
    saveLocalBtn.disabled = true;
    saveBtn.textContent = label === 'drive' ? '⏳ Saving...' : 'Drive';
    saveLocalBtn.textContent = label === 'local' ? '⏳ Saving...' : '💻 Local';
    saveStatusMsg.style.display = 'none';
  }

  function showResult(ok, message, fileUrl) {
    isSaving = false;
    saveBtn.disabled = folders.length === 0;
    saveLocalBtn.disabled = localFolders.length === 0;
    saveBtn.textContent = 'Drive';
    saveLocalBtn.textContent = '💻 Local';
    saveStatusMsg.style.display = 'block';
    saveStatusMsg.style.background = ok ? '#e6f4ea' : '#fce8e6';
    saveStatusMsg.style.color = ok ? '#1e7e34' : '#c0392b';
    saveStatusMsg.innerHTML = ok
      ? (fileUrl ? `✓ Saved! <a href="${fileUrl}" target="_blank" style="color:#1e7e34;">Open ↗</a>` : '✓ Saved locally!')
      : '✗ ' + (message || 'Save failed');
    setTimeout(() => window.close(), ok ? 2000 : 4000);
  }

  // Listen for save result from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'saveResult' && isSaving) {
      showResult(msg.ok, msg.error, msg.fileUrl);
    }
    if (msg.action === 'driveAuthResult') {
      if (msg.ok) {
        setConnected(true);
      } else {
        driveConnectBtn.textContent = '🔗 Connect Google Drive';
        driveConnectStatus.textContent = '✗ ' + (msg.error || 'Cancelled');
        driveConnectStatus.className = 'status error';
      }
    }
  });

  // ── Copy to Clipboard ─────────────────────────────────────────────────────
  copyClipBtn.addEventListener('click', async () => {
    if (isSaving) return;
    copyClipBtn.textContent = '⏳ Copying...';
    copyClipBtn.disabled = true;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');
      const [{ result: html }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const clone = document.documentElement.cloneNode(true);
          ['script','style','noscript','svg','nav','footer','header','aside'].forEach(tag =>
            clone.querySelectorAll(tag).forEach(el => el.remove())
          );
          return (clone.querySelector('body') || clone).innerHTML;
        },
      });
      const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
      await navigator.clipboard.writeText(td.turndown(html));
      saveStatusMsg.style.display = 'block';
      saveStatusMsg.style.background = '#e6f4ea';
      saveStatusMsg.style.color = '#1e7e34';
      saveStatusMsg.textContent = '📋 Copied to clipboard!';
      setTimeout(() => window.close(), 2000);
    } catch (e) {
      saveStatusMsg.style.display = 'block';
      saveStatusMsg.style.background = '#fce8e6';
      saveStatusMsg.style.color = '#c0392b';
      saveStatusMsg.textContent = '✗ Copy failed: ' + e.message;
    } finally {
      copyClipBtn.textContent = '📋 Copy';
      copyClipBtn.disabled = false;
    }
  });

  // ── Drive ─────────────────────────────────────────────────────────
  saveBtn.addEventListener('click', () => {
    if (folders.length === 0 || isSaving) return;
    const folderId = folders[selectedIndex]?.id || folders[0].id;
    setSaving('drive');
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id) chrome.runtime.sendMessage({ action: 'saveCurrentPage', folderId, tabId: tab.id });
    });
  });

  // ── Save locally ──────────────────────────────────────────────────────────
  saveLocalBtn.addEventListener('click', () => {
    if (localFolders.length === 0 || isSaving) return;
    const subfolderPath = localFolders[localSelectedIndex]?.path || localFolders[0].path;
    setSaving('local');
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id) chrome.runtime.sendMessage({ action: 'saveCurrentPageLocal', subfolderPath, tabId: tab.id });
    });
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function styleOpenLink(a) {
    a.style.cssText = 'all:unset;cursor:pointer;font-size:13px;padding:2px 4px;border-radius:4px;color:#5f6368;flex-shrink:0';
    a.addEventListener('mouseover', () => { a.style.background = '#e8eaed'; });
    a.addEventListener('mouseout',  () => { a.style.background = 'transparent'; });
  }
})();
