import Link from "next/link";
import type { Language } from "@/types";
import { CustomerOccupancyDashboard } from "@/components/customer/CustomerOccupancyDashboard";
export default async function OwnershipPage({params}:{params:Promise<{lang:Language}>}){
 const{lang}=await params;
 const label={fa:"پیشنهاد و بررسی رابطهٔ واحد",en:"Unit relationship review",ro:"Verificarea relației unității"}[lang];
 return <><div className="mb-4"><Link href={`/${lang}/app/ownership/relationships`} className="rounded-lg border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-800">{label}</Link></div><CustomerOccupancyDashboard lang={lang} initialView="ownerships"/></>;
}
