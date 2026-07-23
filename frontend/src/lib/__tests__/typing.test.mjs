// Run: node src/lib/__tests__/typing.test.mjs
//
// These exist because the first version of the speed check was silently dead:
// it compared the growth between consecutive change events against a minimum
// character count, but real typing grows the text by exactly one character at
// a time, so the condition could never be true. Nothing failed loudly -- fast
// typing simply went undetected. Hence the tests.
//
// Reference points from the 168,000-person typing study: mean 51.6 WPM
// (~4.3 cps), fastest 5% above 80 WPM, maximum observed ~120 WPM (~10 cps).

import { createTypingTracker } from "../typing.js";

// Fake clock so timings are exact and the tests do not depend on wall time.
const realNow = Date.now;
let clock = 1000000;
Date.now = () => clock;

function type(msPerChar, nChars) {
  const t = createTypingTracker();
  let text = "";
  for (let i = 0; i < nChars; i++) {
    clock += msPerChar;
    t.onKeyDown();
    text += "x";
    t.onChange(text);
  }
  return t.summary();
}

function paste(chars) {
  const t = createTypingTracker();
  clock += 300;
  const text = "y".repeat(chars);
  t.onPaste(text);
  t.onChange(text);
  return t.summary();
}

let pass = 0,
  fail = 0;

function check(name, got, want) {
  const ok = got === want;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (got ${got}, want ${want})`);
  ok ? pass++ : fail++;
}

console.log("Human typing must NOT flag:");
check("  3 cps (slow)", type(333, 60).pasted, false);
check("  5 cps (population mean)", type(200, 60).pasted, false);
check("  10 cps (~120 WPM, max of 168k people)", type(100, 60).pasted, false);
check("  11.8 cps (just under threshold)", type(85, 60).pasted, false);

console.log("\nMachine-speed input MUST flag:");
check("  16 cps sustained", type(60, 60).pasted, true);
check("  50 cps sustained", type(20, 60).pasted, true);
check("  200 cps sustained", type(5, 60).pasted, true);

console.log("\nPaste detection still works:");
check("  412-character paste", paste(412).pasted, true);

console.log("\nRecorded speed is accurate at both ends:");
check("  50 cps typing records ~50", Math.round(type(20, 60).maxCps) >= 45, true);
check("  5 cps typing records ~5", Math.round(type(200, 60).maxCps) <= 7, true);

console.log("\nOne burst logs once, not once per keystroke:");
check("  100 chars at 100 cps -> few flags", type(10, 100).flags.length <= 2, true);

Date.now = realNow;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
