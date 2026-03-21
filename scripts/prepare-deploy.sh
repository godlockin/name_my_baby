#!/bin/bash
# Build and prepare for Cloudflare Pages deployment

# Clean output directory
rm -rf .vercel/output

# Build Next.js static files to .vercel/output/static
npm run build

# Move static files to root of .vercel/output
# Cloudflare Pages expects static files in the root directory
if [ -d ".vercel/output/static" ]; then
  # Move all static files to root
  mv .vercel/output/static/* .vercel/output/
  rmdir .vercel/output/static
fi

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
