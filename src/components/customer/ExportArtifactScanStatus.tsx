import {ShieldAlert,ShieldCheck,ShieldEllipsis,XCircle} from 'lucide-react';
import type {Language} from '@/types';
import {exportArtifactStatusMessage,type ExportArtifactScanStatus} from '@/lib/customer/export-artifact-errors';

const styles:Record<ExportArtifactScanStatus,string>={
  not_materialized:'border-slate-200 bg-slate-50 text-slate-700',
  scanning_pending:'border-amber-200 bg-amber-50 text-amber-800',
  clean:'border-emerald-200 bg-emerald-50 text-emerald-800',
  quarantined:'border-red-200 bg-red-50 text-red-800',
  scan_failed:'border-red-200 bg-red-50 text-red-800'
};

export function ExportArtifactScanStatus({lang,status}:{lang:Language;status:ExportArtifactScanStatus}){
  const Icon=status==='clean'?ShieldCheck:status==='scanning_pending'?ShieldEllipsis:status==='not_materialized'?ShieldAlert:XCircle;
  return <span role="status" className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${styles[status]}`}>
    <Icon className="h-4 w-4" aria-hidden="true"/><span>{exportArtifactStatusMessage(status,lang)}</span>
  </span>;
}
