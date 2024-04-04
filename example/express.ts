import express from 'express'
import type { JobHandler } from 'xxl-job-nodejs'
import { createXxlJobExecutor } from 'xxl-job-nodejs'

const jobHandlers = new Map<string, JobHandler>()
jobHandlers.set('nodejs_test', async (jobLogger, jobRequest, jobParams) => {
  jobLogger.warn(`jobId: ${jobRequest.jobId} request: ${JSON.stringify(jobRequest)}, params: ${jobParams}`)
  await new Promise(resolve => setTimeout(resolve, 20000))
  jobLogger.info(`jobId: ${jobRequest.jobId} execute finished`)
})

const app = express()
app.use(express.json())

app.listen(9999, () => {
  // eslint-disable-next-line no-console
  console.log('Server started on port 9999')

  const xxlJobExecutor = createXxlJobExecutor({
    app,
    jobHandlers,
    appType: 'express',
    baseUrl: 'http://172.24.137.85:19999',
    accessToken: '%TGB6yhn123',
    executorKey: 'xxl-job-PC1',
    scheduleCenterUrl: 'http://47.108.170.75:18080/xxl-job-admin',
    logStorage: 'local',
  })
  xxlJobExecutor.initialization()

  xxlJobExecutor.eventEmitter.on('jobKilled', (job: any) => {
    console.log('jobKilled', job)
  })
})
