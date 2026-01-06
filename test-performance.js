const { Client } = require('pg');

// SECURITY: Never hardcode database credentials
// Set DATABASE_URL environment variable before running this script
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function testPerformance() {
    await client.connect();
    console.log('🔍 Testing Query Performance with Indexes\n');

    // Test 1: getAllTeams() query (en kritik)
    console.log('📊 Test 1: getAllTeams() Query');
    const start1 = Date.now();
    const result1 = await client.query(`
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
    `);
    const time1 = Date.now() - start1;
    console.log(`   Teams found: ${result1.rows.length}`);
    console.log(`   ⚡ Time: ${time1}ms`);
    console.log(`   ${time1 < 50 ? '✅ EXCELLENT' : time1 < 100 ? '✅ GOOD' : '⚠️  SLOW'}\n`);

    // Test 2: getUsersByTeam() query
    console.log('📊 Test 2: Users by Team Query');
    const start2 = Date.now();
    const result2 = await client.query(`
        SELECT u.*, t.name as team_name
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE u.team_id IS NOT NULL
        ORDER BY u.team_id, u.is_captain DESC, u.created_at;
    `);
    const time2 = Date.now() - start2;
    console.log(`   Users found: ${result2.rows.length}`);
    console.log(`   ⚡ Time: ${time2}ms`);
    console.log(`   ${time2 < 30 ? '✅ EXCELLENT' : time2 < 50 ? '✅ GOOD' : '⚠️  SLOW'}\n`);

    // Test 3: Index usage verification
    console.log('📊 Test 3: Verify Index Usage (EXPLAIN)');
    const explain = await client.query(`
        EXPLAIN (ANALYZE, BUFFERS)
        SELECT * FROM clues WHERE team_id = (SELECT id FROM teams LIMIT 1);
    `);
    const usesIndex = explain.rows.some(r => r['QUERY PLAN'].includes('Index Scan'));
    console.log(`   Uses index: ${usesIndex ? '✅ YES' : '❌ NO'}`);
    if (usesIndex) {
        const indexLine = explain.rows.find(r => r['QUERY PLAN'].includes('idx_'));
        if (indexLine) console.log(`   Index: ${indexLine['QUERY PLAN'].match(/idx_[a-z_]+/)?.[0]}`);
    }
    console.log();

    // Summary
    console.log('========================================');
    console.log('📈 PERFORMANCE SUMMARY');
    console.log('========================================');
    console.log(`getAllTeams(): ${time1}ms ${time1 < 100 ? '✅' : '⚠️'}`);
    console.log(`getUsersByTeam(): ${time2}ms ${time2 < 50 ? '✅' : '⚠️'}`);
    console.log(`Index Usage: ${usesIndex ? '✅ Active' : '❌ Not Used'}`);
    console.log();

    const avgTime = (time1 + time2) / 2;
    if (avgTime < 50) {
        console.log('🎉 EXCELLENT - Ready for 100+ users!');
    } else if (avgTime < 100) {
        console.log('✅ GOOD - Performance acceptable');
    } else {
        console.log('⚠️  SLOW - May need optimization');
    }
    console.log('========================================\n');

    await client.end();
}

testPerformance().catch(console.error);
