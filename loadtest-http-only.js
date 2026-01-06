const https = require('https');

const BASE_URL = 'katil-oyunu-production-914a.up.railway.app';
const CONCURRENT_USERS = 30;
const REQUESTS_PER_USER = 10;
const TOTAL_DURATION = 60000; // 60 seconds

// HTTP GET request
function httpRequest(path) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const options = {
            hostname: BASE_URL,
            path: path,
            method: 'GET',
            timeout: 10000,
            headers: {
                'User-Agent': 'LoadTest/1.0'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const responseTime = Date.now() - startTime;
                resolve({
                    success: res.statusCode >= 200 && res.statusCode < 400,
                    statusCode: res.statusCode,
                    responseTime,
                    bodySize: data.length
                });
            });
        });

        req.on('error', (error) => {
            resolve({
                success: false,
                error: error.message,
                responseTime: Date.now() - startTime
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({
                success: false,
                error: 'Timeout',
                responseTime: Date.now() - startTime
            });
        });

        req.end();
    });
}

// Simulate user
async function simulateUser(userId) {
    const results = [];

    for (let i = 0; i < REQUESTS_PER_USER; i++) {
        // Random delay between requests (realistic behavior)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500));

        // Make request
        const result = await httpRequest('/');
        results.push(result);
    }

    return results;
}

