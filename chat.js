const express = require('express');
const rateLimit = require('express-rate-limit');
const { RATE_WINDOW_MS, RATE_MAX } = require('../config');
const { limpiarMensajes } = require('../middleware/validar');
const { generarRespuesta } = require('../services/llm');
const {
    evaluarRiesgo,
    NOTA_RIESGO_ACTUAL,
    NOTA_RIESGO_RECIENTE,
    BLOQUE_AYUDA,
    RESPUESTA_RIESGO_FIJA
} = require('../services/safety');
const { SYSTEM_PROMPT } = require('../prompts/kumi');

const router = express.Router();

const limitador = rateLimit({
    windowMs: RATE_WINDOW_MS,
    limit: RATE_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) =>
        res.status(429).json({ error: 'Estás enviando mensajes muy rápido. Espera un momento y vuelve a intentarlo.' })
});

router.post('/chat', limitador, async (req, res) => {
    const mensajes = limpiarMensajes(req.body && req.body.messages);
    if (!mensajes) {
        return res.status(400).json({ error: 'No pude leer tu mensaje. Intenta escribirlo de nuevo.' });
    }

    const riesgo = evaluarRiesgo(mensajes); // 'actual' | 'reciente' | null

    let sistema = SYSTEM_PROMPT;
    if (riesgo === 'actual') sistema += '\n' + NOTA_RIESGO_ACTUAL;
    else if (riesgo === 'reciente') sistema += '\n' + NOTA_RIESGO_RECIENTE;

    try {
        let respuesta = await generarRespuesta([{ role: 'system', content: sistema }, ...mensajes]);

        // El bloque de ayuda lo agrega el código, no el modelo: así nunca depende de que la IA "se acuerde".
        if (riesgo === 'actual') respuesta += '\n\n' + BLOQUE_AYUDA;

        return res.json({ reply: respuesta, riesgo: riesgo !== null });
    } catch (error) {
        // Solo registramos el motivo técnico, NUNCA el contenido de la conversación.
        console.error('[chat] fallo al generar respuesta:', error.message);

        if (riesgo === 'actual') {
            return res.json({ reply: RESPUESTA_RIESGO_FIJA, riesgo: true });
        }
        return res.status(503).json({ error: 'Tuve un problema técnico y no pude responderte.' });
    }
});

module.exports = router;
