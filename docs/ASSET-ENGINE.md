# Asset engine

`@hyperstudio/assets` finds openly licensed media on free sources, decides for each result whether a
commercial film may use it, downloads what is chosen, and keeps a record. It works with no API key, and with
no network at all for files you already have.

It is a thin layer: search, licence normalisation and source adapters come from
[refkit](https://github.com/refkitjs/refkit) (Apache-2.0). HyperStudio adds the policy for film use, a caching
and logging HTTP layer, the download ledger, and the CLI.

| Module         | Responsibility                                                                            |
| -------------- | ----------------------------------------------------------------------------------------- |
| `providers.ts` | The approved sources, their terms as data, and which are usable right now                 |
| `license.ts`   | Reduce a licence to a status and a verdict for commercial film use                        |
| `http.ts`      | One fetch for all sources: names the application, caches for 24 hours, logs every request |
| `search.ts`    | Search, gate every result, rank by freedom to use                                         |
| `ledger.ts`    | Download, `LICENSES.json`, local files, credits owed                                      |

## Commands

```bash
pnpm hyperstudio assets providers                           # the policy: sources, terms, what is left out
pnpm hyperstudio assets search "soft piano" --kind audio    # image (default), audio or video
pnpm hyperstudio assets download 1 --to <film>/assets --name bed
pnpm hyperstudio assets list <film>/assets                  # local files, their licences, credits owed
pnpm hyperstudio assets usage                               # requests made, network and cached
```

`search` prints a numbered table and remembers it in `.hyperstudio/last-search.json`; `download` takes a
number from it. `--source openverse-audio,polyhaven` restricts sources, `--held-back` also shows what the
gate refused, `--json` gives the full records.

## Sources

| Source                                     | Media                       | Key               | Content licence                             |
| ------------------------------------------ | --------------------------- | ----------------- | ------------------------------------------- |
| Openverse (`openverse`, `openverse-audio`) | Images, audio               | None              | Per item: Creative Commons or public domain |
| Poly Haven (`polyhaven`, `polyhaven-hdri`) | Textures, HDRIs (as images) | None              | CC0, all of it                              |
| Pixabay (`pixabay`, `pixabay-video`)       | Images, video               | `PIXABAY_API_KEY` | Pixabay Content License                     |
| Local files                                | Anything in a folder        | None              | Yours                                       |

A source whose key is missing is skipped and reported. It never fails a search, and a key is never assumed.
Terms, limits and what was left out are in [ASSET-LICENSING.md](ASSET-LICENSING.md).

## The licence gate

Every result gets a status and a verdict for use in a film that is published commercially.

| Status                 | Verdict                       | Meaning                                                  |
| ---------------------- | ----------------------------- | -------------------------------------------------------- |
| `cc0`, `public-domain` | allowed                       | No rights reserved                                       |
| `cc-by`                | allowed with attribution      | Credit the author                                        |
| `provider-commercial`  | allowed (or with attribution) | Allowed by the provider's own licence, within its limits |
| `cc-by-sa`             | needs review                  | Share-alike may bind the film that adapts it             |
| `unknown`              | needs review                  | The licence could not be determined                      |
| `non-commercial`       | denied                        |                                                          |
| `restricted`           | denied                        | No derivatives: it cannot be edited into a film          |

Only _allowed_ results are returned by default and can be downloaded freely. A _needs review_ asset downloads
only with `--accept-review`, which records that a person read its licence. A _denied_ asset never downloads.
Content marked editorial-only by its source is denied whatever its licence.

## The ledger

`download` writes the file and an entry in `LICENSES.json` beside it: title, author, source, the asset's page,
licence and version, the verdict, the credit line owed, and the date. `hyperstudio compile` reads the ledger of
every asset folder a film uses and lists **Credits owed** for the files actually in the film.

A file with no ledger entry is treated as your own. Its rights are yours to know.

## Cost and limits

- Every source is free. There is no paid fallback and nothing here can incur a charge.
- GET responses are cached on disk for 24 hours (Pixabay requires this), in `.hyperstudio/cache/`.
- Every request is logged to `.hyperstudio/usage.jsonl` with host, path, status and whether it came from
  cache. API keys in query strings are redacted before logging.
- HTTP 429 raises a `RateLimitError` carrying the wait the provider asked for. Nothing is retried in a loop.

## What it does not do

- **It does not make anything safe by itself.** Licence data is what each source reports. Openverse aggregates
  it from other sites and can be wrong; confirm on the asset's own page before publishing.
- It does not judge whether an asset is any good, or right for the film. That is the director's job.
- Poly Haven has no search endpoint; the adapter ranks its whole list locally, so relevance is rough and a
  search makes many requests the first time.
- Audio found through Openverse is often hosted by Freesound; the file downloaded is the preview the source
  exposes, under the asset's own Creative Commons licence.
- 3D models are not searched (refkit has no 3D modality). Lottie, fonts and vector files are local only.
