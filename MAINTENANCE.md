# Digital Signage CMS — Maintenance & Backup Plan

This guide ensures the long-term reliability and data integrity of the Digital Signage CMS.

## 1. Data Backups

### Supabase Database
- **Automatic Backups**: Supabase provides automatic daily backups on its paid tiers (Pro/Enterprise).
- **Manual Export**: Use the Supabase CLI to export the schema and data:
  ```bash
  supabase db dump --data-only > backup_data.sql
  ```
- **Frequency**: Weekly for production data; daily if there are frequent content changes.

### Supabase Storage (Multimedia)
- **Content**: Files are stored in the `media` bucket.
- **Backup Strategy**: Use the AWS CLI (if using S3-compatible backend) or the Supabase CLI to mirror the bucket to an external location.

---

## 2. Performance Monitoring

### SQL Indexing
- Monitor slow queries in the Supabase Dashboard (Database -> Query Performance).
- Ensure indexes exist for any new columns added in the future that are used in `WHERE` or `JOIN` clauses.

### Storage Usage
- Monitor company storage limits via the CMS dashboard.
- Periodically clean up orphaned files in the storage bucket using a script that compares records in the `media` table with files in the `media` bucket.

---

## 3. Deployment Scaling

### horizontal Scaling
- The Next.js app is stateless and can be scaled across multiple containers behind a load balancer (e.g., Vercel, AWS ECS, or K8s).
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is kept secret and not exposed to the client.

---

## 4. Troubleshooting

### Player Connectivity
- If many players appear offline, check the Supabase Realtime usage limits.
- Verify heartbeat timestamps in the `players` table to distinguish between network failure and app failure.

### Playback Errors
- Check the `playback_logs` table for records with statuses other than `completed`.
- Verify that signed URLs have enough expiration time for players with slow connections.

---

## 5. Security Updates
- Regularly run `npm audit` to check for frontend dependencies with vulnerabilities.
- Keep the Supabase CLI and client libraries updated to benefit from the latest security patches.
