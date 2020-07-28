#!/bin/sh

# Needed for ifconfig
export PATH="$PATH:/sbin"
export NODE_ENV="production"

node index.js
