const fs = require('fs');
const path = require('path');

const scriptPath = path.join(__dirname, '..', 'script.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

if (!scriptContent.includes('const VernierEngine = {')) {
  console.error('FAIL: VernierEngine not found in script.js');
  process.exit(1);
}

global.document = {
  addEventListener: () => {},
  querySelectorAll: () => [],
  querySelector: () => null,
  getElementById: () => null
};
global.window = {
  addEventListener: () => {}
};

const fn = new Function(scriptContent + '\nreturn VernierEngine;');
const VernierEngine = fn();

console.log("Checking VernierEngine instance from script.js...");
const res = VernierEngine.calculate(23, 6, 0.2);
console.log("Calculation result for MSR 23, VSD 6, Zero Error +0.2:", res);

if (Math.abs(res.observed - 23.6) > 0.001 || Math.abs(res.corrected - 23.4) > 0.001) {
  console.error("FAIL: Arithmetic mismatch");
  process.exit(1);
}

const sim = VernierEngine.simulateMeasurement(24.0, 0.2);
console.log("Simulation for 24.0mm cylinder with +0.2mm error:", sim);
if (!sim.isTrue || Math.abs(sim.corrected - 24.0) > 0.001) {
  console.error("FAIL: Simulation mismatch");
  process.exit(1);
}

console.log("ALL SCRIPT.JS BACKEND ENGINE CHECKS PASSED!");
