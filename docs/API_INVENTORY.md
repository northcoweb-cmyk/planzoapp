# API Inventory

Which keys you need, when, and which are safe in a browser.

## Required now — to run everything built

| Service | Key | Cost | Where |
|---|---|---|---|
| **None** | — | **$0** | Planzo runs fully with an empty `.env` |

Storage falls back to local JSON, weather is keyless, the planning engine is
deterministic. Everything in the product works. Nothing is faked.

## Required to make it good

| Service | Env var | Browser-safe? | Cost |
|---|---|---|---|
| Upstash Redis | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | **SERVER-ONLY** | Free tier — you already have this |
| Open-Meteo (weather) | none needed | n/a | **Free, no account** |
| Anthropic (intent parsing) | `ANTHROPIC_API_KEY` | **SERVER-ONLY** | ~$0.10 per 1,000 plans, hard-capped |
| Google Maps Platform (Places) | `GOOGLE_MAPS_API_KEY` | **SERVER-ONLY**, restrict to Places API by IP | ~$0.032/search, hard-capped. $200/mo free credit |

**`PLANZO_SECRET` is required in production.** The server refuses to start
without it rather than signing sessions and ticket tokens with a default.

## Required later — do not sign up yet

| Service | When you actually need it |
|---|---|
| Stripe | The day someone pays for Pro. `STRIPE_PUBLISHABLE_KEY` is browser-safe; the secret never is |
| Event provider (Ticketmaster / SeatGeek / Eventbrite) | When event discovery matters more than venue search |
| Brevo or Resend | When you send reminder emails |
| Push (VAPID) | When plan reminders need to reach a closed app |
| Twilio | Last. Per-message cost forever, and email covers reminders |

## Key safety

Browser-safe means "designed by the vendor to be public." Today that is exactly
one key, and it isn't needed yet: `STRIPE_PUBLISHABLE_KEY`.

Everything else is server-only and stays in `services/` — the client never sees
a provider key, because the client never talks to a provider. It talks to
`/api/*`, which is metered, cached and rate-limited.

## Setting up Google Places when you're ready

1. Google Cloud Console → new project → enable **Places API (New)**
2. Create an API key, restrict it to Places API only, and add an IP restriction
   for your Render service
3. Set a **billing budget alert** at $10 in Google Cloud — belt and braces
   alongside Planzo's own ceiling
4. Put the key in `GOOGLE_MAPS_API_KEY` and leave `PLANZO_PLACES_DAILY_USD`
   at $2.00 until you see real traffic
