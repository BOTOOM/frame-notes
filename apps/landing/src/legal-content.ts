import type { Locale } from "./content";

export type LegalPageKind = "privacy" | "terms";

export interface LegalSection {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

export interface LegalCopy {
  title: string;
  intro: string;
  contactLabel: string;
  ownerLabel: string;
  effectiveDateLabel: string;
  sections: LegalSection[];
}

export const legalContent: Record<Locale, Record<LegalPageKind, LegalCopy>> = {
  es: {
    privacy: {
      title: "Política de privacidad",
      intro:
        "Esta política describe qué ocurre con los datos cuando usas la extensión Frame Notes y este sitio.",
      contactLabel: "Contacto",
      ownerLabel: "Responsable",
      effectiveDateLabel: "Fecha de entrada en vigor",
      sections: [
        {
          title: "La extensión no recopila datos",
          paragraphs: [
            "La extensión Frame Notes no tiene cuentas, servidor propio, analítica, telemetría, anuncios ni seguimiento. Los desarrolladores no reciben datos de la extensión.",
          ],
        },
        {
          title: "Almacenamiento local",
          paragraphs: [
            "El texto de las notas, sus tiempos de inicio y fin y sus números de cuadro, la posición del panel y las preferencias se guardan únicamente en el almacenamiento de la extensión del navegador (storage.local), en el dispositivo del usuario.",
            "En el HyperFrames Studio local (localhost), la extensión escribe review-notes.json y review-notes.md en la raíz del proyecto para que las herramientas o agentes locales puedan leerlos. Estos archivos permanecen en el equipo del usuario, quien decide conservarlos, incluirlos en un commit o eliminarlos.",
            "«Copiar todo» pone el texto de las notas en el portapapeles únicamente cuando el usuario pulsa el botón.",
          ],
        },
        {
          title: "Dónde funciona y qué permisos usa",
          paragraphs: ["La extensión solo se ejecuta en http://localhost/* y http://127.0.0.1/*."],
          items: [
            "storage: guarda notas, posición del panel y preferencias en el almacenamiento local del navegador.",
            "activeTab: permite acceder a la pestaña activa de Studio cuando el usuario invoca la extensión.",
            "offscreen (solo Chrome): permite ejecutar el reconocimiento de voz local en un documento fuera de pantalla.",
            "Acceso a localhost: conecta con la vista previa local de Studio para sincronizar los archivos del proyecto.",
          ],
        },
        {
          title: "Dictado opcional",
          paragraphs: [
            "El dictado es opcional. El micrófono se solicita solo cuando el usuario inicia el dictado. Frame Notes procesa el audio en el dispositivo y no lo almacena ni lo envía a ningún sitio.",
            "El reconocimiento en dispositivo de Chrome puede requerir que Chrome descargue un paquete de idioma de Google. Esa descarga se rige por las políticas de Google.",
            "Tras aceptar expresamente, la alternativa Whisper descarga una vez el modelo onnx-community/whisper-base desde Hugging Face (huggingface.co); el navegador lo guarda en su caché local. Esa descarga es una solicitud a Hugging Face y se rige por sus políticas.",
          ],
        },
        {
          title: "Firefox",
          paragraphs: [
            "El manifiesto de Firefox declara que no se recopilan datos (data_collection_permissions: none).",
          ],
        },
        {
          title: "Este sitio y los servicios externos",
          paragraphs: [
            "Este sitio no usa cookies ni analítica. Vercel aloja el sitio y, como proveedor de alojamiento, puede procesar registros estándar de solicitudes.",
            "Descargar la extensión desde GitHub o desde una tienda está sujeto a las políticas de esas plataformas.",
          ],
        },
        {
          title: "Al desinstalar",
          paragraphs: [
            "Al desinstalar la extensión se elimina el almacenamiento de la extensión. Los archivos del proyecto que haya escrito Frame Notes permanecen hasta que el usuario los elimine.",
          ],
        },
        {
          title: "Cambios y contacto",
          paragraphs: [
            "Los cambios de esta política se publican en esta página con una fecha actualizada. Para consultas, escribe al correo de contacto indicado o abre una incidencia en GitHub Issues.",
          ],
        },
      ],
    },
    terms: {
      title: "Términos y condiciones",
      intro: "Estos términos se aplican al uso de Frame Notes y de este sitio.",
      contactLabel: "Contacto",
      ownerLabel: "Responsable",
      effectiveDateLabel: "Fecha de entrada en vigor",
      sections: [
        {
          title: "Licencia de código abierto",
          paragraphs: [
            "Frame Notes se distribuye bajo la Licencia Apache 2.0. La licencia completa está disponible en el archivo LICENSE del repositorio.",
          ],
        },
        {
          title: "Uso bajo tu responsabilidad",
          paragraphs: [
            "El software se proporciona «tal cual», sin garantías de ningún tipo. Eres responsable de tus proyectos, de tus copias de seguridad y del contenido de las notas que escribas.",
            "En la medida permitida por la ley, los desarrolladores no son responsables de la pérdida de datos ni de cambios o incompatibilidades en HyperFrames.",
          ],
        },
        {
          title: "Servicios de terceros",
          paragraphs: [
            "HyperFrames, Google, Hugging Face y las tiendas de extensiones son servicios de terceros y se rigen por sus propios términos y políticas.",
          ],
        },
        {
          title: "Marcas",
          paragraphs: [
            "Frame Notes es un proyecto independiente y no está afiliado ni cuenta con el respaldo de HeyGen o HyperFrames. HyperFrames es una marca registrada de su propietario.",
          ],
        },
        {
          title: "Cambios y contacto",
          paragraphs: [
            "Los términos pueden cambiar; las versiones actualizadas se publicarán en esta página. Para consultas, escribe al correo de contacto indicado o abre una incidencia en GitHub Issues.",
          ],
        },
      ],
    },
  },
  en: {
    privacy: {
      title: "Privacy policy",
      intro:
        "This policy explains what happens to data when you use the Frame Notes extension and this website.",
      contactLabel: "Contact",
      ownerLabel: "Owner",
      effectiveDateLabel: "Effective date",
      sections: [
        {
          title: "The extension collects no data",
          paragraphs: [
            "The Frame Notes extension has no accounts, server, analytics, telemetry, ads, or tracking. The developers receive no data from the extension.",
          ],
        },
        {
          title: "Local storage",
          paragraphs: [
            "Note text, start and end times, frame numbers, panel position, and preferences are stored only in the browser's extension storage (storage.local) on the user's device.",
            "On the user's local HyperFrames Studio (localhost), the extension writes review-notes.json and review-notes.md into the project root so local tools or agents can read them. These files stay on the user's machine, and the user decides whether to keep, commit, or delete them.",
            "Copy all puts note text on the clipboard only when the user clicks the button.",
          ],
        },
        {
          title: "Where it runs and the permissions it uses",
          paragraphs: ["The extension runs only on http://localhost/* and http://127.0.0.1/*."],
          items: [
            "storage: keeps notes, panel position, and preferences in the browser's local extension storage.",
            "activeTab: lets the extension access the active Studio tab when the user invokes it.",
            "offscreen (Chrome only): lets local speech recognition run in an offscreen document.",
            "Localhost access: connects to the local Studio preview to sync project files.",
          ],
        },
        {
          title: "Optional dictation",
          paragraphs: [
            "Dictation is opt-in. The microphone is requested only when the user starts dictation. Frame Notes processes audio on the device and neither stores it nor sends it anywhere.",
            "Chrome on-device recognition may require Chrome to download a language pack from Google. That download is governed by Google's policies.",
            "After the user explicitly accepts, the Whisper fallback downloads the onnx-community/whisper-base model from Hugging Face (huggingface.co) once, and the browser caches it locally. That download is a request to Hugging Face and is governed by its policies.",
          ],
        },
        {
          title: "Firefox",
          paragraphs: [
            "The Firefox manifest declares no data collection (data_collection_permissions: none).",
          ],
        },
        {
          title: "This website and external services",
          paragraphs: [
            "This website uses no cookies or analytics. Vercel hosts the site and, as hosting provider, may process standard request logs.",
            "Downloading the extension from GitHub or a store is subject to those platforms' policies.",
          ],
        },
        {
          title: "Uninstalling",
          paragraphs: [
            "Uninstalling removes the extension storage. Project files written by Frame Notes remain until the user deletes them.",
          ],
        },
        {
          title: "Changes and contact",
          paragraphs: [
            "Changes to this policy are published on this page with an updated date. For questions, use the listed contact email or open a GitHub Issues ticket.",
          ],
        },
      ],
    },
    terms: {
      title: "Terms and conditions",
      intro: "These terms apply to your use of Frame Notes and this website.",
      contactLabel: "Contact",
      ownerLabel: "Owner",
      effectiveDateLabel: "Effective date",
      sections: [
        {
          title: "Open-source license",
          paragraphs: [
            "Frame Notes is distributed under the Apache License 2.0. The full license is available in the repository's LICENSE file.",
          ],
        },
        {
          title: "Use at your own responsibility",
          paragraphs: [
            "The software is provided “as is,” without warranties of any kind. You are responsible for your projects, backups, and the content of the notes you write.",
            "To the extent permitted by law, the developers are not liable for data loss or changes to, or incompatibilities with, HyperFrames.",
          ],
        },
        {
          title: "Third-party services",
          paragraphs: [
            "HyperFrames, Google, Hugging Face, and extension stores are third-party services governed by their own terms and policies.",
          ],
        },
        {
          title: "Trademarks",
          paragraphs: [
            "Frame Notes is an independent project, not affiliated with or endorsed by HeyGen or HyperFrames. HyperFrames is a trademark of its owner.",
          ],
        },
        {
          title: "Changes and contact",
          paragraphs: [
            "These terms may change; updated versions will be published on this page. For questions, use the listed contact email or open a GitHub Issues ticket.",
          ],
        },
      ],
    },
  },
};
