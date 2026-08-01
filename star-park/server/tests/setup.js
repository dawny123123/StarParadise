const db = require('../src/database');

beforeEach(() => {
  db.resetForTest();
});
