// Ofrenda for the Dead Web.
//   node src/ofrenda.js run <domain> "<Name>" [--died YYYY-MM-DD]   writes ofrendas/<slug>.json
//   node src/ofrenda.js page                                          writes docs/index.html
// Needs GEMINI_API_KEY (for Gemma) and SERPAPI_KEY (skipped when --died is given).
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as L from "./lib.js";
import { renderPage } from "./page.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL = process.env.GEMMA_MODEL || "gemma-4-31b-it";
const MAX_BYTES = 3_000_000;
const MAX_TEXT = 12_000;
const ENGINE = "duckduckgo";
// The Internet Archive blocks an address for a while after too many requests. Be gentle.
// ponytail: one fixed gap per process, enough for a handful of sites; add a shared queue for big batches.
const ARCHIVE_GAP_MS = 6_000;
let nextArchiveAt = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, { json = false, hops = 5 } = {}) {
  let u = url;
  for (let i = 0; i <= hops; i++) {
    await sleep(nextArchiveAt - Date.now());
    nextArchiveAt = Date.now() + ARCHIVE_GAP_MS;
    const res = await fetch(u, {
      redirect: "manual",
      signal: AbortSignal.timeout(90_000),
      headers: {
        "user-agent":
          "dead-web-ofrenda/0.1 (+https://github.com/brasspage/dead-web-ofrenda)",
      },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      const next = new URL(res.headers.get("location"), u);
      // Every hop must stay on the archive over https.
      if (next.protocol !== "https:" || next.hostname !== L.ARCHIVE_HOST)
        throw new Error(`redirect off the archive: ${next.host}`);
      u = next.href;
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} from ${new URL(u).host}`);
    if (Number(res.headers.get("content-length")) > MAX_BYTES)
      throw new Error(
        `page too big: ${res.headers.get("content-length")} bytes`,
      );
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES)
      throw new Error(`page too big: ${buf.length} bytes`);
    const text = buf.toString("utf8");
    return json ? JSON.parse(text) : { text, url: u };
  }
  throw new Error("too many redirects");
}

async function search(query) {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error("SERPAPI_KEY is not set");
  // DuckDuckGo, because SerpApi's Google results now hide most target links behind /goto redirects.
  const q = new URLSearchParams({
    engine: ENGINE,
    q: query,
    kl: "us-en",
    api_key: key,
  });
  const res = await fetch(`https://serpapi.com/search.json?${q}`, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`SerpApi ${res.status}`);
  const data = await res.json();
  return (data.organic_results || []).map((r) => ({
    title: r.title || "",
    link: r.link || "",
    snippet: r.snippet || "",
    date: r.date || "",
  }));
}

async function gemma(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.8,
      responseMimeType: "application/json",
    },
  };
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      },
    );
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await sleep(15_000 * attempt);
      continue;
    }
    if (!res.ok)
      throw new Error(
        `Gemma ${res.status}: ${(await res.text()).slice(0, 200)}`,
      );
    const data = await res.json();
    // Gemma 4 sends its thinking as parts marked "thought". Keep only the answer.
    return (data.candidates?.[0]?.content?.parts || [])
      .filter((p) => !p.thought)
      .map((p) => p.text || "")
      .join("");
  }
}

async function run(domainArg, name, diedArg) {
  const domain = L.checkDomain(domainArg);
  if (!name) throw new Error("give the site a name");
  if (diedArg && !/^\d{4}-\d{2}-\d{2}$/.test(diedArg))
    throw new Error("--died must be YYYY-MM-DD");
  const log = { domain, name, model: MODEL, started: new Date().toISOString() };
  try {
    return await steps(log, diedArg);
  } catch (e) {
    // Saved with the search, so the next run spends no search credit on it.
    return save(
      log,
      `stopped: ${e.message}${e.cause ? ` (${e.cause.code || e.cause.message})` : ""}`,
    );
  }
}

