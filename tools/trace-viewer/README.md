# Trace Viewer

Lightweight React app to view AI quote generation traces.

## Setup

```bash
cd tools/trace-viewer
npm install
```

## Usage

```bash
npm run dev
```

Opens at http://localhost:5173

## Features

- Reads Supabase credentials from project root `.env.local`
- View recent traces
- Search by trace ID
- Expandable step-by-step view
- Color-coded durations (slow steps highlighted in yellow/red)
- Input/output JSON for each step
