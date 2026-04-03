#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

type OutputFormat = 'markdown' | 'json'

interface CliArgs {
  format: OutputFormat
  maxCandidates: number
  projectDir: string
  writePath?: string
}

interface TableDefinition {
  columns: string[]
  filePath: string
  tableName: string
  varName: string
}

interface DomainCandidate {
  domain: string
  reason: string
  score: number
}

interface TableSuggestion {
  candidates: DomainCandidate[]
  columns: string[]
  filePath: string
  tableName: string
  varName: string
}

interface SuggestionResult {
  generatedAt: string
  projectDir: string
  recommendedConstants: Record<string, string>
  schemaFiles: string[]
  tableSuggestions: TableSuggestion[]
}

interface ScanState {
  braceDepth: number
  bracketDepth: number
  escaped: boolean
  inBlockComment: boolean
  inDoubleQuote: boolean
  inSingleQuote: boolean
  inTemplateString: boolean
  parenDepth: number
}

const TABLE_DECLARATION_RE = /export const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:pgTable|mysqlTable|sqliteTable)\(\s*['"`]([^'"`]+)['"`]/g

const ACCOUNT_COLUMNS = ['name', 'email', 'password', 'phone', 'avatar', 'nickname']
const ACCESS_COLUMNS = ['permission', 'role', 'scope', 'ispublic', 'allow', 'deny']
const STATUS_COLUMNS = ['status', 'state']
const TIME_WINDOW_COLUMNS = ['startat', 'endat', 'expiresat', 'deletedat', 'publishedat']
const OWNERSHIP_COLUMNS = ['userid', 'ownerid', 'creatorid', 'tenantid']

function printHelp(): void {
  const lines = [
    'Usage:',
    '  bun suggest-domains.ts [options]',
    '',
    'Options:',
    '  --project <path>          Project directory to scan.',
    '  --format <markdown|json>  Output format. Default: markdown.',
    '  --max-candidates <n>      Max candidates per table in markdown. Default: 4.',
    '  --write <path>            Optional output file path.',
    '  --help                    Show help.',
    '',
    'Default project detection:',
    '  1) <cwd>/packages/server (if src/db exists)',
    '  2) <cwd> (if src/db exists)',
  ]

  process.stdout.write(`${lines.join('\n')}\n`)
}

function detectDefaultProjectDir(): string {
  const cwd = process.cwd()
  const monorepoServerDir = resolve(cwd, 'packages/server')
  if (existsSync(join(monorepoServerDir, 'src/db'))) {
    return monorepoServerDir
  }

  if (existsSync(join(cwd, 'src/db'))) {
    return cwd
  }

  return monorepoServerDir
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    format: 'markdown',
    maxCandidates: 4,
    projectDir: detectDefaultProjectDir(),
  }

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i]

    if (current === '--help' || current === '-h') {
      printHelp()
      process.exit(0)
    }

    if (current === '--project') {
      const value = argv[i + 1]
      if (!value) {
        throw new Error('--project requires a value')
      }
      args.projectDir = resolve(process.cwd(), value)
      i += 1
      continue
    }

    if (current === '--format') {
      const value = argv[i + 1]
      if (!value) {
        throw new Error('--format requires a value')
      }

      if (value === 'markdown' || value === 'md') {
        args.format = 'markdown'
      }
      else if (value === 'json') {
        args.format = 'json'
      }
      else {
        throw new Error(`Unsupported format: ${value}`)
      }

      i += 1
      continue
    }

    if (current === '--max-candidates') {
      const value = argv[i + 1]
      if (!value) {
        throw new Error('--max-candidates requires a value')
      }

      const parsed = Number.parseInt(value, 10)
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error(`Invalid --max-candidates value: ${value}`)
      }
      args.maxCandidates = parsed
      i += 1
      continue
    }

    if (current === '--write') {
      const value = argv[i + 1]
      if (!value) {
        throw new Error('--write requires a value')
      }
      args.writePath = resolve(process.cwd(), value)
      i += 1
      continue
    }

    throw new Error(`Unknown option: ${current}`)
  }

  return args
}

function walkFiles(rootDir: string, collector: string[]): void {
  const entries = readdirSync(rootDir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))

  for (const entry of entries) {
    const absolutePath = join(rootDir, entry.name)
    if (entry.isDirectory()) {
      walkFiles(absolutePath, collector)
      continue
    }

    if (entry.isFile()) {
      collector.push(absolutePath)
    }
  }
}

function collectSchemaFiles(projectDir: string): string[] {
  const schemaFiles: string[] = []
  const sourceRoot = resolve(projectDir, 'src/db')

  if (existsSync(sourceRoot)) {
    const allFiles: string[] = []
    walkFiles(sourceRoot, allFiles)
    for (const filePath of allFiles) {
      if (/[/\\]schemas[/\\]tables\.ts$/.test(filePath)) {
        schemaFiles.push(filePath)
      }
    }
  }

  if (schemaFiles.length > 0) {
    return schemaFiles.sort((left, right) => left.localeCompare(right))
  }

  const fallbackSchema = resolve(projectDir, 'drizzle/schema.ts')
  if (existsSync(fallbackSchema)) {
    return [fallbackSchema]
  }

  return []
}

function parseTablesFromFile(filePath: string): TableDefinition[] {
  const source = readFileSync(filePath, 'utf8')
  const matches = Array.from(source.matchAll(TABLE_DECLARATION_RE))

  if (matches.length === 0) {
    return []
  }

  const tables: TableDefinition[] = []

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index]
    const next = matches[index + 1]
    const start = current.index ?? 0
    const end = next?.index ?? source.length
    const block = source.slice(start, end)
    const columns = extractTopLevelColumns(block)

    tables.push({
      columns,
      filePath,
      tableName: current[2],
      varName: current[1],
    })
  }

  return tables
}

function createInitialScanState(): ScanState {
  return {
    braceDepth: 0,
    bracketDepth: 0,
    escaped: false,
    inBlockComment: false,
    inDoubleQuote: false,
    inSingleQuote: false,
    inTemplateString: false,
    parenDepth: 0,
  }
}

function isTopLevel(state: ScanState): boolean {
  return (
    !state.inBlockComment
    && !state.inDoubleQuote
    && !state.inSingleQuote
    && !state.inTemplateString
    && state.parenDepth === 0
    && state.bracketDepth === 0
    && state.braceDepth === 0
  )
}

function skipWhitespaceAndComments(input: string, start: number): number {
  let cursor = start

  while (cursor < input.length) {
    const char = input[cursor]
    const next = input[cursor + 1]

    if (/\s/.test(char)) {
      cursor += 1
      continue
    }

    if (char === '/' && next === '/') {
      cursor += 2
      while (cursor < input.length && input[cursor] !== '\n') {
        cursor += 1
      }
      continue
    }

    if (char === '/' && next === '*') {
      cursor += 2
      while (cursor < input.length - 1) {
        if (input[cursor] === '*' && input[cursor + 1] === '/') {
          cursor += 2
          break
        }
        cursor += 1
      }
      continue
    }

    break
  }

  return cursor
}

function extractColumnsObjectBody(block: string): string | undefined {
  const callMatch = /\b(?:pgTable|mysqlTable|sqliteTable)\s*\(/.exec(block)
  if (!callMatch) {
    return undefined
  }

  const openParenIndex = callMatch.index + callMatch[0].length - 1
  let cursor = openParenIndex + 1
  let parenDepth = 1
  let inSingleQuote = false
  let inDoubleQuote = false
  let inTemplateString = false
  let escaped = false
  let inBlockComment = false

  while (cursor < block.length) {
    const char = block[cursor]
    const next = block[cursor + 1]

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false
        cursor += 2
        continue
      }
      cursor += 1
      continue
    }

    if (inSingleQuote) {
      if (!escaped && char === "'") {
        inSingleQuote = false
      }
      escaped = !escaped && char === '\\'
      cursor += 1
      continue
    }

    if (inDoubleQuote) {
      if (!escaped && char === '"') {
        inDoubleQuote = false
      }
      escaped = !escaped && char === '\\'
      cursor += 1
      continue
    }

    if (inTemplateString) {
      if (!escaped && char === '`') {
        inTemplateString = false
      }
      escaped = !escaped && char === '\\'
      cursor += 1
      continue
    }

    if (char === '/' && next === '*') {
      inBlockComment = true
      cursor += 2
      continue
    }

    if (char === '/' && next === '/') {
      cursor += 2
      while (cursor < block.length && block[cursor] !== '\n') {
        cursor += 1
      }
      continue
    }

    if (char === "'") {
      inSingleQuote = true
      escaped = false
      cursor += 1
      continue
    }

    if (char === '"') {
      inDoubleQuote = true
      escaped = false
      cursor += 1
      continue
    }

    if (char === '`') {
      inTemplateString = true
      escaped = false
      cursor += 1
      continue
    }

    if (char === '(') {
      parenDepth += 1
      cursor += 1
      continue
    }

    if (char === ')') {
      parenDepth -= 1
      if (parenDepth <= 0) {
        break
      }
      cursor += 1
      continue
    }

    if (char === ',' && parenDepth === 1) {
      cursor += 1
      cursor = skipWhitespaceAndComments(block, cursor)
      if (block[cursor] !== '{') {
        return undefined
      }

      const objectStart = cursor
      let objectCursor = objectStart
      let objectDepth = 0
      let objectInSingleQuote = false
      let objectInDoubleQuote = false
      let objectInTemplateString = false
      let objectEscaped = false
      let objectInBlockComment = false

      while (objectCursor < block.length) {
        const objectChar = block[objectCursor]
        const objectNext = block[objectCursor + 1]

        if (objectInBlockComment) {
          if (objectChar === '*' && objectNext === '/') {
            objectInBlockComment = false
            objectCursor += 2
            continue
          }
          objectCursor += 1
          continue
        }

        if (objectInSingleQuote) {
          if (!objectEscaped && objectChar === "'") {
            objectInSingleQuote = false
          }
          objectEscaped = !objectEscaped && objectChar === '\\'
          objectCursor += 1
          continue
        }

        if (objectInDoubleQuote) {
          if (!objectEscaped && objectChar === '"') {
            objectInDoubleQuote = false
          }
          objectEscaped = !objectEscaped && objectChar === '\\'
          objectCursor += 1
          continue
        }

        if (objectInTemplateString) {
          if (!objectEscaped && objectChar === '`') {
            objectInTemplateString = false
          }
          objectEscaped = !objectEscaped && objectChar === '\\'
          objectCursor += 1
          continue
        }

        if (objectChar === '/' && objectNext === '*') {
          objectInBlockComment = true
          objectCursor += 2
          continue
        }

        if (objectChar === '/' && objectNext === '/') {
          objectCursor += 2
          while (objectCursor < block.length && block[objectCursor] !== '\n') {
            objectCursor += 1
          }
          continue
        }

        if (objectChar === "'") {
          objectInSingleQuote = true
          objectEscaped = false
          objectCursor += 1
          continue
        }

        if (objectChar === '"') {
          objectInDoubleQuote = true
          objectEscaped = false
          objectCursor += 1
          continue
        }

        if (objectChar === '`') {
          objectInTemplateString = true
          objectEscaped = false
          objectCursor += 1
          continue
        }

        if (objectChar === '{') {
          objectDepth += 1
        }
        else if (objectChar === '}') {
          objectDepth -= 1
          if (objectDepth === 0) {
            return block.slice(objectStart + 1, objectCursor)
          }
        }

        objectCursor += 1
      }

      return undefined
    }

    cursor += 1
  }

  return undefined
}

