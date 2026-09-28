# Friendegle

Video chat aleatorio y anónimo. Si conectas con alguien, os agregáis como amigos y solo entonces veis vuestros perfiles reales.

- **Frontend**: React 18+ · TypeScript · Vite · Tailwind CSS v4 · React Router · socket.io-client · simple-peer → **Vercel**
- **Backend**: Node · Express 5 · Socket.io · SQLite (better-sqlite3) · JWT · bcryptjs · zod → **DigitalOcean** (Docker)
- **TURN**: Coturn → **DigitalOcean** (mismo Droplet)

```
                      https://tu-dominio.com                      https://api.tu-dominio.com
 Navegador ──────────► Vercel (SPA estática)       Navegador ──► Caddy (TLS) ──► backend :4000 ──► SQLite
     │                                                             (mismo Droplet)
     └── vídeo (UDP/TLS) ──► turn.tu-dominio.com:3478/5349 ──► Coturn ──► el otro navegador
```

## Índice

- [Desarrollo local](#desarrollo-local)
- [Privacidad y seguridad](#privacidad-y-seguridad)
- [Privacidad de IP (servidor TURN)](#privacidad-de-ip-servidor-turn)
- [Normas, edad y moderación](#normas-edad-y-moderación)
- [Despliegue gratuito: Vercel + Oracle Cloud + DuckDNS](#despliegue-gratuito-vercel--oracle-cloud--duckdns)
- [Despliegue a producción](#despliegue-a-producción)
  - [1. DNS](#1-dns) · [2. Droplet](#2-droplet-de-digitalocean) · [3. Backend + TURN](#3-backend--turn-en-el-droplet) · [4. Frontend en Vercel](#4-frontend-en-vercel) · [5. Verificación](#5-verificación)
  - [Certificados SSL](#certificados-ssl) · [Actualizar y revertir](#actualizar-y-revertir) · [Monitoreo y logs](#monitoreo-y-logs) · [Copias de seguridad](#copias-de-seguridad) · [Troubleshooting](#troubleshooting)
- [Variables de entorno](#variables-de-entorno)
- [API](#api)

## Desarrollo local

Requisitos: Node 20.11+ (probado con Node 24).

```bash
npm run setup          # instala raíz, backend y frontend
cp backend/.env.example backend/.env
npm run dev            # TURN en :3478, API en :4000 y web en :5173
```

Abre http://localhost:5173. La BD SQLite (`backend/friendegle.db`) se crea sola al arrancar desde `backend/src/database/init.sql`. En local no hace falta ninguna variable de producción: el frontend llama a `/api` y el proxy de Vite lo reenvía al backend.

### Probar el video chat

- **Bot de prueba**: en el inicio, “Probar primero con un bot de prueba” (`/chat?demo=1`): un desconocido sintético, sin servidor.
- **Dos personas reales**: abre la web en dos navegadores distintos (o uno normal y otro en incógnito), cada uno con su cuenta o en modo anónimo, y pulsa INICIAR CHAT en ambos. La misma cuenta en dos pestañas nunca se empareja consigo misma.
- Si no hay cámara disponible, se envía una imagen animada de prueba en su lugar.

### Probar el build de producción en local

```bash
cd frontend && npm run build && npx vite preview   # http://localhost:4173, con la CSP de producción
```

Sin `VITE_API_URL` avisa y usa `/api` relativo (el proxy de `vite preview` lo reenvía al backend local).

## Privacidad y seguridad

| Requisito | Implementación |
|---|---|
| Nombre real nunca en el chat | El servidor genera un `User_XXXX` **nuevo en cada chat**. El cliente nunca recibe id, username ni nombre del desconocido. |
| Sin buscador / sin lista pública | No existe ningún endpoint que liste o busque usuarios. |
| Perfil solo para amigos | `GET /api/users/:id/profile` responde 404 si no sois amigos aceptados (no revela si el usuario existe). El email nunca se expone. |
| Solicitudes de amistad | Se envían **solo desde un chat en curso** (evento de socket `chat:add-friend`); el servidor resuelve a quién. La solicitud recibida muestra solo el `User_XXXX` de aquel chat. Si ambos pulsan “Agregar”, se aceptan al instante. Rechazar es silencioso. |
| Reportes | `chat:report` guarda el reporte (con hash de IP para anónimos, nunca la IP en claro), termina el chat y bloquea si ambos tienen cuenta. 3 reportes de personas distintas en 24 h suspenden el acceso a la cola. |
| Bloqueo | Tabla `blocks`; los bloqueados no vuelven a emparejarse y se elimina la amistad. |
| Contraseñas / auth | bcrypt (coste 12), JWT de 7 días, mensajes de error que no revelan qué emails existen. |
| Chat de texto en la videollamada | Va por el canal de datos WebRTC (cifrado DTLS, por el mismo TURN que el vídeo): el servidor de Friendegle nunca ve los mensajes. Solo viven en memoria durante el chat actual y se borran al saltar o terminar. Máximo 500 caracteres por mensaje; se muestran siempre como texto, nunca como HTML. |
| **IP oculta entre usuarios** | Todo el vídeo pasa por un servidor TURN propio (`iceTransportPolicy: 'relay'`). Ver [Privacidad de IP](#privacidad-de-ip-servidor-turn). |
| Avatares | Solo avatares predefinidos (`preset:fox`…): no se aceptan URLs externas (evita tracking pixels). |

**En producción, además:**

| Medida | Dónde |
|---|---|
| El backend **no arranca** si falta `TURN_SECRET` o `JWT_SECRET` (≥ 32 caracteres), si `CLIENT_ORIGIN` no es https o tiene comodines, o si `TURN_URLS` apunta a localhost | `backend/src/config.ts` |
| CORS restrictivo: solo los orígenes de `CLIENT_ORIGIN` (REST y Socket.io) | `backend/src/server.ts` |
| Rate limiting: 600 peticiones/15 min por IP en toda la API, 20/15 min en login/registro, 120 eventos de socket/10 s por conexión (si se supera, se desconecta) | `server.ts`, `routes/auth.ts`, `sockets/videoSignaling.ts` |
| IP real del cliente detrás de Caddy (`TRUST_PROXY=1`), necesaria para que el rate limiting y los reportes funcionen | `server.ts`, `videoSignaling.ts` |
| HTTPS en todo: Vercel (frontend), Caddy + Let's Encrypt (API), `turns:` en el 5349 (TURN). HSTS en ambos dominios | `vercel.json`, `deploy/Caddyfile` |
| Content-Security-Policy: el frontend solo puede conectarse a sí mismo y al backend | `frontend/vite.config.ts` |
| Cabeceras: `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, `Permissions-Policy` (cámara y micrófono solo para el propio sitio) | `vercel.json` |
| Contenedor del backend sin privilegios: usuario `node`, sistema de ficheros de solo lectura, `cap_drop: ALL`, `no-new-privileges`; el puerto 4000 no se publica | `backend/Dockerfile`, `deploy/docker-compose.yml` |
| Sin secretos en el código: se generan en el servidor con `./deploy.sh init`; la credencial TURN de desarrollo no entra en el bundle de producción | `deploy/deploy.sh`, `useWebRTC.ts` |
| Firewall: solo 22 (con límite), 80, 443, 3478, 5349 y el rango de relay UDP | `./deploy.sh firewall` |
| Coturn anti-abuso: credenciales que caducan a las 4 h, sin relay TCP, redes privadas bloqueadas (anti-SSRF), cuotas por usuario y ~3 Mbps por sesión | `coturn/turnserver.prod.conf` |
| Sin logs de acceso con IPs en Caddy | `deploy/Caddyfile` |

### Cambios respecto a la especificación original

- **`POST /api/friends/add/:userId` no existe a propósito.** Exigiría que el cliente conociera el id del desconocido, lo que permite enumerar usuarios y vincular chats con cuentas. Se sustituye por el evento de socket `chat:add-friend`. Se añaden `GET /api/friends/requests` y `POST /api/friends/:id/reject`.
- Tablas/columnas extra: `blocks`; `users.streak_count` y `users.last_chat_date` (racha); `friends.request_label`; en `reports`, `reported_user_id` admite NULL (reportes a anónimos), más `reported_label` y hashes de IP.
- `bcryptjs` en lugar de `bcrypt` (misma API, sin compilación nativa en Windows).
- Se añadió `SettingsPage.tsx` (Configuración en la barra lateral).
- **Producción sin `DATABASE_URL`**: se mantiene SQLite, en un volumen de Docker. Pasar a Postgres implicaría reescribir la capa de datos.

### Limitaciones conocidas

- El servidor TURN sí ve la IP de ambos usuarios (es inevitable: es quien reenvía el tráfico). Sus logs van a stdout y Docker los rota (10 MB × 5).
- El JWT vive en `localStorage` (según la especificación): vulnerable si hubiera XSS (la CSP lo mitiga). Lo ideal sería una cookie `httpOnly` + `SameSite`.
- Cola, emparejamientos y rate limiting están en memoria: **un solo proceso de backend**. Para escalar horizontalmente harían falta Redis (adaptador de Socket.io) y Postgres.
- La confirmación de edad es una **declaración** del usuario (casilla 18+), no una verificación de identidad.
- Las URLs de *preview* de Vercel no pasan el CORS (a propósito). Para probar una preview, añade su URL exacta a `CLIENT_ORIGIN` temporalmente.

## Normas, edad y moderación

| Qué | Cómo |
|---|---|
| **Solo mayores de 18** | Al registrarse y al entrar como anónimo hay que marcar “Confirmo que tengo 18 años o más y acepto los Términos y la Política de privacidad”. En el registro lo valida también el servidor (`acceptTerms`) y guarda la fecha (`users.terms_accepted_at`). |
| **Términos y Privacidad** | Páginas públicas `/terminos` y `/privacidad`, enlazadas desde login, registro y Configuración. El responsable, el email de contacto y el país salen de `VITE_LEGAL_OWNER`, `VITE_CONTACT_EMAIL` y `VITE_LEGAL_COUNTRY` (el build de Vercel falla si faltan). |
| **Panel de moderación** | `/admin`, visible solo para las cuentas cuyo email esté en `ADMIN_EMAILS` (para el resto, la API responde 404). Lista los reportes (primero los de “parece menor de edad”) con el motivo, la cuenta o etiqueta anónima y el número total de reportes. Acciones: **Descartar** o **Suspender**. Nunca muestra IPs. |
| **Suspensiones** | Suspender una cuenta la expulsa del chat al instante, bloquea su login y anula su token. Suspender a un anónimo bloquea su IP (guardada solo como hash, tabla `ip_bans`). Sigue activa además la suspensión automática temporal: 3 reportes de personas distintas en 24 h. |
| **Eliminar cuenta** | Configuración → Eliminar cuenta (pide la contraseña). Borra perfil, amistades, bloqueos e historial; los reportes quedan desvinculados. |

> ⚠️ Los textos de Términos y Privacidad son una **plantilla razonable, no asesoramiento legal**: revísalos con un abogado de tu país antes de abrir al público. Infórmate también de tus obligaciones ante contenido ilegal (por ejemplo, cómo y a quién denunciar material de abuso infantil en tu jurisdicción) y revisa los reportes con regularidad.

## Privacidad de IP (servidor TURN)

Con WebRTC directo cada navegador le envía al otro sus IPs (local y pública). Friendegle lo evita forzando que **todo** el tráfico pase por un servidor TURN propio:

```
Usuario A ──► TURN ──► Usuario B      (A solo ve la IP del TURN, y B también)
```

Tres capas:

1. **Cliente** (`frontend/src/hooks/useWebRTC.ts`): `iceTransportPolicy: 'relay'`, fijado en el código. El navegador ni siquiera recoge candidatos `host`/`srflx`; solo pide direcciones de relay al TURN. Además no envía ningún candidato que no sea `typ relay`.
2. **Servidor de señalización** (`sanitizeSignal` en `backend/src/sockets/videoSignaling.ts`): descarta cualquier candidato que no sea `typ relay` (también dentro del SDP) antes de reenviarlo, por si un cliente antiguo o con errores lo intentara.
3. **Credenciales**: llegan con cada emparejamiento (`chat:matched.iceServers`). En local, usuario estático `friendegle` / `friendegle123`. En producción, **efímeras** (TURN REST API): el backend firma `caducidad:User_XXXX` con `TURN_SECRET` y caducan a las 4 h, así nadie puede usar tu TURN como relay gratuito copiando una clave del bundle.

> El STUN (`stun.l.google.com:19302`) se incluye en `iceServers`, pero con la política `relay` el navegador no lo usa.

**En local**, `npm run dev` ya arranca el TURN (`npm run turn` para arrancarlo solo) con la configuración de [`coturn/turnserver.conf`](coturn/turnserver.conf):

- **Con Docker** (Docker Desktop): usa la imagen oficial `coturn/coturn`, igual que en producción.
- **Sin Docker**: usa [`node-turn`](https://www.npmjs.com/package/node-turn), un TURN en JS **solo para desarrollo**, con las mismas credenciales, puertos y realm leídos del mismo `.conf`. Se fuerza con `npm run turn:node`. Solo escucha en `127.0.0.1`.

**Comprobarlo**: en Chrome abre `chrome://webrtc-internals` durante un chat. Todos los candidatos deben ser `relay` y el par seleccionado debe ser `relay ↔ relay`. Si el TURN no está corriendo, el vídeo no conecta (no hay fallback a P2P, a propósito): aparece el aviso “No se pudo conectar el vídeo a través del servidor TURN”.

---

## Despliegue gratuito: Vercel + Oracle Cloud + DuckDNS

La forma de publicar Friendegle **sin pagar nada**. El vídeo necesita un TURN con puertos UDP, y los hostings gratuitos típicos (Render, Koyeb, Railway) no los permiten; una máquina virtual *Always Free* de Oracle sí.

| Parte | Servicio | Ejemplo |
|---|---|---|
| Frontend | Vercel Hobby (gratis, uso no comercial) | `https://friendegle.vercel.app` |
| Backend + TURN + BD | Oracle Cloud *Always Free*: VM Ampere A1 (hasta 4 núcleos, 24 GB RAM, 10 TB de salida al mes) | — |
| Dominios `api` y `turn` | DuckDNS (subdominios gratis) | `friendegle-api.duckdns.org`, `friendegle-turn.duckdns.org` |

**1. GitHub.** Crea un repositorio vacío `friendegle` y sube el proyecto (ya tiene el primer commit):

```bash
git remote add origin https://github.com/TU_USUARIO/friendegle.git
git push -u origin main
```

**2. Oracle Cloud.** Crea la cuenta en cloud.oracle.com (pide tarjeta solo para verificar la identidad; no cobra si usas recursos *Always Free*). Luego:

1. *Compute → Instances → Create instance*: imagen **Ubuntu 24.04**, shape **VM.Standard.A1.Flex** (Ampere, marcado *Always Free*), p. ej. 2 OCPU / 12 GB. Sube tu clave SSH pública. Si aparece “out of capacity”, prueba otro *availability domain* o más tarde.
2. En la instancia: *Attached VNICs → la subred → Security List → Add Ingress Rules* (origen `0.0.0.0/0`):
   - TCP: `80`, `443`, `3478`, `5349`
   - UDP: `443`, `3478`, `49152-65535`
3. Recomendado: convierte la IP pública en **reservada** (*Networking → Reserved Public IPs*) para que no cambie si recreas la instancia.

**3. DuckDNS.** Entra en duckdns.org, crea `friendegle-api` y `friendegle-turn` (o los nombres que quieras) y pon en los dos la IP pública de la instancia.

**4. Servidor** (por SSH: `ssh ubuntu@IP` y luego `sudo -i`). Instala Docker como en el [paso 2 de DigitalOcean](#2-droplet-de-digitalocean) y después:

```bash
git clone https://github.com/TU_USUARIO/friendegle.git /opt/friendegle
cd /opt/friendegle/deploy && chmod +x deploy.sh
./deploy.sh firewall   # detecta Oracle y abre los puertos en iptables (no usa ufw)
./deploy.sh init       # secretos aleatorios + IP pública detectada
nano .env.production   # valores de abajo
./deploy.sh
```

Valores de `.env.production` para este montaje:

```
API_DOMAIN=friendegle-api.duckdns.org
TURN_DOMAIN=friendegle-turn.duckdns.org
ACME_EMAIL=tu-email@gmail.com
CLIENT_ORIGIN=https://friendegle.vercel.app
ADMIN_EMAILS=tu-email@gmail.com
```

**5. Vercel.** Importa el repositorio con **Root Directory = `frontend`** y define en *Environment Variables*:

| Variable | Ejemplo |
|---|---|
| `VITE_API_URL` | `https://friendegle-api.duckdns.org` |
| `VITE_LEGAL_OWNER` | Tu nombre |
| `VITE_CONTACT_EMAIL` | Un email público de contacto |
| `VITE_LEGAL_COUNTRY` | Tu país |

Si Vercel te asigna una URL distinta de la que pusiste en `CLIENT_ORIGIN`, corrígela en el servidor y vuelve a ejecutar `./deploy.sh`.

**6. Moderador.** Regístrate en la web con el email de `ADMIN_EMAILS`: verás **Moderación** en la barra lateral.

La verificación, el monitoreo, los backups y el troubleshooting son los mismos que en la guía general (abajo). Diferencias en Oracle: el firewall es iptables + *Security List* (no ufw + Cloud Firewall), la VM es ARM (todas las imágenes usadas tienen versión arm64) y el proveedor no hace backups automáticos, así que usa `./deploy.sh backup` y copia `deploy/backups/` fuera de vez en cuando.

## Despliegue a producción

Qué necesitas: un dominio propio, una cuenta de DigitalOcean, una cuenta de Vercel y el proyecto en un repositorio de GitHub (Vercel despliega automáticamente con cada push).

En los ejemplos: `tu-dominio.com` (frontend), `api.tu-dominio.com` (backend) y `turn.tu-dominio.com` (TURN).

```bash
# Si el proyecto aún no está en git:
git init && git add . && git commit -m "Friendegle" 
git remote add origin git@github.com:TU_USUARIO/friendegle.git && git push -u origin main
```

`.gitignore` ya excluye `.env`, `.env.production`, las bases de datos, los certificados y los backups; `.gitattributes` fuerza finales de línea LF en scripts y configs (si no, `deploy.sh` falla en Linux al subirlo desde Windows).

### 1. DNS

Crea el Droplet primero (paso 2) para conocer su IP y luego añade en tu proveedor de DNS:

| Tipo | Nombre | Valor | Para |
|---|---|---|---|
| A | `api` | IP del Droplet | Backend (Caddy obtiene el certificado) |
| A | `turn` | IP del Droplet | TURN (certificado para `turns:`) |
| A / CNAME | `@` y `www` | Los valores que indique Vercel en *Settings → Domains* | Frontend |

- Si usas **Cloudflare**, `api` y `turn` deben ir en **DNS only** (nube gris): el proxy de Cloudflare no reenvía TURN y rompería la obtención de certificados.
- Comprueba la propagación con `dig +short api.tu-dominio.com` antes de desplegar; `deploy.sh` también lo avisa.

### 2. Droplet de DigitalOcean

1. **Create → Droplets**: Ubuntu 24.04 LTS, plan básico (1–2 GB de RAM para empezar). Marca **Monitoring** (gráficas y alertas gratuitas) y añade tu clave SSH (no uses contraseña).
2. **Ancho de banda**: todo el vídeo pasa por el TURN. Como referencia, un chat a ~1,5 Mbps por sentido supone ~225 MB de salida cada 10 minutos: vigila la transferencia incluida en el plan y crea una alerta (ver [Monitoreo](#monitoreo-y-logs)).
3. **Cloud Firewall** (*Networking → Firewalls*), como segunda capa además de `ufw`. Reglas de entrada:

| Protocolo | Puertos | Para |
|---|---|---|
| TCP | 22 | SSH (idealmente solo desde tu IP) |
| TCP | 80, 443 | ACME + HTTPS de la API |
| UDP | 443 | HTTP/3 |
| TCP + UDP | 3478 | TURN |
| TCP | 5349 | TURN sobre TLS (`turns:`) |
| UDP | 49152–65535 | Relay de medios del TURN |

4. Conéctate e instala Docker:

```bash
ssh root@IP_DEL_DROPLET
apt update && apt upgrade -y
apt install -y ca-certificates curl git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
apt update && apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
timedatectl set-ntp true   # la hora exacta importa: las credenciales TURN caducan por tiempo
```

### 3. Backend + TURN en el Droplet

```bash
git clone https://github.com/TU_USUARIO/friendegle.git /opt/friendegle
cd /opt/friendegle/deploy
chmod +x deploy.sh

./deploy.sh firewall   # ufw: SSH (limitado), 80, 443, 3478, 5349, 49152-65535/udp
./deploy.sh init       # crea .env.production con JWT_SECRET/TURN_SECRET aleatorios y la IP detectada
nano .env.production   # rellena API_DOMAIN, TURN_DOMAIN, ACME_EMAIL, CLIENT_ORIGIN
./deploy.sh            # valida, construye y levanta todo
```

`./deploy.sh`:

1. Valida `.env.production`: no puede haber valores de ejemplo, los secretos deben tener ≥ 32 caracteres y ser distintos, y comprueba que el DNS apunta al Droplet.
2. Construye la imagen del backend y levanta `docker compose` con **backend** (SQLite en el volumen `friendegle_db`), **Caddy** (HTTPS automático) y **Coturn** (red del host).
3. Espera a que `https://api.tu-dominio.com/api/health` responda.
4. Copia a Coturn el certificado de `turn.tu-dominio.com` que obtuvo Caddy.
5. Instala un cron diario (`/etc/cron.d/friendegle`) para renovar ese certificado en Coturn y hacer backup de la BD.

Archivos implicados:

| Archivo | Qué hace |
|---|---|
| [`deploy/docker-compose.yml`](deploy/docker-compose.yml) | Servicios, volúmenes, límites de seguridad y rotación de logs |
| [`deploy/Caddyfile`](deploy/Caddyfile) | TLS automático, HSTS y proxy (REST + WebSocket) al backend |
| [`deploy/.env.production.example`](deploy/.env.production.example) | Plantilla documentada de variables del servidor |
| [`deploy/deploy.sh`](deploy/deploy.sh) | `init`, `firewall`, despliegue, `status`, `logs`, `certs`, `backup`, `restore`, `down` |
| [`backend/Dockerfile`](backend/Dockerfile) | Build multi-etapa: compila TS y better-sqlite3, y la imagen final corre como usuario `node` con healthcheck |
| [`coturn/turnserver.prod.conf`](coturn/turnserver.prod.conf) | Coturn sin secretos: IP, dominio y `TURN_SECRET` se pasan desde `.env.production` |

### 4. Frontend en Vercel

1. **Add New → Project** e importa el repositorio de GitHub.
2. **Root Directory**: `frontend`. Vercel detecta Vite; [`frontend/vercel.json`](frontend/vercel.json) fija install/build/output, el rewrite SPA (las rutas como `/friends/3` no dan 404 al recargar), la caché inmutable de `/assets` y las cabeceras de seguridad.
3. **Settings → Environment Variables** (entorno *Production*):

   | Nombre | Valor |
   |---|---|
   | `VITE_API_URL` | `https://api.tu-dominio.com` (sin barra final) |
   | `VITE_LEGAL_OWNER` | Responsable del servicio (tu nombre o empresa) |
   | `VITE_CONTACT_EMAIL` | Email público de contacto |
   | `VITE_LEGAL_COUNTRY` | País cuyas leyes rigen los términos |

   Vite las incrusta **al compilar**: si cambias alguna, hay que redesplegar. Si falta alguna, o `VITE_API_URL` no es `https://`, el build de Vercel falla a propósito.
4. **Deploy**. Después, en **Settings → Domains** añade `tu-dominio.com` y `www.tu-dominio.com` y crea los registros DNS que te indique.
5. **Despliegue automático**: cada push a `main` despliega a producción; las demás ramas crean previews (que el CORS bloquea, ver [Limitaciones](#limitaciones-conocidas)).

Asegúrate de que `CLIENT_ORIGIN` en `deploy/.env.production` contiene **exactamente** los orígenes de Vercel (`https://tu-dominio.com,https://www.tu-dominio.com`) y ejecuta `./deploy.sh` si lo cambias.

### 5. Verificación

```bash
./deploy.sh status                                   # 3 contenedores "Up", backend "healthy"
curl -s https://api.tu-dominio.com/api/health        # {"ok":true}
curl -sI -H "Origin: https://evil.example" https://api.tu-dominio.com/api/health | grep -i access-control   # (nada) → CORS bien cerrado
openssl s_client -connect turn.tu-dominio.com:5349 -servername turn.tu-dominio.com </dev/null 2>/dev/null | grep -E "subject|Verify return"   # certificado válido
```

**TURN**: genera una credencial de prueba (en el Droplet):

```bash
cd /opt/friendegle/deploy && . ./.env.production && u="$(( $(date +%s) + 3600 )):test" && echo "usuario: $u" && echo "clave:   $(printf %s "$u" | openssl dgst -sha1 -hmac "$TURN_SECRET" -binary | base64)"
```

Ábrela en [Trickle ICE](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/) con el servidor `turn:turn.tu-dominio.com:3478` (y otra vez con `turns:turn.tu-dominio.com:5349?transport=tcp`) y *ICE transport policy: relay*: debe aparecer un candidato `relay` con la IP del Droplet.

**De punta a punta**: abre `https://tu-dominio.com` en dos redes distintas (p. ej. wifi y datos móviles), inicia un chat en ambas y revisa en `chrome://webrtc-internals` que el par seleccionado es `relay ↔ relay`.

### Certificados SSL

| Dominio | Quién lo emite | Renovación |
|---|---|---|
| `tu-dominio.com` | Vercel | Automática |
| `api.tu-dominio.com` | Caddy (Let's Encrypt, reto HTTP en el puerto 80) | Automática (Caddy renueva ~30 días antes) |
| `turn.tu-dominio.com` | Caddy (mismo mecanismo) | Automática en Caddy; `deploy.sh certs` (cron diario 04:17) la copia a Coturn y lo reinicia solo si cambió |

- Los certificados viven en el volumen `friendegle_caddy_data`. **No lo borres**: Let's Encrypt limita las emisiones por dominio y semana.
- Coturn corre como `nobody` (uid 65534) dentro de su contenedor; `deploy.sh certs` deja los archivos con ese propietario y `privkey.pem` con permisos 600.

### Actualizar y revertir

```bash
cd /opt/friendegle && git pull && ./deploy/deploy.sh            # backend/TURN
# Frontend: se despliega solo al hacer push a main
```

Para revertir: `git checkout <commit-anterior> && ./deploy/deploy.sh` en el Droplet, y en Vercel *Deployments → … → Promote to Production* sobre el despliegue anterior. Haz `./deploy.sh backup` antes de actualizar si el cambio toca `init.sql`.

### Monitoreo y logs

| Qué | Cómo |
|---|---|
| Estado y health check | `./deploy.sh status` (Docker reinicia el backend si el healthcheck falla) |
| Logs en vivo | `./deploy.sh logs backend` · `logs caddy` · `logs coturn` · `logs` (todos) |
| Errores recientes del backend | `docker compose --env-file .env.production logs --since 1h backend \| grep -i error` |
| Tareas programadas | `tail -f /var/log/friendegle-cron.log` |
| Métricas del Droplet | Panel de DigitalOcean → *Graphs*. Crea alertas en *Monitoring → Create alert policy*: **ancho de banda de salida**, CPU > 80 %, memoria > 85 %, disco > 80 % |
| Disponibilidad externa | Un monitor HTTP gratuito (UptimeRobot, Better Stack…) contra `https://api.tu-dominio.com/api/health` cada 5 min |
| Frontend | Vercel → *Deployments* (logs de build) y *Analytics* |
| Reportes de usuarios | Ver abajo |

Los logs de Docker rotan solos (10 MB × 5 ficheros por servicio). Caddy no registra accesos (no guarda IPs de usuarios).

Consultar los reportes de las últimas 24 h:

```bash
cd /opt/friendegle/deploy && docker compose --env-file .env.production exec -T backend node -e "
const db=require('better-sqlite3')('/data/friendegle.db',{readonly:true});
console.table(db.prepare(\"SELECT reported_user_id, reported_label, reason, created_at FROM reports WHERE created_at > datetime('now','-1 day') ORDER BY created_at DESC\").all())"
```

### Copias de seguridad

- `./deploy.sh backup` hace una copia consistente de SQLite (API de backup, sin parar la app) en `deploy/backups/`. El cron la ejecuta a diario a las 03:42 y conserva 14 días.
- Esas copias están **en el mismo Droplet**: activa también *Backups* del Droplet en DigitalOcean o copia `deploy/backups/` fuera (p. ej. `rsync` o Spaces).
- Restaurar: `./deploy.sh restore backups/friendegle-AAAAMMDD-HHMM.db`. Antes hace un backup de la BD actual, luego para el backend, copia el archivo con el propietario correcto, descarta el WAL anterior y vuelve a arrancar.

### Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| El backend se reinicia en bucle; en logs: `Configuración de producción inválida` | Falta o es corto `JWT_SECRET`/`TURN_SECRET`, o `CLIENT_ORIGIN` no es https | Corrige `deploy/.env.production` y `./deploy.sh` |
| `https://api…` no responde y Caddy muestra errores ACME | El DNS no apunta al Droplet, el puerto 80 está cerrado o Cloudflare está en modo proxy | `dig +short api.tu-dominio.com`, revisa ufw y el Cloud Firewall, pon Cloudflare en *DNS only* |
| En el navegador: `blocked by CORS policy` | `CLIENT_ORIGIN` no coincide **exactamente** (https, `www`, barra final) | Iguala el origen que muestra el error y `./deploy.sh` |
| En la consola: `Refused to connect … Content Security Policy` | `VITE_API_URL` en Vercel no es la URL correcta del backend | Corrígela y **redespliega** en Vercel (se fija al compilar) |
| El build de Vercel falla con `VITE_API_URL debe ser la URL https…` | Variable ausente o no https en el entorno *Production* | Añádela en *Settings → Environment Variables* |
| Recargar `/friends` en Vercel da 404 | Root Directory mal configurado (no usa `frontend/vercel.json`) | Root Directory = `frontend` |
| Los usuarios se emparejan pero el vídeo no llega: “No se pudo conectar el vídeo a través del servidor TURN” | Puertos UDP 3478 / 49152-65535 cerrados, o TURN caído | `./deploy.sh logs coturn`, `ufw status`, Cloud Firewall, prueba con Trickle ICE |
| Coturn registra `401` / `Unauthorized` | Hora del servidor desfasada (credenciales “caducadas”) o `TURN_SECRET` distinto entre servicios | `timedatectl` (NTP activo); ambos servicios leen el mismo `.env.production`: `./deploy.sh` |
| Funciona en wifi pero no en redes corporativas | UDP bloqueado en esa red | Comprueba `turns:` en el 5349: `./deploy.sh certs` y `openssl s_client` (ver [Verificación](#5-verificación)) |
| `429 Demasiados intentos` | Rate limit (p. ej. muchos usuarios tras la misma IP de universidad) | Sube `RATE_LIMIT_API` / `RATE_LIMIT_AUTH` en `.env.production` |
| El socket se desconecta al saltar muy rápido | Más de 120 eventos en 10 s | Sube `RATE_LIMIT_SOCKET` |
| Todos los reportes/límites parecen venir de la misma IP | `TRUST_PROXY` desactivado | Ya viene a `1` en `docker-compose.yml`; no expongas el puerto 4000 directamente |
| `deploy.sh: /usr/bin/env: 'bash\r'` | Finales de línea CRLF (editado en Windows sin `.gitattributes`) | `sed -i 's/\r$//' deploy/deploy.sh` y haz commit con `.gitattributes` |
| `docker compose` se queja de una variable `Falta …` | Variable vacía en `.env.production` | Rellénala; `./deploy.sh init` genera los secretos |

## Variables de entorno

### Backend: `backend/.env` (solo desarrollo local)

Plantilla: [`backend/.env.example`](backend/.env.example). En producción **no** se usa este archivo: las variables llegan desde `deploy/docker-compose.yml`.

| Variable | Por defecto | Qué hace |
|---|---|---|
| `PORT` | `4000` | Puerto HTTP del backend |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Orígenes permitidos por CORS (separados por comas) |
| `JWT_SECRET` | secreto de desarrollo | Firma de los tokens de sesión |
| `DB_PATH` | `./friendegle.db` | Ruta del fichero SQLite |
| `TURN_URLS` | `turn:localhost:3478?transport=udp,…tcp` | Servidores TURN que se envían a los clientes |
| `STUN_URL` | `stun:stun.l.google.com:19302` | STUN anunciado (sin uso con la política `relay`) |
| `TURN_USER` / `TURN_PASS` | `friendegle` / `friendegle123` | Usuario TURN estático (solo si no hay `TURN_SECRET`) |
| `TURN_SECRET` | vacío | Si se define, credenciales TURN efímeras (como en producción) |
| `TRUST_PROXY` | vacío | `1` si hay un reverse proxy delante |
| `ADMIN_EMAILS` | vacío | Emails con acceso al panel de Moderación (`/admin`) |
| `RATE_LIMIT_API` / `RATE_LIMIT_AUTH` / `RATE_LIMIT_SOCKET` | `600` / `20` / `120` | Ver tabla de producción |
| `NODE_ENV` | vacío | `production` activa la validación estricta de configuración |

### Servidor de producción: `deploy/.env.production`

Plantilla documentada: [`deploy/.env.production.example`](deploy/.env.production.example). `./deploy.sh init` la copia generando los secretos. Nunca se sube a git (permisos 600).

| Variable | Obligatoria | Qué hace |
|---|---|---|
| `API_DOMAIN` | ✅ | Dominio del backend; Caddy obtiene su certificado |
| `TURN_DOMAIN` | ✅ | Dominio del TURN; se usa en `TURN_URLS`, en el realm de Coturn y para su certificado |
| `PUBLIC_IP` | ✅ | IP pública del Droplet; Coturn escucha y hace relay en ella |
| `ACME_EMAIL` | ✅ | Email de avisos de Let's Encrypt |
| `CLIENT_ORIGIN` | ✅ | Orígenes del frontend permitidos por CORS (solo https, sin comodines) |
| `ADMIN_EMAILS` | — | Emails (separados por comas) con acceso al panel de Moderación |
| `JWT_SECRET` | ✅ | Firma de sesiones (≥ 32 caracteres). Cambiarlo cierra todas las sesiones |
| `TURN_SECRET` | ✅ (con Coturn) | Secreto compartido backend ↔ Coturn para credenciales TURN de 4 h (≥ 32 caracteres) |
| `CLOUDFLARE_TURN_KEY_ID` / `CLOUDFLARE_TURN_API_TOKEN` | — | Alternativa sin servidor propio: usa el TURN gestionado de Cloudflare (credenciales de 6 h renovadas cada hora). Si están definidas, sustituyen a Coturn y ya no hacen falta `TURN_SECRET` ni `TURN_URLS` |
| `STUN_URL` | — | STUN anunciado (por defecto el de Google) |
| `RATE_LIMIT_API` | — | Peticiones por IP cada 15 min a toda la API (600) |
| `RATE_LIMIT_AUTH` | — | Intentos de login/registro por IP cada 15 min (20) |
| `RATE_LIMIT_SOCKET` | — | Eventos por conexión de socket cada 10 s antes de desconectarla (120) |

Fijadas en `docker-compose.yml` (no hace falta tocarlas): `NODE_ENV=production`, `TRUST_PROXY=1`, `PORT=4000`, `DB_PATH=/data/friendegle.db` y `TURN_URLS` (derivada de `TURN_DOMAIN`: UDP y TCP en el 3478 y TLS en el 5349).

### Frontend: variables de Vercel

Plantilla: [`frontend/.env.production.example`](frontend/.env.production.example).

| Variable | Obligatoria | Qué hace |
|---|---|---|
| `VITE_LEGAL_OWNER` / `VITE_CONTACT_EMAIL` / `VITE_LEGAL_COUNTRY` | ✅ en Vercel | Responsable, email de contacto y país que aparecen en `/terminos` y `/privacidad` |
| `VITE_API_URL` | ✅ en Vercel | URL https del backend. Base de las llamadas REST y del WebSocket, y único destino permitido en la CSP. Es pública (va en el bundle): nunca pongas secretos en variables `VITE_*`. Vacía en local |

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Health check (sin rate limit) |
| POST | `/api/auth/register` | `{ email, password, username, realName?, acceptTerms: true }` |
| POST | `/api/auth/login` | `{ email, password }` |
| GET | `/api/auth/me` | Usuario actual |
| PUT | `/api/users/me` | Editar perfil propio |
| GET | `/api/users/:id/profile` | Perfil de un **amigo** |
| POST | `/api/users/:id/block` | Bloquear a un amigo |
| GET | `/api/friends` | Amigos aceptados |
| GET | `/api/friends/requests` | Solicitudes recibidas |
| POST | `/api/friends/:id/accept` · `/reject` | Responder solicitud |
| DELETE | `/api/friends/:id` | Eliminar amistad |
| POST | `/api/reports` | Reportar a un amigo |
| DELETE | `/api/users/me` | Eliminar la propia cuenta (`{ password }`) |
| GET | `/api/admin/reports?status=open` | Moderación: listar reportes (`open`, `actioned` o `dismissed`; solo `ADMIN_EMAILS`) |
| POST | `/api/admin/reports/:id/dismiss` · `/ban` | Moderación: descartar o suspender |

**Socket.io**. Cliente → servidor: `queue:join`, `queue:leave`, `signal`, `chat:leave`, `chat:add-friend`, `chat:report {reason}`, `chat:block`. Servidor → cliente: `queue:waiting`, `queue:suspended`, `chat:matched`, `signal`, `chat:ended`, `friend:status`, `friend:incoming`, `friend:request`, `friend:accepted`, `friends:changed`, `report:ok`, `block:ok`.
