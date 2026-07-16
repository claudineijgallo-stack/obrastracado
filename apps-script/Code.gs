/**
 * Backend (Google Apps Script) para o app de controle de Obras.
 * Estrutura no Drive:
 *   Obras/
 *     Indice_Obras (planilha índice)
 *     <Nome da Obra>/            <- 1 pasta por obra
 *       Obra - <Nome da Obra>    <- planilha da obra (Info + Enderecos)
 *       Arquivos/                <- biblioteca de PDFs/imagens da obra
 *
 * Depois de colar este código no editor do Apps Script:
 * 1. Defina um token em Configurações do projeto > Propriedades do script:
 *    chave = TOKEN, valor = uma senha qualquer (ex: "minha-senha-123").
 * 2. Implantar > Nova implantação > tipo "App da Web".
 *    - Executar como: Eu (sua conta)
 *    - Quem pode acessar: Qualquer pessoa
 * 3. Copie a URL do App da Web e cole em app.js (CONFIG.API_URL).
 */

const FOLDER_NAME = 'Obras';
const INDEX_FILE_NAME = 'Indice_Obras';
const ARQUIVOS_FOLDER_NAME = 'Arquivos';
const INDEX_HEADERS = ['id', 'nome', 'cliente', 'cno', 'spreadsheetId', 'folderId', 'arquivosFolderId', 'dataCriacao'];
const ENDERECOS_HEADERS = ['id', 'nomeLocal', 'endereco', 'numero', 'bairro', 'cidade', 'uf', 'cep', 'referencia', 'linkLocalizacao', 'dataCriacao'];
const FORNECEDORES_HEADERS = ['id', 'nome', 'contato', 'categoria', 'produtoFornecido'];
const FORNECEDORES_OBRA_HEADERS = ['id', 'nome', 'contato', 'categoria', 'servicoInsumos', 'cidade'];
const RESPONSAVEIS_HEADERS = ['id', 'nome', 'funcao', 'contato'];

function doGet(e) {
  try {
    checkToken_(e.parameter.token);
    const action = e.parameter.action;

    if (action === 'listObras') {
      return jsonOut_(listObras_());
    }
    if (action === 'getObra') {
      return jsonOut_(getObra_(e.parameter.id));
    }
    if (action === 'listFornecedores') {
      return jsonOut_(listFornecedores_());
    }
    return jsonOut_({ error: 'Ação desconhecida: ' + action });
  } catch (err) {
    return jsonOut_({ error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    checkToken_(body.token);
    const action = body.action;

    if (action === 'createObra') {
      return jsonOut_(createObra_(body.nome, body.cliente, body.cno, body.observacoes));
    }
    if (action === 'addEndereco') {
      return jsonOut_(addEndereco_(body.obraId, body.endereco));
    }
    if (action === 'deleteEndereco') {
      return jsonOut_(deleteEndereco_(body.obraId, body.enderecoId));
    }
    if (action === 'deleteObra') {
      return jsonOut_(deleteObra_(body.obraId));
    }
    if (action === 'addArquivo') {
      return jsonOut_(addArquivo_(body.obraId, body.nomeArquivo, body.mimeType, body.base64Data));
    }
    if (action === 'deleteArquivo') {
      return jsonOut_(deleteArquivo_(body.fileId));
    }
    if (action === 'renameArquivo') {
      return jsonOut_(renameArquivo_(body.fileId, body.novoNome));
    }
    if (action === 'createFornecedor') {
      return jsonOut_(createFornecedor_(body.nome, body.contato, body.categoria, body.produtoFornecido));
    }
    if (action === 'deleteFornecedor') {
      return jsonOut_(deleteFornecedor_(body.fornecedorId));
    }
    if (action === 'addFornecedorObra') {
      return jsonOut_(addFornecedorObra_(body.obraId, body.nome, body.contato, body.categoria, body.servicoInsumos, body.cidade));
    }
    if (action === 'deleteFornecedorObra') {
      return jsonOut_(deleteFornecedorObra_(body.obraId, body.fornecedorId));
    }
    if (action === 'addResponsavel') {
      return jsonOut_(addResponsavel_(body.obraId, body.nome, body.funcao, body.contato));
    }
    if (action === 'deleteResponsavel') {
      return jsonOut_(deleteResponsavel_(body.obraId, body.responsavelId));
    }
    return jsonOut_({ error: 'Ação desconhecida: ' + action });
  } catch (err) {
    return jsonOut_({ error: err.message });
  }
}

function checkToken_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (expected && token !== expected) {
    throw new Error('Token inválido');
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getFolder_() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(FOLDER_NAME);
}

function getIndexSpreadsheet_() {
  const folder = getFolder_();
  const files = folder.getFilesByName(INDEX_FILE_NAME);
  let ss;
  if (files.hasNext()) {
    ss = SpreadsheetApp.open(files.next());
  } else {
    ss = SpreadsheetApp.create(INDEX_FILE_NAME);
    moveFileToFolder_(ss.getId(), folder);
    ss.getSheets()[0].setName('Indice');
    ss.getSheets()[0].appendRow(INDEX_HEADERS);
  }
  return ss;
}

function getIndexSheet_() {
  return getIndexSpreadsheet_().getSheetByName('Indice');
}

function getFornecedoresSheet_() {
  const ss = getIndexSpreadsheet_();
  let sheet = ss.getSheetByName('Fornecedores');
  if (!sheet) {
    sheet = ss.insertSheet('Fornecedores');
    sheet.appendRow(FORNECEDORES_HEADERS);
  }
  return sheet;
}

function moveFileToFolder_(fileId, folder) {
  const file = DriveApp.getFileById(fileId);
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);
}

function listObras_() {
  const sheet = getIndexSheet_();
  const rows = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const [id, nome, cliente, cno] = rows[i];
    if (!id) continue;
    out.push({ id, nome, cliente, cno });
  }
  return out;
}

