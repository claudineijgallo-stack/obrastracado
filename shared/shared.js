const CONFIG = {
  apiUrl: localStorage.getItem('obras.apiUrl') || '',
  token: localStorage.getItem('obras.token') || ''
};

const el = (id) => document.getElementById(id);

function showToast(msg) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

async function api(action, params = {}, method = 'GET') {
  if (!CONFIG.apiUrl) {
    showToast('Configure a URL do Apps Script primeiro (⚙ Configuração).');
    throw new Error('API não configurada');
  }

  let response;
  if (method === 'GET') {
    const qs = new URLSearchParams({ action, token: CONFIG.token, _: Date.now(), ...params });
    response = await fetch(`${CONFIG.apiUrl}?${qs.toString()}`, { cache: 'no-store' });
  } else {
    response = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: CONFIG.token, ...params })
    });
  }

  const data = await response.json();
  if (data.error) {
    showToast('Erro: ' + data.error);
    throw new Error(data.error);
  }
  return data;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function normalizePhone(contato) {
  const digits = String(contato || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 11) return '55' + digits;
  return digits;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Liga a caixa de Configuração presente em toda página.
// onSaved é chamado depois que a URL/token são salvos (normalmente recarrega a tela atual).
function setupConfigPanel(onSaved) {
  el('btn-config').addEventListener('click', () => {
    el('config-panel').classList.toggle('hidden');
  });

  el('cfg-url').value = CONFIG.apiUrl;
  el('cfg-token').value = CONFIG.token;

  el('btn-salvar-config').addEventListener('click', () => {
    CONFIG.apiUrl = el('cfg-url').value.trim();
    CONFIG.token = el('cfg-token').value.trim();
    localStorage.setItem('obras.apiUrl', CONFIG.apiUrl);
    localStorage.setItem('obras.token', CONFIG.token);
    el('config-status').textContent = 'Configuração salva.';
    if (onSaved) onSaved();
  });

  if (!CONFIG.apiUrl) {
    el('config-panel').classList.remove('hidden');
  }
}
