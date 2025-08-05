const https = require('https');

// Test OpenFDA API
const url = 'https://api.fda.gov/drug/label.json?search=openfda.brand_name:"abilify"&limit=1';

console.log('Testing OpenFDA API...');
https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.results && json.results[0]) {
                const result = json.results[0];
                console.log('✅ OpenFDA Results:');
                console.log('Generic name:', result.openfda?.generic_name?.[0] || 'Not found');
                console.log('Brand name:', result.openfda?.brand_name?.[0] || 'Not found');

                if (result.indications_and_usage) {
                    console.log('Raw indication:', result.indications_and_usage[0].substring(0, 200));

                    // Test our simple extraction
                    const indication = result.indications_and_usage[0]
                        .replace(/<[^>]+>/g, '')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&amp;/g, '&')
                        .replace(/\s+/g, ' ')
                        .trim();

                    const conditionsMatch = indication.match(/treatment of:\s*(.+?)(?:\.|$)/i);
                    if (conditionsMatch) {
                        console.log('✅ Extracted condition:', conditionsMatch[1]);
                    } else {
                        console.log('⚠️ Could not extract condition from:', indication.substring(0, 100));
                    }
                }
            } else {
                console.log('❌ No results found');
            }
        } catch (e) {
            console.error('❌ Parse error:', e.message);
        }
    });
}).on('error', err => console.error('❌ Request error:', err.message));
