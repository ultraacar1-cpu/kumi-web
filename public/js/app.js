const AYUDA_TEXTO = 'Si necesitas hablar con alguien ahora, llama a la Línea 106 (gratuita, 24 horas). Si estás en peligro inmediato, llama al 123.';

let listaChats = [];
let chatActualId = null;
let isProcessing = false;
let editingChatId = null;
let openContextMenuChatId = null;

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

    const sidebarCollapsed = leerLocal('kumi_sidebar_collapsed', 'false') === 'true';
    if (sidebarCollapsed && window.innerWidth > 768) {
        document.getElementById('sidebar').classList.add('collapsed');
    }

    crearNuevoChat();

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
    const newTheme = document.body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', newTheme);
    guardarLocal('kumi_theme', newTheme);
    actualizarIconoTema(newTheme);
}

function actualizarIconoTema(theme) {
    document.getElementById('theme-icon').className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

function toggleDesktopSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    guardarLocal('kumi_sidebar_collapsed', sidebar.classList.contains('collapsed'));
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

    const container = document.getElementById('session-container');
    container.innerHTML = '';

    chatObj.historial.forEach(msg => {
        agregarBloqueUI(msg.role === 'user' ? 'user' : 'kumi', msg.content, false);
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
    } else {
        mainApp.classList.remove('state-chat');
        mainApp.classList.add('state-welcome');
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
    if (input) input.placeholder = 'Escribe aquí lo que estás sintiendo...';
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
function agregarBloqueUI(autor, texto, scroll = true) {
    const container = document.getElementById('session-container');
    const isUser = autor === 'user';

    const block = document.createElement('div');
    block.className = `session-block ${isUser ? 'user-entry' : 'kumi-entry'}`;

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

    // Se escapa todo el HTML y solo se permite **negrita**.
    const body = document.createElement('div');
    body.className = 'block-body';
    body.innerHTML = texto
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');

    block.appendChild(header);
    block.appendChild(body);
    container.appendChild(block);

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
            if (chatActualId === chatObj.id) agregarBloqueUI('kumi', data.reply);
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
