/** Closed application-child environment. Inherited credentials/selectors are
 * not application inputs. Keep OS execution, session proxy/CA and host guards.
 * Application selectors are supplied only by the launcher's validated profile.
 */
const inheritedNames=new Set([
 'PATH','HOME','USER','LOGNAME','SHELL','PWD','TMPDIR','TMP','TEMP',
 'LANG','LANGUAGE','LC_ALL','LC_CTYPE','TZ','TERM','COLORTERM','NO_COLOR','FORCE_COLOR',
 'HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy',
 // Preserve runtime network-guard preloads/module resolution; never NODE_ENV.
 'NODE_OPTIONS','NODE_PATH',
 'NODE_EXTRA_CA_CERTS','SSL_CERT_FILE','SSL_CERT_DIR','REQUESTS_CA_BUNDLE',
 'CURL_CA_BUNDLE','GRPC_DEFAULT_SSL_ROOTS_FILE_PATH','CLOUDSDK_CORE_CUSTOM_CA_CERTS_FILE',
 'NETWORK','CODEX_PROXY_CERT','CODEX_PERMISSION_PROFILE','CODEX_CI',
 'CODEX_EXEC_SERVER_PROXY_PRIVATE_IPS_VIA_UPSTREAM','CODEX_EXEC_SERVER_REMOTE_BASE_URL',
 'CODEX_ENVIRONMENT_ID','CODEX_SESSION_ID','CODEX_CAAS_SESSION_ID','CODEX_THREAD_ID','CODEX_TOOL_CALL_ID',
 // Kept so the launcher can reject a deployment rather than erase its guards.
 'VERCEL','VERCEL_ENV','NEXT_PUBLIC_VERCEL_ENV',
]);
export function coreServiceAssemblyChildEnvironmentV1(inherited,phase){
 if(!['build','start'].includes(phase))throw new Error('CORE17_LAUNCH_PHASE_REQUIRED');
 return Object.fromEntries(Object.entries(inherited).filter(([key,value])=>inheritedNames.has(key)&&value!==undefined));
}
