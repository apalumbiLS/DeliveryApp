/**
 * Whether inbound cart email can be received and verified.
 *
 * The webhook authenticates every request with Mailgun's HMAC signature, so
 * without the signing key there is nothing to verify against — and a route that
 * accepted unsigned posts would let anyone fabricate an order and dispatch a
 * driver to buy materials with no cart behind it. Route handlers check this and
 * return a notice rather than throwing.
 *
 * The alias domain is checked too, because it is what the customer-facing
 * address is rendered from: without it there is no address to give a customer,
 * and mail would be sent nowhere.
 *
 * MAILGUN_API_KEY is deliberately not required here. It covers outbound sending
 * and the Messages API, neither of which the inbound path uses.
 *
 * The account is temporary until the client's is set up. Everything is read
 * from the environment so swapping it stays a config change — see
 * docs/architecture/11-deployment-and-environments.md#swapping-the-mailgun-account.
 */
export function isMailgunConfigured(): boolean {
  return Boolean(
    process.env.MAILGUN_SIGNING_KEY && process.env.ORDER_ALIAS_DOMAIN,
  );
}
