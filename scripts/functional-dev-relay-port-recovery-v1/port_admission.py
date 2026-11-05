"""Exact listener-shaped admission. No process, HTTP request, or DB access."""
from contextlib import contextmanager
import errno
import socket
import time


class PortFailure(RuntimeError):
    def __init__(self, stage, host, port, number, message):
        super().__init__(message)
        self.detail = dict(stage=stage, host=host, port=port, errno=number,
                           message=message)


@contextmanager
def listeners(specs):
    """Hold *all* probes together; close the failed socket and every prior one.

    Address family, stream type, protocol, SO_REUSEADDR and backlog match the
    reviewed Python3.12 listener implementation. SO_REUSEPORT is never set.
    Passing is admission at this instant, never a child/startup ACK.
    """
    held = []
    held_specs = []
    primary = None
    try:
        for spec in specs:
            host, port = spec['host'], spec['port']
            stage = 'probe.socket'
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM, 0)
                held.append(sock)
                held_specs.append(spec)
                stage = 'probe.options'
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                if hasattr(socket, 'SO_REUSEPORT'):
                    if sock.getsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT):
                        raise PortFailure(stage, host, port, None,
                                          'SO_REUSEPORT_MUST_REMAIN_DISABLED')
                stage = 'probe.bind'
                sock.bind((host, port))
                stage = 'probe.listen'
                sock.listen(spec['backlog'])
            except OSError as error:
                raise PortFailure(stage, host, port, error.errno,
                                  error.strerror or type(error).__name__) from error
        yield held
    except BaseException as error:
        primary = error
        raise
    finally:
        failures = []
        for sock, location in reversed(list(zip(held, held_specs))):
            try:
                sock.close()
            except OSError as error:
                failures.append(dict(host=location['host'], port=location['port'],
                                     errno=error.errno, message=str(error)))
        if failures:
            if primary is not None:
                primary.probe_cleanup_errors = failures
            else:
                error = PortFailure('probe.close', failures[0]['host'], failures[0]['port'],
                                    failures[0]['errno'], 'PROBE_CLOSE_UNKNOWN')
                error.probe_cleanup_errors = failures
                raise error


def wait_admission(specs, seconds, current, *, clock=time.monotonic,
                   pause=time.sleep):
    """Bounded readiness polling only; never retry process creation/dispatch.

    Only EADDRINUSE is allowed to settle until the fixed deadline. Every failed
    iteration releases all sockets. Expired currentness, another errno, or the
    deadline stops before child creation. The successful probes also close.
    """
    deadline = clock() + seconds
    first = None
    attempts = 0
    while True:
        current()
        attempts += 1
        try:
            with listeners(specs):
                current()
                if clock() > deadline:
                    raise PortFailure('probe.deadline', specs[-1]['host'],
                                      specs[-1]['port'], None,
                                      'PORT_RELEASE_DEADLINE_EXHAUSTED')
            return dict(state='ADMITTED_NOT_STARTUP_ACK', attempts=attempts,
                        first_transient=None if first is None else first.detail)
        except PortFailure as error:
            first = first or error
            if getattr(error, 'probe_cleanup_errors', None):
                first.probe_cleanup_errors = error.probe_cleanup_errors
            remaining = deadline - clock()
            if (getattr(error, 'probe_cleanup_errors', None) or
                    error.detail['errno'] != errno.EADDRINUSE or remaining <= 0):
                # Keep the first obstruction; the caller records deadline and
                # last observation separately without losing primary identity.
                first.last_detail = error.detail
                first.deadline_exhausted = remaining <= 0
                raise first
            pause(min(.1, remaining))
