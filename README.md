# NoteSource

Clip any web page as Markdown — save to Google Drive, local folder, or clipboard. Built for NotebookLM & Gemini workflows.

## Features

- **One-click Markdown clipping** — converts the current page to clean Markdown with YAML frontmatter (title, source, author, published date, description)
- **Save to Google Drive** — uploads directly to your chosen Drive folder as a `.md` file
- **Save locally** — downloads to a subfolder of your browser's download directory
- **Copy to clipboard** — paste into any app (Obsidian, Notion, NotebookLM, etc.)
- **MD Preview** — see the converted Markdown before saving

## Privacy & Data Flow

**Your data never touches any third-party server.**

When you save to Google Drive:

```
Your browser → Google OAuth (identity verification) → Your Google Drive
```

- The OAuth app (GCP client) acts only as an identity gatekeeper — it verifies that you have a valid Google account
- Your files are uploaded **directly from your browser to your own Google Drive**
- No content is stored, logged, or transmitted to any server controlled by the developer
- No analytics or tracking of any kind

This is the same data flow as any "Sign in with Google" button — Google verifies your identity, you access your own data.

## Installation

### From Chrome Web Store
*(Coming soon)*

### Developer Mode (manual)
1. Download or clone this repository
2. Go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select this folder

## Setup: Google Drive

1. Click the NoteSource icon in the toolbar
2. Click **Connect Google Drive** in the popup
3. Sign in with your Google account
4. If you see "This app isn't verified", click **Advanced → Go to NoteSource** (this is expected for unverified apps)
5. Click **+ Add Folder** and paste a Google Drive folder URL or ID

## Usage

1. Open any web page you want to clip
2. Click the NoteSource icon
3. Choose **Drive**, **Copy**, or **Local**

## Permissions

| Permission | Why |
|---|---|
| `identity` | Google OAuth sign-in to access Drive |
| `scripting` | Convert page HTML to Markdown |
| `tabs` | Read current page URL and title |
| `downloads` | Save `.md` files locally |
| `storage` | Remember your folder settings |
| `<all_urls>` | Clip content from any web page |

## License

MIT
