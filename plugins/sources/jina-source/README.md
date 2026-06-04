# Jina Reader Source Plugin

Official `quantagent.official.source.jina` source plugin.

## Purpose

This plugin reads a web page URL through the Jina Reader service and returns a normalized source fetch result that can be consumed by the platform's source runtime.

## Configuration

The plugin exposes the following public configuration fields in `config.schema.json`:

- `url` (string, required): the URL to read.
- `timeout_seconds` (integer, optional): maximum seconds to wait for the Jina Reader service.
- `allow_external_reader` (boolean, optional): if set to `false`, the plugin will reject the request without calling the external reader.

## Sensitive Secrets

The plugin does not expose Jina API credentials in `config.schema.json`.

A Jina API key should be provided via secure runtime injection, such as:

- platform-provided secret metadata in `context.metadata["jina_api_key"]`, or
- environment variable `JINA_API_KEY` as a local development fallback.

The plugin does not read API credentials from public plugin config fields.

## Capabilities

- `source.fetch`

## Runtime Contract

The plugin returns a `SourceFetchResult` mapping containing one or more `SourceItemDraft` items. Each item includes normalized text content, an external URL, and a JSON-safe `raw_payload` containing the original Jina response.

## Failure Behavior

- If `allow_external_reader` is explicitly `false`, the plugin fails without calling the external reader.
- If the Jina Reader service is unavailable, times out, or returns an invalid response, the plugin fails with a clear error.
