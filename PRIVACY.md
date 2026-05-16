# Privacy Policy — NoteSource

*Last updated: 2026-05-16*

## Summary

NoteSource does not collect, store, or transmit any personal data to any server controlled by the developer. Your data stays between your browser and your own Google Drive.

---

## Data Flow

When you use NoteSource to save a page to Google Drive:

```
Your browser → Google OAuth (identity verification only) → Your Google Drive
```

1. **Google OAuth** verifies your identity using your Google account. This is the same mechanism used by any "Sign in with Google" button. The developer's GCP project acts only as an identity gatekeeper — it does not store your credentials or access tokens.

2. **Your files** are uploaded directly from your browser to your own Google Drive account. The file never passes through any developer-controlled server.

3. **No data is collected.** The developer does not have access to your files, your Google account information, or your browsing history.

---

## What Data Is Processed

| Data | Where it goes | Stored by developer? |
|---|---|---|
| Page content (HTML → Markdown) | Processed locally in your browser | No |
| Google OAuth token | Stored locally in your browser (Chrome storage) | No |
| Saved `.md` files | Your Google Drive or local download folder | No |
| Page URL, title, metadata | Included in the `.md` frontmatter, saved to your Drive | No |

---

## Google Drive API

NoteSource uses the Google Drive API with the `drive.file` scope. This scope grants access **only to files created by NoteSource** — it cannot read or modify any other files in your Google Drive.

---

## Permissions

- **`identity`** — used solely to authenticate with Google OAuth and obtain a Drive access token
- **`scripting`** — used to extract page content and convert it to Markdown, entirely within your browser
- **`tabs`** — used to read the current page URL and title for the Markdown frontmatter
- **`downloads`** — used to save `.md` files to your local download folder
- **`storage`** — used to save your folder preferences locally in Chrome
- **`<all_urls>`** — required to clip content from any web page you choose to save

---

## Third-Party Services

NoteSource uses the **Google Drive API** and **Google OAuth 2.0**, both operated by Google LLC. Your use of these services is subject to [Google's Privacy Policy](https://policies.google.com/privacy).

No other third-party services are used.

---

## Contact

If you have questions about this privacy policy, please open an issue on the [GitHub repository](https://github.com/aleclee1005/md2drive).
