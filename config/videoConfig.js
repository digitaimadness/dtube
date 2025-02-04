export const providerDisplayNames = {
  'ipfs.io': 'IPFS Gateway',
  'dweb.link': 'DWeb Link',
  'flk-ipfs.xyz': 'Fleek IPFS',
  'eth.aragon.network': 'Aragon'
};

export function getProviderUrl(provider, cid) {
  if (provider === 'eth.aragon.network') {
    return `https://ipfs.eth.aragon.network/ipfs/${cid}`;
  }
  
  return Object.keys(providerDisplayNames).includes(provider) 
    ? `https://${cid}.ipfs.${provider}`
    : `https://ipfs.${provider}/ipfs/${cid}`;
} 