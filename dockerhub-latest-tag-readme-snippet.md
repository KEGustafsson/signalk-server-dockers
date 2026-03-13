## Get Docker Hub metadata for the `latest` tag

Requires: `curl`, `jq`

```bash
curl -s 'https://hub.docker.com/v2/namespaces/signalk/repositories/signalk-server/tags/latest' \
| jq '{tag: .name, last_updated: .last_updated, digest: .digest, size: .full_size}'
```
