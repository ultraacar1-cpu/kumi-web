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
function borrarLocal(clave) {
    try { localStorage.removeItem(clave); } catch { /* sin almacenamiento */ }
}

/* ---------- Inicio ---------- */
window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = leerLocal('kumi_theme', 'light');
    document.body.setAttribute('data-theme', savedTheme);
    actualizarIconoTema(savedTheme);

    ajustarPlaceholder();
    window.addEventListener('resize', ajustarPlaceholder);

    // La barra lateral arranca escondida (la clase "collapsed" ya viene puesta en el HTML)
    restaurarChats();   // si la persona permitió guardar, vuelven sus conversaciones (la pantalla de inicio sigue siendo un chat nuevo)
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

    const aplicar = () => {
        const nuevo = document.body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', nuevo);
        guardarLocal('kumi_theme', nuevo);
        actualizarIconoTema(nuevo, true);
    };

    // Lo ideal: el navegador fotografía la pantalla antes y después y mezcla las dos imágenes con la tarjeta
    // gráfica. Es uniforme por construcción y no se traba aunque haya muchos mensajes en pantalla.
    if (typeof document.startViewTransition === 'function' && !reducirMovimiento()) {
        document.startViewTransition(aplicar);
        return;
    }

    // Respaldo para navegadores sin esa función: el CSS fuerza la misma duración y curva en todos los elementos
    html.classList.add('theme-switching');
    aplicar();
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
    detenerVoz();   // si Kumi estaba leyendo un mensaje del chat anterior, se calla

    const container = document.getElementById('session-container');
    container.innerHTML = '';

    chatObj.historial.forEach(msg => {
        agregarBloqueUI(msg.role === 'user' ? 'user' : 'kumi', msg.content, false, { animar: false });
    });

    // Actualizar título dinámico en el Header superior
    ponerTituloHeader(chatObj.titulo, false);

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
        chatObj.tituloManual = true;     // desde ahora el título es del usuario: la IA no lo vuelve a tocar
        if (chatActualId === id) ponerTituloHeader(chatObj.titulo);
    }
    editingChatId = null;
    renderizarListaChats();
}

// Renderizado de la lista de chats con secciones de Favoritos y Recientes
function renderizarListaChats() {
    persistir();    // favoritos, nombres, borrados y mensajes nuevos pasan por aquí
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
            titulo.title = chat.titulo;
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

/* (La síntesis de voz está en la sección "Voz de Kumi", más abajo) */

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
        btnSpeech.setAttribute('aria-pressed', 'false');
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

    iniciarTituloSiEsPrimero(chatObj, texto);

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
            persistir();
            ofrecerGuardado();
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
const ESCRITURA_RESPUESTA = { minMs: 4, maxMs: 12, maxTotal: 2500 };
const ESCRITURA_GLOBO_MS = 20;

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
        if ('.!?…'.includes(it.ch)) peso += 3;
        else if (',;:'.includes(it.ch)) peso += 1;
        else if (it.ch === '\n') peso += 2;
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


/* ================================================================
   Títulos automáticos de las conversaciones
   ================================================================ */
let timerTituloHeader = null;

// Muestra el nombre de la conversación arriba, con un pequeño fundido al cambiar
function ponerTituloHeader(texto, animar = true) {
    const el = byId('current-chat-title');
    if (!el) return;
    el.title = texto;
    clearTimeout(timerTituloHeader);
    if (!animar || el.textContent === texto || reducirMovimiento()) {
        el.classList.remove('is-changing');
        el.textContent = texto;
        return;
    }
    el.classList.add('is-changing');
    timerTituloHeader = setTimeout(() => {
        el.textContent = texto;
        el.classList.remove('is-changing');
    }, 140);
}

// Título provisional (sin IA): la primera frase, sin saludos, de hasta ~50 caracteres
function resumirLocal(texto) {
    let t = texto.replace(/\s+/g, ' ').trim().split(/[.!?…]/)[0].trim() || texto.trim();
    t = t.replace(/^(hola|holi|hey|ey|oye|buenas( tardes| noches| d[ií]as)?|buen(os|as) d[ií]as)\b[\s,!.¡:]*/i, '');
    t = t.replace(/^kumi\b[\s,!.:]*/i, '');
    t = t.replace(/^[¡¿\s]+|[\s,;:]+$/g, '');
    if (!t) t = texto.trim();
    if (t.length > 50) {
        const corte = t.slice(0, 50);
        const espacio = corte.lastIndexOf(' ');
        t = (espacio > 20 ? corte.slice(0, espacio) : corte).trim() + '…';
    }
    return t.charAt(0).toUpperCase() + t.slice(1);
}

// Primer mensaje del chat: título provisional al instante y, en paralelo, un resumen hecho por la IA.
// Debe llamarse ANTES de guardar el mensaje en el historial.
function iniciarTituloSiEsPrimero(chatObj, texto) {
    if (chatObj.historial.length === 0 && !chatObj.tituloManual) {
        chatObj.titulo = resumirLocal(texto);
        if (chatActualId === chatObj.id) ponerTituloHeader(chatObj.titulo, false);
        solicitarTituloIA(chatObj, texto);
    }
}

// Pide a la IA un resumen corto del primer mensaje. Si falla, se queda el título provisional.
async function solicitarTituloIA(chatObj, texto) {
    try {
        const r = await fetch('/api/titulo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: texto })
        });
        if (!r.ok) return;
        const data = await r.json();
        const nuevo = typeof data.titulo === 'string' ? data.titulo.trim() : '';
        if (!nuevo) return;
        if (chatObj.tituloManual) return;               // el usuario ya lo renombró: se respeta
        if (!listaChats.includes(chatObj)) return;      // el chat se borró mientras tanto
        chatObj.titulo = nuevo;
        if (chatActualId === chatObj.id) ponerTituloHeader(nuevo);
        if (editingChatId === null) renderizarListaChats();   // si se está editando otro nombre, no se interrumpe
        else persistir();
    } catch { /* sin conexión o error: queda el título provisional */ }
}

