import test from "node:test";
import assert from "node:assert/strict";
import * as L from "../src/lib.js";
import { renderPage } from "../src/page.js";

test("checkDomain keeps hosts and paths, refuses URLs and junk", () => {
  assert.equal(L.checkDomain(" Vine.co "), "vine.co");
  assert.equal(L.checkDomain("google.com/reader/"), "google.com/reader/");
  for (const bad of [
    "https://vine.co",
    "vine",
    "a b.com",
    "../etc",
    "x.com?y=1",
    "",
  ])
    assert.throws(() => L.checkDomain(bad));
});

test("lastCaptureUrl asks the archive for the last good page before a day", () => {
  const u = new URL(L.lastCaptureUrl("quibi.com", "20201130"));
  assert.equal(u.host, "web.archive.org");
  assert.equal(u.searchParams.get("to"), "20201130");
  assert.equal(u.searchParams.get("limit"), "-1");
  assert.deepEqual(u.searchParams.getAll("filter"), [
    "statuscode:200",
    "mimetype:text/html",
  ]);
});

test("cdxRow reads the last data row, and null when empty", () => {
  assert.equal(L.cdxRow([]), null);
  assert.equal(L.cdxRow([["timestamp", "original"]]), null);
  assert.deepEqual(
    L.cdxRow([
      ["timestamp", "original"],
      ["20201128180249", "https://quibi.com/"],
    ]),
    { timestamp: "20201128180249", original: "https://quibi.com/" },
  );
});

test("dates: dayBefore crosses month and year ends", () => {
  assert.equal(L.dayBefore("2017-01-17"), "20170116");
  assert.equal(L.dayBefore("2021-03-01"), "20210228");
  assert.equal(L.dayBefore("2020-01-01"), "20191231");
  assert.equal(L.tsToDate("20201128180249"), "2020-11-28");
});

test("htmlToText drops scripts, styles and comments, and decodes entities", () => {
  const html =
    '<html><head><style>p{}</style><script>var x = "<p>no</p>";</script></head><body><!-- hi --><h1>Bye&nbsp;&amp; thanks</h1><p>It&#39;s been &#x2764; fun</p></body></html>';
  assert.equal(L.htmlToText(html), "Bye & thanks\nIt's been ❤ fun");
});

test("pageTitle and pageImage", () => {
  const html =
    '<title> Vine &amp; friends </title><meta property="og:image" content="/img/logo.png"><img src="pixel.gif">';
  assert.equal(L.pageTitle(html), "Vine & friends");
  assert.equal(
    L.pageImage(html, "https://vine.co/"),
    "https://vine.co/img/logo.png",
  );
  assert.equal(
    L.pageImage(
      '<img src="spacer.gif"><img src="/hero.jpg" width="600">',
      "https://a.com/x/",
    ),
    "https://a.com/hero.jpg",
  );
  assert.equal(
    L.pageImage('<img src="javascript:alert(1)">', "https://a.com/"),
    null,
  );
  assert.equal(L.pageImage("<p>no images</p>", "https://a.com/"), null);
});

test("verifyQuote accepts the page words with curly quotes and spacing, refuses made-up ones", () => {
  const text = "Thank you for 6 wonderful years.\nWe’ll  miss you.";
  assert.ok(L.verifyQuote("We'll miss you.", text));
  assert.ok(L.verifyQuote('"Thank you for 6 wonderful years."', text));
  assert.ok(!L.verifyQuote("Thank you for 7 wonderful years.", text));
  assert.ok(!L.verifyQuote("miss", text));
  assert.ok(!L.verifyQuote("", text));
});

