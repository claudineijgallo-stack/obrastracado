async function carregarFornecedores() {
  const fornecedores = await api('listFornecedores');
  const lista = el('fornecedores-lista');
  lista.innerHTML = '';
  if (fornecedores.length === 0) {
    lista.innerHTML = '<p class="subtitle">Nenhum fornecedor cadastrado ainda.</p>';
    return;
  }
  fornecedores.forEach((f) => {
    const card = document.createElement('div');
    card.className = 'card card-fornecedor';
    const phone = normalizePhone(f.contato);
    card.innerHTML = `
      <h4>${escapeHtml(f.nome)}</h4>
      <p>${escapeHtml(f.categoria || '')}</p>
      <p>${escapeHtml(f.produtoFornecido || '')}</p>
      <p>${escapeHtml(f.contato || '')}</p>
      <div class="card-fornecedor-actions">
        ${phone ? `<a class="btn btn-whatsapp" href="https://wa.me/${phone}" target="_blank">WhatsApp</a>` : ''}
        <button class="btn btn-danger btn-excluir-fornecedor" data-id="${f.id}">Excluir</button>
      </div>
    `;
    card.querySelector('.btn-excluir-fornecedor').addEventListener('click', () => excluirFornecedor(f.id));
    lista.appendChild(card);
  });
}

async function excluirFornecedor(fornecedorId) {
  await api('deleteFornecedor', { fornecedorId }, 'POST');
  showToast('Fornecedor excluído.');
  carregarFornecedores();
}

el('form-fornecedor').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  await api('createFornecedor', {
    nome: fd.get('nome'),
    contato: fd.get('contato'),
    categoria: fd.get('categoria'),
    produtoFornecido: fd.get('produtoFornecido')
  }, 'POST');
  e.target.reset();
  showToast('Fornecedor cadastrado.');
  carregarFornecedores();
});

setupConfigPanel(carregarFornecedores);
if (CONFIG.apiUrl) carregarFornecedores();
