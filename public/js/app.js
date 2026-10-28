const AYUDA_TEXTO = 'Si necesitas hablar con alguien ahora, llama a la Línea 106 (gratuita, 24 horas). Si estás en peligro inmediato, llama al 123.';

let listaChats = [];
let chatActualId = null;
let isProcessing = false;
let editingChatId = null;
let openContextMenuChatId = null;
let escrituraActiva = null;   // control de la escritura de la respuesta de Kumi en curso
let timerTema = null;

const byId = id => document.getElementById(id);
// En pantallas angostas el texto largo no cabe en el cuadro, así que se usa una versión corta
const placeholderBase = () => window.innerWidth <= 480 ? 'Escribe lo que sientes...' : 'Escribe aquí lo que estás sintiendo...';
function ajustarPlaceholder() { if (!isListening) byId('user-input').placeholder = placeholderBase(); }
const reducirMovimiento = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

/* ---------- Almacenamiento local (puede fallar en modo privado) ---------- */
function leerLocal(clave, porDefecto) {
    try { return localStorage.getItem(clave) ?? porDefecto; } catch { return porDefecto; }
}
function guardarLocal(clave, valor) {
    try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento: seguimos sin guardar */ }
}

/* ---------- Inicio ---------- */
window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = leerLocal('kumi_theme', 'light');
    document.body.setAttribute('data-theme', savedTheme);
    actualizarIconoTema(savedTheme);

    ajustarPlaceholder();
    window.addEventListener('resize', ajustarPlaceholder);

    // La barra lateral arranca escondida (la clase "collapsed" ya viene puesta en el HTML)
    crearNuevoChat();   // el chat vacío inicia la pantalla de bienvenida

    // Mantener el conjunto de bienvenida centrado si cambia el tamaño de la pantalla
    const mainEl = byId('main-app');
    actualizarDesplazamientoBienvenida(true);
    if ('ResizeObserver' in window) new ResizeObserver(() => actualizarDesplazamientoBienvenida(true)).observe(mainEl);
    requestAnimationFrame(() => requestAnimationFrame(() => mainEl.classList.remove('is-booting')));

    const textarea = document.getElementById('user-input');
    textarea.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const form = textarea.closest('form');
            if (form) {
                form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
            }
        }
    });
});

/* ---------- Tema y menú lateral ---------- */
function toggleTheme() {
    const html = document.documentElement;
    const newTheme = document.body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';

    // Mientras dura el cambio, el CSS fuerza la misma duración y curva en TODOS los elementos
    html.classList.add('theme-switching');
    document.body.setAttribute('data-theme', newTheme);
    guardarLocal('kumi_theme', newTheme);
    actualizarIconoTema(newTheme, true);

    clearTimeout(timerTema);
    timerTema = setTimeout(() => html.classList.remove('theme-switching'), 650);
}

function actualizarIconoTema(theme, animar = false) {
    const icono = byId('theme-icon');
    icono.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    if (animar && !reducirMovimiento()) {
        icono.classList.add('spin');
        icono.addEventListener('animationend', () => icono.classList.remove('spin'), { once: true });
    }
}

function toggleDesktopSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('active');
}

function toggleSidebarIfMobile() {
    if (window.innerWidth <= 768) toggleSidebar();
}

function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
    actualizarDesplazamientoBienvenida(true);
}

/* ---------- Chats y Menú Contextual ---------- */
function crearNuevoChat() {
    if (chatActualId) {
        const chatActual = listaChats.find(c => c.id === chatActualId);
        if (chatActual && chatActual.historial.length === 0) {
            cambiarChat(chatActualId);
            return;
        }
    }

    const nuevoId = 'chat_' + Date.now();
    listaChats.unshift({ id: nuevoId, titulo: 'Nueva conversación', historial: [], favorito: false });
    cambiarChat(nuevoId);
}