test("checkObituary keeps a date only when the cited result names the month and year", () => {
  const results = [
    {
      title: "Quibi shuts down",
      snippet: "Quibi went dark on December 1, 2020.",
      link: "https://news.example/q",
      date: "",
    },
  ];
  const ev = "went dark on December 1, 2020";
  assert.deepEqual(
    L.checkObituary(
      {
        died: "2020-12-01",
        cause: "It ran out of money.",
        source: 0,
        evidence: ev,
      },
      results,
    ),
    {
      ok: true,
      died: "2020-12-01",
      cause: "It ran out of money.",
      evidence: ev,
      source: { title: "Quibi shuts down", link: "https://news.example/q" },
    },
  );
  // Evidence the result does not contain is refused.
  assert.equal(
    L.checkObituary(
      {
        died: "2020-12-01",
        cause: "x",
        source: 0,
        evidence: "closed on December 1, 2020",
      },
      results,
    ).ok,
    false,
  );
  // The year may come from a news URL.
  const variety = [
    {
      title: "Quibi officially shuts down",
      snippet: "The Quibi app as of Dec. 1 is no longer operable.",
      link: "https://variety.com/2020/digital/news/quibi",
      date: "",
    },
  ];
  assert.equal(
    L.checkObituary(
      {
        died: "2020-12-01",
        cause: "x",
        source: 0,
        evidence: "as of Dec. 1 is no longer operable",
      },
      variety,
    ).ok,
    true,
  );
  assert.equal(
    L.checkObituary(
      { died: "2019-12-01", cause: "x", source: 0, evidence: ev },
      results,
    ).ok,
    false,
  );
  // The announcement month is not the death month.
  assert.equal(
    L.checkObituary(
      { died: "2020-10-21", cause: "x", source: 0, evidence: ev },
      results,
    ).ok,
    false,
  );
  assert.equal(
    L.checkObituary(
      {
        died: "2020-12-01",
        cause: "x",
        source: 0,
        evidence: "Gone on 2020-12-01",
      },
      [{ ...results[0], snippet: "Gone on 2020-12-01." }],
    ).ok,
    true,
  );
  assert.equal(
    L.checkObituary(
      { died: "2020-12-01", cause: "x", source: 3, evidence: ev },
      results,
    ).ok,
    false,
  );
  assert.equal(
    L.checkObituary(
      { died: null, cause: "x", source: 0, evidence: ev },
      results,
    ).ok,
    false,
  );
  assert.equal(
    L.checkObituary(
      { died: "2020-13-45", cause: "x", source: 0, evidence: ev },
      results,
    ).ok,
    false,
  );
  assert.equal(
    L.checkObituary(
      { died: "2020-12-01", cause: "", source: 0, evidence: ev },
      results,
    ).ok,
    false,
  );
  assert.equal(L.checkObituary(null, results).ok, false);
  // An announcement with no day in the evidence is refused, even when the year matches.
  const cnbc = [
    {
      title: "Quibi to shut down after just 6 months",
      snippet: "Quibi announced on Wednesday that it will shut down.",
      link: "https://www.cnbc.com/2020/10/21/quibi",
      date: "Oct 21, 2020",
    },
  ];
  assert.equal(
    L.checkObituary(
      {
        died: "2020-10-21",
        cause: "x",
        source: 0,
        evidence: "announced on Wednesday that it will shut down",
      },
      cnbc,
    ).ok,
    false,
  );
  // "decided" is not December, and a month with the wrong day is refused.
  const dec = [
    {
      title: "Gone",
      snippet: "Yahoo decided to close it on 1 2020.",
      link: "https://a.example/",
      date: "",
    },
  ];
  assert.equal(
    L.checkObituary(
      {
        died: "2020-12-01",
        cause: "x",
        source: 0,
        evidence: "decided to close it on 1 2020",
      },
      dec,
    ).ok,
    false,
  );
  assert.equal(
    L.checkObituary(
      { died: "2020-12-02", cause: "x", source: 0, evidence: ev },
      results,
    ).ok,
    false,
  );
  // Ordinals and the four-letter "Sept" count.
  const sept = [
    {
      title: "Closed",
      snippet: "It closed on Sept. 30th.",
      link: "https://a.example/2019/x",
      date: "",
    },
  ];
  assert.equal(
    L.checkObituary(
      {
        died: "2019-09-30",
        cause: "x",
        source: 0,
        evidence: "closed on Sept. 30th",
      },
      sept,
    ).ok,
    true,
  );
});

test("parseModelJson reads fenced or chatty JSON, and null on junk", () => {
  assert.deepEqual(L.parseModelJson('```json\n{"a": 1}\n```'), { a: 1 });
  assert.deepEqual(L.parseModelJson('Sure! {"a": "b"} Hope it helps.'), {
    a: "b",
  });
  assert.equal(L.parseModelJson("no json"), null);
  assert.equal(L.parseModelJson("{broken"), null);
});

test("renderPage escapes model and web text, and keeps only http links", () => {
  const log = {
    domain: "evil.example",
    name: "<script>alert(1)</script>",
    obituary: {
      died: "2020-01-01",
      cause: "It said <b>bye</b>.",
      source: { title: "t", link: "javascript:alert(1)" },
    },
    snapshot: {
      date: "2019-12-31",
      url: "https://web.archive.org/web/20191231/https://evil.example/",
      image: "javascript:alert(2)",
    },
    ofrenda: {
      what: 'A "site".',
      last_words: "Bye <img src=x onerror=alert(3)>",
      calavera: "Line one\\nLine two",
    },
    error: null,
  };
  const html = renderPage([
    log,
    {
      domain: "gone.example",
      name: "Gone",
      error: "no capture before it died",
    },
  ]);
  assert.ok(!html.includes("<script>alert"));
  assert.ok(!html.includes("javascript:"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(html.includes("Line one<br>Line two"));
  assert.ok(
    html.includes(
      "1 site did not make it onto the altar: Gone (no capture before it died).",
    ),
  );
});
