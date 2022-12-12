-include ../Makefile.help

.PHONY: artifacts
## Build contracts and copy to xpla
artifacts:
	cd ../cosmwasm && $(MAKE) artifacts
	cp -r ../cosmwasm/artifacts .

tools/node_modules: tools/package-lock.json
	cd tools && npm ci

.PHONY: clean
clean:
	rm -rf artifacts
	rm -rf tools/node_modules
