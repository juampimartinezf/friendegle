import LegalLayout from '../components/LegalLayout';
import { LEGAL } from '../legal';

export default function PrivacyPage() {
  const mail = (
    <a href={`mailto:${LEGAL.contactEmail}`} className="font-semibold text-accent hover:underline">
      {LEGAL.contactEmail}
    </a>
  );

  return (
    <LegalLayout title="Política de privacidad">
      <p className="mt-4">
        Esta política explica qué datos trata Friendegle, para qué y qué control tienes sobre ellos. El responsable es{' '}
        {LEGAL.owner} (contacto: {mail}).
      </p>

      <h2>1. Lo que nunca guardamos</h2>
      <ul>
        <li>
          <b>El vídeo, el audio y los mensajes de texto de los chats.</b> Viajan cifrados entre los dos navegadores a
          través de nuestro servidor de relay, que solo reenvía los paquetes y no puede leerlos. No se graban ni se
          almacenan en ningún sitio.
        </li>
        <li>Tu dirección IP en la base de datos (ver el punto 3 para la única excepción, cifrada con un hash).</li>
        <li>Cookies de seguimiento, publicidad ni herramientas de analítica.</li>
      </ul>

      <h2>2. Datos que sí tratamos</h2>
      <ul>
        <li>
          <b>Cuenta</b> (solo si te registras): email, contraseña (guardada como hash bcrypt, nunca en claro), nombre de
          usuario, fecha de alta y fecha en que confirmaste ser mayor de edad y aceptaste los términos.
        </li>
        <li>
          <b>Perfil opcional</b>: nombre real, avatar, biografía y ubicación. Solo lo ven tus amigos aceptados; nunca
          aparece en el chat ni en ninguna lista o buscador (no existen).
        </li>
        <li>
          <b>Actividad</b>: si estás en línea y tu última conexión (visible para tus amigos), y los días en que has
          chateado (uso interno).
        </li>
        <li>
          <b>Relaciones</b>: amistades, solicitudes de amistad y bloqueos.
        </li>
        <li>
          <b>Historial de chats entre usuarios registrados</b>: quiénes participaron, cuánto duró y si eran amigos. Nunca
          su contenido.
        </li>
        <li>
          <b>Reportes</b>: motivo, nombre anónimo usado en el chat, la cuenta reportada y la que reporta o, si eran
          anónimas, un hash irreversible de su IP. Los revisan moderadores de Friendegle.
        </li>
      </ul>

      <h2>3. Direcciones IP</h2>
      <p>
        Para que el otro usuario <b>nunca vea tu IP</b>, todo el tráfico del chat pasa por nuestro servidor de relay, que
        necesariamente la conoce mientras dura la conexión. Los registros técnicos de ese servidor se rotan
        automáticamente. En la base de datos la IP solo se guarda como hash (no reversible) cuando alguien te reporta o
        para aplicar una suspensión, y para limitar abusos se usa temporalmente en memoria.
      </p>

      <h2>4. Para qué los usamos y base legal</h2>
      <ul>
        <li>Prestar el servicio que solicitas: emparejarte, gestionar tu cuenta y tus amistades (ejecución del contrato).</li>
        <li>
          Seguridad y moderación: limitar abusos, tramitar reportes y suspensiones, y colaborar con las autoridades ante
          contenido ilegal (interés legítimo y obligaciones legales).
        </li>
      </ul>
      <p>No vendemos tus datos ni los usamos para publicidad.</p>

      <h2>5. Dónde se guardan y con quién se comparten</h2>
      <ul>
        <li>El frontend se sirve desde Vercel, que registra datos técnicos de las visitas (como la IP) en sus logs.</li>
        <li>El servidor, la base de datos y el relay de vídeo se alojan en Oracle Cloud.</li>
        <li>Solo comunicaremos datos a autoridades cuando la ley lo exija o ante indicios de delitos graves.</li>
      </ul>

      <h2>6. En tu navegador</h2>
      <p>
        Guardamos en el almacenamiento local de tu navegador tu sesión (si tienes cuenta), tu preferencia de tema claro u
        oscuro y, durante la visita, si entraste como anónimo. Se borran al cerrar sesión o al limpiar los datos del
        navegador.
      </p>

      <h2>7. Cuánto tiempo</h2>
      <ul>
        <li>Tu cuenta y tu perfil, hasta que la elimines.</li>
        <li>
          Al eliminar la cuenta (Configuración → Eliminar cuenta) se borran tu perfil, amistades, bloqueos e historial de
          chats. Los reportes se conservan desvinculados de tu cuenta, por seguridad.
        </li>
        <li>Las copias de seguridad se conservan un máximo de 14 días.</li>
      </ul>

      <h2>8. Tus derechos</h2>
      <p>
        Puedes consultar y corregir tus datos desde tu perfil, y eliminar tu cuenta en cualquier momento desde
        Configuración. Para ejercer cualquier otro derecho (acceso, rectificación, supresión, oposición, limitación o
        portabilidad, según la ley aplicable) escríbenos a {mail}. Si resides en la Unión Europea, también puedes
        reclamar ante tu autoridad de protección de datos.
      </p>

      <h2>9. Menores</h2>
      <p>
        Friendegle es solo para mayores de 18 años. Si crees que un menor está usando el servicio, repórtalo en el chat o
        escríbenos a {mail} y actuaremos de inmediato.
      </p>

      <h2>10. Cambios</h2>
      <p>Si cambiamos esta política, publicaremos la nueva versión en esta página con su fecha.</p>
    </LegalLayout>
  );
}
