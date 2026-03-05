/**
 * 네온 아고라 — 스트레스 테스트
 *
 * 사용법:
 *   1. npm run build && npm start   (다른 터미널)
 *   2. node scripts/stress-test.mjs
 *
 * 시나리오:
 *   - Phase 1: Warm-up (10 concurrent, 10s)
 *   - Phase 2: Normal load (50 concurrent, 15s)
 *   - Phase 3: Spike (200 concurrent, 15s)
 *   - Phase 4: Sustained high (100 concurrent, 20s)
 */

import autocannon from "autocannon"

const BASE = process.env.TEST_URL || "http://localhost:3000"

const ENDPOINTS = [
  { path: "/", weight: 30, label: "홈 (SSR)" },
  { path: "/arena", weight: 15, label: "아레나" },
  { path: "/rankings?tab=overall", weight: 10, label: "랭킹" },
  { path: "/tournaments", weight: 10, label: "토너먼트" },
  { path: "/terms", weight: 5, label: "약관 (Static)" },
  { path: "/privacy", weight: 5, label: "개인정보 (Static)" },
  { path: "/api/health", weight: 15, label: "Health API" },
  { path: "/stats", weight: 10, label: "통계 (SSR)" },
]

// Build weighted request list
function buildRequests() {
  const requests = []
  for (const ep of ENDPOINTS) {
    for (let i = 0; i < ep.weight; i++) {
      requests.push({ path: ep.path, label: ep.label })
    }
  }
  return requests
}

const REQUESTS = buildRequests()

function getRandomRequest() {
  return REQUESTS[Math.floor(Math.random() * REQUESTS.length)]
}

const PHASES = [
  { name: "Phase 1: Warm-up", connections: 10, duration: 10 },
  { name: "Phase 2: Normal Load (50 users)", connections: 50, duration: 15 },
  { name: "Phase 3: Spike (200 users)", connections: 200, duration: 15 },
  { name: "Phase 4: Sustained High (100 users)", connections: 100, duration: 20 },
]

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

function printResult(phase, result) {
  const { requests, latency, throughput, errors, timeouts, non2xx } = result

  console.log(`\n${"═".repeat(60)}`)
  console.log(`  ${phase.name}`)
  console.log(`  Connections: ${phase.connections} | Duration: ${phase.duration}s`)
  console.log(`${"═".repeat(60)}`)

  console.log(`\n  Requests:`)
  console.log(`    Total:    ${requests.total}`)
  console.log(`    Avg/sec:  ${requests.average}`)
  console.log(`    Mean:     ${requests.mean}`)

  console.log(`\n  Latency (ms):`)
  console.log(`    Avg:      ${latency.average}`)
  console.log(`    p50:      ${latency.p50}`)
  console.log(`    p90:      ${latency.p90}`)
  console.log(`    p99:      ${latency.p99}`)
  console.log(`    Max:      ${latency.max}`)

  console.log(`\n  Throughput:`)
  console.log(`    Avg/sec:  ${formatBytes(throughput.average)}`)
  console.log(`    Total:    ${formatBytes(throughput.total)}`)

  console.log(`\n  Errors:`)
  console.log(`    Errors:   ${errors}`)
  console.log(`    Timeouts: ${timeouts}`)
  console.log(`    Non-2xx:  ${non2xx}`)

  // Grade
  const grade = getGrade(latency, errors, timeouts, non2xx, phase.connections)
  console.log(`\n  Grade:      ${grade}`)
}

function getGrade(latency, errors, timeouts, non2xx, connections) {
  const errorRate = errors + timeouts + non2xx
  if (errorRate > 0 && connections <= 50) return "❌ FAIL — errors under normal load"
  if (latency.p99 > 10000) return "❌ FAIL — p99 > 10s"
  if (latency.p99 > 5000) return "⚠️  WARN — p99 > 5s"
  if (latency.average > 3000) return "⚠️  WARN — avg > 3s"
  if (latency.average > 1000) return "🟡 OK — avg > 1s, consider optimization"
  if (errorRate === 0 && latency.p99 < 2000) return "✅ EXCELLENT"
  if (errorRate === 0) return "✅ PASS"
  return "🟡 OK — some errors under high load"
}

async function runPhase(phase) {
  return new Promise((resolve, reject) => {
    const instance = autocannon({
      url: BASE,
      connections: phase.connections,
      duration: phase.duration,
      pipelining: 1,
      timeout: 15,
      requests: [
        {
          setupRequest(req) {
            const r = getRandomRequest()
            req.path = r.path
            return req
          },
        },
      ],
    }, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })

    // Progress tracking
    autocannon.track(instance, { renderProgressBar: false })
  })
}

async function main() {
  console.log(`\n${"╔" + "═".repeat(58) + "╗"}`)
  console.log(`${"║"}  네온 아고라 — 스트레스 테스트${"".padEnd(27)}${"║"}`)
  console.log(`${"║"}  Target: ${BASE.padEnd(48)}${"║"}`)
  console.log(`${"╚" + "═".repeat(58) + "╝"}`)
  console.log(`\n  Endpoints:`)
  for (const ep of ENDPOINTS) {
    console.log(`    ${ep.label.padEnd(22)} ${ep.path}`)
  }

  // Connectivity check
  try {
    const resp = await fetch(`${BASE}/api/health`)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    console.log(`\n  ✓ Server reachable (${resp.status})`)
  } catch (e) {
    console.error(`\n  ✗ Cannot reach ${BASE} — is the server running?`)
    console.error(`    Start with: npm start`)
    process.exit(1)
  }

  const results = []

  for (const phase of PHASES) {
    console.log(`\n  ▶ Running ${phase.name}...`)
    const result = await runPhase(phase)
    printResult(phase, result)
    results.push({ phase, result })
  }

  // Summary
  console.log(`\n${"═".repeat(60)}`)
  console.log(`  SUMMARY`)
  console.log(`${"═".repeat(60)}`)
  console.log(`  ${"Phase".padEnd(32)} ${"Req/s".padStart(8)} ${"p50".padStart(8)} ${"p99".padStart(8)} ${"Err".padStart(6)}`)
  console.log(`  ${"-".repeat(62)}`)
  for (const { phase, result } of results) {
    const err = result.errors + result.timeouts + result.non2xx
    console.log(
      `  ${phase.name.padEnd(32)} ${String(result.requests.average).padStart(8)} ${(result.latency.p50 + "ms").padStart(8)} ${(result.latency.p99 + "ms").padStart(8)} ${String(err).padStart(6)}`
    )
  }

  const totalErrors = results.reduce((s, r) => s + r.result.errors + r.result.timeouts + r.result.non2xx, 0)
  const maxP99 = Math.max(...results.map((r) => r.result.latency.p99))
  const totalRequests = results.reduce((s, r) => s + r.result.requests.total, 0)

  console.log(`\n  Total Requests: ${totalRequests}`)
  console.log(`  Total Errors:   ${totalErrors}`)
  console.log(`  Max p99:        ${maxP99}ms`)

  if (totalErrors === 0 && maxP99 < 5000) {
    console.log(`\n  🎉 Overall: PASSED — Ready for production!`)
  } else if (totalErrors > totalRequests * 0.05) {
    console.log(`\n  ❌ Overall: FAILED — Error rate too high (${((totalErrors / totalRequests) * 100).toFixed(1)}%)`)
  } else {
    console.log(`\n  🟡 Overall: ACCEPTABLE — Minor issues under extreme load`)
  }

  console.log()
}

main().catch(console.error)
