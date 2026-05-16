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

function toggleSidebarInTab(tabId) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const root = document.getElementById('notesource-root');
      const tab  = document.getElementById('notesource-tab');
      if (!root) return;
      const hidden = root.style.display === 'none';
      root.style.display = hidden ? 'block' : 'none';
      if (tab) tab.style.display = hidden ? 'none' : 'flex';
      if (!hidden && root._mode === 'split') document.documentElement.style.marginRight = '';
      if (hidden && root._mode === 'split')  document.documentElement.style.marginRight = root.offsetWidth + 'px';
    },
  });
}

// ── Result broadcast (tab toast + popup feedback) ─────────────────────────────

function sendResult(tabId, result) {
  if (tabId) chrome.tabs.sendMessage(tabId, result).catch(() => {});
  chrome.runtime.sendMessage(result).catch(() => {}); // notify popup if still open
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
          const root = document.getElementById('notesource-root');
          if (root?.__setMode) root.__setMode(mode);
        },
        args: [msg.mode],
      });
    }

    if (msg.action === 'saveCurrentPageLocal') {
      const tab = msg.tabId ? await chrome.tabs.get(msg.tabId).catch(() => null) : await getActiveTab();
      if (!tab?.url?.startsWith('http')) return;
      const subfolderPath = msg.subfolderPath || '';
      const customTitle = msg.customTitle || null;
      chrome.tabs.sendMessage(tab.id, { action: 'saveStatus', status: 'converting' }).catch(() => {});
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

    if (msg.action === 'clipPageToClipboard') {
      const tab = sender.tab;
      if (!tab) return;
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['turndown.min.js'] });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const clone = document.documentElement.cloneNode(true);
            ['script','style','noscript','svg','nav','footer','header','aside'].forEach(tag =>
              clone.querySelectorAll(tag).forEach(el => el.remove())
            );
            const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
            const markdown = td.turndown((clone.querySelector('body') || clone).innerHTML);
            chrome.runtime.sendMessage({ action: 'clipboardReady', markdown });
          },
        });
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
      chrome.tabs.sendMessage(tab.id, { action: 'saveStatus', status: 'converting' }).catch(() => {});
      await handleSaveCurrentPage(tab.id, folderId, msg.customTitle);
    }

    if (msg.action === 'saveSelectedContent') {
      const tab = sender.tab;
      if (!tab) return;
      try {
        let localPath = msg.localPath || '';
        if (msg.saveMethod === 'local' && !localPath) {
          const { localFolders, activeLocalFolder } = await chrome.storage.sync.get(['localFolders', 'activeLocalFolder']);
          if (localFolders?.length) {
            const idx = activeLocalFolder || 0;
            localPath = localFolders[idx]?.path || localFolders[0].path || '';
          }
        }
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['turndown.min.js'] });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (html, folderId, customTitle, saveMethod, localPath) => {
            window.__dsSelectedHtml = html;
            window.__dsFolderId = folderId;
            window.__dsCustomTitle = customTitle || null;
            window.__dsSaveMethod = saveMethod || 'drive';
            window.__dsLocalPath = localPath || '';
          },
          args: [msg.html, msg.folderId, msg.customTitle || null, msg.saveMethod || 'drive', localPath],
        });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['save_to_drive.js'] });
      } catch (e) {
        sendResult(tab.id, { action: 'saveResult', ok: false, error: e.message });
      }
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
        chrome.tabs.sendMessage(tab.id, { action: 'saveStatus', status: 'uploading' }).catch(() => {});
        const file = await uploadToDrive(msg.markdown, msg.title, folderId);
        sendResult(tab.id, { action: 'saveResult', ok: true, fileId: file.id, fileUrl: file.webViewLink });
      } catch (e) {
        sendResult(tab.id, { action: 'saveResult', ok: false, error: e.message });
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
