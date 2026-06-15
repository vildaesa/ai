const WORKER_URL = "https://ai-coder.vildaesa.workers.dev";

let isLoading = false;

const messagesContainer = document.getElementById('chatMessages');
const messageInput = document.querySelector('#messageInput');
const sendBtn = document.querySelector('#sendButton');
const toast = document.getElementById('infoToast');

// Konfigurasi marked renderer custom untuk code block premium
const renderer = new marked.Renderer();
renderer.code = function(codeOrToken, language) {
  let code = '';
  let validLang = 'code';

  if (typeof codeOrToken === 'object' && codeOrToken !== null) {
    code = codeOrToken.text || '';
    validLang = codeOrToken.lang || 'code';
  } else {
    code = codeOrToken || '';
    validLang = language || 'code';
  }

  const escapedCode = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `
    <div class="code-block-wrapper">
      <div class="code-header">
        <span>${validLang.toUpperCase()}</span>
        <button class="copy-btn" onclick="copyCodeBlock(this)">
          <i data-lucide="copy"></i>
        </button>
      </div>
      <pre><code class="language-${validLang}">${escapedCode}</code></pre>
    </div>
  `;
};
marked.setOptions({ renderer: renderer });

function renderMarkdown(text) {
  if (!text) return '';
  if (typeof marked !== 'undefined') {
    const rawHtml = marked.parse(text);
    return DOMPurify.sanitize(rawHtml);
  }
  return DOMPurify.sanitize(text);
}

function getShortModelName(modelPath) {
  if (!modelPath) return '';
  const lower = modelPath.toLowerCase();
  if (lower.includes('qwen') && lower.includes('coder')) {
    return 'qwen-coder';
  }
  if (lower.includes('mistral') && lower.includes('small')) {
    return 'mistral-small';
  }
  return modelPath.split('/').pop();
}

function secureCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    showToast('Teks berhasil disalin ke clipboard!');
  } catch (err) {
    showToast('Gagal menyalin teks.');
  }
  document.body.removeChild(textarea);
}

window.copyCodeBlock = function(buttonElement) {
  const preElement = buttonElement.closest('.code-block-wrapper').querySelector('pre');
  if (preElement) {
    secureCopy(preElement.innerText);

    const textSpan = buttonElement.querySelector('span');
    buttonElement.style.color = '#a3e635';

    if (textSpan) {
      textSpan.innerText = 'Tersalin!';
    }

    setTimeout(() => {
      if (textSpan) {
        textSpan.innerText = 'Salin';
      }
      buttonElement.style.color = '';
    }, 2000);
  }
};

window.copyTextMessage = function(buttonElement) {
  const messageBody = buttonElement.closest('.message-content-wrapper').querySelector('.message-body');
  if (messageBody) {
    secureCopy(messageBody.innerText);
  }
};

function showToast(message) {
  if (toast) {
    toast.message = message;
    toast.present();
  }
}

function addMessage(text, isSent, extra = null) {
  const rowDiv = document.createElement('div');
  rowDiv.classList.add('message-row');
  rowDiv.classList.add(isSent ? 'user-row' : 'ai-row');

  const avatarDiv = document.createElement('div');
  avatarDiv.classList.add('avatar');
  avatarDiv.classList.add(isSent ? 'avatar-user' : 'avatar-ai');
  avatarDiv.innerText = isSent ? 'UD' : 'AI';
  rowDiv.appendChild(avatarDiv);

  const wrapper = document.createElement('div');
  wrapper.classList.add('message-content-wrapper');

  const header = document.createElement('div');
  header.classList.add('message-header');

  const name = document.createElement('span');
  name.classList.add('sender-name');
  name.innerText = isSent ? 'Anda' : 'Asisten AI';
  header.appendChild(name);

  if (!isSent && extra && (extra.intent || extra.model)) {
    const badge = document.createElement('span');
    badge.classList.add('meta-badge');

    const shortModel = getShortModelName(extra.model);
    badge.innerText = `${extra.intent ? `🎯 ${extra.intent}` : ''} ${shortModel ? `🧠 ${shortModel}` : ''}`;
    header.appendChild(badge);
  }
  wrapper.appendChild(header);

  const body = document.createElement('div');
  body.classList.add('message-body');
  if (!isSent) {
    body.innerHTML = renderMarkdown(text);
  } else {
    body.innerText = text;
  }
  wrapper.appendChild(body);

  if (!isSent && extra && (extra.intent === 'code' || extra.intent === 'ui')) {
    const actions = document.createElement('div');
    actions.classList.add('message-actions');
    actions.innerHTML = `
      <button class="text-action-btn" onclick="copyTextMessage(this)">
        <i data-lucide="copy"></i> Salin Semua Teks
      </button>
    `;
    wrapper.appendChild(actions);
  }

  rowDiv.appendChild(wrapper);
  messagesContainer.appendChild(rowDiv);

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTypingIndicator() {
  const rowDiv = document.createElement('div');
  rowDiv.id = 'typingIndicator';
  rowDiv.classList.add('message-row', 'ai-row');
  rowDiv.innerHTML = `
    <div class="avatar avatar-ai">AI</div>
    <div class="message-content-wrapper">
      <div class="message-header">
        <span class="sender-name">Asisten AI</span>
      </div>
      <div class="loading-container">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    </div>
  `;
  messagesContainer.appendChild(rowDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function hideTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) indicator.remove();
}

async function sendToAI(userMessage) {
  if (!userMessage.trim()) return;
  if (isLoading) return;

  addMessage(userMessage, true);
  messageInput.value = '';
  messageInput.setAttribute('value', '');

  isLoading = true;
  if (sendBtn) sendBtn.disabled = true;
  showTypingIndicator();

  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    const aiText = data.response || '(Respon kosong)';
    const extraInfo = {
      intent: data.intent,
      model: data.model
    };

    hideTypingIndicator();
    addMessage(aiText, false, extraInfo);
  } catch (err) {
    console.error(err);
    hideTypingIndicator();
    addMessage(`❌ Gagal terhubung ke AI (${err.message}). Periksa URL Worker Anda di variabel WORKER_URL.`, false);
  } finally {
    isLoading = false;
    if (sendBtn) sendBtn.disabled = false;
    if (messageInput && typeof messageInput.setFocus === 'function') {
      messageInput.setFocus();
    }
  }
}

if (sendBtn) {
  sendBtn.addEventListener('click', () => {
    const text = messageInput.value ? messageInput.value.trim() : '';
    if (text) sendToAI(text);
  });
}

if (messageInput) {
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (sendBtn) sendBtn.click();
    }
  });
}

// Inisialisasi ikon Lucide pertama kali jika library siap
if (typeof lucide !== 'undefined') {
  lucide.createIcons();
}

setTimeout(() => {
  if (messageInput && typeof messageInput.setFocus === 'function') {
    messageInput.setFocus();
  }
}, 100);

document.getElementById('profile-button')?.addEventListener('click', () => {
  showToast('User Profile (Sedang dikerjakan)');
});
document.getElementById('menu-button')?.addEventListener('click', () => {
  showToast('Pengaturan Asisten (Sedang dikerjakan)');
});