function findObraRow_(sheet, obraId) {
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === obraId) return { rowIndex: i + 1, data: rows[i] };
  }
  return null;
}

function getObraIndexData_(obraId) {
  const indexSheet = getIndexSheet_();
  const found = findObraRow_(indexSheet, obraId);
  if (!found) throw new Error('Obra não encontrada');
  return found.data;
}

function getOrCreateSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function createObra_(nome, cliente, cno, observacoes) {
  if (!nome) throw new Error('Nome da obra é obrigatório');

  const rootFolder = getFolder_();
  const indexSheet = getIndexSheet_();
  const id = Utilities.getUuid();
  const dataCriacao = new Date().toISOString();

  const obraFolder = rootFolder.createFolder(nome);
  const arquivosFolder = obraFolder.createFolder(ARQUIVOS_FOLDER_NAME);

  const ss = SpreadsheetApp.create('Obra - ' + nome);
  moveFileToFolder_(ss.getId(), obraFolder);

  const infoSheet = ss.getSheets()[0];
  infoSheet.setName('Info');
  infoSheet.appendRow(['campo', 'valor']);
  infoSheet.appendRow(['nome', nome]);
  infoSheet.appendRow(['cliente', cliente || '']);
  infoSheet.appendRow(['cno', cno || '']);
  infoSheet.appendRow(['dataCriacao', dataCriacao]);
  infoSheet.appendRow(['observacoes', observacoes || '']);

  const enderecosSheet = ss.insertSheet('Enderecos');
  enderecosSheet.appendRow(ENDERECOS_HEADERS);

  indexSheet.appendRow([
    id, nome, cliente || '', cno || '', ss.getId(),
    obraFolder.getId(), arquivosFolder.getId(), dataCriacao
  ]);

  return {
    id, nome, cliente, cno, spreadsheetId: ss.getId(),
    folderId: obraFolder.getId(), arquivosFolderId: arquivosFolder.getId(),
    dataCriacao, url: ss.getUrl()
  };
}

