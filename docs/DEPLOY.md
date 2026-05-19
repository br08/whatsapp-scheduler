# Deployment Guide

This app runs on a VPS managed by systemd. Docker handles the infrastructure (PostgreSQL, Redis, Evolution API); systemd handles the Node.js process.

---

## Prerequisites

Install these on the VPS before anything else:

- Node.js ≥ 20 — [nodejs.org](https://nodejs.org) or via `nvm`
- npm (comes with Node)
- Docker with the Compose plugin — [docs.docker.com/engine/install](https://docs.docker.com/engine/install)

Verify:

```bash
node -v && npm -v && docker compose version
```

---

## First-time setup

### 1. Clone and configure

```bash
git clone https://github.com/br08/whatsapp-scheduler.git /path/to/whatsapp-scheduler
cd /path/to/whatsapp-scheduler
cp .env.production.example .env
nano .env   # fill in your real credentials
```

### 2. Run the deploy script

```bash
./deploy.sh
```

This installs dependencies, compiles TypeScript, starts Docker infra, waits for PostgreSQL, and runs migrations.

### 3. Install the systemd service (one-time)

Edit `whatsapp-scheduler.service` — replace the two placeholders:

```bash
# Replace YOUR_USER with your Linux username
# Replace /path/to/whatsapp-scheduler with the actual path
nano whatsapp-scheduler.service
```

Then install it:

```bash
sudo cp whatsapp-scheduler.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable whatsapp-scheduler   # auto-start on reboot
sudo systemctl start whatsapp-scheduler
```

Check it's running:

```bash
sudo systemctl status whatsapp-scheduler
```

### 4. Scan the WhatsApp QR code

On first start, Evolution API needs a WhatsApp session. Retrieve the QR code:

```bash
npm run infra:init
```

---

## Day-to-day deploys

After the initial setup, every deploy is four commands:

```bash
git pull
npm ci
npm run build
npm run migrate
sudo systemctl restart whatsapp-scheduler
```

Or as a one-liner:

```bash
git pull && npm ci && npm run build && npm run migrate && sudo systemctl restart whatsapp-scheduler
```

---

## Management cheatsheet

```bash
# Status
sudo systemctl status whatsapp-scheduler

# Start / stop / restart
sudo systemctl start whatsapp-scheduler
sudo systemctl stop whatsapp-scheduler
sudo systemctl restart whatsapp-scheduler

# Logs (live)
sudo journalctl -u whatsapp-scheduler -f

# Logs (last 100 lines)
sudo journalctl -u whatsapp-scheduler -n 100

# Enable / disable auto-start on reboot
sudo systemctl enable whatsapp-scheduler
sudo systemctl disable whatsapp-scheduler

# Infrastructure only (Docker containers)
docker compose up -d      # start
docker compose down       # stop
docker compose ps         # status
```

---

## Dev workflow (local machine)

```bash
# Full local start (Docker + QR auth + app)
npm run dev

# Stop everything (app + Docker)
npm run stop:dev

# Run tests
npm run test:coverage

# Lint / typecheck
npm run lint
```
