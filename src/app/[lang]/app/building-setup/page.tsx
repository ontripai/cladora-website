import {redirect} from "next/navigation";import {CustomerBuildingSetupWizard} from "@/components/customer/CustomerBuildingSetupWizard";import {isSupportedLocale} from "@/types";
export default async function BuildingSetupPage({params}:{params:Promise<{lang:string}>}){const {lang}=await params;if(!isSupportedLocale(lang))redirect("/ro/login");return <CustomerBuildingSetupWizard lang={lang}/>;}
