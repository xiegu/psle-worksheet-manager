const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3001;
const DATA_DIR = path.join(__dirname, "data");

app.use(express.json({ limit: "50mb" }));
app.use(express.static(__dirname));

// --- Per-collection write lock (prevents concurrent file corruption) ---

const _locks = {};  // collection name → Promise chain

function withLock(collection, fn) {
  if (!_locks[collection]) _locks[collection] = Promise.resolve();
  const prev = _locks[collection];
  const next = prev.then(fn, fn);   // run fn after previous completes (even if it rejected)
  _locks[collection] = next.catch(() => {});  // swallow so chain continues
  return next;
}

// --- JSON file helpers ---

function dataFile(collection) {
  return path.join(DATA_DIR, collection + ".json");
}

function readJSON(collection) {
  const f = dataFile(collection);
  if (!fs.existsSync(f)) return [];
  try { return JSON.parse(fs.readFileSync(f, "utf-8")); }
  catch { return []; }
}

function writeJSON(collection, data) {
  fs.writeFileSync(dataFile(collection), JSON.stringify(data, null, 2));
}

// Ensure seed files exist
["worksheets", "papers", "students"].forEach(c => {
  if (!fs.existsSync(dataFile(c))) writeJSON(c, []);
});

// --- CRUD routes for each collection ---

function registerCollection(name) {
  // GET all
  app.get(`/api/${name}`, (_req, res) => {
    res.json(readJSON(name));
  });

  // GET by id
  app.get(`/api/${name}/:id`, (req, res) => {
    const item = readJSON(name).find(r => r.id === req.params.id);
    item ? res.json(item) : res.status(404).json({ error: "not found" });
  });

  // PUT upsert (locked)
  app.put(`/api/${name}/:id`, (req, res) => {
    withLock(name, () => {
      const data = readJSON(name);
      const idx = data.findIndex(r => r.id === req.params.id);
      const record = { ...req.body, id: req.params.id };
      if (idx >= 0) data[idx] = record; else data.push(record);
      writeJSON(name, data);
      res.json(record);
    }).catch(e => res.status(500).json({ error: e.message }));
  });

  // DELETE (locked)
  app.delete(`/api/${name}/:id`, (req, res) => {
    withLock(name, () => {
      const data = readJSON(name).filter(r => r.id !== req.params.id);
      writeJSON(name, data);
      res.json({ ok: true });
    }).catch(e => res.status(500).json({ error: e.message }));
  });

  // POST bulk (locked — for migration / import)
  app.post(`/api/${name}/bulk`, (req, res) => {
    const incoming = req.body;
    if (!Array.isArray(incoming)) return res.status(400).json({ error: "expected array" });
    withLock(name, () => {
      const data = readJSON(name);
      const existing = new Set(data.map(r => r.id));
      for (const item of incoming) {
        if (existing.has(item.id)) {
          data[data.findIndex(r => r.id === item.id)] = item;
        } else {
          data.push(item);
        }
      }
      writeJSON(name, data);
      res.json({ ok: true, count: incoming.length });
    }).catch(e => res.status(500).json({ error: e.message }));
  });
}

registerCollection("worksheets");
registerCollection("papers");
registerCollection("students");

app.listen(PORT, () => {
  console.log(`PSLE Worksheet Manager running at http://localhost:${PORT}`);
});
