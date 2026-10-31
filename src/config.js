module.exports = {
    PORT: process.env.PORT || 10000,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    GROQ_URL: 'https://api.groq.com/openai/v1/chat/completions',
    TIMEOUT_MS: 30000,
    // gpt-oss es un modelo de razonamiento: este tope incluye los "tokens de pensamiento",
    // por eso es alto. La brevedad de las respuestas se controla desde el prompt.
    MAX_TOKENS: 2000,
    TEMPERATURE: 0.6,
    // Límites de entrada
    MAX_MENSAJES: 20,
    MAX_CHARS_MENSAJE: 2000,
    // Rate limit por IP
    RATE_WINDOW_MS: 60 * 1000,
    RATE_MAX: 20,
    // Títulos automáticos de las conversaciones
    TITULO_MAX_TOKENS: 800,      // alto a propósito: el modelo "piensa" antes de responder y eso también cuenta
    TITULO_TIMEOUT_MS: 12000,
    TITULO_RATE_MAX: 10,         // por minuto y por IP
    // Llamadas de voz: respuestas cortas y rápidas
    LLAMADA_MAX_TOKENS: 900,     // incluye los "tokens de pensamiento" del modelo
    LLAMADA_TEMPERATURE: 0.7,
    LLAMADA_REASONING: 'low'     // gpt-oss admite 'low' | 'medium' | 'high': 'low' responde bastante más rápido
};
