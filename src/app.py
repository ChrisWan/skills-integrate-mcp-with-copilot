"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

import hashlib
import json
import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr

app = FastAPI(
    title="Mergington High School API",
    description="API for viewing and signing up for extracurricular activities",
)

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount(
    "/static",
    StaticFiles(directory=current_dir / "static"),
    name="static",
)

users_file = current_dir / "users.json"
sessions: dict[str, str] = {}

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"],
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"],
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"],
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"],
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"],
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"],
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"],
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"],
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"],
    },
}


def ensure_users_file() -> None:
    if not users_file.exists():
        users_file.write_text("[]", encoding="utf-8")


def load_users() -> list[dict]:
    ensure_users_file()
    with open(users_file, "r", encoding="utf-8") as f:
        return json.load(f)


def save_users(users: list[dict]) -> None:
    with open(users_file, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2)


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def find_user_by_username(username: str) -> Optional[dict]:
    users = load_users()
    return next((user for user in users if user["username"] == username), None)


def find_user_by_email(email: str) -> Optional[dict]:
    users = load_users()
    return next((user for user in users if user["email"] == email), None)


def authenticate_user(username: str, password: str) -> Optional[dict]:
    user = find_user_by_username(username)
    if not user:
        return None
    return user if user["password"] == hash_password(password) else None


def generate_token() -> str:
    return uuid.uuid4().hex


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.split(" ", 1)[1]
    username = sessions.get(token)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = find_user_by_username(username)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session user")

    return user


def require_admin(user: dict) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str


class LoginRequest(BaseModel):
    username: str
    password: str


class ActivityCreateRequest(BaseModel):
    description: str
    schedule: str
    max_participants: int


@app.get("/")
def root() -> RedirectResponse:
    return RedirectResponse(url="/static/index.html")


@app.post("/register")
def register(payload: RegisterRequest) -> dict:
    if payload.role not in {"student", "admin"}:
        raise HTTPException(status_code=400, detail="Role must be 'student' or 'admin'")

    if find_user_by_username(payload.username):
        raise HTTPException(status_code=400, detail="Username already exists")

    if find_user_by_email(payload.email):
        raise HTTPException(status_code=400, detail="Email already exists")

    users = load_users()
    users.append(
        {
            "username": payload.username,
            "email": payload.email,
            "password": hash_password(payload.password),
            "role": payload.role,
        }
    )
    save_users(users)
    return {"message": "Registration successful"}


@app.post("/login")
def login(payload: LoginRequest) -> dict:
    user = authenticate_user(payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = generate_token()
    sessions[token] = user["username"]
    return {
        "token": token,
        "user": {
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
        },
    }


@app.get("/me")
def me(user: dict = Depends(get_current_user)) -> dict:
    return {"username": user["username"], "email": user["email"], "role": user["role"]}


@app.get("/activities")
def get_activities() -> dict:
    return activities


@app.post("/activities/{activity_name}")
def create_activity(activity_name: str, payload: ActivityCreateRequest, user: dict = Depends(get_current_user)) -> dict:
    require_admin(user)
    if activity_name in activities:
        raise HTTPException(status_code=400, detail="Activity already exists")

    activities[activity_name] = {
        "description": payload.description,
        "schedule": payload.schedule,
        "max_participants": payload.max_participants,
        "participants": [],
    }
    return {"message": f"Created activity {activity_name}"}


@app.delete("/activities/{activity_name}")
def delete_activity(activity_name: str, user: dict = Depends(get_current_user)) -> dict:
    require_admin(user)
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    del activities[activity_name]
    return {"message": f"Deleted activity {activity_name}"}


@app.get("/activities/{activity_name}/participants")
def get_activity_participants(activity_name: str, user: dict = Depends(get_current_user)) -> dict:
    require_admin(user)
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    return {"participants": activities[activity_name]["participants"]}


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(
    activity_name: str,
    user: dict = Depends(get_current_user),
    email: Optional[EmailStr] = None,
) -> dict:
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    activity = activities[activity_name]
    if user["role"] == "student":
        email = user["email"]
    elif not email:
        raise HTTPException(status_code=400, detail="Admin must provide student email")

    if email in activity["participants"]:
        raise HTTPException(status_code=400, detail="Student is already signed up")

    if len(activity["participants"]) >= activity["max_participants"]:
        raise HTTPException(status_code=400, detail="Activity is full")

    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(
    activity_name: str,
    user: dict = Depends(get_current_user),
    email: Optional[EmailStr] = None,
) -> dict:
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    activity = activities[activity_name]
    if user["role"] == "student":
        email = user["email"]
    elif not email:
        raise HTTPException(status_code=400, detail="Admin must provide student email")

    if email not in activity["participants"]:
        raise HTTPException(status_code=400, detail="Student is not signed up for this activity")

    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
