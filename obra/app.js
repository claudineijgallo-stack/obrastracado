const currentObraId = new URLSearchParams(location.search).get('id');
let currentObraNome = '';

function buildMapsLink(end) {
  if (end.linkLocalizacao) return end.linkLocalizacao;
  const partes = [end.endereco, end.numero, end.bairro, end.cidade, end.uf, end.cep].filter(Boolean);
  if (partes.length === 0) return '';
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(partes.join(', '));
}

async function abrirObra() {
  if (!currentObraId) {
    showToast('Obra não especificada.');
    return;
  }

  const obra = await api('getObra', { id: currentObraId });
  currentObraNome = obra.nome;
  el('detalhe-nome').textContent = obra.nome;
  el('detalhe-cliente').textContent = obra.cliente || '';
  el('detalhe-cno').textContent = obra.cno ? `CNO: ${obra.cno}` : '';
  el('detalhe-link').href = obra.url;

  const lista = el('enderecos-lista');
  lista.innerHTML = '';
  if (obra.enderecos.length === 0) {
    lista.innerHTML = '<p class="subtitle">Nenhum endereço cadastrado ainda.</p>';
  } else {
    obra.enderecos.forEach((end) => {
      const mapsLink = buildMapsLink(end);
      const card = document.createElement('div');
      card.className = 'card card-endereco';
      card.innerHTML = `
        <div>
          <h4>${escapeHtml(end.nomeLocal || end.endereco)}</h4>
          <p>${escapeHtml(end.endereco)}, ${escapeHtml(end.numero || 's/n')}</p>
          <p>${escapeHtml(end.bairro || '')} - ${escapeHtml(end.cidade || '')}/${escapeHtml(end.uf || '')}</p>
          <p>${escapeHtml(end.cep || '')} ${end.referencia ? '- ' + escapeHtml(end.referencia) : ''}</p>
          ${mapsLink ? '<p class="link-row"><a href="' + escapeHtml(mapsLink) + '" target="_blank">Ver localização ↗</a></p>' : ''}
        </div>
        <div class="card-endereco-actions">
          ${mapsLink ? '<button class="btn btn-ghost btn-copiar" data-link="' + escapeHtml(mapsLink) + '">Copiar link</button>' : ''}
          <button class="btn btn-danger btn-excluir" data-id="${end.id}">Excluir</button>
        </div>
      `;
      card.querySelector('.btn-excluir').addEventListener('click', () => excluirEndereco(end.id));
      const btnCopiar = card.querySelector('.btn-copiar');
      if (btnCopiar) {
        btnCopiar.addEventListener('click', () => {
          navigator.clipboard.writeText(btnCopiar.dataset.link)
            .then(() => showToast('Link copiado!'))
            .catch(() => showToast('Não foi possível copiar o link.'));
        });
      }
      lista.appendChild(card);
    });
  }

  renderArquivos(obra.arquivos || []);
  renderFornecedoresObra(obra.fornecedores || []);
  renderResponsaveis(obra.responsaveis || []);
}

function setupTabs() {
  const btns = document.querySelectorAll('.tab-btn');
  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      btns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach((panel) => {
        panel.classList.toggle('hidden', panel.id !== 'tab-' + btn.dataset.tab);
      });
    });
  });
}

function renderArquivos(arquivos) {
  const lista = el('arquivos-lista');
  lista.innerHTML = '';
  if (arquivos.length === 0) {
    lista.innerHTML = '<p class="subtitle">Nenhum arquivo enviado ainda.</p>';
    return;
  }
  arquivos.forEach((arq) => {
    const card = document.createElement('div');
    card.className = 'card card-arquivo';
    card.innerHTML = `
      <span class="arquivo-nome">${escapeHtml(arq.nome)}</span>
      <span class="arquivo-meta">${escapeHtml(arq.mimeType)} · ${formatBytes(arq.tamanho)}</span>
      <div class="card-arquivo-actions">
        <a class="btn btn-ghost" href="${escapeHtml(arq.url)}" target="_blank">Abrir</a>
        <a class="btn btn-ghost" href="https://drive.google.com/uc?export=download&id=${arq.id}" target="_blank">Baixar</a>
        <button class="btn btn-ghost btn-renomear-arquivo" data-id="${arq.id}">Renomear</button>
        <button class="btn btn-danger btn-excluir-arquivo" data-id="${arq.id}">Excluir</button>
      </div>
    `;
    card.querySelector('.btn-excluir-arquivo').addEventListener('click', () => excluirArquivo(arq.id));
    card.querySelector('.btn-renomear-arquivo').addEventListener('click', () => renomearArquivo(arq.id, arq.nome));
    lista.appendChild(card);
  });
}

