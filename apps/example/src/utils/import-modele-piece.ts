export type ModeleSourceType = 'pdf' | 'image'

export interface ImportModeleResult {
  sourceType: ModeleSourceType
  fileName: string
  html: string
  plainText: string
  previewDataUrl?: string
}

const ACCEPT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]

const ACCEPT_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif']

export function isAcceptedModeleFile(file: File): boolean {
  if (ACCEPT_TYPES.includes(file.type)) return true
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ACCEPT_EXT.includes(ext)
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'))
    reader.readAsDataURL(file)
  })
}

export function plainTextToHtml(text: string): string {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .trim()

  if (!normalized) return '<p><em>(Aucun texte extrait — complétez manuellement ou utilisez l’aperçu image.)</em></p>'

  const blocks = normalized.split(/\n{2,}/)
  return blocks
    .map((block) => {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length === 0) return ''
      if (lines.length === 1 && lines[0].length < 80 && /^[A-ZÉÈÊÀÂÙÛÎÔÄÖÜÇ\s\d\-–—:]+$/u.test(lines[0])) {
        return `<h2>${escapeHtml(lines[0])}</h2>`
      }
      return `<p>${lines.map(l => escapeHtml(l)).join('<br>')}</p>`
    })
    .filter(Boolean)
    .join('\n')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildImageModeleHtml(dataUrl: string, ocrHtml: string): string {
  return `<p><em>Modèle importé (image) — texte reconnu ci-dessous. Ajustez avant enregistrement.</em></p>
<p><img src="${dataUrl}" alt="Modèle" style="max-width:100%;height:auto;border:1px solid #ccc;margin:1em 0" /></p>
<hr>
${ocrHtml}`
}

export async function extractTextFromPdf(file: File, onProgress?: (pct: number) => void): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data }).promise
  const parts: string[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    onProgress?.(Math.round((pageNum / pdf.numPages) * 100))
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    parts.push(pageText.trim())
  }

  return parts.filter(Boolean).join('\n\n')
}

export async function extractTextFromImage(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('fra', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(Math.round(m.progress * 100))
      }
    },
  })
  try {
    const { data } = await worker.recognize(file)
    return data.text?.trim() ?? ''
  } finally {
    await worker.terminate()
  }
}

export async function importModeleFromFile(
  file: File,
  onProgress?: (message: string, pct: number) => void,
): Promise<ImportModeleResult> {
  if (!isAcceptedModeleFile(file)) {
    throw new Error('Format accepté : PDF ou image (JPG, PNG, WEBP).')
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const isPdf = file.type === 'application/pdf' || ext === 'pdf'

  if (isPdf) {
    onProgress?.('Lecture du PDF…', 10)
    const plainText = await extractTextFromPdf(file, (pct) => {
      onProgress?.(`Extraction page…`, pct)
    })
    const html = plainTextToHtml(plainText)
    return {
      sourceType: 'pdf',
      fileName: file.name,
      html,
      plainText,
    }
  }

  onProgress?.('Chargement de l’image…', 5)
  const previewDataUrl = await readFileAsDataUrl(file)
  onProgress?.('Reconnaissance du texte (OCR)…', 20)
  const plainText = await extractTextFromImage(file, (pct) => {
    onProgress?.('OCR en cours…', pct)
  })
  const ocrHtml = plainTextToHtml(plainText)
  const html = buildImageModeleHtml(previewDataUrl, ocrHtml)

  return {
    sourceType: 'image',
    fileName: file.name,
    html,
    plainText,
    previewDataUrl,
  }
}

export function mergeDossierIntoHtml(
  html: string,
  ctx: { motif: string, client: string, partie: string, juridiction: string },
): string {
  const date = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  return html
    .replace(/\{\{client\}\}/gi, escapeHtml(ctx.client || '…'))
    .replace(/\{\{dossier\}\}/gi, escapeHtml(ctx.motif || '…'))
    .replace(/\{\{motif\}\}/gi, escapeHtml(ctx.motif || '…'))
    .replace(/\{\{partie\}\}/gi, escapeHtml(ctx.partie || '…'))
    .replace(/\{\{partie_en_cause\}\}/gi, escapeHtml(ctx.partie || '…'))
    .replace(/\{\{juridiction\}\}/gi, escapeHtml(ctx.juridiction || '…'))
    .replace(/\{\{date\}\}/gi, escapeHtml(date))
}
