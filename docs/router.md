# The model router

Saboteur can run on any of these providers, or several at once. Set the keys you have in `.env.local`
(or `.env`); everything else is automatic.

| Provider | Key variables | Endpoint | Models |
|---|---|---|---|
| Anthropic | `ANTHROPIC_API_KEY` | native SDK | the Claude models named in `lib/config.ts` |
| OpenRouter | `OPENROUTER_API_KEY`, `_2`, `_3` | `openrouter.ai/api/v1` | catalogue, plus any `:free` model it lists |
| Groq | `GROQ_API_KEY`, `_2`, `_3` | `api.groq.com/openai/v1` | catalogue (only those it still lists) |
| Gemini | `GEMINI_API_KEY` | Google's OpenAI-compatible endpoint | catalogue (only those it still lists) |
| NVIDIA | `NVIDIA_API_KEY` | `integrate.api.nvidia.com/v1` | catalogue (only those it still lists) |
| Cohere | `COHERE_API_KEY` | Cohere's compatibility API | catalogue |
| LLM7 | `LLM7_API_KEY` | `api.llm7.io/v1` | whatever it lists (capability guessed from the name) |
| Kilo | `KILO_API_KEY` | `api.kilo.ai/api/openrouter` (**unverified**: set `KILO_BASE_URL` if it differs) | its `:free` models |

Any key variable can have numbered copies (`_2` … `_9`); each one is its own route with its own limits.
Empty variables are ignored. With no keys at all (and no `SABOTEUR_MOCK=1`), Saboteur plays offline.

## How a request is routed (`lib/router/router.ts`)

Adapted from Reticle's Go router.

- **Routes.** Every model of every provider, once per key: `groq/llama-3.3-70b-versatile@GROQ_API_KEY_2`.
  The catalogue (`lib/router/providers.ts`) is checked hourly against each provider's `/models`, so
  retired free models drop out; OpenRouter, Kilo and LLM7 also add new free models, with a capability
  guessed from the name (size, family).
- **What a request needs.** Writing, planting, verifying and diagnosing need capability 3+; grading
  and label tidying take anything. Pictures (autopsy photos) need a vision model; that's never relaxed.
  When Anthropic is set up, the exact Claude model a prompt names is used first.
- **Choosing.** Candidates are sorted by capability, then cost, then learned score; the prompt's effort
  picks a point along that line (low effort, smaller model). Keys of the same model take turns.
- **Learning.** Each route keeps a success score per task (moving average, starting at 0.9). Bad JSON,
  refusals and "can't take this request" lower it; routes below 0.5 are only used when nothing better is
  left. Scores are saved to `.saboteur/routing.json` where the disk is writable.
- **Failures** (`lib/router/transport.ts` sorts them):

  | Failure | Effect |
  |---|---|
  | Rate limit (429) | that key rests 60 s (or the provider's Retry-After) and its concurrent-request allowance halves, once per window; it grows back by one with each busy success |
  | Quota or credit gone | that key is out 15 min (longer if the provider names a reset) |
  | Key refused (401/403) | that key is out 24 h (restart after fixing it) |
  | Model not found / retired | that route is out 6 h |
  | Server error, timeout | that route rests 20 s |
  | Bad JSON, refusal, too long | that route's score drops; the request moves on |

  A request tries up to six routes. If every failure was about availability, the error is marked
  "unavailable" and round generation falls back to the offline engine, as it always has.
- **Explaining.** When nothing is left, the error carries a count of why
  (`routes=12, tried=3, key unavailable=6, cooling down=2, …`). In development, `GET /api/engine` lists
  resting keys and routes with their reasons (never the keys themselves).

## Adding a model by hand

`SABOTEUR_ROUTES=groq:qwen/qwen3-32b:3,gemini:gemini-3-flash:4:vision`: provider, model id, capability
(1–5), and `vision` if it reads pictures. A provider's endpoint can be moved with `<NAME>_BASE_URL`
(`OPENROUTER_BASE_URL`, `KILO_BASE_URL`, …).

## Caveats

- The free models listed in the catalogue were current when it was written; discovery prunes the ones
  that have gone, but new strong models only appear automatically on OpenRouter, Kilo and LLM7. Add
  others with `SABOTEUR_ROUTES`.
- Quality varies far more across free models than across Claude models. Run `npm run eval:autopsy` and
  `npm run eval:targeting -- llm` after changing keys, and read the autopsy report.
- Prompts ask for JSON in plain text (no provider-specific JSON mode), and replies are validated with
  Zod and retried once on another route, so a model that can't follow the format just loses score.
