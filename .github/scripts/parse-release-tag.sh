#!/usr/bin/env bash
# Shared tag-parsing/versionCode logic for release.yml.
#
# Usage: source this file, then call `parse_tag "$TAG"`.
# On success, sets VERSION_NAME and VERSION_CODE and returns 0.
# On a non-matching tag, returns 1 and leaves those unset.

parse_tag() {
  local tag="$1"

  if [[ ! "$tag" =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)-bw\.([0-9]+)$ ]]; then
    return 1
  fi

  # 10# forces base-10 interpretation, so a zero-padded component like
  # "08" isn't parsed as an invalid octal literal.
  local major="${BASH_REMATCH[1]}"
  local minor="${BASH_REMATCH[2]}"
  local patch="${BASH_REMATCH[3]}"
  local n="${BASH_REMATCH[4]}"

  VERSION_NAME="${tag#v}"
  VERSION_CODE=$(( 10#$major * 1000000 + 10#$minor * 10000 + 10#$patch * 100 + 10#$n ))
}
