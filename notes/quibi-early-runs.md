# Quibi: the two runs before the final one (Oct 30, 2026, from the session output)

The final run overwrote `ofrendas/quibi-com.json`, so these two earlier runs are kept here.

1. 06:13 MDT, SerpApi Google engine, first prompt (one `died` date only). Gemma 4 answered `{"died": "2020-10-21", "cause": "Quibi shut down citing low subscriptions amid the COVID-19 pandemic.", "source": 6}`. The year-only check passed it. The capture picked was 2020-10-19. The cited result's link was a relative `/goto?url=...` redirect.
2. 06:16 MDT, the same saved search results, the prompt that asks for `announced` and `died` apart. Gemma 4 answered `{"announced": "2020-10-21", "died": null, ...}`, so the run stopped with "bad date: null". Only 1 of the saved results had a direct link, and its snippet did not state the end date.

The final run (DuckDuckGo engine) gave 2020-12-01, with the evidence "went dark on 1 December 2020".