function updateScanStateWithLine(line: string, state: ScanState): void {
  let cursor = 0

  while (cursor < line.length) {
    const char = line[cursor]
    const next = line[cursor + 1]

    if (state.inBlockComment) {
      if (char === '*' && next === '/') {
        state.inBlockComment = false
        cursor += 2
        continue
      }
      cursor += 1
      continue
    }

    if (state.inSingleQuote) {
      if (!state.escaped && char === "'") {
        state.inSingleQuote = false
      }
      state.escaped = !state.escaped && char === '\\'
      cursor += 1
      continue
    }

    if (state.inDoubleQuote) {
      if (!state.escaped && char === '"') {
        state.inDoubleQuote = false
      }
      state.escaped = !state.escaped && char === '\\'
      cursor += 1
      continue
    }

    if (state.inTemplateString) {
      if (!state.escaped && char === '`') {
        state.inTemplateString = false
      }
      state.escaped = !state.escaped && char === '\\'
      cursor += 1
      continue
    }

    if (char === '/' && next === '/') {
      break
    }

    if (char === '/' && next === '*') {
      state.inBlockComment = true
      cursor += 2
      continue
    }

    if (char === "'") {
      state.inSingleQuote = true
      state.escaped = false
      cursor += 1
      continue
    }

    if (char === '"') {
      state.inDoubleQuote = true
      state.escaped = false
      cursor += 1
      continue
    }

    if (char === '`') {
      state.inTemplateString = true
      state.escaped = false
      cursor += 1
      continue
    }

    if (char === '{') {
      state.braceDepth += 1
      cursor += 1
      continue
    }

    if (char === '}') {
      state.braceDepth -= 1
      cursor += 1
      continue
    }

    if (char === '(') {
      state.parenDepth += 1
      cursor += 1
      continue
    }

    if (char === ')') {
      state.parenDepth -= 1
      cursor += 1
      continue
    }

    if (char === '[') {
      state.bracketDepth += 1
      cursor += 1
      continue
    }

    if (char === ']') {
      state.bracketDepth -= 1
      cursor += 1
      continue
    }

    cursor += 1
  }
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}

