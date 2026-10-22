# Kumi Web

IA de apoyo emocional (texto). Node >= 18.

## Desarrollo local
```
npm install
GROQ_API_KEY=tu_clave npm start      # o usa tu propio .env (ver .env.example)
npm test                             # pruebas de seguridad y validación
```

## Variables de entorno
- `GROQ_API_KEY` (obligatoria)
- `GROQ_MODEL` (opcional, por defecto `openai/gpt-oss-20b`)
- `PORT` (opcional)

## Estructura
- `server.js` arranca la app
- `src/app.js` Express + seguridad (helmet, límites)
- `src/routes/chat.js` endpoint `/api/chat`
- `src/services/safety.js` detección de riesgo (independiente del modelo)
- `src/services/llm.js` único punto de contacto con el proveedor de IA
- `src/prompts/kumi.js` prompt del sistema
- `public/` frontend (index.html, css/, js/, privacidad.html, robots.txt)
