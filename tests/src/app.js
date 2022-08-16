const pocketJS = require('../../dist');
const { HTTPMethod, Pocket, Configuration, HttpRpcProvider, PocketAAT }
  = pocketJS;
const dispatchers = [
  // "http://127.0.0.1:8082",
  "http://node1.skynet-local.tokikuch.com:8082",
  "http://node2.skynet-local.tokikuch.com:8082",
  "http://node3.skynet-local.tokikuch.com:8082",
  "http://node4.skynet-local.tokikuch.com:8082",
];
const maxDispatchers = 5;
const maxSessions = 2000;
const consensusNodeCount = 3;
const requestTimeOut = 3600000;
const acceptDisputedResponses = true;
const sessionBlockFrequency = 25;
const blockTime = 900000;
const maxSessionRefreshRetries = 10;
const validateRelayResponses = true;
const rejectSelfSignedCertificates = false;
const useLegacyTxCodec = false;

const rpcProvider = new HttpRpcProvider(dispatchers[0]);
const configuration = new Configuration(
  maxDispatchers,
  maxSessions,
  consensusNodeCount,
  requestTimeOut,
  acceptDisputedResponses,
  sessionBlockFrequency,
  blockTime,
  maxSessionRefreshRetries,
  validateRelayResponses,
  rejectSelfSignedCertificates,
  useLegacyTxCodec)

const pocketInstance = new Pocket(dispatchers, rpcProvider, configuration);
const blockchains = ["0040"];

async function generateAATFromPPK(accountPPK, password, passphrase) {
  const account = await pocketInstance.keybase.importPPKFromJSON(
      password,
      JSON.stringify(accountPPK),
      passphrase
  )
  await pocketInstance.keybase.unlockAccount(
      account.addressHex,
      passphrase,
      0
  );

  const priv = await pocketInstance.keybase.exportAccount(
    account.addressHex, passphrase);

  const aat = await PocketAAT.from(
    "0.0.1",
    account.publicKey.toString('hex'),
    account.publicKey.toString('hex'),
    priv.toString('hex')
  );
  return aat;
}

async function generateAAT(clientPubkey,
                           applicationPubkey,
                           privateKey,
                           passphrase) {
  const account = await pocketInstance.keybase.importAccount(
    Buffer.from(privateKey, "hex"),
    passphrase
  );
  await pocketInstance.keybase.unlockAccount(
    account.addressHex,
    passphrase,
    0
  );

  const aat = await PocketAAT.from(
    "0.0.1",
    clientPubkey,
    applicationPubkey,
    privateKey
  );
  console.log(JSON.stringify(aat));
  return aat
}

const accounts = [
  {
    address: "8109e2d88ee0a6c9ec759c8610a8b435cb9920a0",
    publicKey: "6647a9309bba52f9cbb69fbf1735da2f2a9931023eca30d10a52f9f9ba51b31d",
    privateKey: "644fde1a1d91e9196daa5dd897f4eb82093e2682515735922505fc875f3be3b36647a9309bba52f9cbb69fbf1735da2f2a9931023eca30d10a52f9f9ba51b31d"
  },
  {
    address: "81b30852a4f7ade57f387dd1e1494c9ff1e69ee3",
    publicKey: "f664ee63accf5206534e7c11dfa95993e50e72e17eb71f40f517a49667214fdf",
    privateKey: "3b78eed50e692dc5843800fe9d929de06330ef2bf394f935ba6f5c7dc4e27497f664ee63accf5206534e7c11dfa95993e50e72e17eb71f40f517a49667214fdf"
  },
  // {
  //   address: "81b3c116cc1c9206d3ead1c99200e3405cf86c61",
  //   publicKey: "49e1c23e211b9e3e2a4be5b61e772a6ce12b42ec8132fff1138709defe08e23e",
  //   privateKey: "705e55aaad30a323edef4c6453707dc70c2514a2af9f3b53d5da0baabd0ccb5b49e1c23e211b9e3e2a4be5b61e772a6ce12b42ec8132fff1138709defe08e23e"
  // },
]

const queries = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_chainId",
  },
  {
    jsonrpc: "2.0",
    id: 1,
    method: "net_version",
    params: [],
  },
  {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_getBalance",
    params: ["0x92d6FCf3F7f2EC764789671226ce380E71A4e70d", "latest"],
  }
];

const accountPassphrase = "hogehoge";

async function doRelay(AATs, index) {
  // result = await pocketInstance.sendConsensusRelay(
  //   JSON.stringify(queries[i % 2]),
  //   blockchain,
  //   aat,
  //   undefined, //configuration
  //   {"Content-Type": "application/json", "Origin": "pocket-js"}
  // );
  const resp = await pocketInstance.rpc().query.getHeight();
  let height = resp.height;
  if (height % 4n == 1n) {
    // late comer
    // --height;
  }

  const r1 = Math.floor(Math.random() * AATs.length)
  const aat = AATs[0];

  const blockchain = blockchains[index % blockchains.length];
  const sess = await pocketInstance.sessionManager
    .requestNewSessionWithHeight(aat, blockchain, height,
      pocketInstance.configuration);

  if (!sess.sessionNodes || !sess.sessionNodes.filter) {
    // setTimeout(() => doRelay(AATs), 1000);
    console.log(sess.message);
    return 0;
  }

  const nodes = sess.sessionNodes.filter(
    x => x.address.startsWith('5'));
  const r2 = Math.floor(Math.random() * nodes.length)
  const node = nodes[r2];
  const result = await pocketInstance.sendRelayWithSession(
    JSON.stringify(queries[2]),
    blockchain,
    aat,
    sess,
    node,
    {"Content-Type": "application/json", "Origin": "pocket-js"},
    HTTPMethod.POST,
    "");
  let ok = false;
  if (result.payload) {
    ok = result.payload.indexOf("jsonrpc") != -1;
  } else if (result.relayResponse) {
    console.log(result.relayResponse);
  } else if (result.code) {
    console.log(`Error ${result.code}: ${result.message}`);
  } else {
    console.log(JSON.stringify(result));
  }

  // setTimeout(() => doRelay(AATs, index + 1), 10);
  return ok ? 1 : 0
}

async function main(query) {
  const promises = accounts.map(acc => generateAAT(
    acc.publicKey,
    acc.publicKey,
    acc.privateKey,
    accountPassphrase,
  ));
  const AATs = await Promise.all(promises);

  let count = 0;
  for (let i = 0; i < 100; ++i) {
    count += await doRelay(AATs, 0);
  }
  console.log("Done - " + count)
}

main().then(() => {
  console.log("done!");
});
