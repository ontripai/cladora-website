// Offline filesystem faults only; no provider/Storage/Auth mock or network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Evidence } from './storage-documents-native-abi-r1/native.mjs';

function fixture(fn) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'abi15-evidence-'));fs.chmodSync(dir,0o700);
  const e=new Evidence(dir);
  try { fn(e,dir); } finally { e.close();fs.rmSync(dir,{recursive:true}); }
}

test('capture capacity boundary is checked before counter change; cleanup cannot borrow',()=>fixture(e=>{
  for(let i=0;i<64;i++)e.reserve(false);
  assert.equal(e.used.normal,8*1024*1024);
  assert.throws(()=>e.reserve(false));
  assert.equal(e.used.normal,8*1024*1024);
  e.reserve(true);assert.equal(e.used.cleanup,131072);
}));

test('envelope breach quarantines all normal evidence; limited cleanup retains own chain',()=>fixture((e,dir)=>{
  e.record({type:'start'});
  const anchor=e.lanes.normal.chain;
  assert.throws(()=>e.record({type:'too-large',value:'x'.repeat(131072)}));
  assert.equal(e.quarantined,true);
  assert.throws(()=>e.reserve(false));assert.throws(()=>e.record({type:'ordinary-other-phase'}));
  e.reserve(true);e.record({type:'limited-cleanup'},true);
  const row=JSON.parse(fs.readFileSync(path.join(dir,'sdk-http-cleanup.private.jsonl'),'utf8'));
  assert.equal(row.normal_stable_anchor,anchor);assert.equal(row.normal_quarantined,true);
}));

test('short write leaves original tail untouched; no false stable ACK; cleanup separate',()=>fixture((e,dir)=>{
  const original=fs.writeSync;
  try {
    fs.writeSync=(fd,bytes,...args)=>fd===e.lanes.normal.fd?original(fd,bytes.subarray(0,7),...args):original(fd,bytes,...args);
    assert.throws(()=>e.record({type:'response'}));
  } finally { fs.writeSync=original; }
  assert.equal(e.quarantined,true);assert.equal(e.lanes.normal.seq,0);
  assert.equal(fs.statSync(path.join(dir,'sdk-http-normal.private.jsonl')).size,7);
  e.reserve(true);e.record({type:'cleanup-terminal'},true);
  assert.equal(e.lanes.cleanup.seq,1);assert.equal(e.lanes.normal.chain,'0'.repeat(64));
}));

test('fsync/disk-full failure never becomes durable response or native success',()=>fixture(e=>{
  const original=fs.fsyncSync;
  try {
    fs.fsyncSync=fd=>{if(fd===e.lanes.normal.fd){const x=new Error('ENOSPC');x.code='ENOSPC';throw x;}return original(fd);};
    assert.throws(()=>e.record({type:'response'}));
  } finally { fs.fsyncSync=original; }
  assert.equal(e.lanes.normal.seq,0);assert.equal(e.quarantined,true);
  e.reserve(true);e.record({type:'cleanup-terminal'},true);
  assert.equal(e.lanes.cleanup.seq,1);
}));
