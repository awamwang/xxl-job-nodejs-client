import { createReadStream, existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { createLogger, format, transports } from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import type { LogRead } from './'
const { combine, timestamp, printf } = format

const xxlJobFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [XXL-JOB] ${level}: ${message}`
})

export function createXxlJobLogger(localName?: string) {
  const foundMap = new Map<number, string>()

  const logger = createLogger({
    format: combine(
      timestamp(),
      xxlJobFormat
    ),
    transports: [
      new transports.Console(),
    ]
  })

  // const filename = `logs/${localName}-${new Date().getMonth() + 1}-${new Date().getDate()}.log`
  const filename = `logs/${localName}-%DATE%.log`
  const logFileTransport = new DailyRotateFile({ filename, maxFiles: '10d', datePattern: 'YYYY-MM-DD', maxSize: '10m' })
  let newFilename = logFileTransport.filename
  logFileTransport.on('new', (newName) => {
    newFilename = newName
    logger.info(`Log file created, newName:${newFilename}`)
  })
  logFileTransport.on('rotate', (_oldName, newName) => {
    newFilename = newName
    logger.info(`Log file rotate, newName:${newFilename}`)
  })
  if (localName)
    // logger.add(new transports.File({ filename, maxsize: 1024 * 1024 * 10, maxFiles: 10 }))
    logger.add(logFileTransport)

  async function readFromLogId(logId: number, fromLineNum: number, logDateTim: number): LogRead {
    logger.debug(`readFromLogId, logId:${logId}, fromLineNum:${fromLineNum}, logDateTim:${logDateTim}`)
    return new Promise((resolve) => {
      if (foundMap.has(logId)) {
        resolve({ content: foundMap.get(logId)!, fromLineNum, lineNum: fromLineNum, findFlag: true, endFlag: true })
        return
      }

      // const logFile = `logs/${localName}-${new Date(logDateTim).getMonth() + 1}-${new Date(logDateTim).getDate()}.log`
      if (!existsSync(newFilename)) {
        logger.error(`Log file does not exist or has been cleaned, logId:${logId}, logFile:${newFilename}`)
        resolve({ findFlag: false, endFlag: true })
        return
      }

      const stream = createReadStream(newFilename)
      const rl = createInterface({ input: stream })
      let lineNum = 0
      let content = ''
      let findFlag = false
      let endFlag = false
      const start = new RegExp(`running: ${logId}`)
      const end = new RegExp(`finished: ${logId}`)

      rl.on('line', (line) => {
        if (lineNum > fromLineNum)
          // lineNum = fromLineNum
          lineNum--
        if (start.test(line))
          findFlag = true
        if (findFlag) {
          content += `${line}\n`
          lineNum++
        }
        if (end.test(line)) {
          endFlag = true
          rl.close()
        }
        if (lineNum > (fromLineNum + 20))
          rl.close()
      })

      rl.once('close', () => {
        if (!findFlag) { resolve({ findFlag, endFlag: true }) }
        else {
          if (endFlag)
            foundMap.set(logId, content)
          resolve({ content, fromLineNum, lineNum, findFlag, endFlag })
        }
      })
    })
  }

  return {
    logger,
    readFromLogId
  }
}

