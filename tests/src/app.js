const pocketJS = require('../../dist');
const { HTTPMethod, Pocket, Configuration, HttpRpcProvider, PocketAAT }
  = pocketJS;
const dispatchers = [
  "http://127.0.0.1:8082",
];
const maxDispatchers = 5;
const maxSessions = 2000;
const consensusNodeCount = 3;
const requestTimeOut = 3600000;
const acceptDisputedResponses = true;
const sessionBlockFrequency = 25;
const blockTime = 900000;
const maxSessionRefreshRetries = 10;
const validateRelayResponses = false;
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
const blockchain = "0021";

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

async function doRelay(counter, aat) {
  // result = await pocketInstance.sendConsensusRelay(
  //   JSON.stringify(queries[i % 2]),
  //   blockchain,
  //   aat,
  //   undefined, //configuration
  //   {"Content-Type": "application/json", "Origin": "pocket-js"}
  // );

  const resp = await pocketInstance.rpc().query.getHeight();
  const height = resp.height % 4n == 1n ? resp.height - 1n : resp.height;
  const sess = await pocketInstance.sessionManager
    .requestNewSessionWithHeight(aat, blockchain, height,
    pocketInstance.configuration);
  const result = await pocketInstance.sendRelayWithSession(
    JSON.stringify(queries[0]),
    blockchain,
    aat,
    sess,
    {"Content-Type": "application/json", "Origin": "pocket-js"},
    HTTPMethod.POST,
    "");
  if (result.payload) {
    console.log(result.payload);
  } else if (result.relayResponse) {
    console.log(result.relayResponse);
  } else if (result.code) {
    console.log(`Error ${result.code}: ${result.message}`);
  } else {
    console.log(JSON.stringify(result));
  }

  setTimeout(() => doRelay(counter + 1, aat), 30000);
}

async function main(query) {
  const aat = await generateAAT(
    accounts[0].publicKey,
    accounts[0].publicKey,
    accounts[0].privateKey,
    accountPassphrase,
  );
  await doRelay(0, aat);
}

main().then(() => {
  console.log("done!");
});
