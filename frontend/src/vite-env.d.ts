/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL pública del backend (https://api.tu-dominio.com). Vacía en local. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
