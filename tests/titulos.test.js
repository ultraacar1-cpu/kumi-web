const test = require('node:test');
const assert = require('node:assert');
const { limpiarTitulo, MAX_CHARS_TITULO } = require('../src/services/titulos');

test('deja títulos normales tal cual (con mayúscula inicial)', () => {
    assert.strictEqual(limpiarTitulo('Ansiedad por un examen'), 'Ansiedad por un examen');
    assert.strictEqual(limpiarTitulo('dificultad para dormir'), 'Dificultad para dormir');
});

test('quita comillas, puntos finales y prefijos', () => {
    assert.strictEqual(limpiarTitulo('"Ansiedad por el trabajo."'), 'Ansiedad por el trabajo');
    assert.strictEqual(limpiarTitulo('«Me siento solo»'), 'Me siento solo');
    assert.strictEqual(limpiarTitulo('Título: Estrés en la universidad'), 'Estrés en la universidad');
    assert.strictEqual(limpiarTitulo('**Duelo por una pérdida**'), 'Duelo por una pérdida');
    assert.strictEqual(limpiarTitulo('¿Cómo calmarme?'), 'Cómo calmarme');
});

test('usa solo la primera línea con contenido', () => {
    assert.strictEqual(limpiarTitulo('\n\nProblemas de sueño\nEste título resume...'), 'Problemas de sueño');
});

test('recorta títulos largos sin partir palabras', () => {
    const largo = 'Una conversación muy larga sobre cómo me siento con todo lo que está pasando en mi vida últimamente';
    const t = limpiarTitulo(largo);
    assert.ok(t.length <= MAX_CHARS_TITULO, `largo: ${t.length}`);
    assert.ok(largo.startsWith(t), 'debe ser un prefijo exacto, sin cortar a la mitad una palabra');
});

test('devuelve vacío si no hay nada utilizable', () => {
    assert.strictEqual(limpiarTitulo(''), '');
    assert.strictEqual(limpiarTitulo('   \n  '), '');
    assert.strictEqual(limpiarTitulo('"..."'), '');
    assert.strictEqual(limpiarTitulo(null), '');
    assert.strictEqual(limpiarTitulo(42), '');
});
