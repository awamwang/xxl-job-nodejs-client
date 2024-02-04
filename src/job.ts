import type { Logger } from 'winston'
import type {
  CallBack,
  IObject,
  IRunRequest,
  JobHandler
} from './typings'

export interface JobObject {
  id: number
  callback: CallBack
  logId: number
  logger: Logger
  timeout: NodeJS.Timeout | null
}

export function createJobManager<T extends IObject>(context?: T) {
  // const runningJobList = new Set<number>()
  const runningJobMap = new Map<number, JobObject>()

  function hasJob(jobId: number) {
    return runningJobMap.has(jobId)
  }

  function getJob(jobId: number): JobObject | undefined {
    return runningJobMap.get(jobId)
  }

  async function runJob(logger: Logger, jobHandler: JobHandler<T>, request: IRunRequest, callback: CallBack) {
    let timeout: NodeJS.Timeout | null = null
    const { executorParams, jobId, executorTimeout, logId } = request
    logger.info(`Job Task: ${jobId} is running: ${logId}`)
    if (hasJob(jobId))
      return { code: 500, msg: 'There is already have a same job is running.' }

    if (executorTimeout) {
      timeout = setTimeout(() => {
        finishJob({ jobId, error: new Error(`Job Task: ${jobId} is Timeout.`) })
      }, executorTimeout * 1000)
    }

    runningJobMap.set(jobId, {
      id: jobId,
      callback,
      logId,
      logger,
      timeout
    })
    // 去掉 await，如果等待异步执行结束，那么这次调度会超时；
    jobHandler(logger, request, executorParams, context)
      .then(result => finishJob({ jobId, result }))
      .catch(error => finishJob({ jobId, error }))

    return { code: 200, msg: 'Success' }
  }

  async function finishJob<R = any>(options: {
    // logger: Logger
    jobId: number
    // logId: number
    func?: CallBack
    result?: R
    error?: Error
    // timeout: NodeJS.Timeout | null
  }) {
    const { error, result, func } = options
    const job = runningJobMap.get(options.jobId)
    if (!job)
      return

    const { id: jobId, logger, logId, callback, timeout } = job
    func && await func({ error, result, logId })
    timeout && clearTimeout(timeout)
    error && logger.error(error.message || error)
    logger.info(`Job Task: ${jobId} is finished: ${logId}`)
    await callback({ error, result, logId })
    runningJobMap.delete(jobId)
  }

  return {
    hasJob,
    getJob,
    runJob,
    finishJob
  }
}
