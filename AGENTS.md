# InstaSetka Agent Context

## Project

InstaSetka is a local-first Instagram grid organizer built with React, TypeScript, Vite, and Tauri. The same frontend is also deployed as a static Cloudflare Pages web app.

Core workflows:
- import JPEG/PNG images into a source canvas;
- arrange posts in a 3-column Instagram-style grid;
- crop, rotate, reorder, lock, and delete grid posts;
- create carousel posts and reorder slides;
- split one source image across multiple selected grid slots;
- export individual posts, batch renders, and feed snapshots.

## Branches

- `main`: Windows desktop release line.
- `codex/cloudflare-web-version`: Cloudflare Pages web deployment line.
- `codex/macos-build-workflow`: experimental macOS build workflow.

## Commands

- Dev server: `npm run dev`
- Tests: `npm run test`
- Frontend build: `npm run build`
- Windows desktop build: `npm run tauri -- build`
- Cloudflare Pages deploy: `npm run pages:deploy` on `codex/cloudflare-web-version`

## Current Released State

Latest Windows release: `v0.1.2`.

Important shipped behavior:
- feed snapshot export uses 2px spacing between slots;
- snapshot/export image loading avoids a decode-only path;
- draft versions can be created with `+` and deleted with `-` after confirmation;
- the last draft cannot be deleted;
- web app processes images locally in the browser and does not upload user images.

## CodeGraph

This project has a local CodeGraph index in `.codegraph/`. Prefer CodeGraph for structural questions and use `projectPath: "C:\\Users\\johnk\\Documents\\InstaSetka"` if the MCP server does not infer the workspace path.

The `.codegraph/` directory is local generated state and should not be committed.
