const svgNamespace = "http://www.w3.org/2000/svg";

const paths = [
  {
    d: "M6 48h52",
    attributes: {
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "5",
      "stroke-linecap": "round",
    },
  },
  {
    d: "M12 40v16M24 44v8M36 44v8M48 44v8",
    attributes: {
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "3",
      "stroke-linecap": "round",
      opacity: ".5",
    },
  },
  {
    d: "M30 48V8h22l-6 8 6 8H30",
    attributes: { fill: "var(--fn-accent)" },
  },
  {
    d: "M30 48V8",
    attributes: {
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "4",
      "stroke-linecap": "round",
    },
  },
] as const;

export function createBrandGlyphSvg(): SVGSVGElement {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  for (const definition of paths) {
    const path = document.createElementNS(svgNamespace, "path");
    path.setAttribute("d", definition.d);
    for (const [name, value] of Object.entries(definition.attributes)) {
      path.setAttribute(name, value);
    }
    svg.append(path);
  }

  return svg;
}