function cambiarChat(id) {
    chatActualId = id;
    editingChatId = null;
    openContextMenuChatId = null;
    const chatObj = listaChats.find(c => c.id === id);
    if (!chatObj) return;

    // Si Kumi estaba "escribiendo" una respuesta, se corta: el contenido se vuelve a dibujar completo
    if (escrituraActiva) { escrituraActiva.cancelar(); escrituraActiva = null; }

    const container = document.getElementById('session-container');
    container.innerHTML = '';

    chatObj.historial.forEach(msg => {
        agregarBloqueUI(msg.role === 'user' ? 'user' : 'kumi', msg.content, false, { animar: false });
    });

    // Actualizar título dinámico en el Header superior
    const titleEl = document.getElementById('current-chat-title');
    if (titleEl) {
        titleEl.textContent = chatObj.titulo;
    }

    const mainApp = document.getElementById('main-app');
    if (chatObj.historial.length > 0) {
        mainApp.classList.remove('state-welcome');
        mainApp.classList.add('state-chat');
        detenerBienvenida();
    } else {
        // Se calcula el centrado ANTES de cambiar de estado, para que el cuadro de texto suba con transición
        actualizarDesplazamientoBienvenida(false);
        mainApp.classList.remove('state-chat');
        mainApp.classList.add('state-welcome');
        iniciarBienvenida();
    }

    container.scrollTop = container.scrollHeight;
    renderizarListaChats();
}

function toggleContextMenu(e, id) {
    e.stopPropagation();
    openContextMenuChatId = openContextMenuChatId === id ? null : id;
    renderizarListaChats();
}

function cerrarMenuContextual(e) {
    if (openContextMenuChatId !== null) {
        openContextMenuChatId = null;
        renderizarListaChats();
    }
}

function alternarFavorito(e, id) {
    e.stopPropagation();
    const chat = listaChats.find(c => c.id === id);
    if (chat) {
        chat.favorito = !chat.favorito;
    }
    openContextMenuChatId = null;
    renderizarListaChats();
}

function borrarChat(e, id) {
    e.stopPropagation();
    listaChats = listaChats.filter(c => c.id !== id);
    openContextMenuChatId = null;
    if (chatActualId === id) {
        if (listaChats.length > 0) {
            cambiarChat(listaChats[0].id);
        } else {
            crearNuevoChat();
        }
    } else {
        renderizarListaChats();
    }
}

function activarEdicionTitulo(e, id) {
    e.stopPropagation();
    editingChatId = id;
    openContextMenuChatId = null;
    renderizarListaChats();
}

function guardarNuevoTitulo(id, nuevoTexto) {
    const chatObj = listaChats.find(c => c.id === id);
    if (chatObj && nuevoTexto.trim() !== '') {
        chatObj.titulo = nuevoTexto.trim();
        if (chatActualId === id) {
            const titleEl = document.getElementById('current-chat-title');
            if (titleEl) titleEl.textContent = chatObj.titulo;
        }
    }
    editingChatId = null;
    renderizarListaChats();
}

