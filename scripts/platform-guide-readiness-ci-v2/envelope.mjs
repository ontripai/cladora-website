/** AES-256-GCM transport only. Never imports Git/source, tokens or runtime code. */
import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {constants} from 'node:fs';
import {open,realpath,readdir,mkdir,rename,unlink,statfs} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';

const MAGIC=Buffer.from('CLAGCM01');
const HEADER=28,TAG=16,MAX=67108864,CHUNK=262144;
const need=(x,code)=>{if(!x)throw Error(code);};
const sha=b=>createHash('sha256').update(b).digest('hex');
export function context(manifestSha){
 need(/^[a-f0-9]{64}$/.test(manifestSha),'MANIFEST_SHA_REQUIRED');
 return Buffer.from(JSON.stringify({contract:'platform.guide-input-envelope.v2',
  source:'9064c7844657d7f0bfc16c20461100356b673362',
  tool:'aba19c2855973258e6edac80a5d4ba68e2c24e01',
  history:'26f8df8a023095c6adbd7184445eee62fc3ddff9',manifest_sha256:manifestSha}));
}
export function decodeKey(text){
 need(typeof text==='string'&&/^[A-Za-z0-9+/]{43}=$/.test(text),'KEY_FORMAT');
 const key=Buffer.from(text,'base64');need(key.length===32&&key.toString('base64')===text,'KEY_FORMAT');return key;
}
async function input(path){
 need(await realpath(path)===path,'ENVELOPE_INPUT_ALIAS');
 const fd=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW),s=await fd.stat();
 if(!s.isFile()||s.nlink!==1||s.size>MAX){await fd.close();throw Error('ENVELOPE_INPUT_BOUND');}
 return {fd,s};
}
async function unchanged(fd,s){
 const after=await fd.stat();
 need(['dev','ino','size','mtimeMs','ctimeMs','nlink'].every(k=>s[k]===after[k]),'ENVELOPE_INPUT_CHANGED');
}
async function writeAll(fd,data){
 let n=0;while(n<data.length){const r=await fd.write(data,n);need(r.bytesWritten>0,'ENVELOPE_SHORT_WRITE');n+=r.bytesWritten;}
}
async function readExact(fd,length,position){
 const data=Buffer.alloc(length);let n=0;
 while(n<length){const r=await fd.read(data,n,length-n,position+n);need(r.bytesRead>0,'ENVELOPE_SHORT_READ');n+=r.bytesRead;}return data;
}
async function fileHash(path){
 const {fd,s}=await input(path),hash=createHash('sha256');
 try{for(let at=0;at<s.size;at+=CHUNK)hash.update(await readExact(fd,Math.min(CHUNK,s.size-at),at));await unchanged(fd,s);return hash.digest('hex');}
 finally{await fd.close();}
}
async function budget(path,deadline,start=false){
 need(Date.now()<deadline,'ENVELOPE_DEADLINE');const s=await statfs(path);
 need(s.bavail*s.bsize>=(start?2147483648:603979776)&&s.ffree>128,'ENVELOPE_CAPACITY_GUARD');
}

/** Publisher runs only in a private custodian process, never a public raw upload.
 * Original ZIP/bundle bytes are opaque; no source rebuilding or key generation.
 */
export async function encryptFile(zipPath,outputPath,key,manifestSha){
 need(key.length===32,'KEY_FORMAT');const aad=context(manifestSha),{fd,s}=await input(zipPath);
 let out;
 try{
  need(await realpath(dirname(outputPath))===dirname(outputPath),'ENVELOPE_OUTPUT_ALIAS');
  need(s.size>0&&s.size+HEADER+TAG<=MAX,'ENVELOPE_INPUT_BOUND');
  const nonce=randomBytes(12),header=Buffer.alloc(HEADER);MAGIC.copy(header);nonce.copy(header,8);header.writeBigUInt64BE(BigInt(s.size),20);
  const cipher=createCipheriv('aes-256-gcm',key,nonce,{authTagLength:TAG});cipher.setAAD(aad);
  out=await open(outputPath,'wx',0o600);await writeAll(out,header);
  for(let at=0;at<s.size;at+=CHUNK)await writeAll(out,cipher.update(await readExact(fd,Math.min(CHUNK,s.size-at),at)));
  await writeAll(out,cipher.final());await writeAll(out,cipher.getAuthTag());
  await unchanged(fd,s);await out.sync();await out.close();out=null;
  return {contract:'platform.guide-input-envelope.v2',bytes:s.size+HEADER+TAG,
   envelope_sha256:await fileHash(outputPath),AAD_sha256:sha(aad)};
 }finally{await fd.close();if(out)await out.close();}
}

