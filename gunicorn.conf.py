# Server socket
bind = "0.0.0.0:8000"

# Worker processes
workers = 4
worker_class = "gevent"
worker_connections = 1000

# Timeouts
timeout = 120
keepalive = 5
graceful_timeout = 30

# Worker recycling
max_requests = 1000
max_requests_jitter = 50

# Preloading
preload_app = True

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "sear-pos"

# Server mechanics
tmp_upload_dir = None


def on_starting(server):
    """Called just before the master process is initialized."""
    server.log.info("Sear POS master process starting")


def post_fork(server, worker):
    """Called just after a worker has been forked."""
    server.log.info(f"Worker spawned (pid: {worker.pid})")


def pre_exec(server):
    """Called just before a new master process is forked."""
    server.log.info("Forked child, re-executing.")


def when_ready(server):
    """Called just after the server is started."""
    server.log.info("Server is ready. Spawning workers")


def worker_int(worker):
    """Called when a worker receives the INT or QUIT signal."""
    worker.log.info("worker received INT or QUIT signal")


def worker_abort(worker):
    """Called when a worker receives the SIGABRT signal (timeout)."""
    worker.log.info("worker received SIGABRT signal")
