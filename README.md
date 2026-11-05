# MathTube

**[mathtube.in](https://mathtube.in)** — YouTube, but only the math videos Hacker News keeps recommending.

Inspired by [HackerTube](https://hackertube.org) by Andrej Karpathy. A static site: one `index.html` plus `data/videos.json`. No backend, no accounts; likes / watch later / history live in the browser's localStorage.

## Run locally

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Rebuild the data

Download and unzip the HackerTube dataset from https://hackertube.org/data, then:

```bash
python scripts/build_data.py path/to/hackertube-data
```

The script keeps videos in HackerTube's math categories (dropping ones where math is only an incidental tag), attaches up to 8 HN comments each and the related-video graph.

## Deploy

GitHub Pages serves the `main` branch root; `CNAME` points it at mathtube.in.

## Credits

Data from [HackerTube](https://hackertube.org) under [ODC-By 1.0](https://opendatacommons.org/licenses/by/1-0/), derived from [open-index/hacker-news](https://huggingface.co/datasets/open-index/hacker-news). Hacker News data is provided by Y Combinator; comments remain the work of their authors. Videos belong to their creators on YouTube. Not affiliated with YouTube, Google, Hacker News or Y Combinator.
