#!/bin/sh

. ~/bin/setup_node_env.sh

# Needed for ifconfig
export PATH="$PATH:/sbin"

node index.js
