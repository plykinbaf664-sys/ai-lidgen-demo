# Leadgen Client MVP — VPS deployment

Замените `/opt/leadgen-client` и `leadgen.example.com`, если используются другие значения.

## 1. Подготовка

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin leadgen
sudo mkdir -p /opt/leadgen-client /var/lib/leadgen-client /var/backups/leadgen-client
sudo chown -R leadgen:leadgen /opt/leadgen-client /var/lib/leadgen-client /var/backups/leadgen-client
sudo chmod 700 /var/lib/leadgen-client /var/backups/leadgen-client
```

Скопируйте проект в `/opt/leadgen-client`, затем создайте `.env.production` из `.env.example` и выполните `sudo chown leadgen:leadgen /opt/leadgen-client/.env.production && sudo chmod 600 /opt/leadgen-client/.env.production`. Не переносите `.env.local` и `.leadgen-data` из исходного проекта.

Сгенерируйте пароль и session secret локально или на VPS:

```bash
node -e "const c=require('node:crypto');const p=process.argv[1],s=c.randomBytes(16).toString('base64url');console.log('scrypt$'+s+'$'+c.scryptSync(p,s,64).toString('base64url'))" 'НОВЫЙ_ПАРОЛЬ'
openssl rand -base64 48
```

Первый результат запишите в `AUTH_PASSWORD_HASH`, второй — в `AUTH_SESSION_SECRET`. Заполните новую клиентскую почту в SMTP/IMAP и search credentials. Оставьте `EMAIL_TEST_MODE=true` до ручного mailbox smoke.

## 2. Production build

```bash
cd /opt/leadgen-client
sudo -u leadgen npm ci
sudo -u leadgen npm run build
sudo chmod +x scripts/backup-client-data.sh
```

## 3. systemd

```bash
sudo cp deploy/leadgen-client.service deploy/leadgen-worker.service deploy/leadgen-worker.timer deploy/leadgen-cleanup.service deploy/leadgen-cleanup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now leadgen-client.service leadgen-worker.timer leadgen-cleanup.timer
sudo systemctl status leadgen-client.service leadgen-worker.timer
```

Processor обрабатывает не более одного due-письма за запуск; очередь и статусы лежат в `/var/lib/leadgen-client` и переживают restart/reboot.

## 4. Nginx и HTTPS

```bash
sudo cp deploy/nginx-leadgen-client.conf /etc/nginx/sites-available/leadgen-client
sudo ln -s /etc/nginx/sites-available/leadgen-client /etc/nginx/sites-enabled/leadgen-client
sudo nginx -t
sudo systemctl reload nginx
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d leadgen.example.com
```

После выпуска сертификата проверьте автоматическое обновление: `sudo certbot renew --dry-run`.

## 5. Backup и обновление

```bash
sudo -u leadgen /opt/leadgen-client/scripts/backup-client-data.sh
cd /opt/leadgen-client
sudo -u leadgen npm ci
sudo -u leadgen npm run build
sudo systemctl restart leadgen-client.service
```

Перед каждым обновлением делайте backup. Скрипт копирует только persistent client data, не копирует `node_modules`, `.next`, cache и logs, и хранит архивы 14 дней.
