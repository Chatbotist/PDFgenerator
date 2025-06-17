import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

// Шрифт должен быть в public/fonts/NotoSans-Regular.ttf
const FONT_PATH = join(process.cwd(), 'public', 'fonts', 'NotoSans-Regular.ttf')

// Глобальное хранилище (вместо Map для persistence между запросами)
const fileStorage = {}

// Загружаем шрифт один раз при старте
let fontBytes
try {
  fontBytes = readFileSync(FONT_PATH)
} catch (e) {
  console.error('Font loading error:', e)
  throw new Error('Could not load font file')
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST')

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST method allowed' })
  }

  try {
    const { text } = req.body
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Valid text is required' })
    }

    // Создаем PDF
    const pdfDoc = await PDFDocument.create()
    pdfDoc.registerFontkit(fontkit)
    const font = await pdfDoc.embedFont(fontBytes)
    
    const page = pdfDoc.addPage([600, 400])
    page.drawText(text, {
      x: 50,
      y: 350,
      size: 15,
      font,
      color: rgb(0, 0, 0),
    })

    const pdfBytes = await pdfDoc.save()
    const fileName = `${uuidv4()}.pdf`
    const filePath = join('/tmp', fileName)

    // Сохраняем файл
    writeFileSync(filePath, pdfBytes)

    // Сохраняем в хранилище (с expiresAt timestamp)
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 минут
    fileStorage[fileName] = { path: filePath, expiresAt }

    // Формируем URL
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    
    return res.status(200).json({ 
      pdfUrl: `${baseUrl}/api/temp-pdf/${fileName}`,
      expiresAt: new Date(expiresAt).toISOString()
    })

  } catch (error) {
    console.error('PDF generation error:', error)
    return res.status(500).json({ 
      error: 'PDF generation failed',
      details: error.message 
    })
  }
}

// Функция очистки (вызывается вручную)
export function cleanupFiles() {
  const now = Date.now()
  Object.keys(fileStorage).forEach(fileName => {
    if (fileStorage[fileName].expiresAt < now) {
      try {
        unlinkSync(fileStorage[fileName].path)
      } catch (e) {}
      delete fileStorage[fileName]
    }
  })
}
