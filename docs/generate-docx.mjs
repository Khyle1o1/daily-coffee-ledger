/**
 * One-off script: converts DOT-BREW-HUB-Admin-Training-Guide.md to .docx
 * Usage: node docs/generate-docx.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  TableOfContents,
  PageBreak,
  ShadingType,
} from 'docx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mdPath = path.join(__dirname, 'DOT-BREW-HUB-Admin-Training-Guide.md')
const outPath = path.join(__dirname, 'DOT-BREW-HUB-Admin-Training-Guide.docx')

const md = fs.readFileSync(mdPath, 'utf8')
const lines = md.split(/\r?\n/)

function parseInline(text) {
  const runs = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\])/g
  let last = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      runs.push(new TextRun({ text: text.slice(last, m.index) }))
    }
    const token = m[0]
    if (token.startsWith('**')) {
      runs.push(new TextRun({ text: token.slice(2, -2), bold: true }))
    } else if (token.startsWith('`')) {
      runs.push(new TextRun({ text: token.slice(1, -1), font: 'Consolas', size: 20 }))
    } else if (token.startsWith('[Insert screenshot:')) {
      runs.push(
        new TextRun({
          text: token,
          italics: true,
          color: '666666',
          shading: { type: ShadingType.CLEAR, fill: 'FFF3CD' },
        }),
      )
    } else if (token.startsWith('[INSERT')) {
      runs.push(
        new TextRun({
          text: token,
          bold: true,
          color: 'CC0000',
        }),
      )
    } else {
      runs.push(new TextRun({ text: token }))
    }
    last = m.index + token.length
  }
  if (last < text.length) {
    runs.push(new TextRun({ text: text.slice(last) }))
  }
  if (runs.length === 0) {
    runs.push(new TextRun({ text: text || '' }))
  }
  return runs
}

function isTableRow(line) {
  return line.trim().startsWith('|') && line.trim().endsWith('|')
}

function parseTable(startIdx) {
  const rows = []
  let i = startIdx
  while (i < lines.length && isTableRow(lines[i])) {
    const cells = lines[i]
      .trim()
      .slice(1, -1)
      .split('|')
      .map((c) => c.trim())
    // skip separator row |---|---|
    if (!cells.every((c) => /^[-:]+$/.test(c))) {
      rows.push(cells)
    }
    i++
  }
  return { rows, endIdx: i }
}

function makeTable(rows) {
  if (rows.length === 0) return null
  const colCount = Math.max(...rows.map((r) => r.length))
  const tableRows = rows.map((row, ri) => {
    const cells = []
    for (let c = 0; c < colCount; c++) {
      const text = row[c] ?? ''
      cells.push(
        new TableCell({
          children: [
            new Paragraph({
              children: parseInline(text),
              spacing: { before: 60, after: 60 },
            }),
          ],
          shading: ri === 0 ? { fill: 'E8EEF7', type: ShadingType.CLEAR } : undefined,
        }),
      )
    }
    return new TableRow({ children: cells })
  })
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    },
    rows: tableRows,
  })
}

const children = []

// Title page
children.push(
  new Paragraph({ spacing: { before: 2400 } }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'DOT-BREW-HUB', bold: true, size: 56, color: '1F63E9' })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: 'Admin Training Guide', bold: true, size: 40 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: 'For DOT COFFEE Operations Staff', size: 24, italics: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Version: July 2026', size: 22 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Shopify store: dot-10056', size: 22 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: 'Portal: https://franchise.dotcoffee.ph', size: 22 })],
  }),
  new Paragraph({ children: [new PageBreak()] }),
)

// TOC
children.push(
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: 'Table of Contents' })],
  }),
  new TableOfContents('Table of Contents', {
    hyperlink: true,
    headingStyleRange: '1-3',
  }),
  new Paragraph({ children: [new PageBreak()] }),
)

let i = 0
let skipUntil = 0

while (i < lines.length) {
  if (i < skipUntil) {
    i++
    continue
  }

  const line = lines[i]
  const trimmed = line.trim()

  // Skip duplicate title block and manual TOC from md (we built title + TOC above)
  if (i < 30 && (trimmed.startsWith('# DOT-BREW-HUB') || trimmed === '## Table of Contents')) {
    if (trimmed === '## Table of Contents') {
      i++
      while (i < lines.length && /^\d+\./.test(lines[i].trim())) i++
      continue
    }
    i++
    continue
  }

  if (trimmed === '---') {
    i++
    continue
  }

  if (trimmed === '') {
    i++
    continue
  }

  // Code block
  if (trimmed.startsWith('```')) {
    i++
    const codeLines = []
    while (i < lines.length && !lines[i].trim().startsWith('```')) {
      codeLines.push(lines[i])
      i++
    }
    i++ // closing ```
    children.push(
      new Paragraph({
        spacing: { before: 120, after: 120 },
        shading: { type: ShadingType.CLEAR, fill: 'F5F5F5' },
        children: [
          new TextRun({
            text: codeLines.join('\n'),
            font: 'Consolas',
            size: 18,
          }),
        ],
      }),
    )
    continue
  }

  // Headings
  if (trimmed.startsWith('#### ')) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_4,
        children: parseInline(trimmed.slice(5)),
        spacing: { before: 200, after: 100 },
      }),
    )
    i++
    continue
  }
  if (trimmed.startsWith('### ')) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: parseInline(trimmed.slice(4)),
        spacing: { before: 240, after: 120 },
      }),
    )
    i++
    continue
  }
  if (trimmed.startsWith('## ')) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: parseInline(trimmed.slice(3)),
        spacing: { before: 320, after: 160 },
      }),
    )
    i++
    continue
  }
  if (trimmed.startsWith('# ')) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: parseInline(trimmed.slice(2)),
        spacing: { before: 400, after: 200 },
      }),
    )
    i++
    continue
  }

  // Table
  if (isTableRow(trimmed)) {
    const { rows, endIdx } = parseTable(i)
    const table = makeTable(rows)
    if (table) {
      children.push(table)
      children.push(new Paragraph({ spacing: { after: 120 } }))
    }
    i = endIdx
    continue
  }

  // Bullet list
  if (trimmed.startsWith('- ')) {
    children.push(
      new Paragraph({
        bullet: { level: 0 },
        children: parseInline(trimmed.slice(2)),
        spacing: { after: 60 },
      }),
    )
    i++
    continue
  }

  // Numbered list
  const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/)
  if (numMatch) {
    children.push(
      new Paragraph({
        numbering: { reference: 'default-numbering', level: 0 },
        children: parseInline(numMatch[2]),
        spacing: { after: 60 },
      }),
    )
    i++
    continue
  }

  // Italic-only line (e.g. End of guide)
  if (trimmed.startsWith('*') && trimmed.endsWith('*') && !trimmed.startsWith('**')) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: trimmed.slice(1, -1), italics: true })],
        spacing: { before: 400 },
      }),
    )
    i++
    continue
  }

  // Regular paragraph
  children.push(
    new Paragraph({
      children: parseInline(trimmed),
      spacing: { after: 120 },
    }),
  )
  i++
}

const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'default-numbering',
        levels: [
          {
            level: 0,
            format: 'decimal',
            text: '%1.',
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {},
      children,
    },
  ],
})

const buffer = await Packer.toBuffer(doc)
fs.writeFileSync(outPath, buffer)
console.log(`Written: ${outPath}`)
