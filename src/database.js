const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.SEPOMEX_DB_PATH || path.join(__dirname, '..', 'data', 'sepomex.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH, { readonly: true });
    db.pragma('journal_mode = WAL');
    db.pragma('mmap_size = 67108864');
  }
  return db;
}

function buscarPorCodigoPostal(cp) {
  return getDb().prepare(`
    SELECT codigo_postal, asentamiento, tipo_asentamiento, municipio, estado, ciudad, c_estado, c_mnpio, zona
    FROM asentamientos WHERE codigo_postal = ?
  `).all(cp);
}

function listarEstados() {
  return getDb().prepare(`
    SELECT DISTINCT c_estado, estado FROM asentamientos ORDER BY estado
  `).all();
}

function listarMunicipios(cEstado) {
  return getDb().prepare(`
    SELECT DISTINCT c_mnpio, municipio FROM asentamientos WHERE c_estado = ? ORDER BY municipio
  `).all(cEstado);
}

function listarColonias(cEstado, cMnpio) {
  return getDb().prepare(`
    SELECT asentamiento, tipo_asentamiento, codigo_postal, zona
    FROM asentamientos WHERE c_estado = ? AND c_mnpio = ? ORDER BY asentamiento
  `).all(cEstado, cMnpio);
}

function buscar(query, limite = 20) {
  const pattern = `%${query}%`;
  return getDb().prepare(`
    SELECT codigo_postal, asentamiento, tipo_asentamiento, municipio, estado, ciudad, c_estado, c_mnpio, zona
    FROM asentamientos
    WHERE asentamiento LIKE ? OR municipio LIKE ? OR ciudad LIKE ?
    LIMIT ?
  `).all(pattern, pattern, pattern, limite);
}

function getMetadata() {
  const rows = getDb().prepare('SELECT key, value FROM metadata').all();
  const meta = {};
  for (const row of rows) meta[row.key] = row.value;
  return meta;
}

module.exports = { buscarPorCodigoPostal, listarEstados, listarMunicipios, listarColonias, buscar, getMetadata };
