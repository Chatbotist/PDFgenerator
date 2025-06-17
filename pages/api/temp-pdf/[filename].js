import { readFileSync } from 'fs'
import { join } from 'path'

// Импортируем хранилище из generate-pdf
const { fileStorage } = require('../generate-pdf')

export default function handler(req, res) {
  const { filename } = req.query
  
  // Проверяем наличие файла в хранилище
  const fileData = fileStorage.get(filename)
  
  if (!fileData) {
    return res.status(404).json({ error: 'File not found or expired' })
  }

  try {
    // Проверяем существование файла на диске
    const file = readFileSync(fileData.path)
    
    // Устанавливаем заголовки
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
    
    return res.send(file)

  } catch (e) {
    // Удаляем файл из хранилища при ошибке
    fileStorage.delete(filename)
    return res.status(410).json({ error: 'File access error' })
  }
}
