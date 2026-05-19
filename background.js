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

  const boundary = 'notesource_' + Date.now();
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

// ── Result broadcast ──────────────────────────────────────────────────────────

function sendResult(tabId, result) {
  if (tabId) chrome.tabs.sendMessage(tabId, result).catch(() => {});
  chrome.runtime.sendMessage(result).catch(() => {});
}

// ── Save flow ─────────────────────────────────────────────────────────────────

async function handleSaveCurrentPage(tabId, folderId, customTitle) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['turndown.min.js'] });
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (id, title) => {
        window.__dsFolderId = id;
        window.__dsSaveMethod = 'drive';
        window.__dsLocalPath = '';
        window.__dsSelectedHtml = null;
        window.__dsCustomTitle = title || null;
      },
      args: [folderId, customTitle || null],
    });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['save_to_drive.js'] });
  } catch (e) {
    sendResult(tabId, { action: 'saveResult', ok: false, error: e.message });
  }
}

// ── Message router ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.action === 'connectDrive') {
      getToken(true)
        .then(() => {
          chrome.runtime.sendMessage({ action: 'driveAuthResult', ok: true }).catch(() => {});
        })
        .catch(e => {
          chrome.runtime.sendMessage({ action: 'driveAuthResult', ok: false, error: e.message }).catch(() => {});
        });
    }

    if (msg.action === 'saveCurrentPageLocal') {
      const tab = msg.tabId ? await chrome.tabs.get(msg.tabId).catch(() => null) : await getActiveTab();
      if (!tab?.url?.startsWith('http')) return;
      const subfolderPath = msg.subfolderPath || '';
      const customTitle = msg.customTitle || null;
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['turndown.min.js'] });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (path, title) => {
            window.__dsSelectedHtml = null;
            window.__dsCustomTitle = title || null;
            window.__dsSaveMethod = 'local';
            window.__dsLocalPath = path;
            window.__dsFolderId = null;
          },
          args: [subfolderPath, customTitle],
        });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['save_to_drive.js'] });
      } catch (e) {
        sendResult(tab.id, { action: 'saveResult', ok: false, error: e.message });
      }
    }

    if (msg.action === 'saveCurrentPage') {
      const tab = sender.tab || (msg.tabId ? await chrome.tabs.get(msg.tabId).catch(() => null) : await getActiveTab());
      if (!tab) return;
      const { driveFolderId } = await chrome.storage.sync.get('driveFolderId');
      const folderId = msg.folderId || driveFolderId;
      if (!folderId) {
        sendResult(tab.id, { action: 'saveResult', ok: false, error: 'no_folder' });
        return;
      }
      await handleSaveCurrentPage(tab.id, folderId, msg.customTitle);
    }

    if (msg.action === 'markdownReady') {
      const tab = sender.tab;
      if (!tab) return;

      if (msg.saveMethod === 'local') {
        try {
          const date = new Date().toISOString().slice(0, 10);
          const safeName = (msg.title || 'Untitled').replace(/[/\\:*?"<>|]/g, '-').trim().slice(0, 100);
          const baseFilename = `${safeName} — ${date}.md`;
          const subfolderPath = msg.localPath || '';
          const filename = subfolderPath ? `${subfolderPath}/${baseFilename}` : baseFilename;
          const saveAs = !subfolderPath;
          const dataUrl = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(msg.markdown);
          chrome.downloads.download({ url: dataUrl, filename, saveAs }, (downloadId) => {
            const ok = downloadId !== undefined;
            sendResult(tab.id, { action: 'saveResult', ok, error: ok ? undefined : 'Download cancelled' });
          });
        } catch (e) {
          sendResult(tab.id, { action: 'saveResult', ok: false, error: e.message });
        }
        return;
      }

      const folderId = msg.folderId;
      if (!folderId) return;
      try {
        const file = await uploadToDrive(msg.markdown, msg.title, folderId);
        sendResult(tab.id, { action: 'saveResult', ok: true, fileId: file.id, fileUrl: file.webViewLink });
      } catch (e) {
        sendResult(tab.id, { action: 'saveResult', ok: false, error: e.message });
      }
    }
  })();
  return true;
});
