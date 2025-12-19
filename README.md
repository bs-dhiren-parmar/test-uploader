# Augmet Desktop Uploader

A desktop application for uploading medical/genomic files to the Augmet platform. Built with **Electron**, **React**, **TypeScript**, and **Vite**.

## Features

- **User Authentication**: Secure login with email, API key, and base URL
- **Patient Management**: Fetch and select patients, visits, and samples
- **File Upload**: 
  - Drag & drop file upload interface
  - Multi-part S3 upload for large files (100MB chunks)
  - Progress tracking and resume capability
  - File validation (fastq, bam, bai, vcf, etc.)
- **File List Management**: View, search, download, and manage uploaded files
- **Desktop Notifications**: Native OS notifications for upload status
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

## Installation

```bash
npm install
```

## Running the App

### Development Mode
```bash
npm run dev
```
This starts the Vite dev server and launches Electron with DevTools enabled.

### Production Mode
```bash
npm start
```
Builds the React app and runs Electron in production mode.

## Project Structure

```
augmet-desktop/
├── main.js                 # Electron main process
├── preload.js              # Preload script for secure IPC
├── index.html              # Root HTML entry point
├── package.json            # Project configuration
├── vite.config.ts          # Vite build configuration
├── tsconfig.json           # TypeScript configuration
├── src/
│   ├── App.tsx             # Main React app with routing
│   ├── main.tsx            # React entry point
│   ├── index.css           # Global styles
│   ├── components/         # Reusable React components
│   │   ├── FileDropZone.tsx
│   │   ├── Layout.tsx
│   │   └── SampleCard.tsx
│   ├── pages/              # Page components
│   │   ├── Login.tsx
│   │   ├── Uploader.tsx
│   │   ├── FileList.tsx
│   │   └── Help.tsx
│   ├── context/            # React context providers
│   │   └── AuthContext.tsx
│   ├── hooks/              # Custom React hooks
│   │   └── useFileUpload.ts
│   ├── services/           # API service functions
│   │   ├── api.ts
│   │   ├── authService.ts
│   │   ├── fileUploadService.ts
│   │   └── patientService.ts
│   ├── types/              # TypeScript type definitions
│   │   ├── index.ts
│   │   └── electron.d.ts
│   ├── utils/              # Utility functions
│   │   ├── constants.ts
│   │   ├── helpers.ts
│   │   └── Queue.ts
│   └── styles/             # Component-specific styles
│       ├── layout.css
│       ├── login.css
│       ├── uploader.css
│       ├── fileList.css
│       ├── fileDropZone.css
│       └── sampleCard.css
└── icon files              # App icons for different platforms
```

## Tech Stack

- **Electron** (v28) - Desktop application framework
- **React** (v19) - UI library
- **TypeScript** (v5) - Type safety
- **Vite** (v7) - Build tool with fast HMR
- **Axios** - HTTP client
- **React Router** - Navigation
- **React Select** - Enhanced select components

## Commit Message Convention

This project uses **Conventional Commits** for semantic versioning. The commit message format determines version bumps automatically:

### Commit Types and Version Impact

| Commit Type | Version Bump | Description |
|-------------|--------------|-------------|
| `BREAKING CHANGE: ` | **Major** | Breaking change (Note that the BREAKING CHANGE: token must be in the footer of the commit) (bumps major version e.g., 1.0.0 → 2.0.0) |
| `feat:` | **Minor** | New feature (bumps minor version e.g., 1.0.0 → 1.1.0) |
| `fix:` | **Patch** | Bug fix (bumps patch version e.g., 1.0.0 → 1.0.1) |
| `docs:` | None | Documentation changes only |
| `style:` | None | Code style changes (formatting, semicolons, etc.) |
| `refactor:` | None | Code refactoring without feature or fix |
| `test:` | None | Adding or updating tests |
| `chore:` | None | Build process or auxiliary tool changes |

### Commit Message Examples

```bash
# Major version bump (new feature)
git commit -m "feat: add multi-file upload support"

# Patch version bump (bug fix)
git commit -m "fix: resolve file upload timeout issue"

# No version bump
git commit -m "docs: update README with commit conventions"
git commit -m "chore: update dependencies"
```

### Breaking Changes

For breaking changes, add `BREAKING CHANGE:` in the commit body or use `!` after the type:

```bash
git commit -m "feat!: redesign file upload API"
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development mode with hot reload |
| `npm run build` | Build React app for production |
| `npm start` | Build and run in production mode |
| `npm run preview` | Preview production build |
| `npm run dist` | Build distributable packages |
| `npm run dist:win` | Build Windows installer |
| `npm run dist:mac` | Build macOS installer |
| `npm run dist:linux` | Build Linux packages (deb, AppImage) |

## Building for Distribution

Build distributable packages for all platforms:

```bash
npm run dist
```

Or build for a specific platform:

```bash
npm run dist:win    # Windows (NSIS installer)
npm run dist:mac    # macOS (DMG)
npm run dist:linux  # Linux (DEB, AppImage)
```

Output will be in the `release/` directory.

## API Endpoints

The application connects to the Augmet API with the following endpoints:

- `/api/users/authenticate/by-api-key` - User authentication
- `/api/patients/patient` - Get all patients
- `/api/patients/visits/{patient_id}` - Get patient visits and samples
- `/api/patients/add-sample-id` - Add new sample ID
- `/api/file-upload` - Create/update file upload record
- `/api/file-upload/data-tables` - Get file list with pagination
- `/api/file-upload/intiate-multipart-upload` - Initiate S3 multipart upload
- `/api/file-upload/genrate-signed-urls` - Get signed URLs for parts
- `/api/file-upload/complete-signed-upload` - Complete multipart upload
- `/api/file-upload/cancel-delete/{id}` - Cancel or delete upload

## Supported File Types

- **FASTQ**: `.fq.gz`, `.fastq.gz`
- **BAM**: `.bam`
- **BAI**: `.bai`, `.bam.bai`
- **VCF**: `.vcf`, `.vcf.idx`, `.vcf.gz`
