export type OwnerUnit = {id:string;building_label:string;unit_label:string;address_text:string;status:string};
export type OwnerLease = {id:string;unit_id:string;tenant_label:string;starts_on:string;ends_on:string|null;monthly_rent:number|string;currency:string;status:string};
export type OwnerCash = {id:string;unit_id:string;kind:string;direction:string;amount:number|string;currency:string;due_on:string|null;paid_on:string|null;memo:string|null};
function cents(value:number|string):bigint {
  const match=String(value).match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if(!match) throw new Error('INVALID_MONEY');
  return BigInt(match[1])*BigInt(100)+BigInt((match[2]??'').padEnd(2,'0'));
}
function decimal(value:bigint):string {return `${value/BigInt(100)}.${(value%BigInt(100)).toString().padStart(2,'0')}`;}
export function ownerOverview(units:OwnerUnit[],leases:OwnerLease[],cash:OwnerCash[],today:string){
  const activeUnits=units.filter(u=>u.status==='active');
  const ids=new Set(activeUnits.map(u=>u.id));
  const active=leases.filter(l=>ids.has(l.unit_id)&&l.status==='active'&&l.starts_on<=today&&(!l.ends_on||l.ends_on>=today));
  const horizon=new Date(`${today}T12:00:00Z`);horizon.setUTCDate(horizon.getUTCDate()+60);
  const end=horizon.toISOString().slice(0,10);
  const currencies=new Map<string,{income:bigint;expense:bigint;overdueIncome:bigint;overdueExpense:bigint;monthlyRent:bigint}>();
  const bucket=(code:string)=>{let v=currencies.get(code);if(!v){v={income:BigInt(0),expense:BigInt(0),overdueIncome:BigInt(0),overdueExpense:BigInt(0),monthlyRent:BigInt(0)};currencies.set(code,v);}return v;};
  for(const l of active) bucket(l.currency).monthlyRent+=cents(l.monthly_rent);
  const overdue=cash.filter(c=>!c.paid_on&&c.due_on&&c.due_on<today);
  for(const c of cash){
    const b=bucket(c.currency),amount=cents(c.amount);
    if(c.paid_on&&c.paid_on.slice(0,7)===today.slice(0,7)&&c.paid_on<=today) b[c.direction==='income'?'income':'expense']+=amount;
    if(!c.paid_on&&c.due_on&&c.due_on<today) b[c.direction==='income'?'overdueIncome':'overdueExpense']+=amount;
  }
  return {today,unitCount:activeUnits.length,leasedUnitCount:new Set(active.map(l=>l.unit_id)).size,
    currencies:Array.from(currencies).sort(([a],[b])=>a.localeCompare(b)).map(([currency,b])=>({currency,income:decimal(b.income),expense:decimal(b.expense),overdueIncome:decimal(b.overdueIncome),overdueExpense:decimal(b.overdueExpense),monthlyRent:decimal(b.monthlyRent)})),
    expiring:leases.filter(l=>ids.has(l.unit_id)&&l.status==='active'&&l.ends_on&&l.ends_on<=end).sort((a,b)=>a.ends_on!.localeCompare(b.ends_on!)),
    overdue:overdue.sort((a,b)=>a.due_on!.localeCompare(b.due_on!)),units};
}
