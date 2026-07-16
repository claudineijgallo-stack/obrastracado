async function carregarObras() {
  const obras = await api('listObras');
  const lista = el('obras-lista');
  lista.innerHTML = '';
  if (obras.length === 0) {
    lista.innerHTML = '<p class="subtitle">Nenhuma obra cadastrada ainda.</p>';
    return;
  }
  obras.forEach((obra) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h4>${escapeHtml(obra.nome)}</h4><p>${escapeHtml(obra.cliente || 'Sem cliente')}</p>`;
    card.addEventListener('click', () => {
      location.href = '../obra/index.html?id=' + encodeURIComponent(obra.id);
    });
    lista.appendChild(card);
  });
}

el('btn-nova-obra').addEventListener('click', () => {
  el('modal-nova-obra').classList.remove('hidden');
});
el('btn-cancelar-obra').addEventListener('click', () => {
  el('modal-nova-obra').classList.add('hidden');
});

el('form-obra').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  await api('createObra', {
    nome: fd.get('nome'),
    cliente: fd.get('cliente'),
    cno: fd.get('cno'),
    observacoes: fd.get('observacoes')
  }, 'POST');
  e.target.reset();
  el('modal-nova-obra').classList.add('hidden');
  showToast('Obra criada.');
  carregarObras();
});

setupConfigPanel(carregarObras);
if (CONFIG.apiUrl) carregarObras();