async function steps(log, diedArg) {
  const { domain, name } = log;
  // 1. Obituary: when and why it died, from a web search, with the source kept.
  if (diedArg) {
    log.obituary = {
      ok: true,
      died: diedArg,
      cause: "",
      source: null,
      by: "hand",
    };
  } else {
    // Reuse the last search for this site, so a re-run spends no search credit.
    const query = `${name} shut down date`;
    const prev = JSON.parse(
      await readFile(fileOf(domain), "utf8").catch(() => "{}"),
    );
    const all =
      prev.search?.query === query && prev.search.engine === ENGINE
        ? prev.search.results
        : await search(query);
    const results = all.filter((r) => L.safeHref(r.link)).slice(0, 8);
    log.search = { engine: ENGINE, query, results };
    const raw = await gemma(L.obituaryPrompt(name, results));
    log.obituary = { raw, ...L.checkObituary(L.parseModelJson(raw), results) };
    if (!log.obituary.ok)
      return save(log, `obituary failed: ${log.obituary.why}`);
  }
  const { died, cause } = log.obituary;

  // 2. The last good capture before the day it died.
  const last = L.cdxRow(
    await get(L.lastCaptureUrl(domain, L.dayBefore(died)), { json: true }),
  );
  if (!last) return save(log, "no capture before it died");
  const page = await get(L.snapshotUrl(last.timestamp, last.original, "id_"));
  const text = L.htmlToText(page.text);
  const img = L.pageImage(page.text, last.original);
  log.snapshot = {
    timestamp: last.timestamp,
    date: L.tsToDate(last.timestamp),
    url: L.snapshotUrl(last.timestamp, last.original),
    title: L.pageTitle(page.text),
    image: img ? L.snapshotUrl(last.timestamp, img, "im_") : null,
    text_chars: text.length,
  };

  // 3. The ofrenda. If the quote is not on the page, ask once more, then leave it out.
  log.attempts = [];
  for (let i = 0; i < 2; i++) {
    const raw = await gemma(
      L.ofrendaPrompt(name, died, cause, text.slice(0, MAX_TEXT)),
    );
    const o = L.parseModelJson(raw) || {};
    const verified = L.verifyQuote(o.last_words || "", text);
    log.attempts.push({ raw, verified });
    log.ofrenda = {
      what: String(o.what ?? ""),
      last_words: verified ? String(o.last_words) : null,
      calavera: String(o.calavera ?? ""),
    };
    if (verified) break;
  }
  return save(log, null);
}

const fileOf = (domain) => join(ROOT, "ofrendas", `${L.slugOf(domain)}.json`);

async function save(log, error) {
  log.error = error;
  log.finished = new Date().toISOString();
  await mkdir(join(ROOT, "ofrendas"), { recursive: true });
  const file = fileOf(log.domain);
  await writeFile(file, `${JSON.stringify(log, null, 2)}\n`);
  console.log(`${log.domain}: ${error || "ok"} -> ${file}`);
  return log;
}

async function page() {
  const dir = join(ROOT, "ofrendas");
  const logs = await Promise.all(
    (await readdir(dir))
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => JSON.parse(await readFile(join(dir, f), "utf8"))),
  );
  await mkdir(join(ROOT, "docs"), { recursive: true });
  await writeFile(join(ROOT, "docs", "index.html"), renderPage(logs));
  console.log(
    `docs/index.html: ${logs.filter((l) => !l.error).length} ofrendas, ${logs.filter((l) => l.error).length} failed`,
  );
}

const [cmd, ...args] = process.argv.slice(2);
const diedAt = args.indexOf("--died");
const died = diedAt >= 0 ? args.splice(diedAt, 2)[1] : null;
if (cmd === "run") await run(args[0], args[1], died);
else if (cmd === "page") await page();
else
  console.log(
    'usage: node src/ofrenda.js run <domain> "<Name>" [--died YYYY-MM-DD] | page',
  );
