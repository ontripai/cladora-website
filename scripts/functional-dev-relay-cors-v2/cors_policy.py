"""Closed browser transport policy. Origin is never Auth/DB authority."""
ORIGINS=frozenset(('http://127.0.0.1:3000','http://localhost:3000','http://localhost:3008'))
METHODS=frozenset(('GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'))
REQUEST_HEADERS=frozenset(('authorization','apikey','content-type','accept','accept-profile',
 'content-profile','prefer','range','if-match','x-upsert','x-client-info','origin',
 'access-control-request-method','access-control-request-headers','x-supabase-api-version'))
PREFLIGHT_HEADERS=REQUEST_HEADERS-frozenset(('origin','access-control-request-method','access-control-request-headers'))


def preflight(origin,method,headers):
 """None means ordinary request; False fails before forwarding OPTIONS."""
 if method is None:return None
 if origin not in ORIGINS or method not in METHODS-{'OPTIONS'}:return False
 names=[x.strip().lower() for x in (headers or '').split(',')] if headers else []
 return len(names)==len(set(names)) and all(x in PREFLIGHT_HEADERS for x in names)


def response_headers(origin,method=None,headers=None):
 if origin not in ORIGINS:return []
 result=[('Access-Control-Allow-Origin',origin),('Vary','Origin')]
 if method is not None and preflight(origin,method,headers):
  result.append(('Access-Control-Allow-Methods',method))
  if headers:result.append(('Access-Control-Allow-Headers',', '.join(x.strip().lower() for x in headers.split(','))))
 return result
