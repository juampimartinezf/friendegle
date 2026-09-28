// Datos del responsable del servicio que aparecen en Términos y Privacidad.
// Se definen en Vercel (Environment Variables); el build de producción falla si faltan.
export const LEGAL = {
  owner: import.meta.env.VITE_LEGAL_OWNER || '[Nombre del responsable]',
  contactEmail: import.meta.env.VITE_CONTACT_EMAIL || '[email de contacto]',
  country: import.meta.env.VITE_LEGAL_COUNTRY || '[país]',
  lastUpdated: '28 de septiembre de 2026',
};
