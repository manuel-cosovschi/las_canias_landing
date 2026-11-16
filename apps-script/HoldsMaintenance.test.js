const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the real Apps Script. Only Google's external services are simulated.
const source = fs.readFileSync(path.join(__dirname, 'HoldsMaintenance.gs'), 'utf8')
  .replace('const OWNER_EMAILS = "";', 'const OWNER_EMAILS = "owner@example.com";');
const NOW = '2026-10-29T15:00:00.000Z';
const SERVER_ERROR = "We're sorry, a server error occurred. Please wait a bit and try again.";
const HEADERS = ['id', 'status', 'expires_at', 'email', 'guest_name', 'house_code',
  'check_in', 'check_out', 'phone', 'reminder_1h_sent_at', 'expired_at',
  'cancelled_at', 'status_reason', 'updated_at'];
const expiredHold = { id: 'expired', status: 'HOLD_TRANSFER', expires_at: '2026-10-29T14:00:00Z' };
const upcomingHold = { id: 'upcoming', status: 'HOLD_TRANSFER', expires_at: '2026-10-29T15:30:00Z' };

function harness(rows = [expiredHold], options = {}) {
  const headers = options.headers || HEADERS;
  const data = [headers.slice(), ...rows.map(row => headers.map(h => row[h] ?? ''))];
  const counts = {};
  const mails = [];
  const sleeps = [];
  const logs = [];
  const failures = { ...options.failures };
  const lock = { held: false, released: false };
  const tick = name => {
    counts[name] = (counts[name] || 0) + 1;
    const failure = failures[name];
    if (failure && counts[name] <= failure.times) throw failure.error;
  };
  const range = (startRow, startCol, numRows, numCols) => ({
    getValues() {
      tick('read');
      return Array.from({ length: numRows }, (_, r) =>
        Array.from({ length: numCols }, (_, c) => data[startRow - 1 + r]?.[startCol - 1 + c] ?? ''));
    },
    setValues(values) {
      assert.equal(values.length, numRows, 'range row count');
      values.forEach(row => assert.equal(row.length, numCols, 'range column count'));
      tick('write');
      values.forEach((row, r) => row.forEach((value, c) => {
        data[startRow - 1 + r] ||= [];
        data[startRow - 1 + r][startCol - 1 + c] = value;
      }));
      if (options.afterWrite) options.afterWrite(data, counts.write);
      // Simulate Google accepting a write but returning a transient error.
      tick('afterWrite');
    },
  });
  const sheet = {
    getDataRange() { tick('range'); return range(1, 1, data.length, data[0].length); },
    getRange: range,
  };
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [NOW])); }
    static now() { return Date.parse(NOW); }
  }
  const context = vm.createContext({
    Date: FixedDate,
    SpreadsheetApp: {
      getActiveSpreadsheet() {
        tick('open');
        return { getSheetByName() { tick('sheet'); return options.missingSheet ? null : sheet; } };
      },
      flush() { tick('flush'); },
    },
    LockService: {
      getScriptLock() {
        return {
          tryLock() { tick('lock'); lock.held = options.lockAvailable !== false; return lock.held; },
          releaseLock() { lock.held = false; lock.released = true; },
        };
      },
    },
    MailApp: { sendEmail(...args) { tick('mail'); mails.push(args); } },
    Utilities: { sleep(ms) { sleeps.push(ms); }, formatDate(date) { return date.toISOString(); } },
    Logger: { log(message) { logs.push(message); } },
    console: { warn(message) { logs.push(message); }, error(message) { logs.push(message); } },
  });
  vm.runInContext(source, context, { filename: 'HoldsMaintenance.gs' });
  return {
    run: () => context.runHoldsMaintenance(), counts, mails, sleeps, logs, lock,
    inspect: () => context.inspectHoldsMaintenance(),
    rows: () => data.slice(1).map(row => Object.fromEntries(data[0].map((h, i) => [h, row[i] ?? '']))),
  };
}

test('expires only overdue transfer holds and keeps confirmed reservations intact', () => {
  const h = harness([expiredHold, { ...expiredHold, id: 'confirmed', status: 'CONFIRMED' },
    { ...upcomingHold, expires_at: '2026-10-29T18:00:00Z' }]);
  h.run();
  assert.equal(h.rows()[0].status, 'CANCELLED');
  assert.equal(h.rows()[0].expired_at, NOW);
  assert.equal(h.rows()[0].status_reason, 'Auto-expired (Apps Script)');
  assert.equal(h.rows()[1].status, 'CONFIRMED');
  assert.equal(h.rows()[2].status, 'HOLD_TRANSFER');
  assert.equal(h.mails.length, 0);
});

for (const phase of ['open', 'sheet', 'range', 'read']) {
  test(`recovers a transient Google error during ${phase} and still expires the hold`, () => {
    const h = harness([expiredHold], { failures: { [phase]: { times: 2, error: new Error(SERVER_ERROR) } } });
    h.run();
    assert.equal(h.rows()[0].status, 'CANCELLED');
    assert.deepEqual(h.sleeps, [1000, 2000]);
    assert.equal(h.counts[phase], 3);
  });
}