async function excluirArquivo(fileId) {
  await api('deleteArquivo', { fileId }, 'POST');
  showToast('Arquivo excluído.');
  abrirObra();
}

async function renomearArquivo(fileId, nomeAtual) {
  const novoNome = prompt('Novo nome do arquivo:', nomeAtual);
  if (!novoNome || novoNome === nomeAtual) return;
  await api('renameArquivo', { fileId, novoNome }, 'POST');
  showToast('Arquivo renomeado.');
  abrirObra();
}

async function excluirEndereco(enderecoId) {
  await api('deleteEndereco', { obraId: currentObraId, enderecoId }, 'POST');
  showToast('Endereço excluído.');
  abrirObra();
}

let fornecedoresObraAtual = [];

function renderFornecedoresObra(fornecedores) {
  fornecedoresObraAtual = fornecedores;
  aplicarFiltroFornecedores();
}

function aplicarFiltroFornecedores() {
  const nomeFiltro = el('filtro-fornecedor-nome').value.trim().toLowerCase();
  const categoriaFiltro = el('filtro-fornecedor-categoria').value.trim().toLowerCase();
  const servicoFiltro = el('filtro-fornecedor-servico').value.trim().toLowerCase();

  const filtrados = fornecedoresObraAtual.filter((f) => {
    const nome = (f.nome || '').toLowerCase();
    const categoria = (f.categoria || '').toLowerCase();
    const servico = (f.servicoInsumos || '').toLowerCase();
    return nome.includes(nomeFiltro) && categoria.includes(categoriaFiltro) && servico.includes(servicoFiltro);
  });

  const lista = el('fornecedores-obra-lista');
  lista.innerHTML = '';
  if (fornecedoresObraAtual.length === 0) {
    lista.innerHTML = '<p class="subtitle">Nenhum fornecedor cadastrado para esta obra ainda.</p>';
    return;
  }
  if (filtrados.length === 0) {
    lista.innerHTML = '<p class="subtitle">Nenhum fornecedor encontrado com esse filtro.</p>';
    return;
  }
  filtrados.forEach((f) => {
    const row = document.createElement('div');
    row.className = 'list-row';
    const phone = normalizePhone(f.contato);
    row.innerHTML = `
      <span class="list-col list-col-nome" title="${escapeHtml(f.nome)}">${escapeHtml(f.nome)}</span>
      <span class="list-col" title="${escapeHtml(f.categoria || '')}">${escapeHtml(f.categoria || '')}</span>
      <span class="list-col" title="${escapeHtml(f.servicoInsumos || '')}">${escapeHtml(f.servicoInsumos || '')}</span>
      <span class="list-col" title="${escapeHtml(f.cidade || '')}">${escapeHtml(f.cidade || '')}</span>
      <span class="list-col" title="${escapeHtml(f.contato || '')}">${escapeHtml(f.contato || '')}</span>
      <div class="list-row-actions">
        ${phone ? `<a class="btn btn-whatsapp" href="https://wa.me/${phone}" target="_blank">WhatsApp</a>` : ''}
        <button class="btn btn-danger btn-excluir-fornecedor-obra" data-id="${f.id}">Excluir</button>
      </div>
    `;
    row.querySelector('.btn-excluir-fornecedor-obra').addEventListener('click', () => excluirFornecedorObra(f.id));
    lista.appendChild(row);
  });
}

async function excluirFornecedorObra(fornecedorId) {
  await api('deleteFornecedorObra', { obraId: currentObraId, fornecedorId }, 'POST');
  showToast('Fornecedor excluído.');
  abrirObra();
}

