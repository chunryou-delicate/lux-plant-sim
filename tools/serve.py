#!/usr/bin/env python
"""
에셋 미리보기용 정적 서버.

기본 http.server는 단일 스레드라 대용량 GLB를 동시에 여러 개 요청하면
뒤쪽 요청이 대기하다 끊긴다(뷰어에서 캔버스가 에러색으로 뜸).
또 GLB를 교체해도 브라우저가 캐시된 옛 파일을 재사용한다.

  - ThreadingHTTPServer 로 동시 요청 처리
  - no-store 헤더로 캐시 무효화
  - .glb MIME 지정

사용법: python serve.py [포트] [디렉터리]
"""
import sys
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".glb": "model/gltf-binary",
        ".gltf": "model/gltf+json",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # 대용량 파일 요청만 간결히 기록
        if args and "GET" in str(args[0]) and ".glb" in str(args[0]):
            sys.stderr.write("%s %s\n" % (self.address_string(), args[0]))

    def handle_one_request(self):
        """★ 클라이언트가 먼저 끊어도 서버가 죽지 않게.

        헤드리스 Chrome 을 --virtual-time-budget 만료로 강제 종료시키면 응답을
        쓰던 중에 소켓이 끊기고 ConnectionResetError(WinError 10054) 가 난다.
        기본 구현은 이걸 안 잡아서 프로세스째 내려갔다 — 측정 도구를 돌릴 때마다
        서버가 죽었다. 상대가 끊은 건 오류가 아니므로 조용히 넘긴다.
        """
        try:
            super().handle_one_request()
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            self.close_connection = True


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8780
    root = sys.argv[2] if len(sys.argv) > 2 else os.getcwd()
    srv = ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=root))
    srv.daemon_threads = True
    print(f"serving {root} on http://127.0.0.1:{port}  (threading, no-cache)")
    srv.serve_forever()


if __name__ == "__main__":
    main()
