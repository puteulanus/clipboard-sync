import express from 'express'
import expressWs from 'express-ws'

const port = process.env.PORT || 5000
const app = express()
const appWs = expressWs(app)

app.use('/', express.static('build'))

const apiRouter = express.Router();

apiRouter.ws('/hello', (ws, req) => {
    ws.on('message', msg => ws.send(msg))
})

app.use('/api', apiRouter)

app.listen(port)
