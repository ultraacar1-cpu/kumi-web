const AYUDA_TEXTO = 'Si necesitas hablar con alguien ahora, llama a la Línea 106 (gratuita, 24 horas). Si estás en peligro inmediato, llama al 123.';

let listaChats = [];
let chatActualId = null;
let isProcessing = false;
let editingChatId = null;

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

/* ---------- Chats ---------- */
function crearNuevoChat() {
    if (chatActualId) {
        const chatActual = listaChats.find(c => c.id === chatActualId);
        if (chatActual && chatActual.historial.length === 0) {
            cambiarChat(chatActualId);
            return;
        }
    }

    const nuevoId = 'chat_' + Date.now();
    listaChats.unshift({ id: nuevoId, titulo: 'Nueva conversación', historial: [] });
    cambiarChat(nuevoId);
}

function cambiarChat(id) {
    chatActualId = id;
    editingChatId = null;
    const chatObj = listaChats.find(c => c.id === id);
    if (!chatObj) return;

    const container = document.getElementById('session-container');
    container.innerHTML = '';

    chatObj.historial.forEach(msg => {
        agregarBloqueUI(msg.role === 'user' ? 'user' : 'kumi', msg.content, false);
    });

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

function activarEdicionTitulo(e, id) {
    e.stopPropagation();
    editingChatId = id;
    renderizarListaChats();
}

function guardarNuevoTitulo(id, nuevoTexto) {
    const chatObj = listaChats.find(c => c.id === id);
    if (chatObj && nuevoTexto.trim() !== '') {
        chatObj.titulo = nuevoTexto.trim();
    }
    editingChatId = null;
    renderizarListaChats();
}

// Los títulos vienen de lo que escribe el usuario, así que se insertan con textContent (nunca innerHTML).
function renderizarListaChats() {
    const historyList = document.getElementById('chat-history-list');
    historyList.innerHTML = '';

    const visibles = listaChats.filter(chat => chat.historial.length > 0 || chat.id === chatActualId);

    visibles.forEach(chat => {
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

            const btnEditar = document.createElement('button');
            btnEditar.className = 'btn-edit-title';
            btnEditar.title = 'Editar nombre';
            btnEditar.setAttribute('aria-label', 'Editar nombre de la conversación');
            btnEditar.innerHTML = '<i class="fa-solid fa-pen"></i>';
            btnEditar.addEventListener('click', e => activarEdicionTitulo(e, chat.id));

            item.append(main, btnEditar);
            item.onclick = () => {
                cambiarChat(chat.id);
                toggleSidebarIfMobile();
            };
        }

        historyList.appendChild(item);
        if (inputEdit) {
            inputEdit.focus();
            inputEdit.select();
        }
    });
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

// Los errores solo se muestran: NO se guardan en el historial, para no contaminar lo que se envía a la IA.
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

    // Se valida ANTES de marcar "procesando", para no dejar el chat bloqueado si algo falla.
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
            // Si la persona cambió de chat mientras esperaba, la respuesta queda guardada en su chat original.
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
