const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Response helper
function ok(res, resultado) {
  const arr = Array.isArray(resultado) ? resultado : [resultado];
  res.json({ ok: true, resultado: arr, total: arr.length });
}

function notFound(res, mensaje) {
  res.status(404).json({ ok: false, error: mensaje, resultado: [], total: 0 });
}

// GET /v1/codigo-postal/:cp
app.get('/v1/codigo-postal/:cp', (req, res) => {
  const cp = req.params.cp.padStart(5, '0');
  if (!/^\d{5}$/.test(cp)) {
    return res.status(400).json({ ok: false, error: 'Código postal debe ser de 5 dígitos' });
  }
  const rows = db.buscarPorCodigoPostal(cp);
  if (rows.length === 0) return notFound(res, `No se encontraron resultados para el CP ${cp}`);
  ok(res, rows);
});

// GET /v1/estados
app.get('/v1/estados', (_req, res) => {
  ok(res, db.listarEstados());
});

// GET /v1/estados/:c_estado/municipios
app.get('/v1/estados/:c_estado/municipios', (req, res) => {
  const rows = db.listarMunicipios(req.params.c_estado);
  if (rows.length === 0) return notFound(res, 'Estado no encontrado');
  ok(res, rows);
});

// GET /v1/estados/:c_estado/municipios/:c_mnpio/colonias
app.get('/v1/estados/:c_estado/municipios/:c_mnpio/colonias', (req, res) => {
  const rows = db.listarColonias(req.params.c_estado, req.params.c_mnpio);
  if (rows.length === 0) return notFound(res, 'Municipio no encontrado');
  ok(res, rows);
});

// GET /v1/buscar?q=...&limite=20
app.get('/v1/buscar', (req, res) => {
  const q = req.query.q;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ ok: false, error: 'Parámetro "q" requerido (mínimo 2 caracteres)' });
  }
  const limite = Math.min(parseInt(req.query.limite) || 20, 100);
  const rows = db.buscar(q.trim(), limite);
  ok(res, rows);
});

// GET /health
app.get('/health', (_req, res) => {
  const meta = db.getMetadata();
  res.json({
    ok: true,
    last_updated: meta.last_updated || null,
    record_count: meta.record_count ? parseInt(meta.record_count) : 0,
    estado: meta.estado || null,
  });
});

app.listen(PORT, () => {
  console.log(`SEPOMEX API corriendo en http://localhost:${PORT}`);
});
