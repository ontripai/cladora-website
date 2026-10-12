import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { runCe012ProviderAcceptanceKit } from './ce012-provider-acceptance-kit.mjs';

const adapterPath = process.env.CE012_PROVIDER_ADAPTER;
if (!adapterPath) {
  throw new Error('Set CE012_PROVIDER_ADAPTER to a local ESM module exporting adapter or default');
}
const loaded = await import(pathToFileURL(resolve(adapterPath)).href);
const adapter = loaded.adapter ?? loaded.default;
if (!adapter) throw new Error('Provider adapter module must export adapter or default');
const result = await runCe012ProviderAcceptanceKit(adapter);
console.log(JSON.stringify(result, null, 2));
