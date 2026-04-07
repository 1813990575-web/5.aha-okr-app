# Aha OKR App

A macOS-style OKR desktop app built with Electron, React, TypeScript, and Tailwind CSS.

## Features

- Three-level OKR structure: Objective / Key Result / Todo
- Daily task workspace with drag-in execution flow
- Sidebar tree with inline status, hover, and selection states
- Electron local storage with seeded sample data
- DMG build and GitHub Release workflow

## Tech Stack

- Electron
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- dnd-kit

## Development

Install dependencies:

```bash
npm ci
```

Start the app in development:

```bash
npm run dev
```

Build the renderer and Electron bundles:

```bash
npm run build
```

Build release packages:

```bash
npm run electron:build
```

## Project Structure

```text
src/
  components/      UI and workspace modules
  hooks/           Data and editor hooks
  store/           Local data storage and seed logic
electron/          Electron main/preload processes
.github/workflows/ Release automation
```

## Notes

- Runtime app data is stored outside the repo during normal Electron usage.
- The repository does not need committed build artifacts or local cache files.
- See [PRODUCT_DOCUMENTATION.md](./PRODUCT_DOCUMENTATION.md) for the detailed product spec.
- See [README_INSTALL.md](./README_INSTALL.md) for install-focused notes.
