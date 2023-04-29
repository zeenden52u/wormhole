import { JsonRpcProvider } from "@mysten/sui.js";

export async function currentVersion(
  provider: JsonRpcProvider,
  stateId: string,
  modulePackageUtils: string
) {
  return provider.getDynamicFieldObject({
    parentId: stateId,
    name: {
      type: `${modulePackageUtils}::CurrentVersion`,
      value: { dummy_field: false },
    },
  });
}

export async function currentVersionType(
  provider: JsonRpcProvider,
  stateId: string,
  modulePackageUtils: string
) {
  return currentVersion(provider, stateId, modulePackageUtils).then((obj) => {
    if ("fields" in obj.data?.content!) {
      return obj.data?.content?.fields.value.type as string;
    }

    throw new Error("fields not found in object content");
  });
}

export async function packageId(
  provider: JsonRpcProvider,
  stateId: string,
  modulePackageUtils: string,
  packageKey: "CurrentPackage" | "PendingPackage" = "CurrentPackage"
) {
  return provider
    .getDynamicFieldObject({
      parentId: stateId,
      name: {
        type: `${modulePackageUtils}::${packageKey}`,
        value: { dummy_field: false },
      },
    })
    .then((obj) => {
      if ("fields" in obj.data?.content!) {
        return obj.data?.content.fields.value.fields.package as string;
      }

      throw new Error("fields not found in object content");
    });
}