for (const phase of ['write', 'afterWrite', 'flush']) {
  test(`surfaces ${phase} errors without replaying a shared-sheet write or an email`, () => {
    const error = new Error(SERVER_ERROR);
    const h = harness([upcomingHold], { failures: { [phase]: { times: 1, error } } });
    assert.throws(h.run, e => e === error);
    assert.equal(h.mails.length, 1);
    assert.equal(h.counts.write, 1);
    assert.deepEqual(h.sleeps, []);
    assert.equal(h.lock.released, true);
    if (phase !== 'write') {
      assert.equal(h.rows()[0].reminder_1h_sent_at, NOW);
      h.run();
      assert.equal(h.mails.length, 1, 'the next trigger must respect an already committed marker');
    }
  });
}

test('does not overwrite an n8n confirmation after an ambiguously accepted write', () => {
  const error = new Error(SERVER_ERROR);
  const h = harness([upcomingHold], {
    failures: { afterWrite: { times: 1, error } },
    afterWrite(data, count) {
      if (count === 1) data[1][HEADERS.indexOf('status')] = 'CONFIRMED';
    },
  });
  assert.throws(h.run, e => e === error);
  assert.equal(h.rows()[0].status, 'CONFIRMED');
  assert.equal(h.mails.length, 1);
});

test('stops after three failed attempts, surfaces the original error, and releases the lock', () => {
  const error = new Error(SERVER_ERROR);
  const h = harness([expiredHold], { failures: { read: { times: Infinity, error } } });
  assert.throws(h.run, e => e === error);
  assert.equal(h.counts.read, 3);
  assert.deepEqual(h.sleeps, [1000, 2000]);
  assert.equal(h.lock.released, true);
  assert.equal(h.rows()[0].status, 'HOLD_TRANSFER');
});

test('does not retry missing sheet configuration', () => {
  const h = harness([expiredHold], { missingSheet: true });
  assert.throws(h.run, /No existe la pestaña/);
  assert.deepEqual(h.sleeps, []);
  assert.equal(h.counts.sheet, 1);
});

for (const message of ['Authorization is required to perform that action.', 'Service invoked too many times: SpreadsheetApp.']) {
  test(`does not conceal or retry permanent errors: ${message}`, () => {
    const error = new Error(message);
    const h = harness([expiredHold], { failures: { read: { times: Infinity, error } } });
    assert.throws(h.run, e => e === error);
    assert.equal(h.counts.read, 1);
    assert.deepEqual(h.sleeps, []);
  });
}

test('does not retry the email when MailApp returns an ambiguous server error', () => {
  const error = new Error(SERVER_ERROR);
  const h = harness([upcomingHold], { failures: { mail: { times: Infinity, error } } });
  assert.throws(h.run, e => e === error);
  assert.equal(h.counts.mail, 1);
  assert.equal(h.rows()[0].reminder_1h_sent_at, '');
  assert.deepEqual(h.sleeps, []);
});

test('does not repeat a reminder when saving its marker fails', () => {
  const error = new Error(SERVER_ERROR);
  const h = harness([upcomingHold], { failures: { write: { times: Infinity, error } } });
  assert.throws(h.run, e => e === error);
  assert.equal(h.mails.length, 1);
  assert.equal(h.counts.write, 1);
  assert.equal(h.lock.released, true);
});

test('skips an overlapping execution before reading or sending anything', () => {
  const h = harness([upcomingHold], { lockAvailable: false });
  h.run();
  assert.equal(h.counts.open || 0, 0);
  assert.equal(h.mails.length, 0);
  assert.equal(h.rows()[0].reminder_1h_sent_at, '');
});

test('expands the saved matrix when maintenance columns were missing', () => {
  const h = harness([expiredHold], { headers: ['id', 'status', 'expires_at'] });
  h.run();
  assert.equal(h.rows()[0].status, 'CANCELLED');
  assert.equal(h.rows()[0].expired_at, NOW);
  assert.equal(h.rows()[0].updated_at, NOW);
});

test('inspects live-readiness without sending mail, changing reservations, or creating columns', () => {
  const h = harness([expiredHold, upcomingHold, { id: 'invalid', status: 'HOLD_TRANSFER', expires_at: 'invalid' }],
    { headers: ['id', 'status', 'expires_at'] });
  const report = h.inspect();
  assert.equal(report.rows, 3);
  assert.equal(report.holds, 3);
  assert.equal(report.expired, 1);
  assert.equal(report.remindersDue, 1);
  assert.equal(report.invalidExpires, 1);
  assert.equal(h.rows()[0].status, 'HOLD_TRANSFER');
  assert.equal(h.counts.write || 0, 0);
  assert.equal(h.mails.length, 0);
});
