export const providerDisplayNames = {
  'ipfs.io': 'IPFS Gateway',
  'dweb.link': 'DWeb Link',
  'flk-ipfs.xyz': 'Fleek IPFS'
};

export function getProviderUrl(provider, cid) {
  return Object.keys(providerDisplayNames).includes(provider) 
    ? `https://${cid}.ipfs.${provider}`
    : `https://ipfs.${provider}/ipfs/${cid}`;
} 