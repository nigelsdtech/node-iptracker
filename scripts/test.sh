#!/bin/sh

export NODE_ENV="test"

#ts-mocha ./test/unit/*.ts
ts-mocha ./test/functional/*.ts --timeout=15000
