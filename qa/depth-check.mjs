// ひな形（shared-workflows template/qa/depth-check.mjs）。ゲームでは直さず写す。
// depth.js（自信をかける・復習）を Node の中で動かして確かめる（ブラウザ無し）。
// ゲームの qa/run.mjs から: import { checkDepth } from "./depth-check.mjs"; const errs = await checkDepth(readFileSync("depth.js", "utf8"));（空なら通った）
// shared-workflows の Lint も、ひな形そのものをこれで確かめる（node template/qa/depth-check.mjs template/depth.js）。
// 見ること:
//   gaps:    まちがえた問題は今日は出ず、1日後に出る。正解で 3日後 → 7日後 → 「覚えた」。復習でまちがえたら1日後に戻る
//   notyet:  日の来ていない復習・復習に入っていない問題は、正解しても動かない
//   sure:    自信ありでまちがえた問題は、まちがいの数が0でも復習に入る。judge は1問に1回だけ（2回目は null）。数は stats に残る
//   mix:     今日出す復習は種類が続かない・多くて10問
//   nosave:  保存に失敗しても開いているあいだは覚え、saveWarn(true) を呼ぶ。保存できるようになったら合わせて書く
//   junk:    壊れた記録（配列・文字・変な日付）でも止まらず、空の形に直す
//   proto:   鍵が constructor・__proto__・toString でも止まらず、ふつうの鍵として数える（2026-11-11 CodeRabbit）
//   valid:   setValid で作り直せないと言われた鍵は数えず、出さない（引き継ぎで入った・種類が消えた鍵）
//   offline: 外へ通信する書き方が無い
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function store(init = {}) {
  const m = new Map(Object.entries(init));
  let broken = false;
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (broken) throw new Error("QuotaExceededError"); m.set(k, String(v)); },
    removeItem: (k) => m.delete(k),
    break(on) { broken = on; }, _m: m,
  };
}

function boot(code, { ls = store(), now = Date.parse("2026-11-11T03:00:00Z") } = {}) {
  const clock = { t: now };
  const RealDate = Date;
  class FakeDate extends RealDate { constructor(...a) { super(...(a.length ? a : [clock.t])); } static now() { return clock.t; } }
  const els = {};
  const document = {
    currentScript: { dataset: { game: "t", key: "t-depth" } },
    head: { appendChild() {} }, documentElement: { appendChild() {} },
    getElementById: (id) => els[id] || null, createElement: () => ({}), addEventListener() {},
  };
  const warn = { n: 0 };
  const window = { saveWarn: (on) => { if (on) warn.n++; } };
  const ctx = { window, document, localStorage: ls, Date: FakeDate, JSON, Math, Number, String, Object, Array };
  vm.runInNewContext(code, ctx);
  const D = window.Depth;
  return { D, ls, warn, els, day: (n) => { clock.t += n * 864e5; } };
}

