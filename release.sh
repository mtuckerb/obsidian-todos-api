#!/bin/bash

echo "Building the plugin..."
npm run build

echo "Checking build status..."
if [ -f "main.js" ]; then
    echo "✅ Build successful - main.js exists"
else
    echo "❌ Build failed - main.js missing"
    exit 1
fi

echo "Creating Git tag for version 1.1.11..."
git add .
git commit -m "Release v1.1.11 - Fixed moment.js import and enhanced release workflow"
git tag v1.1.11

echo "Tag created: v1.1.11"
echo "To complete the release:"
echo "1. git push origin main"
echo "2. git push origin v1.1.11"
echo "3. GitHub Actions will automatically create the release with assets"