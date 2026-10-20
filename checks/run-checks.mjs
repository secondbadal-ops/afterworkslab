// afterworkslab 일일 자동 점검 — 계산 로직 핵심 검증 (GitHub Actions에서 실행)
// 저장소 루트 기준 경로: tools/mm-mh/calc.js, tools/project-estimate/calc.js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const a = require('../tools/mm-mh/calc.js');
const b = require('../tools/project-estimate/calc.js');

let pass = 0, fail = 0;
function eq(name, got, want) {
  const ok = typeof want === 'number' ? Math.abs(got - want) < 1e-6 : got === want;
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + ' got=' + got + ' want=' + want);
  ok ? pass++ : fail++;
}

// 도구 A 핵심 사례 (확정 규칙 예시)
let t1 = a.totalEffort([{ count: 1, days: 20, hoursPerDay: 8, ratePct: 100 }], 160);
eq('A 예시1 MH', t1.mh, 160); eq('A 예시1 MM', t1.mm, 1.0);
let t2 = a.totalEffort([{ count: 3, days: 22, hoursPerDay: 8, ratePct: 100 }], 160);
eq('A 예시2 MH', t2.mh, 528); eq('A 예시2 MM', t2.mm, 3.3);
eq('A 월 기준시간 파생', a.monthlyStandardHours(8, 21), 168);

// 도구 B 핵심 사례 (GPT 검수 기준 사례: 2명·10일·월단가 800만·참여율 50%·제경비 20%·기술료 10%·직접경비 20만)
const ctx = { hoursPerDay: 8, workdaysPerMonth: 20, stdMonthlyHours: 160 };
let g = b.estimate([{ count: 2, days: 10, rateBasis: 'month', unitPrice: 8000000, ratePct: 50 }], ctx,
  { overheadPct: 20, techPct: 10, directExpense: 200000, vatMode: 'separate' });
eq('B GPT사례 MM', g.totalMM, 0.5);
eq('B GPT사례 직접인건비', g.labor, 4000000);
eq('B GPT사례 공급가액', g.subtotal, 5480000);
eq('B GPT사례 부가세', g.vat, 548000);
eq('B GPT사례 최종', g.grandTotal, 6028000);
let e1 = b.estimate([{ count: 2, days: 20, rateBasis: 'hour', unitPrice: 50000, ratePct: 100 }], ctx,
  { overheadPct: 0, techPct: 0, directExpense: 0, vatMode: 'separate' });
eq('B 예시1 인건비', e1.labor, 16000000); eq('B 예시1 총합', e1.grandTotal, 17600000);

// 교차 일치 — 같은 공수 입력이면 도구 A와 B의 MM이 같아야 한다
let ta = a.totalEffort([{ count: 2, days: 15, hoursPerDay: 8, ratePct: 50 }], 160);
let eb = b.estimate([{ count: 2, days: 15, rateBasis: 'hour', unitPrice: 10000, ratePct: 50 }], ctx,
  { overheadPct: 0, techPct: 0, directExpense: 0, vatMode: 'separate' });
eq('교차 MM 일치', eb.totalMM, ta.mm); eq('교차 MD 일치', eb.totalMD, ta.md);

// U-5 입력 상한 (2026-10-20 확정)
eq('A 상한 인원', a.LIMITS.count, 1000);
eq('B 상한 단가', b.LIMITS.unitPrice, 10000000000);
eq('A 상한 초과 오류', a.parseField('1001', '인원', a.LIMITS.count).ok, false);
eq('A 상한 경계 정상', a.parseField('1000', '인원', a.LIMITS.count).ok, true);
eq('B 상한 초과 오류', b.parseField('10000000001', '단가', b.LIMITS.unitPrice).ok, false);
eq('B 직접경비 상한 초과 오류', b.parseOptional('100000000001', '직접경비', b.LIMITS.directExpense).ok, false);

// 검증 규칙 기본
eq('A 빈 칸 오류', a.parseField('', '인원').ok, false);
eq('B 참여율 100 초과 오류', b.parseRate('101').ok, false);
eq('B 제경비 120% 정상', b.parseOptionalRate('120', '제경비 요율').value, 120);

console.log('---');
console.log('daily-check pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
