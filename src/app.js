const express = require('express');
const helmet = require('helmet');
const path = require('path');
const chatRouter = require('./routes/chat');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function crearApp() {
    const app = express();

    // Render (y la mayoría de hosts) está detrás de un proxy: sin esto el rate limit vería una sola IP para todos.
    app.set('trust proxy', 1);

    app.use(helmet({
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                scriptSrcAttr: ["'unsafe-inline'"], // la página usa onclick="..." en el HTML
                styleSrc: ["'self'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
                styleSrcAttr: ["'unsafe-inline'"],
                fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'data:'],
                imgSrc: ["'self'", 'data:'],
                connectSrc: ["'self'"],
                upgradeInsecureRequests: null
            }
        }
    }));

    app.use(express.json({ limit: '50kb' }));

    // Solo se sirve la carpeta public/. NUNCA la raíz del proyecto.
    app.use(express.static(PUBLIC_DIR));

    app.use('/api', chatRouter);
    app.use('/api', (req, res) => res.status(404).json({ error: 'No encontrado' }));

    // Página principal para cualquier otra ruta; los archivos que no existen devuelven 404 real.
    app.get('*', (req, res) => {
        if (path.extname(req.path)) return res.status(404).send('No encontrado');
        res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
    });

    // Errores de lectura del body (JSON malformado o demasiado grande)
    app.use((err, req, res, next) => {
        if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'Tu mensaje es demasiado largo.' });
        if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Solicitud no válida.' });
        console.error('[app] error inesperado:', err && err.message);
        res.status(500).json({ error: 'Error interno.' });
    });

    return app;
}

module.exports = crearApp;
