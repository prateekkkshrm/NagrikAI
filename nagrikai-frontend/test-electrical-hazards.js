// test-electrical-hazards.js
// Automated regression tests verifying that electrical hazards mentioning a road are never classified as pothole queries
import { generateOfflineCivicResponse } from './src/localCivicAi.js';

const testCases = [
  'What should I do if a live electrical wire falls on the road?',
  'Live electrical wire falls on the road',
  'fallen electric pole on Pari Chowk road',
  'exposed electrical cable on the street',
  'electric wires sparking on road divider',
  'broken live wire in Beta 2 main road',
  'transformer fire near the road',
  'करंट वाला तार सड़क पर गिर गया',
  'बिजली का तार टूट गया',
  'बिजली के तार में आग लग गई'
];

let failed = 0;

console.log('Running Electrical Hazard Regression Test Suite...\n');

for (const query of testCases) {
  const res = generateOfflineCivicResponse(query);

  const checks = [
    {
      name: 'Has NPCL Electrical Emergency 9718722222',
      pass: res.en.includes('9718722222') || res.hi.includes('9718722222')
    },
    {
      name: 'Has UP Emergency 112',
      pass: res.en.includes('112') || res.hi.includes('112')
    },
    {
      name: 'Contains safety instruction (stay far away / touch)',
      pass: (res.en.includes('Stay far away') || res.hi.includes('दूर रहें')) &&
            (res.en.includes('Never touch') || res.hi.includes('न छुएं'))
    },
    {
      name: 'NEVER classified as pothole/road maintenance',
      pass: !res.en.includes('pothole maintenance') &&
            !res.en.includes('GNIDA Civil Maintenance') &&
            !res.en.includes('minor surface patching') &&
            !res.hi.includes('गड्ढों की मरम्मत')
    },
    {
      name: 'Does NOT show Traffic Police number',
      pass: !res.en.includes('9971009001') && !res.hi.includes('9971009001')
    }
  ];

  console.log(`Query: "${query}"`);
  for (const c of checks) {
    if (!c.pass) {
      console.error(`  ❌ FAIL: ${c.name}`);
      failed++;
    } else {
      console.log(`  ✓ ${c.name}`);
    }
  }
  console.log('');
}

if (failed > 0) {
  console.error(`❌ ${failed} checks failed!`);
  process.exit(1);
} else {
  console.log('🎉 ALL 10 REGRESSION TEST SCENARIOS PASSED WITH ZERO FAILURES.');
}
