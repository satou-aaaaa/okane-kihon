// お金のきほんの検査。問題の作り方（18種類×2000問を別の解き方で計算し直す・思いちがいの選び肢）・今日の5問と上級の組み方（3年分）・
// 通しで遊ぶ・まちがい・ヒント・内訳・続きから・上級・練習・とことん（終わらない・同じ問題を出さない）・しくみ帳・実績・カレンダー・あとから・
// 文字の大きさ・言い方の決まり（助言をしない）・スマホ幅・PWA・引き継ぎコード・見やすさを確かめる。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { checkTransfer } from "./transfer-check.mjs";
import { checkSwStall } from "./sw-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail).slice(0, 400) });
const G = createRequire(import.meta.url)(path.join(root, "gen.js"));

// ---- 1. 問題の作り方（ブラウザを使わない）----
// ゲームの計算（gen.js の calc）を使わず、ここで別の書き方で解き直す：分割は残高を1か月ずつ追う、リボは別のループ、複利・積み立ても1回ずつ足す
const round = { 100: (v) => Math.round(v / 100) * 100, 1000: (v) => Math.round(v / 1000) * 1000, 10: (v) => Math.round(v / 10) * 10 };
function bunSim(P, n, rate) { // 毎月の額を二分探索で求め、n か月でちょうど払い終わる額×n
  const i = rate / 1200; let lo = P / n, hi = P;
  for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2; let b = P; for (let t = 0; t < n; t++) b = b * (1 + i) - m; if (b > 0) lo = m; else hi = m; }
  return lo * n;
}
function riboSim(B, X, rate) { const out = { months: 0, total: 0, fee: 0 }; let b = B; for (;;) { const f = Math.floor((b * rate) / 1200); out.fee += f; out.months++; const pay = Math.min(X, b + f); out.total += pay; b = b + f - pay; if (b <= 0 || out.months > 2000) return out; } }
const grow = (P, rate, n) => { let v = P; for (let t = 0; t < n; t++) v *= 1 + rate / 100; return v; };
const tsumiSim = (X, rate, years) => { let v = 0; for (let t = 0; t < years * 12; t++) v = v * (1 + rate / 1200) + X; return v; };
const SOLVE = {
  sub: ({ m }) => m * 12,
  tax: ({ p, food }) => Math.round(p * (food ? 1.08 : 1.1)),
  rishi: ({ P, r }) => (P * r) / 100,
  tanri: ({ P, r, n }) => (P * r * n) / 100,
  chokin: ({ T, X }) => Math.ceil(T / X),
  fukuri: ({ P, r, n }) => round[1000](grow(P, r, n)),
  bunkatsu: ({ P, n, r }) => round[100](bunSim(P, n, r)),
  ribofee: ({ B, r }) => (B * r) / 1200,
  seigen: ({ A }) => (A >= 1000000 ? 15 : A >= 100000 ? 18 : 20),
  r72: ({ r }) => 72 / r,
  infl: ({ P, r, n }) => round[10](grow(P, r, n)),
  zei: ({ I }) => I - Math.floor(I * 0.15315 + 1e-9) - Math.floor(I * 0.05 + 1e-9),
  ribo: ({ B, X, r }) => round[100](riboSim(B, X, r).total),
  ribom: ({ B, X, r }) => riboSim(B, X, r).months,
  tsumi: ({ X, r, n }) => round[1000](tsumiSim(X, r, n)),
  ribo2x: ({ B, X, r }) => round[100](riboSim(B, X, r).fee - riboSim(B, X * 2, r).fee),
  bunribo: ({ B, X, r }) => round[100](riboSim(B, X, r).total - bunSim(B, 12, r)),
  loan: ({ B, X, r }) => round[100](riboSim(B, X, r).fee),
};
{
  const bad = {}, seen = {}, N = 2000;
  for (const k of G.KINDS) {
    for (let s = 0; s < N; s++) {
      const P = G.make(`${k.id}|qa${s}`), why = [];
      if (P.opts.length !== 4 || new Set(P.opts).size !== 4 || !P.opts.includes(P.ans)) why.push("選び肢が4つちがう・答えを含む");
      if (P.opts.some((v) => !Number.isFinite(v) || v <= 0 || !Number.isInteger(v))) why.push("選び肢が正の整数でない");
      if (new Set(P.opts.map((v) => G.fmt(v, P.unit, P.approx))).size !== 4) why.push("画面の文字で同じ選び肢がある");
      const want = SOLVE[k.id] ? SOLVE[k.id](P.p) : NaN;
      if (want !== P.ans) why.push(`別の解き方では ${want}（ゲームは ${P.ans}）`);
      if ([...JSON.stringify(P.scene), P.q, P.why].some((x) => /undefined|NaN|null|Infinity/.test(x))) why.push("文が空");
      if (P.parts && P.parts.some(([, v]) => !(v >= 0))) why.push("内訳が負");
      if (JSON.stringify(G.make(`${k.id}|qa${s}`)) !== JSON.stringify(P)) why.push("同じ種で同じ問題にならない");
      seen[k.id] = seen[k.id] || new Set(); seen[k.id].add(JSON.stringify(P.p));
      if (why.length && !bad[k.id]) bad[k.id] = why.join("・") + "：" + JSON.stringify(P.p) + " → " + P.ans + " / " + P.opts.join(" ");
    }
  }
  check(`問題：${G.KINDS.length}種類×${N}問で、選び肢4つ・答えを別の解き方で計算し直しても同じ・画面の文字が重ならない`, Object.keys(bad).length === 0, JSON.stringify(bad));
  const few = G.KINDS.filter((k) => seen[k.id].size < 8).map((k) => `${k.id}:${seen[k.id].size}`);
  const total = G.KINDS.reduce((a, k) => a + seen[k.id].size, 0);
  check("問題：どの種類も8通り以上・全部で300通り以上（好きなだけ遊んでも同じ問題ばかりにならない）", few.length === 0 && total >= 300, few.join(",") + ` 全部${total}通り`);
  check("問題：種類は18（やさしい5・ふつう7・むずかしい6）", G.KINDS.length === 18 && [0, 1, 2].map((l) => G.kindsOf(l).length).join() === "5,7,6");
  // よくある思いちがいが選び肢に入る（学ぶ中身そのものを選び肢にする）
  const mis = [];
  for (let s = 0; s < 300; s++) {
    const f = G.make(`fukuri|m${s}`), tan = f.p.P * (1 + (f.p.r * f.p.n) / 100); if (!f.opts.includes(round[1000](tan))) mis.push("fukuri:単利");
    const t = G.make(`tax|m${s}`), other = Math.round(t.p.p * (t.p.food ? 1.1 : 1.08)); if (!t.opts.includes(other)) mis.push("tax:もう一方の税率");
    const r = G.make(`ribom|m${s}`), plain = Math.ceil(r.p.B / r.p.X); if (plain !== r.ans && !r.opts.includes(plain)) mis.push("ribom:手数料なしの月数");
    const b = G.make(`bunkatsu|m${s}`); if (!b.opts.includes(b.p.P)) mis.push("bunkatsu:値段そのまま");
  }
  check("選び肢に、よくある思いちがい（単利・もう一方の税率・手数料なし）が入る", mis.length === 0, [...new Set(mis)].join(","));
  const longWhy = [], longLook = [];
  for (const k of G.KINDS) for (let s = 0; s < 50; s++) { const P = G.make(`${k.id}|len${s}`); if ([...P.why].length > 70) longWhy.push(k.id); }
  for (const k of G.KINDS) if ([...k.look].length > 45) longLook.push(k.id);
  check("しくみの説明は70字以内・ヒントは45字以内（やさしい日本語。一文を短く）", !longWhy.length && !longLook.length, [...new Set(longWhy.concat(longLook))].join(","));
  // リボ・借り入れは、毎月の額が最初の手数料より大きく、払い終わる（終わらない組を作らない）
  const stuck = [...G.TABLES.RB, ...G.TABLES.BR].filter(([B, X]) => !(X > (B * 15) / 1200) || riboSim(B, X, 15).months > 120).concat(G.TABLES.LN.filter(([B, X]) => !(X > (B * 18) / 1200) || riboSim(B, X, 18).months > 120));
  check("リボ・借り入れの組は、毎月の額が手数料より大きく、10年以内に払い終わる", stuck.length === 0 && G.TABLES.RB.length >= 10 && G.TABLES.BR.length >= 5 && G.TABLES.LN.length >= 5, JSON.stringify(stuck));
  check("利息制限法の上限：9万9千円は20%・10万円は18%・99万円は18%・100万円は15%", G.calc.seigen(99000) === 20 && G.calc.seigen(100000) === 18 && G.calc.seigen(990000) === 18 && G.calc.seigen(1000000) === 15);
}
{
  // 今日の5問・上級の組み方（3年分）
  const bad = [], cover = new Set(); let sameAsPrev = 0, prev = "";
  const d0 = Date.parse("2026-11-07");
  for (let i = 0; i < 365 * 3; i++) {
    const d = new Date(d0 + i * 864e5).toISOString().slice(0, 10), dl = G.dailyTags(d), hl = G.hardTags(d);
    const dk = dl.map((t) => t.split("|")[0]), hk = hl.map((t) => t.split("|")[0]);
    if (dl.length !== 5 || new Set(dk).size !== 5 || dk.map((k) => G.BY[k].lv).join() !== "0,0,1,1,2") bad.push(d + " 今日");
    if (hl.length !== 3 || new Set(hk).size !== 3 || hk.some((k) => G.BY[k].lv !== 2) || hk.includes(dk[4])) bad.push(d + " 上級");
    if (JSON.stringify(dl) !== JSON.stringify(G.dailyTags(d))) bad.push(d + " 同じにならない");
    if ([...dl, ...hl].some((t) => !G.make(t))) bad.push(d + " 作れない");
    if (dk.join() === prev) sameAsPrev++; prev = dk.join();
    if (i < 60) [...dk, ...hk].forEach((k) => cover.add(k));
  }
  check("今日の5問（やさしい2・ふつう2・むずかしい1、種類は重ねない）と上級（むずかしい3・今日のむずかしいと別）を3年分作れる", bad.length === 0, bad.slice(0, 5).join(","));
  check("2か月のうちに18種類が全部出る・前の日と同じ組の日が少ない", cover.size === 18 && sameAsPrev < 20, `${cover.size}種類・前の日と同じ ${sameAsPrev}日`);
}

