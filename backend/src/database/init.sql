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
