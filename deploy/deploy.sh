#!/usr/bin/env bash
# Friendegle — despliegue en un Droplet de DigitalOcean (Ubuntu 24.04, como root).
#
#   ./deploy.sh init       Crea .env.production con secretos aleatorios e IP detectada
#   ./deploy.sh firewall   Configura ufw (SSH, HTTPS, TURN)
#   ./deploy.sh            Valida, construye y levanta todo (también para actualizar)
#   ./deploy.sh status     Estado de los contenedores y health check
#   ./deploy.sh logs [svc] Logs en vivo (backend | caddy | coturn)
#   ./deploy.sh certs      Copia el certificado TLS del TURN de Caddy a coturn (cron diario)
#   ./deploy.sh backup     Copia de seguridad de la BD SQLite en deploy/backups (cron diario)
#   ./deploy.sh restore F  Restaura la BD desde el backup F (antes hace un backup de la actual)
#   ./deploy.sh down       Para todo (los datos se conservan en los volúmenes)
set -euo pipefail
cd "$(dirname "$0")"

ENV_FILE=.env.production
dc() { docker compose --env-file "$ENV_FILE" "$@"; }
info() { printf '\033[1;35m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m⚠ %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

load_env() {
  [[ -f $ENV_FILE ]] || die "No existe $ENV_FILE. Ejecuta primero: ./deploy.sh init"
  set -a; . "./$ENV_FILE"; set +a
}

cmd_init() {
  [[ -f $ENV_FILE ]] && die "$ENV_FILE ya existe; edítalo a mano (no se sobrescribe)."
  command -v openssl >/dev/null || die "Falta openssl"
  local ip
  ip=$(curl -fsS --max-time 3 http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address || true)
  sed -e "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" \
      -e "s|^TURN_SECRET=.*|TURN_SECRET=$(openssl rand -hex 32)|" \
      ${ip:+-e "s|^PUBLIC_IP=.*|PUBLIC_IP=$ip|"} \
      .env.production.example > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  info "Creado $ENV_FILE (permisos 600) con JWT_SECRET y TURN_SECRET aleatorios${ip:+ e IP $ip}."
  echo "   Edita API_DOMAIN, TURN_DOMAIN, ACME_EMAIL y CLIENT_ORIGIN y luego ejecuta ./deploy.sh"
}

validate() {
  load_env
  local missing=()
  for v in API_DOMAIN TURN_DOMAIN PUBLIC_IP ACME_EMAIL CLIENT_ORIGIN JWT_SECRET TURN_SECRET; do
    [[ -n ${!v:-} ]] || missing+=("$v")
  done
  ((${#missing[@]} == 0)) || die "Faltan variables en $ENV_FILE: ${missing[*]}"
  grep -vE '^[[:space:]]*#' "$ENV_FILE" | grep -qE 'tu-dominio|203\.0\.113\.10' && die "$ENV_FILE todavía tiene valores de ejemplo (tu-dominio / 203.0.113.10)"
  ((${#JWT_SECRET} >= 32 && ${#TURN_SECRET} >= 32)) || die "JWT_SECRET y TURN_SECRET deben tener ≥ 32 caracteres"
  [[ $JWT_SECRET != "$TURN_SECRET" ]] || die "JWT_SECRET y TURN_SECRET deben ser distintos"

  for d in "$API_DOMAIN" "$TURN_DOMAIN"; do
    local resolved
    resolved=$(getent ahostsv4 "$d" | awk 'NR==1{print $1}' || true)
    [[ $resolved == "$PUBLIC_IP" ]] || warn "DNS: $d resuelve a '${resolved:-nada}', no a $PUBLIC_IP. Caddy no podrá obtener el certificado hasta que se propague."
  done
}

cmd_up() {
  command -v docker >/dev/null || die "Docker no está instalado (ver README → Desplegar backend)"
  validate
  mkdir -p turn-certs backups
  info "Construyendo y levantando contenedores…"
  dc up -d --build --remove-orphans

  info "Esperando HTTPS en https://$API_DOMAIN/api/health (la primera vez Caddy pide los certificados)…"
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 5 "https://$API_DOMAIN/api/health" >/dev/null 2>&1; then
      info "Backend OK en https://$API_DOMAIN"
      break
    fi
    sleep 4
  done || true
  curl -fsS --max-time 5 "https://$API_DOMAIN/api/health" >/dev/null 2>&1 || warn "Aún no responde por HTTPS. Revisa: ./deploy.sh logs caddy"

  cmd_certs || warn "Certificado TURN aún no disponible; cron lo reintentará a diario (o ejecuta ./deploy.sh certs)."
  install_cron
  dc ps
}

cmd_certs() {
  load_env
  local dir tmp
  dir=$(dc exec -T caddy sh -c "find /data/caddy/certificates -type d -name '$TURN_DOMAIN' | head -n1" | tr -d '\r')
  [[ -n $dir ]] || { warn "Caddy aún no tiene certificado para $TURN_DOMAIN"; return 1; }
  tmp=$(mktemp -d)
  dc cp "caddy:$dir/$TURN_DOMAIN.crt" "$tmp/fullchain.pem" >/dev/null
  dc cp "caddy:$dir/$TURN_DOMAIN.key" "$tmp/privkey.pem" >/dev/null
  if cmp -s "$tmp/fullchain.pem" turn-certs/fullchain.pem; then
    info "Certificado TURN sin cambios"
  else
    # coturn corre como nobody (uid/gid 65534) dentro de su contenedor
    install -m 644 -o 65534 -g 65534 "$tmp/fullchain.pem" turn-certs/fullchain.pem
    install -m 600 -o 65534 -g 65534 "$tmp/privkey.pem" turn-certs/privkey.pem
    dc restart coturn >/dev/null
    info "Certificado TURN actualizado y coturn reiniciado"
  fi
  rm -rf "$tmp"
}

cmd_backup() {
  load_env
  mkdir -p backups
  local file="backups/friendegle-$(date +%Y%m%d-%H%M).db"
  # API de backup de SQLite: copia consistente aunque la app esté escribiendo
  dc exec -T backend node -e "require('better-sqlite3')('/data/friendegle.db',{readonly:true}).backup('/data/backup.tmp.db').then(()=>process.exit(0))"
  dc cp backend:/data/backup.tmp.db "$file" >/dev/null
  dc exec -T backend rm -f /data/backup.tmp.db
  chmod 600 "$file"
  find backups -name 'friendegle-*.db' -mtime +14 -delete
  info "Backup: deploy/$file (se conservan 14 días)"
}

cmd_restore() {
  local file=${1:-}
  [[ -f $file ]] || die "Uso: ./deploy.sh restore backups/friendegle-AAAAMMDD-HHMM.db"
  load_env
  info "Backup de seguridad de la BD actual antes de restaurar…"
  cmd_backup
  dc stop backend
  dc cp "$file" backend:/data/friendegle.db
  # El WAL de la BD anterior no debe aplicarse sobre la restaurada
  dc run --rm --no-deps --user root --entrypoint sh backend -c \
    'chown node:node /data/friendegle.db && rm -f /data/friendegle.db-wal /data/friendegle.db-shm'
  dc start backend
  info "Restaurada desde $file"
}

install_cron() {
  local here; here=$(pwd)
  cat > /etc/cron.d/friendegle <<EOF
# Generado por deploy.sh
17 4 * * * root $here/deploy.sh certs  >> /var/log/friendegle-cron.log 2>&1
42 3 * * * root $here/deploy.sh backup >> /var/log/friendegle-cron.log 2>&1
EOF
  info "Cron instalado: certificados TURN (04:17) y backups (03:42) diarios"
}

cmd_firewall() {
  command -v ufw >/dev/null || apt-get install -y ufw
  ufw default deny incoming
  ufw default allow outgoing
  ufw limit 22/tcp comment 'SSH (con limite anti fuerza bruta)'
  ufw allow 80/tcp comment 'ACME / redireccion HTTPS'
  ufw allow 443/tcp comment 'HTTPS API'
  ufw allow 443/udp comment 'HTTP/3'
  ufw allow 3478/udp comment 'TURN'
  ufw allow 3478/tcp comment 'TURN sobre TCP'
  ufw allow 5349/tcp comment 'TURN sobre TLS'
  ufw allow 49152:65535/udp comment 'TURN relay'
  ufw --force enable
  ufw status verbose
}

case "${1:-up}" in
  init) cmd_init ;;
  up|deploy) cmd_up ;;
  firewall) cmd_firewall ;;
  certs) cmd_certs ;;
  backup) cmd_backup ;;
  restore) cmd_restore "${2:-}" ;;
  status) load_env; dc ps; curl -fsS "https://$API_DOMAIN/api/health" && echo ;;
  logs) load_env; dc logs -f --tail=200 ${2:-} ;;
  down) load_env; dc down ;;
  *) sed -n '2,13p' "$0"; exit 1 ;;
esac
