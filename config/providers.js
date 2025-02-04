export const PROVIDERS = {
  'ipfs.io': {
    displayName: 'IPFS Gateway',
    format: 'path',
    template: 'https://ipfs.io/ipfs/{cid}'
  },
  'dweb.link': {
    displayName: 'DWeb Link',
    format: 'subdomain',
    template: 'https://{cid}.ipfs.dweb.link'
  },
  'flk-ipfs.xyz': {
    displayName: 'Fleek IPFS',
    format: 'subdomain',
    template: 'https://{cid}.ipfs.flk-ipfs.xyz'
  },
  'eth.aragon.network': {
    displayName: 'Aragon',
    format: 'path',
    template: 'https://ipfs.eth.aragon.network/ipfs/{cid}'
  },
  'algonode.xyz': {
    displayName: 'Algonode',
    format: 'path',
    template: 'https://ipfs.algonode.xyz/ipfs/{cid}'
  }
};

export function getProviderUrl(providerKey, cid) {
  const provider = PROVIDERS[providerKey];
  if (!provider) {
    throw new Error(`Invalid provider: ${providerKey}`);
  }
  
  // Updated CID validation regex to support all valid IPFS CIDs
  if (!/^Qm[1-9A-HJ-NP-Za-km-z]{44}$|^bafybei[A-Za-z0-9]{52}$/.test(cid)) {
    throw new Error(`Invalid CID format: ${cid}`);
  }

  // Add DNS validation
  try {
    new URL(provider.template.replace('{cid}', cid));
  } catch (error) {
    console.error(`Invalid URL template for ${providerKey}: ${error}`);
    throw new Error(`Configuration error for ${providerKey}`);
  }

  return provider.template.replace('{cid}', cid);
} 