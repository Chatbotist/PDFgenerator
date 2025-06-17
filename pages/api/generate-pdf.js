import { writeFileSync } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

// Хранилище для отслеживания файлов
const fileStorage = new Map()

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST')

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST method allowed' })
  }

  try {
    const { text } = req.body
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' })
    }

    // Создаем PDF
    const pdfDoc = await PDFDocument.create()
    
    // Регистрируем fontkit для поддержки Unicode
    pdfDoc.registerFontkit(fontkit)
    
    // Загружаем шрифт с поддержкой Unicode
    const fontBytes = await fetch(
      'https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/Japanese/NotoSansCJKjp-Regular.otf'
    ).then(res => res.arrayBuffer())
    
    const font = await pdfDoc.embedFont(fontBytes)

    const page = pdfDoc.addPage([600, 400])
    
    // Рисуем текст с поддержкой Unicode
    page.drawText(text, {
      x: 50,
      y: 350,
      size: 15,
      font,
      color: rgb(0, 0, 0),
    })

    const pdfBytes = await pdfDoc.save()

    // Генерируем имя файла
    const fileName = `${uuidv4()}.pdf`
    const filePath = join('/tmp', fileName)
    
    // Сохраняем файл
    writeFileSync(filePath, pdfBytes)

    // Запоминаем файл в хранилище
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 минут
    fileStorage.set(fileName, { path: filePath, expiresAt })

    // Очистка старых файлов
    cleanupFiles()

    const pdfUrl = `${process.env.VERCEL_URL || 'http://localhost:3000'}/api/temp-pdf/${fileName}`
    
    return res.status(200).json({ 
      pdfUrl,
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

// Функция очистки
function cleanupFiles() {
  const now = Date.now()
  for (const [name, { expiresAt, path }] of fileStorage) {
    if (expiresAt < now) {
      try {
        require('fs').unlinkSync(path)
      } catch (e) {}
      fileStorage.delete(name)
    }
  }
}