export async function checkDepth(code) {
  const errors = [];
  const ok = (name, cond) => { if (!cond) errors.push(name); };
  const live = code.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  ok("offline: depth.js が外へ通信しない", !/\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|\bimport\(/.test(live));
  ok("depth.js に「深さの版: N」の行がある", /深さの版:\s*\d+/.test(code));

  try {
    // gaps
    let t = boot(code);
    t.D.mark("a|1", 1, "広告A");
    ok("gaps: まちがえた日は復習に出ない", t.D.count() === 0 && t.D.waiting() === 1);
    t.day(1); ok("gaps: 1日後に出る", t.D.due()[0] === "a|1");
    t.D.mark("a|1", 0); ok("gaps: 正解したら次は3日後", t.D.count() === 0);
    t.day(2); ok("gaps: 2日後はまだ", t.D.count() === 0);
    t.day(1); ok("gaps: 3日後に出る", t.D.count() === 1);
    t.D.mark("a|1", 2); t.day(1); ok("gaps: 復習でまちがえたら1日後に戻る", t.D.count() === 1);
    t.D.mark("a|1", 0); t.day(3); t.D.mark("a|1", 0); t.day(7); ok("gaps: 7日後に出る", t.D.count() === 1);
    t.D.mark("a|1", 0); ok("gaps: 3回続けて正解で覚えた", t.D.waiting() === 0 && t.D.stats().learned === 1);

    // notyet
    t = boot(code);
    t.D.mark("b|1", 0); ok("notyet: 復習に無い問題の正解は何も足さない", t.D.waiting() === 0);
    t.D.mark("b|1", 1); t.D.mark("b|1", 0); ok("notyet: 日の来ていない復習は正解でも進まない", t.D.waiting() === 1);
    t.day(1); ok("notyet: 次の日に出る", t.D.count() === 1);

    // sure
    t = boot(code);
    t.D.runStart(); t.D.bindSure("c|1");
    t.els["dp-sure"] = null;
    const btn = { setAttribute() {}, set textContent(v) {}, disabled: false, onclick: null };
    t.els["dp-sure"] = btn; t.D.bindSure("c|1"); btn.onclick();
    const j = t.D.judge(false);
    ok("sure: 自信ありでまちがえたと分かる", j && j.sure === true && j.ok === false && j.text);
    ok("sure: judge は1問に1回", t.D.judge(true) === null);
    t.D.mark("c|1", 0, "C");
    ok("sure: 自信ありのまちがいは復習に入る", t.D.waiting() === 1);
    t.D.bindSure("c|2"); btn.onclick(); t.D.judge(true); t.D.mark("c|2", 0);
    t.D.bindSure("c|3"); t.D.judge(true); t.D.mark("c|3", 0);
    const rs = t.D.runStats(), st = t.D.stats();
    ok("sure: 1回分の数（3問・自信あり2・当たり1）", rs.n === 3 && rs.sure === 2 && rs.sureOk === 1);
    ok("sure: 通しの数が残る", st.sure === 2 && st.sureOk === 1);
    ok("sure: 押さなければ「たぶん」のまま（自信ありに数えない）", rs.sure === 2);

    // mix
    t = boot(code);
    for (let i = 0; i < 8; i++) t.D.mark(`x|${i}`, 1);
    for (let i = 0; i < 8; i++) t.D.mark(`y|${i}`, 1);
    t.day(1);
    const d = t.D.due();
    ok("mix: 多くて10問", d.length === 10);
    ok("mix: 種類が続かない", d.every((k, i) => i === 0 || k.split("|")[0] !== d[i - 1].split("|")[0]));

    // nosave
    const ls = store();
    t = boot(code, { ls });
    ls.break(true); t.D.mark("n|1", 1);
    ok("nosave: 保存できなくても覚えている", t.D.waiting() === 1);
    ok("nosave: saveWarn(true) を呼ぶ", t.warn.n >= 1);
    ls.break(false); t.D.mark("n|2", 1);
    ok("nosave: 保存できたら控えと合わせて書く", Object.keys(JSON.parse(ls.getItem("t-depth")).rv).length === 2);

    // junk
    for (const v of ['[1,2]', '"x"', '{"rv":[1],"sure":"a"}', '{"rv":{"k":{"due":"2026-99-99","s":9}},"sure":-3,"sureOk":5}', "{bad"]) {
      t = boot(code, { ls: store({ "t-depth": v }) });
      let s = null; try { s = t.D.stats(); t.D.due(); } catch (e) { s = null; }
      ok(`junk: 壊れた記録 ${v} でも止まらない`, s && s.sure >= 0 && s.sureOk <= s.sure);
    }

    // proto
    const pj = JSON.stringify({ rv: { "constructor|x": { s: 0, due: "2026-11-01", t: 1 }, "toString": { s: 0, due: "2026-11-01", t: 2 }, "hasOwnProperty|y": { s: 0, due: "2026-11-01", t: 3 } } });
    t = boot(code, { ls: store({ "t-depth": pj }) });
    let pc = -1; try { pc = t.D.count(); t.D.mark("constructor|z", 1); t.D.mark("__proto__", 1); t.D.mark("valueOf|1", 0); } catch (e) { pc = -1; }
    ok("proto: constructor などの鍵でも止まらず数える", pc === 3);
    ok("proto: constructor|z は復習に入り、__proto__ は入れない", t.D.waiting() === 4);

    // valid
    t = boot(code);
    t.D.mark("ok|1", 1); t.D.mark("gone|1", 1); t.D.mark("ok|2", 1);
    t.D.setValid((k) => k.startsWith("ok|")); t.day(1);
    const vd = t.D.due();
    ok("valid: 作り直せない鍵は数えない・出さない", t.D.count() === 2 && vd.every((k) => k.startsWith("ok|")));
    t.D.setValid(() => { throw new Error("x"); });
    ok("valid: 確かめる関数が止まっても、出さないだけで止まらない", t.D.count() === 0);
  } catch (e) {
    errors.push("depth.js を動かすと止まった: " + (e && e.message));
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2] || "depth.js";
  const errs = await checkDepth(readFileSync(file, "utf8"));
  if (errs.length) { for (const e of errs) console.error("✗ " + e); process.exit(1); }
  console.log("✓ depth.js（自信をかける・復習）");
}
