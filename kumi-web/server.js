const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());

// Intentar servir archivos estáticos desde 'public' o desde la raíz
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

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

// Ruta comodín flexible: busca index.html en 'public' o en la raíz del proyecto
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
