PRAGMA foreign_keys = ON;

-- Usuarios
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  real_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  location TEXT,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMP,
  streak_count INTEGER DEFAULT 0,      -- días consecutivos chateando
  last_chat_date TEXT,                 -- YYYY-MM-DD (UTC) del último chat que contó para la racha
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Amigos (user1 = quien envía la solicitud, user2 = quien la recibe)
CREATE TABLE IF NOT EXISTS friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user1_id INTEGER NOT NULL,
  user2_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending' | 'accepted'
  request_label TEXT,            -- nombre anónimo (User_XXXX) del solicitante en el chat donde se conocieron
  streak_count INTEGER DEFAULT 0,
  last_chat_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user1_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(user2_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user1_id, user2_id)
);

-- Bloqueos (dirigidos: blocker no vuelve a ser emparejado con blocked, ni viceversa)
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id INTEGER NOT NULL,
  blocked_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (blocker_id, blocked_id),
  FOREIGN KEY(blocker_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(blocked_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Chats (historial; solo entre usuarios registrados)
CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user1_id INTEGER NOT NULL,
  user2_id INTEGER NOT NULL,
  duration_seconds INTEGER,
  was_friends BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user1_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(user2_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Reportes. reported_user_id es NULL si el reportado era anónimo;
-- en ese caso se guarda su etiqueta de chat y un hash de su IP para moderación
-- (nunca la IP en claro).
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reported_user_id INTEGER,
  reporting_user_id INTEGER,
  reported_label TEXT,
  reported_ip TEXT,   -- hash
  reporting_ip TEXT,  -- hash

  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(reported_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(reporting_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_reported ON reports(reported_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_ip ON reports(reported_ip, created_at);

-- Suspensiones de usuarios anónimos (por hash de IP; nunca la IP en claro)
CREATE TABLE IF NOT EXISTS ip_bans (
  ip_hash TEXT PRIMARY KEY,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Columnas añadidas después de la primera versión (moderación y aceptación de términos)
-- se crean en db.ts con ensureColumn(), para que también se apliquen a bases de datos existentes.

-- Mensajes privados entre amigos (texto). Se borran si se elimina la cuenta de cualquiera de los dos.
CREATE TABLE IF NOT EXISTS direct_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL,
  recipient_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(recipient_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_dm_pair ON direct_messages(sender_id, recipient_id, id);
CREATE INDEX IF NOT EXISTS idx_dm_unread ON direct_messages(recipient_id, read_at);

-- Detecciones automáticas de contenido sexual en videochat (análisis local en el navegador).
-- Nunca se guarda vídeo ni imágenes: solo quién, cuándo, categoría y confianza del modelo.
CREATE TABLE IF NOT EXISTS auto_violations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,              -- NULL si el infractor era anónimo
  ip_hash TEXT NOT NULL,        -- hash de la IP del infractor (nunca la IP en claro)
  label TEXT,                   -- User_XXXX usado en ese chat
  category TEXT NOT NULL,       -- 'porn' | 'hentai'
  score REAL NOT NULL,          -- confianza del modelo (0-1)
  action TEXT NOT NULL,         -- 'warning' | 'ban_24h' | 'ban_permanent'
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'overturned'
  reporter_user_id INTEGER,
  reporter_ip_hash TEXT,
  reviewed_by INTEGER,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(reporter_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_violations_user ON auto_violations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_violations_ip ON auto_violations(ip_hash, status);
CREATE INDEX IF NOT EXISTS idx_violations_reporter ON auto_violations(reporter_ip_hash, created_at);

-- Historial de cambios de las rachas entre amigos
CREATE TABLE IF NOT EXISTS streak_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  friendship_id INTEGER NOT NULL,
  event TEXT NOT NULL,          -- 'started' | 'increment' | 'broken' | 'attempt_failed' | 'recovered' | 'reset'
  streak_count INTEGER NOT NULL,
  recovery_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(friendship_id) REFERENCES friends(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_streak_logs_friendship ON streak_logs(friendship_id, id);
