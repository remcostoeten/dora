import http.server, socketserver, sys, os
root, port = sys.argv[1], int(sys.argv[2])
os.chdir(root)
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
Server(('127.0.0.1', port), Handler).serve_forever()