function getObra_(obraId) {
  const indexSheet = getIndexSheet_();
  const found = findObraRow_(indexSheet, obraId);
  if (!found) throw new Error('Obra não encontrada');

  const [id, nome, cliente, cno, spreadsheetId, folderId, arquivosFolderId, dataCriacao] = found.data;
  const ss = SpreadsheetApp.openById(spreadsheetId);

  const infoRows = ss.getSheetByName('Info').getDataRange().getValues();
  const info = {};
  for (let i = 1; i < infoRows.length; i++) {
    info[infoRows[i][0]] = infoRows[i][1];
  }

  const enderecoRows = ss.getSheetByName('Enderecos').getDataRange().getValues();
  const enderecos = [];
  for (let i = 1; i < enderecoRows.length; i++) {
    const r = enderecoRows[i];
    if (!r[0]) continue;
    enderecos.push({
      id: r[0], nomeLocal: r[1], endereco: r[2], numero: r[3], bairro: r[4],
      cidade: r[5], uf: r[6], cep: r[7], referencia: r[8],
      linkLocalizacao: r[9], dataCriacao: r[10]
    });
  }

  const arquivos = listArquivos_(arquivosFolderId);

  const fornecedoresSheet = getOrCreateSheet_(ss, 'Fornecedores', FORNECEDORES_OBRA_HEADERS);
  const fornecedoresRows = fornecedoresSheet.getDataRange().getValues();
  const fornecedores = [];
  for (let i = 1; i < fornecedoresRows.length; i++) {
    const r = fornecedoresRows[i];
    if (!r[0]) continue;
    fornecedores.push({ id: r[0], nome: r[1], contato: r[2], categoria: r[3], servicoInsumos: r[4], cidade: r[5] });
  }

  const respSheet = getOrCreateSheet_(ss, 'Responsaveis', RESPONSAVEIS_HEADERS);
  const respRows = respSheet.getDataRange().getValues();
  const responsaveis = [];
  for (let i = 1; i < respRows.length; i++) {
    const r = respRows[i];
    if (!r[0]) continue;
    responsaveis.push({ id: r[0], nome: r[1], funcao: r[2], contato: r[3] });
  }

  return {
    id, nome, cliente, cno, spreadsheetId, folderId, arquivosFolderId,
    dataCriacao, info, enderecos, arquivos, fornecedores, responsaveis, url: ss.getUrl()
  };
}

function addEndereco_(obraId, endereco) {
  const indexSheet = getIndexSheet_();
  const found = findObraRow_(indexSheet, obraId);
  if (!found) throw new Error('Obra não encontrada');

  const spreadsheetId = found.data[4];
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName('Enderecos');

  const id = Utilities.getUuid();
  const dataCriacao = new Date().toISOString();
  sheet.appendRow([
    id,
    endereco.nomeLocal || '',
    endereco.endereco || '',
    endereco.numero || '',
    endereco.bairro || '',
    endereco.cidade || '',
    endereco.uf || '',
    endereco.cep || '',
    endereco.referencia || '',
    endereco.linkLocalizacao || '',
    dataCriacao
  ]);

  return { id, dataCriacao, ...endereco };
}

function deleteEndereco_(obraId, enderecoId) {
  const indexSheet = getIndexSheet_();
  const found = findObraRow_(indexSheet, obraId);
  if (!found) throw new Error('Obra não encontrada');

  const spreadsheetId = found.data[4];
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName('Enderecos');
  const enderecoRow = findObraRow_(sheet, enderecoId);
  if (!enderecoRow) throw new Error('Endereço não encontrado');

  sheet.deleteRow(enderecoRow.rowIndex);
  return { ok: true };
}

function deleteObra_(obraId) {
  const indexSheet = getIndexSheet_();
  const found = findObraRow_(indexSheet, obraId);
  if (!found) throw new Error('Obra não encontrada');

  const folderId = found.data[5];
  DriveApp.getFolderById(folderId).setTrashed(true);
  indexSheet.deleteRow(found.rowIndex);
  return { ok: true };
}

function listArquivos_(arquivosFolderId) {
  const folder = DriveApp.getFolderById(arquivosFolderId);
  const files = folder.getFiles();
  const out = [];
  while (files.hasNext()) {
    const file = files.next();
    out.push({
      id: file.getId(),
      nome: file.getName(),
      mimeType: file.getMimeType(),
      url: 'https://drive.google.com/file/d/' + file.getId() + '/view',
      tamanho: file.getSize(),
      dataCriacao: file.getDateCreated().toISOString()
    });
  }
  return out;
}