// ---- 2. ファイルの中身 ----
const html = readFileSync(path.join(root, "index.html"), "utf8"), gen = readFileSync(path.join(root, "gen.js"), "utf8");
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$|^https:\/\/(www\.j-fsa\.or\.jp|www\.j-flec\.go\.jp|www\.nta\.go\.jp)\//.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない（出典のリンクは押したときに開くだけ）", ext.length === 0 && ![...html.matchAll(/<script[^>]+src="([^"]+)"/g)].some((m) => /^https?:/.test(m[1])), ext.join(","));
check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
check("Math.random は練習・とことんの種だけ（今日の5問・上級は日付の乱数。gen.js には無い）", (html.match(/Math\.random/g) || []).length === 2 && !/Math\.random/.test(gen));
check("乱数は sort の比較の中で引かない（ブラウザで引く回数が変わる）", !/\.sort\(\s*\([^)]*\)\s*=>[^\n;]*\b(R|rng|rand|Math\.random)\s*\(/.test(html + gen));
check("一行の式の途中にコメント // を足さない（行の残りが消える。rosen-hitofude 2026-11-04）", !/;\s*\/\/[^\n]*;\s*\w/.test(gen.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n")));
check("言い方：特定の商品・投資をすすめない（「買うべき」「必ずもうかる」などを書かない）", !/買うべき|おすすめの(株|銘柄|カード)|必ずもうか|絶対もうか|損しない|元本保証で/.test(html + gen + readFileSync(path.join(root, "README.md"), "utf8")));
check("言い方：「このゲームについて」に計算のしかた・助言でないこと・相談先（188）・出典がある", /元利均等/.test(html) && /投資の助言/.test(html) && /188/.test(html) && /j-fsa\.or\.jp/.test(html) && /j-flec\.go\.jp/.test(html) && /nta\.go\.jp/.test(html));
check("実在の会社・カードの名前を出さない", !/JCB|VISA|Visa|Mastercard|楽天|PayPay|三井住友|アコム|プロミス|アイフル|イオン/.test(html + gen));
check("画面にお笑いの言葉を入れない（本物っぽく）", !/お笑い|ギャグ|ツッコミ|なんでやねん|（うそ）/.test(html));
check("引き継ぎ：transfer.js をゲームの script より前に、このゲームの記録のキーだけで読む", /<script src="transfer\.js" data-game="okane-kihon" data-keys="okane-v1,okane-fs"><\/script>\s*<\/head>/.test(html) && html.indexOf('src="transfer.js"') < html.indexOf('src="gen.js"') && /data-hk/.test(html) && existsSync(path.join(root, "transfer.js")));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/okane-kihon/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームの name が3字以上（2字だとフォームが出ない。shared-workflows incidents/2026-11-05-feedback-form-not-shown.md）", [...((fy.match(/^name:\s*(.+)$/m) || [])[1] || "").trim()].length >= 3);
  check("感想フォームは名前・メールを聞かない", /id: fun/.test(fy) && !/id: (name|email|mail)/.test(fy) && /labels: \["感想"\]/.test(fy)); }
check("README の URL のすぐ後ろに全角の字を続けない（Link check が URL の一部と読む）", !/https?:\/\/[\x21-\x7e]*[^\x00-\x7f]/.test(readFileSync(path.join(root, "README.md"), "utf8").replace(/\]\(https?:\/\/[^)\s]+\)/g, "").replace(/<https?:\/\/[^>\s]+>/g, "")));
try { const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  { const st = await checkSwStall(sw); check("PWA：本文の途中で通信が止まっても4秒で保存したものを返す・ふつうはネットの返事", st.ok, JSON.stringify(st)); }
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1]);
  check("PWA：sw.js は画面のファイルを全部保存し（引き継ぎの transfer.js も）、外へ何も送らない", ["./index.html", "./gen.js", "./transfer.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"].every((f) => shell.includes(f)) && !/https?:\/\//.test(sw.replace(/^\/\/.*$/gm, "")));
  check("PWA：manifest にアイコン2つと名前がある", mf.name === "お金のきほん" && mf.icons.length >= 2 && mf.start_url === "./"); }