// Renderizado de la lista de chats con secciones de Favoritos y Recientes
function renderizarListaChats() {
    const historyList = document.getElementById('chat-history-list');
    historyList.innerHTML = '';

    const visibles = listaChats.filter(chat => chat.historial.length > 0 || chat.id === chatActualId);
    const favoritos = visibles.filter(c => c.favorito);
    const recientes = visibles.filter(c => !c.favorito);

    const crearItemDOM = (chat) => {
        const item = document.createElement('div');
        item.className = 'chat-history-item' + (chat.id === chatActualId ? ' active' : '');
        let inputEdit = null;

        if (editingChatId === chat.id) {
            inputEdit = document.createElement('input');
            inputEdit.type = 'text';
            inputEdit.className = 'edit-title-input';
            inputEdit.value = chat.titulo;
            inputEdit.setAttribute('aria-label', 'Nombre de la conversación');
            item.appendChild(inputEdit);
            item.onclick = e => e.stopPropagation();

            let terminado = false;
            const finalizar = () => {
                if (terminado) return;
                terminado = true;
                guardarNuevoTitulo(chat.id, inputEdit.value);
            };
            inputEdit.addEventListener('blur', finalizar);
            inputEdit.addEventListener('keydown', ev => {
                if (ev.key === 'Enter') {
                    ev.preventDefault();
                    finalizar();
                } else if (ev.key === 'Escape') {
                    terminado = true;
                    editingChatId = null;
                    renderizarListaChats();
                }
            });
        } else {
            const main = document.createElement('div');
            main.className = 'chat-item-main';
            const icono = document.createElement('i');
            icono.className = 'fa-regular fa-message';
            const titulo = document.createElement('span');
            titulo.className = 'chat-item-title';
            titulo.textContent = chat.titulo;
            main.append(icono, titulo);

            // Botón de configuración con la ruedita (⚙️)
            const btnConfig = document.createElement('button');
            btnConfig.className = 'btn-chat-config' + (openContextMenuChatId === chat.id ? ' active' : '');
            btnConfig.title = 'Configurar chat';
            btnConfig.setAttribute('aria-label', 'Configurar conversación');
            btnConfig.innerHTML = '<i class="fa-solid fa-gear"></i>';
            btnConfig.addEventListener('click', e => toggleContextMenu(e, chat.id));

            item.append(main, btnConfig);

            // Menú contextual desplegable si está abierto
            if (openContextMenuChatId === chat.id) {
                const menu = document.createElement('div');
                menu.className = 'chat-context-menu';
                menu.onclick = e => e.stopPropagation();

                const btnEditar = document.createElement('button');
                btnEditar.className = 'menu-option';
                btnEditar.innerHTML = '<i class="fa-solid fa-pen"></i> Editar nombre';
                btnEditar.onclick = e => activarEdicionTitulo(e, chat.id);

                const btnFav = document.createElement('button');
                btnFav.className = 'menu-option';
                btnFav.innerHTML = `<i class="${chat.favorito ? 'fa-solid fa-star' : 'fa-regular fa-star'}" style="color: #eab308;"></i> ${chat.favorito ? 'Quitar favorito' : 'Favorito'}`;
                btnFav.onclick = e => alternarFavorito(e, chat.id);

                const btnBorrar = document.createElement('button');
                btnBorrar.className = 'menu-option danger';
                btnBorrar.innerHTML = '<i class="fa-solid fa-trash"></i> Borrar';
                btnBorrar.onclick = e => borrarChat(e, chat.id);

                menu.append(btnEditar, btnFav, btnBorrar);
                item.appendChild(menu);
            }

            item.onclick = () => {
                cambiarChat(chat.id);
                toggleSidebarIfMobile();
            };
        }

        return { item, inputEdit };
    };

    // Renderizar grupo de Favoritos si existen
    if (favoritos.length > 0) {
        const favGroup = document.createElement('div');
        favGroup.className = 'chat-section-group';
        const favTitle = document.createElement('div');
        favTitle.className = 'chat-history-title';
        favTitle.innerHTML = '<i class="fa-solid fa-star" style="color: #eab308;"></i> Favoritos';
        favGroup.appendChild(favTitle);

        favoritos.forEach(chat => {
            const { item, inputEdit } = crearItemDOM(chat);
            favGroup.appendChild(item);
            if (inputEdit) {
                setTimeout(() => {
                    inputEdit.focus();
                    inputEdit.select();
                }, 50);
            }
        });
        historyList.appendChild(favGroup);
    }

    // Renderizar grupo de Recientes / Conversaciones
    if (recientes.length > 0) {
        const recGroup = document.createElement('div');
        recGroup.className = 'chat-section-group';
        const recTitle = document.createElement('div');
        recTitle.className = 'chat-history-title';
        if (favoritos.length > 0) {
            recTitle.style.marginTop = '8px';
            recTitle.innerHTML = '<i class="fa-solid fa-clock"></i> Recientes';
        } else {
            recTitle.textContent = 'Conversaciones';
        }
        recGroup.appendChild(recTitle);

        recientes.forEach(chat => {
            const { item, inputEdit } = crearItemDOM(chat);
            recGroup.appendChild(item);
            if (inputEdit) {
                setTimeout(() => {
                    inputEdit.focus();
                    inputEdit.select();
                }, 50);
            }
        });
        historyList.appendChild(recGroup);
    }
}

