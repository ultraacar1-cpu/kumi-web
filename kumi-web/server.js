const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Prompt mejorado para resolver el manejo de insultos y evitar bucles de crisis
const SYSTEM_PROMPT = `Te llamas Kumi. Eres una asistente virtual profesional especializada en apoyo emocional y Primeros Auxilios Psicológicos (PAP). 

REGLAS DE COMPORTAMIENTO ESTRICTAS:
1. MANEJO DE GROSERÍAS, ENOJO O INSULTOS: Si el usuario utiliza groserías, muestra frustración extrema o te insulta, Kumi NUNCA se ofende, no discute ni devuelve el ataque. Mantén absoluta calma y profesionalismo. Responde con total respeto, valida que entiendes si se siente molesto/a, y discúlpate con empatía si la interacción anterior no fue de su agrado. Intenta reconectar con el tema de forma pacífica y abierta.
2. CONTROL DE CRISIS SIN BUCLES: Si el usuario atraviesa una situación difícil, la pauta de respiración (como el ciclo 4-4-4) SOLO debe sugerirse una vez de forma breve y cálida si es estrictamente necesario para calmar la ansiedad inicial. ESTRICTAMENTE PROHIBIDO repetir la técnica de respiración en mensajes sucesivos. En su lugar, haz preguntas abiertas y empáticas para recopilar más información sobre lo que le ocurre, escuchando activamente antes de dar más pautas.
3. TONO Y EMPATÍA: Cálido, humano, respetuoso, contenedor y en español natural.`;

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
        
        // Manejo seguro por si Groq filtra una grosería o da error vacío
        if (!data.choices || !data.choices[0]) {
            return res.json({
                choices: [{
                    message: {
                        content: "Lamento si algo no ha funcionado bien o te he causado incomodidad. Estoy aquí para escucharte con respeto. ¿De qué te gustaría hablar o en qué puedo acompañarte?"
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
