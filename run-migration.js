const { Client } = require('pg');
const fs = require('fs');

// SECURITY: Never hardcode database credentials
// Set DATABASE_URL environment variable before running this script
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function runMigration() {
    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected!\n');

        const sql = fs.readFileSync('migrations/001_add_performance_indexes.sql', 'utf8');

        // Split by semicolon and filter empty statements
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s && !s.startsWith('/*') && !s.startsWith('--'));

        console.log(`📝 Running ${statements.length} SQL statements...\n`);

        let successCount = 0;
        let skipCount = 0;

        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];

            // Skip comments
            if (stmt.startsWith('/*') || stmt.length < 10) continue;

            const preview = stmt.substring(0, 60).replace(/\s+/g, ' ');
            process.stdout.write(`[${i + 1}/${statements.length}] ${preview}... `);

            try {
                const result = await client.query(stmt);

                if (stmt.includes('SELECT') && result.rows) {
                    console.log(`✅ (${result.rows.length} rows)`);
                } else {
                    console.log('✅');
                }
                successCount++;
            } catch (err) {
                if (err.message.includes('already exists')) {
                    console.log('⚠️  (already exists)');
                    skipCount++;
                } else {
                    console.log(`❌ ERROR: ${err.message}`);
                }
            }
        }

        console.log(`\n📊 Migration Complete!`);
        console.log(`✅ Success: ${successCount}`);
        console.log(`⚠️  Skipped: ${skipCount}`);
        console.log(`❌ Failed: ${statements.length - successCount - skipCount}`);

        // Verify indexes
        const indexResult = await client.query(`
            SELECT COUNT(*) as count
            FROM pg_indexes
            WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
        `);
        console.log(`\n🔍 Total indexes created: ${indexResult.rows[0].count}`);

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        await client.end();
        console.log('\n🔌 Disconnected');
    }
}

runMigration();