/* ================================================================
   Voz de Kumi
   ================================================================ */
// Los navegadores solo pueden usar las voces que trae cada dispositivo (cambian entre Windows, Android, iPhone...).
// Por eso Kumi define 6 "perfiles" y cada dispositivo asigna a cada perfil la mejor voz en español que tenga
// del género correspondiente, ajustando tono y velocidad. El perfil predeterminado es siempre el mismo.
const PERFILES_VOZ = [
    { id: 'f-alegre',  nombre: 'Aurora', genero: 'f', desc: 'Joven y enérgica',      pitch: 1.18, rate: 1.14 },
    { id: 'f-calida',  nombre: 'Luna',   genero: 'f', desc: 'Cálida y tranquila',    pitch: 1.0,  rate: 0.97 },
    { id: 'f-suave',   nombre: 'Alba',   genero: 'f', desc: 'Suave y serena',        pitch: 1.04, rate: 0.9 },
    { id: 'm-amable',  nombre: 'Leo',    genero: 'm', desc: 'Amable y cercano',      pitch: 1.0,  rate: 1.02 },
    { id: 'm-calmado', nombre: 'Mateo',  genero: 'm', desc: 'Calmado y claro',       pitch: 0.9,  rate: 0.96 },
    { id: 'm-grave',   nombre: 'Gael',   genero: 'm', desc: 'Grave y sereno',        pitch: 0.8,  rate: 0.93 }
];
const VOZ_PREDETERMINADA = 'f-alegre';
const MUESTRA_VOZ = 'Hola, soy Kumi. Estoy aquí para escucharte, sin prisa y sin juicios.';

const NOMBRES_FEMENINOS = ['helena', 'laura', 'sabina', 'elvira', 'dalia', 'salome', 'paola', 'camila', 'elena', 'marina', 'lia', 'ximena',
    'valentina', 'abril', 'maria', 'mariana', 'monica', 'paulina', 'marisol', 'soledad', 'angelica', 'francisca', 'isabela', 'isabella',
    'catalina', 'carolina', 'lucia', 'luciana', 'sofia', 'esperanza', 'female', 'mujer', 'femenina'];
const NOMBRES_MASCULINOS = ['pablo', 'raul', 'alvaro', 'jorge', 'gonzalo', 'alonso', 'tomas', 'saul', 'lorenzo', 'mateo', 'emilio', 'diego',
    'juan', 'carlos', 'pedro', 'miguel', 'andres', 'enrique', 'roberto', 'antonio', 'male', 'hombre', 'masculina'];
const VOCES_EXCLUIDAS = ['eddy', 'flo', 'grandma', 'grandpa', 'reed', 'rocko', 'sandy', 'shelley'];   // voces "de broma" de Apple
const PREFERENCIA_REGION = { 'es-co': 8, 'es-mx': 7, 'es-us': 6, 'es-419': 6, 'es-ar': 4, 'es-cl': 4, 'es-pe': 4, 'es-ve': 4, 'es-es': 2 };

let vocesSistema = [];
let perfilVozId = leerLocal('kumi_voz', VOZ_PREDETERMINADA);
if (!PERFILES_VOZ.some(p => p.id === perfilVozId)) perfilVozId = VOZ_PREDETERMINADA;

const sinAcentos = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const contienePalabra = (texto, lista) => lista.some(w => new RegExp('\\b' + w + '\\b').test(texto));

function generoDeVoz(v) {
    const n = sinAcentos(v.name);
    if (contienePalabra(n, NOMBRES_FEMENINOS)) return 'f';
    if (contienePalabra(n, NOMBRES_MASCULINOS)) return 'm';
    if (n.startsWith('google')) return 'f';      // las voces "Google español" son femeninas
    return null;
}

function puntuarVoz(v) {
    const n = sinAcentos(v.name);
    let p = 0;
    if (/natural|neural|online|premium|enhanced|siri|chirp|studio/.test(n)) p += 50;   // suenan menos robóticas
    if (n.startsWith('google')) p += 20;
    if (!v.localService) p += 10;
    if (/compact/.test(n)) p -= 15;
    p += PREFERENCIA_REGION[(v.lang || '').replace('_', '-').toLowerCase()] || 0;
    return p;
}

function cargarVoces() {
    if (!('speechSynthesis' in window)) return;
    const todas = window.speechSynthesis.getVoices() || [];
    vocesSistema = todas
        .filter(v => /^es([-_]|$)/i.test(v.lang) && !VOCES_EXCLUIDAS.some(x => sinAcentos(v.name).includes(x)))
        .sort((a, b) => puntuarVoz(b) - puntuarVoz(a));
}

// Voz del dispositivo que le toca a un perfil. 'exacta' = hay una voz de ese género en el dispositivo.
function vozParaPerfil(perfil) {
    const delGenero = vocesSistema.filter(v => generoDeVoz(v) === perfil.genero);
    if (delGenero.length) {
        const posicion = PERFILES_VOZ.filter(p => p.genero === perfil.genero).findIndex(p => p.id === perfil.id);
        return { voz: delGenero[posicion % delGenero.length], exacta: true };
    }
    const sinGenero = vocesSistema.filter(v => generoDeVoz(v) === null);
    return { voz: sinGenero[0] || vocesSistema[0] || null, exacta: false };
}

/* ---------- Reproducción (con pulsación alterna: leer / detener) ---------- */
let sesionVoz = 0;            // cada lectura nueva o cada "detener" cambia este número y anula los avisos tardíos de la anterior
let botonVozActivo = null;

function detenerVoz() {
    sesionVoz++;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (botonVozActivo) {
        botonVozActivo.classList.remove('speaking');
        botonVozActivo.setAttribute('aria-pressed', 'false');
    }
    botonVozActivo = null;
}

