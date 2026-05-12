(function () {
  const saveBtn       = document.getElementById('saveBtn');
  const folderPicker  = document.getElementById('folderPicker');
  const folderList    = document.getElementById('folderList');
  const nameInput     = document.getElementById('nameInput');
  const urlInput      = document.getElementById('urlInput');
  const addBtn        = document.getElementById('addBtn');
  const addStatus     = document.getElementById('addStatus');
  const foldersToggle = document.getElementById('foldersToggle');
  const foldersBody   = document.getElementById('foldersBody');
  const foldersArrow  = document.getElementById('foldersArrow');

  let foldersCollapsed = true;
  foldersBody.classList.add('collapsed');
  foldersArrow.classList.add('collapsed');
  foldersToggle.addEventListener('click', () => {
    foldersCollapsed = !foldersCollapsed;
    foldersBody.classList.toggle('collapsed', foldersCollapsed);
    foldersArrow.classList.toggle('collapsed', foldersCollapsed);
  });

  let folders = [];       // [{ id, name }]
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
    if (folders.length <= 1) {
      folderPicker.classList.remove('visible');
      return;
    }
    folderPicker.classList.add('visible');
    folders.forEach((f, i) => {
      const div = document.createElement('label');
      div.className = 'folder-option' + (i === selectedIndex ? ' selected' : '');
      div.innerHTML = `
        <input type="radio" name="folder" value="${i}" ${i === selectedIndex ? 'checked' : ''}>
        <div style="flex:1;min-width:0">
          <div class="folder-option-name">📁 ${f.name}</div>
          <div class="folder-option-id">${f.id.slice(0, 24)}…</div>
        </div>
        <a href="https://drive.google.com/drive/folders/${f.id}" target="_blank"
           title="Open folder in Drive"
           class="folder-open-link">↗</a>
      `;
      const openLink = div.querySelector('.folder-open-link');
      openLink.style.cssText = 'all:unset;cursor:pointer;font-size:13px;padding:2px 4px;border-radius:4px;color:#5f6368;flex-shrink:0';
      openLink.addEventListener('mouseover', () => { openLink.style.background = '#e8eaed'; });
      openLink.addEventListener('mouseout',  () => { openLink.style.background = 'transparent'; });
      div.addEventListener('change', () => {
        selectedIndex = i;
        document.querySelectorAll('.folder-option').forEach((el, j) => {
          el.classList.toggle('selected', j === i);
        });
        saveFolders();
      });
      folderPicker.appendChild(div);
    });
  }

  function renderList() {
    folderList.innerHTML = '';
    folders.forEach((f, i) => {
      const div = document.createElement('div');
      div.className = 'folder-item';
      div.innerHTML = `
        <div class="folder-item-info">
          <div class="folder-item-name">📁 ${f.name}</div>
          <div class="folder-item-id">${f.id}</div>
        </div>
        <a href="https://drive.google.com/drive/folders/${f.id}" target="_blank"
           title="Open folder in Drive"
           class="folder-open-link">↗</a>
        <button class="btn-danger" data-i="${i}" title="Remove">✕</button>
      `;
      const openLink = div.querySelector('.folder-open-link');
      openLink.style.cssText = 'all:unset;cursor:pointer;font-size:13px;padding:2px 6px;border-radius:4px;color:#5f6368;flex-shrink:0';
      openLink.addEventListener('mouseover', () => { openLink.style.background = '#e8eaed'; });
      openLink.addEventListener('mouseout',  () => { openLink.style.background = 'transparent'; });
      div.querySelector('.btn-danger').addEventListener('click', () => {
        folders.splice(i, 1);
        if (selectedIndex >= folders.length) selectedIndex = Math.max(0, folders.length - 1);
        saveFolders();
        render();
      });
      folderList.appendChild(div);
    });
  }

  function render() {
    renderList();
    renderPicker();
    saveBtn.disabled = folders.length === 0;
  }

  // Load saved folders (migrate from old single-folder format)
  chrome.storage.sync.get(['driveFolders', 'activeFolder', 'driveFolderId'], (result) => {
    if (result.driveFolders?.length) {
      folders = result.driveFolders;
      selectedIndex = result.activeFolder || 0;
    } else if (result.driveFolderId) {
      // Migrate old single folder
      folders = [{ id: result.driveFolderId, name: 'My Folder' }];
      selectedIndex = 0;
      saveFolders();
    }
    render();
  });

  // Add folder
  addBtn.addEventListener('click', () => {
    const id = extractFolderId(urlInput.value);
    if (!id) { setStatus('Invalid URL or ID', 'error'); return; }
    const name = nameInput.value.trim() || `Folder ${folders.length + 1}`;
    folders.push({ id, name });
    saveFolders();
    nameInput.value = '';
    urlInput.value = '';
    setStatus(`✓ Added: ${name}`, 'ok');
    render();
    setTimeout(() => setStatus(''), 3000);
  });

  // Save page
  saveBtn.addEventListener('click', () => {
    if (folders.length === 0) return;
    const folderId = folders[selectedIndex]?.id || folders[0].id;
    chrome.runtime.sendMessage({ action: 'saveCurrentPage', folderId });
    window.close();
  });
})();
