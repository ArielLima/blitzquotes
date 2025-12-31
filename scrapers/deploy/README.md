# Deploying BlitzPrices Scraper to AWS

## Quick Start (AWS Console)

### 1. Launch EC2 Instance

1. Go to EC2 → Launch Instance
2. Settings:
   - **Name**: `blitzprices-scraper`
   - **AMI**: Ubuntu 22.04 LTS
   - **Instance type**: `t3.small` (2 vCPU, 2GB RAM - good for Puppeteer)
   - **Key pair**: Create or select existing
   - **Security group**: Allow SSH (port 22) from your IP
   - **Storage**: 20GB gp3

3. Under "Advanced details" → User data, paste contents of `userdata.sh`

4. Launch instance

### 2. Connect and Setup

```bash
# SSH into instance
ssh -i your-key.pem ubuntu@<instance-ip>

# Clone repo (or scp files)
git clone https://github.com/yourusername/blitzquotes.git
cd blitzquotes/scrapers

# Create .env file
cat > .env << 'EOF'
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SCRAPE_DELAY_MS=1000
MAX_PAGES_PER_CATEGORY=50
EOF

# Install dependencies
npm install

# Test run (dry run, 1 category)
npm run scrape -- --test --dry-run
```

### 3. Run Scraper

```bash
# Dry run first (no DB writes)
npm run scrape -- --dry-run

# Full run (writes to DB)
npm run scrape

# Run in background with logging
nohup npm run scrape > scrape.log 2>&1 &

# Monitor progress
tail -f scrape.log
```

## AWS CLI Method

```bash
# Create security group
aws ec2 create-security-group \
  --group-name blitzprices-scraper-sg \
  --description "BlitzPrices scraper security group"

# Allow SSH
aws ec2 authorize-security-group-ingress \
  --group-name blitzprices-scraper-sg \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0

# Launch instance
aws ec2 run-instances \
  --image-id ami-0c7217cdde317cfec \
  --instance-type t3.small \
  --key-name your-key-name \
  --security-groups blitzprices-scraper-sg \
  --user-data file://deploy/userdata.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=blitzprices-scraper}]' \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":20,"VolumeType":"gp3"}}]'
```

## Cost Estimate

- **t3.small**: ~$0.02/hour = ~$15/month running 24/7
- **t3.nano**: ~$0.005/hour = ~$4/month (may be tight for Puppeteer)
- **Storage**: ~$2/month for 20GB

**Tip**: Use `t3.small` for scraping, stop when done.

## Troubleshooting

### Puppeteer fails to launch
```bash
# Make sure all Chrome dependencies are installed
sudo apt-get install -y chromium-browser
```

### Out of memory
- Upgrade to `t3.medium` (4GB RAM)
- Or reduce `MAX_PAGES_PER_CATEGORY`

### Rate limited
- Increase `SCRAPE_DELAY_MS` to 2000+
- Add proxy rotation (see scrapers/CLAUDE.md)