// Parte el texto en trozos cortos: Chrome corta las lecturas largas a los ~15 s y así no pasa
function dividirEnTrozos(texto, max = 180) {
    const limpio = texto.replace(/([.!?…:])\s*\n+\s*/g, '$1 ').replace(/\s*\n+\s*/g, '. ').replace(/\s+/g, ' ').trim();
    const frases = limpio.match(/[^.!?…]+[.!?…]*\s*/g) || [limpio];
    const trozos = [];
    let actual = '';
    const cerrar = () => { if (actual.trim()) trozos.push(actual.trim()); actual = ''; };
    for (let f of frases) {
        while (f.length > max) {                      // frase larguísima: se corta en un espacio
            let i = f.lastIndexOf(' ', max);
            if (i < 40) i = max;
            cerrar();
            trozos.push(f.slice(0, i).trim());
            f = f.slice(i);
        }
        if ((actual + f).length > max) cerrar();
        actual += f;
    }
    cerrar();
    return trozos;
}

// Prepara el texto para leerlo en voz alta: sin markdown, sin emojis y con los números de ayuda dichos dígito a dígito
function paraVoz(texto) {
    return texto
        .replace(/<[^>]*>/g, ' ')
        .replace(/\*\*/g, '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\p{Extended_Pictographic}/gu, '')
        .replace(/\b123\b/g, 'uno dos tres')
        .replace(/\b106\b/g, 'uno cero seis')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

// Núcleo de la síntesis de voz (lo usan la bocina de los mensajes, las muestras y la llamada).
// callbacks: onPalabra() en cada palabra (si el navegador lo informa) y onFin() al terminar o fallar.
// Devuelve true si empezó a leer.
function reproducirTexto(texto, perfilId, cb = {}) {
    if (!('speechSynthesis' in window)) return false;

    if (vocesSistema.length === 0) cargarVoces();
    const perfil = PERFILES_VOZ.find(p => p.id === perfilId) || PERFILES_VOZ[0];
    const { voz, exacta } = vozParaPerfil(perfil);
    let tono = perfil.pitch;
    if (!exacta) tono = perfil.genero === 'm' ? tono * 0.8 : tono * 1.2;    // sin voz de ese género: se imita con el tono
    tono = Math.min(1.8, Math.max(0.5, tono));

    const trozos = dividirEnTrozos(paraVoz(texto));
    if (trozos.length === 0) return false;

    const miSesion = ++sesionVoz;
    const terminar = () => {
        if (miSesion !== sesionVoz) return;           // aviso tardío de una lectura que ya se detuvo: se ignora
        if (cb.onFin) cb.onFin();
    };
    let i = 0;
    const siguiente = () => {
        if (miSesion !== sesionVoz) return;
        if (i >= trozos.length) { terminar(); return; }
        const u = new SpeechSynthesisUtterance(trozos[i++]);
        u.lang = voz ? voz.lang : 'es-ES';
        if (voz) u.voice = voz;
        u.pitch = tono;
        u.rate = perfil.rate;
        u.onboundary = e => {
            if (miSesion !== sesionVoz || !cb.onPalabra) return;
            if (!e || !e.name || e.name === 'word') cb.onPalabra(e);
        };
        u.onend = siguiente;
        u.onerror = terminar;
        window.speechSynthesis.speak(u);
    };
    setTimeout(siguiente, 60);    // pausa mínima tras cancelar(): algunos navegadores "se tragan" el primer enunciado si no
    return true;
}

// Bocina de un mensaje: una pulsación lee, la siguiente detiene
function hablar(texto, boton, perfilId = perfilVozId) {
    if (!('speechSynthesis' in window)) {
        alert('Lo siento, tu navegador no soporta la síntesis de voz.');
        return;
    }
    if (botonVozActivo === boton) { detenerVoz(); return; }
    detenerVoz();

    const liberar = () => {
        boton.classList.remove('speaking');
        boton.setAttribute('aria-pressed', 'false');
        if (botonVozActivo === boton) botonVozActivo = null;
    };
    botonVozActivo = boton;
    boton.classList.add('speaking');
    boton.setAttribute('aria-pressed', 'true');
    if (!reproducirTexto(texto, perfilId, { onFin: liberar })) liberar();
}

function leerTexto(texto, botonElement) { hablar(texto, botonElement); }

if ('speechSynthesis' in window) {
    // Muchos navegadores cargan la lista de voces con retraso
    window.speechSynthesis.onvoiceschanged = () => {
        cargarVoces();
        if (ajustesAbiertos) renderizarVoces();
    };
}

/* ================================================================
   Ventana de ajustes
   ================================================================ */
let ajustesAbiertos = false;
let focoAntesDeAjustes = null;

function renderizarVoces() {
    const lista = byId('voice-list');
    lista.innerHTML = '';
    const hayInexactas = [];

    const grupos = [['f', 'Voces femeninas'], ['m', 'Voces masculinas']];
    grupos.forEach(([genero, titulo]) => {
        const tit = document.createElement('div');
        tit.className = 'voice-group-title';
        tit.textContent = titulo;
        lista.appendChild(tit);

        const grupo = document.createElement('div');
        grupo.setAttribute('role', 'radiogroup');
        grupo.setAttribute('aria-label', titulo);

        PERFILES_VOZ.filter(p => p.genero === genero).forEach(perfil => {
            const { voz, exacta } = vozParaPerfil(perfil);
            if (!exacta) hayInexactas.push(genero);

            const card = document.createElement('div');
            card.className = 'voice-card';
            card.dataset.perfil = perfil.id;
            card.tabIndex = 0;
            card.setAttribute('role', 'radio');
            card.setAttribute('aria-checked', String(perfil.id === perfilVozId));

            const avatar = document.createElement('div');
            avatar.className = 'voice-avatar';
            avatar.textContent = perfil.nombre.charAt(0);

            const info = document.createElement('div');
            info.className = 'voice-info';
            const nombre = document.createElement('div');
            nombre.className = 'voice-name';
            nombre.textContent = perfil.nombre;
            if (perfil.id === VOZ_PREDETERMINADA) {
                const badge = document.createElement('span');
                badge.className = 'voice-badge';
                badge.textContent = 'Predeterminada';
                nombre.appendChild(badge);
            }
            const desc = document.createElement('div');
            desc.className = 'voice-desc';
            desc.textContent = perfil.desc;
            const dispositivo = document.createElement('div');
            dispositivo.className = 'voice-device';
            dispositivo.textContent = voz ? 'Voz del dispositivo: ' + voz.name : 'Voz predeterminada del dispositivo';
            info.append(nombre, desc, dispositivo);

            const play = document.createElement('button');
            play.type = 'button';
            play.className = 'voice-play';
            play.setAttribute('aria-label', 'Escuchar una muestra de la voz ' + perfil.nombre);
            play.setAttribute('aria-pressed', 'false');
            play.innerHTML = '<i class="fa-solid fa-play"></i>';
            play.addEventListener('click', e => { e.stopPropagation(); hablar(MUESTRA_VOZ, play, perfil.id); });

            const check = document.createElement('span');
            check.className = 'voice-check';
            check.innerHTML = '<i class="fa-solid fa-check"></i>';

            card.append(avatar, info, play, check);
            card.addEventListener('click', () => seleccionarPerfilVoz(perfil.id));
            card.addEventListener('keydown', e => {
                if (e.target === card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); seleccionarPerfilVoz(perfil.id); }
            });
            grupo.appendChild(card);
        });
        lista.appendChild(grupo);
    });

    // Nota honesta sobre lo que el dispositivo puede o no hacer
    const nota = byId('voice-note');
    let texto = 'Las voces dependen de tu dispositivo y navegador: Kumi usa la mejor voz en español que encuentre en cada uno.';
    if (vocesSistema.length === 0) {
        texto = 'Este dispositivo no muestra voces en español instaladas, así que se usará la voz que traiga por defecto. ' + texto;
    } else if (hayInexactas.length) {
        const cual = hayInexactas.includes('m') && hayInexactas.includes('f') ? 'femeninas ni masculinas'
            : hayInexactas.includes('m') ? 'masculinas' : 'femeninas';
        texto = 'Este dispositivo no tiene voces ' + cual + ' en español: esos perfiles usan la voz disponible con el tono ajustado. ' + texto;
    }
    nota.textContent = texto;
}

function seleccionarPerfilVoz(id) {
    perfilVozId = id;
    guardarLocal('kumi_voz', id);
    document.querySelectorAll('.voice-card').forEach(c => c.setAttribute('aria-checked', String(c.dataset.perfil === id)));
}

function abrirAjustes() {
    cargarVoces();
    renderizarVoces();
    focoAntesDeAjustes = document.activeElement;
    if (window.innerWidth <= 768 && byId('sidebar').classList.contains('open')) toggleSidebar();
    seleccionarPestanaAjustes('voz');
    byId('settings-overlay').classList.add('open');
    byId('settings-modal').classList.add('open');
    ajustesAbiertos = true;
    byId('settings-close').focus();
}

function cerrarAjustes() {
    if (!ajustesAbiertos) return;
    ajustesAbiertos = false;
    byId('settings-overlay').classList.remove('open');
    byId('settings-modal').classList.remove('open');
    // Si estaba sonando una muestra, se corta (si era un mensaje del chat, se deja)
    if (botonVozActivo && botonVozActivo.classList.contains('voice-play')) detenerVoz();
    if (focoAntesDeAjustes && focoAntesDeAjustes.focus) focoAntesDeAjustes.focus();
}

window.addEventListener('DOMContentLoaded', () => {
    cargarVoces();
    document.addEventListener('keydown', e => {
        if (!ajustesAbiertos) return;
        if (e.key === 'Escape') { e.preventDefault(); cerrarAjustes(); return; }
        if (e.key === 'Tab') {      // el foco se queda dentro de la ventana mientras está abierta
            const f = [...byId('settings-modal').querySelectorAll('button, input, [tabindex]')].filter(x => x.offsetParent !== null && x.tabIndex >= 0 && !x.disabled);
            if (!f.length) return;
            const primero = f[0], ultimo = f[f.length - 1];
            if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
            else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
        }
    });
});


/* ================================================================
   Llamada de voz con Kumi
   ================================================================
   Ciclo: Kumi saluda -> escucha ("Te escucho") -> la persona habla -> "Kumi está pensando" ->
   Kumi responde en voz alta ("Kumi está hablando") -> vuelve a escuchar. El micrófono se apaga mientras
   Kumi habla, para que no se escuche a sí misma. Todo lo hablado queda en el chat de la conversación. */
const SALUDOS_LLAMADA = ['Hola, soy Kumi. Te escucho.', 'Hola, aquí estoy. ¿Qué tienes en mente?', 'Hola. Cuéntame, te escucho.'];
const SILENCIOS_PARA_PREGUNTAR = 5;   // ciclos de escucha sin voz (≈ 30 s) antes de preguntar "¿sigues ahí?"
const SILENCIOS_PARA_COLGAR = 14;     // ≈ 90 s sin hablar: la llamada se corta sola (el micrófono no queda abierto para siempre)
const TEXTOS_ESTADO = {
    conectando: 'Conectando…',
    escuchando: 'Te escucho…',
    pensando: 'Kumi está pensando…',
    hablando: 'Kumi está hablando…',
    toque: 'Toca el círculo para hablar'
};

let llamada = null;               // null = no hay llamada en curso
let focoAntesDeLlamada = null;
let timerAviso = null;

function mostrarAviso(texto, ms = 4500) {
    const t = byId('toast');
    t.textContent = texto;
    t.classList.add('show');
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => t.classList.remove('show'), ms);
}

