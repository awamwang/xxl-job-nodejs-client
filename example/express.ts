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
    baseUrl: 'http://192.168.3.38:9999',
    accessToken: 'default_token',
    executorKey: 'executor-nodejs-express',
    scheduleCenterUrl: 'http://127.0.0.1:8080/xxl-job-admin',
    logStorage: 'local',
  })
  xxlJobExecutor.initialization()

  xxlJobExecutor.eventEmitter.on('jobKilled', (job: any) => {
    console.log('jobKilled', job)
  })
})
