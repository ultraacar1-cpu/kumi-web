const test = require('node:test');
const assert = require('node:assert');
const { BLOQUE_AYUDA_VOZ, RESPUESTA_RIESGO_FIJA_VOZ } = require('../src/services/safety');
const { NOTA_MODO_LLAMADA } = require('../src/prompts/kumi');

test('el bloque de ayuda para voz es texto plano (sin markdown) y trae los dos números', () => {
    for (const t of [BLOQUE_AYUDA_VOZ, RESPUESTA_RIESGO_FIJA_VOZ]) {
        assert.ok(!t.includes('*'), 'no debe llevar asteriscos: se lee en voz alta');
        assert.ok(!t.includes('\n'), 'debe ser un solo párrafo');
        assert.ok(t.includes('123') && t.includes('106'));
    }
});

test('la respuesta fija de riesgo en llamada es breve (se escucha entera)', () => {
    assert.ok(RESPUESTA_RIESGO_FIJA_VOZ.split(/\s+/).length <= 60);
});

test('la nota del modo llamada pide respuestas cortas, sin listas ni emojis', () => {
    assert.match(NOTA_MODO_LLAMADA, /1 o 2 frases/);
    assert.match(NOTA_MODO_LLAMADA, /sin listas/i);
    assert.match(NOTA_MODO_LLAMADA, /emojis/i);
});
