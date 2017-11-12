#!/bin/bash

DIR="zip/"
mkdir -p $DIR

cp config.json $DIR
cp index.js $DIR
cp package.json $DIR
cd $DIR && npm install
zip -r lambda.zip .
#mv lambda.zip .
