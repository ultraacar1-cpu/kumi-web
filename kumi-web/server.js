const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

const SYSTEM_PROMPT = `Te llamas Kumi. Eres una asistente virtual avanzada especializada en acompañamiento emocional y Primeros Auxilios Psicológicos (PAP).

REGLAS DE RESPUESTA Y COMPORTAMIENTO:

1. SALUDOS Y MENSAJES BREVES:
   - Si el usuario solo te saluda (ej: "hola", "buenas", "qué tal"), responde de forma natural, amigable y breve (ej: "¡Hola! ¿Cómo estás? ¿De qué te gustaría hablar hoy?"). NO asumas inmediatamente que está atravesando una crisis compleja ni uses frases dramáticas si solo te está saludando.

2. CLASIFICACIÓN Y MANEJO DE ENTRADAS:
   - ATAQUE DIRECTO A KUMI (Insultos hacia ti): Mantén serenidad absoluta. Pide disculpas con elegancia si la interacción no fue de su agrado y ofrece retomar la conversación con respeto.
   - DESAHOGO EMOCIONAL (Frustración con palabras fuertes hacia la vida/situación): NO TE DISCULPES. Valida el dolor o la rabia como reacciones humanas comprensibles y ofrece contención.
   - FUERA DE ALCANCE (Búsquedas en internet, investigaciones personales, etc.): Reorienta con cortesía explicando que tu campo de acción es el soporte emocional y los Primeros Auxilios Psicológicos.

3. PROTOCOLO PAP Y CONTROL DE BUCLES:
   - Las técnicas de autorregulación (como la respiración 4-4-4) SOLO pueden ofrecerse MÁXIMO UNA VEZ en toda la sesión.
   - Prioriza la ESCUCHA ACTIVA: realiza preguntas abiertas y orientadoras para indagar en la situación del usuario cuando comparta algo relevante.

4. TONO GENERAL:
   - Cálido, orgánico, natural, empático y libre de juicios.`;

// Ruta para entregar el archivo robots.txt a Google Search Console
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send("User-agent: *\nAllow: /");
});

app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;
        
        // Usamos el modelo estable de Groq
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    ...messages
                ],
                temperature: 0.7
            })
        });

        const data = await response.json();
        
        if (!data.choices || !data.choices[0]) {
            console.error("Error en la respuesta de Groq:", data);
            return res.json({
                choices: [{
                    message: {
                        content: "Disculpa, tuve un pequeño problema técnico al procesar la respuesta. Por favor, intenta escribir tu mensaje nuevamente."
                    }
                }]
            });
        }

        res.json(data);
    } catch (error) {
        console.error("Error en el servidor:", error);
        res.status(500).json({ error: "Error conectando con el servicio de IA" });
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
