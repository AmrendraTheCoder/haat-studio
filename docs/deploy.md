# Deploying Haat Studio

Three ways to run it, from safest-for-a-demo to public link. All of them are free.

| Option | Who can open it | Cost | Best for |
|---|---|---|---|
| **A. Your laptop** | You (and anyone on your screen/projector) | ₹0 | The professor demo — most reliable |
| **B. Hugging Face Space** (Docker) | Anyone with the link | ₹0 (free CPU Space) | A public link to share |
| **C. Any Docker host** (Render, Railway, a college server) | Anyone with the link | Free tiers vary | If B doesn't suit |

The heavy work — the try-on itself — never runs on your server. It runs on Hugging
Face's free GPUs through the FASHN Space, so the server only needs a small CPU.

## Settings (all options)

Set these as environment variables (`.env` locally, "Secrets" on Hugging Face):

| Variable | Needed? | What it does |
|---|---|---|
| `HF_TOKEN` | **Yes** | Free Hugging Face *read* token. Without it, no photos can be generated. |
| `GROQ_API_KEY` | Recommended | Free Groq key (console.groq.com, no card). AI-written captions and research; without it they're clearly labelled templates. |
| `GEMINI_API_KEY` | Optional | Free Google AI Studio key — a second text-AI provider if Groq is down. |
| `STUDIO_PASSCODE` | **Yes on a public link** | Creating anything needs this passcode, so strangers can't use up your free quota. |
| `CURATION` | Optional | `on` lets you feature results on the home page. Off by default in production. Pair it with `STUDIO_PASSCODE`. |
| `DATA_DIR` | Set by the image | Where results and reports are saved (`/data` in Docker). |

## A. Your laptop (for the demo)

```bash
npm install
npm run setup            # preset model photos and sample garments
cp .env.example .env     # then fill in HF_TOKEN (and GROQ_API_KEY)
npm run engine:check     # confirms the token and the FASHN Space — uses no GPU
npm run build
npm run start:standalone # production server on http://localhost:3000
```

Before presenting: open the studio once and generate (or open) a photo, so the
GPU is warm (~13 s per photo instead of ~30 s) and featured examples are ready.

## B. Hugging Face Space (free public link)

1. Create a token with **write** access at <https://huggingface.co/settings/tokens>
   (your existing read token can't create Spaces).
2. Go to <https://huggingface.co/new-space>. Name it `haat-studio`, choose
   **Docker → Blank**, hardware **CPU basic (free)**, visibility as you like.
3. In the Space: **Settings → Variables and secrets** → add secrets
   `HF_TOKEN`, `STUDIO_PASSCODE`, and optionally `GROQ_API_KEY`; add variable
   `CURATION=on` if you want to feature results there.
4. Push this project to the Space. From the project folder:

   ```bash
   git remote add space https://huggingface.co/spaces/<your-username>/haat-studio
   git push space main
   ```

   When asked for a password, use the **write** token.

5. The Space reads its settings from the top of `README.md`. This repo's
   README doesn't have them (GitHub would show them as a table), so before the
   push above, add this block to the very top of `README.md` in a commit
   only for the Space:

   ```yaml
   ---
   title: Haat Studio
   emoji: 👗
   colorFrom: yellow
   colorTo: pink
   sdk: docker
   app_port: 7860
   pinned: false
   ---
   ```

6. The Space builds the Dockerfile (5–10 minutes the first time) and shows
   **Running**. Open it, enter the passcode once, and generate.

**Things to know about free Spaces**

- Free storage is wiped when the Space restarts or rebuilds: saved photos,
  featured examples and research reports go with it. Generate and feature
  your demo examples *after* the last rebuild, or pay for persistent storage
  (it mounts at `/data`, which is where the app already saves).
- A free Space sleeps after 48 hours without visitors and takes about a
  minute to wake.
- The GPU quota is your account's: every photo made on the public link uses
  your free daily minutes. That's what `STUDIO_PASSCODE` protects.

## C. Any Docker host

```bash
docker build -t haat-studio .
docker run -p 7860:7860 \
  -e HF_TOKEN=hf_... -e GROQ_API_KEY=gsk_... -e STUDIO_PASSCODE=choose-one \
  -v haat-data:/data \
  haat-studio
```

Open <http://localhost:7860>. The `-v haat-data:/data` volume keeps results
across restarts. Hosts like Render or Railway build the same Dockerfile from
the GitHub repo. Set the variables in their dashboard, and set `PORT` if the
host requires a specific one.

## Before going public — checklist

- [ ] `STUDIO_PASSCODE` set (otherwise anyone can spend your GPU quota)
- [ ] `npm run engine:check` passes with the deployed `HF_TOKEN`
- [ ] Generated at least one photo on the deployed copy and checked it
- [ ] `CURATION=on` only together with a passcode
- [ ] Remember the licensing note in the README: the default FASHN pipeline
      includes a research-only component, so keep the deployment non-commercial.
