// The 15 landing-page pairs. Every brand is fictional; no client page, name or logo appears.
// p01–p08 come from real test results in Smart Funnels client data (source noted per pair).
// p09–p15 are EXAMPLE pairs: their winners are placeholders until a real result is supplied.
// The answer key is duplicated in apps-script/Code.gs (ANSWER_KEY) to re-score on the server.
window.SF_PAGES = (() => {
  "use strict";

  // ---------- product and lifestyle visuals ----------
  // Drawn in SVG so the pages work offline. To use photos instead, put a file in assets/lp/
  // and list it in PHOTOS (e.g. jar: "assets/lp/calmora.jpg"); the photo then replaces the drawing.
  const PHOTOS = {};

  const svg = (body, bg) => `<svg viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true"><rect width="400" height="250" fill="${bg}"/>${body}</svg>`;
  const shadow = (cx, cy, rx) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${rx / 7}" fill="#000" opacity=".1"/>`;
  const T = (x, y, size, fill, text, weight = 700, ls = 0) => `<text x="${x}" y="${y}" font-family="Inter,Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="middle" letter-spacing="${ls}">${text}</text>`;

  const bedShape = (x = 0, y = 0) => `<g transform="translate(${x},${y})">${shadow(200, 214, 150)}
    <rect x="62" y="108" width="276" height="100" rx="44" fill="#5F6E6B"/>
    <rect x="62" y="160" width="276" height="48" rx="22" fill="#4E5B58"/>
    <rect x="92" y="132" width="216" height="54" rx="24" fill="#C9D3D0"/>
    <path d="M100 150 Q200 138 300 150" stroke="#B4C0BC" stroke-width="3" fill="none"/></g>`;
  const dog = `<g><ellipse cx="196" cy="140" rx="74" ry="28" fill="#C98B4F"/>
    <ellipse cx="180" cy="130" rx="48" ry="16" fill="#D69C61"/>
    <path d="M122 146 Q96 150 104 128" stroke="#C98B4F" stroke-width="12" stroke-linecap="round" fill="none"/>
    <circle cx="272" cy="136" r="27" fill="#D69C61"/><ellipse cx="294" cy="146" rx="15" ry="11" fill="#E3B583"/>
    <ellipse cx="303" cy="142" rx="5" ry="4" fill="#3A2A1E"/>
    <path d="M256 126 Q250 152 262 160 Q270 140 266 124 Z" fill="#9E6534"/>
    <path d="M272 134 q6 4 12 0" stroke="#3A2A1E" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>`;
  const room = (inner) => svg(`<rect y="182" width="400" height="68" fill="#D8B38A"/><rect y="180" width="400" height="4" fill="#C49C72"/>
    <rect x="22" y="26" width="92" height="118" rx="4" fill="#FFF7EA"/><rect x="66" y="26" width="4" height="118" fill="#E9D6BB"/><rect x="22" y="83" width="92" height="4" fill="#E9D6BB"/>
    <rect x="336" y="120" width="26" height="62" rx="6" fill="#B9775A"/><path d="M349 122 q-24 -40 -6 -66 q8 34 6 66 q14 -42 34 -50 q-16 34 -34 50" fill="#5E8C61"/>
    ${inner}`, "#F2E1CB");

  const ART = {
    jar: () => svg(`${shadow(200, 224, 92)}
      <rect x="152" y="46" width="96" height="30" rx="7" fill="#4B3F72"/>
      <rect x="136" y="72" width="128" height="148" rx="24" fill="#8E7CC3"/>
      <rect x="148" y="84" width="10" height="122" rx="5" fill="#fff" opacity=".22"/>
      <rect x="148" y="108" width="104" height="76" rx="8" fill="#fff"/>
      ${T(200, 136, 15, "#4B3F72", "CALMORA", 800, 2)}${T(200, 153, 8, "#8E7CC3", "SLEEP GUMMIES", 700, 1.5)}${T(200, 170, 7, "#9A93AE", "300 mg magnesium · 60 ct", 500)}
      <g><rect x="92" y="200" width="30" height="22" rx="9" fill="#A68BDB"/><rect x="270" y="196" width="30" height="24" rx="9" fill="#8E7CC3"/><rect x="300" y="208" width="26" height="18" rx="8" fill="#B9A3E6"/><rect x="70" y="212" width="24" height="16" rx="7" fill="#8E7CC3"/></g>`, "#EEE8F7"),
    bottle: () => svg(`${shadow(200, 226, 70)}
      <rect x="170" y="30" width="60" height="24" rx="5" fill="#141518"/>
      <rect x="180" y="52" width="40" height="18" fill="#22252c"/>
      <rect x="156" y="66" width="88" height="156" rx="16" fill="#2B2F3A"/>
      <rect x="166" y="78" width="8" height="132" rx="4" fill="#fff" opacity=".12"/>
      <rect x="160" y="108" width="80" height="80" fill="#C9A55B"/>
      ${T(200, 136, 13, "#141518", "IRONROOT", 800, 1.5)}${T(200, 152, 8, "#3a3220", "DAILY VITALITY", 700, 1)}${T(200, 172, 7, "#3a3220", "60 capsules", 500)}
      <g fill="#B8732F"><rect x="96" y="210" width="26" height="11" rx="5.5"/><rect x="118" y="218" width="26" height="11" rx="5.5" transform="rotate(-20 131 223)"/><rect x="270" y="214" width="26" height="11" rx="5.5" transform="rotate(15 283 219)"/></g>`, "#ECE8E1"),
    serum: () => svg(`${shadow(200, 226, 60)}
      <circle cx="96" cy="70" r="40" fill="#F2D3BE"/><circle cx="318" cy="182" r="54" fill="#F0CDB4"/>
      <rect x="186" y="30" width="28" height="56" rx="14" fill="#FBF7F3"/>
      <rect x="176" y="84" width="48" height="22" rx="3" fill="#C9A06A"/>
      <rect x="164" y="104" width="72" height="118" rx="12" fill="#E3AE80" opacity=".95"/>
      <rect x="172" y="112" width="8" height="100" rx="4" fill="#fff" opacity=".3"/>
      <rect x="174" y="138" width="52" height="56" fill="#FFFBF7"/>
      ${T(200, 162, 11, "#6B4B32", "LUMEA", 800, 2)}${T(200, 176, 6, "#A07858", "GLOW SERUM", 700, 1)}${T(200, 187, 5.5, "#A07858", "30 ml", 500)}`, "#F7E9DE"),
    bed: () => svg(bedShape(), "#EDF1F0"),
    dogbed: () => room(`${bedShape(0, 4)}${dog}`),
    video: () => room(`${bedShape(0, 4)}${dog}<rect width="400" height="250" fill="#0d1311" opacity=".38"/>
      <circle cx="200" cy="120" r="34" fill="#fff" opacity=".92"/><path d="M190 102 L220 120 L190 138 Z" fill="#1d2421"/>
      <rect x="332" y="212" width="50" height="22" rx="4" fill="#000" opacity=".6"/>${T(357, 227, 12, "#fff", "0:30", 600)}`),
    gallery: () => `<div class="lp-gal"><div>${ART.dogbed()}</div><div>${ART.bed()}</div><div>${svg(`<rect width="400" height="250" fill="#C9D3D0"/>${Array.from({ length: 9 }, (_, k) => `<path d="M${k * 50 - 20} 0 L${k * 50 + 80} 250" stroke="#B4C0BC" stroke-width="10"/>`).join("")}${T(200, 135, 26, "#4E5B58", "Memory foam", 800)}`, "#C9D3D0")}</div><div>${room(`<g transform="translate(-40,-20) scale(1.2)">${dog}</g>`)}</div></div>`,
    doctor: () => svg(`<rect x="0" y="0" width="400" height="250" fill="#E6EDF1"/><rect x="250" y="30" width="110" height="140" rx="4" fill="#fff" opacity=".7"/>
      <path d="M118 250 Q122 168 200 160 Q278 168 282 250 Z" fill="#FDFDFD"/>
      <path d="M176 164 L200 214 L224 164 Z" fill="#5D82A8"/>
      <path d="M170 166 Q160 214 182 230" stroke="#2F3640" stroke-width="5" fill="none"/><circle cx="184" cy="232" r="8" fill="#9AA4AE"/>
      <rect x="186" y="128" width="28" height="36" fill="#D9A47D"/>
      <ellipse cx="200" cy="104" rx="38" ry="44" fill="#E2B38C"/>
      <path d="M162 98 Q164 52 202 56 Q240 58 238 98 Q232 74 202 72 Q172 74 162 98 Z" fill="#6A6F78"/>
      <path d="M184 118 q16 10 32 0" stroke="#9C6A4C" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="186" cy="100" r="3.5" fill="#2F3640"/><circle cx="214" cy="100" r="3.5" fill="#2F3640"/>`, "#E6EDF1"),
    night: () => svg(`<rect x="250" y="24" width="110" height="120" rx="4" fill="#2B3A5E"/><circle cx="318" cy="64" r="18" fill="#F4E7B8"/><circle cx="326" cy="58" r="16" fill="#2B3A5E"/>
      <circle cx="270" cy="44" r="1.6" fill="#fff"/><circle cx="296" cy="100" r="1.4" fill="#fff"/><circle cx="342" cy="118" r="1.6" fill="#fff"/>
      <circle cx="96" cy="96" r="70" fill="#F5D79E" opacity=".16"/><path d="M76 70 L116 70 L128 108 L64 108 Z" fill="#F5D79E"/><rect x="92" y="108" width="8" height="56" fill="#C9B48A"/>
      <rect x="36" y="160" width="130" height="90" fill="#6B4F3A"/><rect x="36" y="160" width="130" height="10" fill="#7E5F47"/>
      <rect x="120" y="134" width="26" height="28" rx="6" fill="#8E7CC3"/><rect x="117" y="128" width="32" height="10" rx="3" fill="#4B3F72"/>
      <path d="M52 140 h28 v20 q0 6 -6 6 h-16 q-6 0 -6 -6 Z" fill="#EDE7DF"/><path d="M80 146 q10 0 8 8 q-2 6 -8 4" stroke="#EDE7DF" stroke-width="3" fill="none"/>
      <rect x="180" y="170" width="220" height="80" rx="10" fill="#E9ECF3"/><rect x="180" y="160" width="220" height="22" rx="10" fill="#F6F7FB"/>`, "#1E2742"),
  };
  const pic = (key, caption) => {
    const inner = PHOTOS[key] ? `<img src="${PHOTOS[key]}" alt="" loading="lazy">` : ART[key]();
    return `<div class="lp-pic">${inner}${caption ? `<span>${caption}</span>` : ""}</div>`;
  };

  // ---------- page building blocks ----------
  const B = {
    nav: (brand, note) => `<div class="lp-nav">${brand}<small>${note || "Free shipping over $50"}</small></div>`,
    ann: (t, hot) => `<div class="lp-ann${hot ? " hot" : ""}">${t}</div>`,
    mast: (t) => `<div class="lp-mast">${t}</div><div class="lp-by">By Laura Kim · 6 min read</div>`,
    h: (t, serif) => `<div class="lp-h${serif ? " serif" : ""}">${t}</div>`,
    sub: (t, strong) => `<div class="lp-sub${strong ? " strong" : ""}">${t}</div>`,
    p: (...t) => t.map((x) => `<p class="lp-p">${x}</p>`).join(""),
    stars: (t) => `<div class="lp-stars">★★★★★<span>${t || "4.8 (12,400 reviews)"}</span></div>`,
    proof: (t) => `<div class="lp-proof">${t}</div>`,
    ul: (items) => `<ul class="lp-ul">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`,
    quote: (t, who) => `<div class="lp-quote">“${t}”<b>${who}</b></div>`,
    price: (p, was, note) => `<div class="lp-price"><b>${p}</b>${was ? `<s>${was}</s>` : ""}${note === undefined ? "<small>per bottle</small>" : note ? `<small>${note}</small>` : ""}</div>`,
    bun: (rows) => `<div class="lp-bun">${rows.map(([t, p, on, badge]) => `<div class="${on ? "on" : ""}"><span>${t}${badge ? ` <em>${badge}</em>` : ""}</span><span>${p}</span></div>`).join("")}</div>`,
    cta: (t, alt) => `<div class="lp-cta${alt ? " alt" : ""}">${t}</div>`,
    badge: (t) => `<div class="lp-badge">✓ ${t}</div>`,
    timer: () => `<div class="lp-timer"><span>00</span>:<span>14</span>:<span>59</span></div>`,
  };
  const page = (parts) => `<div class="lp">${parts.join("")}</div>`;
  const body = (inner) => `<div class="lp-b">${inner.join("")}</div>`;

  const CAL = "Calmora";
  const sleepUl = ["Fall asleep faster", "Fewer night wake-ups", "Calmer, clearer mornings"];
  const article = B.p(
    "It started with a question from a reader: <i>why do I wake up at 3 a.m. every single night?</i> She had tried cutting coffee, screens off at nine, even a new mattress.",
    "Sleep researchers point to something simpler. Most adults don't get enough magnesium, the mineral that helps the body switch into rest mode, and stress drains it faster.",
    "That's why thousands of readers now take two gummies with their evening tea. “I fall asleep before the second episode now,” one told us."
  );
  const lumeaCopy = B.p("A lightweight daily serum with 10% vitamin C and hyaluronic acid. Three drops, morning and night, for brighter, smoother skin in two weeks.");

  const PAIRS = [
    {
      real: true, title: "The headline", ask: "Which advertorial earned more revenue per click?",
      a: page([B.nav("Health Daily", "Sponsored"), body([B.mast("Health Daily"), B.h("The sleep scandal doctors don't want you to know about", true), pic("night"), article, B.cta("Read more", true)])]),
      b: page([B.nav("Health Daily", "Sponsored"), body([B.mast("Health Daily"), B.h("Why 12,000 adults switched to this 2-minute evening ritual", true), pic("night"), article, B.cta("Read more", true)])]),
      win: "b", diff: "<b>Scandal headline vs plain benefit headline.</b> The scandal versions got more clicks but fewer buyers: curiosity clicks aren't customers.",
      src: "Supplement client, advertorial test (40 versions)",
    },
    {
      real: true, title: "The subtitle", ask: "Which product page sold more?",
      a: page([B.nav(CAL), body([pic("jar"), B.stars(), B.h("Calmora Sleep Gummies"), B.sub("The internet's favourite bedtime treat"), B.price("$35"), B.cta("Add to cart")])]),
      b: page([B.nav(CAL), body([pic("jar"), B.stars(), B.h("Calmora Sleep Gummies"), B.sub("Full 300 mg magnesium glycinate dose, for deeper sleep in 2 weeks", true), B.price("$35"), B.cta("Add to cart")])]),
      win: "b", diff: "<b>Novelty subtitle vs product-forward subtitle</b> (full dose, better form, a concrete outcome).",
      src: "Supplement client, sales-page test (33 versions)",
    },
    {
      real: true, title: "Social proof", ask: "Which product page sold more?",
      a: page([B.nav(CAL), body([pic("jar"), B.h("Calmora Sleep Gummies"), B.ul(sleepUl), B.price("$35"), B.cta("Add to cart")])]),
      b: page([B.nav(CAL), body([pic("jar"), B.h("Calmora Sleep Gummies"), B.proof("12,000+ customers · ★ 4.8 from 12,400 reviews"), B.ul(sleepUl), B.price("$35"), B.cta("Add to cart")])]),
      win: "b", diff: "<b>Symptom promises alone vs the same list plus customer and review counts.</b>",
      src: "Supplement client, sales-page test",
    },
    {
      real: true, title: "The expert quote", ask: "Which product page sold more?",
      a: page([B.nav(CAL), body([pic("jar"), B.h("Calmora Sleep Gummies"), B.quote("Magnesium is a cofactor in more than 300 enzymatic reactions, including those regulating GABA receptor activity and melatonin synthesis; glycinate chelation improves bioavailability relative to oxide forms, and clinical literature suggests supplementation may support sleep latency in deficient adults.", "Dr. A. Moreau, MD"), B.price("$35"), B.cta("Add to cart")])]),
      b: page([B.nav(CAL), body([pic("jar"), B.h("Calmora Sleep Gummies"), B.quote("Most adults are low on magnesium. Low magnesium means lighter sleep. This is the form your body actually absorbs.", "Dr. A. Moreau, MD"), B.price("$35"), B.cta("Add to cart")])]),
      win: "b", diff: "<b>Long clinical paragraph vs three punchy sentences</b> from the same doctor.",
      src: "Supplement client, sales-page test",
    },
    {
      real: true, title: "Where the ad lands", ask: "Which first page made more money per visitor?",
      a: page([B.nav("Health Daily", "Sponsored"), body([B.mast("Health Daily"), B.h("Why 12,000 adults switched to this evening ritual", true), pic("night"), article, B.cta("Continue to the product →", true)])]),
      b: page([B.nav(CAL), body([pic("jar"), B.stars(), B.h("Calmora Sleep Gummies"), B.sub("Full 300 mg dose, deeper sleep in 2 weeks", true), B.price("$35"), B.cta("Add to cart")])]),
      win: "b", diff: "<b>Article first, then product page vs the ad going straight to the product page.</b> The direct product page earned +39.5% revenue per click (for visitors the model judged ready to buy).",
      src: "Supplement client, finalist pages vs control",
    },
    {
      real: true, title: "The price", ask: "Which price made more revenue?",
      a: page([B.nav(CAL), body([pic("jar"), B.stars(), B.h("Calmora Sleep Gummies"), B.price("$30", "", "per bottle"), B.ul(sleepUl), B.cta("Add to cart")])]),
      b: page([B.nav(CAL), body([pic("jar"), B.stars(), B.h("Calmora Sleep Gummies"), B.price("$35", "", "per bottle"), B.ul(sleepUl), B.cta("Add to cart")])]),
      win: "b", diff: "<b>$30 vs $35, same page.</b> No cheaper price beat $35. A discount isn't a free lift.",
      src: "Supplement client, price tests",
    },
    {
      real: true, title: "Offer or expert?", ask: "Which landing page converted more visitors?",
      a: page([B.nav("Ironroot", "Men's vitality"), B.ann("BUY 2, GET 1 FREE · today only", true), body([pic("bottle"), B.h("Ironroot Daily: buy 2, get 1 free"), B.stars("4.7 (3,100 reviews)"), B.badge("90-day money-back"), B.cta("Claim my free bottle")])]),
      b: page([B.nav("Ironroot", "Men's vitality"), body([pic("doctor", "▶ Watch: 4 min"), B.h("Specialist explains the #1 mistake men over 40 make"), B.p("Dr. Mark Ellison has worked with men over 40 for twenty years. In this short video he explains the everyday habit that quietly drains energy and focus, and the simple daily fix his patients use."), B.cta("Watch the explanation")])]),
      win: "a", diff: "<b>Offer-led page vs expert-angle page.</b> The expert angle converted about 57% worse and was cut.",
      src: "Men's health client, funnel test",
    },
    {
      real: true, title: "Bundle order", ask: "Which product page made more revenue per visitor?",
      a: page([B.nav(CAL), body([pic("jar"), B.h("Choose your bundle"), B.bun([["1 bag", "$35"], ["2 bags", "$65", true, "Popular"], ["3 bags + free gift", "$90"]]), B.cta("Add to cart")])]),
      b: page([B.nav(CAL), body([pic("jar"), B.h("Choose your bundle"), B.bun([["1 bag", "$35"], ["3 bags + free gift", "$90", true, "Best value"], ["2 bags", "$65"]]), B.cta("Add to cart")])]),
      win: "b", diff: "<b>2 bags preselected vs 3 bags + gift preselected</b> (same prices). +4.9% revenue per visitor, all from bigger orders.",
      src: "Supplement client, bundle test (178k visitors)",
    },
    {
      real: false, title: "Hero image", ask: "Which product page sold more?",
      a: page([B.nav("Pawly", "Orthopedic dog beds"), body([pic("bed"), B.h("Pawly Orthopedic Bed"), B.stars("4.8 (2,050 reviews)"), B.price("$119", "$159", ""), B.cta("Add to cart")])]),
      b: page([B.nav("Pawly", "Orthopedic dog beds"), body([pic("dogbed"), B.h("Pawly Orthopedic Bed"), B.stars("4.8 (2,050 reviews)"), B.price("$119", "$159", ""), B.cta("Add to cart")])]),
      win: null, diff: "<b>Product-only photo vs lifestyle photo</b> (dog using it).",
    },
    {
      real: false, title: "The guarantee", ask: "Which product page sold more?",
      a: page([B.nav("Pawly", "Orthopedic dog beds"), body([pic("dogbed"), B.h("Pawly Orthopedic Bed"), B.price("$119", "", ""), B.badge("30-day money-back guarantee"), B.cta("Add to cart")])]),
      b: page([B.nav("Pawly", "Orthopedic dog beds"), body([pic("dogbed"), B.h("Pawly Orthopedic Bed"), B.price("$119", "", ""), B.badge("100-night home trial"), B.cta("Add to cart")])]),
      win: null, diff: "<b>30-day money-back vs 100-night trial.</b>",
    },
    {
      real: false, title: "Reviews position", ask: "Which product page sold more?",
      a: page([B.nav("Lumea", "Skincare"), body([pic("serum"), B.h("Lumea Glow Serum"), B.price("$42", "", "30 ml"), B.cta("Add to cart"), lumeaCopy, B.stars("4.9 (5,600 reviews)")])]),
      b: page([B.nav("Lumea", "Skincare"), body([pic("serum"), B.stars("4.9 (5,600 reviews)"), B.proof("“My skin changed in 10 days.” – Sara"), B.h("Lumea Glow Serum"), B.price("$42", "", "30 ml"), B.cta("Add to cart")])]),
      win: null, diff: "<b>Reviews at the bottom vs reviews right under the photo.</b>",
    },
    {
      real: false, title: "Free-shipping bar", ask: "Which product page sold more?",
      a: page([B.nav("Lumea", "Skincare"), body([pic("serum"), B.h("Lumea Glow Serum"), B.price("$42", "", "30 ml"), B.cta("Add to cart"), lumeaCopy])]),
      b: page([B.nav("Lumea", "Skincare"), B.ann("Free shipping on orders over $50"), body([pic("serum"), B.h("Lumea Glow Serum"), B.price("$42", "", "30 ml"), B.cta("Add to cart"), lumeaCopy])]),
      win: null, diff: "<b>No banner vs a free-shipping bar on top.</b>",
    },
    {
      real: false, title: "Button text", ask: "Which product page sold more?",
      a: page([B.nav("Ironroot", "Men's vitality"), body([pic("bottle"), B.h("Ironroot Daily"), B.sub("Zinc, ashwagandha and vitamin D3 for steady energy, every day."), B.price("$49"), B.cta("Buy now")])]),
      b: page([B.nav("Ironroot", "Men's vitality"), body([pic("bottle"), B.h("Ironroot Daily"), B.sub("Zinc, ashwagandha and vitamin D3 for steady energy, every day."), B.price("$49"), B.cta("Try it risk-free")])]),
      win: null, diff: "<b>“Buy now” vs “Try it risk-free”.</b>",
    },
    {
      real: false, title: "Countdown timer", ask: "Which offer page sold more?",
      a: page([B.nav("Ironroot", "Men's vitality"), body([pic("bottle"), B.h("Ironroot: 40% off this week"), B.price("$29", "$49", ""), B.cta("Claim the offer")])]),
      b: page([B.nav("Ironroot", "Men's vitality"), body([pic("bottle"), B.h("Ironroot: 40% off this week"), B.timer(), B.price("$29", "$49", ""), B.cta("Claim the offer")])]),
      win: null, diff: "<b>No timer vs a countdown timer.</b>",
    },
    {
      real: false, title: "Video or photos", ask: "Which product page sold more?",
      a: page([B.nav("Pawly", "Orthopedic dog beds"), body([pic("video"), B.h("Pawly Orthopedic Bed"), B.price("$119", "", ""), B.cta("Add to cart")])]),
      b: page([B.nav("Pawly", "Orthopedic dog beds"), body([ART.gallery(), B.h("Pawly Orthopedic Bed"), B.price("$119", "", ""), B.cta("Add to cart")])]),
      win: null, diff: "<b>Video at the top vs a photo gallery.</b>",
    },
  ];

  const PLACEHOLDER = { 8: "b", 9: "b", 10: "b", 11: "b", 12: "b", 13: "b", 14: "a" };
  PAIRS.forEach((p, i) => {
    p.id = "p" + String(i + 1).padStart(2, "0");
    if (!p.win) { p.win = PLACEHOLDER[i]; p.provisional = true; }
  });

  // The rest of each page (reviews and FAQ), so pages scroll like real ones.
  const EXTRA = {
    "Health Daily": { h: "Reader comments", rev: [["I tried it after reading this. Sleeping through the night for the first time in years.", "Joanne, 52"], ["My husband swears by them now too.", "Clare, 47"]],
      faq: [["Is this an ad?", "This article is sponsored by Calmora."], ["Where can I buy them?", "Only on the official Calmora website."]] },
    Calmora: { h: "What customers say", rev: [["Asleep within 20 minutes, no grogginess the next morning.", "Megan R."], ["Tastes great and I actually stay asleep.", "Tom B."]],
      faq: [["When should I take them?", "Two gummies about 30 minutes before bed."], ["Are they habit-forming?", "No. Melatonin-free and non-habit-forming."], ["How fast is shipping?", "Ships within 24 hours. Free over $50."]] },
    Ironroot: { h: "What customers say", rev: [["More energy by week two. Easy to take.", "James K."], ["Noticed a difference in my workouts within a month.", "Daniel P."]],
      faq: [["How many do I take?", "Two capsules with breakfast."], ["Is there a guarantee?", "Yes, 90 days money-back, even on empty bottles."]] },
    Pawly: { h: "What customers say", rev: [["My 12-year-old lab finally sleeps through the night.", "Karen W."], ["The washable cover is a lifesaver.", "Ben T."]],
      faq: [["Which size do I need?", "Measure nose to tail and add 15 cm."], ["Is the cover washable?", "Yes, it zips off and goes in the machine."]] },
    Lumea: { h: "What customers say", rev: [["Glowy skin in a week. I'm on my third bottle.", "Sara M."], ["Light, absorbs fast, no stickiness.", "Priya N."]],
      faq: [["Is it OK for sensitive skin?", "Yes. Fragrance-free and dermatologist tested."], ["How do I use it?", "Three drops on clean skin, morning and night."]] },
  };
  const more = (brand) => {
    const e = EXTRA[brand] || EXTRA.Calmora;
    return `<div class="lp-more"><h5>${e.h}</h5>${e.rev.map(([t, who]) => `<div class="lp-rev"><span class="lp-stars">★★★★★</span><b>“${t}”</b><small>${who} · Verified buyer</small></div>`).join("")}
      <h5>Frequently asked questions</h5>${e.faq.map(([q, a]) => `<div class="lp-faq"><b>${q}</b><span>${a}</span></div>`).join("")}</div>`;
  };
  const html = (p, side) => {
    const brand = (p[side].match(/lp-nav">([^<]+)/) || [])[1];
    return p[side].replace(/<\/div>$/, more(brand) + "</div>");
  };

  return { PAIRS, html };
})();
