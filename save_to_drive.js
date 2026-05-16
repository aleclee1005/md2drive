(function () {
  if (window.__noteSourceCapturing) return;
  window.__noteSourceCapturing = true;

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

    const getMeta = (names) => {
      for (const n of names) {
        const el = document.querySelector(`meta[property="${n}"],meta[name="${n}"]`);
        if (el?.content) return el.content;
      }
      return '';
    };
    const author      = getMeta(['article:author','author','og:article:author','twitter:creator']);
    const published   = getMeta(['article:published_time','og:article:published_time','datePublished']);
    const description = getMeta(['og:description','description']);
    const today       = new Date().toISOString().slice(0, 10);

    const esc = s => s.replace(/"/g, '\\"');
    const frontmatter = [
      '---',
      `title: "${esc(title)}"`,
      `source: "${location.href}"`,
      `author: "${author ? `[[${author}]]` : ''}"`,
      `published: "${published ? published.slice(0, 10) : ''}"`,
      `created: "${today}"`,
      `description: "${esc(description)}"`,
      'tags: clippings',
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
      localPath: window.__dsLocalPath || '',
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
    window.__noteSourceCapturing = false;
  }
})();
