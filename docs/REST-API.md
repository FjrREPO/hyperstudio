# REST API

`@hyperstudio/api` is a versioned HTTP API over `@hyperstudio/studio`. It is defined as a route table
(`packages/api/src/routes.ts`); the server and the OpenAPI document are both generated from it.

```bash
HYPERSTUDIO_API_KEY=<16+ chars> node packages/api/src/server.ts --port 3901 --workspace <dir>
curl -H "Authorization: Bearer $HYPERSTUDIO_API_KEY" http://127.0.0.1:3901/api/v1/projects
```

The server will not start without `HYPERSTUDIO_API_KEY`. It binds to `127.0.0.1` unless `--host` says otherwise.

## Routes (under `/api/v1`)

| Method | Path                         | Does                                            |
| ------ | ---------------------------- | ----------------------------------------------- |
| GET    | `/projects`                  | List projects                                   |
| POST   | `/projects`                  | Create a project: `{ name, ir? }` → 201         |
| GET    | `/projects/:name`            | IR, plan, files, renders                        |
| PUT    | `/projects/:name/ir`         | Replace the IR and validate it: `{ ir }`        |
| POST   | `/projects/:name/validate`   | Plan and problems, writing nothing              |
| POST   | `/projects/:name/compile`    | Compile                                         |
| POST   | `/projects/:name/review`     | Check and snapshot every shot                   |
| POST   | `/projects/:name/renders`    | Start a render: `{ quality? }` → 202 with a job |
| GET    | `/projects/:name/render`     | The finished file, checked against the plan     |
| GET    | `/projects/:name/assets`     | Assets, licences, credits owed                  |
| GET    | `/jobs`, `/jobs/:id`         | Jobs and one job's status                       |
| DELETE | `/jobs/:id`                  | Cancel a job                                    |
| GET    | `/recipes`, `/recipes/:name` | Recipes                                         |
| GET    | `/schema`                    | JSON Schema of the Creative IR                  |
| POST   | `/assets/search`             | `{ query, kind, limit? }`                       |
| GET    | `/audio/providers`           | Voiceover providers and their terms             |
| GET    | `/openapi.json`              | OpenAPI 3.1 description of all of the above     |

## Behaviour

- **Authentication**: `Authorization: Bearer <key>` on every request, compared in constant time. Otherwise 401.
- **A rejected IR is a result, not an error**: `validate`, `compile` and `PUT …/ir` answer 200 with
  `{ ok: false, errors: [{ path, message }] }`.
- **Errors**: `{ "error": { "code", "message" } }` with 400 (bad request or name), 404 (no such project, job or
  recipe), 409 (project exists), 429, 500.
- **Rendering is asynchronous**: start it, get a job, poll `/jobs/:id` until `state` is `done`, `failed` or
  `cancelled`.
- **Idempotency**: send `Idempotency-Key` when starting a render; the same key returns the same job.
- **Rate limit**: 120 requests a minute per server by default, then 429.
- **Body limit**: 1 MB of JSON.

## Not built

Webhooks, per-user API keys and project isolation, file upload and download over HTTP (assets and renders are
files in the workspace), a persistent idempotency store (keys are remembered until the server restarts), and
TLS. These matter for a hosted service; this API is for a server you run yourself.
