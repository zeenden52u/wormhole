// run this script with truffle exec

const jsonfile = require("jsonfile");
const GasOracle = artifacts.require("GasOracle");
const GasOracleAbi = jsonfile.readFileSync(
  "../build/contracts/gasOracle/GasOracleImplementation.json"
).abi;
const gasOracleApprovedUpdaterVAA = process.env.SET_GAS_ORACLE_UPDATER_VAA;

module.exports = async function (callback) {
  try {
    const accounts = await web3.eth.getAccounts();
    const initialized = new web3.eth.Contract(GasOracleAbi, GasOracle.address);

    // Register the test wallet as the approved updater
    await initialized.methods
      .changeApprovedUpdater("0x" + gasOracleApprovedUpdaterVAA)
      .send({
        value: 0,
        from: accounts[0],
        gasLimit: 2000000,
      });

    callback();
  } catch (e) {
    callback(e);
  }
};
