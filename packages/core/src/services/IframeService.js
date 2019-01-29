import StorageService from './StorageService'
import getRandomValues from 'get-random-values';
import createHash from 'create-hash';

let iframe = window.parent;
let paired = false;

let plugin;
let openRequests = [];

let allowReconnects = true;


const sha256 = data => createHash('sha256').update(data).digest('hex');

const random = () => {
  const array = new Uint8Array(24);
  getRandomValues(array);
  return array.join('');
};

const getOrigin = () => {
  let origin;
  if (typeof location !== 'undefined')
    if (location.hasOwnProperty('hostname') && location.hostname.length && location.hostname !== 'localhost')
      origin = location.hostname;
    else origin = plugin;
  else origin = plugin;
  if (origin.substr(0, 4) === 'www.') origin = origin.replace('www.', '');
  return origin;
}

let appkey = StorageService.getAppKey();
if (!appkey) appkey = 'appkey:' + random();

const send = (type = null, data = null) => {
  if (type === null && data === null) iframe.postMessage({protocol: '40/scatter'}, '*');
  else iframe.postMessage({protocol: '42/scatter', type, data}, '*');
}

let pairingPromise = null;
const pair = (passthrough = false) => {
  return new Promise((resolve, reject) => {
    pairingPromise = {resolve, reject};
    send('pair', {data: {appkey, origin: getOrigin(), passthrough}, plugin})
  })
};

let eventHandlers = {};

export default class IframeService {

  static init(_plugin, timeout = 60000) {
    plugin = _plugin;
    this.timeout = timeout;
  }

  static getOrigin() {
    return getOrigin();
  }

  static addEventHandler(handler, key) {
    if (!key) key = 'app';
    eventHandlers[key] = handler;
  }

  static removeEventHandler(key) {
    if (!key) key = 'app';
    delete eventHandlers[key];
  }

  static isConnected() {
    return true;
  }

  static isPaired() {
    return paired;
  }

  static disconnect() {
    return true;
  }

  static removeAppKeys() {
    StorageService.removeAppKey();
    StorageService.removeNonce();
  }

  static sendApiRequest(request) {
    return new Promise((resolve, reject) => {
      if (request.type === 'identityFromPermissions' && !paired) return resolve(false);

      pair().then(() => {
        if (!paired) return reject({
          code: 'not_paired',
          message: 'The user did not allow this app to connect to their Scatter'
        });

        // Request ID used for resolving promises
        request.id = random();

        // Set Application Key
        request.appkey = appkey;

        // Nonce used to authenticate this request
        request.nonce = StorageService.getNonce() || 0;
        // Next nonce used to authenticate the next request
        const nextNonce = random();
        request.nextNonce = sha256(nextNonce);
        StorageService.setNonce(nextNonce);

        if (request.hasOwnProperty('payload') && !request.payload.hasOwnProperty('origin'))
          request.payload.origin = getOrigin();


        openRequests.push(Object.assign(request, {resolve, reject}));
        send('api', {data: request, plugin})
      })
    });
  }

}
