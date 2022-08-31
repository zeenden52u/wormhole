"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const logHelper_1 = require("./logHelper");
// TODO: mock and confirm output
(0, globals_1.beforeAll)(() => {
    require("./loadConfig");
    process.env.LOG_DIR = ".";
});
(0, globals_1.test)("should log default logs", () => {
    const logger = (0, logHelper_1.getLogger)();
    logger.info("test");
});
(0, globals_1.test)("should use child labels", () => {
    (0, logHelper_1.getLogger)().child({}).info("test without labels");
    (0, logHelper_1.getLogger)().child({ labels: [] }).info("test with empty labels");
    (0, logHelper_1.getLogger)()
        .child({ labels: ["one"] })
        .info("test with one label");
    (0, logHelper_1.getLogger)()
        .child({ labels: ["one", "two"] })
        .info("test with two labels");
    (0, logHelper_1.getLogger)()
        .child({ labels: ["one", "two", "three"] })
        .info("test with three labels");
});
(0, globals_1.test)("should allow child label override", () => {
    const root = (0, logHelper_1.getLogger)();
    const parent = root.child({ labels: ["override-me"] });
    const child = root.child({ labels: ["overridden"] });
    root.info("root log");
    parent.info("parent log");
    child.info("child log");
});
(0, globals_1.test)("scoped logger", () => {
    (0, logHelper_1.getScopedLogger)([]).info("no labels");
    (0, logHelper_1.getScopedLogger)(["one"]).info("one label");
});
(0, globals_1.test)("scoped logger inheritance", () => {
    const parent = (0, logHelper_1.getScopedLogger)(["parent"]);
    const child = (0, logHelper_1.getScopedLogger)(["child"], parent);
    parent.info("parent log");
    child.info("child log");
});
//# sourceMappingURL=logHelper.test.js.map