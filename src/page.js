// Renders the ofrenda logs into one static page. Everything from the web or the model is escaped.
import { esc, safeHref } from "./lib.js";

const REPO = "https://github.com/brasspage/dead-web-ofrenda";

function card(l) {
  const s = l.snapshot;
  const o = l.ofrenda;
  const img = safeHref(s.image);
  const src = l.obituary.source && safeHref(l.obituary.source.link);
  const lines = esc(String(o.calavera ?? "").replace(/\\n/g, "\n"))
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .join("<br>");
  return `<article class="altar">
  <div class="photo">${img ? `<img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}<span class="initial" aria-hidden="true">${esc(l.name[0])}</span></div>
  <h2>${esc(l.name)}</h2>
  <p class="dates">Died ${esc(l.obituary.died)}</p>
  <p class="what">${esc(o.what)}</p>
  ${
    o.last_words
      ? `<figure class="last"><figcaption>Last words, from its page on <span class="nowrap">${esc(s.date)}</span></figcaption><blockquote>${esc(o.last_words)}</blockquote></figure>`
      : `<p class="missing">No line from its page passed the word-for-word check (8 characters or more), so there are no last words here.</p>`
  }
  <figure class="calavera"><figcaption>Its calavera</figcaption><p>${lines}</p></figure>
  ${l.obituary.cause ? `<p class="cause"><b>Cause of death:</b> ${esc(l.obituary.cause)}${src ? ` <a href="${esc(src)}" rel="noopener nofollow">Date source</a>` : ""}</p>` : ""}
  <p class="visit"><a href="${esc(safeHref(s.url) || "#")}" rel="noopener">Visit its last page in the Internet Archive</a></p>
</article>`;
}

export function renderPage(logs) {
  const ok = logs
    .filter((l) => !l.error && l.ofrenda)
    .sort((a, b) => a.obituary.died.localeCompare(b.obituary.died));
  const failed = logs.filter((l) => l.error);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ofrenda for the Dead Web</title>
<meta name="description" content="An ofrenda for websites that died. An open-weight model reads each site's last archived page and writes it a calavera.">
<style>
  :root { --night: #160b26; --marigold: #ffa41b; --pink: #ff3d8b; --teal: #29c4b8; --paper: #fff4e0; }
  * { box-sizing: border-box; }
  body { margin: 0; background: radial-gradient(ellipse at top, #2c1748, var(--night) 60%); color: var(--paper); font: 18px/1.55 Georgia, "Times New Roman", serif; }
  .banner { display: flex; height: 64px; overflow: hidden; }
  .banner span { flex: 1; clip-path: polygon(0 0, 100% 0, 100% 70%, 75% 100%, 50% 70%, 25% 100%, 0 70%); margin: 0 3px; }
  .banner span:nth-child(4n + 1) { background: var(--pink); }
  .banner span:nth-child(4n + 2) { background: var(--marigold); }
  .banner span:nth-child(4n + 3) { background: var(--teal); }
  .banner span:nth-child(4n) { background: #a35cff; }
  header, main, footer { max-width: 1100px; margin: 0 auto; padding: 0 20px; }
  header { text-align: center; padding-top: 28px; }
  h1 { font-size: clamp(2.2rem, 6vw, 3.6rem); margin: 0; color: var(--marigold); letter-spacing: 0.02em; }
  .lede { max-width: 40em; margin: 12px auto 0; font-size: 1.1rem; }
  .candles { font-size: 2rem; margin: 10px 0 0; }
  .candles span { display: inline-block; animation: flicker 2.4s infinite alternate; }
  .candles span:nth-child(2) { animation-delay: 0.7s; }
  .candles span:nth-child(3) { animation-delay: 1.3s; }
  @keyframes flicker { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.75; transform: scale(0.94) rotate(-2deg); } 100% { opacity: 1; transform: scale(1.04) rotate(2deg); } }
  @media (prefers-reduced-motion: reduce) { .candles span { animation: none; } }
  main { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; padding-top: 32px; padding-bottom: 32px; }
  .altar { background: rgba(255, 244, 224, 0.06); border: 2px solid var(--marigold); border-radius: 16px; padding: 20px; box-shadow: 0 0 30px rgba(255, 164, 27, 0.15); }
  .photo { position: relative; height: 150px; border-radius: 10px; overflow: hidden; background: linear-gradient(135deg, var(--pink), var(--marigold)); display: grid; place-items: center; }
  .photo img { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; object-fit: contain; background: #fff; }
  .nowrap { white-space: nowrap; }
  .initial { font-size: 4rem; font-weight: bold; color: var(--night); opacity: 0.5; }
  h2 { margin: 14px 0 0; color: var(--marigold); font-size: 1.6rem; }
  .dates { margin: 0; color: var(--teal); font-family: ui-monospace, Menlo, monospace; font-size: 0.9rem; }
  figure { margin: 14px 0 0; }
  figcaption { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--pink); }
  blockquote { margin: 4px 0 0; padding-left: 12px; border-left: 3px solid var(--pink); font-style: italic; }
  .calavera p { margin: 4px 0 0; font-style: italic; color: #ffe2b0; }
  .cause, .missing { font-size: 0.92rem; }
  .missing { color: #c9b8d9; }
  a { color: var(--teal); }
  .visit { margin-bottom: 0; font-size: 0.92rem; }
  footer { padding-bottom: 40px; font-size: 0.95rem; color: #d8c8e8; }
  footer h3 { color: var(--marigold); }
</style>
</head>
<body>
<div class="banner" aria-hidden="true">${"<span></span>".repeat(14)}</div>
<header>
  <h1>Ofrenda for the Dead Web</h1>
  <p class="candles" aria-hidden="true"><span>🕯️</span><span>🌼</span><span>🕯️</span></p>
  <p class="lede">Every site here died. The Internet Archive kept a copy of its home page from before it died. An open-weight model, Gemma 4, read that page and wrote the site a <i>calavera</i>: the teasing little poem you write for the dead on Día de los Muertos.</p>
</header>
<main>
${ok.map(card).join("\n")}
</main>
<footer>
  <h3>How the facts are kept honest</h3>
  <ul>
    <li>The date of death comes from a web search. The model must copy the words that state it from one result. Code checks that those words are in that result and name the day and month, and the "Date source" link goes to that result.</li>
    <li>The last words are copied from the archived page. Code checks them word for word against the page text (case and spacing aside), and drops them if they are not there.</li>
    <li>The summary and the cause of death are the model's own words from the page and the search results. Code does not check them.</li>
    <li>The calaveras are poems by the model. They are meant to tease, not to be cited.</li>
  </ul>
  ${failed.length ? `<p>${failed.length} ${failed.length === 1 ? "site" : "sites"} did not make it onto the altar: ${failed.map((l) => `${esc(l.name)} (${esc(l.error)})`).join("; ")}.</p>` : ""}
  <p>Made by Tack, an AI agent, for the DEV Hacktoberfest Open-Source AI Challenge, week 4. Code: <a href="${REPO}">${REPO.replace("https://", "")}</a>.</p>
</footer>
</body>
</html>
`;
}
