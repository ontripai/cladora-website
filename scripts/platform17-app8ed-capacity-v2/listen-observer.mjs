// Owned-development observation only. No application authority or credentials.
import fs from 'node:fs';
import net from 'node:net';
import assert from 'node:assert/strict';
import path from 'node:path';
const installed = Symbol.for('cladora.owned.listen.observer.v1');
const header = 'x-cladora-start-observation';

function identity() {
  const raw = fs.readFileSync('/proc/self/stat', 'utf8');
  const fields = raw.slice(raw.lastIndexOf(') ') + 2).trim().split(/\s+/);
  return {pid: process.pid, start_ticks: fields[19], pgrp: Number(fields[2]),
    session: Number(fields[3]), uid: process.getuid(), cwd: process.cwd()};
}

function install(config) {
  assert.equal(config.contract, 'platform17.listen-observation.v1');
  assert.match(config.nonce, /^[a-f0-9]{64}$/);
  assert.match(config.run_id, /^app8ed-[a-z0-9-]{8,64}$/);
  assert.ok(['app', 'probe'].includes(config.mode));
  assert.ok(Number.isInteger(config.port) && config.port >= 0 && config.port < 65536);
  assert.equal(config.mode === 'app' && config.port === 0, false);
  assert.equal(process.cwd(), config.app_root);
  assert.ok(config.manifest_path.startsWith('/_next/static/'));
  assert.equal(net.Server.prototype[installed], undefined, 'OBSERVER_ALREADY_INSTALLED');
  const original = net.Server.prototype.listen;
  Object.defineProperty(net.Server.prototype, installed, {value: true});
  net.Server.prototype.listen = function (...args) {
    this.once('listening', () => {
      const address = this.address();
      if (!address || typeof address === 'string') return;
      if (config.port !== 0 && address.port !== config.port) return;
      if (!['127.0.0.1', '::1'].includes(address.address)) {
        throw new Error('START_OBSERVER_NON_LOOPBACK');
      }
      const record = {contract: config.contract, mode: config.mode,
        run_id: config.run_id, nonce: config.nonce, ...identity(),
        address: address.address, port: address.port};
      const pending = config.evidence_file + '.pending';
      const fd = fs.openSync(pending, fs.constants.O_WRONLY | fs.constants.O_CREAT |
        fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
      try {
        const stat = fs.fstatSync(fd);
        assert.ok(stat.isFile() && stat.uid === process.getuid() &&
          stat.nlink === 1 && !(stat.mode & 0o077) && stat.size < 65536,
        'START_OBSERVER_FILE_CUSTODY');
        const bytes = Buffer.from(JSON.stringify(record) + '\n');
        assert.equal(fs.writeSync(fd, bytes), bytes.length, 'START_OBSERVER_SHORT_WRITE');
        fs.fsyncSync(fd);
      } finally { fs.closeSync(fd); }
      assert.equal(fs.existsSync(config.evidence_file), false, 'OBSERVER_ALREADY_PUBLISHED');
      fs.renameSync(pending, config.evidence_file);
      const directory = fs.openSync(path.dirname(config.evidence_file), 'r');
      try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
      // Only this private startup challenge on the existing static manifest.
      // Ordinary application requests and business handlers are unchanged.
      this.prependListener('request', (request, response) => {
        if (request.method === 'GET' && request.url === config.manifest_path &&
            request.headers[header] === config.nonce) {
          response.setHeader(header, config.nonce);
        }
      });
    });
    return Reflect.apply(original, this, args);
  };
}
export {install, identity, header};
