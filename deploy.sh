#!/bin/bash
set -e

echo "Deploying to Vercel..."
DEPLOY_URL=$(vercel deploy --prod 2>&1 | grep -o 'https://cadi-[a-z0-9]*-mackiescleanings-projects\.vercel\.app' | tail -1)

if [ -z "$DEPLOY_URL" ]; then
  echo "Could not parse deployment URL — alias not set."
  exit 1
fi

echo "Deployed: $DEPLOY_URL"
echo "Aliasing to app.cadi.cleaning..."
vercel alias set "$DEPLOY_URL" app.cadi.cleaning
echo "Done. https://app.cadi.cleaning is live."