function extractTopLevelColumns(block: string): string[] {
  const objectBody = extractColumnsObjectBody(block)
  if (!objectBody) {
    return []
  }

  const columns: string[] = []
  const lines = objectBody.split(/\r?\n/)
  const state = createInitialScanState()

  for (const line of lines) {
    if (isTopLevel(state)) {
      const matchedColumn = line.match(/^\s*([A-Za-z_$][\w$]*)\s*:/)
      if (matchedColumn) {
        columns.push(matchedColumn[1])
      }
    }
    updateScanStateWithLine(line, state)
  }

  return unique(columns)
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function singularizeWord(word: string): string {
  if (word.endsWith('ies') && word.length > 3) {
    return `${word.slice(0, -3)}y`
  }

  if (/(sses|shes|ches|xes|zes)$/.test(word) && word.length > 3) {
    return word.slice(0, -2)
  }

  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 1) {
    return word.slice(0, -1)
  }

  return word
}

function toDomainEntity(rawTableName: string): string {
  const normalized = rawTableName.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  const singularized = normalized
    .split('_')
    .filter(Boolean)
    .map(singularizeWord)
    .join('_')

  return singularized.replace(/_+/g, '.')
}

function hasAnyKeyword(normalizedColumns: string[], keywords: string[]): boolean {
  const normalizedKeywords = keywords.map(normalizeToken)
  return normalizedKeywords.some(keyword =>
    normalizedColumns.some(column => column === keyword || column.includes(keyword)))
}

