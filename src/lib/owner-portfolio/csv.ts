import type {Language} from '@/types';
import {ownerLabel} from './labels';
// Quote every cell and neutralize spreadsheet formula prefixes, including whitespace.
export function csvCell(value:unknown):string {
  let text=String(value??'');
  if(/^[\s]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
export function annualCsv(groups:Record<string,unknown>[],lang:Language='en'):string{
 const keys=['unit_id','currency','kind','direction','entry_count','amount'];
 const headings={en:['Unit ID','Currency','Category','Direction','Record count','Amount'],ro:['Identificator unitate','Monedă','Categorie','Direcție','Număr înregistrări','Sumă'],fa:['شناسه واحد','ارز','دسته','جهت','تعداد ثبت‌ها','مبلغ']};
 return '\uFEFF'+[headings[lang].map(csvCell).join(','),...groups.map(row=>keys.map(k=>csvCell(k==='kind'||k==='direction'?ownerLabel(lang,String(row[k]??'')):row[k])).join(','))].join('\r\n')+'\r\n';
}
