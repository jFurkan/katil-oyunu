-- ========================================
-- 1. EN YAVAŞ SORGU ANALİZİ
-- ========================================

-- getAllTeams() - En kritik sorgu
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT t.*,
       COALESCE(
           (SELECT json_agg(json_build_object('text', text, 'time', time) ORDER BY id)
            FROM clues WHERE team_id = t.id),
           '[]'
       ) as clues,
       COALESCE(
           (SELECT json_agg(json_build_object('id', b2.id, 'name', b2.name, 'icon', b2.icon, 'color', b2.color) ORDER BY b2.id)
            FROM team_badges tb2
            JOIN badges b2 ON tb2.badge_id = b2.id
            WHERE tb2.team_id = t.id),
           '[]'
       ) as badges
FROM teams t
ORDER BY t.created_at;

-- ========================================
-- 2. EKSİK İNDEX KONTROLÜ
-- ========================================

-- Mevcut index'leri listele
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- İstatistikler - correlation düşükse index gerekli
SELECT
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation,
    null_frac
FROM pg_stats
WHERE schemaname = 'public'
  AND tablename IN ('users', 'teams', 'clues', 'team_messages', 'team_badges')
  AND attname IN ('id', 'team_id', 'user_id', 'created_at', 'online', 'socket_id')
ORDER BY tablename, attname;

-- Eksik foreign key index'leri bul
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- ========================================
-- 3. YAVAŞ QUERY'LERİ YAKALA (son 100 query)
-- ========================================

-- PostgreSQL 13+ için pg_stat_statements gerekli
-- Eğer extension yoksa: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- En yavaş 10 query
SELECT
    substring(query, 1, 100) as query_preview,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time,
    stddev_exec_time
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- ========================================
-- 4. TABLE BLOAT & VACUUM KONTROLÜ
-- ========================================

SELECT
    schemaname,
    relname as table_name,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    round(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_row_percent,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_dead_tup DESC;

-- ========================================
-- 5. CONNECTION POOL DURUMU
-- ========================================

SELECT
    count(*) as total_connections,
    count(*) FILTER (WHERE state = 'active') as active,
    count(*) FILTER (WHERE state = 'idle') as idle,
    count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
FROM pg_stat_activity
WHERE datname = current_database();

-- Uzun süren transaction'lar (>5 saniye)
SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query_start,
    state_change,
    EXTRACT(EPOCH FROM (now() - query_start)) as duration_seconds,
    substring(query, 1, 100) as query_preview
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < now() - interval '5 seconds'
  AND datname = current_database()
ORDER BY query_start;