/* ---------- Reconocimiento de Voz (Micrófono) ---------- */
let recognition = null;
let isListening = false;

function toggleSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        alert('Lo siento, tu navegador no soporta reconocimiento de voz.');
        return;
    }

    const micButton = document.getElementById('mic-button');
    const input = document.getElementById('user-input');

    if (isListening) {
        if (recognition) recognition.stop();
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'es-ES'; // Configurado en español
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
        isListening = true;
        micButton.classList.add('listening');
        input.placeholder = 'Escuchando... habla ahora';
    };

    recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        input.value = transcript;
        autoResize(input);
    };

    recognition.onerror = (event) => {
        console.error('Error en reconocimiento de voz:', event.error);
        detenerReconocimiento();
    };

    recognition.onend = () => {
        detenerReconocimiento();
    };

    recognition.start();
}

function detenerReconocimiento() {
    isListening = false;
    const micButton = document.getElementById('mic-button');
    const input = document.getElementById('user-input');
    
    if (micButton) micButton.classList.remove('listening');
    if (input) input.placeholder = placeholderBase();
}

/* ---------- Síntesis de Voz (Bocina en mensajes de Kumi) ---------- */
function leerTexto(texto, botonElement) {
    if (!('speechSynthesis' in window)) {
        alert('Lo siento, tu navegador no soporta la síntesis de voz.');
        return;
    }

    // Cancelar cualquier audio anterior que se esté reproduciendo
    window.speechSynthesis.cancel();

    // Limpiar etiquetas HTML y asteriscos para que la voz lea de forma natural
    const textoLimpio = texto.replace(/\*\*/g, '').replace(/<[^>]*>/g, '');

    const utterance = new SpeechSynthesisUtterance(textoLimpio);
    utterance.lang = 'es-ES'; // Configurado en español
    utterance.rate = 1.0;     // Velocidad normal

    if (botonElement) {
        botonElement.classList.add('speaking');
        utterance.onend = () => botonElement.classList.remove('speaking');
        utterance.onerror = () => botonElement.classList.remove('speaking');
    }

    window.speechSynthesis.speak(utterance);
}

/* ---------- Mensajes en pantalla ---------- */
// opciones.animar: pequeña animación de entrada (solo para mensajes nuevos)
// opciones.escribir: la respuesta aparece letra por letra
function agregarBloqueUI(autor, texto, scroll = true, opciones = {}) {
    const { animar = true, escribir = false } = opciones;
    const container = document.getElementById('session-container');
    const isUser = autor === 'user';

    const block = document.createElement('div');
    block.className = `session-block ${isUser ? 'user-entry' : 'kumi-entry'}` + (animar ? ' is-new' : '');

    const header = document.createElement('div');
    header.className = 'block-header';
    const nombre = document.createElement('span');
    nombre.className = 'block-author';
    nombre.textContent = isUser ? 'Tú' : 'Kumi';
    header.appendChild(nombre);

    if (!isUser) {
        const rol = document.createElement('span');
        rol.className = 'block-role';
        rol.textContent = '• IA';
        header.appendChild(rol);

        // Botón de la bocina en la esquina superior derecha
        const btnSpeech = document.createElement('button');
        btnSpeech.className = 'btn-speech';
        btnSpeech.title = 'Escuchar mensaje';
        btnSpeech.setAttribute('aria-label', 'Escuchar mensaje de Kumi');
        btnSpeech.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        btnSpeech.onclick = () => leerTexto(texto, btnSpeech);
        block.appendChild(btnSpeech);
    }

    const body = document.createElement('div');
    body.className = 'block-body';

    block.appendChild(header);
    block.appendChild(body);
    container.appendChild(block);

    if (escribir) {
        // Escritura letra por letra; si el usuario toca el mensaje, se completa de inmediato
        const margen = 200;
        let control = null;   // se declara antes: onFin puede ejecutarse de inmediato (p. ej. con "reducir movimiento")
        control = iniciarEscritura(body, texto, {
            modo: 'crecer',
            ...ESCRITURA_RESPUESTA,
            onTick: () => {
                if (container.scrollHeight - container.scrollTop - container.clientHeight < margen) {
                    container.scrollTop = container.scrollHeight;
                }
            },
            onFin: () => { if (escrituraActiva === control) escrituraActiva = null; }
        });
        if (!control.terminada()) escrituraActiva = control;
        block.addEventListener('click', () => control.completar());
    } else {
        // Se escapa todo el HTML y solo se permite **negrita**.
        body.innerHTML = texto
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    }

    if (scroll) container.scrollTop = container.scrollHeight;
}

