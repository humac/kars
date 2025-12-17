# Quick Start - Portainer Deployment

Get your Asset Compliance System (ACS) running on Portainer in minutes!

## Prerequisites
- Portainer instance running
- GitHub account
- Cloudflare account (for kars.jvhlabs.com)

## 5-Minute Setup

### Step 1: Fork/Clone Repository
```bash
git clone https://github.com/YOUR_USERNAME/kars.git
```

### Step 2: Configure GitHub Actions

1. Go to repository **Settings** → **Actions** → **General**
2. Set **Workflow permissions** to "Read and write permissions"
3. Save

### Step 3: Create Portainer Stack

1. Open Portainer → **Stacks** → **Add stack**
2. Name: `asset-registration`
3. Build method: **Web editor**
4. Copy content from `docker-compose.portainer.yml`
5. Set environment variables:

```env
GITHUB_REPOSITORY=your-username/kars
APP_PORT=8080
JWT_SECRET=generate-a-long-random-string-here
ADMIN_EMAIL=admin@jvhlabs.com
```

6. Click **Deploy the stack**

### Step 4: Setup Auto-Deploy Webhook

1. In your stack, scroll to **Webhook**
2. Click **Create a webhook**
3. Copy the webhook URL
4. Go to GitHub repository → **Settings** → **Secrets and variables** → **Actions**
5. Add secret:
   - Name: `PORTAINER_WEBHOOK_URL`
   - Value: Paste the webhook URL

### Step 5: Setup Cloudflare Tunnel

**Easy Method (via Cloudflare Dashboard):**

1. Go to Cloudflare Zero Trust → **Networks** → **Tunnels**
2. Click **Create a tunnel**
3. Name: `asset-registration`
4. Save and copy the tunnel token
5. Add to Portainer stack as new service:

Edit your stack, add this service:
```yaml
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: cloudflared-tunnel
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token YOUR_TOKEN_HERE
    networks:
      - asset-network
```

6. In Cloudflare tunnel → **Public Hostname** → Add:
   - Subdomain: `assets`
   - Domain: `jvhlabs.com`
   - Service: `http://asset-registration-frontend:80`

### Step 6: Deploy!

Push to main branch:
```bash
git add .
git commit -m "Initial deployment setup"
git push origin main
```

GitHub Actions will automatically:
- Build Docker images
- Push to GitHub Container Registry
- Trigger Portainer to deploy

### Step 7: Access Your App

Visit: **https://assets.jvhlabs.com**

Register first user → Automatically becomes admin!

## That's It! 🎉

Your SOC2-compliant asset registration system is now live!

## Next Steps

- Add companies in **Company Management**
- Invite team members
- Configure additional admins in **Admin Settings**

## Troubleshooting

**Can't access app?**
- Check Portainer containers are running
- Verify Cloudflare tunnel status
- Check DNS propagation (may take 5-10 minutes)

**Containers not starting?**
- Check environment variables are set
- View container logs in Portainer
- Ensure port 8080 is available

**Need Help?**
See full [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.