catch (e) { check("PWA：sw.js と manifest.webmanifest を読めて形式が正しい", false, e.message.split("\n")[0]); }

// ---- 3. ブラウザで遊ぶ ----
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname), f = path.join(root, p === "/" ? "index.html" : p);
  if (!(f === root || f.startsWith(root + path.sep)) || !existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r)); // 手元の端末の中だけで開く
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
const TODAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const dayBefore = (n) => new Date(Date.parse(TODAY) - n * 864e5).toISOString().slice(0, 10);
async function newPage(w = 390, ctx) {
  const c = ctx || await browser.newContext({ viewport: { width: w, height: 800 } });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
  await p.goto(url); await p.waitForTimeout(200);
  return p;
}
const closeHow = async (p) => { if (await p.locator("#howto[open]").count()) await p.click("#howto-ok"); };
const ansIdx = (p) => p.evaluate(() => { const c = __km.cur(); return c.P.opts.indexOf(c.P.ans); });
const wrongIdx = (p) => p.evaluate(() => { const c = __km.cur(); return c.P.opts.findIndex((o) => o !== c.P.ans && !c.wrong.includes(o)); });
const mem = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("okane-v1") || "{}"));
async function solve(p, { wrong = 0 } = {}) {
  for (let i = 0; i < wrong; i++) await p.click(`.ch[data-j="${await wrongIdx(p)}"]`);
  await p.click(`.ch[data-j="${await ansIdx(p)}"]`);
  await p.waitForSelector(".verdict");
}

