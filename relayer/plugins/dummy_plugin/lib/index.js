"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = void 0;
function create(config, overrides) {
    console.log("Creating da plugin...");
    return new DummyPlugin(config, overrides);
}
exports.create = create;
class DummyPlugin {
    shouldSpy;
    shouldRest;
    name;
    env;
    config;
    constructor(config, overrides) {
        console.log(`Config: ${JSON.stringify(config, undefined, 2)}`);
        console.log(`Overrides: ${JSON.stringify(overrides, undefined, 2)}`);
        this.config = config;
        this.env = { shouldSpy: true, shouldRest: true, ...overrides };
        this.shouldRest = this.env.shouldRest;
        this.shouldSpy = this.env.shouldSpy;
        this.name = "DummyPlugin";
    }
    getFilters() {
        return [{ chainId: 1, emitterAddress: "gotcha!!" }];
    }
    async consumeEvent(vaa, stagingArea) {
        console.log(`DummyPlugin consumed an event. Staging area: ${stagingArea}`);
        return {
            actions: [],
            nextStagingArea: {
                counter: stagingArea?.counter ? stagingArea.counter + 1 : 0,
            },
        };
    }
}
exports.default = { create };
//# sourceMappingURL=index.js.map