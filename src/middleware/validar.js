const { MAX_MENSAJES, MAX_CHARS_MENSAJE } = require('../config');

const ROLES_PERMITIDOS = new Set(['user', 'assistant']);

// Limpia lo que manda el navegador: nunca confiamos en él.
// - Solo roles "user" y "assistant" (así nadie puede inyectar un "system")
// - Solo texto, con longitud máxima
// - Solo los últimos N mensajes
// Devuelve null si el resultado no es válido.
function limpiarMensajes(messages) {
    if (!Array.isArray(messages)) return null;

    const limpios = messages
        .slice(-MAX_MENSAJES)
        .filter(m => m && ROLES_PERMITIDOS.has(m.role) && typeof m.content === 'string')
        .map(m => ({ role: m.role, content: m.content.trim().slice(0, MAX_CHARS_MENSAJE) }))
        .filter(m => m.content.length > 0);

    if (limpios.length === 0) return null;
    if (limpios[limpios.length - 1].role !== 'user') return null;
    return limpios;
}

module.exports = { limpiarMensajes };