function setEstadoLlamada(estado) {
    if (!llamada) return;
    llamada.estado = estado;
    byId('call-screen').dataset.estado = estado;
    byId('call-status').textContent = TEXTOS_ESTADO[estado] || '';
    byId('call-logo').setAttribute('aria-label',
        estado === 'hablando' ? 'Interrumpir a Kumi' : estado === 'toque' ? 'Hablar con Kumi' : 'Kumi');
}

function iniciarLlamada() {
    if (llamada) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { mostrarAviso('Tu navegador no admite llamadas de voz. Prueba con Chrome, Edge o Safari.'); return; }
    if (isProcessing) { mostrarAviso('Espera un momento: Kumi todavía está respondiendo.'); return; }
    const chatObj = listaChats.find(c => c.id === chatActualId);
    if (!chatObj) return;

    // Se cierra todo lo que use el audio o el micrófono
    if (isListening && recognition) { try { recognition.stop(); } catch { /* ya estaba detenido */ } }
    detenerVoz();
    if (escrituraActiva) escrituraActiva.completar();
    cerrarAjustes();
    if (window.innerWidth <= 768 && byId('sidebar').classList.contains('open')) toggleSidebar();

    focoAntesDeLlamada = document.activeElement;
    llamada = {
        chatId: chatObj.id, estado: 'conectando', rec: null, abortCtl: null, escuchaId: 0,
        silencios: 0, preguntado: false, escuchoAlguna: false,
        nivel: 0, impulso: 0, ultimaPalabra: 0, boostUsuario: 0, raf: null, tUlt: 0
    };
    byId('call-screen').classList.add('open');
    setEstadoLlamada('conectando');
    byId('call-end').focus();
    llamada.raf = requestAnimationFrame(animarLlamada);

    // El saludo ocurre dentro del toque del usuario, lo que además "desbloquea" el audio en iPhone
    hablarEnLlamada(SALUDOS_LLAMADA[Math.floor(Math.random() * SALUDOS_LLAMADA.length)]);
}

