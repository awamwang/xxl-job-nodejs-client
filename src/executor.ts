import type { Request, Response } from 'express'
import { Router } from 'express'
import { createTaskManager, request } from './'
import type { ICallBackOptions, IExecutorOptions, IObject, IRunRequest } from './'

/* eslint-disable @typescript-eslint/no-unused-vars */
export function createXxlJobExecutor<T extends IObject>(options: IExecutorOptions<T>) {
  let router: Router

  const {
    route = '/job',
    debug = false,
    appType = 'express',
    app,
    context,
    baseUrl,
    accessToken,
    exectorKey,
    jobHandlers,
    scheduleCenterUrl,
  } = options

  const { runTask, hasJob } = createTaskManager(context)

  async function applyMiddleware() {
    switch (appType.toLowerCase().trim()) {
      case 'express': {
        router = Router()
        app.use(initMiddleware())
        addRoutes()
      }
    }
  }

  function initMiddleware() {
    return async (req: Request, res: Response, next: Function) => {
      res.status(200)
      const token = req.headers['xxl-job-access-token']
      if (!!accessToken && accessToken !== token) {
        res.send({ code: 500, msg: 'Access token incorrect.' })
        return
      }
      if (!req?.body) {
        res.send({ code: 500, msg: 'Is app.use(express.json()) missing?' })
        return
      }
      await next()
    }
  }

  function addRoutes() {
    router.post(`${baseUrl}/beat`, async (_, res) => {
      res.status(200).send({ code: 200, msg: 'success' })
    })
    router.post(`${baseUrl}/idleBeat`, async (req, res) => {
      const { jobId = -1 } = req.body
      res.status(200).send(idleBeat(jobId))
    })
    router.post(`${baseUrl}/run`, async (req, res) => {
      res.status(200).send(await run(req.body))
    })
    router.post(`${baseUrl}/kill`, async (req, res) => {
      const { jobId = -1 } = req.body
      res.status(200).send(killJob(jobId))
    })
    // router.post(`${baseUrl}/log`, async (...contexts) => {
    //   const { req, res } = wrappedHandler(contexts)
    //   const { logDateTim: logDateTime, logId, fromLineNum } = propOr({}, 'body', req)
    //   const data = awaitreadLog(logDateTime, logId, fromLineNum)
    //   res.send(data)
    // })
  }

  async function run(runRequest: IRunRequest) {
    const { executorHandler } = runRequest
    const jobHandler = jobHandlers.get(executorHandler)
    if (!jobHandler)
      return { code: 500, msg: `No matched jobHandler: ${executorHandler}` }

    return await runTask(jobHandler, runRequest, callBack)
  }

  function idleBeat(jobId: number) {
    return hasJob(jobId) ? { code: 500, msg: 'busy' } : { code: 200, msg: 'idle' }
  }

  function killJob(jobId: any): any {
    return { code: 500, msg: `Not yet support, jobId: ${jobId}` }
  }

  // TODO: Event Control
  async function callBack<U = any>(options: ICallBackOptions<U>) {
    const { error, result, logId } = options
    const url = `${scheduleCenterUrl}/api/callback`
    const headers = { 'xxl-job-access-token': accessToken }

    const handleCode = error ? 500 : 200
    const handleMsg = error ? error.message || error.toString() : (result ? JSON.stringify(result) : 'success')
    const data = [{ logId, logDateTim: Date.now(), handleCode, handleMsg }]
    await request.post(url, { headers, data })
  }

  return {
    applyMiddleware
  }
}
