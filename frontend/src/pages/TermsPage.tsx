import { Link } from 'react-router-dom';
import LegalLayout from '../components/LegalLayout';
import { LEGAL } from '../legal';

export default function TermsPage() {
  return (
    <LegalLayout title="Términos de uso">
      <p className="mt-4">
        Friendegle es un servicio de videochat aleatorio entre desconocidos, ofrecido por {LEGAL.owner}. Al usarlo, con o
        sin cuenta, aceptas estos términos. Si no estás de acuerdo, no uses el servicio.
      </p>

      <h2>1. Solo para mayores de 18 años</h2>
      <p>
        Friendegle es exclusivamente para personas de <b>18 años o más</b>. Al registrarte o entrar como anónimo confirmas
        que cumples este requisito. Si detectamos o se nos informa de que un usuario es menor de edad, suspenderemos su
        acceso.
      </p>

      <h2>2. Normas de conducta</h2>
      <p>Está prohibido, en el vídeo, el audio, el chat de texto o el perfil:</p>
      <ul>
        <li>Mostrar desnudez o contenido sexual.</li>
        <li>Cualquier contenido que involucre a menores de edad.</li>
        <li>Acosar, intimidar, amenazar o insultar a otras personas.</li>
        <li>Contenido de odio o discriminatorio, o que promueva la violencia.</li>
        <li>Grabar, capturar o difundir a otras personas sin su consentimiento.</li>
        <li>Suplantar a otra persona, hacer spam o publicidad.</li>
        <li>Pedir o publicar datos personales de otras personas.</li>
        <li>Cualquier actividad ilegal.</li>
      </ul>

      <h2>3. Moderación, reportes y suspensiones</h2>
      <ul>
        <li>Puedes reportar o bloquear a cualquier persona durante un chat. Reportar termina el chat al instante.</li>
        <li>
          Si una persona recibe varios reportes de usuarios distintos en 24 horas, su acceso al chat se suspende
          automáticamente de forma temporal.
        </li>
        <li>
          El equipo de Friendegle revisa los reportes y puede suspender cuentas o accesos de forma permanente, sin aviso
          previo, cuando se incumplan estas normas.
        </li>
        <li>
          <b>Detección automática:</b> durante el videochat, el navegador de la otra persona analiza automáticamente el
          vídeo que recibe para detectar contenido sexual. Si lo detecta, el vídeo se oculta, el chat termina y se aplica
          una sanción: 1ª vez, advertencia; 2ª, suspensión de 24 horas; 3ª, suspensión permanente. La suspensión afecta a
          tu cuenta y a tu conexión. Un moderador puede revisar y anular cualquier detección errónea.
        </li>
        <li>
          Ante contenido que pueda ser ilegal —en especial cualquier indicio de abuso a menores— podremos conservar la
          información necesaria y comunicarla a las autoridades competentes.
        </li>
      </ul>

      <h2>4. Tu privacidad en el chat</h2>
      <p>
        En el chat apareces como un nombre anónimo (User_XXXX) y tu perfil solo lo ven las personas que aceptas como
        amigas. Aun así, <b>no podemos impedir que la otra persona grabe su pantalla</b>: no muestres nada ni compartas
        datos que no quieras que otros vean. Consulta la{' '}
        <Link to="/privacidad" className="font-semibold text-accent hover:underline">
          Política de privacidad
        </Link>
        .
      </p>

      <h2>5. Tu cuenta</h2>
      <p>
        Eres responsable de mantener tu contraseña en secreto y de la actividad de tu cuenta. Puedes eliminarla cuando
        quieras desde Configuración.
      </p>

      <h2>6. Servicio “tal cual”</h2>
      <p>
        Friendegle se ofrece sin garantías de disponibilidad continua ni de ausencia de errores. En la medida en que la
        ley lo permita, {LEGAL.owner} no responde de lo que otros usuarios digan o muestren, aunque actuaremos ante los
        reportes que recibamos.
      </p>

      <h2>7. Cambios</h2>
      <p>
        Podemos actualizar estos términos. Publicaremos la nueva versión en esta página con su fecha. Si sigues usando
        Friendegle después de un cambio, aceptas la nueva versión.
      </p>

      <h2>8. Ley aplicable y contacto</h2>
      <p>
        Estos términos se rigen por las leyes de {LEGAL.country}. Para cualquier consulta o para reportar un problema
        grave, escríbenos a{' '}
        <a href={`mailto:${LEGAL.contactEmail}`} className="font-semibold text-accent hover:underline">
          {LEGAL.contactEmail}
        </a>
        .
      </p>
    </LegalLayout>
  );
}