function addArquivo_(obraId, nomeArquivo, mimeType, base64Data) {
  const indexSheet = getIndexSheet_();
  const found = findObraRow_(indexSheet, obraId);
  if (!found) throw new Error('Obra não encontrada');

  const arquivosFolderId = found.data[6];
  const folder = DriveApp.getFolderById(arquivosFolderId);
  const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, nomeArquivo);
  const file = folder.createFile(blob);

  return {
    id: file.getId(),
    nome: file.getName(),
    mimeType: file.getMimeType(),
    url: 'https://drive.google.com/file/d/' + file.getId() + '/view',
    tamanho: file.getSize(),
    dataCriacao: file.getDateCreated().toISOString()
  };
}

function deleteArquivo_(fileId) {
  DriveApp.getFileById(fileId).setTrashed(true);
  return { ok: true };
}

function renameArquivo_(fileId, novoNome) {
  if (!novoNome) throw new Error('Nome do arquivo é obrigatório');
  const file = DriveApp.getFileById(fileId);
  file.setName(novoNome);
  return { id: fileId, nome: file.getName() };
}

function listFornecedores_() {
  const sheet = getFornecedoresSheet_();
  const rows = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const [id, nome, contato, categoria, produtoFornecido] = rows[i];
    if (!id) continue;
    out.push({ id, nome, contato, categoria, produtoFornecido });
  }
  return out;
}

function createFornecedor_(nome, contato, categoria, produtoFornecido) {
  if (!nome) throw new Error('Nome do fornecedor é obrigatório');

  const sheet = getFornecedoresSheet_();
  const id = Utilities.getUuid();
  sheet.appendRow([id, nome, contato || '', categoria || '', produtoFornecido || '']);

  return { id, nome, contato, categoria, produtoFornecido };
}

function deleteFornecedor_(fornecedorId) {
  const sheet = getFornecedoresSheet_();
  const found = findObraRow_(sheet, fornecedorId);
  if (!found) throw new Error('Fornecedor não encontrado');

  sheet.deleteRow(found.rowIndex);
  return { ok: true };
}

function addFornecedorObra_(obraId, nome, contato, categoria, servicoInsumos, cidade) {
  if (!nome) throw new Error('Nome do fornecedor é obrigatório');

  const data = getObraIndexData_(obraId);
  const ss = SpreadsheetApp.openById(data[4]);
  const sheet = getOrCreateSheet_(ss, 'Fornecedores', FORNECEDORES_OBRA_HEADERS);

  const id = Utilities.getUuid();
  sheet.appendRow([id, nome, contato || '', categoria || '', servicoInsumos || '', cidade || '']);
  return { id, nome, contato, categoria, servicoInsumos, cidade };
}

function deleteFornecedorObra_(obraId, fornecedorId) {
  const data = getObraIndexData_(obraId);
  const ss = SpreadsheetApp.openById(data[4]);
  const sheet = getOrCreateSheet_(ss, 'Fornecedores', FORNECEDORES_OBRA_HEADERS);

  const found = findObraRow_(sheet, fornecedorId);
  if (!found) throw new Error('Fornecedor não encontrado');

  sheet.deleteRow(found.rowIndex);
  return { ok: true };
}

function addResponsavel_(obraId, nome, funcao, contato) {
  if (!nome) throw new Error('Nome do responsável é obrigatório');

  const data = getObraIndexData_(obraId);
  const ss = SpreadsheetApp.openById(data[4]);
  const sheet = getOrCreateSheet_(ss, 'Responsaveis', RESPONSAVEIS_HEADERS);

  const id = Utilities.getUuid();
  sheet.appendRow([id, nome, funcao || '', contato || '']);
  return { id, nome, funcao, contato };
}

function deleteResponsavel_(obraId, responsavelId) {
  const data = getObraIndexData_(obraId);
  const ss = SpreadsheetApp.openById(data[4]);
  const sheet = getOrCreateSheet_(ss, 'Responsaveis', RESPONSAVEIS_HEADERS);

  const found = findObraRow_(sheet, responsavelId);
  if (!found) throw new Error('Responsável não encontrado');

  sheet.deleteRow(found.rowIndex);
  return { ok: true };
}
