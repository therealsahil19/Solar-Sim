const fs = require('fs');
try {
    let content = fs.readFileSync('vitest_out.json');
    // Handle BOM for UTF-16LE
    if (content[0] === 0xFF && content[1] === 0xFE) {
        content = content.toString('utf16le');
    } else {
        content = content.toString('utf8');
    }
    const out = JSON.parse(content);
    out.testResults.forEach(suite => {
        suite.assertionResults.forEach(test => {
            if (test.status === 'failed') {
                console.log('FAIL:', test.title);
                test.failureMessages.forEach(msg => console.log(msg));
            }
        });
    });
} catch (e) {
    console.log(e);
}
