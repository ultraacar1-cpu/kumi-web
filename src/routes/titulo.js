const express = require('express');
const rateLimit = require('express-rate-limit');
const { RATE_WINDOW_MS, TITULO_RATE_MAX } = require('../config');
const { hayRiesgo } = require('../services/safety');
const { generarTitulo, TITULO_NEUTRO } = require('../services/titulos');

const router = express.Router();

const limitador = rateLimit({
    windowMs: RATE_WINDOW_MS,
    limit: TITULO_RATE_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: 'Demasiadas solicitudes.' })
});

// Devuelve un título corto que resume el primer mensaje de una conversación.
// Si falla, el navegador ya tiene un título provisional, así que un error aquí no afecta al chat.
router.post('/titulo', limitador, async (req, res) => {
    const mensaje = req.body && typeof req.body.message === 'string' ? req.body.message.trim().slice(0, 600) : '';
    if (!mensaje) return res.status(400).json({ error: 'Mensaje no válido.' });

    // Con señales de riesgo no se resume: se usa un título neutro (y ni siquiera se envía al modelo)
    if (hayRiesgo(mensaje)) return res.json({ titulo: TITULO_NEUTRO });

    try {
        return res.json({ titulo: await generarTitulo(mensaje) });
    } catch (error) {
        console.error('[titulo] fallo al generar el título:', error.message);   // nunca se registra el contenido
        return res.status(503).json({ error: 'No se pudo generar el título.' });
    }
});

module.exports = router;
