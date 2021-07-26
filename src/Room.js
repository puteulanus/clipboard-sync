import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router";
import { Button, Message } from 'element-react';
import { v4 as uuidv4 } from 'uuid';

import encrypt from "./encrypt";
import { apiUrl, apiProtocol } from "./const";

function Room() {

  const encryption = useRef({});
  let [clipboardHistory, setClipboardHistory] = useState([]);

  let { privateKey, publicKey, shortPwd, encryptedPublicKey } = encryption.current;
  let { swsSessions } = encryption.current;

  const [ roomName, setRoomName ] = useState('');
  const [ pwdInput, setPwdInput ] = useState('');
  const [ refreshTime, setRefreshTime ] = useState(new Date());
  const [swsStatus, setSwsStatus ] = useState('open');

  const [ requirePwd, setRequirePwd ] = useState(false);

  const { roomId } = useParams();

  const refresh = () => {
    setRefreshTime(new Date());
  };

  const setShortPwd = (pwd) => {
    encryption.current.shortPwd = pwd;
  };

  const setEncryptedPublicKey = (data) => {
    encryption.current.encryptedPublicKey = data;
  };

  const setKeyPair = (privateKey, publicKey) => {
    encryption.current.privateKey = privateKey;
    encryption.current.publicKey = publicKey;
  };

  const setSwsSession = (swsSessions) => {
    encryption.current.swsSessions = swsSessions;
  };

  const handleSyncMsg = async (msg) => {
    console.log(msg);
    if (msg.type === 'clipboard_add_text') {
      setClipboardHistory(clipboardHistory => [...clipboardHistory, {
        id: uuidv4(),
        type: 'text',
        data: msg.data
      }]);
    }
  };

  const handleSendClipboard = async () => {
    if (swsStatus !== 'encrypt') return;
    const clipboard = navigator.clipboard;
    const cbText = await clipboard.readText();
    if (!cbText) return;
    swsSessions.send({
      type: 'clipboard_add_text',
      data: cbText
    });
    Message({
      message: '剪贴板发送成功',
      type: 'success',
      duration: 1000
    });
  };

  const handleCopyHistory = async (id) => {
    const clipboard = navigator.clipboard;
    await clipboard.writeText(clipboardHistory.filter(history => history.id === id)[0].data);
    Message({
      message: '剪贴板复制成功',
      type: 'success',
      duration: 1000
    });
  };

  const swsConnect = id => {

    const ws = new WebSocket(`ws${apiProtocol}://${apiUrl}/room/${id}`);


    let connectionRetry = true;

    ws.onmessage = originalMessage => {
      try {
        const msg = JSON.parse(originalMessage.data);
        // todo remove for debug
        console.log(msg);
        // init server
        if (msg.type === 'server_encrypt_init') {
          [privateKey, publicKey] = encrypt.generate();
          shortPwd = Math.floor(Math.random() * 899999 + 100000);
          setKeyPair(privateKey, publicKey);
          setShortPwd(shortPwd);
          setRoomName(msg.data.roomName);
        }
        // encrypt public key and send
        if (msg.type === 'server_pre_encrypt_req') {
          const box = encrypt.encryptPublicKey(publicKey, shortPwd);
          ws.send(JSON.stringify({
            type: 'server_pre_encrypt_reply',
            data: {
              id: msg.data.id,
              ...box
            }
          }));
        }
        // ask for short password and decrypt public key
        if (msg.type === 'client_pre_encrypt') {
          setRequirePwd(true);
          encryptedPublicKey = msg.data;
          setEncryptedPublicKey(encryptedPublicKey);
        }
        // decrypt long password
        if (msg.type === 'server_encrypt_handshake') {
          const longPwd = encrypt.decrypt(msg.data.data, privateKey, msg.data.nonce);
          if (!longPwd) {
            // todo send failed
          }
          ws.send(JSON.stringify({
            type: 'server_encrypt_switch',
            data: {
              id: msg.data.id,
            }
          }));
          // todo change local state ( for loop )
          encrypt.encryptWs(ws, longPwd, handleSyncMsg);
          setSwsStatus('encrypt');
        }
        if (msg.type === 'kick_off') {
          // todo check reason
          connectionRetry = false;
          ws.close();
        }
        if (msg.type === 'server_recovery') {
          if (shortPwd) {
            // server who has short password recovery
            ws.send(JSON.stringify({
              type: 'server_recovery_req'
            }))
          } else {
            // retry in 1s
            ws.close();
          }
        }
      } catch (e) {
        console.log(e);
      }
    };

    let keepAliveLoop;
    ws.onopen = () => {
      const send = ws.send.bind(ws);
      keepAliveLoop = setInterval(() => send('0'), 30000)
    };
    ws.onclose = () => {
      // stop keep alive loop
      clearInterval(keepAliveLoop);
      setSwsStatus('break');
      // re-generate key pair
      if (privateKey) {
        console.log('Encrypt session break, re-generate key');
        [privateKey, publicKey] = encrypt.generate();
        setKeyPair(privateKey, publicKey);
      }
      // retry
      setTimeout(() => {
        if (connectionRetry) {
          setSwsStatus('retrying');
          swsConnect(id);
        }
      }, 1000);
    };
    setSwsSession(ws);
  };

  function clientHandshake() {
    const publicKey = encrypt.decryptPublicKey(encryptedPublicKey.data, pwdInput, encryptedPublicKey.nonce);
    if (!publicKey) {
      console.log('wrong password');
      swsSessions.close();
    }
    const longPwd = encrypt.generateLongPwd();
    const encryptedLongPwd = encrypt.encrypt(longPwd, publicKey);
    swsSessions.send(JSON.stringify({
      type: 'client_encrypt_handshake',
      data: encryptedLongPwd
    }));
    setShortPwd(pwdInput);
    setRequirePwd(false);
    // todo change local state
    encrypt.encryptWs(swsSessions, longPwd, handleSyncMsg);
    setSwsStatus('encrypt');
  }

  useEffect(() => {

    swsConnect(roomId);

  }, []);

  return <div>
    Room: {roomName}
    {!requirePwd && <div>
      Password: {shortPwd}
    </div>}
    {requirePwd && <div>
      Password: <input type="password" value={pwdInput} onChange={event => setPwdInput(event.target.value)} />
      <Button onClick={clientHandshake}>submit</Button>
    </div>}
    <div>
      websocket status: {swsStatus}
    </div>
    <div>
      <Button onClick={handleSendClipboard} disabled={swsStatus !== 'encrypt'}>Send Clipboard</Button>
    </div>
    <div>
      {clipboardHistory.map(history => <div key={history.id}>
        <Button onClick={() => handleCopyHistory(history.id)}>{history.data.substring(0, 30)}</Button>
      </div>)}
    </div>
    <div style={{ display: 'none' }}>{refreshTime.toLocaleString()}</div>
  </div>
}

export default Room;