function renderResponsaveis(responsaveis) {
  const lista = el('responsaveis-lista');
  lista.innerHTML = '';
  if (responsaveis.length === 0) {
    lista.innerHTML = '<p class="subtitle">Nenhum responsável cadastrado ainda.</p>';
    return;
  }
  responsaveis.forEach((r) => {
    const card = document.createElement('div');
    card.className = 'card card-responsavel';
    const phone = normalizePhone(r.contato);
    card.innerHTML = `
      <h4>${escapeHtml(r.nome)}</h4>
      <p>${escapeHtml(r.funcao || '')}</p>
      <p>${escapeHtml(r.contato || '')}</p>
      <div class="card-responsavel-actions">
        ${phone ? `<a class="btn btn-whatsapp" href="https://wa.me/${phone}" target="_blank">WhatsApp</a>` : ''}
        <button class="btn btn-danger btn-excluir-responsavel" data-id="${r.id}">Excluir</button>
      </div>
    `;
    card.querySelector('.btn-excluir-responsavel').addEventListener('click', () => excluirResponsavel(r.id));
    lista.appendChild(card);
  });
}

async function excluirResponsavel(responsavelId) {
  await api('deleteResponsavel', { obraId: currentObraId, responsavelId }, 'POST');
  showToast('Responsável excluído.');
  abrirObra();
}

el('form-endereco').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const endereco = Object.fromEntries(fd.entries());
  await api('addEndereco', { obraId: currentObraId, endereco }, 'POST');
  e.target.reset();
  showToast('Endereço adicionado.');
  abrirObra();
});

el('form-arquivo').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = el('input-arquivo');
  const files = Array.from(input.files);
  if (files.length === 0) return;

  for (const file of files) {
    const base64Data = await fileToBase64(file);
    await api('addArquivo', {
      obraId: currentObraId,
      nomeArquivo: file.name,
      mimeType: file.type || 'application/octet-stream',
      base64Data
    }, 'POST');
  }
  input.value = '';
  showToast('Arquivo(s) enviado(s).');
  abrirObra();
});

el('btn-novo-fornecedor-obra').addEventListener('click', () => {
  el('modal-novo-fornecedor').classList.remove('hidden');
});
el('btn-cancelar-fornecedor-obra').addEventListener('click', () => {
  el('modal-novo-fornecedor').classList.add('hidden');
});

el('form-novo-fornecedor').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  await api('addFornecedorObra', {
    obraId: currentObraId,
    nome: fd.get('nome'),
    contato: fd.get('contato'),
    categoria: fd.get('categoria'),
    servicoInsumos: fd.get('servicoInsumos'),
    cidade: fd.get('cidade')
  }, 'POST');
  e.target.reset();
  el('modal-novo-fornecedor').classList.add('hidden');
  showToast('Fornecedor cadastrado.');
  abrirObra();
});

el('form-responsavel').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  await api('addResponsavel', {
    obraId: currentObraId,
    nome: fd.get('nome'),
    funcao: fd.get('funcao'),
    contato: fd.get('contato')
  }, 'POST');
  e.target.reset();
  showToast('Responsável adicionado.');
  abrirObra();
});

el('btn-excluir-obra').addEventListener('click', async () => {
  const confirmado = confirm(
    `Excluir a obra "${currentObraNome}"?\n\n` +
    'Isso vai enviar para a lixeira do Google Drive todos os dados dela: ' +
    'endereços, documentos, fornecedores e responsáveis (a planilha e a pasta inteira da obra).'
  );
  if (!confirmado) return;

  await api('deleteObra', { obraId: currentObraId }, 'POST');
  showToast('Obra excluída.');
  location.href = '../obras/index.html';
});

el('filtro-fornecedor-nome').addEventListener('input', aplicarFiltroFornecedores);
el('filtro-fornecedor-categoria').addEventListener('input', aplicarFiltroFornecedores);
el('filtro-fornecedor-servico').addEventListener('input', aplicarFiltroFornecedores);

setupTabs();
setupConfigPanel(abrirObra);
if (CONFIG.apiUrl) abrirObra();
