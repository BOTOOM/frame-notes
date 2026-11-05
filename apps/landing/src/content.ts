export type Locale = "es" | "en";

export interface Feature {
  index: string;
  title: string;
  body: string;
}

export interface ScreenshotStep {
  number: string;
  title: string;
  body: string;
  image: string;
  alt: string;
}

export interface Shortcut {
  keys: string;
  action: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface LandingContent {
  nav: {
    audience: string;
    features: string;
    howToUse: string;
    privacy: string;
    download: string;
    languageLabel: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
    localNote: string;
    mediaCaption: string;
  };
  audience: {
    eyebrow: string;
    title: string;
    body: string;
    tag: string;
  };
  features: {
    eyebrow: string;
    title: string;
    items: Feature[];
  };
  copy: {
    eyebrow: string;
    title: string;
    body: string;
    caption: string;
  };
  shortcuts: {
    eyebrow: string;
    title: string;
    rows: Shortcut[];
    browserNote: string;
  };
  themes: {
    eyebrow: string;
    title: string;
    body: string;
    alt: string;
  };
  install: {
    eyebrow: string;
    title: string;
    chromeTitle: string;
    chromeSteps: string[];
    firefoxTitle: string;
    firefoxSteps: string[];
  };
  howToUse: {
    eyebrow: string;
    title: string;
    steps: ScreenshotStep[];
    agentNote: string;
  };
  privacySummary: {
    title: string;
    body: string;
    link: string;
  };
  faq: {
    eyebrow: string;
    title: string;
    items: FaqItem[];
  };
  disclaimer: string;
  footer: {
    privacy: string;
    terms: string;
    github: string;
  };
}

export const landingContent: Record<Locale, LandingContent> = {
  es: {
    nav: {
      audience: "Para quién",
      features: "Funciones",
      howToUse: "Cómo usar",
      privacy: "Privacidad",
      download: "Descargar",
      languageLabel: "Read in English",
    },
    hero: {
      eyebrow: "Notas de revisión para HyperFrames Studio",
      title: "Revisa cada cuadro, justo en la línea de tiempo.",
      description:
        "Marca un instante o un rango, anota lo que hay que cambiar y comparte contexto preciso con tu agente de IA. Frame Notes mantiene cada nota junto al proyecto local.",
      primaryCta: "Descargar extensión",
      secondaryCta: "Ver en GitHub",
      localNote: "Sin cuenta. Sin nube. En tu dispositivo.",
      mediaCaption: "Una nota de 0,2 s a las 12:00, visible en la línea de tiempo.",
    },
    audience: {
      eyebrow: "Para quién",
      title: "Para editores que revisan videos largos con un agente de IA.",
      body: "Cuando un cambio depende del cuadro exacto, un comentario como «arregla esto» no basta. Deja la marca en el tiempo de composición, añade una nota y permite que tu herramienta local lea el contexto.",
      tag: "HyperFrames Studio en el navegador · proyectos locales",
    },
    features: {
      eyebrow: "Hecho para revisar con precisión",
      title: "El contexto vive donde ocurre el cambio.",
      items: [
        {
          index: "01",
          title: "Rangos con milisegundos y cuadros",
          body: "Anota un instante o un segmento con sus tiempos y números de cuadro.",
        },
        {
          index: "02",
          title: "Marca 0,2 s dentro de 30 minutos",
          body: "Acerca la línea de tiempo y usa la tira de detalle para revisar rangos subsegundo.",
        },
        {
          index: "03",
          title: "Ajusta ±1 cuadro",
          body: "Mueve el inicio o el final de un rango con precisión de un solo cuadro.",
        },
        {
          index: "04",
          title: "Repite un rango",
          body: "Activa el bucle de la nota mientras compruebas una transición o un corte.",
        },
        {
          index: "05",
          title: "Copia todas las notas",
          body: "Copia tiempos y texto con un clic, listo para pegar en un agente.",
        },
        {
          index: "06",
          title: "Archivos en la raíz del proyecto",
          body: "review-notes.json y review-notes.md quedan en el proyecto local para que tus herramientas los lean.",
        },
        {
          index: "07",
          title: "Dictado opcional",
          body: "Usa el reconocimiento en dispositivo de Chrome o, tras aceptar, Whisper local.",
        },
        {
          index: "08",
          title: "Tema oscuro o papel",
          body: "El panel sigue el tema de Studio y también incluye una vista clara.",
        },
      ],
    },
    copy: {
      eyebrow: "Un clic para compartir el contexto",
      title: "Texto de notas que un agente puede leer.",
      body: "«Copiar todo» coloca el texto en el portapapeles únicamente cuando lo pulsas. Este es el formato producido por el formateador de la extensión:",
      caption: "Formato real de Frame Notes · 30 fps",
    },
    shortcuts: {
      eyebrow: "Atajos",
      title: "Anota sin apartarte de la revisión.",
      rows: [
        { keys: "Alt+N", action: "Nueva nota en el cabezal" },
        { keys: "Alt+I", action: "Fijar inicio del rango" },
        { keys: "Alt+O", action: "Fijar final del rango" },
        { keys: "Enter", action: "Guardar la nota" },
        { keys: "Mayús+Enter", action: "Salto de línea" },
        { keys: "Esc", action: "Cancelar edición" },
        { keys: "Alt+Mayús+C", action: "Copiar todas las notas" },
        { keys: "Alt+M", action: "Minimizar o expandir el panel" },
        { keys: "Alt+V", action: "Iniciar dictado" },
      ],
      browserNote:
        "Los comandos registrados en el navegador usan Alt+Mayús+N/I/O/C por defecto y se pueden reasignar en los ajustes de atajos de la extensión.",
    },
    themes: {
      eyebrow: "Se integra con Studio",
      title: "Claro como papel, oscuro como la sala de edición.",
      body: "El panel acompaña el tema oscuro o claro de HyperFrames Studio.",
      alt: "Panel de Frame Notes en el tema claro tipo papel de Studio",
    },
    install: {
      eyebrow: "Cómo instalar",
      title: "Descarga la extensión y cárgala en tu navegador.",
      chromeTitle: "Chrome, Edge o Brave",
      chromeSteps: [
        "Descarga el ZIP más reciente desde GitHub Releases y descomprímelo.",
        "Abre chrome://extensions y activa el modo de desarrollador.",
        "Elige «Load unpacked» y selecciona la carpeta descomprimida.",
      ],
      firefoxTitle: "Firefox",
      firefoxSteps: [
        "Descarga el archivo XPI desde GitHub Releases.",
        "Abre about:debugging#/runtime/this-firefox y elige «Load Temporary Add-on».",
        "Selecciona el XPI. Una compilación sin firma es temporal hasta que esté en AMO.",
      ],
    },
    howToUse: {
      eyebrow: "Cómo usar",
      title: "Del cabezal de reproducción a una revisión clara.",
      steps: [
        {
          number: "01",
          title: "Abre tu proyecto local",
          body: "Ejecuta npx hyperframes preview y abre el proyecto en HyperFrames Studio. Frame Notes funciona en la vista previa del navegador.",
          image: "/media/empty-state.png",
          alt: "Panel de Frame Notes en estado vacío junto a HyperFrames Studio",
        },
        {
          number: "02",
          title: "Marca inicio y final",
          body: "Pulsa Alt+N para crear una nota. Usa Alt+I y Alt+O en los cuadros que delimitan el rango y escribe el contexto.",
          image: "/media/editor-range.png",
          alt: "Editor de Frame Notes abierto con los controles de inicio y final del rango",
        },
        {
          number: "03",
          title: "Afina el instante",
          body: "Acerca la línea de tiempo para ver rangos breves en la tira de detalle; puedes ajustar cada borde por un cuadro.",
          image: "/media/detail-strip.png",
          alt: "Detalle de la línea de tiempo con una nota de 0,2 segundos",
        },
      ],
      agentNote:
        "Al terminar, pulsa «Copiar todo» o deja que tu agente local lea review-notes.md desde la raíz del proyecto.",
    },
    privacySummary: {
      title: "Tus notas siguen en tu máquina.",
      body: "Frame Notes no tiene cuentas, analítica ni telemetría. Las notas se guardan en el almacenamiento local de la extensión y se reflejan en los archivos del proyecto de Studio.",
      link: "Lee la política de privacidad",
    },
    faq: {
      eyebrow: "Preguntas frecuentes",
      title: "Compatibilidad y límites.",
      items: [
        {
          question: "¿Funciona con la aplicación de escritorio?",
          answer:
            "No. Frame Notes funciona con Studio abierto en el navegador desde una vista previa local de HyperFrames, no con la aplicación de escritorio.",
        },
        {
          question: "¿Qué pasa si cambia la API de archivos de Studio?",
          answer:
            "La API de archivos interna de Studio puede cambiar entre versiones. Copiar las notas sigue disponible.",
        },
        {
          question: "¿El dictado funciona en todos los navegadores?",
          answer:
            "La disponibilidad depende del navegador y de sus servicios de reconocimiento. El dictado es opcional y solo empieza cuando lo solicitas.",
        },
        {
          question: "¿Firefox está probado igual que Chrome?",
          answer: "No. El funcionamiento en Firefox está menos probado que en Chrome.",
        },
      ],
    },
    disclaimer:
      "Frame Notes es un proyecto independiente de código abierto, no está afiliado ni cuenta con el respaldo de HeyGen o HyperFrames. HyperFrames es una marca registrada de su propietario.",
    footer: {
      privacy: "Privacidad",
      terms: "Términos",
      github: "GitHub",
    },
  },
  en: {
    nav: {
      audience: "Who it's for",
      features: "Features",
      howToUse: "How to use",
      privacy: "Privacy",
      download: "Download",
      languageLabel: "Leer en español",
    },
    hero: {
      eyebrow: "Review notes for HyperFrames Studio",
      title: "Review every frame, right on the timeline.",
      description:
        "Mark a moment or range, write what needs to change, and give your AI agent frame-accurate context. Frame Notes keeps each note beside the local project.",
      primaryCta: "Download the extension",
      secondaryCta: "View on GitHub",
      localNote: "No account. No cloud. On your device.",
      mediaCaption: "A 0.2 s note at 12:00, visible on the timeline.",
    },
    audience: {
      eyebrow: "Who it's for",
      title: "For editors reviewing long videos with an AI agent.",
      body: "When a change depends on an exact frame, “fix this” is not enough. Leave a marker at composition time, add a note, and let your local tools read the context.",
      tag: "HyperFrames Studio in the browser · local projects",
    },
    features: {
      eyebrow: "Built for precise review",
      title: "Context lives where the change happens.",
      items: [
        {
          index: "01",
          title: "Ranges in milliseconds and frames",
          body: "Annotate a moment or segment with its timecodes and frame numbers.",
        },
        {
          index: "02",
          title: "Mark 0.2 s inside a 30-minute video",
          body: "Zoom the timeline and use the detail strip to review sub-second ranges.",
        },
        {
          index: "03",
          title: "Nudge by ±1 frame",
          body: "Move a range's start or end with single-frame precision.",
        },
        {
          index: "04",
          title: "Loop a range",
          body: "Loop the note while you check a transition or a cut.",
        },
        {
          index: "05",
          title: "Copy every note",
          body: "Copy timecodes and text with one click, ready to paste into an agent.",
        },
        {
          index: "06",
          title: "Files in the project root",
          body: "review-notes.json and review-notes.md stay in the local project for your tools to read.",
        },
        {
          index: "07",
          title: "Optional dictation",
          body: "Use Chrome on-device recognition or, after consent, local Whisper.",
        },
        {
          index: "08",
          title: "Dark or paper theme",
          body: "The panel follows Studio's theme and includes a light view.",
        },
      ],
    },
    copy: {
      eyebrow: "One click to share context",
      title: "Notes an agent can read.",
      body: "Copy all writes the text to your clipboard only when you click it. This is the format produced by the extension's formatter:",
      caption: "Actual Frame Notes format · 30 fps",
    },
    shortcuts: {
      eyebrow: "Shortcuts",
      title: "Take notes without leaving the review.",
      rows: [
        { keys: "Alt+N", action: "New note at the playhead" },
        { keys: "Alt+I", action: "Set range start" },
        { keys: "Alt+O", action: "Set range end" },
        { keys: "Enter", action: "Save the note" },
        { keys: "Shift+Enter", action: "Insert a newline" },
        { keys: "Esc", action: "Cancel editing" },
        { keys: "Alt+Shift+C", action: "Copy all notes" },
        { keys: "Alt+M", action: "Minimize or expand the panel" },
        { keys: "Alt+V", action: "Start dictation" },
      ],
      browserNote:
        "Registered browser commands default to Alt+Shift+N/I/O/C and can be remapped in the extension's shortcut settings.",
    },
    themes: {
      eyebrow: "Fits right into Studio",
      title: "Paper-light or edit-suite dark.",
      body: "The panel follows HyperFrames Studio's dark or light theme.",
      alt: "Frame Notes panel in Studio's light paper theme",
    },
    install: {
      eyebrow: "How to install",
      title: "Download the extension and load it in your browser.",
      chromeTitle: "Chrome, Edge, or Brave",
      chromeSteps: [
        "Download the latest ZIP from GitHub Releases and unzip it.",
        "Open chrome://extensions and enable Developer mode.",
        "Choose “Load unpacked” and select the unzipped folder.",
      ],
      firefoxTitle: "Firefox",
      firefoxSteps: [
        "Download the XPI from GitHub Releases.",
        "Open about:debugging#/runtime/this-firefox and choose “Load Temporary Add-on”.",
        "Select the XPI. An unsigned build is temporary until an AMO listing is available.",
      ],
    },
    howToUse: {
      eyebrow: "How to use",
      title: "From playhead to a clear review note.",
      steps: [
        {
          number: "01",
          title: "Open your local project",
          body: "Run npx hyperframes preview and open the project in HyperFrames Studio. Frame Notes works in the local browser preview.",
          image: "/media/empty-state.png",
          alt: "Frame Notes empty state beside HyperFrames Studio",
        },
        {
          number: "02",
          title: "Mark the start and end",
          body: "Press Alt+N to start a note. Use Alt+I and Alt+O on the frames that bound the range, then write the context.",
          image: "/media/editor-range.png",
          alt: "Frame Notes editor open with range start and end controls",
        },
        {
          number: "03",
          title: "Fine-tune the moment",
          body: "Zoom the timeline to see short ranges in the detail strip; adjust either edge by a single frame.",
          image: "/media/detail-strip.png",
          alt: "Timeline detail view with a 0.2-second note",
        },
      ],
      agentNote:
        "When you're done, click Copy all or let your local agent read review-notes.md from the project root.",
    },
    privacySummary: {
      title: "Your notes stay on your machine.",
      body: "Frame Notes has no accounts, analytics, or telemetry. Notes are saved in the extension's local storage and mirrored to Studio project files.",
      link: "Read the privacy policy",
    },
    faq: {
      eyebrow: "Frequently asked",
      title: "Compatibility and limits.",
      items: [
        {
          question: "Does it work with the desktop app?",
          answer:
            "No. Frame Notes works with Studio in the browser from a local HyperFrames preview, not the desktop app.",
        },
        {
          question: "What if Studio's file API changes?",
          answer:
            "Studio's internal file API may change between versions. Copying notes remains available.",
        },
        {
          question: "Does dictation work in every browser?",
          answer:
            "Availability depends on the browser and its recognition services. Dictation is optional and starts only when you request it.",
        },
        {
          question: "Is Firefox tested as much as Chrome?",
          answer: "No. Firefox runtime behavior is less tested than Chrome.",
        },
      ],
    },
    disclaimer:
      "Frame Notes is an independent open-source project, not affiliated with or endorsed by HeyGen or HyperFrames. HyperFrames is a trademark of its owner.",
    footer: {
      privacy: "Privacy",
      terms: "Terms",
      github: "GitHub",
    },
  },
};

export const copyExample: Record<Locale, string> = {
  es: `Notas de revisión — long-demo (3 notas, 30 fps)
1) 12:00.000 → 12:00.200 (f21600–f21606, 0.200 s): Revisar el ritmo del título.
2) 12:14.433 → 12:22.833 (f22033–f22285, 8.400 s): Revisar el corte después del movimiento de cámara.
3) 12:31.000 (f22530): Usar este cuadro como referencia.`,
  en: `Review notes — long-demo (3 notes, 30 fps)
1) 12:00.000 → 12:00.200 (f21600–f21606, 0.200 s): Check the title timing.
2) 12:14.433 → 12:22.833 (f22033–f22285, 8.400 s): Review the cut after the camera move.
3) 12:31.000 (f22530): Use this frame as the reference.`,
};
