from typing import Any

import httpx

from app.models import User

_client: httpx.AsyncClient | None = None


class DataConflict(Exception):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


async def init_data_api(base_url: str, api_key: str) -> None:
    global _client
    headers = {"Accept": "application/json"}
    if api_key:
        headers["X-Data-Key"] = api_key
    _client = httpx.AsyncClient(base_url=base_url.rstrip("/"), headers=headers, timeout=10.0)
    response = await _client.get("/health")
    response.raise_for_status()


async def close_data_api() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
    _client = None


def _client_or_raise() -> httpx.AsyncClient:
    if _client is None:
        raise RuntimeError("prostgres_db is not initialised")
    return _client


async def _request(method: str, path: str, **kwargs: Any) -> dict | None:
    response = await _client_or_raise().request(method, path, **kwargs)
    if response.status_code == 404:
        return None
    if response.status_code == 409:
        payload = response.json() if response.content else {}
        raise DataConflict(str(payload.get("error") or "conflict"))
    response.raise_for_status()
    if not response.content:
        return None
    return response.json()


async def get_user(user_id: str) -> User | None:
    payload = await _request("GET", f"/v1/users/{user_id}")
    return User.from_api(payload) if payload else None


async def find_user(**filters: str | None) -> User | None:
    params = {key: value for key, value in filters.items() if value}
    payload = await _request("GET", "/v1/users", params=params)
    return User.from_api(payload) if payload else None


async def create_user(**fields: Any) -> User:
    payload = await _request("POST", "/v1/users", json=fields)
    if payload is None:
        raise RuntimeError("prostgres_db did not return a user")
    return User.from_api(payload)


async def update_user(user_id: str, **fields: Any) -> User | None:
    payload = await _request("PATCH", f"/v1/users/{user_id}", json=fields)
    return User.from_api(payload) if payload else None


async def delete_user(user_id: str) -> bool:
    response = await _client_or_raise().delete(f"/v1/users/{user_id}")
    if response.status_code == 404:
        return False
    response.raise_for_status()
    return True


async def touch_login(user_id: str) -> User | None:
    return await update_user(user_id, touch_login=True)


async def get_profile(user_id: str) -> dict | None:
    return await _request("GET", f"/v1/profiles/{user_id}")


async def save_profile(user_id: str, config: dict) -> dict:
    payload = await _request("PUT", f"/v1/profiles/{user_id}", json={"config": config})
    if payload is None:
        raise RuntimeError("prostgres_db did not return a profile")
    return payload


async def oauth_upsert(
    *,
    provider: str,
    provider_id: str,
    email: str | None = None,
    email_verified: bool = False,
    display_name: str | None = None,
    avatar_url: str | None = None,
    telegram_username: str | None = None,
    current_user_id: str | None = None,
) -> User:
    payload = await _request(
        "POST",
        "/v1/users/oauth",
        json={
            "provider": provider,
            "provider_id": provider_id,
            "email": email,
            "email_verified": email_verified,
            "display_name": display_name,
            "avatar_url": avatar_url,
            "telegram_username": telegram_username,
            "current_user_id": current_user_id,
        },
    )
    if payload is None:
        raise RuntimeError("prostgres_db did not return a user")
    return User.from_api(payload)
