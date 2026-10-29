const { GROQ_API_KEY, GROQ_MODEL, GROQ_URL, TIMEOUT_MS, MAX_TOKENS, TEMPERATURE } = require('../config');

// Único lugar que habla con el proveedor de IA. Si algún día cambias de proveedor, solo tocas este archivo.
// opciones (todas opcionales): { maxTokens, temperature, timeoutMs }
async function generarRespuesta(messages, opciones = {}) {
    if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY no configurada');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opciones.timeoutMs || TIMEOUT_MS);

    try {
        const response = await fetch(GROQ_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            signal: controller.signal,
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages,
                temperature: opciones.temperature !== undefined ? opciones.temperature : TEMPERATURE,
                max_completion_tokens: opciones.maxTokens || MAX_TOKENS
            })
        });

        if (!response.ok) throw new Error(`El proveedor respondió con estado ${response.status}`);

        const data = await response.json();
        const texto = data && data.choices && data.choices[0] && data.choices[0].message
            ? data.choices[0].message.content
            : null;

        if (typeof texto !== 'string' || !texto.trim()) throw new Error('Respuesta vacía del modelo');
        return texto.trim();
    } finally {
        clearTimeout(timer);
    }
}

module.exports = { generarRespuesta };
