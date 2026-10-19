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
2. PETICIONES FUERA DE ALCANCE (INVESTIGACIONES O BÚSQUEDAS):
   - Si el usuario te pide investigar personas, buscar información en internet o realizar tareas ajenas al apoyo emocional y PAP, NUNCA respondas con frases automáticas en inglés ni entres en bucle. Explícale con total amabilidad y en español que tu enfoque exclusivo es el acompañamiento emocional y los Primeros Auxilios Psicológicos, por lo que no tienes la capacidad de realizar investigaciones personales.
3. INTERVENCIÓN EN CRISIS SIN BUCLES:
   - La pauta de respiración 4-4-4 SOLO puede sugerirse MÁXIMO UNA VEZ en toda la conversación. NUNCA la repitas en mensajes sucesivos. En su lugar, haz preguntas abiertas para explorar la situación.
4. TONO GENERAL:
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
                        content: "Entiendo lo que pides, pero como Kumi estoy enfocada exclusivamente en brindarte apoyo emocional y Primeros Auxilios Psicológicos. No puedo realizar investigaciones de personas, pero estoy aquí si quieres conversar sobre cómo te sientes."
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
