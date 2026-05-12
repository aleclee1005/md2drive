chrome.runtime.onInstalled.addListener(() => {});

// ── Auth helpers ──────────────────────────────────────────────────────────────

function getToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(token);
    });
  });
}

async function fetchWithAuth(url, options = {}) {
  let token = await getToken(true);
  let res = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    await new Promise(r => chrome.identity.removeCachedAuthToken({ token }, r));
    token = await getToken(true);
    res = await fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
    });
  }
  return res;
}

// ── Drive API upload ──────────────────────────────────────────────────────────

async function uploadToDrive(markdown, title, folderId) {
  const date = new Date().toISOString().slice(0, 10);
  const safeName = title.replace(/[/\\:*?"<>|]/g, '-').trim().slice(0, 100);
  const fileName = `${safeName} — ${date}.md`;

  const boundary = 'drive_sidebar_' + Date.now();
  const metadata = JSON.stringify({
    name: fileName,
    mimeType: 'text/markdown',
    parents: [folderId],
  });

  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: text/markdown; charset=UTF-8',
    '',
    markdown,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await fetchWithAuth(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }

  return res.json();
}

// ── Tab helpers ───────────────────────────────────────────────────────────────

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function toggleSidebarInTab(tabId) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const root = document.getElementById('drivesidebar-root');
      const tab  = document.getElementById('drivesidebar-tab');
      if (!root) return;
      const hidden = root.style.display === 'none';
      root.style.display = hidden ? 'block' : 'none';
      if (tab) tab.style.display = hidden ? 'none' : 'flex';
      if (!hidden && root._mode === 'split') document.documentElement.style.marginRight = '';
      if (hidden && root._mode === 'split')  document.documentElement.style.marginRight = root.offsetWidth + 'px';
    },
  });
}

// ── Save flow ─────────────────────────────────────────────────────────────────

async function handleSaveCurrentPage(tabId, folderId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['turndown.min.js'] });
    // Stamp the folderId onto the page so save_to_drive.js can echo it back
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (id) => { window.__dsFolderId = id; },
      args: [folderId],
    });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['save_to_drive.js'] });
  } catch (e) {
    chrome.tabs.sendMessage(tabId, { action: 'saveResult', ok: false, error: e.message }).catch(() => {});
  }
}

// ── Message router ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.action === 'toggle') {
      const tab = await getActiveTab();
      if (tab?.url?.startsWith('http')) toggleSidebarInTab(tab.id);
    }

    if (msg.action === 'setMode') {
      const tab = await getActiveTab();
      if (!tab?.url?.startsWith('http')) return;
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (mode) => {
          const root = document.getElementById('drivesidebar-root');
          if (root?.__setMode) root.__setMode(mode);
        },
        args: [msg.mode],
      });
    }

    if (msg.action === 'saveCurrentPage') {
      const tab = sender.tab || await getActiveTab();
      if (!tab) return;
      const { driveFolderId } = await chrome.storage.sync.get('driveFolderId');
      const folderId = msg.folderId || driveFolderId;
      if (!folderId) {
        chrome.tabs.sendMessage(tab.id, { action: 'saveResult', ok: false, error: 'no_folder' }).catch(() => {});
        return;
      }
      chrome.tabs.sendMessage(tab.id, { action: 'saveStatus', status: 'converting' }).catch(() => {});
      await handleSaveCurrentPage(tab.id, folderId);
    }

    if (msg.action === 'markdownReady') {
      const tab = sender.tab;
      if (!tab) return;
      const folderId = msg.folderId;
      if (!folderId) return;
      try {
        chrome.tabs.sendMessage(tab.id, { action: 'saveStatus', status: 'uploading' }).catch(() => {});
        const file = await uploadToDrive(msg.markdown, msg.title, folderId);
        chrome.tabs.sendMessage(tab.id, {
          action: 'saveResult', ok: true,
          fileId: file.id, fileUrl: file.webViewLink,
        }).catch(() => {});
      } catch (e) {
        chrome.tabs.sendMessage(tab.id, { action: 'saveResult', ok: false, error: e.message }).catch(() => {});
      }
    }

    if (msg.action === 'getFolderName') {
      try {
        const res = await fetchWithAuth(
          `https://www.googleapis.com/drive/v3/files/${msg.folderId}?fields=name`
        );
        if (!res.ok) { sendResponse({ ok: false }); return; }
        const data = await res.json();
        sendResponse({ ok: true, name: data.name });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    }
  })();
  return true; // keep message channel open for async
});