try {
  // はじめて：遊び方が出る・文字の大きさ
  const p = await newPage();
  check("はじめて開くと遊び方が出る", await p.locator("#howto[open]").count() === 1);
  { const c = await browser.newContext(); const r = await c.newPage(); await r.goto(url); await r.waitForTimeout(200); let again = 0;
    for (let i = 0; i < 10; i++) { await r.evaluate(() => localStorage.clear()); await r.reload(); await r.waitForTimeout(200); await r.keyboard.press("Escape"); await r.reload(); await r.waitForTimeout(200); again += await r.locator("#howto[open]").count(); }
    check("遊び方を Esc で閉じてすぐ読み直しても出ない（10回）", again === 0);
  { const c = await browser.newContext(); const r = await c.newPage(); const big = []; // 題が h1{flex:1} で縦に伸び（伸びない形と比べて4pxより高ければ失敗）、iPad の縦で大きなすき間が出た（shared-workflows incidents/2026-11-07-title-stretched.md）
    for (const [w, h] of [[820, 1180], [390, 844], [1280, 800]]) { await r.setViewportSize({ width: w, height: h }); await r.goto(url); await r.waitForTimeout(200); await r.keyboard.press("Escape"); await r.waitForTimeout(100);
      const v = await r.evaluate(() => { const e = [...document.querySelectorAll(".title")].find((x) => x.offsetParent); if (!e) return null; const h = e.getBoundingClientRect().height; const f = e.style.flex; e.style.flex = "none"; const n = e.getBoundingClientRect().height; e.style.flex = f; return h - n; });
      if (v === null || v > 4) big.push(`${w}x${h}:${v === null ? "題なし" : "+" + Math.round(v) + "px"}`); }
    check("ホームの題は縦長の画面でも縦に伸びない（820×1180・390×844・1280×800）", big.length === 0, big.join(" ")); await c.close(); }
    await r.evaluate(() => localStorage.clear()); await r.reload(); await r.waitForTimeout(200);
    check("「わかった」を押したその場で「見た」が残る", await r.locator("#howto-ok").evaluate((b) => { b.click(); return Object.keys(localStorage).some((k) => { try { return JSON.parse(localStorage.getItem(k)).tut === true; } catch { return false; } }); }));
    await r.reload(); await r.waitForTimeout(200); check("遊び方を「わかった」で閉じてすぐ読み直しても出ない（その場で残す）", await r.locator("#howto[open]").count() === 0); await c.close(); }
  { const t = await browser.newContext(); const r = await t.newPage(); await r.goto(url); await r.waitForTimeout(150); await r.click("#howto-ok"); await r.reload(); await r.waitForTimeout(150);
    check("遊び方を「わかった」で閉じてすぐ読み直しても出ない", await r.locator("#howto[open]").count() === 0); await t.close(); }
  await p.keyboard.press("Escape"); await p.waitForTimeout(100);
  check("遊び方を Esc で閉じても、開き直したとき出ない", await p.locator("#howto[open]").count() === 0 && await p.evaluate(() => JSON.parse(localStorage.getItem("okane-v1") || "{}").tut === true));
  await p.reload(); await p.waitForTimeout(150);
  check("遊び方は一度閉じたら開き直しても出ない", await p.locator("#howto[open]").count() === 0);
  check("文字の大きさ：はじめは「大きい」（21px）", await p.evaluate(() => getComputedStyle(document.documentElement).fontSize) === "21px");
  await p.click('.fsrow button[data-fs="3"]');
  await p.reload(); await p.waitForTimeout(150);
  check("文字の大きさ：「とても大きい」にすると開き直しても残る", await p.evaluate(() => getComputedStyle(document.documentElement).fontSize) === "25px" && await p.locator('.fsrow button[data-fs="3"][aria-pressed="true"]').count() === 1);
  await p.click('.fsrow button[data-fs="2"]');
  check("ホームに今日のコツが出る", (await p.textContent("#tip")).includes("今日のコツ"));

  // 今日の5問：1問目はまちがえる、2問目はヒント2回、ほかはそのまま
  await p.click("#go-d");
  const tags = await p.evaluate(() => __km.load().runs.d.list);
  check("今日の5問は日付から決まる（gen.js の dailyTags と同じ）", JSON.stringify(tags) === JSON.stringify(G.dailyTags(TODAY)));
  check("問題の画面：場面のカードと問いと「？」と大きな選び肢4つ（高さ72px以上）", await p.locator(".scene div").count() >= 2 && await p.locator("#q").count() === 1 && await p.locator("#ask").count() === 1 && (await p.$$eval(".ch", (b) => b.map((x) => x.getBoundingClientRect().height))).every((h) => h >= 72) && await p.locator(".ch").count() === 4);
  check("選び肢は画面の文字で、答えの金額・月数などの形（円・か月・年・%）", (await p.$$eval(".ch", (b) => b.map((x) => x.textContent))).every((t) => /\d.*(円|か月|年|%|回)$/.test(t.trim())));
  await p.click(`.ch[data-j="${await wrongIdx(p)}"]`);
  check("まちがえると ✕ の印と「ちがう」の文字（色だけで分けない）・知らせは role=status", await p.locator(".ch.ng").count() === 1 && (await p.evaluate(() => getComputedStyle(document.querySelector(".ch.ng"), "::after").content)).includes("ちがう") && (await p.textContent("#msg")).includes("ちがいます") && await p.getAttribute("#msg", "role") === "status");
  // 開き直しても、まちがえた選び肢は残る
  await p.reload(); await p.waitForTimeout(150); await p.click("#go-d");
  check("途中で閉じても続きから（同じ問題・まちがえた印のまま）", await p.locator(".ch.ng").count() === 1 && await p.evaluate(() => __km.cur().i) === 0);
  await solve(p);
  check("正解すると ✓ の印・しくみの説明・★2（まちがい1回）・「？」に答えが入る", await p.locator(".ch.ok").count() === 1 && (await p.textContent(".verdict .why")).includes("しくみ") && (await p.getAttribute(".verdict .stars", "aria-label")) === "星2つ" && !(await p.textContent("#ask")).includes("？"));
  await p.click("#next");
  await p.click("#hint");
  check("ヒント1は見るところを言う（答えは言わない）", (await p.textContent("#hintbox")).includes("💡") && await p.locator(".ch.ng").count() === 0);
  await p.click("#hint");
  check("ヒント2はまちがいの選び肢を消し、2つにしぼる・ヒントは2回まで", await p.locator(".ch.ng").count() === 2 && await p.locator("#hint:disabled").count() === 1);
  await solve(p);
  check("ヒント2回は★1", (await p.getAttribute(".verdict .stars", "aria-label")) === "星1つ");
  await p.click("#next");
  for (let i = 2; i < 5; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  const s1 = await mem(p);
  check("5問で結果：今日の記録に1問ごとのまちがい（1・2・0・0・0）", JSON.stringify(s1.days[TODAY]?.m) === "[1,2,0,0,0]");
  const share = await p.textContent(".share");
  check("シェアの文に答え・問題を出さない（印だけ）", /第\d+回/.test(share) && /🟢/.test(share) && !/円|か月|%|\d{3}/.test(share.replace(/第\d+回|\d+\/\d+|まちがいなし|お金のきほん/g, "")), share);
  check("まちがいのある日は Ko-fi の一言を出さない", await p.locator(".kofi").count() === 0);
  check("結果に「あと少しの実績」と、続けて遊ぶ・上級のボタン", await p.locator("#achnext").count() === 1 && await p.locator("#go-e").count() === 1 && await p.locator("#go-h").count() === 1);
  check("しくみ帳に解いた種類が載る", Object.keys(s1.dex).length === 5);
  await p.click("#back");
  check("今日を終えたら、ホームは「今日の結果を見る」と上級", (await p.textContent("#go-d")).includes("結果") && await p.locator("#go-h").count() === 1);
  // 上級：ヒントなし・3問
  await p.click("#go-h");
  check("上級はヒントのボタンが無い・3問", await p.locator("#hint").count() === 0 && (await p.evaluate(() => __km.load().runs.h.list.length)) === 3);
  for (let i = 0; i < 3; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  check("上級の記録は hdays に入る", (await mem(p)).hdays[TODAY]?.m.length === 3);
  // 練習：記録を増やさない
  await p.click("#back"); await p.click("#go-p"); await p.click('.lv button[data-t="2"]');
  const before = await mem(p);
  for (let i = 0; i < 5; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  const after = await mem(p);
  check("練習は今日の記録を増やさない（しくみ帳の数はふえる）", JSON.stringify(after.days) === JSON.stringify(before.days) && Object.values(after.dex).reduce((a, b) => a + b) === Object.values(before.dex).reduce((a, b) => a + b) + 5);
  // しくみ帳からそのしくみだけで練習
  await p.click("#back"); await p.click("#go-dex");
  const firstKind = await p.getAttribute(".book button", "data-k");
  await p.click(".book button");
  check("しくみ帳の種類を押すと、そのしくみだけで練習", (await p.evaluate(() => __km.load().runs.p.list)).every((t) => t.startsWith(firstKind + "|")));
  // とことん：まちがえてもヒントを使っても終わらない。「ここで降りる」で終わる（チケット・ライフなし）
  await p.click("#back"); await p.click("#go-e");
  check("とことんにライフ・チケットが無い（ヒントは押せる・🎫🌸を出さない）", !("life" in await p.evaluate(() => __km.load().runs.e)) && await p.locator("#hint:not([disabled])").count() === 1 && !/🎫|🌸|❤/.test(await p.textContent("#app")));
  await solve(p); await p.click("#next");
  for (let i = 0; i < 6; i++) { await solve(p, { wrong: 3 }); await p.click("#next"); }
  await p.click("#hint"); await p.click("#hint"); await solve(p); await p.click("#next");
  check("とことん：何回まちがえても続く", await p.locator(".ch").count() === 4 && await p.evaluate(() => __km.load().runs.e.res.length) === 8);
  // 並びの終わりに近づいたら足して続ける
  const n0 = await p.evaluate(() => __km.load().runs.e.list.length);
  await p.evaluate((n) => { const s = __km.load(); s.runs.e.res = s.runs.e.list.slice(0, n - 2).map(() => ({ m: 0 })); s.runs.e.cur = null; localStorage.setItem("okane-v1", JSON.stringify(s)); }, n0);
  await p.reload(); await p.waitForTimeout(150); await p.click("#go-e");
  const el = await p.evaluate(() => __km.load().runs.e.list), keys = await p.evaluate((l) => l.map(__km.probKey), el);
  check("とことん：並びを使い切る前に問題を足して続ける・1回の中で同じ問題を出さない", el.length > n0 && new Set(keys).size === keys.length && await p.locator(".ch").count() === 4, `${n0}→${el.length}`);
  await p.click("#quit"); await p.waitForTimeout(150);
  check("「ここで降りる」で終わり、自己ベストとまちがい・ヒントの回数を出す", await p.locator("#eres").count() === 1 && (await mem(p)).ebest === n0 - 2 && (await p.textContent("#emiss")).includes("まちがい・ヒント"));
  {
    // とことんの並びを何百回も作って、1回の中で重ならない・作れない問題が無いかを見る（5回では小さな重なりに当たらない）
    const r = await p.evaluate(() => { let dup = 0, badLen = 0, rep = 0; for (let t = 0; t < 300; t++) { let l = __km.endlessList(); for (let k = 0; k < 2; k++) l = l.concat(__km.moreList(l)); const ks = l.map(__km.probKey); if (new Set(ks).size !== ks.length) dup++; if (l.length !== 80) badLen++; for (let i = 1; i < l.length; i++) if (l[i].split("|")[0] === l[i - 1].split("|")[0]) rep++; } return [dup, badLen, rep]; });
    check("とことんの並びを300回作って、同じ問題が無い・続けて同じ種類が無い・数が足りる", r.join() === "0,0,0", r.join(","));
  }
  {
    // 引き継ぎコードなどで数の所に文字が入っても、画面に HTML として出さない（2026-11-05 CodeRabbit）
    const q = await newPage(); await closeHow(q);
    await q.evaluate(() => { const s = JSON.parse(localStorage.getItem("okane-v1")) || { v: 1 }; s.ebest = '<img id="xss" src=x>'; s.eclean = '"><i id="xss3">'; s.dex = { sub: '"><b id="xss2">' }; s.runs = { e: { mode: "e", id: "x", date: "2026-11-05", list: ["sub|1", "sub|2", "sub|3", "sub|4"], res: [] }, h: { list: "bad", res: [] }, p: { mode: "p", id: "y", date: "2026-11-05", list: ["constructor|1"], res: [] }, d: { mode: "d", id: "z", date: "x", list: ["sub|1"], res: [] }, a1: { mode: "a", id: "a1", date: "2026-11-04", list: ["sub|1"], res: [null] }, a2: { mode: "a", id: "a2", date: "2026-11-03", list: "bad", res: [] }, a3: { mode: "a", id: "a3", date: "2026-11-02", list: ["sub|1", "sub|2"], res: [{ m: 0 }], cur: { i: 1, tag: "sub|2", wrong: "x", hints: 0 } } }; s.days = { "2026-11-05": { m: "x" }, bad: { m: [0] }, "2026-02-30": { m: [0] } }; localStorage.setItem("okane-v1", JSON.stringify(s)); });
    await q.reload(); await q.waitForTimeout(250);
    const st = await q.evaluate(() => __km.load());
    check("記録の形を直す：数の所の文字は0に・形のちがう途中経過と日ごとの記録は捨てる", st.ebest === 0 && st.eclean === 0 && st.dex.sub === 0 && st.runs.e && !("h" in st.runs) && !("p" in st.runs) && !("d" in st.runs) && !("a1" in st.runs) && !("a2" in st.runs) && st.runs.a3 && st.runs.a3.cur === null && Object.keys(st.days).length === 0);
    await q.click("#go-e").catch(() => {}); await q.waitForTimeout(150);
    check("記録の文字を HTML として出さない", await q.locator("#xss, #xss2, #xss3").count() === 0);
    await q.context().close();
  }
  // 実績・このゲームについて
  await p.click("#back"); await p.click("#go-ach");
  check("実績は13個で、腕前・集める・続けるの3つの組", await p.locator(".ach").count() === 13 && await p.locator(".agrp").count() === 3 && await p.locator(".ach.got").count() >= 3);
  check("達成した実績は ✓ の文字も付く（色だけで分けない）", (await p.textContent(".ach.got b")).startsWith("✓"));
  await p.click("#back"); await p.click("#f-about");
  check("このゲームについて：計算のしかた・助言でないこと・出典", (await p.textContent("#about")).includes("元利均等") && (await p.textContent("#about")).includes("投資の助言") && await p.locator("#about a").count() >= 4);
  await p.context().close();

  // まちがいなしの日は Ko-fi を1回だけ
  {
    const q = await newPage(); await closeHow(q); await q.click("#go-d");
    for (let i = 0; i < 5; i++) { await solve(q); await q.click("#next"); }
    await q.waitForTimeout(150);
    check("全部まちがいなしで初めて終えたときだけ Ko-fi の一言", await q.locator(".kofi").count() === 1 && (await q.textContent(".big")).includes("まちがいなし"));
    await q.click("#back"); await q.click("#go-d");
    check("結果をもう一度見ても Ko-fi は出さない", await q.locator(".kofi").count() === 0);
    await q.context().close();
  }

  // カレンダー・あとから：過去の日の記録を置いて見る
  {
    // 公開した日（第1回）から日がたっていなくても見られるよう、このタブだけ時計を10日進める
    const SHIFT = 10 * 864e5, T2 = new Date(Date.parse(TODAY) + SHIFT).toISOString().slice(0, 10), dayBefore = (n) => new Date(Date.parse(T2) - n * 864e5).toISOString().slice(0, 10);
    const cctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    await cctx.addInitScript((sh) => { const n = Date.now; Date.now = () => n() + sh; }, SHIFT);
    const q = await newPage(390, cctx);
    await q.evaluate(([d2, d3]) => { localStorage.setItem("okane-v1", JSON.stringify({ v: 1, tut: true, days: { [d2]: { m: [0, 0, 0, 0, 0], k: [] }, [d3]: { m: [1, 0, 0, 2, 0], k: [] } }, hdays: {}, adays: {}, dex: {}, runs: {}, kofi: {}, ach: {}, ebest: 0 })); }, [dayBefore(2), dayBefore(3)]);
    await q.reload(); await q.waitForTimeout(150);
    check("ホームの「続けて」は、きのうを休んだら — （休んだ日を責めない）", (await q.textContent(".stats")).includes("—"));
    await q.click("#go-cal");
    const lateList = await q.evaluate(() => __km.lateDays(__km.load()));
    const exp = [1, 4, 5, 6, 7].map(dayBefore).filter((d) => d >= "2026-11-07");
    check("カレンダー：取りこぼした過去7日（第1回より後）を押せる", JSON.stringify(lateList) === JSON.stringify(exp), lateList.join(","));
    check("カレンダー：遊んだ日は★の数の文字も付く", (await q.locator(".cal .c.p3").count()) + (await q.locator(".cal .c.p2").count()) + (await q.locator(".cal .c.p1").count()) >= (dayBefore(3).slice(0, 7) === T2.slice(0, 7) ? 2 : 0));
    if (lateList.length) {
      const d = lateList[0];
      await q.evaluate((d) => { const b = document.querySelector(`.cal .miss[data-k="${d}"]`); if (b) b.click(); else { const m = document.querySelector(".calnav #prev"); m && m.click(); } }, d);
      if (!(await q.locator(".ch").count())) await q.click(`.cal .miss[data-k="${d}"]`);
      check("あとから：その日の今日の5問と同じ問題", JSON.stringify(await q.evaluate((d) => __km.load().runs["a:" + d].list, d)) === JSON.stringify(G.dailyTags(d)));
      for (let i = 0; i < 5; i++) { await solve(q); await q.click("#next"); }
      await q.waitForTimeout(150);
      const s = await mem(q);
      check("あとからは adays に入り、今日の記録・続けた日には数えない", s.adays[d] && !s.days[d] && (await q.locator(".share").count()) === 0 && (await q.locator(".kofi").count()) === 0);
    } else check("あとから：遊べる日がある", false, "第1回の日から日がたっていない");
    await q.context().close();
  }

  // 古いタブ：同じ問題を2つのタブで開き、片方で答えたら、もう片方は二重に入れない
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const a = await newPage(390, ctx); await closeHow(a); await a.click("#go-d");
    const b = await ctx.newPage(); b.on("pageerror", (e) => errors.push(e.message)); await b.goto(url); await b.waitForTimeout(150); await b.click("#go-d");
    await solve(a);
    await b.click(`.ch[data-j="${await ansIdx(b)}"]`);
    await b.waitForTimeout(200);
    const s = await mem(a);
    check("古いタブで同じ問題に答えても二重に数えない", s.runs.d.res.length === 1 && Object.values(s.dex).reduce((x, y) => x + y) === 1);
    // ヒントの数は、別のタブで使った分も減らさない
    await a.click("#next"); await b.goto(url); await b.waitForTimeout(150); await b.click("#go-d");
    await a.click("#hint"); await a.click("#hint");
    await b.click("#hint");
    check("別のタブで使ったヒントの数を減らさない", (await mem(a)).runs.d.cur.hints === 2);
    await ctx.close();
  }

  // スマホ幅・とても大きい文字でもはみ出さない・押す所は44px以上
  {
    const bad = [], small = [];
    for (const [w, fs] of [[320, 3], [390, 2], [320, 1]]) {
      const q = await newPage(w); await closeHow(q);
      await q.evaluate((fs) => localStorage.setItem("okane-fs", String(fs)), fs); await q.reload(); await q.waitForTimeout(150);
      for (const go of [null, "#go-d", "solve", "#go-cal", "#go-dex", "#go-ach", "#go-e"]) {
        if (go === "solve") { await solve(q); }
        else if (go) { await q.goto(url); await q.waitForTimeout(100); await q.click(go); }
        await q.waitForTimeout(100);
        const ov = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (ov > 0) bad.push(`${w}px 文字${fs} ${go || "ホーム"} ${ov}px`);
        small.push(...(await q.$$eval("button:not([disabled]), a[href]", (bs) => bs.filter((b) => b.checkVisibility() && !b.closest(".cal")).filter((b) => b.getBoundingClientRect().height < 44).map((b) => (b.id || b.className || b.textContent).slice(0, 20)))).map((x) => `${w}/${fs}/${go}:${x}`));
      }
      await q.context().close();
    }
    check("幅320px・とても大きい文字でも横にはみ出さない", bad.length === 0, bad.join(" / "));
    check("押せる所は高さ44px以上", small.length === 0, [...new Set(small)].slice(0, 8).join(","));
  }

  // 見やすさの設定を全部入れても、ページの一番下まで動ける（読み上げの class が html に当たって固まった。2026-11-05）
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 700 } });
    await ctx.addInitScript(() => localStorage.setItem("a11y-v1", JSON.stringify({ read: true, cvd: true, calm: true, say: true, ruby: true })));
    const q = await newPage(390, ctx); await closeHow(q);
    const r = await q.evaluate(() => { window.scrollTo(0, 1e5); const f = document.querySelector("footer").getBoundingClientRect(); return [scrollY, Math.round(f.bottom), innerHeight, getComputedStyle(document.documentElement).position]; });
    check("見やすさの設定を全部入れても、いちばん下まで動ける（html が固定されない）", r[0] > 0 && r[1] <= r[2] && r[3] === "static", r.join(","));
    await ctx.close();
  }
  // キーボードだけで遊べる（Tab と Enter）
  {
    const q = await newPage(); await closeHow(q);
    await q.focus("#go-d"); await q.keyboard.press("Enter"); await q.waitForTimeout(100);
    const j = await ansIdx(q);
    await q.focus(`.ch[data-j="${j}"]`); await q.keyboard.press("Enter"); await q.waitForTimeout(100);
    check("キーボードだけで選んで答えられる", await q.locator(".verdict").count() === 1);
    await q.context().close();
  }
} catch (e) { check("ブラウザでの検査が最後まで動く", false, e.stack.split("\n").slice(0, 3).join(" ")); }

