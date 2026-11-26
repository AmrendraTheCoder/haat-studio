# Deploying on Vercel

```bash
vercel --prod
```

`vercel.json` downloads the preset models and sample garments during the build (`npm run setup`),
then runs `next build`. `.vercelignore` keeps training code, datasets, the report and `.env` out of the upload.

## Environment variables (Vercel → Project → Settings → Environment Variables)

| Name | Needed for | Notes |
|---|---|---|
| `HF_TOKEN` | photos | Hugging Face token; anonymous ZeroGPU calls are refused |
| `GEMINI_API_KEY` or `GROQ_API_KEY` | captions, research | without one, the labelled templates are used |
| `STUDIO_PASSCODE` | every public link | there is no login; without it anyone spends your free GPU quota |

Redeploy after changing them.

## Limits of this host

- The project folder is read-only, so `DATA_DIR` defaults to `/tmp/haat-data`. Saved photos, the quota
  ledger and research reports live on one instance and disappear when Vercel recycles it. A result
  link can therefore stop working later; the Docker image on a host with a disk (`/data`) keeps them.
- A running job lives in that instance's memory, so re-attaching from another tab may start fresh.
- `/api/tryon` asks for 300 s (`maxDuration`), the most a Hobby project allows; a try-on takes about 32 s.
