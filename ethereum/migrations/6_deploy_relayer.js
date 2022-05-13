require("dotenv").config({ path: "../.env" });

const CoreRelayer = artifacts.require("CoreRelayerProxy");
const RelayerImplementation = artifacts.require("CoreRelayerImplementation");
const RelayerSetup = artifacts.require("CoreRelayerSetup");
const Wormhole = artifacts.require("Wormhole");

const chainId = process.env.BRIDGE_INIT_CHAIN_ID;
const governanceChainId = process.env.BRIDGE_INIT_GOV_CHAIN_ID;
const governanceContract = process.env.BRIDGE_INIT_GOV_CONTRACT; // bytes32

module.exports = async function(deployer) {
  // deploy setup
  await deployer.deploy(RelayerSetup);

  // deploy implementation
  await deployer.deploy(RelayerImplementation);

  // encode initialisation data
  const setup = new web3.eth.Contract(RelayerSetup.abi, RelayerSetup.address);
  const initData = setup.methods
    .setup(
      RelayerImplementation.address,
      chainId,
      (await Wormhole.deployed()).address,
      governanceChainId,
      governanceContract
    )
    .encodeABI();

  // deploy proxy
  await deployer.deploy(CoreRelayer, RelayerSetup.address, initData);
};
