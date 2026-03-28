const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const SEPOMEX_URL = 'https://www.correosdemexico.gob.mx/datosabiertos/cp/cpdescarga.txt';
const TXT_PATH = path.join(__dirname, '..', 'data', 'cpdescarga.txt');
const DB_PATH = path.join(__dirname, '..', 'data', 'sepomex.db');
const ESTADO_FILTRO = 'Guerrero';

function main() {
  // Download if file doesn't exist
  if (!fs.existsSync(TXT_PATH)) {
    console.log('Descargando catálogo de SEPOMEX...');
    execSync(`curl -sL --max-time 300 -o "${TXT_PATH}" "${SEPOMEX_URL}"`, { stdio: 'inherit' });
  } else {
    console.log(`Usando archivo existente: ${TXT_PATH}`);
  }

  // Read as Latin-1
  const buffer = fs.readFileSync(TXT_PATH);
  const text = buffer.toString('latin1');
  const lines = text.split('\n');

  console.log(`Total de líneas en archivo: ${lines.length}`);

  // Skip first 2 header lines
  const dataLines = lines.slice(2);

  // Parse and filter for Guerrero
  const records = [];
  let skipped = 0;

  for (const line of dataLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const fields = trimmed.split('|').map(f => f.trim());
    if (fields.length < 15) {
      skipped++;
      continue;
    }

    const [
      d_codigo,      // 0 - código postal
      d_asenta,      // 1 - asentamiento (colonia)
      d_tipo_asenta, // 2 - tipo de asentamiento
      D_mnpio,       // 3 - municipio
      d_estado,      // 4 - estado
      d_ciudad,      // 5 - ciudad
      d_CP,          // 6 - CP oficina
      c_estado,      // 7 - clave INEGI estado
      c_oficina,     // 8 - clave oficina
      c_CP,          // 9 - campo vacío
      c_tipo_asenta, // 10 - clave tipo asentamiento
      c_mnpio,       // 11 - clave INEGI municipio
      id_asenta,     // 12 - ID único asentamiento
      d_zona,        // 13 - zona (Urbano/Rural)
      c_cve_ciudad   // 14 - clave ciudad
    ] = fields;

    if (d_estado !== ESTADO_FILTRO) continue;

    // Validate CP is 5 digits
    if (!/^\d{5}$/.test(d_codigo)) {
      skipped++;
      continue;
    }

    records.push({
      codigo_postal: d_codigo,
      asentamiento: d_asenta,
      tipo_asentamiento: d_tipo_asenta,
      municipio: D_mnpio,
      estado: d_estado,
      ciudad: d_ciudad || null,
      c_estado,
      c_mnpio,
      zona: d_zona || null,
    });
  }

  console.log(`Registros de ${ESTADO_FILTRO}: ${records.length}`);
  console.log(`Líneas omitidas: ${skipped}`);

  if (records.length === 0) {
    console.error('No se encontraron registros. Verifica la fuente de datos.');
    process.exit(1);
  }

  // Remove old DB if exists
  const tempPath = DB_PATH + '.tmp';
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

  // Create SQLite database
  const db = new Database(tempPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE asentamientos (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_postal       TEXT NOT NULL,
      asentamiento        TEXT NOT NULL,
      tipo_asentamiento   TEXT NOT NULL,
      municipio           TEXT NOT NULL,
      estado              TEXT NOT NULL,
      ciudad              TEXT,
      c_estado            TEXT NOT NULL,
      c_mnpio             TEXT NOT NULL,
      zona                TEXT
    );

    CREATE INDEX idx_cp ON asentamientos(codigo_postal);
    CREATE INDEX idx_estado ON asentamientos(c_estado);
    CREATE INDEX idx_estado_mnpio ON asentamientos(c_estado, c_mnpio);

    CREATE TABLE metadata (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const insert = db.prepare(`
    INSERT INTO asentamientos (codigo_postal, asentamiento, tipo_asentamiento, municipio, estado, ciudad, c_estado, c_mnpio, zona)
    VALUES (@codigo_postal, @asentamiento, @tipo_asentamiento, @municipio, @estado, @ciudad, @c_estado, @c_mnpio, @zona)
  `);

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });

  insertMany(records);

  // Save metadata
  db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)').run('last_updated', new Date().toISOString());
  db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)').run('record_count', String(records.length));
  db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)').run('estado', ESTADO_FILTRO);

  db.close();

  // Atomic swap
  fs.renameSync(tempPath, DB_PATH);

  console.log(`Base de datos creada en: ${DB_PATH}`);
  console.log(`Total registros insertados: ${records.length}`);
}

try {
  main();
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
