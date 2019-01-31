import Plugin from "../plugins/Plugin";
import {Blockchains} from "../models/Blockchains";
import * as PluginTypes from "../plugins/PluginTypes";
import SocketService from "../services/SocketService";
import IframeService from "../services/IframeService";
import {EVENTS, WALLET_METHODS} from "../index";

let apiService = null;
// check the current page is in iframe or not
if (window.self == window.top) {
  // not in iframe
  apiService = SocketService;
} else {
  apiService = IframeService;
}

export default class Desktop extends Plugin {
  constructor(context, holderFns) {
    super(Blockchains.EOS, PluginTypes.WALLET_SUPPORT);
    this.name = 'ScatterSockets';
    this.context = context;
    this.holderFns = holderFns;
  }

  connect(pluginName, options = {}) {
    return new Promise(resolve => {
      if (!pluginName || !pluginName.length) throw new Error("You must specify a name for this connection");
      options = Object.assign({initTimeout: 10000, linkTimeout: 30000}, options);


      // Tries to set up Desktop Connection
      apiService.init(pluginName, options.linkTimeout);
      apiService.link().then(async authenticated => {
        if (!authenticated) return false;
        this.holderFns.get().isExtension = false;
        return resolve(true);
      });
    })
  }

  async runAfterInterfacing() {
    this.holderFns.get().addEventHandler((t, x) => this.eventHandler(t, x), 'internal');
    this.holderFns.get().identity = await this.holderFns.get().getIdentityFromPermissions();
    return true;
  }

  methods() {
    const setAndReturnId = (id, forget) => {
      if (id || forget) this.holderFns.get().identity = id;
      // if(forget) apiService.removeAppKeys();
      return forget || id;
    };

    return {
      [WALLET_METHODS.disconnect]: () => apiService.disconnect(),
      [WALLET_METHODS.isConnected]: () => apiService.isConnected(),
      [WALLET_METHODS.isPaired]: () => apiService.isPaired(),
      [WALLET_METHODS.addEventHandler]: (handler, key = null) => apiService.addEventHandler(handler, key),
      [WALLET_METHODS.removeEventHandler]: (key = null) => apiService.removeEventHandler(key),
      [WALLET_METHODS.listen]: (handler) => apiService.addEventHandler(handler),
      [WALLET_METHODS.getVersion]: () => apiService.sendApiRequest({type: 'getVersion', payload: {}}),
      [WALLET_METHODS.getIdentity]: (requiredFields) => apiService.sendApiRequest({
        type: 'getOrRequestIdentity',
        payload: {fields: requiredFields ? requiredFields : {accounts: [this.holderFns.get().network]}}
      }).then(setAndReturnId),
      [WALLET_METHODS.getIdentityFromPermissions]: () => apiService.sendApiRequest({
        type: 'identityFromPermissions',
        payload: {}
      }).then(setAndReturnId),
      [WALLET_METHODS.forgetIdentity]: () => apiService.sendApiRequest({
        type: 'forgetIdentity',
        payload: {}
      }).then(res => setAndReturnId(null, res)),
      [WALLET_METHODS.updateIdentity]: ({name, kyc}) => apiService.sendApiRequest({
        type: 'updateIdentity',
        payload: {name, kyc}
      }).then(id => id ? setAndReturnId(id) : null),
      [WALLET_METHODS.authenticate]: (nonce, data = null, publicKey = null) => apiService.sendApiRequest({
        type: 'authenticate',
        payload: {nonce, data, publicKey}
      }),
      [WALLET_METHODS.getArbitrarySignature]: (publicKey, data) => apiService.sendApiRequest({
        type: 'requestArbitrarySignature',
        payload: {publicKey, data}
      }),
      [WALLET_METHODS.getPublicKey]: (blockchain) => apiService.sendApiRequest({
        type: 'getPublicKey',
        payload: {blockchain}
      }),
      [WALLET_METHODS.linkAccount]: (account, network) => apiService.sendApiRequest({
        type: 'linkAccount',
        payload: {account, network: network || this.holderFns.get().network}
      }),
      [WALLET_METHODS.hasAccountFor]: (network) => apiService.sendApiRequest({
        type: 'hasAccountFor',
        payload: {network: network || this.holderFns.get().network}
      }),
      [WALLET_METHODS.suggestNetwork]: (network) => apiService.sendApiRequest({
        type: 'requestAddNetwork',
        payload: {network: network || this.holderFns.get().network}
      }),
      [WALLET_METHODS.requestTransfer]: (network, to, amount, options = {}) => apiService.sendApiRequest({
        type: 'requestTransfer',
        payload: {network: network || this.holderFns.get().network, to, amount, options}
      }),
      [WALLET_METHODS.requestSignature]: (payload) => apiService.sendApiRequest({
        type: 'requestSignature',
        payload
      }),
      [WALLET_METHODS.createTransaction]: (blockchain, actions, account, network) => apiService.sendApiRequest({
        type: 'createTransaction',
        payload: {blockchain, actions, account, network: network || this.holderFns.get().network}
      }),
      [WALLET_METHODS.addToken]: (token, network) => apiService.sendApiRequest({
        type: 'addToken',
        payload: {token, network: network || this.holderFns.get().network}
      }),
    }
  }

  async eventHandler(event, payload) {
    switch (event) {
      case EVENTS.Disconnected:
        this.holderFns.get().identity = null;
        break;
      case EVENTS.LoggedOut:
        this.holderFns.get().identity = await this.holderFns.get().getIdentityFromPermissions();
        break;
    }
  }
}
