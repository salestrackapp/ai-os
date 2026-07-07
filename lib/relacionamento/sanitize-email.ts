import "server-only";
import sanitizeHtml from "sanitize-html";

/**
 * Sanitiza o HTML de um e-mail para exibição fiel e SEGURA (defesa em profundidade;
 * ainda vai dentro de um iframe sandbox sem scripts). Remove script/eventos/js:, mantém
 * formatação, imagens https e links (forçados a abrir em nova aba).
 */
export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "figure", "figcaption",
      "h1", "h2", "h3", "h4", "h5", "h6", "span", "u", "s", "sub", "sup", "hr", "center", "font",
    ]),
    allowedAttributes: {
      "*": ["style", "align", "valign", "width", "height", "bgcolor", "color", "dir", "colspan", "rowspan", "cellpadding", "cellspacing", "border"],
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "style"],
      font: ["color", "face", "size"],
    },
    // imagens só por http(s)/data (bloqueia cid:/javascript:), links só http(s)/mailto/tel
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowProtocolRelative: false,
    // CSS inline seguro (sem position/expression); dá para renderizar cores/tipografia/tabelas
    allowedStyles: {
      "*": {
        color: [/.*/], "background-color": [/.*/], "background": [/^(?!.*url\().*/i], "text-align": [/.*/],
        "font-size": [/.*/], "font-weight": [/.*/], "font-style": [/.*/], "font-family": [/.*/], "text-decoration": [/.*/],
        "line-height": [/.*/], "padding": [/.*/], "padding-top": [/.*/], "padding-bottom": [/.*/], "padding-left": [/.*/], "padding-right": [/.*/],
        "margin": [/.*/], "margin-top": [/.*/], "margin-bottom": [/.*/], "margin-left": [/.*/], "margin-right": [/.*/],
        "border": [/.*/], "border-top": [/.*/], "border-bottom": [/.*/], "border-color": [/.*/], "border-radius": [/.*/],
        "width": [/.*/], "max-width": [/.*/], "height": [/.*/], "display": [/^(?!.*none).*/i], "vertical-align": [/.*/],
      },
    },
    transformTags: {
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" } }),
    },
    // remove blocos perigosos por completo
    exclusiveFilter: (frame) => ["script", "style", "iframe", "object", "embed", "form", "link", "meta", "title", "base"].includes(frame.tag),
  });
}