function countMatchedKeywords(normalizedColumns: string[], keywords: string[]): number {
  const normalizedKeywords = keywords.map(normalizeToken)
  let matched = 0

  for (const keyword of normalizedKeywords) {
    if (normalizedColumns.some(column => column === keyword || column.includes(keyword))) {
      matched += 1
    }
  }

  return matched
}

function hasAllKeywords(normalizedColumns: string[], keywords: string[]): boolean {
  const normalizedKeywords = keywords.map(normalizeToken)
  return normalizedKeywords.every(keyword =>
    normalizedColumns.some(column => column === keyword || column.includes(keyword)))
}

function buildCandidates(tableName: string, columns: string[]): DomainCandidate[] {
  const entity = toDomainEntity(tableName)
  const normalizedColumns = columns.map(normalizeToken)
  const candidateMap = new Map<string, DomainCandidate>()

  const addCandidate = (domain: string, score: number, reason: string): void => {
    const current = candidateMap.get(domain)
    if (!current || score > current.score) {
      candidateMap.set(domain, { domain, reason, score })
    }
  }

  addCandidate(`${entity}.list`, 0.3, 'generic collection query')
  addCandidate(`${entity}.detail`, 0.3, 'generic detail query')

  const accountSignal = countMatchedKeywords(normalizedColumns, ACCOUNT_COLUMNS)
  if (accountSignal >= 2) {
    addCandidate(`${entity}.profile`, 0.93, 'detected account/profile-related columns')
  }

  const hasRouteSignal = hasAllKeywords(normalizedColumns, ['path', 'method'])
  const hasAccessSignal = hasAnyKeyword(normalizedColumns, ACCESS_COLUMNS)
  if (hasRouteSignal) {
    addCandidate(`${entity}.route`, 0.86, 'detected route-like columns')
  }
  if (hasAccessSignal) {
    addCandidate(`${entity}.access`, 0.84, 'detected access-control columns')
  }
  if (hasRouteSignal && hasAccessSignal) {
    addCandidate(`${entity}.policy`, 0.9, 'detected route + access-control combined signals')
  }

  if (hasAnyKeyword(normalizedColumns, STATUS_COLUMNS)) {
    addCandidate(`${entity}.status`, 0.78, 'detected status-like columns')
  }

  if (hasAnyKeyword(normalizedColumns, TIME_WINDOW_COLUMNS)) {
    addCandidate(`${entity}.timeline`, 0.72, 'detected time-window columns')
  }

  if (hasAnyKeyword(normalizedColumns, OWNERSHIP_COLUMNS)) {
    addCandidate(`${entity}.ownership`, 0.66, 'detected ownership-like columns')
  }

  if (hasAnyKeyword(normalizedColumns, ['token', 'session'])) {
    addCandidate(`${entity}.session`, 0.85, 'detected session/token columns')
  }

  if (hasAnyKeyword(normalizedColumns, ['total', 'amount', 'price', 'balance'])) {
    addCandidate(`${entity}.finance`, 0.75, 'detected finance-related columns')
  }

  return Array.from(candidateMap.values())
    .sort((left, right) => right.score - left.score || left.domain.localeCompare(right.domain))
}

