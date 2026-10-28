import { Link } from 'react-router-dom'
import { usePageTitle } from '../usePageTitle'
import { Contact, LegalPage, Section, list } from './LegalParts'

// Los mismos textos que en Legal.tsx, en español.

export function PrivacyEs() {
  usePageTitle('Política de privacidad')
  return (
    <LegalPage
      title="Política de privacidad"
      intro="Penduet recoge lo mínimo posible para que dos personas dibujen juntas. Esta página dice qué es, a dónde va y cómo quitarlo."
    >
      <Section title="Qué guardamos">
        <ul className={list}>
          <li>
            <strong className="text-fg">Una identidad de invitado al azar.</strong> La primera vez que abres una sala entras como invitado:
            un identificador interno, sin correo ni contraseña. Tu navegador guarda la sesión para que seas la misma persona en ese
            dispositivo.
          </li>
          <li>
            <strong className="text-fg">Tu nombre.</strong> Recibes un nombre y puedes cambiarlo en Ajustes (hasta 30 caracteres). La otra
            persona de tu sala lo ve.
          </li>
          <li>
            <strong className="text-fg">Registros de salas.</strong> El código de la sala, quién la abrió y quién entró, cuándo, y para qué
            lección era. Se quedan con tu perfil de invitado hasta que borres tus datos, o hasta que el perfil se elimine tras 30 días sin
            uso.
          </li>
          <li>
            <strong className="text-fg">Tus líneas, mientras exista la sala.</strong> Lo que dibujas en una sala lo guarda el servicio en
            tiempo real para que la otra persona lo vea y para que puedas volver a entrar si se corta la conexión. Se borra más o menos una
            hora después de cerrar la sala, o tras un día sin actividad.
          </li>
          <li>
            <strong className="text-fg">Tu dirección de internet, por un momento.</strong> Los servicios que hacen funcionar Penduet la ven
            cuando te conectas. La usamos para limitar abusos (por ejemplo, demasiados intentos de abrir salas) y, cuando la verificación
            humana está activa, se pasa a esa verificación. No se escribe en nuestra base de datos, y los contadores breves que se usan
            para los límites caducan solos.
          </li>
        </ul>
      </Section>

      <Section title="Qué se queda en tu dispositivo">
        <p className="text-muted">
          Los dibujos libres, tu progreso en las lecciones, tu elección de tema y de idioma, y tu sesión de invitado se guardan en tu
          navegador (almacenamiento local). No salen de tu dispositivo, salvo la sesión, que es como el servicio te reconoce. Si borras los
          datos del navegador, desaparecen.
        </p>
      </Section>

      <Section title="Lo que no hacemos">
        <ul className={list}>
          <li>No te pedimos correo, teléfono, ubicación ni tu nombre real.</li>
          <li>No vendemos tus datos ni los compartimos con fines de publicidad.</li>
          <li>Esta primera versión no muestra anuncios, no tiene analítica ni scripts de seguimiento, y no usa cookies de seguimiento.</li>
          <li>No hay chat. Lo único que dos personas intercambian en una sala son sus líneas y sus nombres.</li>
          <li>El sonido de Dibuja y adivina se genera en tu dispositivo; no se descarga ni se envía nada.</li>
        </ul>
      </Section>

      <Section title="Quién más los maneja">
        <ul className={list}>
          <li>
            <strong className="text-fg">Supabase</strong> guarda la identidad de invitado, el nombre y los registros de las salas.
          </li>
          <li>
            <strong className="text-fg">Cloudflare</strong> entrega el sitio, ejecuta el servicio en tiempo real que lleva tus líneas y,
            cuando se activa, ofrece una verificación humana al crear una sala.
          </li>
        </ul>
        <p className="text-muted">
          Estas empresas tratan los datos en nuestro nombre y tienen sus propias políticas de privacidad y medidas de seguridad.
        </p>
      </Section>

      <Section title="Si más adelante llegan anuncios o analítica">
        <p className="text-muted">
          Penduet podría añadir anuncios o analítica en una versión futura para pagar su funcionamiento. Si eso pasa, lo diremos en el sitio
          antes de que empiece, actualizaremos esta página con las empresas involucradas y lo que recibe cada una, y pediremos tu
          consentimiento donde la ley lo exija. La fecha de arriba cambia cada vez que cambia esta página.
        </p>
      </Section>

      <Section title="Tus opciones">
        <ul className={list}>
          <li>
            <strong className="text-fg">Borrar todo:</strong> Ajustes y luego «Borrar mis datos». Elimina tu perfil, las salas que abriste y
            tu lugar en otras salas, para siempre.
          </li>
          <li>
            <strong className="text-fg">Cambiar tu nombre</strong> en cualquier momento en Ajustes.
          </li>
          <li>
            <strong className="text-fg">Escríbenos:</strong> para ver, corregir o quitar lo que tenemos sobre ti, usa el contacto de abajo.
            Un invitado no tiene correo, así que dinos más o menos cuándo lo usaste y haremos lo que podamos; Ajustes es la vía segura.
          </li>
        </ul>
      </Section>

      <Section title="Niñas y niños">
        <p className="text-muted">
          No hay chat ni emparejamiento con desconocidos: alguien tiene que darle a la otra persona el código de la sala. No pedimos a
          propósito datos personales a menores, pero todavía no hay verificación de edad ni controles parentales, así que un niño debe
          dibujar con un adulto cerca.
        </p>
      </Section>

      <Section title="Cambios y contacto">
        <p className="text-muted">
          Cuando esta página cambie de forma importante, lo diremos en la página de inicio. Las reglas para usar Penduet están en los{' '}
          <Link className="text-accent-text underline" to="/terms">
            términos de uso
          </Link>
          .
        </p>
        <Contact />
      </Section>
    </LegalPage>
  )
}

