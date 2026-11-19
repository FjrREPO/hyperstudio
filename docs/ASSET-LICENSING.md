# Asset licensing

What HyperStudio's asset sources allow, as stated in each provider's own documentation on 2026-11-19.
This is a summary to work from, not legal advice, and terms change: read the linked terms before publishing.

**Two different things are licensed.** The _software_ (an SDK, an API) and the _content_ it returns. An
open-source SDK does not make what it finds free to use. Every asset is judged by its own licence.

## Policy

1. Open-source software and free APIs only. No subscription, no paid fallback.
2. CC0 and public domain are preferred; attribution licences are used with their credit.
3. Commercial use must be explicitly permitted by the asset's own licence.
4. An unknown or unverifiable licence is `needs-review` and is never selected automatically.
5. No scraping, no bulk downloading, no working around a provider's limits.
6. An API key is never assumed to exist or to be free.

## Sources in use

### Openverse

|                |                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Software       | API is MIT                                                                                                                |
| Access         | Anonymous requests allowed; registration unlocks higher limits. Exceeding a limit returns HTTP 429                        |
| Content        | Per item: CC0, PDM, CC BY, BY-SA, BY-NC, BY-ND and combinations. Each result carries its licence, version and licence URL |
| Commercial use | Depends on the item. HyperStudio returns only CC0, public domain and CC BY automatically                                  |
| Attribution    | Required for CC BY items; the credit line is generated and stored in the ledger                                           |
| Restrictions   | The terms forbid scraping. Results are capped at 10,000 per query                                                         |
| Caveat         | Openverse aggregates licence data from the hosting sites. Confirm on the item's own page                                  |

Terms: https://docs.openverse.org/terms_of_service.html

### Poly Haven

|                |                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| Software       | Their API server is AGPL-3.0; HyperStudio only calls it                                              |
| Access         | No key. "All requests to the API require a unique User-Agent header"; HyperStudio sends one          |
| Content        | CC0 for every asset: textures, HDRIs, models                                                         |
| Commercial use | Allowed, for the API and for the assets                                                              |
| Attribution    | Not required for the assets. When results from the live API are shown, say they come from Poly Haven |
| Rate limits    | Not stated                                                                                           |

Terms: https://github.com/Poly-Haven/Public-API/blob/master/ToS.md · Licence: https://polyhaven.com/license

### Pixabay (optional, needs a free key)

|                |                                                                                                                                                                                                                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Software       | Proprietary API, free with an account                                                                                                                                                                                                                                                                 |
| Access         | `PIXABAY_API_KEY`. 100 requests per 60 seconds per key                                                                                                                                                                                                                                                |
| Caching        | "Requests must be cached for 24 hours"; HyperStudio's cache does this                                                                                                                                                                                                                                 |
| Content        | Pixabay Content License (content published before 9 January 2019 is CC0)                                                                                                                                                                                                                              |
| Commercial use | Allowed, without attribution, with the limits below                                                                                                                                                                                                                                                   |
| Restrictions   | Not on a standalone basis (no resale or redistribution of the file itself). Not for commercial use when it shows recognisable trademarks, logos or brands. Not in a misleading way, especially with recognisable people. No systematic mass downloads. No permanent hotlinking: download what you use |
| Attribution    | Not required for the content; show where search results come from                                                                                                                                                                                                                                     |

Terms: https://pixabay.com/service/terms/ · API: https://pixabay.com/api/docs/

### refkit

Search, licence normalisation and the source adapters come from refkit (`@refkit/core` and
`@refkit/provider-*`), Apache-2.0. That is the licence of the code. It says nothing about the content found.

## Left out, and why

| Source                 | Reason                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Freesound API          | Its API terms allow non-commercial use only. (Freesound-hosted items still appear through Openverse, each under its own Creative Commons licence) |
| Pexels API             | New API keys are not being issued at the time of writing; to be reviewed when they are                                                            |
| LottieFiles premium    | Paid                                                                                                                                              |
| Any paid stock library | Subscription or per-asset payment                                                                                                                 |

## Licence statuses

| Status                         | Automatic use    | Obligation                                   |
| ------------------------------ | ---------------- | -------------------------------------------- |
| CC0, public domain             | Yes              | None                                         |
| CC BY                          | Yes              | Credit the author; the ledger holds the line |
| Provider commercial licence    | Yes              | Follow the provider's limits                 |
| CC BY-SA                       | No, needs review | Share-alike may apply to the film            |
| Unknown                        | No, needs review | Find and read the licence                    |
| Non-commercial                 | No               |                                              |
| No derivatives, editorial-only | No               |                                              |

## Before publishing a film

1. Run `hyperstudio assets list <film>/assets` and read **Credits owed**.
2. Open each asset's page from `LICENSES.json` and confirm the licence shown there matches.
3. Check the content itself: recognisable people, logos, artworks and trademarks carry rights no licence tag covers.
4. Put the credits in the film or in its description.
