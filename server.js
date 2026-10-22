const crearApp = require('./src/app');
const { PORT, GROQ_API_KEY } = require('./src/config');

if (!GROQ_API_KEY) {
    console.warn('[kumi] ADVERTENCIA: falta GROQ_API_KEY. El chat responderá con error hasta configurarla.');
}

crearApp().listen(PORT, () => console.log(`Kumi corriendo en puerto ${PORT}`));