function mostrarIndicador() {
    const container = document.getElementById('session-container');
    const ind = document.createElement('div');
    ind.id = 'analyzing-indicator';
    ind.className = 'analyzing-indicator';
    ind.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" style="color: var(--kumi-accent);"></i> Kumi está escribiendo...';
    container.appendChild(ind);
    container.scrollTop = container.scrollHeight;
}

function ocultarIndicador() {
    const ind = document.getElementById('analyzing-indicator');
    if (ind) ind.remove();
}

function mostrarError(chatObj, mensaje) {
    if (chatActualId === chatObj.id) {
        agregarBloqueUI('kumi', `${mensaje}\n\n${AYUDA_TEXTO}`);
    }
}

function enviarSugerencia(texto) {
    const input = document.getElementById('user-input');
    input.value = texto;
    autoResize(input);
    const form = input.closest('form');
    if (form) {
        form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
    }
}

/* ---------- Envío ---------- */
async function enviarEntrada(event) {
    event.preventDefault();
    if (isProcessing) return;

    const input = document.getElementById('user-input');
    const texto = input.value.trim();
    if (!texto) return;

    const chatObj = listaChats.find(c => c.id === chatActualId);
    if (!chatObj) return;

    isProcessing = true;
    if (escrituraActiva) escrituraActiva.completar(); // si Kumi seguía "escribiendo", se termina de mostrar
    input.value = '';
    input.style.height = 'auto';

    const mainApp = document.getElementById('main-app');
    mainApp.classList.remove('state-welcome');
    mainApp.classList.add('state-chat');

    if (chatObj.titulo === 'Nueva conversación') {
        chatObj.titulo = texto.length > 25 ? texto.substring(0, 25) + '...' : texto;
        const titleEl = document.getElementById('current-chat-title');
        if (titleEl && chatActualId === chatObj.id) {
            titleEl.textContent = chatObj.titulo;
        }
    }

    agregarBloqueUI('user', texto);
    chatObj.historial.push({ role: 'user', content: texto });
    renderizarListaChats();
    mostrarIndicador();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: chatObj.historial })
        });

        let data = {};
        try { data = await response.json(); } catch { /* respuesta sin JSON */ }

        ocultarIndicador();

        if (response.ok && typeof data.reply === 'string' && data.reply.trim()) {
            chatObj.historial.push({ role: 'assistant', content: data.reply });
            // Si hay señales de riesgo, el mensaje (con las líneas de ayuda) se muestra completo al instante
            if (chatActualId === chatObj.id) agregarBloqueUI('kumi', data.reply, true, { escribir: !data.riesgo });
        } else {
            mostrarError(chatObj, data.error || 'No pude responderte en este momento.');
        }
    } catch (error) {
        ocultarIndicador();
        mostrarError(chatObj, 'No pude conectarme con el servidor. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
        isProcessing = false;
    }
}


/* ================================================================
   Beta 2.5: sonido, escritura, bienvenida
   ================================================================ */

/* ---------- Velocidad de escritura (ajústala aquí) ----------
   Milisegundos por letra: MENOS = más rápido, MÁS = más lento.
   Las respuestas largas se aceleran solas para no pasar de "maxTotal" milisegundos en total. */
