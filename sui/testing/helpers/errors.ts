import { MoveAbort } from "./moveAbort";

export function parseWormholeError(errorMessage: string) {
  const abort = MoveAbort.parseError(errorMessage);
  const code = abort.errorCode;

  const errorLabel = (() => {
    switch (abort.moduleName) {
      case "package_utils": {
        switch (code) {
          case 1n: {
            return "E_NOT_CURRENT_VERSION";
          }
          case 2n: {
            return "E_INCORRECT_OLD_VERSION";
          }
          default: {
            throw new Error(`unrecognized error code: ${abort}`);
          }
        }
      }
      default: {
        throw new Error(`unrecognized module: ${abort}`);
      }
    }
  })();

  return `${abort.moduleName}::${errorLabel}`;
}
