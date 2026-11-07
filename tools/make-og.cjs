// SNS で貼られたときの絵（og.png 1200×630）を作る。今日の問題（答え）は入れず、遊び方の例（月980円×12か月）だけ。
// 使い方: node tools/make-og.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const row = (a, v) => `<div style="display:flex;gap:30px;align-items:baseline;background:#fff;border:4px solid #1f2a4426;border-radius:16px;padding:14px 26px"><span style="font-size:32px;color:#4f566a;width:170px;white-space:nowrap">${a}</span><b style="font-size:44px;white-space:nowrap">${v}</b></div>`;
  await p.setContent(`<body style="margin:0;font-family:'Noto Sans CJK JP','IPAPGothic',sans-serif">
  <div style="width:1200px;height:630px;box-sizing:border-box;padding:56px 80px;background:#f5efe2;background-image:linear-gradient(#dbe4ef 2px,transparent 2px),linear-gradient(90deg,#dbe4ef 2px,transparent 2px);background-size:40px 40px;color:#1f2a44;display:flex;gap:40px;align-items:center">
    <div style="flex:1">
      <div style="font-size:32px;color:#86291a;letter-spacing:.08em">分割・リボ・利息・税金</div>
      <div style="font-size:96px;font-weight:900;margin-top:8px;letter-spacing:.02em;white-space:nowrap;color:#142a52">お金の<span style="color:#b8402a">きほん</span></div>
      <div style="font-size:38px;margin-top:12px;line-height:1.5">最後にいくら払う？<br>を当てる1日5問</div>
    </div>
    <div style="width:400px;display:flex;flex-direction:column;gap:14px">${row("月の料金", "980円")}${row("使う期間", "1年")}
      <div style="align-self:center;margin-top:10px;font-size:64px;font-weight:900;color:#b8402a;border:6px dashed #b8402a;border-radius:18px;background:#fff6f2;padding:4px 40px">？円</div></div>
  </div></body>`);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();
