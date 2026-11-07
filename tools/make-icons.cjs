// アプリのアイコン（icon-192.png・icon-512.png）を作る。生成りの地に、金色の硬貨と「円」。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#f5efe2"/>
      <circle cx="58" cy="44" r="24" fill="#d9a43a" stroke="#7a5208" stroke-width="3"/>
      <circle cx="44" cy="52" r="26" fill="#e9c25a" stroke="#7a5208" stroke-width="3"/>
      <circle cx="44" cy="52" r="19" fill="none" stroke="#a8730f" stroke-width="1.6"/>
      <text x="44" y="62" font-size="27" text-anchor="middle" fill="#5a3c05" font-family="'Noto Sans CJK JP',sans-serif" font-weight="900">円</text>
      <text x="50" y="94" font-size="12" text-anchor="middle" fill="#1f2a44" font-family="'Noto Sans CJK JP',sans-serif" font-weight="900">お金のきほん</text></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
