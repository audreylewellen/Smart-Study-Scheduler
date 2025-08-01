from fastapi import HTTPException, Request, Header
from backend.db.database import supabase
import os
import time

SUPABASE_PROJECT_ID = os.environ["SUPABASE_PROJECT_ID"]

def verify_supabase_jwt(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        # Use Supabase client to verify the token
        result = supabase.auth.get_user(token)
        if hasattr(result, "user") and result.user is not None:
            return result.user.id
        else:
            print("No user found in result")  
            raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        print(f"Verification error: {e}") 
        if "Server disconnected" in str(e):
            print("[DEBUG] Retrying get_user after server disconnect...")
            time.sleep(0.5)
            try:
                result = supabase.auth.get_user(token)
                if hasattr(result, "user") and result.user is not None:
                    return result.user.id
                else:
                    print("No user found in result (retry)")  
                    raise HTTPException(status_code=401, detail="Invalid token (retry)")
            except Exception as e2:
                print(f"Verification retry error: {e2}")
                raise HTTPException(status_code=401, detail=f"Token verification failed after retry: {str(e2)}")
        if "expired" in str(e).lower():
            raise HTTPException(status_code=401, detail="Token expired. Please log in again.")
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")

async def login_user(request: Request):
    data = await request.json()
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required.")
    try:
        result = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        if hasattr(result, "session") and result.session is not None:
            # Return both access_token and refresh_token to the frontend
            return {
                "token": result.session.access_token,
                "refresh_token": result.session.refresh_token,
                "user": {
                    "id": result.user.id,
                    "email": result.user.email
                }
            }
        elif hasattr(result, "message") and result.message:
            raise HTTPException(status_code=400, detail=str(result.message))
        else:
            raise HTTPException(status_code=400, detail="Invalid email or password.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def signup_user(request: Request):
    data = await request.json()
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required.")
    try:
        result = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True  
        })
        if hasattr(result, "user") and result.user is not None:
            return {"message": "Signup successful. You can now log in."}
        elif hasattr(result, "message") and result.message:
            raise HTTPException(status_code=400, detail=str(result.message))
        else:
            raise HTTPException(status_code=400, detail="Unknown error during signup.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def refresh_user_token(request: Request):
    raise HTTPException(status_code=501, detail="Token refresh not supported in backend. Use frontend Supabase JS client for refresh.") 