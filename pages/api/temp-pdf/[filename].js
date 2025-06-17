import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

import { fileStorage, cleanupFiles } from '../generate-pdf'

export default function handler(req, res) {
  // Очищаем старые файлы перед каждым запросом
  cleanupFiles()

  const { filename } = req.query
  
  // Проверяем наличие в хранилище
  const fileData = fileStorage[filename]
  
  if (!fileData) {
    return res.status(404).json({ error: 'File not found or expired' })
  }

  try {
    // Двойная проверка существования файла
    if (!existsSync(fileData.path)) {
      delete fileStorage[filename]
      return res.status(404).json({ error: 'File was deleted' })
    }

    const file = readFileSync(fileData.path)
    
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
    return res.send(file)

  } catch (e) {
    console.error('File serving error:', e)
    delete fileStorage[filename]
    return res.status(500).json({ error: 'Failed to serve file' })
  }
}
