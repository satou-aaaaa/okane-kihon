// お金のきほんの問題を作る（ブラウザと node の両方で使う）。
// 場面（買い物・借り入れ・貯金）を1つ決めて、「最後にいくら？」の答え（ans）と、よくある思いちがいの選び肢3つを作る。
// 乱数 R は呼ぶ回数が毎回同じになるように使う（sort の比較の中では引かない）。同じ種なら、どの端末でも同じ問題になる。
// 計算のしかた（このゲームの決まり。README と「このゲームについて」にも書く）：
//   分割払い：元利均等（毎月同じ額）。月の利率＝年率÷12。
//   リボ払い：元利定額（毎月の支払いは手数料こみで同じ額）。毎月、残高×年率÷12（円未満切り捨て）の手数料がつき、最後の月は残りを払う。
//   複利：年に1回、利息が元金に入る。積み立ては月に1回、月の利率＝年率÷12。税金は考えない（「税金」の問題だけ税を引く）。
(function (root) {
  "use strict";
  const LV = ["やさしい", "ふつう", "むずかしい"];
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
  const pickN = (R, arr, n) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
  const shuffle = (R, arr) => pickN(R, arr, arr.length);
  const r100 = (v) => Math.round(v / 100) * 100, r1000 = (v) => Math.round(v / 1000) * 1000, r10 = (v) => Math.round(v / 10) * 10;
  const comma = (v) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const yen = (v) => comma(v) + "円";
  const man = (v) => (v % 10000 === 0 ? comma(v / 10000) + "万円" : yen(v));

  // ---- 計算 ----
  // 分割払い（元利均等）：毎月の額と合計
  function bunkatsu(P, n, rate) { const i = rate / 100 / 12, M = (P * i) / (1 - Math.pow(1 + i, -n)); return { M, total: M * n }; }
  // リボ払い（元利定額）：毎月 X 円（手数料こみ）。払い終わるまでの月数・合計・手数料の合計
  function ribo(B, X, rate) {
    let bal = B, months = 0, total = 0, fee = 0;
    while (bal > 0 && months < 1200) {
      const f = Math.floor((bal * rate) / 100 / 12); months++; fee += f;
      if (bal + f <= X) { total += bal + f; bal = 0; } else { total += X; bal -= X - f; }
    }
    return { months, total, fee };
  }
  const fukuri = (P, rate, n) => P * Math.pow(1 + rate / 100, n);
  const tsumitate = (X, rate, years) => { const i = rate / 100 / 12, n = years * 12; return (X * (Math.pow(1 + i, n) - 1)) / i; };
  // 利息にかかる税（所得税・復興特別所得税 15.315% と住民税 5% を別々に、1円未満切り捨て）
  const afterTax = (I) => I - Math.floor((I * 15315) / 100000) - Math.floor((I * 5) / 100);
  // 利息制限法の上限金利（元本 10万円未満 20%・100万円未満 18%・それ以上 15%）
  const seigen = (A) => (A < 100000 ? 20 : A < 1000000 ? 18 : 15);

  // まちがいの選び肢：答えと gap（ふだん3%）以上はなれ、たがいにも gap 以上はなれたものを、候補の順に3つ（足りなければ予備から）
  function opts(R, ans, cands, round, gap = 0.03) {
    const out = [], far = (a, b) => Math.abs(a - b) / Math.max(a, b) >= gap;
    const spare = [0.8, 1.25, 0.6, 1.5, 0.9, 1.12, 0.45, 2, 0.7, 1.35].map((k) => ans * k);
    for (const c0 of [...cands, ...spare]) {
      const c = round(c0);
      if (!(c > 0) || !far(c, ans) || out.some((o) => !far(o, c))) continue;
      out.push(c); if (out.length === 3) break;
    }
    return shuffle(R, [ans, ...out]);
  }
  const iopts = (R, ans, cands) => { const out = []; for (const c of [...cands, ans + 3, ans - 3, ans * 2, ans + 6, ans + 1, ans - 1, ans + 2, ans - 2]) { const v = Math.round(c); if (v > 0 && v !== ans && !out.includes(v)) out.push(v); if (out.length === 3) break; } return shuffle(R, [ans, ...out]); };

  const SUBS = ["動画の見放題", "音楽の聞き放題", "電子書籍の読み放題", "写真の保存（クラウド）", "語学の学習アプリ", "ゲームの遊び放題", "スポーツの中継", "料理のレシピ集"];
  const TAXI = [["おにぎり（持ち帰り）", 1], ["お弁当（持ち帰り）", 1], ["食パン", 1], ["牛乳", 1], ["りんご", 1], ["ノート", 0], ["電池", 0], ["シャンプー", 0], ["かさ", 0], ["ハンカチ", 0], ["洗たく用の洗ざい", 0], ["お茶のペットボトル", 1]];
  const GOALS = [["旅行", 10], ["自転車", 4], ["パソコン", 12], ["引っこしの費用", 20], ["資格の受験料", 3], ["家族へのプレゼント", 2], ["冷ぞう庫", 15], ["スマホ", 9]];
  const BUY = ["ノートパソコン", "冷ぞう庫", "洗たく機", "自転車", "スマホ", "テレビ", "ソファ", "エアコン", "ベッド", "カメラ"];
  const ITEMS_P = [["食パン1つ", 200], ["ランチ1回", 900], ["電車の切符", 300], ["シャンプー1本", 600], ["映画1回", 1800], ["散髪1回", 3000]];

  // 種類：id・難しさ・帳に出す名前・見るところ（ヒント1）・作り方
  // 作り方は { scene:[[見出し, 中身]], q:問い, unit:"yen"|"month"|"year"|"pct"|"kai", approx:およそか, ans, opts, why, parts:[[見出し, 金額]], p:検査で解き直す値 } を返す
  const KINDS = [
    // ---- やさしい ----
    { id: "sub", lv: 0, name: "月ぎめは1年でいくら", look: "1年は12か月です。月の金額を12回たします。", make(R) {
      const m = pick(R, [380, 480, 550, 650, 780, 980, 1100, 1290, 1490, 1980]), s = pick(R, SUBS), ans = m * 12;
      return { scene: [["使うもの", s], ["月の料金", yen(m)]], q: "1年で払うのはいくら？", unit: "yen", ans, opts: opts(R, ans, [m * 10, m * 24, m * 6], Math.round),
        why: `${yen(m)}×12か月＝${yen(ans)}。月は小さくても、1年では大きくなります。`, p: { m } }; } },
    { id: "tax", lv: 0, name: "消費税（8%と10%）", look: "持ち帰りの食べ物と、それ以外で税率がちがいます。", make(R) {
      const [nm, food] = pick(R, TAXI), p = 50 * ri(R, 2, 60), rate = food ? 8 : 10, ans = (p * (100 + rate)) / 100;
      return { scene: [["買う物", nm], ["税ぬきの値段", yen(p)], ["いつ", "2026年11月"]], q: "税こみの値段は？", unit: "yen", ans, opts: opts(R, ans, [(p * (rate === 8 ? 110 : 108)) / 100, p, p * 1.2], Math.round, 0.01),
        why: food ? `酒・外食をのぞく食べ物は軽減税率で8%。${yen(p)}×1.08＝${yen(ans)}。` : `食べ物以外は10%。${yen(p)}×1.1＝${yen(ans)}。`, p: { p, food } }; } },
    { id: "rishi", lv: 0, name: "1年の利息", look: "利息＝借りたお金×金利です。", make(R) {
      const P = 10000 * ri(R, 1, 50), r = pick(R, [3, 5, 10, 12, 15, 18]), ans = (P * r) / 100;
      return { scene: [["借りるお金", man(P)], ["金利", `年${r}%`], ["借りる期間", "1年"]], q: "1年でつく利息は？", unit: "yen", ans, opts: opts(R, ans, [ans / 10, ans * 2, P + ans], Math.round),
        why: `${man(P)}×${r}%＝${yen(ans)}。返すのは元金と合わせて${yen(P + ans)}です。`, parts: [["借りたお金", P], ["利息", ans]], p: { P, r } }; } },
    { id: "tanri", lv: 0, name: "単利の利息", look: "単利は、はじめのお金にだけ毎年同じ利息がつきます。", make(R) {
      const P = 100000 * ri(R, 1, 10), r = pick(R, [1, 2, 3, 5]), n = ri(R, 2, 5), y = (P * r) / 100, ans = y * n;
      return { scene: [["預けるお金", man(P)], ["金利", `年${r}%（単利）`], ["預ける期間", `${n}年`]], q: "もらう利息の合計は？（税金は考えない）", unit: "yen", ans, opts: opts(R, ans, [y, ans * 2, P + ans], Math.round),
        why: `1年で${man(P)}×${r}%＝${yen(y)}。${n}年で${yen(ans)}です。`, parts: [["預けたお金", P], ["利息", ans]], p: { P, r, n } }; } },
    { id: "chokin", lv: 0, name: "貯金は何か月", look: "目標の金額を、月に貯める金額でわります。", make(R) {
      const [g, base] = pick(R, GOALS), X = pick(R, [5000, 10000, 20000]), n = Math.max(2, Math.round((base * 10000) / X)), T = X * n;
      return { scene: [["目標", g], ["目標の金額", man(T)], ["毎月の貯金", yen(X)]], q: "何か月で目標に届く？", unit: "month", ans: n, opts: iopts(R, n, [Math.round(n / 2), n * 2, n + (n >= 10 ? 5 : 2)]),
        why: `${man(T)}÷${yen(X)}＝${n}か月。毎月の額を決めると、届く日が分かります。`, p: { T, X } }; } },
    // ---- ふつう ----
    { id: "fukuri", lv: 1, name: "複利でふえる", look: "複利は、ついた利息にも次の年から利息がつきます。", make(R) {
      const P = pick(R, [100000, 200000, 500000, 1000000]), [r, n] = pick(R, FK), tot = fukuri(P, r, n), ans = r1000(tot), tan = P * (1 + (r * n) / 100);
      return { scene: [["預けるお金", man(P)], ["金利", `年${r}%（複利）`], ["預ける期間", `${n}年`]], q: `${n}年後のお金はおよそいくら？（税金は考えない）`, unit: "yen", approx: true, ans, opts: opts(R, ans, [tan, P, fukuri(P, r, n + 5)], r1000),
        why: `毎年1.${String(r).padStart(2, "0")}倍を${n}回で約${yen(ans)}。単利なら${yen(tan)}です。`, parts: [["はじめのお金", P], ["ふえた分", ans - P]], p: { P, r, n } }; } },
    { id: "bunkatsu", lv: 1, name: "分割払いの合計", look: "分割払いは、残りのお金に毎月手数料がつきます。", make(R) {
      const it = pick(R, BUY), P = 10000 * pick(R, [3, 5, 8, 10, 12, 15, 20, 24, 30]), n = pick(R, [3, 6, 10, 12, 15, 18, 20, 24]), r = pick(R, [12, 15]), b = bunkatsu(P, n, r), ans = r100(b.total);
      return { scene: [["買う物", it], ["値段", man(P)], ["払い方", `${n}回払い`], ["手数料", `実質年率${r}%`]], q: "払う合計はおよそいくら？", unit: "yen", approx: true, ans,
        opts: opts(R, ans, [P, P * (1 + (r * n) / 1200), P * (1 + r / 100)], r100, 0.015),
        why: `毎月 約${yen(Math.round(b.M))}×${n}回＝約${yen(ans)}。手数料は約${yen(ans - P)}です。`, parts: [["値段", P], ["手数料", ans - P]], p: { P, n, r } }; } },
    { id: "ribofee", lv: 1, name: "リボの1か月の手数料", look: "1か月の手数料＝残高×年率÷12です。", make(R) {
      const B = 10000 * ri(R, 10, 50), r = pick(R, [15, 18]), ans = (B * r) / 1200;
      return { scene: [["リボの残高", man(B)], ["手数料", `実質年率${r}%`]], q: "今月の手数料は？（1か月分）", unit: "yen", ans, opts: opts(R, ans, [(B * r) / 100, ans * 2, ans / 2], Math.round),
        why: `${man(B)}×${r}%÷12＝${yen(ans)}。残高が多いほど、毎月の手数料も多くなります。`, p: { B, r } }; } },
    { id: "seigen", lv: 1, name: "利息の上限（法律）", look: "借りる金額が大きいほど、上限の金利は低くなります。", make(R) {
      const A = 10000 * pick(R, [3, 5, 8, 9, 10, 20, 30, 50, 80, 99, 100, 150, 200, 300]), ans = seigen(A);
      return { scene: [["借りるお金", man(A)], ["決まり", "利息制限法"]], q: "法律で決まっている金利の上限は？", unit: "pct", ans, opts: shuffle(R, [15, 18, 20, 25]),
        why: "10万円未満は年20%、100万円未満は年18%、100万円以上は年15%までです。", p: { A } }; } },
    { id: "r72", lv: 1, name: "72の法則", look: "72を金利（%）でわると、2倍になるおよその年数です。", make(R) {
      const r = pick(R, [1, 2, 3, 4, 6, 8, 9, 12]), ans = 72 / r;
      return { scene: [["預けるお金", "100万円"], ["金利", `年${r}%（複利）`]], q: "およそ何年で2倍になる？", unit: "year", approx: true, ans, opts: iopts(R, ans, [Math.round(100 / r), ans * 2, Math.round(ans / 2)]),
        why: `72÷${r}＝${ans}。複利でおよそ${ans}年で2倍になります（72の法則）。`, p: { r } }; } },
    { id: "infl", lv: 1, name: "物価が上がると", look: "毎年の上がり方が、次の年の値段にも重なります。", make(R) {
      const [nm, P] = pick(R, ITEMS_P), [r, n] = pick(R, IF), ans = r10(fukuri(P, r, n));
      return { scene: [["いまの値段", `${nm} ${yen(P)}`], ["物価の上がり方", `毎年${r}%`], ["何年後", `${n}年後`]], q: "そのときの値段はおよそいくら？", unit: "yen", approx: true, ans, opts: opts(R, ans, [P * (1 + (r * n) / 100), P, fukuri(P, r, n * 2)], r10),
        why: `毎年1.0${r}倍を${n}回で約${yen(ans)}。同じお金で買える物がへります。`, p: { P, r, n } }; } },
    { id: "zei", lv: 1, name: "利息にかかる税金", look: "預金の利息からは、約2割の税金が引かれます。", make(R) {
      const I = 1000 * ri(R, 1, 100), ans = afterTax(I);
      return { scene: [["預金の利息", yen(I)], ["税金", "20.315%"]], q: "手もとに入るのはいくら？", unit: "yen", ans, opts: opts(R, ans, [I, I * 0.9, I * 0.7], Math.round),
        why: `所得税など15.315%と住民税5%が引かれ、${yen(I)}から${yen(ans)}になります。`, parts: [["手もと", ans], ["税金", I - ans]], p: { I } }; } },
    // ---- むずかしい ----
    { id: "ribo", lv: 2, name: "リボ払いの合計", look: "毎月の支払いのうち、手数料の分は残高がへりません。", make(R) {
      const [B, X] = pick(R, RB), r = 15, x = ribo(B, X, r), ans = r100(x.total);
      return { scene: [["使ったお金", man(B)], ["払い方", `リボ払い 毎月${yen(X)}（手数料こみ）`], ["手数料", `実質年率${r}%`]], q: "払い終わるまでの合計はおよそ？", unit: "yen", approx: true, ans, opts: opts(R, ans, [B, B * (1 + r / 100), B + (x.total - B) * 2.2], r100),
        why: `${x.months}か月かかり、合計 約${yen(ans)}。手数料は約${yen(ans - B)}です。`, parts: [["使ったお金", B], ["手数料", ans - B]], p: { B, X, r } }; } },
    { id: "ribom", lv: 2, name: "リボは何か月", look: "手数料の分だけ、払い終わるのが先にのびます。", make(R) {
      const [B, X] = pick(R, RB), r = 15, x = ribo(B, X, r), ans = x.months, plain = Math.ceil(B / X);
      return { scene: [["使ったお金", man(B)], ["払い方", `リボ払い 毎月${yen(X)}（手数料こみ）`], ["手数料", `実質年率${r}%`]], q: "払い終わるまで何か月？", unit: "month", ans, opts: iopts(R, ans, [plain, Math.round(ans * 1.6), Math.round(ans * 0.7)]),
        why: `手数料なしなら${plain}か月。手数料があるので${ans}か月かかります。`, p: { B, X, r } }; } },
    { id: "tsumi", lv: 2, name: "積み立ての力", look: "積み立てた元金と、ふえた分を分けて考えます。", make(R) {
      const X = pick(R, [5000, 10000, 20000, 30000]), r = pick(R, [3, 4, 5]), n = pick(R, [10, 15, 20, 30]), base = X * 12 * n, ans = r1000(tsumitate(X, r, n));
      return { scene: [["毎月の積み立て", yen(X)], ["ふえ方", `年${r}%（毎月複利と仮定）`], ["期間", `${n}年`]], q: `${n}年後はおよそいくら？（税金は考えない）`, unit: "yen", approx: true, ans, opts: opts(R, ans, [base, base * (1 + (r * n) / 100), ans * 1.5], r1000),
        why: `積み立てた元金は${yen(base)}。ふえた分が約${yen(ans - base)}。実際の値動きは上下します。`, parts: [["積み立てた元金", base], ["ふえた分", ans - base]], p: { X, r, n } }; } },
    { id: "ribo2x", lv: 2, name: "リボの支払いを2倍に", look: "早く払い終わるほど、手数料のつく月がへります。", make(R) {
      const [B, X] = pick(R, RB), r = 15, a = ribo(B, X, r), b = ribo(B, X * 2, r), ans = r100(a.fee - b.fee);
      return { scene: [["使ったお金", man(B)], ["いまの払い方", `リボ払い 毎月${yen(X)}`], ["変えたら", `毎月${yen(X * 2)}`], ["手数料", `実質年率${r}%`]], q: "手数料の合計は、およそいくらへる？", unit: "yen", approx: true, ans, opts: opts(R, ans, [ans / 2, a.fee, ans * 2], r100),
        why: `手数料は 約${yen(r100(a.fee))}→約${yen(r100(b.fee))}。約${yen(ans)}へります。`, p: { B, X, r } }; } },
    { id: "bunribo", lv: 2, name: "分割とリボをくらべる", look: "同じ年率なら、払う月が長いほど手数料がふえます。", make(R) {
      const [B, X] = pick(R, BR), r = 15, b = bunkatsu(B, 12, r), x = ribo(B, X, r), ans = r100(x.total - b.total);
      return { scene: [["使ったお金", man(B)], ["A", "12回払い"], ["B", `リボ払い 毎月${yen(X)}`], ["手数料", `どちらも実質年率${r}%`]], q: "B は A より、およそいくら多く払う？", unit: "yen", approx: true, ans, opts: opts(R, ans, [ans / 2.5, r100(x.total - B), ans * 2], r100),
        why: `A は約${yen(r100(b.total))}、B は${x.months}か月で約${yen(r100(x.total))}。差は約${yen(ans)}です。`, p: { B, X, r } }; } },
    { id: "loan", lv: 2, name: "借り入れの利息", look: "毎月の返済のうち、利息の分は元金がへりません。", make(R) {
      const [B, X] = pick(R, LN), r = 18, x = ribo(B, X, r), ans = r100(x.fee);
      return { scene: [["借りるお金", man(B)], ["返し方", `毎月${yen(X)}（利息こみ）`], ["金利", `年${r}%`]], q: "払う利息の合計はおよそいくら？", unit: "yen", approx: true, ans, opts: opts(R, ans, [(B * r) / 100, ans * 2, ans / 2], r100),
        why: `${x.months}か月かかり、利息は合わせて約${yen(ans)}。借りた額の約${Math.round((x.fee / B) * 100)}%です。`, parts: [["借りたお金", B], ["利息", ans]], p: { B, X, r } }; } },
  ];
  // 複利・物価の (年率, 年数)：単利との差が5%以上あるものだけ（思いちがいの選び肢が答えと見分けられるように）
  const FK = [], IF = [], RB = [], BR = [], LN = [];
  for (const r of [2, 3, 4, 5, 6]) for (const n of [5, 10, 15, 20, 25]) if (fukuri(1, r, n) / (1 + (r * n) / 100) >= 1.05) FK.push([r, n]);
  for (const r of [1, 2, 3]) for (const n of [10, 20, 30]) if (fukuri(1, r, n) / (1 + (r * n) / 100) >= 1.04) IF.push([r, n]);
  // リボの (残高, 毎月)：手数料より十分大きく、払い終わるまで4〜120か月
  for (const B of [100000, 150000, 200000, 300000, 400000, 500000]) for (const X of [5000, 8000, 10000, 15000, 20000]) { const x = ribo(B, X, 15), y = ribo(B, X * 2, 15); if (x.months >= 4 && x.months <= 120 && X > (B * 15) / 1200 * 1.5 && x.fee - y.fee >= 1000) RB.push([B, X]); }
  for (const B of [100000, 200000, 300000, 400000, 500000]) for (const X of [5000, 10000, 15000, 20000]) { const x = ribo(B, X, 18); if (x.months >= 4 && x.months <= 120 && X > (B * 18) / 1200 * 1.5) LN.push([B, X]); }
  for (const [B, X] of RB) { if (ribo(B, X, 15).total - bunkatsu(B, 12, 15).total >= 3000) BR.push([B, X]); }

  const BY = Object.fromEntries(KINDS.map((k) => [k.id, k]));
  const kindsOf = (lv) => KINDS.filter((k) => k.lv === lv).map((k) => k.id);

  function seedOf(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // 1問を作る。tag は「種類|種」（例 "sub|2026-11-07:d0"）。同じ tag ならいつも同じ問題
  function make(tag) {
    const [kind] = String(tag).split("|"), k = BY[kind];
    if (!k) return null;
    const p = k.make(rng(seedOf(tag)));
    return { tag, kind, lv: k.lv, name: k.name, look: k.look, approx: false, parts: null, ...p };
  }
  // 選び肢・答えを画面の文字にする
  function fmt(v, unit, approx) {
    const a = approx ? "約" : "";
    if (unit === "yen") return a + yen(v);
    if (unit === "month") return a + v + "か月";
    if (unit === "kai") return a + v + "回";
    if (unit === "year") return a + v + "年";
    if (unit === "pct") return "年" + v + "%";
    return String(v);
  }

  // 今日の5問（やさしい2・ふつう2・むずかしい1）。種類は重ねない
  function dailyTags(date) {
    const R = rng(seedOf("day:" + date)), e = pickN(R, kindsOf(0), 2), n = pickN(R, kindsOf(1), 2), h = pickN(R, kindsOf(2), 1);
    return [...e, ...n, ...h].map((id, i) => `${id}|${date}:d${i}`);
  }
  // 上級の3問（むずかしいだけ・今日の5問のむずかしいとは別の種類）
  function hardTags(date) {
    const dh = dailyTags(date)[4].split("|")[0], R = rng(seedOf("hard:" + date)), h = pickN(R, kindsOf(2).filter((x) => x !== dh), 3);
    return h.map((id, i) => `${id}|${date}:h${i}`);
  }

  const OKANE = { KINDS, BY, LV, kindsOf, seedOf, rng, make, fmt, yen, comma, dailyTags, hardTags, pickN, calc: { bunkatsu, ribo, fukuri, tsumitate, afterTax, seigen }, TABLES: { FK, IF, RB, BR, LN } };
  if (typeof module !== "undefined" && module.exports) module.exports = OKANE; else root.OKANE = OKANE;
})(typeof self !== "undefined" ? self : this);