const ESCRITURA_RESPUESTA = { minMs: 9, maxMs: 24, maxTotal: 7000 };
const ESCRITURA_GLOBO_MS = 34;

/* ---------- Sonido "pop" (generado con Web Audio: no necesita archivos) ---------- */
let audioCtx = null;
function sonidoPop() {
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtx = audioCtx || new AC();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const t = audioCtx.currentTime;
        const base = 480 + Math.random() * 120;           // el tono varía un poco en cada toque
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base, t);
        osc.frequency.exponentialRampToValueAtTime(base * 0.28, t + 0.1);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.32, t + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.16);
    } catch { /* sin audio disponible: la animación sigue funcionando */ }
}

/* ---------- Escritura letra por letra ---------- */
function crearCaracteres(texto, padre, lista) {
    for (const ch of Array.from(texto)) {
        const s = document.createElement('span');
        s.className = 'tw-ch';
        s.textContent = ch;
        padre.appendChild(s);
        lista.push({ el: s, ch });
    }
}

// modo 'crecer': el texto va apareciendo y el globo crece (respuestas del chat)
// modo 'reservar': el globo ya tiene su tamaño final y las letras aparecen dentro (globo de bienvenida)
// Devuelve { completar(), cancelar() }
function iniciarEscritura(contenedor, texto, opciones = {}) {
    const { modo = 'crecer', maxTotal = 6000, minMs = 9, maxMs = 26, msFijo = null, onTick = null, onFin = null } = opciones;

    contenedor.textContent = '';
    contenedor.classList.remove('tw-grow', 'tw-reserve');
    contenedor.classList.add(modo === 'reservar' ? 'tw-reserve' : 'tw-grow');

    // Los lectores de pantalla leen el texto completo; las letras animadas se ocultan para ellos
    const lectura = document.createElement('span');
    lectura.className = 'sr-only';
    lectura.textContent = texto.replace(/\*\*/g, '');
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    contenedor.append(lectura, visual);

    // Todo se construye con nodos de texto (nunca innerHTML), solo se admite **negrita** y saltos de línea
    const items = [];
    const re = /\*\*([\s\S]+?)\*\*|\n/g;
    let ultimo = 0, m;
    while ((m = re.exec(texto)) !== null) {
        if (m.index > ultimo) crearCaracteres(texto.slice(ultimo, m.index), visual, items);
        if (m[0] === '\n') {
            const br = document.createElement('br');
            br.className = 'tw-ch';
            visual.appendChild(br);
            items.push({ el: br, ch: '\n' });
        } else {
            const st = document.createElement('strong');
            visual.appendChild(st);
            crearCaracteres(m[1], st, items);
        }
        ultimo = re.lastIndex;
    }
    if (ultimo < texto.length) crearCaracteres(texto.slice(ultimo), visual, items);

    // Ritmo natural: pausas breves en comas, puntos y saltos de línea
    const tiempos = [];
    let acumulado = 0;
    for (const it of items) {
        tiempos.push(acumulado);
        let peso = 1;
        if ('.!?…'.includes(it.ch)) peso += 6;
        else if (',;:'.includes(it.ch)) peso += 2;
        else if (it.ch === '\n') peso += 4;
        acumulado += peso;
    }
    // ms por letra: rápido pero legible, y las respuestas largas nunca pasan de ~6 s en total
    const base = msFijo !== null ? msFijo : Math.min(maxMs, Math.max(minMs, maxTotal / Math.max(acumulado, 1)));

    let mostrados = 0, terminado = false, raf = null;
    const t0 = performance.now();

    const mostrarHasta = n => {
        while (mostrados < n) { items[mostrados].el.classList.add('on'); mostrados++; }
    };
    const completar = () => {
        if (terminado) return;
        terminado = true;
        cancelAnimationFrame(raf);
        mostrarHasta(items.length);
        if (onTick) onTick();
        if (onFin) onFin();
    };
    const paso = ahora => {
        if (terminado) return;
        if (!contenedor.isConnected) { terminado = true; return; }   // el chat se cambió o se borró
        const transcurrido = ahora - t0;
        let n = mostrados;
        while (n < items.length && tiempos[n] * base <= transcurrido) n++;
        if (n > mostrados) { mostrarHasta(n); if (onTick) onTick(); }
        if (mostrados >= items.length) { terminado = true; if (onFin) onFin(); return; }
        raf = requestAnimationFrame(paso);
    };

    if (reducirMovimiento() || items.length === 0) completar();
    else raf = requestAnimationFrame(paso);

    return { completar, cancelar: () => { terminado = true; cancelAnimationFrame(raf); }, terminada: () => terminado };
}

