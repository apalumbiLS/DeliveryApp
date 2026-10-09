/**
 * Domain comparison, shared by sender matching and DKIM verification.
 *
 * Both need the same question answered — "is this host the domain, or beneath
 * it?" — and both are security-relevant, so they must not answer it two
 * different ways.
 */
export function isDomainOrSubdomainOf(host: string, domain: string): boolean {
  const normalisedHost = host.trim().toLowerCase();
  const normalisedDomain = domain.trim().toLowerCase();

  if (normalisedHost === "" || normalisedDomain === "") return false;

  // The leading dot is the whole point: a bare `endsWith("lowes.com")` would
  // also accept `notlowes.com`, which is how a spoofed sender slips through.
  return (
    normalisedHost === normalisedDomain ||
    normalisedHost.endsWith(`.${normalisedDomain}`)
  );
}
