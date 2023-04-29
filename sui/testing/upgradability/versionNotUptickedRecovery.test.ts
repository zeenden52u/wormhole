import * as mock from "@certusone/wormhole-sdk/lib/cjs/mock";
import { afterAll, beforeAll, describe, expect } from "@jest/globals";
import { TransactionBlock, localnetConnection } from "@mysten/sui.js";
import * as fs from "fs";
import * as path from "path";
import {
  GOVERNANCE_EMITTER,
  KEYSTORE,
  MOCK_STAGING_ROOT,
  SUI_ROOT,
  currentVersionType,
  deployContracts,
  makeWallet,
  ovewriteMoveToml,
  packageId,
  parseWormholeError,
  prepareTokenBridgeBuild,
  prepareWormholeBuild,
  setUpStagingDirectory,
  setUpTokenBridgeRegistries,
  wormholeModules,
} from "../helpers";
import {
  migrateTokenBridgeSpecified,
  migrateWormholeSpecified,
} from "../helpers/migrate";
import {
  addPublishMessageWorkflowTest,
  addTransferTokensWorkflowTest,
  getNewEmitterCapId,
  testTokenBridgeTransferTokensStatusOrError,
  testWormholeEmitterNewStatusOrError,
} from "../helpers/testing";
import {
  buildForBytecodeAndDigest,
  makeTokenBridgeUpgradeContractVaa,
  makeWormholeUpgradeContractVaa,
  upgradeTokenBridge,
  upgradeWormhole,
} from "../helpers/upgrade";

// Disable this error:
//
// RPCValidationError: Error: RPC Validation Error: The response returned from RPC server does not match the TypeScript definition. This is likely because the SDK version is not compatible with the RPC server.
console.warn = function () {};

// NOTE: Make sure these are unique among all of the test files. If any of the
// keys collide among tests, there may be failed tests due to referencing the
// same objects.
const KEY_INDEX = 0;

