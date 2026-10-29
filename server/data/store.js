// server/data/store.js
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');

class Store {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Could not read db.json via fs, attempting fallback require...', e);
    }
    // Bundled serverless fallback
    try {
      const bundled = require('./db.json');
      if (bundled && Object.keys(bundled).length > 0) {
        return JSON.parse(JSON.stringify(bundled));
      }
    } catch (e) {
      // ignore
    }
    // Fallback require seed
    try {
      require('./seed.js');
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('Failed to load seeded db.json:', err);
      return {};
    }
  }

  reload() {
    this.data = this.load();
    return this.data;
  }

  save(dataToSave) {
    try {
      if (dataToSave) {
        this.data = dataToSave;
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('Error saving db.json:', e);
    }
  }

  get(collection) {
    return this.data[collection] || [];
  }

  set(collection, items) {
    this.data[collection] = items;
    this.save();
    return items;
  }

  find(collection, predicate) {
    return (this.data[collection] || []).find(predicate);
  }

  filter(collection, predicate) {
    return (this.data[collection] || []).filter(predicate);
  }

  insert(collection, item) {
    if (!this.data[collection]) {
      this.data[collection] = [];
    }
    this.data[collection].unshift(item);
    this.save();
    return item;
  }

  update(collection, id, updates) {
    const items = this.data[collection] || [];
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      this.data[collection][index] = { ...items[index], ...updates };
      this.save();
      return this.data[collection][index];
    }
    return null;
  }

  delete(collection, id) {
    const items = this.data[collection] || [];
    this.data[collection] = items.filter(item => item.id !== id);
    this.save();
    return true;
  }
}

module.exports = new Store();
