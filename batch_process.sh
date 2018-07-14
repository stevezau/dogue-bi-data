#!/bin/bash
stores=( bondi balmain avalon brighton gymea zetland wahroonga gungahlin network )
fn=$1
type=$2
from=$3
to=$4

for store in "${stores[@]}"
do
    echo "Running ${fn} for ${store}"
   node -r babel-register /usr/local/bin/sls invoke local -f ${fn} --data "{\"store\": \"${store}\",\"type\": \"${type}\", \"from\": \"${from}\",\"to\": \"${to}\"}"
done