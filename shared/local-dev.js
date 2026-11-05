// O catálogo local não depende de conta, Worker ou banco. Nunca é ativado por query em um host público.
export function localCosmeticsEnabled({ hostname, search = '' }) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname) && new URLSearchParams(search).get('devSkins') !== '0';
}
