# ADR-0012: Web Push to the home-screen app before text messages

- **Status:** Accepted
- **Date:** 2026-11-18
- **Deciders:** Delivery App team

## Context

Nothing is sent today: no email, text or push. The dispatcher copies a job link from the console and sends it to drivers by hand, and customers see changes only when they open the portal.

[08-notifications](../architecture/08-notifications.md) planned Twilio texts for drivers. Since then the app has become installable to a phone's home screen (web manifest, start URL `/login`, icons).

What a notification opens matters more than how it arrives. A tapped push notification opens the installed app, already signed in. A link in a text opens Safari on iPhone, which may be signed out, so the driver has to log in before they can accept the job.

The pilot's users are a small group who will be trained to install the app and turn notifications on.

## Decision

**Web Push to the home-screen app comes first.** It is planned for:

- **Drivers:** a new job is posted.
- **Customers:** the order is sent for approval, the driver is on the way, the order is delivered.
- **Dispatchers:** every driver has declined a job.

**Twilio texts come later, as a fallback** for anyone whose push notifications stop working.

Neither is built yet.

## Consequences

### Positive

- One tap from the notification to the job or order, in the app the user is already signed in to.
- No carrier registration. Texts need A2P 10DLC registration with a multi-day lead time; its cost is minor (about $20 to register and $20/month at 50 texts a day, checked 2026-11-18), so this is about the experience, not the money.
- No per-message cost.

### Negative / trade-offs

- **No delivery receipt.** We know a push was sent, not that it was seen.
- **Permission can lapse.** A user can turn notifications off, or a subscription can die, without telling us. Dispatchers need to see who has notifications on.
- **Every user must install the app.** On iPhone, push only works from the home-screen app, and only on the deployed site, so testing needs real phones.
- The VAPID key pair is generated once. Changing it later breaks every subscription.
- Until texts exist, a user without working push gets nothing, and the dispatcher falls back to sending the link by hand.

## Alternatives considered

| Alternative | Why not |
|---|---|
| **Twilio texts first** | A texted link opens Safari on iPhone, which may be signed out. Needs A2P 10DLC registration first. Kept as the later fallback |
| **Email** | Not a channel drivers watch for time-sensitive jobs, and outbound email is not built either |
| **A native app** | App store builds and review for a small pilot group; the home-screen web app already gives push |
| **Keep sending links by hand** | Works for now, but depends on a dispatcher noticing every change |

## Related

- [08-notifications](../architecture/08-notifications.md)
- [ADR-0013](0013-automatic-posting-first-accept-wins.md) — the new-job notification replaces the copied link