export async function decryptFile(envelopePath,privateDir,key,manifestSha,expectedEnvelopeSha){
 need(key.length===32&&/^[a-f0-9]{64}$/.test(expectedEnvelopeSha),'DECRYPT_PINS_REQUIRED');
 const aad=context(manifestSha),deadline=Date.now()+30000;
 need(await realpath(dirname(privateDir))===dirname(privateDir),'PRIVATE_PARENT_ALIAS');
 await budget(dirname(privateDir),deadline,true);
 const {fd,s}=await input(envelopePath);let out,created=false,committed=false,primary;
 const part=join(privateDir,'input.zip.part'),final=join(privateDir,'input.zip');
 try{
  need(s.size>HEADER+TAG,'ENVELOPE_FRAME');
  const header=await readExact(fd,HEADER,0);need(header.subarray(0,8).equals(MAGIC),'ENVELOPE_VERSION');
  const length=Number(header.readBigUInt64BE(20));need(Number.isSafeInteger(length)&&length>0&&s.size===HEADER+length+TAG,'ENVELOPE_FRAME');
  const decipher=createDecipheriv('aes-256-gcm',key,header.subarray(8,20),{authTagLength:TAG});decipher.setAAD(aad);
  decipher.setAuthTag(await readExact(fd,TAG,HEADER+length));
  await mkdir(privateDir,{mode:0o700});created=true;out=await open(part,'wx',0o600);
  const encrypted=createHash('sha256').update(header),plain=createHash('sha256');let written=0;
  for(let at=0;at<length;at+=CHUNK){
   await budget(privateDir,deadline);
   const block=await readExact(fd,Math.min(CHUNK,length-at),HEADER+at);encrypted.update(block);
   const decoded=decipher.update(block);plain.update(decoded);written+=decoded.length;await writeAll(out,decoded);
  }
  encrypted.update(await readExact(fd,TAG,HEADER+length));
  need(encrypted.digest('hex')===expectedEnvelopeSha,'ENVELOPE_DIGEST_MISMATCH');
  let tail;try{tail=decipher.final();}catch{throw Error('ENVELOPE_AUTH_FAILED');}
  plain.update(tail);written+=tail.length;await writeAll(out,tail);need(written===length,'PLAINTEXT_LENGTH');
  await unchanged(fd,s);await out.sync();await out.close();out=null;
  const plainSha=plain.digest('hex');need(await fileHash(part)===plainSha,'PLAINTEXT_READBACK');
  await rename(part,final);committed=true;
  return {contract:'platform.guide-input-envelope.v2',authenticated:true,manifest_sha256:manifestSha,
   envelope_sha256:expectedEnvelopeSha,AAD_sha256:sha(aad),plaintext_zip_bytes:written,
   plaintext_zip_sha256:plainSha,preflight:'HOLD',permit:null,native:'NOT_RUN'};
 }catch(error){primary=error;throw error;}finally{
  const failures=[];
  try{await fd.close();}catch(error){failures.push(error);}
  if(out)try{await out.close();}catch(error){failures.push(error);}
  if(created&&!committed)try{await unlink(part);}catch(error){if(error.code!=='ENOENT')failures.push(error);}
  if(failures.length){
   if(primary){primary.cleanup='UNKNOWN';}
   else{throw Error('ENVELOPE_CLEANUP_UNKNOWN');}
  }
 }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let key;
 try{
  need(process.argv.slice(2).join('|')==='decrypt','FIXED_DECRYPT_ONLY');
  const e=process.env,temp=e.RUNNER_TEMP;
  need(e.GITHUB_ACTIONS==='true'&&e.GITHUB_REPOSITORY==='ontripai/cladora-website'
   &&e.GITHUB_JOB==='guide-owned-preflight'&&e.GITHUB_REF==='refs/heads/main','ACTUAL_CI_REQUIRED');
  key=decodeKey(e.GUIDE_INPUT_DECRYPT_KEY_B64);delete e.GUIDE_INPUT_DECRYPT_KEY_B64;
  const cipherDir=join(temp,'guide-readiness-ciphertext');
  need((await readdir(cipherDir)).sort().join('|')==='encrypted-inputs.bin','CIPHERTEXT_ONLY_REQUIRED');
  const result=await decryptFile(join(cipherDir,'encrypted-inputs.bin'),join(temp,'guide-readiness-private'),
   key,e.GUIDE_INPUT_MANIFEST_SHA256,e.GUIDE_INPUT_ENVELOPE_SHA256);
  const file=await open(join(temp,'guide-readiness-receipts/decrypt.json'),'wx',0o600);
  try{await writeAll(file,Buffer.from(JSON.stringify(result)+'\n'));await file.sync();}finally{await file.close();}
  console.log('GUIDE_ENVELOPE_AUTHENTICATED');
 }catch(error){
  const code=/^[A-Z0-9_]+$/.test(error.message??'')?error.message:'DECRYPT_UNKNOWN';
  try{
   const fd=await open(join(process.env.RUNNER_TEMP,'guide-readiness-receipts/first-error.json'),'wx',0o600);
   try{await writeAll(fd,Buffer.from(JSON.stringify({stage:'decrypt',code,cleanup:error.cleanup??'NO_UNSETTLED_PART_REPORTED',
    preflight:'HOLD',permit:null,native:'NOT_RUN'})+'\n'));await fd.sync();}finally{await fd.close();}
  }catch{}
  console.error('GUIDE_ENVELOPE_HOLD');process.exitCode=2;
 }
 finally{if(key)key.fill(0);delete process.env.GUIDE_INPUT_DECRYPT_KEY_B64;}
}