function hablarEnLlamada(texto, despues = escucharLlamada) {
    const l = llamada;
    if (!l) return;
    setEstadoLlamada('hablando');
    const empezo = reproducirTexto(texto, perfilVozId, {
        onPalabra: () => { if (llamada === l) { l.impulso = 1; l.ultimaPalabra = performance.now(); } },
        onFin: () => {
            // Una pausa corta antes de abrir el micrófono evita captar la cola del propio audio
            setTimeout(() => { if (llamada === l && l.estado === 'hablando') despues(); }, 350);
        }
    });
    if (!empezo) despues();      // este navegador no puede hablar: la llamada sigue solo con la pantalla
}

function escucharLlamada() {
    const l = llamada;
    if (!l) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setEstadoLlamada('escuchando');

    const miId = ++l.escuchaId;
    const rec = new SR();
    rec.lang = 'es-CO';
    rec.interimResults = true;
    rec.continuous = false;       // termina solo cuando la persona deja de hablar: así se turnan
    rec.maxAlternatives = 1;
    l.rec = rec;

    let textoFinal = '';
    let conError = false;
    const vigente = () => llamada === l && miId === l.escuchaId;

    rec.onstart = () => { if (vigente()) l.escuchoAlguna = true; };
    rec.onresult = e => {
        if (!vigente()) return;
        l.boostUsuario = 1;       // la luz reacciona suavemente cuando la persona habla
        l.silencios = 0;
        l.preguntado = false;
        textoFinal = Array.from(e.results).filter(r => r.isFinal).map(r => r[0].transcript).join(' ');
    };
    rec.onerror = e => {
        if (!vigente()) return;
        conError = true;
        manejarErrorEscucha(l, e.error);
    };
    rec.onend = () => {
        if (!vigente()) return;
        l.rec = null;
        if (conError) return;
        const texto = textoFinal.trim();
        if (texto) procesarTurnoLlamada(texto);
        else reintentarEscucha(l);
    };

    try { rec.start(); }
    catch { setTimeout(() => { if (vigente()) reintentarEscucha(l); }, 400); }
}

function manejarErrorEscucha(l, codigo) {
    switch (codigo) {
        case 'not-allowed':
        case 'service-not-allowed':
            // Si ya había funcionado antes, el navegador pide un toque para volver a abrir el micrófono (iPhone)
            if (l.escuchoAlguna) setEstadoLlamada('toque');
            else terminarLlamada('Necesito permiso para usar el micrófono. Actívalo en tu navegador e inténtalo de nuevo.');
            break;
        case 'audio-capture':
            terminarLlamada('No encuentro un micrófono disponible.');
            break;
        case 'network':
            terminarLlamada('No pude conectarme al servicio de voz de tu navegador. Revisa tu conexión.');
            break;
        default:                       // 'no-speech', 'aborted', etc.: simplemente se vuelve a escuchar
            reintentarEscucha(l);
    }
}

function reintentarEscucha(l) {
    if (llamada !== l) return;
    l.silencios++;
    if (l.silencios >= SILENCIOS_PARA_COLGAR) {
        terminarLlamada('La llamada terminó porque no te escuché por un rato.');
        return;
    }
    if (l.silencios === SILENCIOS_PARA_PREGUNTAR && !l.preguntado) {
        l.preguntado = true;
        hablarEnLlamada('¿Sigues ahí? Te escucho cuando quieras.');
        return;
    }
    setTimeout(() => { if (llamada === l && l.estado === 'escuchando') escucharLlamada(); }, 300);
}

