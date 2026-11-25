# 06 — Searching & Surfacing Available Site Assets

Guide for discovering, searching, and integrating existing Moonshine Capital brand, marketing, and media assets stored across **Google Drive, Notion, Wix, Canva, and Vimeo**.

---

## 1. How to Search Each Platform

### Google Drive *(Easiest & Most Flexible)*
- **Google Drive API (`files.list`):** Query files by keyword, MIME type (PDF, PNG, Slides, Video), and parent folder (e.g., `'<folderId>' in parents and fullText contains 'deck' and trashed = false`).
- **Google Picker API:** Embeds Google's native visual file-search modal directly inside the portal or admin panel after Google OAuth sign-in.
- **Best Practice:** Place all site-ready assets inside one dedicated shared folder (e.g., `Moonshine Approved Assets`) and restrict API queries to that folder ID so unrelated personal Drive files never appear.

### Notion
- **Notion API (`POST /v1/search` or `POST /v1/databases/{id}/query`):** Searches brand guidelines, listing packets, and media databases using an Internal Integration Token or OAuth.
- **Important Caveat:** Files uploaded directly to Notion generate signed URLs that **expire after 1 hour**. Either refresh/proxy them through the backend on demand, or store permanent external links (Google Drive, Cloudflare R2, or Cloudinary) inside a Notion *"Master Asset Directory"* database.

### Wix *(Existing Marketing Site Media)*
- **Wix Media Manager API (`files.searchFiles` / `files.listFiles`):** Available via Wix Headless / OAuth to query images, videos, and PDFs in the Wix Media Library by filename, folder, or media type.
- **Practical Tip:** If you plan to eventually move off Wix, run a one-time export of approved logos, photography, and PDFs from Wix Media Manager into Google Drive or a dedicated CDN (Cloudflare R2 / Cloudinary) so the onboarding portal is not tied to Wix URLs long-term.

### Canva & Vimeo *(From Your Selected Stack)*
- **Canva Connect API:** Search existing designs and Brand Templates so agents can open pre-branded Moonshine templates directly.
- **Vimeo API:** Search videos within a private folder or showcase to auto-populate the **Resource Center**.

---

## 2. Two Recommended Architectures for In-App Asset Search

### Option A: Federated Admin Asset Picker *(Best for Curating Site Content)*
- Build a single backend endpoint (`/api/assets/search?q=...`) that queries **Google Drive, Notion, and Wix** in parallel and merges results into one list showing file name, source platform, thumbnail preview, and file type.
- Add an **"Import / Pin to Marketing Vault"** action on each result so admins explicitly control which assets become visible to agents.

### Option B: Unified "Master Asset Index" *(Best for Fast Agent Search)*
- Sync asset metadata (title, category, source link, thumbnail, updated timestamp) from Drive, Notion, and Wix into one central index (a Notion Master Database, Firestore collection, or SQLite full-text search table).
- Agents get instant single-bar search across all approved assets without hitting external API rate limits or needing individual Notion/Wix permissions.

---

## 3. Recommended Folder & Tag Hygiene Before Connecting

Standardize a simple top-level folder or tag convention across Google Drive, Notion, and Wix so discovered assets map cleanly into portal sections:

- `01_Brand_Identity` — Logos, typography kits, color palettes, brand guidelines
- `02_Pitch_Decks` — Luxury presentation decks, local market reports, listing packets
- `03_Social_Templates` — Canva template links, launch announcements, social graphics
- `04_Photography_Video` — Hero imagery, executive headshots, Vimeo training videos
- `05_Compliance_Docs` — ICA, NDA, W-9, and onboarding disclosure forms
