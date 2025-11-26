# WordPress for Raycast — Project Context

This document provides persistent design, architecture, and development context for the **WordPress for Raycast** extension. Codex should load and use this as authoritative reference for all code generation related to the project.

## 1. Overview

**Goal:** Build a Raycast Extension enabling users to post to one or more WordPress sites via the REST API.

**Primary Features:**

- Manage multiple WordPress sites
- Secure authentication per site
- “Quick Post” interface
- Featured image upload (with automatic WebP conversion)
- Category and tag selection
- Full post publishing support

## 2. Architecture

The extension consists of three major systems:

### 2.1 Site Manager

Stores multiple site profiles with:

- Site Name
- Base URL
- REST API base (`/wp-json/wp/v2/`)
- Authentication credentials
- Supported capabilities (categories, tags, media upload, etc.)

**Storage Strategy:**

- Secrets → `environment.secrets`
- Non-sensitive metadata → `LocalStorage`

### 2.2 API Layer

Typed helper functions for all WordPress API communication:

- `wpGet(site, route)`
- `wpPost(site, route, body)`
- `wpUploadMedia(site, file)`

Responsibilities:

- Apply authentication headers
- Format URLs
- Handle JSON parsing
- Provide consistent error handling

### 2.3 Commands / UI

Commands include:

- Quick Post
- Manage Sites
- Upload Media (optional)
- Recent Posts (optional)

Reusable UI components (form elements, dropdowns, pickers) live in `src/ui/`.

## 3. Authentication Strategy

### 3.1 Application Passwords (Primary Method)

Uses WordPress’ built-in Application Passwords system.

Stores:

- Username
- Application Password

Sent via HTTPS Basic Auth.

Advantages:

- No custom WP plugins required
- Revocable per-site
- Secure when stored in Raycast secrets

### 3.2 JWT Auth (Optional)

Supported if the site has a JWT plugin installed. Architecture should allow substituting auth mechanisms without rewriting commands.

## 4. Quick Post Flow

1. Select WordPress site
2. Enter Title
3. Enter Content
4. Select Categories
5. Select Tags
6. Pick Featured Image (local file)
7. Choose Post Status
8. Submit to `/wp-json/wp/v2/posts`

**POST Payload Example:**

```json
{
  "title": "",
  "content": "",
  "status": "publish",
  "categories": [],
  "tags": [],
  "featured_media": 0
}
```

## 5. Featured Image Workflow

1. User selects local file
2. Convert file → WebP (via Sharp)
3. Upload via `POST /wp-json/wp/v2/media` using multipart/form-data
4. Get returned `media_id`
5. Attach media to post

## 6. Category & Tag Fetching

When a site is selected:

- Categories: `GET /wp-json/wp/v2/categories?per_page=100`
- Tags: `GET /wp-json/wp/v2/tags?per_page=100`

Cache results in memory for each session.

## 7. Project Structure

Expected repository structure:

```
raycast-wordpress/
  src/
    api/
      wordpress.ts
    commands/
      quick-post.tsx
      manage-sites.tsx
      upload-media.tsx
    storage/
    ui/
    utils/
  docs/
    CONTEXT.md
  package.json
  raycast.json
  README.md
```

## 8. Development Roadmap

### Phase 1 — Foundations

- Implement Site Manager
- Add authentication validation
- Store site list

### Phase 2 — Quick Post (text only)

- Title + Content fields
- Publish draft/published posts

### Phase 3 — Taxonomies

- Fetch + multi-select Categories and Tags

### Phase 4 — Featured Image

- Local file picker
- Convert image → WebP
- Upload to Media Library
- Attach as featured image

### Phase 5 — Polishing

- Improved error messages
- Recent Posts command
- Media-only uploader

## 9. Coding Guidelines

- Use TypeScript throughout
- Follow Raycast extension conventions
- Keep API strongly typed
- Use toast notifications for errors
- Never store secrets in LocalStorage
- Keep UI responsive and non-blocking
- All code generated must match project structure
