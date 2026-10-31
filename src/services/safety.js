// Capa de seguridad INDEPENDIENTE del modelo.
// Si el texto del usuario trae señales de riesgo, el servidor:
//   1) le da al modelo instrucciones extra para responder con cuidado, y
//   2) agrega SIEMPRE el bloque de ayuda al final (el modelo no puede "olvidarlo").
// Si el modelo falla, se devuelve una respuesta fija con los recursos.
//
// IMPORTANTE: una lista de patrones es una primera red, no una garantía. Amplíala con casos reales
// (anonimizados) y, más adelante, suma un clasificador con el propio modelo.

const normalizar = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Los patrones se escriben SIN tildes porque el texto se normaliza antes de compararlo.
const PATRONES_RIESGO = [
    // Ideación suicida directa
    /\bsuicid/,
    /\b(quiero|quisiera|queria|voy a|pienso en|pensando en|ganas de)\s+(morir|morirme|matarme|quitarme la vida|acabar con (todo|mi vida)|terminar con (todo|mi vida))/,
    /\bme (quiero|quisiera|queria|voy a) (morir|matar)\b/,
    /\bno quiero (seguir |continuar )?(viviendo|vivir|estar aqui|despertar)/,
    /\b(quitarme|acabar con|terminar con) (la|mi) vida\b/,
    /\bdejar de existir\b/,
    /\bdesaparecer (del mundo|para siempre)\b/,
    /\bojala (me muriera|me muera|no despertar|no despertara)/,
    /\b(todos|todo el mundo|mi familia) (estaria|estarian) mejor sin mi\b/,
    /\bpastillas para (morir|matarme|no despertar)/,
    // Autolesión
    /\b(hacerme dano|lastimarme|autolesion|autolesionarme|herirme)/,
    /\bcortarme (las venas|los brazos|las munecas|las piernas|la piel)/,
    /\bme (he cortado|estoy cortando) (los brazos|las venas|las munecas|las piernas)/,
    // Daño a otros
    /\bquiero (matar|lastimar|hacerle dano) a\b/
];

function hayRiesgo(texto) {
    if (typeof texto !== 'string') return false;
    const t = normalizar(texto);
    return PATRONES_RIESGO.some(p => p.test(t));
}

// Devuelve 'actual' (el último mensaje trae señales), 'reciente' (en los 2 mensajes previos) o null.
function evaluarRiesgo(mensajes) {
    const deUsuario = mensajes.filter(m => m.role === 'user');
    if (deUsuario.length === 0) return null;

    if (hayRiesgo(deUsuario[deUsuario.length - 1].content)) return 'actual';
    if (deUsuario.slice(-3, -1).some(m => hayRiesgo(m.content))) return 'reciente';
    return null;
}

const NOTA_RIESGO_ACTUAL = `
ALERTA DE SEGURIDAD (instrucción del sistema, no la menciones): el usuario acaba de expresar señales de posible riesgo (suicidio, autolesión o daño a otros). En esta respuesta:
1. Valida su dolor con calidez, sin minimizarlo ni sermonear.
2. Pregunta de forma directa y sin juicio si está pensando en quitarse la vida o hacerse daño, y si está seguro/a en este momento.
3. No des métodos, medios ni detalles sobre cómo hacerse daño.
4. Invítale a no quedarse solo/a y a avisar a alguien de confianza que esté cerca.
5. No uses una técnica de respiración como respuesta principal.
6. No escribas números de teléfono: el sistema los agrega al final automáticamente.`;

const NOTA_RIESGO_RECIENTE = `
CONTEXTO DE SEGURIDAD (instrucción del sistema, no la menciones): hace poco el usuario expresó señales de posible riesgo. Mantén un tono atento y, si hay oportunidad natural, vuelve a preguntarle cómo está de seguridad en este momento.`;

const BLOQUE_AYUDA =
`**Si estás en peligro o piensas hacerte daño ahora mismo, llama al 123** (emergencias).
**Si necesitas hablar con alguien ahora, llama a la Línea 106** (gratuita, 24 horas).
Si puedes, avisa a una persona de confianza que esté cerca para no pasar esto solo/a.`;

const RESPUESTA_RIESGO_FIJA =
`Lo que me cuentas es muy importante y me preocupa cómo estás. Ahora mismo tuve un problema técnico y no puedo acompañarte como quisiera, pero no quiero que te quedes sin apoyo.

${BLOQUE_AYUDA}`;

// Versión para la llamada: texto plano y breve, pensado para leerse en voz alta
const BLOQUE_AYUDA_VOZ =
`Si estás en peligro o piensas hacerte daño ahora mismo, llama al 123. Si necesitas hablar con alguien, la Línea 106 es gratuita y atiende las 24 horas.`;

const RESPUESTA_RIESGO_FIJA_VOZ =
`Lo que me cuentas es muy importante y me preocupa cómo estás. Ahora tuve un problema técnico, pero no quiero que te quedes sin apoyo. ${BLOQUE_AYUDA_VOZ}`;

module.exports = {
    hayRiesgo,
    evaluarRiesgo,
    NOTA_RIESGO_ACTUAL,
    NOTA_RIESGO_RECIENTE,
    BLOQUE_AYUDA,
    RESPUESTA_RIESGO_FIJA,
    BLOQUE_AYUDA_VOZ,
    RESPUESTA_RIESGO_FIJA_VOZ
};
