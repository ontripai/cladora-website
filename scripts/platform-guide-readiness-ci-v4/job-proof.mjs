/** Versioned manual-only job proof; historical v1 checker remains unchanged. */
import assert from 'node:assert/strict';

const repository='ontripai/cladora-website';
export const JOB=Object.freeze({workflow:'.github/workflows/guide-readiness.yml',
 name:'Guide owned CI readiness',key:'guide-owned-preflight',ref:'refs/heads/main',event:'workflow_dispatch'});
const need=(value,code)=>assert.ok(value,code);
export function checkJob(context,run,jobs,source,now=Date.now()){
 need(context.actions&&context.repository===repository&&context.event===JOB.event
  &&context.ref===JOB.ref&&context.job===JOB.key,'FIXED_CI_CONTEXT_REQUIRED');
 need(/^[1-9][0-9]*$/.test(context.runId)&&/^[1-9][0-9]*$/.test(context.attempt)
  &&/^[a-f0-9]{40}$/.test(source)&&context.sha===source,'CI_SOURCE_OR_RUN_ID');
 need(String(run.id)===context.runId&&String(run.run_attempt)===context.attempt
  &&run.repository?.full_name===repository&&run.head_sha===source
  &&run.event===JOB.event&&run.path===JOB.workflow&&run.head_branch==='main'
  &&run.status==='in_progress','NATIVE_RUN_MISMATCH');
 need(Number.isSafeInteger(jobs.total_count)&&jobs.total_count===jobs.jobs?.length
  &&jobs.total_count<=100,'UNKNOWN_JOB_PAGINATION');
 const matches=jobs.jobs.filter(j=>j.name===JOB.name&&String(j.run_id)===context.runId
  &&String(j.run_attempt)===context.attempt&&j.head_sha===source&&j.status==='in_progress');
 need(matches.length===1,'NATIVE_JOB_NOT_UNIQUE');
 const job=matches[0],start=Date.parse(job.started_at);
 need(Number.isSafeInteger(job.id)&&job.id>0&&Number.isSafeInteger(job.runner_id)&&job.runner_id>0
  &&Number.isFinite(start)&&start<=now&&now-start<10*60000,'NATIVE_JOB_ID_OR_WINDOW');
 return {state:'GITHUB_API_RUN_JOB_OBSERVED',repository,source,workflow:JOB.workflow,
  run_id:run.id,attempt:run.run_attempt,job_id:job.id,runner_id:job.runner_id,
  job_started_at:job.started_at,observed_at:new Date(now).toISOString(),
  execution_approval:false,permit:null,native_ACK:false};
}
