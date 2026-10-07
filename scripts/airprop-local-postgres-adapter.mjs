import { Client } from 'pg';
import { randomBytes } from 'node:crypto';
// Adapter runs the same canonical SQL fixture against disposable real Postgres.
// This test has no production-host override or shared customer-data connection.
export class PGlite {
 constructor(){
  const url=new URL(process.env.CLADORA_AIRPROP_TEST_DB_URL??'postgresql://postgres:postgres@127.0.0.1:5432/postgres');
  if(!['127.0.0.1','localhost'].includes(url.hostname))throw new Error('Local disposable database required');
  this.admin=new Client({connectionString:url.href,connectionTimeoutMillis:5000});
  this.name=`cladora_airprop_${randomBytes(8).toString('hex')}`;
  this.ready=(async()=>{await this.admin.connect();await this.admin.query(`create database ${this.name}`);url.pathname=`/${this.name}`;this.url=url.href;this.client=await this.openConnection();})();
 }
 async openConnection(){const c=new Client({connectionString:this.url,connectionTimeoutMillis:5000,statement_timeout:10000});await c.connect();await c.query("set lock_timeout='8s'");return c;}
 async query(sql,args=[]){await this.ready;return this.client.query(sql,args);}
 async exec(sql){await this.ready;return this.client.query(sql);}
 async close(){try{await this.ready;await this.client.end();await this.admin.query(`drop database ${this.name}`);}finally{await this.admin.end();}}
}