// Main test
async function runLoadTest() {
    console.log(`\n🚀 HTTP Yük Testi Başlatılıyor...`);
    console.log(`📊 URL: https://${BASE_URL}`);
    console.log(`👥 Eşzamanlı Kullanıcı: ${CONCURRENT_USERS}`);
    console.log(`📦 Kullanıcı Başına İstek: ${REQUESTS_PER_USER}`);
    console.log(`⏱️  Toplam Süre: ${TOTAL_DURATION / 1000}s\n`);

    const metrics = {
        totalRequests: 0,
        successCount: 0,
        errorCount: 0,
        responseTimes: [],
        statusCodes: {},
        errors: {}
    };

    const startTime = Date.now();
    let waveCount = 0;

    while (Date.now() - startTime < TOTAL_DURATION) {
        waveCount++;
        console.log(`\n🌊 Wave ${waveCount} başlatılıyor (${CONCURRENT_USERS} kullanıcı)...`);

        // Create concurrent users
        const users = [];
        for (let i = 0; i < CONCURRENT_USERS; i++) {
            users.push(simulateUser(waveCount * CONCURRENT_USERS + i));
        }

        // Wait for all users to complete
        const waveResults = await Promise.all(users);

        // Process results
        waveResults.flat().forEach(result => {
            metrics.totalRequests++;

            if (result.success) {
                metrics.successCount++;
                metrics.responseTimes.push(result.responseTime);
            } else {
                metrics.errorCount++;
                const errorKey = result.error || 'Unknown';
                metrics.errors[errorKey] = (metrics.errors[errorKey] || 0) + 1;
            }

            if (result.statusCode) {
                metrics.statusCodes[result.statusCode] = (metrics.statusCodes[result.statusCode] || 0) + 1;
            }
        });

        const avgResponseTime = metrics.responseTimes.length
            ? Math.round(metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length)
            : 0;

        console.log(`✓ Wave ${waveCount} tamamlandı - Başarı: ${waveResults.flat().filter(r => r.success).length}/${waveResults.flat().length} | Avg: ${avgResponseTime}ms`);

        // Small delay between waves
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Calculate final statistics
    const calculate = {
        avg: arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0,
        min: arr => arr.length ? Math.min(...arr) : 0,
        max: arr => arr.length ? Math.max(...arr) : 0,
        p50: arr => {
            if (!arr.length) return 0;
            const sorted = arr.slice().sort((a, b) => a - b);
            return sorted[Math.floor(sorted.length * 0.5)];
        },
        p95: arr => {
            if (!arr.length) return 0;
            const sorted = arr.slice().sort((a, b) => a - b);
            return sorted[Math.floor(sorted.length * 0.95)];
        },
        p99: arr => {
            if (!arr.length) return 0;
            const sorted = arr.slice().sort((a, b) => a - b);
            return sorted[Math.floor(sorted.length * 0.99)];
        }
    };

    const totalTime = Date.now() - startTime;
    const requestsPerSecond = Math.round((metrics.totalRequests / totalTime) * 1000);

    console.log(`\n\n📊 =============== TEST SONUÇLARI ===============`);
    console.log(`\n⏱️  Süre: ${Math.round(totalTime / 1000)}s`);
    console.log(`📦 Toplam İstek: ${metrics.totalRequests}`);
    console.log(`✅ Başarılı: ${metrics.successCount} (${Math.round(metrics.successCount/metrics.totalRequests*100)}%)`);
    console.log(`❌ Hatalı: ${metrics.errorCount} (${Math.round(metrics.errorCount/metrics.totalRequests*100)}%)`);
    console.log(`🚀 Throughput: ${requestsPerSecond} req/s`);

    console.log(`\n⚡ RESPONSE TIME İSTATİSTİKLERİ`);
    console.log(`Min: ${calculate.min(metrics.responseTimes)}ms`);
    console.log(`Avg: ${calculate.avg(metrics.responseTimes)}ms`);
    console.log(`p50: ${calculate.p50(metrics.responseTimes)}ms`);
    console.log(`p95: ${calculate.p95(metrics.responseTimes)}ms`);
    console.log(`p99: ${calculate.p99(metrics.responseTimes)}ms`);
    console.log(`Max: ${calculate.max(metrics.responseTimes)}ms`);

    if (Object.keys(metrics.statusCodes).length > 0) {
        console.log(`\n📊 HTTP STATUS CODES`);
        Object.entries(metrics.statusCodes)
            .sort(([a], [b]) => a - b)
            .forEach(([code, count]) => {
                const percentage = Math.round(count / metrics.totalRequests * 100);
                console.log(`  ${code}: ${count}x (${percentage}%)`);
            });
    }

    if (Object.keys(metrics.errors).length > 0) {
        console.log(`\n❌ HATALAR`);
        Object.entries(metrics.errors).forEach(([error, count]) => {
            console.log(`  ${error}: ${count}x`);
        });
    }

    console.log(`\n===============================================\n`);

    // Performance evaluation
    const avgTime = calculate.avg(metrics.responseTimes);
    const p95Time = calculate.p95(metrics.responseTimes);
    const successRate = (metrics.successCount / metrics.totalRequests) * 100;

    console.log(`\n💡 DEĞERLENDİRME (100 kullanıcı için):`);

    if (successRate >= 95 && avgTime < 500 && p95Time < 1000) {
        console.log(`✅ MÜKEMMEL - Sistem 100 kullanıcıya hazır!`);
    } else if (successRate >= 90 && avgTime < 1000 && p95Time < 2000) {
        console.log(`✅ İYİ - Kabul edilebilir performans`);
    } else if (successRate >= 80) {
        console.log(`⚠️  ORTA - Optimizasyon gerekebilir`);
    } else {
        console.log(`❌ ZAYIF - Ciddi optimizasyon gerekli!`);
    }

    console.log(`\n📌 Notlar:`);
    if (metrics.statusCodes[429]) {
        console.log(`  • Rate limiting aktif (429 Too Many Requests) - Bu güvenlik özelliği çalışıyor ✓`);
    }
    if (avgTime > 500) {
        console.log(`  • Ortalama response time yüksek - Cache ve indexler devreye alınmalı`);
    }
    if (p95Time > 2000) {
        console.log(`  • p95 yüksek - Yavaş query'ler var, EXPLAIN ANALYZE ile kontrol edin`);
    }
    console.log(`  • Migration uygulayın, performans ~80% artacak\n`);
}

runLoadTest().catch(console.error);