async function procesarTurnoLlamada(texto) {
    const l = llamada;
    if (!l) return;
    const chatObj = listaChats.find(c => c.id === l.chatId);
    if (!chatObj) { terminarLlamada(); return; }

    setEstadoLlamada('pensando');
    l.silencios = 0;

    // Lo hablado también se guarda en el chat de fondo (se verá al volver de la llamada)
    const main = byId('main-app');
    main.classList.remove('state-welcome');
    main.classList.add('state-chat');
    iniciarTituloSiEsPrimero(chatObj, texto);
    agregarBloqueUI('user', texto, true, { animar: false });
    chatObj.historial.push({ role: 'user', content: texto });
    renderizarListaChats();

    l.abortCtl = new AbortController();
    let respuesta = null;
    let mensajeError = null;
    try {
        const r = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: chatObj.historial, modo: 'llamada' }),
            signal: l.abortCtl.signal
        });
        let data = {};
        try { data = await r.json(); } catch { /* sin JSON */ }
        if (r.ok && typeof data.reply === 'string' && data.reply.trim()) respuesta = data.reply.trim();
        else if (r.status === 429) mensajeError = 'Vas muy rápido. Dame un momento y vuelve a intentarlo.';
        else mensajeError = 'Tuve un problema técnico. ¿Puedes repetirlo?';
    } catch (err) {
        if (err && err.name === 'AbortError') return;
        mensajeError = 'Se cortó la conexión un momento. ¿Puedes repetirlo?';
    }
    if (llamada !== l) return;       // la llamada terminó mientras esperábamos

    if (respuesta) {
        chatObj.historial.push({ role: 'assistant', content: respuesta });
        persistir();
        agregarBloqueUI('kumi', respuesta, true, { animar: false });
        hablarEnLlamada(respuesta);
    } else {
        hablarEnLlamada(mensajeError);   // los errores no se guardan en el historial
    }
}

// Tocar el círculo mientras Kumi habla la interrumpe; en modo "toque" abre el micrófono
function tocarOrbeLlamada() {
    const l = llamada;
    if (!l) return;
    if (l.estado === 'hablando') {
        detenerVoz();
        l.silencios = 0;
        escucharLlamada();
    } else if (l.estado === 'toque') {
        escucharLlamada();
    }
}

function terminarLlamada(motivo) {
    const l = llamada;
    if (!l) return;
    llamada = null;
    l.escuchaId++;                                   // ignora cualquier aviso tardío del reconocimiento de voz
    try { if (l.rec) l.rec.abort(); } catch { /* ya estaba cerrado */ }
    if (l.abortCtl) l.abortCtl.abort();
    detenerVoz();
    cancelAnimationFrame(l.raf);

    byId('call-screen').classList.remove('open');
    setTimeout(() => { if (!llamada) byId('call-orb').style.setProperty('--nivel', '0'); }, 600);
    if (motivo) mostrarAviso(motivo);

    // De vuelta al chat, con lo hablado en la llamada ya escrito
    const chatObj = listaChats.find(c => c.id === l.chatId);
    if (chatObj && chatObj.historial.length > 0 && chatActualId === chatObj.id) {
        const main = byId('main-app');
        main.classList.remove('state-welcome');
        main.classList.add('state-chat');
        const cont = byId('session-container');
        cont.scrollTop = cont.scrollHeight;
        ofrecerGuardado();
    }
    if (focoAntesDeLlamada && focoAntesDeLlamada.focus) focoAntesDeLlamada.focus();
}

/* ---------- Animación de la luz LED ----------
   Cada frame calcula "nivel" (0 a 1) y se lo pasa al CSS. Mientras Kumi habla, cada palabra enciende la luz y
   luego se difumina; si el navegador no avisa de las palabras, se usa un ritmo orgánico equivalente.
   Sube rápido y baja despacio, así la luz "respira" con la voz. */
function animarLlamada(t) {
    const l = llamada;
    if (!l) return;
    const dt = Math.min(0.05, (t - (l.tUlt || t)) / 1000);
    l.tUlt = t;
    l.impulso *= Math.exp(-dt * 9);          // cada palabra enciende la luz y se difumina en ~0,3 s
    l.boostUsuario *= Math.exp(-dt * 3);

    let objetivo;
    if (l.estado === 'hablando') {
        const hayPalabras = t - l.ultimaPalabra < 600;
        const ruido = (Math.sin(t / 130) + Math.sin(t / 77 + 1.7) + Math.sin(t / 301 + 0.4)) / 6 + 0.5;
        objetivo = 0.20 + 1.05 * (hayPalabras ? l.impulso : ruido);
    } else if (l.estado === 'pensando') {
        objetivo = 0.28 + 0.05 * Math.sin(t / 240);
    } else if (l.estado === 'escuchando') {
        objetivo = 0.10 + 0.06 * Math.sin(t / 650) + 0.45 * l.boostUsuario;
    } else {
        objetivo = 0.12;
    }
    // Sube muy rápido; baja rápido entre palabras y mucho más despacio al terminar de hablar (se "difumina")
    const velocidad = objetivo > l.nivel ? 45 : (l.estado === 'hablando' ? 10 : 3.5);
    l.nivel += (objetivo - l.nivel) * (1 - Math.exp(-dt * velocidad));
    byId('call-orb').style.setProperty('--nivel', Math.min(1, Math.max(0, l.nivel)).toFixed(3));
    l.raf = requestAnimationFrame(animarLlamada);
}

window.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && llamada) { e.preventDefault(); terminarLlamada(); }
    });
});


/* ================================================================
   Conversaciones guardadas en este dispositivo
   ================================================================
   Se usa localStorage (no cookies: son de 4 KB y viajan al servidor en cada petición). Todo queda en el navegador
   de la persona; Kumi no lo sube a ningún lado. Como son conversaciones muy íntimas, NADA se guarda hasta que la
   persona lo autorice (tarjeta dentro del chat o interruptor en Ajustes › Privacidad). */
