#!/usr/bin/env python
"""한 커밋 시점 그대로 내주는 시험 서버(총괄).

  python serve_rev.py <코드 복사본 폴더> <커밋> <포트> <기록 파일>

- src/ tools/ data/ game.html plant_grow.html 은 복사본(git archive <커밋>)에서 낸다.
- 그 밖(에셋)은 작업 트리에서 내되, <커밋> 과 다른 파일(남의 미완료)은 git show <커밋>:<경로> 로 낸다.
- <커밋> 에 없는 파일을 청하면 내주되 기록에 UNTRACKED 로 남긴다.
- 127.0.0.1 만 · ThreadingHTTPServer · 대기열 넉넉히 · no-store.
"""
import os, sys, subprocess, threading, time, urllib.parse, shutil
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

W = 'C:/Users/pc/Desktop/빛식물/lux-plant-sim'
V, REV, PORT, LOG = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
CODE_TOP = {'src', 'tools', 'data'}
CODE_FILES = {'game.html', 'plant_grow.html'}
MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
    '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
    '.ktx2': 'image/ktx2', '.hdr': 'application/octet-stream', '.wasm': 'application/wasm',
    '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
    '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.txt': 'text/plain; charset=utf-8',
}
BLOCK = {'.git', '.env', 'node_modules', '.venv', '__pycache__', '.claude'}


def git(*a):
    return subprocess.run(['git', '--no-optional-locks', '-C', W] + list(a), capture_output=True).stdout


tracked = set(git('ls-tree', '-r', '--name-only', '-z', REV).decode('utf-8').split('\0')) - {''}
dirty = set()
lock = threading.Lock()
blob = {}
stats = {'copy': 0, 'wt': 0, 'rev': 0, 'untracked': 0, '404': 0}
logf = open(LOG, 'a', encoding='utf-8')


def log(s):
    with lock:
        logf.write(time.strftime('%H:%M:%S ') + s + '\n'); logf.flush()


def refresh():
    while True:
        try:
            d = set(git('diff', '--name-only', '-z', REV).decode('utf-8').split('\0')) - {''}
            with lock:
                dirty.clear(); dirty.update(d)
        except Exception as e:
            log('refresh 오류 ' + repr(e))
        time.sleep(10)


class H(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, fmt, *args):
        pass

    def do_HEAD(self):
        self.serve(False)

    def do_GET(self):
        self.serve(True)

    def send_bytes(self, data, ctype, body):
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.end_headers()
        if body:
            self.wfile.write(data)

    def send_file(self, fp, ctype, body):
        size = os.path.getsize(fp)
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(size))
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.end_headers()
        if body:
            with open(fp, 'rb') as f:
                shutil.copyfileobj(f, self.wfile, 1 << 20)

    def nf(self, rel, why):
        stats['404'] += 1
        log('404 ' + why + ' ' + rel)
        msg = b'not found'
        self.send_response(404)
        self.send_header('Content-Type', 'text/plain')
        self.send_header('Content-Length', str(len(msg)))
        self.end_headers()
        self.wfile.write(msg)

    def serve(self, body):
        try:
            rel = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path).lstrip('/')
            if rel == '':
                rel = 'index.html'
            parts = rel.split('/')
            if any(x == '..' or x in BLOCK or x.startswith('.env') for x in parts):
                self.send_error(403, 'blocked'); return
            ctype = MIME.get(os.path.splitext(rel)[1].lower(), 'application/octet-stream')
            if parts[0] in CODE_TOP or rel in CODE_FILES:
                fp = os.path.join(V, rel)
                if os.path.isfile(fp):
                    stats['copy'] += 1
                    return self.send_file(fp, ctype, body)
                return self.nf(rel, '(코드 · 커밋에 없음)')
            with lock:
                isdirty = rel in dirty
            if isdirty and rel in tracked:
                data = blob.get(rel)
                if data is None:
                    data = git('show', REV + ':' + rel)
                    blob[rel] = data
                stats['rev'] += 1
                return self.send_bytes(data, ctype, body)
            fp = os.path.join(W, rel)
            if os.path.isfile(fp):
                if rel in tracked:
                    stats['wt'] += 1
                else:
                    stats['untracked'] += 1
                    log('UNTRACKED ' + rel)
                return self.send_file(fp, ctype, body)
            return self.nf(rel, '(에셋)')
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            pass


class S(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 256


if __name__ == '__main__':
    threading.Thread(target=refresh, daemon=True).start()
    time.sleep(0.5)

    def report():
        while True:
            time.sleep(60)
            log('stats ' + repr(stats))
    threading.Thread(target=report, daemon=True).start()
    log('serve %s rev=%s port=%d tracked=%d' % (V, REV, PORT, len(tracked)))
    S(('127.0.0.1', PORT), H).serve_forever()
