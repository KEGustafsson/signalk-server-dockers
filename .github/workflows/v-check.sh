#!/usr/bin/bash

          EXTERNAL_REPO="SignalK/signalk-server"
          tags=$(curl -s "https://api.github.com/repos/$EXTERNAL_REPO/tags" | jq -r '.[].name')
          latest_v_tag=$(echo "$tags" | grep '^v' | head -n 1)
          if [ -z "$latest_v_tag" ]; then
              echo "No valid v* tags found."
              exit 0
          fi
          echo "Latest v* tag: $latest_v_tag"
          tag_ref_details=$(curl -s "https://api.github.com/repos/$EXTERNAL_REPO/git/refs/tags/$latest_v_tag")
          object_type=$(echo "$tag_ref_details" | jq -r '.object.type')
          object_sha=$(echo "$tag_ref_details" | jq -r '.object.sha')
          if [ -z "$object_sha" ] || [ "$object_sha" == "null" ]; then
              echo "Failed to fetch tag reference details."
              exit 1
          fi
          echo "Tag object type: $object_type"
          echo "Object SHA: $object_sha"
          if [ "$object_type" == "tag" ]; then
              # Annotated tag - get tag object details
              tag_object_details=$(curl -s "https://api.github.com/repos/$EXTERNAL_REPO/git/tags/$object_sha")
              commit_date=$(echo "$tag_object_details" | jq -r '.tagger.date')
              commit_sha=$(echo "$tag_object_details" | jq -r '.object.sha')
              if [ -z "$commit_date" ] || [ "$commit_date" == "null" ]; then
                  echo "Failed to fetch annotated tag details."
                  exit 1
              fi
              echo "Tag type: Annotated"
              echo "Tag date: $commit_date"
          elif [ "$object_type" == "commit" ]; then
              # Lightweight tag - get commit details directly
              commit_sha="$object_sha"
              commit_details=$(curl -s "https://api.github.com/repos/$EXTERNAL_REPO/git/commits/$commit_sha")
              commit_date=$(echo "$commit_details" | jq -r '.committer.date')
              if [ -z "$commit_date" ] || [ "$commit_date" == "null" ]; then
                  echo "Failed to fetch commit details for lightweight tag."
                  exit 1
              fi
              echo "Tag type: Lightweight"
              echo "Commit date: $commit_date"
          else
              echo "Unknown tag object type: $object_type"
              exit 1
          fi
          current_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
          time_24h_ago=$(date -u -d "$current_time - 24 hours" +"%Y-%m-%dT%H:%M:%SZ")
          commit_epoch=$(date -u -d "$commit_date" +%s)
          current_epoch=$(date -u -d "$current_time" +%s)
          time_diff_seconds=$((current_epoch - commit_epoch))
          days=$((time_diff_seconds / 86400))
          hours=$(( (time_diff_seconds % 86400) / 3600 ))
          minutes=$(( (time_diff_seconds % 3600) / 60 ))
          seconds=$((time_diff_seconds % 60))
          echo "Time difference: ${days}d ${hours}h ${minutes}m ${seconds}s"
          echo "Tag/Commit Date: $commit_date"
          echo "Current Time: $current_time"
          if [[ "$commit_date" > "$time_24h_ago" ]]; then
              echo "New v* tag $latest_v_tag found in the last 24 hours."
              echo "proceed=true" >> $GITHUB_OUTPUT
          else
              echo "No new v* tags found in the last 24 hours."
              echo "Latest v* tag is $latest_v_tag"
              echo "proceed=false" >> $GITHUB_OUTPUT
          fi
