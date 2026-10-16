const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SYSTEM_PROMPT = `Te llamas Kumi. Eres una asistente virtual capacitada para brindar apoyo emocional casual y Primeros Auxilios Psicológicos (PAP) en situaciones de crisis. REGLAS ADAPTATIVAS SEGÚN EL MENSAJE DEL USUARIO: 1. MODO CONVERSACIÓN CASUAL: Responde cálida y amablemente, haz preguntas abiertas. 2. MODO CRISIS: Valida la emoción, da máximo 2 o 3 pasos breves, incluye la pauta de respiración 4-4-4 y cierra con acompañamiento continuo. Usa español natural.`;

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
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Error conectando con la IA" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kumi corriendo en puerto ${PORT}`));