// One disposable loopback fixture, never an application or backend request.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {once} from 'node:events';
import {pathToFileURL} from 'node:url';
const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
assert.equal(config.mode, 'probe');
process.title = 'next-server (v16.4.1)';
const {coreServiceAssemblyChildEnvironmentV1: childEnvironment} = await import(
  pathToFileURL(config.app_root + '/scripts/lib/core-service-assembly-environment-v1.mjs'));
assert.equal(childEnvironment(process.env, 'start').NODE_OPTIONS, process.env.NODE_OPTIONS);
const body = 'CLADORA_OBSERVATION_PROBE_V1';
const server = http.createServer((_request, response) => response.end(body));
const watchdog = setTimeout(() => { server.closeAllConnections(); server.close();
  process.stdin.destroy(new Error('OBSERVATION_PROBE_DEADLINE')); process.exitCode = 78; }, 10000);
try {
  const ready = once(server, 'listening'); server.listen(0, '127.0.0.1'); await ready;
  const records = fs.readFileSync(config.evidence_file, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(records.length, 1); assert.equal(records[0].pid, process.pid);
  assert.equal(records[0].nonce, config.nonce);
  const result = await new Promise((resolve, reject) => {
    const request = http.get({host: '127.0.0.1', port: server.address().port,
      path: config.manifest_path, headers: {'x-cladora-start-observation': config.nonce}},
    response => { let text = ''; response.on('data', chunk => { text += chunk;
      if (text.length > 4096) request.destroy(new Error('PROBE_BODY_LIMIT')); });
    response.on('end', () => resolve({status: response.statusCode,
      nonce: response.headers['x-cladora-start-observation'], body: text})); });
    request.setTimeout(3000, () => request.destroy(new Error('PROBE_HTTP_TIMEOUT')));
    request.on('error', reject);
  });
  assert.deepEqual(result, {status: 200, nonce: config.nonce, body});
  console.log(JSON.stringify({contract: 'platform17.observation-probe.v1', state: 'PASS',
    observation: 'child-owned-listen-and-http-nonce', private_fd_scan: false}));
  await new Promise((resolve, reject) => {
    process.stdin.once('data', bytes => bytes.toString() === 'K' ? resolve() : reject(new Error('PROBE_PARENT_ACK')));
    process.stdin.once('end', () => reject(new Error('PROBE_PARENT_ENDED')));
    process.stdin.once('error', reject);
  });
  process.stdin.destroy();
} finally {
  clearTimeout(watchdog); server.closeAllConnections();
  if (server.listening) await new Promise(resolve => server.close(resolve));
}
