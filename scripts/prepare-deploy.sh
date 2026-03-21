#!/bin/bash
# Build and prepare for Cloudflare Pages deployment

# Clean output directory
rm -rf .vercel/output

# Build Next.js static files to .vercel/output/static
npm run build

# Copy functions directory to .vercel/output/functions
if [ -d "functions" ]; then
  mkdir -p .vercel/output/functions
  cp -r functions/* .vercel/output/functions/
fi

# Copy _routes.json to .vercel/output/
if [ -f "_routes.json" ]; then
  cp _routes.json .vercel/output/_routes.json
fi

echo "Build complete. Output directory: .vercel/output/"
ls -la .vercel/output/
ls -la .vercel/output/static/
