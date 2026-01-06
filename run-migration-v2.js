const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
    connectionString: 'postgresql://postgres:MgRlEtgiexRLKKUBUiblqLXjVIqakZOF@tramway.proxy.rlwy.net:23673/railway',
    ssl: {
        rejectUnauthorized: false
    }
});

// Index definitions
const indexes = [
    { name: 'idx_clues_team_id', sql: 'CREATE INDEX CONCURRENTLY idx_clues_team_id ON clues(team_id)' },
    { name: 'idx_team_badges_team_id', sql: 'CREATE INDEX CONCURRENTLY idx_team_badges_team_id ON team_badges(team_id)' },
    { name: 'idx_team_badges_badge_id', sql: 'CREATE INDEX CONCURRENTLY idx_team_badges_badge_id ON team_badges(badge_id)' },
    { name: 'idx_users_team_id', sql: 'CREATE INDEX CONCURRENTLY idx_users_team_id ON users(team_id)' },
    { name: 'idx_users_socket_id', sql: 'CREATE INDEX CONCURRENTLY idx_users_socket_id ON users(socket_id)' },
    { name: 'idx_team_messages_team_id', sql: 'CREATE INDEX CONCURRENTLY idx_team_messages_team_id ON team_messages(team_id)' },
    { name: 'idx_team_messages_target_team_id', sql: 'CREATE INDEX CONCURRENTLY idx_team_messages_target_team_id ON team_messages(target_team_id)' },
    { name: 'idx_team_messages_user_id', sql: 'CREATE INDEX CONCURRENTLY idx_team_messages_user_id ON team_messages(user_id)' },
    { name: 'idx_murder_board_items_team_id', sql: 'CREATE INDEX CONCURRENTLY idx_murder_board_items_team_id ON murder_board_items(team_id)' },
    { name: 'idx_murder_board_connections_team_id', sql: 'CREATE INDEX CONCURRENTLY idx_murder_board_connections_team_id ON murder_board_connections(team_id)' },
    { name: 'idx_team_messages_team_created', sql: 'CREATE INDEX CONCURRENTLY idx_team_messages_team_created ON team_messages(team_id, created_at DESC)' },
    { name: 'idx_clues_team_created', sql: 'CREATE INDEX CONCURRENTLY idx_clues_team_created ON clues(team_id, created_at)' },
    { name: 'idx_team_badges_team_awarded', sql: 'CREATE INDEX CONCURRENTLY idx_team_badges_team_awarded ON team_badges(team_id, awarded_at DESC)' },
    { name: 'idx_users_team_captain_created', sql: 'CREATE INDEX CONCURRENTLY idx_users_team_captain_created ON users(team_id, is_captain DESC, created_at)' },
    { name: 'idx_users_online', sql: 'CREATE INDEX CONCURRENTLY idx_users_online ON users(online) WHERE online = TRUE' },
    { name: 'idx_users_last_activity', sql: 'CREATE INDEX CONCURRENTLY idx_users_last_activity ON users(last_activity)' },
    { name: 'idx_team_messages_admin', sql: "CREATE INDEX CONCURRENTLY idx_team_messages_admin ON team_messages(created_at DESC) WHERE target_team_id = 'admin'" },
    { name: 'idx_characters_visible', sql: 'CREATE INDEX CONCURRENTLY idx_characters_visible ON characters(name) WHERE visible_to_teams = TRUE' }
];

async function runMigration() {
    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected!\n');

        console.log(`📝 Creating ${indexes.length} indexes...\n`);

        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        for (let i = 0; i < indexes.length; i++) {
            const { name, sql } = indexes[i];
            process.stdout.write(`[${i + 1}/${indexes.length}] ${name}... `);

            try {
                await client.query(sql);
                console.log('✅');
                successCount++;
            } catch (err) {
                if (err.message.includes('already exists')) {
                    console.log('⚠️  (already exists)');
                    skipCount++;
                } else {
                    console.log(`❌ ${err.message.split('\n')[0]}`);
                    errorCount++;
                }
            }

            // Small delay to avoid overwhelming database
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Add unique constraint
        console.log('\n📝 Adding unique constraint...');
        try {
            await client.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'unique_team_badge'
                    ) THEN
                        ALTER TABLE team_badges ADD CONSTRAINT unique_team_badge UNIQUE (team_id, badge_id);
                    END IF;
                END $$;
            `);
            console.log('✅ unique_team_badge constraint added');
        } catch (err) {
            console.log(`⚠️  Constraint: ${err.message.split('\n')[0]}`);
        }

        // VACUUM ANALYZE
        console.log('\n📝 Running VACUUM ANALYZE...');
        const tables = ['clues', 'team_badges', 'users', 'team_messages', 'murder_board_items', 'murder_board_connections', 'characters'];
        for (const table of tables) {
            try {
                await client.query(`VACUUM ANALYZE ${table}`);
                console.log(`✅ ${table}`);
            } catch (err) {
                console.log(`❌ ${table}: ${err.message}`);
            }
        }

        console.log(`\n📊 ========== MIGRATION COMPLETE ==========`);
        console.log(`✅ Created: ${successCount}`);
        console.log(`⚠️  Already Exists: ${skipCount}`);
        console.log(`❌ Errors: ${errorCount}`);

        // Verify indexes
        const indexResult = await client.query(`
            SELECT COUNT(*) as count
            FROM pg_indexes
            WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
        `);
        console.log(`\n🔍 Total indexes: ${indexResult.rows[0].count}`);
        console.log(`==========================================\n`);

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        await client.end();
        console.log('🔌 Disconnected');
    }
}

runMigration();
