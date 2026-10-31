const test = require('node:test');
const assert = require('node:assert');

process.env.GROQ_API_KEY = 'clave-de-prueba';
process.env.GROQ_MODEL = 'openai/gpt-oss-20b';
const { generarRespuesta } = require('../src/services/llm');

function simularProveedor() {
    const llamadas = [];
    global.fetch = async (url, opts) => {
        llamadas.push(JSON.parse(opts.body));
        return { ok: true, json: async () => ({ choices: [{ message: { content: ' Hola ' } }] }) };
    };
    return llamadas;
}

test('sin opciones: no se envía reasoning_effort y se usan los valores por defecto', async () => {
    const llamadas = simularProveedor();
    const r = await generarRespuesta([{ role: 'user', content: 'hola' }]);
    assert.strictEqual(r, 'Hola');
    assert.strictEqual('reasoning_effort' in llamadas[0], false);
    assert.strictEqual(llamadas[0].max_completion_tokens, 2000);
});

test('con reasoningEffort: se envía al modelo gpt-oss, junto con tokens y temperatura propios', async () => {
    const llamadas = simularProveedor();
    await generarRespuesta([{ role: 'user', content: 'hola' }], { reasoningEffort: 'low', maxTokens: 900, temperature: 0.7 });
    assert.strictEqual(llamadas[0].reasoning_effort, 'low');
    assert.strictEqual(llamadas[0].max_completion_tokens, 900);
    assert.strictEqual(llamadas[0].temperature, 0.7);
});
