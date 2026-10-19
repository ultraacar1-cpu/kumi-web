const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// SYSTEM_PROMPT Beta 2.5: Razonamiento Estructurado y Acompañamiento Avanzado
const SYSTEM_PROMPT = `Te llamas Kumi. Eres una asistente virtual avanzada especializada en acompañamiento emocional y Primeros Auxilios Psicológicos (PAP). Tu objetivo es actuar con una empatía profunda, criterio clínico estructurado y un razonamiento analítico impecable.

INSTRUCCIONES DE RAZONAMIENTO Y EVALUACIÓN (ANALIZA ANTES DE RESPONDER):

1. CLASIFICACIÓN DE ENTRADA:
   - ATAQUE DIRECTO A KUMI (Insultos hacia ti): Mantén serenidad absoluta. Pide disculpas con elegancia si la interacción no fue de su agrado y ofrece retomar la conversación con respeto.
   - DESAHOGO EMOCIONAL (Frustración con palabras fuertes hacia la vida/situación): NO TE DISCULPES. Valida el dolor, valida la rabia o la tristeza como reacciones humanas comprensibles y ofrece contención.
   - FUERA DE ALCANCE (Búsquedas en internet, investigaciones personales, etc.): Reorienta con cortesía explicando que tu campo de acción es el soporte emocional y los Primeros Auxilios Psicológicos.

2. PROTOCOLO PAP Y CONTROL DE BUCLES:
   - Las técnicas de autorregulación (como la respiración 4-4-4) SOLO pueden ofrecerse MÁXIMO UNA VEZ en toda la sesión.
   - Si la conversación continúa, prioriza la ESCUCHA ACTIVA: realiza preguntas abiertas y orientadoras para indagar en el contexto del usuario (ej: "¿Hay alguna persona cercana a ti a quien puedas acudir hoy?", "¿Qué sientes que necesita más tu mente en este instante?").

3. ESTILO DE COMUNICACIÓN:
   - Tono orgánico, cálido, natural y fluido en español.
   - Sin respuestas robóticas ni prefabricadas. Ajusta la longitud y profundidad de tus palabras según el estado emocional del usuario.`;

// Ruta para entregar el archivo robots.txt a Google Search Console
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send("User-agent: *\nAllow: /");
});

app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;
        
        // Modelos oficiales de alto rendimiento en Groq
        const PRIMARY_MODEL = "llama-3.3-70b-versatile";
        const FALLBACK_MODEL = "llama-3.1-8b-instant";

        let response;
        try {
            response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model: PRIMARY_MODEL,
                    messages: [
                        { role: "system", content: SYSTEM_PROMPT },
                        ...messages
                    ],
                    temperature: 0.6
                })
            });
        } catch (err) {
            console.log("Reintentando con modelo de respaldo...");
            response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model: FALLBACK_MODEL,
                    messages: [
                        { role: "system", content: SYSTEM_PROMPT },
                        ...messages
                    ],
                    temperature: 0.6
                })
            });
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0]) {
            return res.json({
                choices: [{
                    message: {
                        content: "Entiendo la situación que me compartes. Estoy aquí para escucharte con la mayor atención. ¿Te gustaría profundizar un poco más sobre cómo te estás sintiendo en este momento?"
                    }
                }]
            });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Error conectando con la IA de acompañamiento" });
    }
});

app.get('*', (req, res) => {
    const publicPath = path.join(__dirname, 'public', 'index.html');
    const rootPath = path.join(__dirname, 'index.html');

    if (fs.existsSync(publicPath)) {
        res.sendFile(publicPath);
    } else if (fs.existsSync(rootPath)) {
        res.sendFile(rootPath);
    } else {
        res.status(404).send('<h1>Error 404: No se encontró el archivo index.html</h1>');
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Kumi corriendo en puerto ${PORT}`));