function domainToConstantKey(domain: string): string {
  const normalized = domain
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()

  if (/^[0-9]/.test(normalized)) {
    return `D_${normalized}`
  }

  return normalized
}

function buildRecommendedConstants(tableSuggestions: TableSuggestion[]): Record<string, string> {
  const constants: Record<string, string> = {}
  const usedKeys = new Set<string>()

  for (const suggestion of tableSuggestions) {
    const topCandidate = suggestion.candidates[0]
    if (!topCandidate) {
      continue
    }

    const baseKey = domainToConstantKey(topCandidate.domain)
    let key = baseKey
    let index = 2
    while (usedKeys.has(key)) {
      key = `${baseKey}_${index}`
      index += 1
    }

    usedKeys.add(key)
    constants[key] = topCandidate.domain
  }

  return Object.fromEntries(
    Object.entries(constants).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
  )
}

function renderMarkdown(result: SuggestionResult, maxCandidates: number): string {
  const lines: string[] = []
  lines.push('# Suggested Realtime Domains')
  lines.push(`- Generated At: ${result.generatedAt}`)
  lines.push(`- Project: ${result.projectDir}`)
  lines.push('')

  lines.push('## Schema Files')
  for (const filePath of result.schemaFiles) {
    lines.push(`- ${relative(process.cwd(), filePath) || '.'}`)
  }
  lines.push('')

  lines.push('## Table Suggestions')
  for (const suggestion of result.tableSuggestions) {
    lines.push(`### ${suggestion.tableName} (${suggestion.varName})`)
    lines.push(`- File: ${relative(process.cwd(), suggestion.filePath) || '.'}`)
    lines.push(`- Columns: ${suggestion.columns.length > 0 ? suggestion.columns.join(', ') : '(none detected)'}`)
    lines.push('- Candidates:')
    for (const candidate of suggestion.candidates.slice(0, maxCandidates)) {
      lines.push(`  - ${candidate.domain} (score=${candidate.score.toFixed(2)}): ${candidate.reason}`)
    }
    lines.push('')
  }

  lines.push('## Constant Draft')
  lines.push('```ts')
  lines.push('export const REALTIME_DOMAINS = {')
  for (const [key, value] of Object.entries(result.recommendedConstants)) {
    lines.push(`  ${key}: '${value}',`)
  }
  lines.push('} as const')
  lines.push('```')

  return lines.join('\n')
}

function generateSuggestions(args: CliArgs): SuggestionResult {
  const schemaFiles = collectSchemaFiles(args.projectDir)
  if (schemaFiles.length === 0) {
    throw new Error(
      `No schema files found under ${args.projectDir}. Expected src/db/*/schemas/tables.ts or drizzle/schema.ts.`,
    )
  }

  const tableDefinitions = schemaFiles
    .flatMap(parseTablesFromFile)
    .sort((left, right) => left.tableName.localeCompare(right.tableName) || left.varName.localeCompare(right.varName))

  if (tableDefinitions.length === 0) {
    throw new Error(`No Drizzle table declarations found in ${schemaFiles.length} schema file(s).`)
  }

  const tableSuggestions: TableSuggestion[] = tableDefinitions.map(definition => ({
    candidates: buildCandidates(definition.tableName, definition.columns),
    columns: definition.columns,
    filePath: definition.filePath,
    tableName: definition.tableName,
    varName: definition.varName,
  }))

  return {
    generatedAt: new Date().toISOString(),
    projectDir: args.projectDir,
    recommendedConstants: buildRecommendedConstants(tableSuggestions),
    schemaFiles,
    tableSuggestions,
  }
}

function main(): void {
  try {
    const args = parseArgs(process.argv.slice(2))
    const result = generateSuggestions(args)
    const output
      = args.format === 'json'
        ? JSON.stringify(result, null, 2)
        : renderMarkdown(result, args.maxCandidates)

    if (args.writePath) {
      writeFileSync(args.writePath, `${output}\n`, 'utf8')
    }

    process.stdout.write(`${output}\n`)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`Error: ${message}\n`)
    process.exit(1)
  }
}

main()
