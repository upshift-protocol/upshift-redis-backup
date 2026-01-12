# Upstash Redis Backup

A simple tool to backup and restore all data from an Upstash Redis instance.

## Features

- Backs up all Redis data types: strings, hashes, lists, sets, and sorted sets
- Organizes backups by year/month: `backup/[year]/[month]/[timestamp].json`
- Restore from any backup JSON file
- Automated backups via GitHub Actions (every 3 hours)

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Create a `.env` file with your Upstash Redis credentials:
   ```
   UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-token
   ```

## Usage

### Create a backup

```bash
pnpm backup
```

This creates a JSON file at `backup/[year]/[month]/[ISO-timestamp].json`.

### Restore from a backup

```bash
pnpm restore backup/2026/01/2026-01-12T10-30-45.123Z.json
```

## Backup JSON Structure

```json
{
  "metadata": {
    "timestamp": "2026-01-12T10:30:45.123Z",
    "keyCount": 150,
    "version": "1.0"
  },
  "data": {
    "string_keys": { "key": "value" },
    "hash_keys": { "key": { "field": "value" } },
    "list_keys": { "key": ["item1", "item2"] },
    "set_keys": { "key": ["member1", "member2"] },
    "zset_keys": { "key": [{ "score": 100, "member": "m1" }] }
  }
}
```

## GitHub Actions

The repository includes a workflow that runs backups every 3 hours and commits the results to the main branch.

### Setup GitHub Actions

Add these secrets to your repository (Settings > Secrets and variables > Actions):

Find the secret vaules here: [Google Doc](https://docs.google.com/document/d/1ZonzGd6kTlYeiffL4EHEHa1D2p5LvqFqI9QoMDRbNbE/edit?usp=sharing)

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

The workflow can also be triggered manually from the Actions tab.
