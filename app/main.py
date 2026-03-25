from __future__ import annotations
import os
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

templates = Jinja2Templates(directory="app/templates")

def create_app() -> FastAPI:
    app = FastAPI(title="mesh.me", version="0.1.0")
    app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")

    @app.get("/", response_class=HTMLResponse)
    def landing(request: Request):
        return templates.TemplateResponse("landing.html", {"request": request, "minimal": True})

    @app.get("/signup", response_class=HTMLResponse)
    def signup(request: Request):
        return templates.TemplateResponse("signup.html", {"request": request, "minimal": True, "error": None})

    return app

app = create_app()
