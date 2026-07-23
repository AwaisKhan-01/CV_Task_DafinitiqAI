// Run: node src/lib/__tests__/debounce.test.mjs
//
// The debouncer is the piece most worth testing: it is pure logic with no
// browser dependency, and getting it wrong produces either a flood of noise
// or silence. These simulate 200ms sampling and feed it condition patterns.

import { createSustainedDetector } from "../debounce.js";

let pass = 0,
  fail = 0;

function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`      got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  ok ? pass++ : fail++;
}

function run(pattern, sustainMs = 6000, recoveryMs = 1000) {
  const events = [];
  const d = createSustainedDetector({ sustainMs, recoveryMs, onEvent: (ms) => events.push(ms) });
  let t = 0;
  for (const cond of pattern) {
    d.update(cond, t);
    t += 200;
  }
  return { events, d, endTime: t };
}

const rep = (v, n) => Array(n).fill(v);

// A brief glance is normal behaviour and must not register.
check("2s glance produces no event", run([...rep(false, 5), ...rep(true, 10), ...rep(false, 15)]).events, []);

// The research median for an innocent gaze aversion during recall is ~3.9s.
// This is the single most important test in the file.
check("3.9s recall aversion produces no event", run([...rep(false, 5), ...rep(true, 20), ...rep(false, 15)]).events, []);

const r3 = run([...rep(false, 5), ...rep(true, 50), ...rep(false, 15)]);
check("10s look-away fires once", r3.events.length, 1);
check("  duration is ~10s", r3.events[0] >= 9000 && r3.events[0] <= 11000, true);

// Without the recovery window this would report two events instead of one.
const flicker = [...rep(false, 5), ...rep(true, 40), false, ...rep(true, 40), ...rep(false, 15)];
check("one dropped frame does not split the event", run(flicker).events.length, 1);

const twice = [...rep(false, 5), ...rep(true, 40), ...rep(false, 20), ...rep(true, 40), ...rep(false, 15)];
check("two separate look-aways fire twice", run(twice).events.length, 2);

check("alternating noise produces no events", run(Array.from({ length: 100 }, (_, i) => i % 2 === 0)).events, []);

// A session ending mid-event must still record it.
const r7 = run([...rep(false, 5), ...rep(true, 50)]);
check("open event not yet logged", r7.events.length, 0);
r7.d.flush(r7.endTime);
check("flush logs the open event", r7.events.length, 1);

check("2s threshold fires on 3s condition", run([...rep(false, 5), ...rep(true, 15), ...rep(false, 10)], 2000).events.length, 1);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
