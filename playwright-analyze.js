const fs = require('fs');
const content = fs.readFileSync('playwright-report-utf8.json', 'utf8').replace(/^\uFEFF/, '');
const data = JSON.parse(content);
const fails = [];

data.suites.forEach(sx => {
    const sxFails = [];
    sx.suites?.forEach(s => {
        s.specs?.forEach(sp => {
            const f = sp.tests.flatMap(t => t.results).filter(r => r.status !== 'passed' && r.status !== 'skipped');
            if(f.length) sxFails.push(sp.title);
        });
    });
    sx.specs?.forEach(sp => {
        const f = sp.tests.flatMap(t => t.results).filter(r => r.status !== 'passed' && r.status !== 'skipped');
        if(f.length) sxFails.push(sp.title);
    });
    if(sxFails.length) {
        console.log(`\n=== ${sx.title} ===`);
        sxFails.forEach(t => console.log(`  - ${t}`));
    }
});