const CLAVE_CHATS = 'kumi_chats_v1';
const CLAVE_PERMISO = 'kumi_guardado';          // 'si' | 'no' | sin definir (todavía no se ha preguntado)
const MAX_CHATS_GUARDADOS = 100;
const MAX_CARACTERES_GUARDADOS = 2000000;       // localStorage admite ~5 MB por sitio: se deja holgura
const MAX_CARACTERES_MENSAJE = 10000;

let guardadoActivo = leerLocal(CLAVE_PERMISO, '') === 'si';
let timerGuardado = null;
let avisoCuotaMostrado = false;

function contarGuardadas() {
    return listaChats.filter(c => c.historial.length > 0).length;
}

// Programa el guardado (se espera un instante para agrupar varios cambios seguidos)
function persistir() {
    if (!guardadoActivo) return;
    clearTimeout(timerGuardado);
    timerGuardado = setTimeout(() => { timerGuardado = null; escribirChats(); }, 250);
}

// Guarda de inmediato lo pendiente (al cerrar o esconder la página)
function vaciarGuardado() {
    if (timerGuardado) {
        clearTimeout(timerGuardado);
        timerGuardado = null;
        escribirChats();
    }
}

function escribirChats() {
    if (!guardadoActivo) return;

    // Los chats vacíos no se guardan
    let chats = listaChats
        .filter(c => c.historial.length > 0)
        .slice(0, MAX_CHATS_GUARDADOS)
        .map(c => ({
            id: c.id,
            titulo: c.titulo,
            favorito: !!c.favorito,
            tituloManual: !!c.tituloManual,
            historial: c.historial.map(m => ({ role: m.role, content: m.content }))
        }));

    let json = JSON.stringify({ version: 1, chats });
    // Si no cabe, se descartan primero los chats más antiguos que no sean favoritos
    let descartados = 0;
    while (json.length > MAX_CARACTERES_GUARDADOS && chats.length > 1) {
        let i = -1;
        for (let k = chats.length - 1; k >= 0; k--) { if (!chats[k].favorito) { i = k; break; } }
        if (i === -1) break;
        chats.splice(i, 1);
        descartados++;
        json = JSON.stringify({ version: 1, chats });
    }

    try {
        localStorage.setItem(CLAVE_CHATS, json);
        if (descartados > 0 && !avisoCuotaMostrado) {
            avisoCuotaMostrado = true;
            mostrarAviso('El espacio para guardar se llenó: las conversaciones más antiguas (sin favorito) dejaron de guardarse.');
        }
    } catch {
        if (!avisoCuotaMostrado) {
            avisoCuotaMostrado = true;
            mostrarAviso('No pude guardar tus conversaciones en este dispositivo (sin espacio o bloqueado por el navegador).');
        }
    }
}

// Lo guardado se trata como "dato no confiable": se valida todo antes de usarlo
function restaurarChats() {
    if (!guardadoActivo) return;
    try {
        const crudo = localStorage.getItem(CLAVE_CHATS);
        if (!crudo) return;
        const datos = JSON.parse(crudo);
        if (!datos || datos.version !== 1 || !Array.isArray(datos.chats)) return;

        const vistos = new Set();
        datos.chats.slice(0, MAX_CHATS_GUARDADOS).forEach(c => {
            if (!c || typeof c.id !== 'string' || !c.id || vistos.has(c.id)) return;
            const historial = Array.isArray(c.historial)
                ? c.historial
                    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.length > 0)
                    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CARACTERES_MENSAJE) }))
                : [];
            if (historial.length === 0) return;
            vistos.add(c.id);
            listaChats.push({
                id: c.id.slice(0, 60),
                titulo: typeof c.titulo === 'string' && c.titulo.trim() ? c.titulo.trim().slice(0, 120) : 'Conversación',
                historial,
                favorito: c.favorito === true,
                tituloManual: c.tituloManual === true
            });
        });
    } catch { /* datos dañados: se ignoran y se empieza limpio */ }
}

/* ---------- Pedir permiso ---------- */
function ofrecerGuardado() {
    if (guardadoActivo || leerLocal(CLAVE_PERMISO, '') !== '') return;
    setTimeout(mostrarOfertaGuardado, 1500);        // después de que Kumi termine de "escribir"
}

function mostrarOfertaGuardado() {
    if (llamada) return;                            // nunca se interrumpe una llamada
    if (guardadoActivo || leerLocal(CLAVE_PERMISO, '') !== '' || byId('save-offer')) return;
    if (escrituraActiva) { setTimeout(mostrarOfertaGuardado, 500); return; }
    const chatObj = listaChats.find(c => c.id === chatActualId);
    if (!chatObj || chatObj.historial.length === 0) return;

    const tarjeta = document.createElement('div');
    tarjeta.id = 'save-offer';
    tarjeta.className = 'save-offer';
    tarjeta.setAttribute('role', 'group');
    tarjeta.setAttribute('aria-label', 'Guardar conversaciones');

    const titulo = document.createElement('div');
    titulo.className = 'save-offer-title';
    const icono = document.createElement('i');
    icono.className = 'fa-solid fa-lock';
    const tt = document.createElement('span');
    tt.textContent = '¿Guardar tus conversaciones en este dispositivo?';
    titulo.append(icono, tt);

    const texto = document.createElement('p');
    texto.className = 'save-offer-text';
    texto.textContent = 'Así podrás volver a ellas cuando quieras. Se guardan solo en este navegador, no en nuestros servidores. ' +
        'Si compartes este dispositivo con otras personas, quizá prefieras no guardarlas. Puedes cambiarlo cuando quieras en Ajustes › Privacidad.';

    const acciones = document.createElement('div');
    acciones.className = 'save-offer-actions';
    const no = document.createElement('button');
    no.type = 'button'; no.className = 'offer-btn'; no.textContent = 'Ahora no';
    no.addEventListener('click', () => decidirGuardado(false));
    const si = document.createElement('button');
    si.type = 'button'; si.className = 'offer-btn primary'; si.textContent = 'Guardar';
    si.addEventListener('click', () => decidirGuardado(true));
    acciones.append(no, si);

    tarjeta.append(titulo, texto, acciones);
    const cont = byId('session-container');
    cont.appendChild(tarjeta);
    cont.scrollTop = cont.scrollHeight;
}