// 引き継ぎコード（shared-workflows template/qa/transfer-check.mjs）
try {
  const sample = { "okane-v1": JSON.stringify({ v: 1, tut: true, days: { "2026-11-05": { m: [0, 1, 0, 0, 2], k: ["week", "add", "clock", "kana2", "alt"] } }, hdays: {}, adays: {}, dex: { week: 1, add: 1, clock: 1, kana2: 1, alt: 1 }, runs: {}, kofi: {}, ach: {}, ebest: 7, t: 1 }), "okane-fs": "3" };
  await checkTransfer({ browser, url, game: "okane-kihon", sample, check, open: async (pg) => { if (await pg.locator("#howto[open]").count()) await pg.click("#howto-ok"); } });
} catch (e) { check("引き継ぎの検査が最後まで動く", false, e.message.split("\n")[0]); }
await browser.close();
server.close();
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));

{ // 見やすさ・読みやすさ・偏り（shared-workflows template/qa/a11y.mjs の写し）
  const { spawnSync } = await import("node:child_process");
  const a = spawnSync(process.execPath, [path.join(root, "qa", "a11y.mjs")], { encoding: "utf8", env: process.env });
  check("見やすさ・読みやすさの検査（qa/a11y.mjs。中身は qa-report/a11y.md）", a.status === 0, (a.stdout.match(/^- ❌.*$/gm) || []).join(" / ") || (a.status ? a.stderr.slice(-300) : ""));
}

const ng = results.filter((r) => !r.ok);
const md = `# お金のきほん QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
