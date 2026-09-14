export type ExportArtifactErrorCode='EXPORT_SCAN_PENDING'|'EXPORT_QUARANTINED'|'EXPORT_SCAN_FAILED'|'EXPORT_NOT_MATERIALIZED';
export type ExportArtifactScanStatus='not_materialized'|'scanning_pending'|'clean'|'quarantined'|'scan_failed';
type Lang='ro'|'en'|'fa';
const copy:Record<Lang,Record<ExportArtifactErrorCode,string>>={
  ro:{EXPORT_SCAN_PENDING:'Fișierul este în carantină până la finalizarea scanării.',EXPORT_QUARANTINED:'Fișierul a fost blocat de scanarea de securitate.',EXPORT_SCAN_FAILED:'Scanarea de securitate a eșuat. Descărcarea rămâne blocată.',EXPORT_NOT_MATERIALIZED:'Fișierul nu a fost încă generat.'},
  en:{EXPORT_SCAN_PENDING:'The file is quarantined until scanning completes.',EXPORT_QUARANTINED:'The file was blocked by the security scan.',EXPORT_SCAN_FAILED:'The security scan failed. Download remains blocked.',EXPORT_NOT_MATERIALIZED:'The file has not been generated yet.'},
  fa:{EXPORT_SCAN_PENDING:'فایل تا پایان اسکن در قرنطینه است.',EXPORT_QUARANTINED:'فایل توسط اسکن امنیتی مسدود شد.',EXPORT_SCAN_FAILED:'اسکن امنیتی ناموفق بود و دانلود همچنان مسدود است.',EXPORT_NOT_MATERIALIZED:'فایل هنوز تولید نشده است.'}
};
export function exportArtifactErrorMessage(code:ExportArtifactErrorCode,acceptLanguage:string|null){const value=(acceptLanguage??'').toLowerCase();const lang:Lang=value.startsWith('fa')?'fa':value.startsWith('en')?'en':'ro';return copy[lang][code]}
const statusCopy:Record<Lang,Record<ExportArtifactScanStatus,string>>={
  ro:{not_materialized:'Fișierul nu a fost generat',scanning_pending:'Scanare de securitate în curs',clean:'Scanare finalizată — descărcare permisă',quarantined:'Amenințare detectată — fișier în carantină',scan_failed:'Scanare nereușită — descărcare blocată'},
  en:{not_materialized:'File not generated',scanning_pending:'Security scan in progress',clean:'Scan complete — download allowed',quarantined:'Threat detected — file quarantined',scan_failed:'Scan failed — download blocked'},
  fa:{not_materialized:'فایل هنوز تولید نشده است',scanning_pending:'اسکن امنیتی در حال انجام است',clean:'اسکن کامل شد — دانلود مجاز است',quarantined:'تهدید شناسایی شد — فایل قرنطینه است',scan_failed:'اسکن ناموفق بود — دانلود مسدود است'}
};
export function exportArtifactStatusMessage(status:ExportArtifactScanStatus,language:string|null){const value=(language??'').toLowerCase();const lang:Lang=value.startsWith('fa')?'fa':value.startsWith('en')?'en':'ro';return statusCopy[lang][status]}
