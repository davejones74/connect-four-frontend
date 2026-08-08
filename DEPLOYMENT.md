# Remote Server Deployment

Instructions for deploying the Connect Four stack — PostgreSQL, Java/Spring Boot backend, and Node.js/Express frontend — on an Ubuntu 26.04 server, served behind Apache as a reverse proxy.

The application is served at `http://www.zooze.co.uk/games/connect4/` (only the `www` subdomain has a DNS record).

## Architecture

| Service   | Image                          | Port | Role                                                        |
|-----------|--------------------------------|------|-------------------------------------------------------------|
| `db`      | `postgres:16-alpine`           | 5432 | PostgreSQL database, persisted in the `db-data` volume      |
| `backend` | `eclipse-temurin:26-*-alpine`  | 8080 | Spring Boot REST API (Java 26, Gradle)                      |
| `frontend`| `node:18-alpine`               | 3000 | Express server: static files + reverse proxy for `/api`     |

Request flow:

```
Browser -> Apache (:80) -> frontend (:3000) -> backend (:8080) -> db (:5432)
```

The Node frontend proxies all `/api` requests to the Spring Boot backend, and Apache proxies `/games/connect4/` and `/api/` to the frontend. Apache keeps serving the existing static site on port 80 alongside the proxy paths.

## 1. Install Docker

The server needs Docker Engine + Docker Compose. Install via the official Docker apt repository:

```bash
# save as install-docker.sh and run with sudo
sudo bash install-docker.sh
```

```bash
#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo: sudo bash install-docker.sh"
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

usermod -aG docker "$SUDO_USER"

echo "Docker installed. Log out and back in (or run: newgrp docker) to use docker without sudo."
```

Afterwards **log out and back in** (or run `newgrp docker`) so your user can run `docker` without `sudo`.

## 2. Set up an SSH key for GitHub

The server needs an SSH key registered on the GitHub account that owns the repositories:

```bash
ssh-keygen -t ed25519 -C "your-name@your-domain" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Add the printed public key at <https://github.com/settings/ssh/new>, then verify:

```bash
ssh -T git@github.com
# Hi your-user! You've successfully authenticated, but GitHub does not provide shell access.
```

## 3. Clone the repositories

The top-level stack lives in `/home/david/docker-stack`. Both repos are cloned into it as siblings:

```bash
mkdir -p /home/david/docker-stack
cd /home/david/docker-stack

git clone git@github.com:davejones74/connect-four-backend.git backend
git clone git@github.com:davejones74/connect-four-frontend.git frontend
```

## 4. Create the top-level `docker-compose.yml`

The compose file below wires all three services together. It lives at `/home/david/docker-stack/docker-compose.yml` and is the single entry point for the whole stack (the per-repo `docker-compose.yml` files inside `backend/` and `frontend/` are ignored).

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: connect4-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: connect4
      POSTGRES_USER: connect4
      POSTGRES_PASSWORD: connect4
    ports:
      - "5432:5432"
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U connect4 -d connect4"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    container_name: connect4-backend
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      DB_URL: jdbc:postgresql://db:5432/connect4
      DB_USERNAME: connect4
      DB_PASSWORD: connect4
    ports:
      - "8080:8080"

  frontend:
    build: ./frontend
    container_name: connect4-frontend
    restart: unless-stopped
    environment:
      BACKEND_URL: http://backend:8080
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  db-data:
```

The backend waits for the database to become healthy before starting, so Flyway can run its schema migrations.

## 5. Backend Dockerfile: use Alpine base images

> **Important:** keep the `-alpine` base images in `backend/Dockerfile`. The default `eclipse-temurin:26-*-ubi10-minimal` images are compiled for x86-64-v3 CPUs and fail on older machines with:
>
> ```
> Fatal glibc error: CPU does not support x86-64-v3
> ```
>
> The Alpine variants build and run everywhere.

Use these two lines in `backend/Dockerfile`:

