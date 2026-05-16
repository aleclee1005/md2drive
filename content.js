(function () {
  if (document.getElementById('notesource-root')) return;

  const DRIVE_URL = 'https://drive.google.com';
  const DEFAULT_W = 420;
  const DRIVE_GREEN = '#34a853';

  // ── State ─────────────────────────────────────────────────────────────────
  let st = { mode: 'float', x: null, y: null, width: DEFAULT_W, collapsed: true };
  function save() { chrome.storage.local.set({ notesource: st }); }

  // ── Root (shadow host) ────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.id = 'notesource-root';
  Object.assign(root.style, {
    position: 'fixed', zIndex: '2147483647',
    width: DEFAULT_W + 'px', overflow: 'hidden',
  });

  const shadow = root.attachShadow({ mode: 'open' });
  const resetStyle = document.createElement('style');
  resetStyle.textContent = `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }`;
  shadow.appendChild(resetStyle);

  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'relative', display: 'flex', flexDirection: 'column',
    background: '#fff', overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    width: '100%', height: '100%',
  });
  shadow.appendChild(container);

  // ── Header ────────────────────────────────────────────────────────────────
  const header = document.createElement('div');
  Object.assign(header.style, {
    position: 'relative',
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '7px 8px', background: '#f8f9fa',
    borderBottom: '1px solid #e8eaed',
    userSelect: 'none', flexShrink: '0', cursor: 'grab',
  });

  // Collapse toggle
  const collapseBtn = hdrBtn(
    `<svg width="10" height="10" viewBox="0 0 10 10"><path d="M3.5 2L6.5 5L3.5 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    'Collapse / Expand'
  );
  collapseBtn.addEventListener('click', () => {
    st.collapsed = !st.collapsed;
    applyCollapsed();
    save();
  });

  // Drive label
  const driveLabel = document.createElement('span');
  driveLabel.textContent = 'Drive';
  Object.assign(driveLabel.style, {
    fontSize: '13px', fontWeight: '700', color: DRIVE_GREEN,
    padding: '2px 6px', userSelect: 'none',
  });

  const spacer = document.createElement('div');
  spacer.style.flex = '1';

  // Save as MD button
  const saveBtn = hdrBtn(
    `<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5"/><path d="M9 2v4h4M6 9h4M6 12h4M6 6h2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
    'Save as Markdown to Drive'
  );
  saveBtn.addEventListener('mouseenter', () => { saveBtn.style.background = '#e6f4ea'; saveBtn.style.color = DRIVE_GREEN; });
  saveBtn.addEventListener('mouseleave', () => { saveBtn.style.background = 'transparent'; saveBtn.style.color = '#5f6368'; });
  saveBtn.addEventListener('click', () => {
    chrome.storage.sync.get('driveFolderId', (result) => {
      if (!result.driveFolderId) {
        showToast('No folder set. Click the toolbar icon to configure.', 'warn');
        return;
      }
      chrome.runtime.sendMessage({ action: 'saveCurrentPage' });
    });
  });

  // Toast container (inside shadow DOM)
  const toastEl = document.createElement('div');
  Object.assign(toastEl.style, {
    position: 'absolute', top: '100%', right: '4px', marginTop: '4px',
    zIndex: '10', borderRadius: '8px', padding: '8px 12px',
    fontSize: '12px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    lineHeight: '1.5', display: 'none', whiteSpace: 'nowrap',
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)', pointerEvents: 'none',
    transition: 'opacity 0.2s',
  });
  header.appendChild(toastEl);

  function showToast(msg, type, link) {
    const colors = {
      info:    { bg: 'rgba(0,0,0,0.80)', text: '#fff' },
      success: { bg: '#34a853',           text: '#fff' },
      warn:    { bg: '#f29900',           text: '#fff' },
      error:   { bg: '#ea4335',           text: '#fff' },
    };
    const c = colors[type] || colors.info;
    toastEl.style.background = c.bg;
    toastEl.style.color = c.text;
    toastEl.innerHTML = msg;
    if (link) {
      const a = document.createElement('a');
      a.href = link; a.target = '_blank'; a.textContent = ' Open file';
      Object.assign(a.style, { color: '#fff', marginLeft: '6px', textDecoration: 'underline', pointerEvents: 'auto' });
      toastEl.appendChild(a);
    }
    toastEl.style.display = 'block';
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => { toastEl.style.display = 'none'; }, link ? 6000 : 3500);
  }

  // Reload button
  const reloadBtn = hdrBtn(
    `<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M13.5 8A5.5 5.5 0 1 1 8 2.5c1.8 0 3.4.87 4.4 2.2L14 3v4h-4l1.6-1.6A3.5 3.5 0 1 0 11.5 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    'Reload Drive'
  );
  reloadBtn.addEventListener('click', () => { iframe.src = DRIVE_URL; });

  // Float button
  const floatBtn = hdrBtn(
    `<svg width="13" height="13" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="5" y="5" width="8" height="8" rx="1.5" fill="currentColor"/></svg>`,
    'Float mode'
  );
  floatBtn.addEventListener('click', () => setMode('float'));

  // Split button
  const splitBtn = hdrBtn(
    `<svg width="13" height="13" viewBox="0 0 16 16"><rect x="1" y="2" width="14" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" stroke-width="1.5"/></svg>`,
    'Split mode'
  );
  splitBtn.addEventListener('click', () => setMode('split'));

  // Close button
  const closeBtn = hdrBtn(
    `<svg width="11" height="11" viewBox="0 0 11 11"><line x1="1" y1="1" x2="10" y2="10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="10" y1="1" x2="1" y2="10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    'Close'
  );
  closeBtn.addEventListener('click', hide);

  header.append(collapseBtn, driveLabel, spacer, saveBtn, sep(), reloadBtn, sep(), floatBtn, splitBtn, sep(), closeBtn);

  // ── iframe ────────────────────────────────────────────────────────────────
  const iframe = document.createElement('iframe');
  iframe.src = DRIVE_URL;
  iframe.allow = 'fullscreen; clipboard-read; clipboard-write';
  Object.assign(iframe.style, { flex: '1', border: 'none', minHeight: '0' });

  // ── Resize handle (left edge) ─────────────────────────────────────────────
  const resizer = document.createElement('div');
  Object.assign(resizer.style, {
    position: 'absolute', left: '0', top: '0', bottom: '0',
    width: '5px', cursor: 'ew-resize', zIndex: '1',
  });

  container.append(resizer, header, iframe);

  // ── Toggle tab ────────────────────────────────────────────────────────────
  const toggleTab = document.createElement('button');
  toggleTab.id = 'notesource-tab';
  toggleTab.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16"><path d="M6 3l5 5-5 5" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  Object.assign(toggleTab.style, {
    position: 'fixed', right: '0', top: '50%', transform: 'translateY(-50%)',
    zIndex: '2147483646', background: DRIVE_GREEN, border: 'none',
    borderRadius: '8px 0 0 8px', width: '24px', height: '48px',
    cursor: 'pointer', display: 'none', alignItems: 'center', justifyContent: 'center',
    boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
  });
  toggleTab.addEventListener('click', show);

  document.documentElement.append(root, toggleTab);

  // ── Listen for save results from background.js ────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'saveStatus') {
      if (msg.status === 'converting') showToast('Converting page...', 'info');
      if (msg.status === 'uploading')  showToast('Uploading to Drive...', 'info');
    }
    if (msg.action === 'saveResult') {
      if (msg.ok) {
        showToast('✓ Saved to Drive!', 'success', msg.fileUrl);
        if (st.collapsed) { st.collapsed = false; applyCollapsed(); }
      } else if (msg.error === 'no_folder') {
        showToast('No folder set. Click the toolbar icon to configure.', 'warn');
      } else {
        showToast('Save failed: ' + msg.error, 'error');
      }
    }
  });

  // ── Layout functions ──────────────────────────────────────────────────────
  function applyFloat() {
    const x = st.x !== null ? st.x : (window.innerWidth - st.width - 16);
    const y = st.y !== null ? st.y : 60;
    Object.assign(root.style, {
      top: y + 'px', left: x + 'px', right: '', bottom: '',
      width: st.width + 'px', height: '80vh',
      borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.16)',
    });
    document.documentElement.style.marginRight = '';
    document.documentElement.style.transition  = '';
    header.style.cursor = 'grab';
  }

  function applySplit() {
    Object.assign(root.style, {
      top: '0', right: '0', left: '', bottom: '0',
      width: st.width + 'px', height: '100vh',
      borderRadius: '0', boxShadow: '-4px 0 16px rgba(0,0,0,0.1)',
    });
    document.documentElement.style.transition  = 'margin-right 0.2s';
    document.documentElement.style.marginRight = st.width + 'px';
    header.style.cursor = 'default';
  }

  function applyCollapsed() {
    if (st.collapsed) {
      const h = header.offsetHeight + 'px';
      iframe.style.display = 'none';
      root.style.height = h;
      root.style.minHeight = h;
      collapseBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10"><path d="M3.5 2L6.5 5L3.5 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      if (st.mode === 'split') document.documentElement.style.marginRight = '';
    } else {
      iframe.style.display = 'flex';
      root.style.minHeight = '';
      root.style.height = st.mode === 'split' ? '100vh' : '80vh';
      collapseBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 3.5L5 6.5L8 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      if (st.mode === 'split') document.documentElement.style.marginRight = st.width + 'px';
    }
  }

  function setMode(m) {
    st.mode = m; save();
    if (m === 'float') {
      applyFloat();
      floatBtn.style.background = '#e6f4ea'; floatBtn.style.color = DRIVE_GREEN;
      splitBtn.style.background = 'transparent'; splitBtn.style.color = '#5f6368';
    } else {
      applySplit();
      splitBtn.style.background = '#e6f4ea'; splitBtn.style.color = DRIVE_GREEN;
      floatBtn.style.background = 'transparent'; floatBtn.style.color = '#5f6368';
    }
    if (st.collapsed) applyCollapsed();
  }

  function hide() {
    root.style.display = 'none';
    toggleTab.style.display = 'flex';
    if (st.mode === 'split') document.documentElement.style.marginRight = '';
  }

  function show() {
    root.style.display = 'block';
    toggleTab.style.display = 'none';
    if (st.mode === 'split' && !st.collapsed) applySplit();
  }

  // ── Drag (float only) ─────────────────────────────────────────────────────
  let dragging = false, dx, dy, ox, oy;
  header.addEventListener('mousedown', (e) => {
    if (st.mode !== 'float' || e.target.closest('button')) return;
    dragging = true; dx = e.clientX; dy = e.clientY;
    const r = root.getBoundingClientRect(); ox = r.left; oy = r.top;
    iframe.style.pointerEvents = 'none';
    root.style.transition = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    st.x = Math.max(0, Math.min(window.innerWidth  - root.offsetWidth,  ox + e.clientX - dx));
    st.y = Math.max(0, Math.min(window.innerHeight - root.offsetHeight, oy + e.clientY - dy));
    root.style.left = st.x + 'px';
    root.style.top  = st.y + 'px';
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    iframe.style.pointerEvents = '';
    root.style.transition = '';
    save();
  });

  // ── Resize ────────────────────────────────────────────────────────────────
  let resizing = false, rx, rw;
  resizer.addEventListener('mousedown', (e) => {
    resizing = true; rx = e.clientX; rw = root.offsetWidth;
    iframe.style.pointerEvents = 'none';
    document.body.style.cursor = 'ew-resize';
    e.stopPropagation(); e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    st.width = Math.max(280, Math.min(window.innerWidth * 0.7, rw + rx - e.clientX));
    root.style.width = st.width + 'px';
    if (st.mode === 'split') document.documentElement.style.marginRight = st.width + 'px';
  });
  document.addEventListener('mouseup', () => {
    if (!resizing) return;
    resizing = false;
    iframe.style.pointerEvents = '';
    document.body.style.cursor = '';
    save();
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function hdrBtn(svg, title) {
    const b = document.createElement('button');
    b.innerHTML = svg; b.title = title;
    Object.assign(b.style, {
      border: 'none', borderRadius: '6px', padding: '4px 6px',
      cursor: 'pointer', background: 'transparent', color: '#5f6368',
      display: 'flex', alignItems: 'center', transition: 'background 0.15s',
    });
    b.addEventListener('mouseenter', () => b.style.background = '#e8eaed');
    b.addEventListener('mouseleave', () => {
      const active = (b === floatBtn && st.mode === 'float') ||
                     (b === splitBtn && st.mode === 'split');
      b.style.background = active ? '#e6f4ea' : 'transparent';
    });
    return b;
  }

  function sep() {
    const d = document.createElement('div');
    Object.assign(d.style, { width: '1px', height: '18px', background: '#e0e0e0', flexShrink: '0' });
    return d;
  }

  root.__setMode = setMode;

  // ── Init ──────────────────────────────────────────────────────────────────
  setMode('float');
  applyCollapsed();

  chrome.storage.local.get(['notesource'], (result) => {
    if (result.notesource) {
      Object.assign(st, result.notesource, { collapsed: true });
      root.style.width = st.width + 'px';
      setMode(st.mode);
      applyCollapsed();
    }
    hide();
  });

})();
