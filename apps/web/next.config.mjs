const useStandaloneOutput = process.env.NEXT_OUTPUT_MODE === 'standalone';
export default {
  ...(useStandaloneOutput ? {output:'standalone'} : {}),
  // Preserve the request URL so strict URL/Host/origin checks see the public host.
  skipMiddlewareUrlNormalize:true,
  experimental:{cpus:2},
  serverExternalPackages:['@sodax/swaps-api','@sodax/types'],
};
