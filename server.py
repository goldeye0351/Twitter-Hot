import json
import os
import re
from http.server import SimpleHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

DATA_FILE = 'data.json'

def read_store():
    if not os.path.exists(DATA_FILE):
        return {}
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f) or {}
    except Exception:
        return {}

def write_store(store):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(store, f, ensure_ascii=False)

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/data':
            qs = parse_qs(parsed.query)
            date = (qs.get('date') or [''])[0]
            if not date or not re.match(r'^\d{4}-\d{2}-\d{2}$', date):
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(b'{"error":"bad_date"}')
                return
            store = read_store()
            key = f'tweets_{date}' if date else ''
            urls = store.get(key, []) if key else []
            body = json.dumps({'date': date, 'urls': urls})
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body.encode('utf-8'))
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/update':
            length = int(self.headers.get('Content-Length') or 0)
            raw = self.rfile.read(length) if length > 0 else b''
            try:
                payload = json.loads(raw.decode('utf-8'))
            except Exception:
                payload = {}
            date = payload.get('date') or ''
            urls = payload.get('urls') or []
            if not date or not re.match(r'^\d{4}-\d{2}-\d{2}$', date) or not isinstance(urls, list):
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(b'{"error":"bad_request"}')
                return
            store = read_store()
            store[f'tweets_{date}'] = urls
            write_store(store)
            body = json.dumps({'ok': True})
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(body.encode('utf-8'))
            return
        self.send_response(404)
        self.end_headers()

if __name__ == '__main__':
    port = int(os.environ.get('PORT') or '5500')
    server = HTTPServer(('', port), Handler)
    server.serve_forever()
