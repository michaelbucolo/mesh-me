# mesh.me

FastAPI MVP with a sleek animated landing page (mesh threads) + signup.

## Run (Windows CMD)
```bat
cd %USERPROFILE%\Downloads\mesh.me
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

Open:
- http://127.0.0.1:8000
- http://127.0.0.1:8000/signup

## Push to GitHub
Create a repo named `mesh.me`, then:
```bat
cd %USERPROFILE%\Downloads\mesh.me
git init
git add .
git commit -m "Initial mesh.me MVP"
git branch -M main
git remote add origin https://github.com/YOURUSER/mesh.me.git
git push -u origin main
```
