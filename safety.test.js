const test = require('node:test');
const assert = require('node:assert');
const { hayRiesgo, evaluarRiesgo } = require('../src/services/safety');

const DEBEN_ACTIVAR = [
    'quiero morirme',
    'Ya no quiero vivir',
    'no quiero seguir viviendo',
    'me quiero morir',
    'pienso en suicidarme',
    'he pensado en quitarme la vida',
    'Quiero hacerme daño',
    'todos estarían mejor sin mí',
    'ojalá no despertar mañana',
    'quiero desaparecer para siempre',
    'ME QUIERO MATAR',
    'me he cortado los brazos otra vez',
    'quiero matar a mi ex'
];

const NO_DEBEN_ACTIVAR = [
    'me muero de risa',
    'estoy muy ansioso y abrumado',
    'me siento triste y solo',
    'mi trabajo me tiene estresado',
    'mañana me voy a cortar el pelo',
    'me he cortado el dedo cocinando',
    'esta tarea me está matando de aburrimiento',
    'hola'
];

test('detecta frases de riesgo', () => {
    for (const frase of DEBEN_ACTIVAR) {
        assert.ok(hayRiesgo(frase), `Debía activarse con: "${frase}"`);
    }
});

test('no se activa con frases normales', () => {
    for (const frase of NO_DEBEN_ACTIVAR) {
        assert.ok(!hayRiesgo(frase), `No debía activarse con: "${frase}"`);
    }
});

test('evaluarRiesgo distingue actual, reciente y ninguno', () => {
    const u = content => ({ role: 'user', content });
    const a = content => ({ role: 'assistant', content });

    assert.strictEqual(evaluarRiesgo([u('quiero morirme')]), 'actual');
    assert.strictEqual(evaluarRiesgo([u('quiero morirme'), a('...'), u('no sé')]), 'reciente');
    assert.strictEqual(evaluarRiesgo([u('hola'), a('...'), u('estoy bien')]), null);
    // Si la señal quedó muy atrás (más de 2 mensajes del usuario), ya no cuenta como reciente
    assert.strictEqual(
        evaluarRiesgo([u('quiero morirme'), a('x'), u('a'), a('x'), u('b'), a('x'), u('c')]),
        null
    );
});
