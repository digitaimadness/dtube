export const PROVIDERS = {
  'ipfs.io': {
    displayName: 'IPFS',
    format: 'path',
    template: 'https://ipfs.io/ipfs/{cid}'
  },
  'dweb.link': {
    displayName: 'IPFS',
    format: 'subdomain',
    template: 'https://{cid}.ipfs.dweb.link'
  },
  'flk-ipfs.xyz': {
    displayName: 'Fleek',
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
  if (!provider) throw new Error(`Invalid provider: ${providerKey}`);
  
  // Updated CID validation regex to support all valid IPFS CIDs
  if (!/^Qm[1-9A-HJ-NP-Za-km-z]{44}$|^b[A-Za-z2-7]{58}$/.test(cid)) {
    throw new Error(`Invalid CID format: ${cid}`);
  }

  // Use the provider's template directly
  const url = provider.template.replace('{cid}', cid);

  // Validate URL structure
  try {
    new URL(url);
    return url;
  } catch (error) {
    console.error(`Invalid URL for ${providerKey}: ${url}`);
    throw new Error(`Configuration error for ${providerKey}`);
  }
} 