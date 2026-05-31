# AI Manga Shot Factory

Windows Electron app for manga / short-drama storyboard production. It imports scripts, builds director DSL, compiles prompts, calls image generation providers, archives generated assets, and keeps a resumable batch queue.

## Run

```powershell
npm install
npm start
```

PowerShell may block `npm.ps1` on some Windows machines. If that happens, use:

```powershell
npm.cmd start
```

## API Providers

### GPT Image / OpenAI-compatible

Use Provider `GPT Image`.

- `API Base URL`: `https://api.openai.com/v1`, or a third-party OpenAI-compatible base URL such as `https://example.com/v1`
- `API Key`: your provider key
- `Model`: for OpenAI, `gpt-image-1.5`, `gpt-image-1`, or `gpt-image-1-mini`

The app calls:

```text
POST {API Base URL}/images/generations
```

It supports OpenAI-style responses such as:

```json
{ "data": [{ "b64_json": "..." }] }
```

and URL responses such as:

```json
{ "data": [{ "url": "https://..." }] }
```

### Custom Provider

Use Provider `Custom Provider` when your image service has its own full endpoint.

- `Custom Endpoint`: full generation URL, for example `https://example.com/api/generate`
- `API Key`: optional; when provided it is sent as `Authorization: Bearer <key>`

The app sends both camelCase and snake_case fields for broad compatibility:

```json
{
  "prompt": "...",
  "negativePrompt": "...",
  "negative_prompt": "...",
  "model": "...",
  "size": "1536x1024",
  "aspectRatio": "16:9",
  "aspect_ratio": "16:9",
  "quality": "high",
  "outputFormat": "png",
  "output_format": "png"
}
```

Supported custom response fields include `imageUrl`, `image_url`, `url`, `b64_json`, `base64`, `images[0]`, `artifacts[0]`, and OpenAI-compatible `data[0]`.

Vision QA uses an OpenAI-compatible chat/vision endpoint. When generation uses `Custom Provider`, the app will not send that API key to the default OpenAI URL unless you explicitly configure an OpenAI-compatible `API Base URL`.

## Third-Party Skill JSON

Project settings include `Third-party Skill JSON`. Paste a full local path to an external skill JSON file when you want another prompt/style skill to drive prompt compilation.

Compatible fields:

```json
{
  "id": "third-party-style",
  "name": "Third Party Style Skill",
  "version": "1.0.0",
  "promptStyle": "cinematic style text added to every prompt",
  "negativePrompt": "tokens to avoid",
  "shotRules": ["single dramatic action"],
  "qualityRules": ["style consistency", "readable composition", "no watermark"]
}
```

If the path is empty, the app uses the built-in `src/skills/manga-drama-director.json`.

Built-in optional skill:

- `src/skills/storyboard-mode-director.json`: story-first storyboard mode director skill. It chooses single-frame, 4-panel, 6-panel, or 9-panel storyboard mode from the user's request, then builds character, scene, spatial blocking, shot table, and AI image prompts around the plot.

## Test And Build

```powershell
npm.cmd test
npm.cmd run pack
```

`npm.cmd test` runs provider and smoke tests without making real network requests.

## Project Layout

```text
src/main/       Electron main process and IPC
src/preload/    Safe renderer bridge
src/renderer/   App UI
src/core/       Provider, DSL, prompt compiler, quality checks, queue, assets
src/skills/     Built-in storyboard skill
scripts/        Smoke tests
```

## GitHub Repository Setup

This project is prepared for GitHub as a Windows Electron repository.

Recommended first push:

```powershell
git remote add origin https://github.com/<your-org-or-user>/ai-manga-shot-factory.git
git push -u origin main
```

Do not commit local production data:

- API keys or `.env` files
- `.shotfactory.json` project files
- generated `*.shotfactory-assets/` folders
- `release/` installers
- Windows signing certificates

GitHub Actions will run `npm ci`, `npm test`, and `npm run dist` on Windows. For signed production builds, configure these repository secrets:

- `WIN_CSC_LINK`
- `WIN_CSC_KEY_PASSWORD`

For auto-update metadata, configure repository variable:

- `SHOT_FACTORY_UPDATE_URL`