export function TermsEs() {
  usePageTitle('Términos de uso')
  return (
    <LegalPage
      title="Términos de uso"
      intro="Penduet es gratis para dibujar con personas que conoces. El software que lo hace funcionar no es gratis para copiar. Esto es lo que significa."
    >
      <Section title="Gratis, para divertirse">
        <p className="text-muted">
          Puedes usar Penduet gratis para uso personal y recreativo: dibujar con amigos y familia, practicar con las lecciones o ayudar a
          un niño a aprender. Esta primera versión es gratis. Usarlo con fines comerciales, como vender acceso, ejecutarlo dentro de un
          servicio de pago o recopilar su contenido en masa, no está cubierto. Pregunta antes.
        </p>
      </Section>

      <Section title="El software no es de código abierto">
        <p className="text-muted">
          El código que hace funcionar Penduet, sus lecciones y reglas de puntaje, su diseño, su nombre y su logotipo pertenecen a quienes
          los hicieron, y todos los derechos están reservados. Usar el servicio no te da una licencia para copiar, modificar, publicar,
          revender ni construir un servicio competidor a partir de nada de eso, ni para desarmar el servicio con ese fin, salvo donde la ley
          te dé ese derecho de todos modos. Si quieres hacer algo con él, pregunta.
        </p>
      </Section>

      <Section title="Tus dibujos">
        <p className="text-muted">
          Tus dibujos son tuyos. Al dibujar en una sala permites que el servicio muestre tus líneas a la otra persona y las conserve
          mientras exista la sala, y nada más. No usamos tus dibujos para nada más. Las salas son temporales: usa «Guardar como imagen»
          antes de salir si quieres conservar uno.
        </p>
      </Section>

      <Section title="Cómo comportarse">
        <ul className={list}>
          <li>Da el código de una sala solo a quienes quieras que entren, y dibuja solo lo que te parecería bien que vieran.</li>
          <li>No dibujes nada ilegal, ni nada pensado para acosar, amenazar o impresionar a otra persona.</li>
          <li>No uses bots ni scripts, no esquives los límites, ni intentes romper, sobrecargar o sondear el servicio.</li>
          <li>
            Podemos cerrar una sala, bloquear a un invitado o limitar el acceso si alguien rompe estas reglas o pone en riesgo el servicio.
            Todavía no hay botón de reporte; usa el contacto de abajo.
          </li>
        </ul>
      </Section>

      <Section title="Niñas y niños">
        <p className="text-muted">
          Los niños pueden usar Penduet con permiso de un adulto y con un adulto cerca. Si dejas que un niño lo use, eres responsable de
          cómo lo hace.
        </p>
      </Section>

      <Section title="Versión temprana, sin garantías">
        <p className="text-muted">
          Penduet es temprano. Se ofrece tal cual, sin promesas de que siempre estará disponible, libre de errores o que conservará tus
          dibujos. Las funciones pueden cambiar o dejar de existir. En la medida que la ley lo permita, no somos responsables de pérdidas
          o daños por usarlo; nada de lo que aquí se dice limita derechos que la ley no permite limitar.
        </p>
      </Section>

      <Section title="Anuncios y extras de pago, más adelante">
        <p className="text-muted">
          Podríamos añadir anuncios o un plan de pago opcional en una versión futura. Si lo hacemos, lo anunciaremos primero en el sitio y
          actualizaremos la{' '}
          <Link className="text-accent-text underline" to="/privacy">
            política de privacidad
          </Link>{' '}
          y estos términos antes de que empiece. Todo lo de pago mostrará su precio antes de que te comprometas y se podrá cancelar con un
          clic.
        </p>
      </Section>

      <Section title="Cambios y contacto">
        <p className="text-muted">
          Si cambiamos estos términos de forma importante, lo diremos en la página de inicio. Seguir usando Penduet después de un cambio
          significa que aceptas los términos nuevos; si no, deja de usarlo y borra tus datos en Ajustes.
        </p>
        <Contact />
      </Section>
    </LegalPage>
  )
}
