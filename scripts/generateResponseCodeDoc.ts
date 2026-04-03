import {
  BUSINESS_ERROR_RESPONSE_CODE_MAP,
  RESPONSE_CODE_SCOPE_RULES,
  SUCCESS_RESPONSE_CODE_MAP,
  SYSTEM_ERROR_RESPONSE_CODE_MAP,
  type ResponseCodeMap,
} from '../src/constants/responseCodeMap'

function toSortedEntries(map: ResponseCodeMap) {
  return Object.entries(map)
    .map(([code, definition]) => ({
      code: Number(code),
      ...definition,
    }))
    .sort((a, b) => a.code - b.code)
}

function renderTable(title: string, map: ResponseCodeMap) {
  const entries = toSortedEntries(map)
  const lines = [
    `## ${title}`,
    '',
    '| code | httpStatus | message |',
    '| --- | --- | --- |',
  ]

  for (const entry of entries) {
    lines.push(`| ${entry.code} | ${entry.httpStatus} | ${entry.message} |`)
  }

  lines.push('')
  return lines
}

const content = [
  '# Response Code Map',
  '',
  '> 由 `scripts/generateResponseCodeDoc.ts` 自动生成，请勿手工修改。',
  '',
  '## 号段规则',
  '',
  `- 成功码：${RESPONSE_CODE_SCOPE_RULES.success}`,
  `- 业务错误码：${RESPONSE_CODE_SCOPE_RULES.businessError}`,
  `- 系统错误码：${RESPONSE_CODE_SCOPE_RULES.systemError}`,
  '',
  ...renderTable('成功码', SUCCESS_RESPONSE_CODE_MAP),
  ...renderTable('业务错误码', BUSINESS_ERROR_RESPONSE_CODE_MAP),
  ...renderTable('系统错误码', SYSTEM_ERROR_RESPONSE_CODE_MAP),
].join('\n')

const docsDir = `${import.meta.dir}/../docs`
const outputPath = `${docsDir}/response-codes.md`

await Bun.$`mkdir -p ${docsDir}`
await Bun.write(outputPath, content)

console.log(`Generated: ${outputPath}`)
