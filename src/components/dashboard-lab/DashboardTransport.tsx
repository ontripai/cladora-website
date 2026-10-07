'use client';
import {createContext,useContext} from 'react';
import Link from 'next/link';
import type {ComponentProps} from 'react';
export type DashboardFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const nativeFetch:DashboardFetch=(input,init)=>globalThis.fetch(input,init);
const Context=createContext<DashboardFetch|null>(null);
export const DashboardTransportProvider=Context.Provider;
export function useDashboardFetch(){return useContext(Context)??nativeFetch;}
export function useDashboardPreview(){return useContext(Context)!==null;}

// Preview links carry no production URL, so prefetch, modifier-click and
// opening a new tab cannot accidentally load a real customer page.

export function DashboardLink(props:ComponentProps<typeof Link>){
 const preview=useDashboardPreview();
 if(!preview)return <Link {...props}/>;
 const {href,children,className,hrefLang}=props;
 return <a href="#lab-detail" data-lab-href={String(href)} className={className} hrefLang={hrefLang}>{children}</a>;
}
