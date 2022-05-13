require("dotenv").config({ path: "../.env" });

const GasOracle = artifacts.require("GasOracleProxy");
const OracleImplementation = artifacts.require("GasOracleImplementation");
const OracleSetup = artifacts.require("GasOracleSetup");
const Wormhole = artifacts.require("Wormhole");

const chainId = process.env.BRIDGE_INIT_CHAIN_ID;
const governanceChainId = process.env.BRIDGE_INIT_GOV_CHAIN_ID;
const governanceContract = process.env.BRIDGE_INIT_GOV_CONTRACT; // bytes32

module.exports = async function(deployer) {
  // deploy setup
  await deployer.deploy(OracleSetup);

  // deploy implementation
  await deployer.deploy(OracleImplementation);

  // encode initialisation data
  const setup = new web3.eth.Contract(OracleSetup.abi, OracleSetup.address);
  const initData = setup.methods
    .setup(
      OracleImplementation.address,
      chainId,
      (await Wormhole.deployed()).address,
      governanceChainId,
      governanceContract
    )
    .encodeABI();

  // deploy proxy
  await deployer.deploy(GasOracle, OracleSetup.address, initData);
};
