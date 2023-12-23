#!/bin/bash

DEPLOY_DIR=/platform-tools-1.37/out/deploy
SDK_DIR=`cargo build-sbf --help | grep 'Path to the Solana SBF SDK' | awk '{print $10}' | sed 's/]//g'`
CACHE_DIR=/root/.cache/solana/v1.37/platform-tools

echo "Creating cache dirs"
# Make cache dirs for built artifacts
mkdir -p $CACHE_DIR/sbf-tools
mkdir -p $CACHE_DIR/bpf-tools

echo "Copying artifacts"
# Move artifacts to cache dirs
cp -r  $DEPLOY_DIR/* $CACHE_DIR/

echo "Creating deps dir"
# Make location for deps to be simlinked
DEPS_DIR=$SDK_DIR/dependencies
if [ -d $DEPS_DIR ]; then
  rm -rf $DEPS_DIR
fi
mkdir $DEPS_DIR

echo "Symlinking"
# Simlink deps
ln -s $CACHE_DIR $DEPS_DIR

