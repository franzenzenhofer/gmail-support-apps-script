#!/bin/bash

# Gmail Support System - Automated Deployment Script
# Deploys to Google Apps Script using clasp

set -e

echo "🚀 Gmail Support System - Automated Deployment"
echo "=============================================="

# Check if clasp is installed
if ! command -v clasp &> /dev/null; then
    echo "❌ clasp is not installed. Installing..."
    npm install -g @google/clasp
fi

# Check if logged in to clasp
if ! clasp login --status &> /dev/null; then
    echo "🔐 Please login to clasp first:"
    clasp login
fi

# Environment (development, staging, production)
ENVIRONMENT=${1:-development}
echo "📍 Deploying to: $ENVIRONMENT"

# Create .clasp.json if it doesn't exist
if [ ! -f .clasp.json ]; then
    echo "📝 Creating new Apps Script project..."
    clasp create --title "Gmail Support System - $ENVIRONMENT" --type standalone
else
    echo "📂 Using existing project configuration"
fi

# Push code to Apps Script
echo "📤 Pushing code to Google Apps Script..."
clasp push

# Deploy as web app (production only)
if [ "$ENVIRONMENT" = "production" ]; then
    echo "🌐 Deploying as web app..."
    clasp deploy --description "Production deployment $(date)"
    
    # Get the web app URL
    echo "🔗 Getting web app URL..."
    clasp deployments
fi

# Open in browser
echo "🌍 Opening Apps Script editor..."
clasp open

echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Set your Gemini API key in ConfigService.gs"
echo "2. Run the setup() function once"
echo "3. Test with processNewSupportEmails()"
echo ""
echo "📖 Documentation: https://github.com/franzenzenhofer/gmail-support-apps-script"