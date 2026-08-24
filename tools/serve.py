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

    # ★ 밖으로 열 때(--lan · 터널) 절대 나가면 안 되는 것들.
    #   .git 은 커밋 내력 전체이고 자격증명이 섞일 수 있다. 나머지는 그냥 안 줘도 되는 것.
    #   (2026-08-23: 박사님이 밖에서 여실 링크를 만들며 넣었다)
    BLOCK = (".git", ".env", "node_modules", ".venv", "__pycache__")

    def send_head(self):
        parts = [p for p in self.path.split("?")[0].split("#")[0].split("/") if p]
        if any(p in self.BLOCK or p.startswith(".env") for p in parts):
            self.send_error(403, "blocked")
            return None
        return super().send_head()

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


def lan_ips():
    """이 컴퓨터가 같은 와이파이에서 어떤 주소로 보이는지. 폰으로 들어올 때 쓴다."""
    out = []
    try:
        import socket
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith(("127.", "169.254.")) and ip not in out:
                out.append(ip)
    except Exception:
        pass
    return out


def main():
    """기본은 127.0.0.1 이다. 폰으로 볼 때만 --host 0.0.0.0 으로 연다.

    ⚠ 0.0.0.0 은 **같은 네트워크 아무나** 이 폴더를 읽을 수 있다는 뜻이다.
      저장소 전체가 열리므로 집 와이파이에서 잠깐 쓰고 끄는 용도다.
      기본값을 바꾸지 않는 이유가 그것이다 — 열려면 명시적으로 적어야 한다.
    """
    args = [a for a in sys.argv[1:]]
    host = "127.0.0.1"
    if "--host" in args:
        i = args.index("--host")
        host = args[i + 1] if i + 1 < len(args) else "0.0.0.0"
        del args[i:i + 2]
    if "--lan" in args:                      # --host 0.0.0.0 의 줄임
        host = "0.0.0.0"
        args.remove("--lan")

    port = int(args[0]) if len(args) > 0 else 8780
    root = args[1] if len(args) > 1 else os.getcwd()
    srv = ThreadingHTTPServer((host, port), partial(Handler, directory=root))
    srv.daemon_threads = True
    print(f"serving {root} on http://{host}:{port}  (threading, no-cache)")
    if host == "0.0.0.0":
        for ip in lan_ips():
            print(f"  폰에서는  http://{ip}:{port}/game.html")
        print("  ⚠ 같은 네트워크에 이 폴더가 열려 있습니다. 다 보고 나면 끄세요.")
    srv.serve_forever()


if __name__ == "__main__":
    # ★ cp949 콘솔에서는 ⚠ 같은 글자 하나가 print 를 죽이고, 그러면 serve_forever 에
    #   닿기 전에 서버가 통째로 내려간다. 안내문 때문에 서버가 죽는 건 말이 안 된다.
    #   (2026-08-23: --lan 으로 띄우다 UnicodeEncodeError 로 즉사 — 실제로 겪었다)
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    main()
