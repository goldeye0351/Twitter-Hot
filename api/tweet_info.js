const https = require('https');

const setCorsHeaders = (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

module.exports = (req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { id } = req.query;

    if (!id) {
        res.status(400).json({ error: 'missing_id' });
        return;
    }

    const url = `https://api.vxtwitter.com/Twitter/status/${id}`;

    const request = https.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (response) => {
        let data = '';

        response.on('data', (chunk) => {
            data += chunk;
        });

        response.on('end', () => {
            // Check content type or try to parse JSON
            const contentType = response.headers['content-type'];
            if (contentType && !contentType.includes('application/json')) {
                 console.error('Upstream returned non-JSON content type:', contentType);
                 res.status(502).json({ error: 'upstream_invalid_response', details: 'Upstream returned non-JSON' });
                 return;
            }

            try {
                // Verify it is valid JSON
                JSON.parse(data);
                
                // Forward the status code and data
                res.status(response.statusCode);
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
                res.send(data);
            } catch (e) {
                console.error('Failed to parse upstream response as JSON:', data.substring(0, 100));
                res.status(502).json({ error: 'upstream_invalid_json', details: 'Upstream returned invalid JSON' });
            }
        });
    });

    request.on('error', (error) => {
        console.error('Proxy Request Error:', error);
        res.status(500).json({ error: 'proxy_error', details: error.message });
    });
};
