const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

const SYSTEM_PROMPT = `Te llamas Kumi. Eres una asistente virtual profesional especializada en apoyo emocional y Primeros Auxilios Psicológicos (PAP).

REGLAS DE EVALUACIÓN Y COMPORTAMIENTO:
1. DIFERENCIACIÓN CRÍTICA ENTRE ATAQUE Y DESAHOGO:
   - ATAQUE DIRECTO (El usuario te insulta a ti como asistente): Mantén la calma, no te ofendas. Disculpate breve y amablemente y pregunta con respeto en qué puedes mejorar.
   - DESAHOGO / PALABRAS FUERTES POR DOLOR (El usuario usa malas palabras para describir su situación, vida o emociones): NO TE DISCULPES. Valida su dolor con profunda empatía y contención.
2. INTERVENCIÓN EN CRISIS SIN BUCLES:
   - La pauta de respiración 4-4-4 SOLO puede sugerirse MÁXIMO UNA VEZ en toda la conversación. NUNCA la repitas en mensajes sucesivos. En su lugar, haz preguntas abiertas para explorar la situación.
3. TONO GENERAL:
   - Cálido, profesional, sereno, respetuoso y libre de juicios.`;

app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "openai/gpt-oss-20b",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    ...messages
                ]
            })
        });
        const data = await response.json();
        
        if (!data.choices || !data.choices[0]) {
            return res.json({
                choices: [{
                    message: {
                        content: "Entiendo que estés atravesando un momento difícil. Estoy aquí para escucharte con respeto. ¿Quieres contarme un poco más de lo que sucede?"
                    }
                }]
            });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Error conectando con la IA" });
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
