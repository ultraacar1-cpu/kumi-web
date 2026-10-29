const { generarRespuesta } = require('./llm');
const { TITULO_MAX_TOKENS, TITULO_TIMEOUT_MS } = require('../config');

const MAX_CHARS_TITULO = 60;

// Título neutro para cuando el primer mensaje trae señales de riesgo: así nadie que vea la pantalla
// (un dispositivo compartido, alguien al lado) lee en la lista de chats algo muy íntimo.
const TITULO_NEUTRO = 'Un momento difícil';

const PROMPT_TITULO = `Creas títulos muy breves para conversaciones de una app de apoyo emocional.
Lee el primer mensaje de la persona y responde SOLO con un título en español de 3 a 7 palabras que resuma de qué trata o qué pide.
Reglas: sin comillas, sin punto final, sin emojis, sin explicaciones y sin prefijos como "Título:".
No incluyas nombres propios ni datos personales. Usa un tono neutral y discreto.
Ejemplo: "Me siento muy ansioso por mi examen final de mañana" -> Ansiedad por un examen`;

// Deja el texto del modelo como un título limpio. Devuelve '' si no hay nada aprovechable.
function limpiarTitulo(crudo) {
    if (typeof crudo !== 'string') return '';

    let t = crudo.split('\n').map(l => l.trim()).find(l => l.length > 0) || '';
    t = t.replace(/^(t[ií]tulo|title)\s*[:\-–]\s*/i, '');          // "Título: ..."
    t = t.replace(/^[\s"'“”«»`*#_\-–—•¡¿]+/, '');                       // comillas, viñetas, markdown al inicio
    t = t.replace(/[\s"'“”«»`*#_.,;:!?¡¿…\-–—]+$/, '');              // comillas y puntuación al final
    t = t.replace(/\s+/g, ' ').trim();
    if (!t) return '';

    if (t.length > MAX_CHARS_TITULO) {
        const corte = t.slice(0, MAX_CHARS_TITULO);
        const ultimoEspacio = corte.lastIndexOf(' ');
        t = (ultimoEspacio > 20 ? corte.slice(0, ultimoEspacio) : corte).trim();
    }
    return t.charAt(0).toUpperCase() + t.slice(1);
}

async function generarTitulo(mensaje) {
    const crudo = await generarRespuesta(
        [{ role: 'system', content: PROMPT_TITULO }, { role: 'user', content: mensaje }],
        { maxTokens: TITULO_MAX_TOKENS, temperature: 0.3, timeoutMs: TITULO_TIMEOUT_MS }
    );
    const titulo = limpiarTitulo(crudo);
    if (!titulo) throw new Error('El modelo no devolvió un título utilizable');
    return titulo;
}

module.exports = { generarTitulo, limpiarTitulo, TITULO_NEUTRO, MAX_CHARS_TITULO };
