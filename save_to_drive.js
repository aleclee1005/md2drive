(function () {
  if (window.__driveSidebarCapturing) return;
  window.__driveSidebarCapturing = true;

  try {
    const clone = document.documentElement.cloneNode(true);

    // Remove noise
    ['script', 'style', 'noscript', 'svg', 'nav', 'footer', 'header', 'aside'].forEach(tag => {
      clone.querySelectorAll(tag).forEach(el => el.remove());
    });

    const body = clone.querySelector('body') || clone;

    const td = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    });

    // Keep <details>/<summary> readable
    td.addRule('details', {
      filter: 'details',
      replacement: (content) => '\n\n' + content + '\n\n',
    });

    const markdown = td.turndown(body.innerHTML);

    const title = document.title || 'Untitled';
    const frontmatter = [
      '---',
      `title: "${title.replace(/"/g, '\\"')}"`,
      `url: "${location.href}"`,
      `saved: "${new Date().toISOString()}"`,
      '---',
      '',
      '',
    ].join('\n');

    chrome.runtime.sendMessage({
      action: 'markdownReady',
      markdown: frontmatter + markdown,
      title,
      url: location.href,
      folderId: window.__dsFolderId || '',
    });
  } catch (e) {
    chrome.runtime.sendMessage({
      action: 'markdownReady',
      markdown: '',
      title: document.title || 'Untitled',
      url: location.href,
      folderId: window.__dsFolderId || '',
      error: e.message,
    });
  } finally {
    window.__driveSidebarCapturing = false;
  }
})();
