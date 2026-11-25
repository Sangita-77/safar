"""Preview launcher only: starts the Node.js backend (/app/backend-node) and forwards /api to it.
All app logic lives in Node.js; this file exists because the preview pod's supervisor runs uvicorn on :8001."""

import asyncio
import http.cookiejar
import os
import subprocess
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

NODE_DIR = ROOT_DIR.parent / "backend-node"
NODE_ENTRY = str(NODE_DIR / "server.js")
NODE_PORT = os.environ.get("NODE_BACKEND_PORT", "8002")
HOP = {"host", "connection", "keep-alive", "content-length", "transfer-encoding", "te", "trailer", "upgrade",
       "proxy-authorization", "proxy-authenticate", "content-encoding"}

app = FastAPI()


class _NoCookies(http.cookiejar.CookieJar):
    """Never keep upstream cookies: the proxy is shared by every visitor."""

    def set_cookie(self, cookie):
        pass

    def extract_cookies(self, response, request):
        pass


@app.on_event("startup")
async def start_node():
    subprocess.run(["pkill", "-f", NODE_ENTRY], check=False)
    env = {**os.environ, "PORT": NODE_PORT, "HOST": "127.0.0.1"}
    app.state.node = subprocess.Popen(["node", "--watch", NODE_ENTRY], cwd=NODE_DIR, env=env)
    app.state.http = httpx.AsyncClient(base_url=f"http://127.0.0.1:{NODE_PORT}", timeout=60, cookies=httpx.Cookies(_NoCookies()))


@app.on_event("shutdown")
async def stop_node():
    await app.state.http.aclose()
    app.state.node.terminate()


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def forward(path: str, request: Request):
    headers = [(k, v) for k, v in request.headers.items() if k.lower() not in HOP]
    host = request.headers.get("host", "")
    if host and "x-forwarded-host" not in request.headers:
        headers.append(("x-forwarded-host", host))
    body = await request.body()
    for _ in range(40):  # Node may still be booting right after a restart
        try:
            upstream = await app.state.http.request(request.method, f"/api/{path}", params=request.query_params.multi_items(),
                                                    headers=headers, content=body)
            break
        except httpx.ConnectError:
            await asyncio.sleep(0.5)
    else:
        return Response(status_code=502)
    response = Response(content=upstream.content, status_code=upstream.status_code)
    for k, v in upstream.headers.multi_items():
        if k.lower() not in HOP:
            response.raw_headers.append((k.encode(), v.encode()))
    return response
