import express from 'express';
import expressWs from 'express-ws';
import { v4 as uuidv4 } from 'uuid';

const port = process.env.PORT || 5000;
const app = express();
const appWs = expressWs(app);

app.use('/', express.static('build'));

const roomList = {};
const clientIds = new WeakMap();

const apiRouter = express.Router();

const log = (...args) => {
    console.log(`[${(new Date().toLocaleString())}]`, ...args);
};

apiRouter.ws('/room/:roomId', (ws, req) => {
    try {
        const roomId = req.params.roomId;
        let room = roomList[roomId];
        let isServer = false;
        // create room if not exist
        if (!roomList[roomId]) {
            isServer = true;
            room = {
                id: roomId,
                name: `${~~(Math.random() * 10000)}`,
                status: 'open',
                server: ws,
                client: null,
                tmpClients: {}
            };
            roomList[roomId] = room;
            log(`Create room ${room.name} with id ${room.id}`);
            ws.send(JSON.stringify({
                type: 'server_encrypt_init',
                data: {
                    roomName: roomList[roomId].name
                }
            }));
        }
        // drop connect if room is full
        if (room.status === 'encrypt') {
            ws.send(JSON.stringify({
                type: 'kick_off',
                data: {
                    reason: 'room_fulled'
                }
            }));
            ws.close();
            return;
        }
        ws.on('close', () => {
            // server leave
            if (room.status === 'open' && isServer) {
                Object.values(room.tmpClients).forEach(client => {
                    try {
                        client.send(JSON.stringify({
                            type: 'kick_off',
                            data: {
                                reason: 'server_leave'
                            }
                        }));
                        client.close();
                    } catch (e) {}
                });
                log(`Delete room ${room.name} with id ${room.id}`);
                delete(roomList[roomId])
            }
            // tmp client leave
            if (room.status === 'open' && !isServer) {
                const clientId = clientIds.get(ws);
                delete(room.tmpClients[clientId]);
                log(`Client ${clientId} leave`);
            }
            if (room.status === 'encrypt') {
                isServer && room.client.close();
                !isServer && room.server.close();
                room.status = 'recovery';
                log(`Room ${room.name} enter recovery status`);
                room.deleteHandler = setTimeout(() => {
                    delete(roomList[roomId]);
                    log(`Delete room ${room.name} with id ${room.id}`);
                }, 10000)
            }
        });
        ws.on('message', message => {
            if (message.length === 1) return;
            const msg = JSON.parse(message);
            if (isServer && msg.type === 'server_pre_encrypt_reply') {
                const clientId = msg.data.id;
                const tmpClient = room.tmpClients[clientId];
                if (!tmpClient) return;
                delete(msg.data.id);
                tmpClient.send(JSON.stringify({
                    type: 'client_pre_encrypt',
                    data: msg.data
                }));
                log(`Send public key for client ${clientId}`)
            }
            if (msg.type === 'client_encrypt_handshake') {
                const clientId = clientIds.get(ws);
                if (!clientId) return;
                room.server.send(JSON.stringify({
                    type: 'server_encrypt_handshake',
                    data: {
                        id: clientId,
                        ...msg.data
                    }
                }));
                log(`Client ${clientId} enter encrypted`)
            }
            if (isServer && msg.type === 'server_encrypt_switch') {
                const tmpClient = room.tmpClients[msg.data.id];
                if (!tmpClient) return;
                delete(room.tmpClients[msg.data.id]);
                room.client = tmpClient;
                room.status = 'encrypt';
                Object.values(room.tmpClients).forEach(client => {
                    try {
                        client.send(JSON.stringify({
                            type: 'kick_off',
                            data: {
                                reason: 'room_fulled'
                            }
                        }));
                        client.close();
                    } catch (e) {}
                });
                // link two ws
                room.server.removeAllListeners('message');
                room.client.removeAllListeners('message');
                room.server.on('message', msg => msg.length > 1 && room.client.send(msg));
                room.client.on('message', msg => msg.length > 1 && room.server.send(msg));
                log(`Room ${room.name} enter encrypted`);
            }
            if (msg.type === 'server_recovery_req') {
                clearTimeout(room.deleteHandler);
                room.server = ws;
                isServer = true;
                room.status = 'open';
                delete(room.deleteHandler);
                log(`Room ${room.name} enter open from recovery`)
            }

        });
        if (room.status === 'open' && isServer) return;
        if (room.status === 'recovery') {
            ws.send(JSON.stringify({
                type: 'server_recovery'
            }));
            return;
        }
        // handshake
        const clientId = uuidv4();
        clientIds.set(ws, clientId);
        room.tmpClients[clientId] = ws;
        room.server.send(JSON.stringify({
            type: 'server_pre_encrypt_req',
            data: {
                id: clientId
            }
        }));
        log(`Client ${clientId} apply for handshake`)
    } catch (e) {
        console.error(e);
    }
});

apiRouter.get('/roomList', (req, res) => {
    res.json(Object.values(roomList).map(({ id, name }) => ({ id, name })));
});

app.use('/api', apiRouter);

app.listen(port);
