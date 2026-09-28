/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL pública del backend (https://api.tu-dominio.com). Vacía en local. */
  readonly VITE_API_URL?: string;
  /** Responsable del servicio, email de contacto y país (aparecen en Términos y Privacidad). */
  readonly VITE_LEGAL_OWNER?: string;
  readonly VITE_CONTACT_EMAIL?: string;
  readonly VITE_LEGAL_COUNTRY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
