import { writeFileSync, readFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

// Виртуальное хранилище файлов
const fileStorage = new Map()

// Загрузка шрифта (NotoSans-Regular.ttf должен быть в public/fonts/)
const fontPath = join(process.cwd(), 'public', 'fonts', 'NotoSans-Regular.ttf')
const fontBytes = readFileSync(fontPath)

// Функция очистки старых файлов
function cleanupFiles() {
  const now = Date.now()
  for (const [name, { expiresAt, path }] of fileStorage) {
    if (expiresAt < now) {
      try {
        unlinkSync(path)
      } catch (e) {
        console.error('Error deleting file:', e)
      }
      fileStorage.delete(name)
    }
  }
}

export default async function handler(req, res) {
  // Настройка CORS
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

    // Создаем PDF документ
    const pdfDoc = await PDFDocument.create()
    pdfDoc.registerFontkit(fontkit)
    
    // Встраиваем шрифт с поддержкой Unicode
    const font = await pdfDoc.embedFont(fontBytes)
    
    // Добавляем страницу
    const page = pdfDoc.addPage([600, 400])
    
    // Добавляем текст
    page.drawText(text, {
      x: 50,
      y: 350,
      size: 15,
      font,
      color: rgb(0, 0, 0),
      lineHeight: 20,
      maxWidth: 500,
    })

    // Сохраняем PDF
    const pdfBytes = await pdfDoc.save()

    // Генерируем уникальное имя файла
    const fileName = `${uuidv4()}.pdf`
    const filePath = join('/tmp', fileName)
    
    // Сохраняем файл на диск
    writeFileSync(filePath, pdfBytes)

    // Запоминаем файл в хранилище
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 минут
    fileStorage.set(fileName, { path: filePath, expiresAt })

    // Очищаем старые файлы
    cleanupFiles()

    // Формируем URL для доступа
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    
    const pdfUrl = `${baseUrl}/api/temp-pdf/${fileName}`
    
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

// Регулярная очистка каждую минуту
setInterval(cleanupFiles, 60 * 1000)