describe("Recover from Forgetting to Configure New Version Struct", () => {
  const privateKey = KEYSTORE[KEY_INDEX];

  const wallet = makeWallet(localnetConnection, privateKey);
  const provider = wallet.provider;

  const testId = path.parse(__filename).name;
  const stagingPath = path.resolve(`${__dirname}/staging__${testId}`);
  const mockStagingPath = `${MOCK_STAGING_ROOT}/${testId}`;

  const wormholePath = `${stagingPath}/wormhole`;
  const tokenBridgePath = `${stagingPath}/token_bridge`;

  const governance = new mock.GovernanceEmitter(GOVERNANCE_EMITTER);

  const localVariables: Map<string, string> = new Map();

  // We build our own Wormhole and Token Bridge, whose IDs are only meant for
  // tests in this file.
  beforeAll(async () => {
    // Stage initial deploys.
    setUpStagingDirectory(SUI_ROOT, stagingPath);

    const {
      wormholeAddress,
      tokenBridgeAddress,
      wormholeStateId,
      tokenBridgeStateId,
    } = deployContracts(privateKey, stagingPath);

    const keyTypes = ["Address", "CurrentPackage", "PendingPackage"];
    for (const keyType of keyTypes) {
      localVariables.set(`wormhole${keyType}`, wormholeAddress);
      localVariables.set(`tokenBridge${keyType}`, tokenBridgeAddress);
    }

    localVariables.set("wormholeStateId", wormholeStateId);
    localVariables.set("tokenBridgeStateId", tokenBridgeStateId);

    const { modulePackageUtils } = wormholeModules(wormholeAddress);
    localVariables.set("modulePackageUtils", modulePackageUtils);

    // Token Bridge Register Chain (Foreign Chain == Ethereum) and attest SUI.
    await setUpTokenBridgeRegistries(
      wallet,
      tokenBridgeStateId,
      wormholeStateId,
      modulePackageUtils,
      governance
    );
  });

  afterAll(() => {
    fs.rmSync(stagingPath, { recursive: true, force: true });
    console.log(localVariables);
  });

  afterEach(async () => {
    // Starting point before test, we want to check the version struct change.
    const modulePackageUtils = localVariables.get("modulePackageUtils")!;
    const wormholeStateId = localVariables.get("wormholeStateId")!;
    const tokenBridgeStateId = localVariables.get("tokenBridgeStateId")!;

    const infoLabels = [
      "wormholeVersionType",
      "tokenBridgeVersionType",
      "wormholePendingPackage",
      "tokenBridgePendingPackage",
      "wormholeCurrentPackage",
      "tokenBridgeCurrentPackage",
    ];

    // Update everything.
    const updatedInfo = await Promise.all([
      currentVersionType(provider, wormholeStateId, modulePackageUtils),
      currentVersionType(provider, tokenBridgeStateId, modulePackageUtils),
      packageId(
        provider,
        wormholeStateId,
        modulePackageUtils,
        "PendingPackage"
      ),
      packageId(
        provider,
        tokenBridgeStateId,
        modulePackageUtils,
        "PendingPackage"
      ),
      packageId(provider, wormholeStateId, modulePackageUtils),
      packageId(provider, tokenBridgeStateId, modulePackageUtils),
    ]);
    for (let i = 0; i < updatedInfo.length; ++i) {
      localVariables.set(infoLabels[i], updatedInfo[i]);
    }
  });

  describe("Wormhole Upgrade and Migrate", () => {
    afterEach(async () => {
      const modulePackageUtils = localVariables.get("modulePackageUtils")!;
      const wormholeStateId = localVariables.get("wormholeStateId")!;
      const wormholePackageV1 = localVariables.get("wormholeAddress")!;

      const wormholeCurrentPackage = await packageId(
        provider,
        wormholeStateId,
        modulePackageUtils
      );

      console.log(
        "checking Wormhole packages",
        wormholePackageV1,
        wormholeCurrentPackage
      );

      const emitterCapId = await getNewEmitterCapId(
        wallet,
        wormholeCurrentPackage,
        wormholeStateId
      );

      const numMessages = 32;
      const tx = new TransactionBlock();

      const nonce = 69;
      const basePayload = "All your base are belong to us.";
      for (let i = 0; i < numMessages; ++i) {
        // Make a unique message.
        const payload = basePayload + `... ${i}`;

        addPublishMessageWorkflowTest(
          tx,
          wormholeCurrentPackage,
          wormholeStateId,
          wormholePackageV1,
          emitterCapId,
          nonce,
          payload
        );
      }

      // Publish message from latest build.
      const publishMessageResults = await wallet.signAndExecuteTransactionBlock(
        {
          transactionBlock: tx,
          options: {
            showEffects: true,
            showEvents: true,
          },
        }
      );
      expect(publishMessageResults.effects?.status?.status).toBe("success");
      expect(publishMessageResults.events!).toHaveLength(numMessages);
    });

    test("Upgrade Without Adding Version Struct", async () => {
      const modulePackageUtils = localVariables.get("modulePackageUtils")!;
      const moduleUpgradeContract = localVariables.get(
        "wormholeModuleUpgradeContract"
      )!;
      const wormholeStateId = localVariables.get("wormholeStateId")!;

      // Prepare Wormhole build.
      const originalMoveToml = prepareWormholeBuild(stagingPath);

      // Build.
      const { modules, dependencies, digest } =
        buildForBytecodeAndDigest(wormholePath);

      // Generate VAA. Save this for later (in the migrate step).
      const signedVaa = makeWormholeUpgradeContractVaa(governance, digest);
      localVariables.set("upgradeVaa", signedVaa.toString("hex"));

      // Upgrade.
      const upgradeResult = await upgradeWormhole(
        wallet,
        wormholeStateId,
        modules,
        dependencies,
        signedVaa
      );
      expect(upgradeResult.effects?.status.status).toBe("success");

      const [currentPackage, pendingPackage] = await Promise.all([
        packageId(provider, wormholeStateId, modulePackageUtils),
        packageId(
          provider,
          wormholeStateId,
          modulePackageUtils,
          "PendingPackage"
        ),
      ]);

      // Check package IDs.
      const previousPendingPackage = localVariables.get(
        "wormholePendingPackage"
      )!;
      expect(currentPackage).toBe(previousPendingPackage);
      expect(currentPackage).not.toBe(pendingPackage);

      // Grab ContractUpgraded event.
      expect(upgradeResult.events).not.toBeUndefined;

      const events = upgradeResult.events!;
      expect(events).toHaveLength(1);

      const { old_contract: oldContract, new_contract: newContract } =
        events[0].parsedJson!;
      expect(currentPackage).toBe(oldContract);
      expect(pendingPackage).toBe(newContract);

      // Clean up wormhole staging area
      ovewriteMoveToml(wormholePath, originalMoveToml);

      // We can interact with both packages because the versions on both are
      // the same.
      for (const packageId of [pendingPackage, currentPackage]) {
        const status = await testWormholeEmitterNewStatusOrError(
          wallet,
          packageId,
          wormholeStateId
        );
        expect(status).toBe("success");
      }
    });

    test("Cannot Migrate", async () => {
      const modulePackageUtils = localVariables.get("modulePackageUtils")!;
      const wormholeStateId = localVariables.get("wormholeStateId")!;

      const pendingPackage = localVariables.get("wormholePendingPackage")!;
      const upgradeVaa = Buffer.from(localVariables.get("upgradeVaa")!, "hex");

      const migrateResult = await migrateWormholeSpecified(
        wallet,
        pendingPackage,
        wormholeStateId,
        upgradeVaa
      ).catch((error: Error) => {
        const wormholeError = parseWormholeError(error.message);
        expect(wormholeError).toBe("package_utils::E_INCORRECT_OLD_VERSION");
      });
      expect(migrateResult).toBeUndefined;

      // Check version.
      const [currentWormholeVersion, currentPackage] = await Promise.all([
        currentVersionType(provider, wormholeStateId, modulePackageUtils),
        packageId(provider, wormholeStateId, modulePackageUtils),
      ]);

      const wormholeVersionType = localVariables.get("wormholeVersionType")!;
      expect(currentWormholeVersion).toBe(wormholeVersionType);

      // Check that the current package hasn't changed.
      const expectedCurrentPackage = localVariables.get(
        "wormholeCurrentPackage"
      )!;
      expect(currentPackage).toBe(expectedCurrentPackage);

      // Purge upgrade VAA.
      localVariables.delete("upgradeVaa");

      // We can interact with both packages because the versions on both are
      // the same.
      for (const packageId of [pendingPackage, currentPackage]) {
        const status = await testWormholeEmitterNewStatusOrError(
          wallet,
          packageId,
          wormholeStateId
        );
        expect(status).toBe("success");
      }
    });

    test("Upgrade Now Adding `V__GOOD_MIGRATE`", async () => {
      const modulePackageUtils = localVariables.get("modulePackageUtils")!;
      const wormholeStateId = localVariables.get("wormholeStateId")!;

      // Prepare Wormhole build
      const originalMoveToml = prepareWormholeBuild(stagingPath);

      // Now add version_control.move.
      const newFiles = ["version_control.move"];
      for (const dstBasename of newFiles) {
        const srcMove = `${mockStagingPath}/01_${dstBasename}`;
        expect(fs.existsSync(srcMove)).toBeTruthy();

        const dstMove = `${wormholePath}/sources/${dstBasename}`;
        fs.copyFileSync(srcMove, dstMove);
      }

      // Build.
      const { modules, dependencies, digest } =
        buildForBytecodeAndDigest(wormholePath);

      // Generate VAA. Save this for later (in the migrate step).
      const signedVaa = makeWormholeUpgradeContractVaa(governance, digest);
      localVariables.set("upgradeVaa", signedVaa.toString("hex"));

      // Upgrade.
      const upgradeResult = await upgradeWormhole(
        wallet,
        wormholeStateId,
        modules,
        dependencies,
        signedVaa
      );
      expect(upgradeResult.effects?.status.status).toBe("success");

      const [currentPackage, pendingPackage] = await Promise.all([
        packageId(provider, wormholeStateId, modulePackageUtils),
        packageId(
          provider,
          wormholeStateId,
          modulePackageUtils,
          "PendingPackage"
        ),
      ]);

      // Check package IDs.
      const previousPendingPackage = localVariables.get(
        "wormholePendingPackage"
      )!;

      // This time, the pending package does not equal the last current package
      // because we never actually migrated successfully.
      expect(currentPackage).not.toBe(previousPendingPackage);
      expect(currentPackage).not.toBe(pendingPackage);

      // Grab ContractUpgraded event.
      expect(upgradeResult.events).not.toBeUndefined;

      const events = upgradeResult.events!;
      expect(events).toHaveLength(1);

      const {
        old_contract: contractUpgradedOldContract,
        new_contract: contractUpgradedNewContract,
      } = events[0].parsedJson!;

      // The old contract in this case is the pending package from before.
      expect(previousPendingPackage).toBe(contractUpgradedOldContract);
      expect(pendingPackage).toBe(contractUpgradedNewContract);

      localVariables.set("wormholeStaleBuild", contractUpgradedOldContract);

      // Clean up wormhole staging area
      ovewriteMoveToml(wormholePath, originalMoveToml);

      // Cannot make emitter on pending package.
      const txError = await testWormholeEmitterNewStatusOrError(
        wallet,
        pendingPackage,
        wormholeStateId
      );
      expect(txError).toBe("package_utils::E_NOT_CURRENT_VERSION");

      // But we still can on the last package (which is the current package).
      const status = await testWormholeEmitterNewStatusOrError(
        wallet,
        currentPackage,
        wormholeStateId
      );
      expect(status).toBe("success");
    });

    test("Finally Migrate to Version `V__GOOD_MIGRATE`", async () => {
      const modulePackageUtils = localVariables.get("modulePackageUtils")!;
      const wormholeStateId = localVariables.get("wormholeStateId")!;

      const previousPendingPackage = localVariables.get(
        "wormholePendingPackage"
      )!;
      const upgradeVaa = Buffer.from(localVariables.get("upgradeVaa")!, "hex");

      const migrateResult = await migrateWormholeSpecified(
        wallet,
        previousPendingPackage,
        wormholeStateId,
        upgradeVaa
      );
      expect(migrateResult.effects?.status.status).toBe("success");

      // Grab ContractUpgraded event.
      expect(migrateResult.events).not.toBeUndefined;

      const events = migrateResult.events!;
      expect(events).toHaveLength(1);

      const [pendingPackage, currentPackage, currentWormholeVersion] =
        await Promise.all([
          packageId(
            provider,
            wormholeStateId,
            modulePackageUtils,
            "PendingPackage"
          ),
          packageId(provider, wormholeStateId, modulePackageUtils),
          currentVersionType(provider, wormholeStateId, modulePackageUtils),
        ]);

      expect(pendingPackage).toBe(previousPendingPackage);
      expect(currentPackage).toBe(pendingPackage);

      const { package: migrateCompletePackage } = events[0].parsedJson!;
      expect(migrateCompletePackage).toBe(currentPackage);

      // Check version.
      const wormholeVersionType = localVariables.get("wormholeVersionType")!;
      expect(currentWormholeVersion).not.toBe(wormholeVersionType);

      // Purge upgrade VAA.
      localVariables.delete("upgradeVaa");

      // Try to make new emitter using old package and expect failure.
      const wormholeStaleBuild = localVariables.get("wormholeStaleBuild")!;
      expect(wormholeStaleBuild).not.toBe(currentPackage);

      // Cannot make emitter on stale build now.
      const txError = await testWormholeEmitterNewStatusOrError(
        wallet,
        wormholeStaleBuild,
        wormholeStateId
      );
      expect(txError).toBe("package_utils::E_NOT_CURRENT_VERSION");

      // But we can now on the package we just migrated to.
      const status = await testWormholeEmitterNewStatusOrError(
        wallet,
        currentPackage,
        wormholeStateId
      );
      expect(status).toBe("success");
    });
  });

  describe("Token Bridge Upgrade and Migrate", () => {
    afterEach(async () => {
      const modulePackageUtils = localVariables.get("modulePackageUtils")!;
      const tokenBridgeStateId = localVariables.get("tokenBridgeStateId")!;
      const wormholeStateId = localVariables.get("wormholeStateId")!;
      const tokenBridgePackageV1 = localVariables.get("tokenBridgeAddress")!;

      const [tokenBridgeCurrentPackage, wormholeCurrentPackage] =
        await Promise.all(
          [tokenBridgeStateId, wormholeStateId].map((stateId) =>
            packageId(provider, stateId, modulePackageUtils)
          )
        );

      console.log(
        "checking Token Bridge packages",
        tokenBridgePackageV1,
        tokenBridgeCurrentPackage
      );

      // Transfer SUI.
      const numTransfers = 10;
      const suiAmount = 420n;

      const tx = new TransactionBlock();

      for (let i = 0; i < numTransfers; ++i) {
        addTransferTokensWorkflowTest(
          tx,
          tokenBridgeCurrentPackage,
          wormholeCurrentPackage,
          tokenBridgeStateId,
          wormholeStateId,
          tokenBridgePackageV1,
          suiAmount
        );
      }

      // Transfer tokens from latest build.
      const transferTokensResults = await wallet.signAndExecuteTransactionBlock(
        {
          transactionBlock: tx,
          options: {
            showEffects: true,
            showEvents: true,
          },
        }
      );
      expect(transferTokensResults.effects?.status?.status).toBe("success");
      expect(transferTokensResults.events!).toHaveLength(numTransfers);
    });

    test("Upgrade Without Adding Version Struct", async () => {
      const modulePackageUtils = localVariables.get("modulePackageUtils")!;
      const moduleUpgradeContract = localVariables.get(
        "tokenBridgeModuleUpgradeContract"
      )!;
      const tokenBridgeStateId = localVariables.get("tokenBridgeStateId")!;
      const wormholeStateId = localVariables.get("wormholeStateId")!;

      // Prepare Wormhole build.
      const wormholeAddress = localVariables.get("wormholeAddress")!;
      const wormholePublishedAt = localVariables.get("wormholeCurrentPackage")!;
      const [originalTokenBridgeMoveToml, originalWormholeMoveToml] =
        prepareTokenBridgeBuild(
          stagingPath,
          wormholeAddress,
          wormholePublishedAt
        );

      // Build.
      const { modules, dependencies, digest } =
        buildForBytecodeAndDigest(tokenBridgePath);

      // Generate VAA. Save this for later (in the migrate step).
      const signedVaa = makeTokenBridgeUpgradeContractVaa(governance, digest);
      localVariables.set("upgradeVaa", signedVaa.toString("hex"));

      // Upgrade.
      const upgradeResult = await upgradeTokenBridge(
        wallet,
        tokenBridgeStateId,
        wormholeStateId,
        modules,
        dependencies,
        signedVaa
      );
      expect(upgradeResult.effects?.status.status).toBe("success");

      const [currentPackage, pendingPackage] = await Promise.all([
        packageId(provider, tokenBridgeStateId, modulePackageUtils),
        packageId(
          provider,
          tokenBridgeStateId,
          modulePackageUtils,
          "PendingPackage"
        ),
      ]);

      // Check package IDs.
      const previousPendingPackage = localVariables.get(
        "tokenBridgePendingPackage"
      )!;
      expect(currentPackage).toBe(previousPendingPackage);
      expect(currentPackage).not.toBe(pendingPackage);

      // Grab ContractUpgraded event.
      expect(upgradeResult.events).not.toBeUndefined;

      const events = upgradeResult.events!;
      expect(events).toHaveLength(1);

      const {
        old_contract: contractUpgradedOldContract,
        new_contract: contractUpgradedNewContract,
      } = events[0].parsedJson!;
      expect(currentPackage).toBe(contractUpgradedOldContract);
      expect(pendingPackage).toBe(contractUpgradedNewContract);

      // Clean up staging areas.
      ovewriteMoveToml(tokenBridgePath, originalTokenBridgeMoveToml);
      ovewriteMoveToml(wormholePath, originalWormholeMoveToml);

      const tokenBridgePackageV1 = localVariables.get("tokenBridgeAddress")!;
      const wormholeCurrentPackage = localVariables.get(
        "wormholeCurrentPackage"
      )!;
      // We can interact with both packages because the versions on both are
      // the same.
      for (const packageId of [pendingPackage, currentPackage]) {
        const status = await testTokenBridgeTransferTokensStatusOrError(
          wallet,
          packageId,
          wormholeCurrentPackage,
          tokenBridgeStateId,
          wormholeStateId,
          tokenBridgePackageV1,
          420n
        );
        expect(status).toBe("success");
      }
    });

    test("Cannot Migrate", async () => {
      const modulePackageUtils = localVariables.get("modulePackageUtils")!;
      const tokenBridgeStateId = localVariables.get("tokenBridgeStateId")!;

      const pendingPackage = localVariables.get("tokenBridgePendingPackage")!;
      const upgradeVaa = Buffer.from(localVariables.get("upgradeVaa")!, "hex");

      const wormholeCurrentPackage = localVariables.get(
        "wormholeCurrentPackage"
      )!;
      const wormholeStateId = localVariables.get("wormholeStateId")!;

      const migrateResult = await migrateTokenBridgeSpecified(
        wallet,
        pendingPackage,
        wormholeCurrentPackage,
        tokenBridgeStateId,
        wormholeStateId,
        upgradeVaa
      ).catch((error: Error) => {
        const wormholeError = parseWormholeError(error.message);
        expect(wormholeError).toBe("package_utils::E_INCORRECT_OLD_VERSION");
      });
      expect(migrateResult).toBeUndefined;

      // Check version.
      const [currentTokenBridgeVersion, currentPackage] = await Promise.all([
        currentVersionType(provider, tokenBridgeStateId, modulePackageUtils),
        packageId(provider, tokenBridgeStateId, modulePackageUtils),
      ]);

      const tokenBridgeVersionType = localVariables.get(
        "tokenBridgeVersionType"
      )!;
      expect(currentTokenBridgeVersion).toBe(tokenBridgeVersionType);

      // Check that the current package hasn't changed.
      const expectedCurrentPackage = localVariables.get(
        "tokenBridgeCurrentPackage"
      )!;
      expect(currentPackage).toBe(expectedCurrentPackage);

      // Purge upgrade VAA.
      localVariables.delete("upgradeVaa");

      const tokenBridgePackageV1 = localVariables.get("tokenBridgeAddress")!;
      // We can interact with both packages because the versions on both are
      // the same.
      for (const packageId of [pendingPackage, currentPackage]) {
        const status = await testTokenBridgeTransferTokensStatusOrError(
          wallet,
          packageId,
          wormholeCurrentPackage,
          tokenBridgeStateId,
          wormholeStateId,
          tokenBridgePackageV1,
          420n
        );
        expect(status).toBe("success");
      }
    });

    test("Upgrade Now Adding `V__GOOD_MIGRATE`", async () => {
      const modulePackageUtils = localVariables.get("modulePackageUtils")!;
      const moduleUpgradeContract = localVariables.get(
        "tokenBridgeModuleUpgradeContract"
      )!;
      const tokenBridgeStateId = localVariables.get("tokenBridgeStateId")!;
      const wormholeStateId = localVariables.get("wormholeStateId")!;

      // Prepare Wormhole build.
      const wormholeAddress = localVariables.get("wormholeAddress")!;
      const wormholePublishedAt = localVariables.get("wormholeCurrentPackage")!;
      const [originalTokenBridgeMoveToml, originalWormholeMoveToml] =
        prepareTokenBridgeBuild(
          stagingPath,
          wormholeAddress,
          wormholePublishedAt
        );

      // Now add version_control.move.
      const newFiles = ["version_control.move"];
      for (const dstBasename of newFiles) {
        const srcMove = `${mockStagingPath}/02_${dstBasename}`;
        expect(fs.existsSync(srcMove)).toBeTruthy();

        const dstMove = `${tokenBridgePath}/sources/${dstBasename}`;
        fs.copyFileSync(srcMove, dstMove);
      }

      // Build.
      const { modules, dependencies, digest } =
        buildForBytecodeAndDigest(tokenBridgePath);

      // Generate VAA. Save this for later (in the migrate step).
      const signedVaa = makeTokenBridgeUpgradeContractVaa(governance, digest);
      localVariables.set("upgradeVaa", signedVaa.toString("hex"));

      // Upgrade.
      const upgradeResult = await upgradeTokenBridge(
        wallet,
        tokenBridgeStateId,
        wormholeStateId,
        modules,
        dependencies,
        signedVaa
      );
      expect(upgradeResult.effects?.status.status).toBe("success");

      const [currentPackage, pendingPackage] = await Promise.all([
        packageId(provider, tokenBridgeStateId, modulePackageUtils),
        packageId(
          provider,
          tokenBridgeStateId,
          modulePackageUtils,
          "PendingPackage"
        ),
      ]);

      // Check package IDs.
      const previousPendingPackage = localVariables.get(
        "tokenBridgePendingPackage"
      )!;

      // This time, the pending package does not equal the last current package
      // because we never actually migrated successfully.
      expect(currentPackage).not.toBe(previousPendingPackage);
      expect(currentPackage).not.toBe(pendingPackage);

      // Grab ContractUpgraded event.
      expect(upgradeResult.events).not.toBeUndefined;

      const events = upgradeResult.events!;
      expect(events).toHaveLength(1);

      const {
        old_contract: contractUpgradedOldContract,
        new_contract: contractUpgradedNewContract,
      } = events[0].parsedJson!;
      expect(previousPendingPackage).toBe(contractUpgradedOldContract);
      expect(pendingPackage).toBe(contractUpgradedNewContract);

      localVariables.set("tokenBridgeStaleBuild", contractUpgradedOldContract);

      // Clean up staging areas.
      ovewriteMoveToml(tokenBridgePath, originalTokenBridgeMoveToml);
      ovewriteMoveToml(wormholePath, originalWormholeMoveToml);

      const tokenBridgePackageV1 = localVariables.get("tokenBridgeAddress")!;
      const wormholeCurrentPackage = localVariables.get(
        "wormholeCurrentPackage"
      )!;

      // Cannot transfer on pending package.
      const txError = await testTokenBridgeTransferTokensStatusOrError(
        wallet,
        pendingPackage,
        wormholeCurrentPackage,
        tokenBridgeStateId,
        wormholeStateId,
        tokenBridgePackageV1,
        420n
      );
      expect(txError).toBe("package_utils::E_NOT_CURRENT_VERSION");

      // But we still can on the last package (which is the current package).
      const status = await testTokenBridgeTransferTokensStatusOrError(
        wallet,
        currentPackage,
        wormholeCurrentPackage,
        tokenBridgeStateId,
        wormholeStateId,
        tokenBridgePackageV1,
        420n
      );
      expect(status).toBe("success");
    });

    test("Finally Migrate to Version `V__GOOD_MIGRATE`", async () => {
      const modulePackageUtils = localVariables.get("modulePackageUtils")!;
      const tokenBridgeStateId = localVariables.get("tokenBridgeStateId")!;
      const wormholeStateId = localVariables.get("wormholeStateId")!;

      const previousPendingPackage = localVariables.get(
        "tokenBridgePendingPackage"
      )!;
      const upgradeVaa = Buffer.from(localVariables.get("upgradeVaa")!, "hex");

      const wormholeCurrentPackage = localVariables.get(
        "wormholeCurrentPackage"
      )!;
      const migrateResult = await migrateTokenBridgeSpecified(
        wallet,
        previousPendingPackage,
        wormholeCurrentPackage,
        tokenBridgeStateId,
        wormholeStateId,
        upgradeVaa
      );
      expect(migrateResult.effects?.status.status).toBe("success");

      // Grab ContractUpgraded event.
      expect(migrateResult.events).not.toBeUndefined;

      const events = migrateResult.events!;
      expect(events).toHaveLength(1);

      const [pendingPackage, currentPackage, currentTokenBridgeVersion] =
        await Promise.all([
          packageId(
            provider,
            tokenBridgeStateId,
            modulePackageUtils,
            "PendingPackage"
          ),
          packageId(provider, tokenBridgeStateId, modulePackageUtils),
          currentVersionType(provider, tokenBridgeStateId, modulePackageUtils),
        ]);

      expect(pendingPackage).toBe(previousPendingPackage);
      expect(currentPackage).toBe(pendingPackage);

      const { package: migrateCompletePackage } = events[0].parsedJson!;
      expect(migrateCompletePackage).toBe(currentPackage);

      // Check version.
      const tokenBridgeVersionType = localVariables.get(
        "tokenBridgeVersionType"
      )!;
      expect(currentTokenBridgeVersion).not.toBe(tokenBridgeVersionType);

      // Purge upgrade VAA.
      localVariables.delete("upgradeVaa");

      // TODO
      const tokenBridgeStaleBuild = localVariables.get(
        "tokenBridgeStaleBuild"
      )!;
      expect(tokenBridgeStaleBuild).not.toBe(currentPackage);

      const tokenBridgePackageV1 = localVariables.get("tokenBridgeAddress")!;

      // Cannot transfer on stale build now.
      const txError = await testTokenBridgeTransferTokensStatusOrError(
        wallet,
        tokenBridgeStaleBuild,
        wormholeCurrentPackage,
        tokenBridgeStateId,
        wormholeStateId,
        tokenBridgePackageV1,
        420n
      );
      expect(txError).toBe("package_utils::E_NOT_CURRENT_VERSION");

      // But we can now on the package we just migrated to.
      const status = await testTokenBridgeTransferTokensStatusOrError(
        wallet,
        currentPackage,
        wormholeCurrentPackage,
        tokenBridgeStateId,
        wormholeStateId,
        tokenBridgePackageV1,
        420n
      );
      expect(status).toBe("success");
    });
  });
});
