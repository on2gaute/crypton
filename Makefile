test: check-dependencies test-unit test-integration

test-unit: test-unit-server test-unit-client

test-unit-server:
	$(MAKE) -C server test

test-unit-client:
	$(MAKE) -C client test

test-integration:
	$(MAKE) -C integration_tests test

clean:
	$(MAKE) -C client clean
	$(MAKE) -C integration_tests clean-test-db

setup-test-environment:
	$(MAKE) -C integration_tests setup-test-environment

docs:
	npm install -g otis jade
	sed -i '' -e '1s:node:node --stack_size=4096:' $$(dirname $$(which otis))/$$(readlink $$(which otis))
	otis .

check-dependencies:
	./check_dependencies.sh

.PHONY: test test-unit test-unit-server test-unit-client test-integration clean setup-test-environment docs check-dependencies
