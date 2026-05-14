(function () {
  if (window.__driveSidebarCapturing) return;
  window.__driveSidebarCapturing = true;

  try {
    let bodyHtml;

    if (window.__dsSelectedHtml) {
      bodyHtml = window.__dsSelectedHtml;
      window.__dsSelectedHtml = null;
    } else {
      const clone = document.documentElement.cloneNode(true);
      ['script', 'style', 'noscript', 'svg', 'nav', 'footer', 'header', 'aside'].forEach(tag => {
        clone.querySelectorAll(tag).forEach(el => el.remove());
      });
      const body = clone.querySelector('body') || clone;
      bodyHtml = body.innerHTML;
    }

    const td = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    });

    td.addRule('details', {
      filter: 'details',
      replacement: (content) => '\n\n' + content + '\n\n',
    });

    const markdown = td.turndown(bodyHtml);

    const title = window.__dsCustomTitle || document.title || 'Untitled';
    window.__dsCustomTitle = null;
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
      saveMethod: window.__dsSaveMethod || 'drive',
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
