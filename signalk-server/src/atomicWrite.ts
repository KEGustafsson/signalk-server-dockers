import fs from 'fs'

function validateJson(data: string): void {
  try {
    JSON.parse(data)
  } catch (err) {
    console.error('JSON validation failed!')
    console.error('Error:', err instanceof Error ? err.message : String(err))
    console.error('Data received:', data)
    throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export function atomicWriteFileSync(filePath: string, data: string): void {
  validateJson(data)

  const tmp = filePath + '.tmp'
  try {
    fs.writeFileSync(tmp, data)
    fs.renameSync(tmp, filePath)
  } catch (err) {
    try {
      fs.unlinkSync(tmp)
    } catch {}
    throw err
  }
}

export async function atomicWriteFile(
  filePath: string,
  data: string
): Promise<void> {
  validateJson(data)

  const tmp = filePath + '.tmp'
  try {
    await fs.promises.writeFile(tmp, data)
    await fs.promises.rename(tmp, filePath)
  } catch (err) {
    try {
      await fs.promises.unlink(tmp)
    } catch {}
    throw err
  }
}
