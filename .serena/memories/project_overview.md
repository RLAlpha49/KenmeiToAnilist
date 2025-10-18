# Project Overview

## Purpose

Kenmei to AniList is a desktop Electron application that helps users migrate and synchronize their manga library from Kenmei to AniList. It provides a user-friendly interface for importing, matching, and syncing manga collections.

## Tech Stack

- **Framework**: Electron with TypeScript
- **UI**: React 19 with Radix UI components
- **Routing**: TanStack Router
- **Styling**: Tailwind CSS 4
- **Build Tool**: Vite
- **State Management**: React hooks and contexts
- **Storage**: electron-store and IndexedDB
- **Error Tracking**: Sentry

## Key Features

- Import manga from Kenmei CSV exports
- Smart matching algorithm to match manga to AniList entries
- One-click synchronization to AniList
- Auto-pause for inactive manga
- Flexible configuration for sync priorities
- Caching system for performance

## Development Commands

- `npm start` - Start the app in development mode
- `npm run build` / `npm run make` - Build for production
- `npm run lint` - Run ESLint
- `npm run format:write` - Format code with Prettier
- `npm run precommit` - Run format and lint (used by Husky)
- `npm run docs` - Generate TypeDoc documentation

## Project Structure

- `src/` - Main source code
  - `api/` - AniList API client and services
  - `components/` - React UI components
  - `contexts/` - React context providers
  - `helpers/` - Helper functions
  - `hooks/` - Custom React hooks
  - `pages/` - Page components
  - `routes/` - Router configuration
  - `utils/` - Utility functions
  - `types/` - TypeScript type definitions
- `config/` - Configuration files (Vite, ESLint, TypeDoc, etc.)
- `docs/` - User and developer documentation
- `documentation/` - Generated TypeDoc documentation
