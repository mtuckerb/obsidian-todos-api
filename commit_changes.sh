#!/bin/bash

echo "Checking git status..."
cd /home/gem/obsidian-todos-api

echo "Adding changes..."
git add -A

echo "Committing with message..."
git commit -m "Fix: Corrected tag-based query handling in processDueDates method

- Fixed Dataview API query syntax for tag-based searches
- Tag queries (like #education) now work without quotes
- Course ID queries continue to work with quotes
- Added debug logging for troubleshooting
- Version bumped to 1.3.2

Fixes issue where GET /due-dates?query=%23education returned 0 entries"

echo "Tagging release..."
git tag v1.3.2

echo "Pushing changes..."
git push origin main
git push origin v1.3.2

echo "Done!"