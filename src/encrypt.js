import nacl from 'tweetnacl';

function generate() {
  const { secretKey, publicKey } = nacl.box.keyPair();
  return [
    secretKey,
    publicKey
  ]
}

function encode(key) {
  return Buffer.from(key).toString('base64')
}

function decode(key) {
  return Buffer.from(key, 'base64')
}

function encrypt(data, publicKey) {
  const nonce = nacl.randomBytes(24);
  return {
    nonce: Buffer.from(nonce).toString('base64'),
    data: Buffer.from(nacl.box(Buffer.from(data), nonce, publicKey, Buffer.alloc(32))).toString('base64')
  }
}

function decrypt(data, privateKey, nonce) {
  return nacl.box.open(Buffer.from(data, 'base64'), Buffer.from(nonce, 'base64'), nacl.box.keyPair.fromSecretKey(Buffer.alloc(32)).publicKey, privateKey);
}

function encryptPublicKey(publicKey, password) {
  const pwd = nacl.hash(Buffer.from(password.toString())).slice(0, 32);
  const nonce = nacl.randomBytes(24);
  return {
    nonce: Buffer.from(nonce).toString('base64'),
    data: Buffer.from(nacl.secretbox(Buffer.from(publicKey), nonce, pwd)).toString('base64')
  }
}

function decryptPublicKey(data, password, nonce) {
  const pwd = nacl.hash(Buffer.from(password.toString())).slice(0, 32);
  return nacl.secretbox.open(Buffer.from(data, 'base64'), Buffer.from(nonce, 'base64'), pwd);
}

function generateLongPwd() {
  return nacl.randomBytes(32);
}

window.Buffer = Buffer;

function encryptWs(ws, password, onMessageFunc) {
  const pwd = nacl.hash(Buffer.from(password)).slice(0, 32);
  const send = ws.send.bind(ws);
  ws.send = (data) => {
    const nonce = nacl.randomBytes(24);
    const json = JSON.stringify(data);
    const msgBox = {
      nonce: Buffer.from(nonce).toString('base64'),
      data: Buffer.from(nacl.secretbox(Buffer.from(json), nonce, pwd)).toString('base64')
    };
    return send(JSON.stringify(msgBox));
  };
  ws.onmessage = (event) => {
    try {
      const msgBox = JSON.parse(event.data);
      const nonce = Buffer.from(msgBox.nonce, 'base64');
      const encryptedData = Buffer.from(msgBox.data, 'base64');
      const json = Buffer.from(nacl.secretbox.open(encryptedData, nonce, pwd));
      const msgObj = JSON.parse(json.toString());
      return onMessageFunc(msgObj);
    } catch (e) {
      return null;
    }
  }
}

export default {
  generate,
  encode,
  decode,
  encrypt,
  decrypt,
  encryptPublicKey,
  decryptPublicKey,
  generateLongPwd,
  encryptWs,
};
