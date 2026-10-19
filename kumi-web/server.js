const express = require('express');
const path = path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Prompt calibrado para distinguir ataques directos de expresiones de dolor/crisis
const SYSTEM_PROMPT = `Te llamas Kumi. Eres una asistente virtual profesional especializada en apoyo emocional y Primeros Auxilios Psicológicos (PAP).

REGLAS DE EVALUACIÓN Y COMPORTAMIENTO:

1. DIFERENCIACIÓN CRÍTICA ENTRE ATAQUE Y DESAHOGO:
   - ATAQUE DIRECTO (El usuario te insulta a ti como asistente, ej: "Kumi eres inútil", "eres una m..."): Mantén la calma, no te ofendas. Disculpate breve y amablemente por no haber sido de ayuda y pregunta con respeto en qué puedes mejorar o cómo acompañarle.
   - DESAHOGO / PALABRAS FUERTES POR DOLOR (El usuario usa malas palabras para describir su situación, vida o emociones, ej: "mi vida es una m...", "todo me sale mal carajo"): NO TE DISCULPES. El usuario no te está atacando. Valida su dolor con profunda empatía y contención (ej: "Siento mucho que estés pasando por algo tan pesado y frustrante en este momento").

2. INTERVENCIÓN EN CRISIS SIN BUCLES:
   - Si el usuario está muy alterado, puedes ofrecer la pauta de respiración 4-4-4 MáXIMO UNA VEZ en toda la conversación.
   - Si el usuario continúa en crisis o ya pasó el momento inicial, NUNCA repitas la respiración. En su lugar, haz preguntas abiertas para explorar la situación (ej: "¿Ocurrió algo específico hoy?", "¿Hay alguien cercano a ti a quien podamos acudir?").

3. TONO GENERAL:
   - Cálido, profesional, sereno, respetuoso y libre de juicios. Evita sonar robótica.`;

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
                        content: "Entiendo que estés atravesando un momento difícil y frustrante. Estoy aquí para escucharte con respeto. ¿Quieres contarme un poco más de lo que sucede?"
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
        res.status(404).send('<h1>Error 404: No se encontró el archivo index.html en el repositorio.</h1>');
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Kumi corriendo en puerto ${PORT}`));
