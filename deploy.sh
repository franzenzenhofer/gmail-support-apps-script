#!/bin/bash
# Automated deployment script for Gmail Support System

echo "🚀 Starting automated deployment..."

# Check if clasp is installed
if ! command -v clasp &> /dev/null; then
    echo "❌ clasp not found. Installing..."
    npm install -g @google/clasp
fi

# Push all files
echo "📤 Pushing files to Google Apps Script..."
clasp push --force

# Deploy new version
VERSION=$(date +%Y%m%d_%H%M%S)
echo "🏷️  Deploying version: $VERSION"
clasp deploy --description "Deployment $VERSION"

# Get deployment info
echo "📊 Current deployments:"
clasp deployments

echo "✅ Deployment complete!"
echo "🔗 Open project: clasp open-script"