/* ---------- Pantalla de inicio: logo, globo de texto y sugerencias ---------- */
const MENSAJES_BURBUJA = [
    '¿Cómo te sientes hoy?',
    'Soy Kumi, tu asistente de apoyo emocional.',
    'Aquí puedes contarme lo que quieras, sin juicios.',
    'Respira hondo. No hay prisa.',
    '¿Quieres desahogarte un rato?',
    'Cada emoción cuenta, incluso las difíciles.',
    'Estoy aquí para escucharte.',
    '¿Qué es lo que más te pesa hoy?',
    'Soy una IA, y estoy aquí para acompañarte.',
    'Puedes empezar por donde quieras.',
    'Hablar de lo que sientes ya es un paso.',
    'Toca de nuevo y te digo otra cosa.'
];

const SUGERENCIAS = [
    { etiqueta: 'Siento mucha ansiedad',      mensaje: 'Me siento muy ansioso/a y abrumado/a' },
    { etiqueta: 'Necesito desahogarme',       mensaje: 'Necesito desahogarme, todo me sobrepasa' },
    { etiqueta: '¿Qué es el PAP?',            mensaje: '¿Qué son los Primeros Auxilios Psicológicos?' },
    { etiqueta: 'No puedo dormir',            mensaje: 'Últimamente no puedo dormir bien y mi mente no para' },
    { etiqueta: 'Me siento solo/a',           mensaje: 'Me siento muy solo/a últimamente' },
    { etiqueta: 'Estoy muy estresado/a',      mensaje: 'Estoy muy estresado/a con todo lo que tengo que hacer' },
    { etiqueta: 'Tuve un día difícil',        mensaje: 'Tuve un día muy difícil y quiero contarlo' },
    { etiqueta: 'Quiero calmarme',            mensaje: 'Necesito calmarme, ¿me puedes guiar con un ejercicio sencillo?' },
    { etiqueta: 'Me siento triste',           mensaje: 'Me siento triste y no sé bien por qué' },
    { etiqueta: 'Tengo miedo',                mensaje: 'Tengo miedo de algo que va a pasar' },
    { etiqueta: 'Discutí con alguien',        mensaje: 'Discutí con alguien importante para mí y me siento mal' },
    { etiqueta: 'No puedo concentrarme',      mensaje: 'Me cuesta mucho concentrarme y me siento bloqueado/a' },
    { etiqueta: 'Solo quiero que me escuchen', mensaje: 'Solo quiero que alguien me escuche un rato' },
    { etiqueta: '¿Cómo manejo la ansiedad?',  mensaje: '¿Qué puedo hacer cuando siento un ataque de ansiedad?' }
];

let indiceBurbuja = -1;
let escrituraBurbuja = null;
let logoListo = false;
let timersBienvenida = [];

function elegirAleatorios(lista, n) {
    const copia = [...lista];
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia.slice(0, n);
}

function renderizarSugerencias() {
    const cont = byId('quick-prompts');
    cont.innerHTML = '';
    elegirAleatorios(SUGERENCIAS, 3).forEach((s, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'prompt-chip';
        b.style.setProperty('--i', i);
        b.textContent = s.etiqueta;
        b.addEventListener('click', () => enviarSugerencia(s.mensaje));
        cont.appendChild(b);
    });
}

