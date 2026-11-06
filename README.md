# MathTube

**[mathtube.in](https://mathtube.in)** — YouTube, but only the math videos worth your time.

It starts from the math videos Hacker News keeps recommending (from [HackerTube](https://hackertube.org) by Andrej Karpathy) and grows with the community:

- **Share** a YouTube math video (sign in with GitHub), **upvote** the good ones on the Community page
- **Playlists**: build learning paths in order, browse everyone's, play all on YouTube
- Likes, Watch later and History stay in your browser

## How it's built

- `index.html` — the whole frontend, plain HTML/CSS/JS, no build step
- `data/videos.json` — the curated videos, made by `scripts/build_data.py`
- `data/paths.json` — the "Start here" learning paths (hand-picked video ids, in order)
- `data/library.json` — Library websites and YouTube playlists, checked by `scripts/check_library.py`
- `data/repos.json` — math GitHub repos, made by `scripts/build_repos.py`
- `api/` — Vercel serverless functions (Node), data in MongoDB Atlas
  - `auth/login`, `auth/callback`, `auth/logout` — GitHub sign-in, signed session cookie
  - `me` — who is signed in and what they upvoted
  - `videos` — list / share community videos (checked against YouTube oEmbed)
  - `vote` — toggle an upvote
  - `playlists` — create, list, edit, delete playlists

If the API is unreachable, the curated site still works on its own.
Community features (sign-in, sharing, playlists) are switched off by `COMMUNITY = false` in `index.html`.
Donate buttons appear once `DONATE_URL` in `index.html` is set.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill it in:
   - `MONGODB_URI` (no password in it), `MONGODB_USER`, `MONGODB_PASSWORD` from MongoDB Atlas
     (free M0 cluster; Network Access must allow `0.0.0.0/0` for Vercel)
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` from a GitHub OAuth App
     (github.com/settings/developers, callback URL `https://<your-domain>/api/auth/callback`;
     a second app with `http://localhost:3000/api/auth/callback` for local dev)
   - `SESSION_SECRET` (optional): signs login cookies; derived from `GITHUB_CLIENT_SECRET` when empty
3. `npm run dev` (runs `vercel dev`, needs `npx vercel login` once) and open http://localhost:3000

## Browser extension

`extension/` turns youtube.com into MathTube: it hides every non-math video, Shorts and feed shelves.
Each video is judged by keywords instantly, then by a small AI model (all-MiniLM-L6-v2, run with
Transformers.js) that ships inside the extension and runs on the user's computer, so nothing leaves the browser.
In the popup the user can also type a topic ("linear algebra for beginners") to see only that.
The model and runtime files aren't committed: `npm install && npm run build:extension` copies them from `node_modules` and downloads the model (see `extension/lib/NOTICE.md`).

Try it: run `npm run build:extension`, open `chrome://extensions`, turn on Developer mode, click **Load unpacked**, pick the `extension` folder.

## Test

```bash
npm test
```

Runs the API flows against a throwaway in-memory MongoDB, no accounts needed.

## Deploy

Vercel project linked to this repo; set the same env vars in the Vercel dashboard. Deploy production from `main` with `npx vercel --prod` (the Vercel GitHub app is not installed, so pushes don't auto-deploy).

## Rebuild the curated data

Download and unzip the HackerTube dataset from https://hackertube.org/data, then:

```bash
python scripts/build_data.py path/to/hackertube-data
```

Refresh the GitHub repos (token optional, avoids rate limits) and re-check the library links:

```bash
GITHUB_TOKEN=$(gh auth token) python scripts/build_repos.py
python scripts/check_library.py
```

## Credits

Curated data from [HackerTube](https://hackertube.org) under [ODC-By 1.0](https://opendatacommons.org/licenses/by/1-0/), derived from [open-index/hacker-news](https://huggingface.co/datasets/open-index/hacker-news). Hacker News data is provided by Y Combinator; comments remain the work of their authors. Videos belong to their creators on YouTube. Not affiliated with YouTube, Google, Hacker News or Y Combinator.
