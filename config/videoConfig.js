export const PROVIDERS = [
  'ipfs.io',
  'dweb.link',
  'cf-ipfs.com',
  'flk-ipfs.xyz'
];

export const providerDisplayNames = {
  'ipfs.io': 'IPFS Gateway',
  'dweb.link': 'DWeb Link',
  'cf-ipfs.com': 'Cloudflare IPFS',
  'flk-ipfs.xyz': 'Fleek IPFS'
};

export function getProviderUrl(provider, cid) {
  return ["dweb.link", "flk-ipfs.xyz"].includes(provider)
    ? `https://${cid}.ipfs.${provider}`
    : `https://ipfs.${provider}/ipfs/${cid}`;
} 