function mostrarMensajeBurbuja(indice) {
    const burbuja = byId('kumi-bubble');
    if (escrituraBurbuja) escrituraBurbuja.cancelar();
    indiceBurbuja = indice;

    burbuja.classList.add('visible');
    burbuja.classList.remove('pop');
    void burbuja.offsetWidth;                 // reinicia la animación
    burbuja.classList.add('pop');

    escrituraBurbuja = iniciarEscritura(byId('kumi-bubble-text'), MENSAJES_BURBUJA[indice], { modo: 'reservar', msFijo: ESCRITURA_GLOBO_MS });
}

function indiceAleatorioDistinto() {
    let i;
    do { i = Math.floor(Math.random() * MENSAJES_BURBUJA.length); } while (i === indiceBurbuja);
    return i;
}

function activarLogo() {
    const logo = byId('kumi-logo');
    logo.classList.remove('reveal');
    logo.classList.add('listo');
    if (!logoListo) {
        logoListo = true;
        mostrarMensajeBurbuja(0);             // el primer mensaje siempre es "¿Cómo te sientes hoy?"
    }
}

function tocarLogo() {
    if (!logoListo) return;
    const logo = byId('kumi-logo');
    sonidoPop();
    logo.classList.remove('pop');
    void logo.offsetWidth;
    logo.classList.add('pop');
    mostrarMensajeBurbuja(indiceAleatorioDistinto());
}

function limpiarTimersBienvenida() {
    timersBienvenida.forEach(clearTimeout);
    timersBienvenida = [];
}

function detenerBienvenida() {
    limpiarTimersBienvenida();
    if (escrituraBurbuja) { escrituraBurbuja.cancelar(); escrituraBurbuja = null; }
}

// Reinicia la animación de entrada: el logo aparece con difuminado y luego habla el globo
function iniciarBienvenida() {
    const logo = byId('kumi-logo');
    const burbuja = byId('kumi-bubble');
    detenerBienvenida();

    logoListo = false;
    indiceBurbuja = -1;
    logo.classList.remove('listo', 'reveal', 'pop');
    logo.classList.add('oculto');
    burbuja.classList.remove('visible', 'pop');
    byId('kumi-bubble-text').textContent = '';
    renderizarSugerencias();

    timersBienvenida.push(setTimeout(() => {
        logo.classList.remove('oculto');
        logo.classList.add('reveal');
    }, 350));
    // Respaldo por si el navegador no emite el fin de la animación
    timersBienvenida.push(setTimeout(() => { if (!logoListo) activarLogo(); }, 2200));
}

window.addEventListener('DOMContentLoaded', () => {
    const logo = byId('kumi-logo');
    logo.addEventListener('click', tocarLogo);
    logo.addEventListener('animationend', e => {
        if (e.animationName === 'logoReveal') activarLogo();
        if (e.animationName === 'logoPop') logo.classList.remove('pop');
    });
});

/* ---------- Posición del conjunto de bienvenida (arriba y al centro) ---------- */
// Calcula cuánto debe subir el cuadro de texto desde su lugar normal (abajo) hasta el centro.
// sinAnimacion=true: ajuste inmediato (al escribir o cambiar el tamaño de la ventana)
function actualizarDesplazamientoBienvenida(sinAnimacion = false) {
    const main = byId('main-app');
    const composer = byId('composer');
    if (!main || !composer) return;

    const alto = main.clientHeight;
    const objetivoTop = Math.max(alto * 0.52 - 30, 250);   // deja sitio al logo y al globo por encima
    const shift = Math.max(0, composer.offsetTop - objetivoTop);

    const suprimir = sinAnimacion && main.classList.contains('state-welcome');
    if (suprimir) main.classList.add('no-composer-anim');
    main.style.setProperty('--welcome-shift', shift + 'px');
    if (suprimir) {
        void composer.offsetWidth;                       // aplica el cambio sin transición...
        main.classList.remove('no-composer-anim');       // ...y la devuelve en el acto (si no, rompería la bajada al enviar)
    }
}