```dockerfile
FROM eclipse-temurin:26-jdk-alpine AS build
# ...
FROM eclipse-temurin:26-jre-alpine
```

## 6. Build and start the stack

```bash
cd /home/david/docker-stack
docker compose up -d --build
```

The first build downloads Gradle, Maven dependencies and npm packages, so it can take a few minutes. Verify everything is up:

```bash
docker compose ps
```

All three containers should show `Up` and `db` should be `(healthy)`.

## 7. Apache reverse proxy

Apache (installed via apt, running as `apache2.service`) proxies the app onto port 80. Two URL patterns are proxied:

- `/games/connect4/` -> `http://127.0.0.1:3000/` — the page and its relative asset paths (`css/style.css`, `js/game.js`, ...)
- `/api/` -> `http://127.0.0.1:3000/api/` — the frontend's own `/api` proxy then forwards these to the backend, matching the app's absolute `/api/...` fetch calls

Save this as `setup-apache-proxy.sh` and run with sudo:

```bash
sudo bash setup-apache-proxy.sh
```

```bash
#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo: sudo bash setup-apache-proxy.sh"
  exit 1
fi

cat > /etc/apache2/conf-available/connect4-proxy.conf <<'EOF'
Redirect 301 /games/connect4 /games/connect4/

ProxyPass /games/connect4/ http://127.0.0.1:3000/
ProxyPassReverse /games/connect4/ http://127.0.0.1:3000/

ProxyPass /api/ http://127.0.0.1:3000/api/
ProxyPassReverse /api/ http://127.0.0.1:3000/api/
EOF

a2enmod proxy proxy_http
a2enconf connect4-proxy

apache2ctl configtest

systemctl reload apache2
echo "Done. Connect4 should be reachable at http://<host>/games/connect4/"
```

The proxy directives are global (server context), so they apply to the default site and will also apply to any future SSL vhost on port 443.

## 8. Deploying an update

To pull new changes from GitHub and restart the app with them:

```bash
cd /home/david/docker-stack/backend && git pull
cd /home/david/docker-stack/frontend && git pull
cd /home/david/docker-stack && docker compose up -d --build
```

What this does:

- `git pull` fetches the latest code into each repo.
- `docker compose up -d --build` rebuilds any image whose source changed and recreates the affected containers, keeping everything else (and all data) untouched.
- Only `db`, `backend` and `frontend` containers are managed by this compose project; the Postgres data in the `db-data` volume survives restarts and rebuilds.

If a container misbehaves after an update, check its logs:

```bash
docker compose logs -f backend    # or frontend
```

## Common operations

```bash
# Status
docker compose ps

# Logs (follow)
docker compose logs -f <service>

# Restart one service
docker compose restart <service>

# Stop everything (keeps the database volume)
docker compose down

# Stop everything and DELETE the database volume
docker compose down -v

# Wipe rebuild from scratch
docker compose build --no-cache && docker compose up -d
```

## Troubleshooting

| Symptom                                                          | Fix |
|------------------------------------------------------------------|-----|
| `permission denied while trying to connect to the docker API`    | Log out and back in, or run `newgrp docker` so the `docker` group takes effect. |
| `Fatal glibc error: CPU does not support x86-64-v3`              | The machine lacks AVX2 (x86-64-v3). Use the `-alpine` Temurin images in `backend/Dockerfile` (see section 5). |
| Apache returns 404 for `/games/connect4/`                        | The proxy conf is not enabled. Run `sudo a2enmod proxy proxy_http`, `sudo a2enconf connect4-proxy`, then `sudo systemctl reload apache2`. |
| Backend starts but requests fail                                 | Check `docker compose logs backend` — usually a DB connection error. The backend only starts after `db` is healthy. |
| Port 8080/3000 already in use                                    | The ports are published on the host. Either stop the conflicting service or change the left-hand side of the `ports:` mapping. |
