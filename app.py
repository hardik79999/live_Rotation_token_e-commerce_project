# eventlet.monkey_patch() MUST be the very first thing that runs —
# before any other import — so it can replace the standard library's
# socket, threading, and ssl modules with async-friendly versions.
# Moving it even one line down (e.g. after 'import os') breaks WebSockets.
import eventlet
eventlet.monkey_patch()

from shop import create_app          # noqa: E402  (import after monkey-patch is intentional)
from shop.extensions import socketio  # noqa: E402
import os                             # noqa: E402

app = create_app()

if __name__ == '__main__':
    host  = os.environ.get('FLASK_HOST',  '0.0.0.0')
    port  = int(os.environ.get('FLASK_PORT', 7899))
    debug = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
    socketio.run(app, host=host, port=port, debug=debug)
