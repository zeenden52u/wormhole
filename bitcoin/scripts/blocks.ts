const fs = require("fs");
const WebSocket = require("ws");

// kubectl exec -it btc-0 -c btc-node -- cat /root/.btcd/rpc.cert > rpc.cert

//scripts/btcctl --simnet --wallet --rpcuser=wormhole --rpcpass=w0rmh013 sendfrom default SS6oUS8MmzptghB7f6FKDKgAvEo2cfS2C4 1
//scripts/btcctl --simnet --wallet --rpcuser=wormhole --rpcpass=w0rmh013 sendfrom default SQznn6GTc1qcpjRQyZwev86aQTbAmBaSzY 1

async function listenBtc() {
  var cert = fs.readFileSync("rpc.cert");
  var user = "wormhole";
  var password = "w0rmh013";

  var ws = new WebSocket("wss://127.0.0.1:18556/ws", {
    headers: {
      Authorization:
        "Basic " + Buffer.from(user + ":" + password).toString("base64"),
    },
    cert: cert,
    ca: [cert],
  });
  ws.on("open", function () {
    console.log("CONNECTED");
    ws.send('{"jsonrpc":"1.0","id":"1","method":"notifyblocks","params":[]}');
    ws.send('{"jsonrpc":"1.0","id":"2","method":"notifynewtransactions","params":[true]}');
    ws.send('{"jsonrpc":"1.0","id":"3","method":"loadtxfilter","params":[false, ["SQznn6GTc1qcpjRQyZwev86aQTbAmAaSzY"], []  ]}');
  });
  ws.on("message", function (data: any, flags: any) {
      let v = JSON.parse(data.toString())
      console.log(JSON.stringify(v, null, 2))
  });
  ws.on("error", function (derp: any) {
    console.log("ERROR:" + derp);
  });
  ws.on("close", function (data: any) {
    console.log("DISCONNECTED");
  });
}

listenBtc();
