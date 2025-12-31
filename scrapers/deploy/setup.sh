#!/bin/bash
# Setup script for EC2 scraper instance
# Run this on a fresh Ubuntu 22.04 instance

set -e

echo "=== BlitzPrices Scraper Setup ==="

# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Chrome dependencies for Puppeteer
sudo apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils

# Install git
sudo apt-get install -y git

# Create app directory
mkdir -p ~/blitzprices-scraper
cd ~/blitzprices-scraper

echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "1. Clone your repo or copy the scraper files"
echo "2. Create .env with your Supabase credentials"
echo "3. Run: npm install"
echo "4. Run: npm run scrape -- --test --dry-run"
