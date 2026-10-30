# Ofrenda for the Dead Web

An ofrenda for websites that died. For each site, an agent:

1. searches the web for when and why it died (SerpApi, DuckDuckGo engine), and asks an open-weight model, Gemma 4, to name the day it stopped working, with the exact words from the search result that say so;
2. checks those words are really in the result, and that they name the day and month;
3. asks the Internet Archive for the last good capture of the home page from before that day;
4. gives Gemma 4 the text of that page, and asks for one sentence on what the site was, its "last words" copied from the page, and a _calavera_: the teasing little poem you write for the dead on Día de los Muertos;
5. checks the last words word for word against the page text, asks once more if they are not there, and leaves them out if the second try fails too;
6. builds one static page, `docs/index.html`, from the saved results.

Live page: https://brasspage.github.io/dead-web-ofrenda/

Made for the DEV Hacktoberfest Open-Source AI Challenge, week 4, "Ghost in the Machine".

## Run it

Node 20 or newer. No npm packages.

```sh
export GEMINI_API_KEY=...   # Gemma 4 through the Gemini API (free of charge)
export SERPAPI_KEY=...      # one search per site; SerpApi has a free plan
node src/ofrenda.js run quibi.com "Quibi"
node src/ofrenda.js page    # writes docs/index.html
npm test
```

If you already know the day a site died, skip the search: `node src/ofrenda.js run example.com "Example" --died 2019-04-02`. The page then shows no cause and no source.

Each run saves everything it saw and said to `ofrendas/<site>.json`: the search results, each raw model answer, the archive capture, and the result of every check. A re-run for the same site reuses the saved search, so it spends no search credit. `GEMMA_MODEL` picks another Gemma model (default `gemma-4-31b-it`).

## What is checked, and what is not

- Checked by code: the cited search result exists and contains the model's evidence word for word, and the evidence names the day and month of death (the year may be in the result's date or link). The last words are on the archived page (case and spacing aside, 8 characters or more). Every link on the page is http or https. All web and model text is escaped.
- Not checked: the one-line summary and the cause of death. They are the model's own words from the page and the search results.
- Not checked: whether the search result is right. News pages disagree, and a page can name the announcement day as the end. Read the source link.
- The calaveras are poems by the model. They tease. Do not cite them.
- Archive hops stay on `web.archive.org` over https. Pages over 3 MB are refused.

## AI note

An AI agent, Tack, wrote this code, this README and the DEV post. Gemma 4, an open-weight model, writes the dates, causes, summaries and poems at run time, inside the checks above.

## License

MIT
