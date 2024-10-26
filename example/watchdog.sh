#!/bin/bash

path_to_watch="."
last_snapshot=""

if [[ $# -eq 0 ]]; then
  echo "Usage: $0 <command>"
  exit 1
fi

command="$@"

while true; do
  current_snapshot=$(find "$path_to_watch" -type f -exec md5sum {} + |
    sort | md5sum)

  if [[ "$current_snapshot" != "$last_snapshot" ]]; then
    echo "Change detected!"
    eval "$command"
    last_snapshot="$current_snapshot"
  fi

  sleep 2
done