function quitarOfertaGuardado() {
    const t = byId('save-offer');
    if (!t) return;
    t.classList.add('saliendo');
    setTimeout(() => t.remove(), 320);
}

function decidirGuardado(guardar) {
    quitarOfertaGuardado();
    if (guardar) activarGuardado();
    else {
        guardarLocal(CLAVE_PERMISO, 'no');
        mostrarAviso('De acuerdo: no se guardará nada. Puedes cambiarlo en Ajustes › Privacidad.');
    }
}

function activarGuardado() {
    guardarLocal(CLAVE_PERMISO, 'si');
    guardadoActivo = true;
    avisoCuotaMostrado = false;
    quitarOfertaGuardado();
    escribirChats();                                // lo que ya hay en pantalla se guarda ahora mismo
    actualizarPanelPrivacidad();
    mostrarAviso('Listo: tus conversaciones se guardarán en este dispositivo.');
}

function desactivarGuardado() {
    guardarLocal(CLAVE_PERMISO, 'no');
    guardadoActivo = false;
    clearTimeout(timerGuardado);
    timerGuardado = null;
    borrarLocal(CLAVE_CHATS);
    actualizarPanelPrivacidad();
    mostrarAviso('Dejé de guardar y borré lo que había guardado en este dispositivo.');
}

function cancelarDesactivarGuardado() {
    byId('save-confirm').hidden = true;
    byId('save-toggle').checked = true;
}

/* ---------- Borrar todo (con doble pulsación) ---------- */
let confirmandoBorrado = false;
let timerBorrado = null;

function reiniciarBotonBorrar() {
    confirmandoBorrado = false;
    clearTimeout(timerBorrado);
    const b = byId('btn-borrar-todo');
    b.classList.remove('confirmando');
    b.querySelector('span').textContent = 'Borrar todas las conversaciones';
}

function pedirBorrarTodo() {
    const b = byId('btn-borrar-todo');
    if (!confirmandoBorrado) {
        confirmandoBorrado = true;
        b.classList.add('confirmando');
        b.querySelector('span').textContent = 'Toca otra vez para confirmar';
        timerBorrado = setTimeout(reiniciarBotonBorrar, 4000);
        return;
    }
    reiniciarBotonBorrar();
    borrarTodasLasConversaciones();
}

function borrarTodasLasConversaciones() {
    detenerVoz();
    if (escrituraActiva) { escrituraActiva.cancelar(); escrituraActiva = null; }
    clearTimeout(timerGuardado);
    timerGuardado = null;
    listaChats = [];
    chatActualId = null;
    editingChatId = null;
    openContextMenuChatId = null;
    borrarLocal(CLAVE_CHATS);
    crearNuevoChat();
    actualizarPanelPrivacidad();
    mostrarAviso('Listo: borré todas tus conversaciones de este dispositivo.');
}

/* ---------- Ajustes › Privacidad y pestañas ---------- */
function actualizarPanelPrivacidad() {
    byId('save-toggle').checked = guardadoActivo;
    byId('save-confirm').hidden = true;
    byId('save-state-text').textContent = guardadoActivo
        ? 'Activado: tus conversaciones se guardan en este dispositivo.'
        : 'Desactivado: no se guarda nada y el historial se pierde al cerrar o recargar la página.';
    const n = contarGuardadas();
    byId('save-count').textContent = !guardadoActivo ? ''
        : n === 0 ? 'Todavía no hay conversaciones guardadas.'
        : n + (n === 1 ? ' conversación guardada en este dispositivo.' : ' conversaciones guardadas en este dispositivo.');
    reiniciarBotonBorrar();
}

const PESTANAS_AJUSTES = ['voz', 'privacidad'];

function seleccionarPestanaAjustes(nombre) {
    PESTANAS_AJUSTES.forEach(n => {
        const activa = n === nombre;
        const tab = byId('tab-' + n);
        tab.setAttribute('aria-selected', String(activa));
        tab.tabIndex = activa ? 0 : -1;
        byId('panel-' + n).hidden = !activa;
    });
    if (nombre === 'privacidad') actualizarPanelPrivacidad();
}

window.addEventListener('DOMContentLoaded', () => {
    PESTANAS_AJUSTES.forEach(n => byId('tab-' + n).addEventListener('click', () => seleccionarPestanaAjustes(n)));
    byId('tab-voz').parentElement.addEventListener('keydown', e => {
        const teclas = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
        const actual = PESTANAS_AJUSTES.findIndex(n => byId('tab-' + n).getAttribute('aria-selected') === 'true');
        let destino = null;
        if (e.key in teclas) destino = (actual + teclas[e.key] + PESTANAS_AJUSTES.length) % PESTANAS_AJUSTES.length;
        else if (e.key === 'Home') destino = 0;
        else if (e.key === 'End') destino = PESTANAS_AJUSTES.length - 1;
        if (destino === null) return;
        e.preventDefault();
        seleccionarPestanaAjustes(PESTANAS_AJUSTES[destino]);
        byId('tab-' + PESTANAS_AJUSTES[destino]).focus();
    });

    byId('save-toggle').addEventListener('change', e => {
        if (e.target.checked) { activarGuardado(); return; }
        // Al desactivar se borra lo guardado: antes se pide confirmación si hay algo guardado
        const hayAlgo = contarGuardadas() > 0 || !!leerLocal(CLAVE_CHATS, '');
        if (hayAlgo) { e.target.checked = true; byId('save-confirm').hidden = false; }
        else desactivarGuardado();
    });

    window.addEventListener('pagehide', vaciarGuardado);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') vaciarGuardado(); });
});
