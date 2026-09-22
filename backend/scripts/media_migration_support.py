"""Standalone PostgreSQL and R2 adapters for the offline media migration."""

from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote
from uuid import UUID


def _environment(name: str) -> str:
    return os.environ.get(f"MISA_{name}") or os.environ.get(name) or ""


@dataclass(frozen=True)
class MigrationSettings:
    database_url: str
    r2_endpoint: str
    r2_bucket: str
    r2_access_key_id: str
    r2_secret_access_key: str
    r2_public_base_url: str

    @classmethod
    def from_environment(cls) -> MigrationSettings:
        return cls(
            database_url=os.environ.get("DATABASE_URL") or os.environ.get("MISA_DATABASE_URL") or "",
            r2_endpoint=_environment("R2_ENDPOINT"),
            r2_bucket=_environment("R2_BUCKET"),
            r2_access_key_id=_environment("R2_ACCESS_KEY_ID"),
            r2_secret_access_key=_environment("R2_SECRET_ACCESS_KEY"),
            r2_public_base_url=_environment("R2_PUBLIC_BASE_URL"),
        )


class R2Storage:
    def __init__(self, settings: MigrationSettings):
        self.settings = settings

    @property
    def enabled(self) -> bool:
        return bool(
            self.settings.r2_endpoint
            and self.settings.r2_bucket
            and self.settings.r2_access_key_id
            and self.settings.r2_secret_access_key
            and self.settings.r2_public_base_url
        )

    def public_url(self, key: str) -> str:
        return f"{self.settings.r2_public_base_url.rstrip('/')}/{quote(key, safe='/')}"

    async def put(self, key: str, body: bytes, content_type: str) -> None:
        def write() -> None:
            import boto3
            from botocore.config import Config

            boto3.client(
                "s3",
                endpoint_url=self.settings.r2_endpoint,
                aws_access_key_id=self.settings.r2_access_key_id,
                aws_secret_access_key=self.settings.r2_secret_access_key,
                region_name="auto",
                config=Config(signature_version="s3v4", max_pool_connections=4),
            ).put_object(
                Bucket=self.settings.r2_bucket,
                Key=key,
                Body=body,
                ContentType=content_type,
                CacheControl="public, max-age=31536000, immutable",
            )

        await asyncio.to_thread(write)


class MediaMigrationDatabase:
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.pool: Any = None

    async def open(self) -> None:
        import asyncpg

        self.pool = await asyncpg.create_pool(
            self.database_url,
            min_size=1,
            max_size=4,
            command_timeout=30,
            max_inactive_connection_lifetime=30,
        )

    async def close(self) -> None:
        if self.pool is not None:
            await self.pool.close()
            self.pool = None

    async def list_profiles_for_media_migration(
        self, after_user_id: str | None = None, limit: int = 100
    ) -> list[dict[str, Any]]:
        batch_size = max(1, min(int(limit), 500))
        if after_user_id:
            rows = await self.pool.fetch(
                "SELECT user_id::text AS user_id, config FROM profiles "
                "WHERE user_id > $1 ORDER BY user_id LIMIT $2",
                UUID(after_user_id),
                batch_size,
            )
        else:
            rows = await self.pool.fetch(
                "SELECT user_id::text AS user_id, config FROM profiles "
                "ORDER BY user_id LIMIT $1",
                batch_size,
            )
        profiles = []
        for row in rows:
            config = row["config"]
            if isinstance(config, str):
                config = json.loads(config)
            profiles.append({"user_id": row["user_id"], "config": config})
        return profiles

    async def replace_profile_config_for_media_migration(
        self,
        user_id: str,
        expected_config: dict[str, Any],
        updated_config: dict[str, Any],
    ) -> bool:
        result = await self.pool.execute(
            "UPDATE profiles SET config = $3::jsonb, updated_at = NOW() "
            "WHERE user_id = $1 AND config = $2::jsonb",
            UUID(user_id),
            json.dumps(expected_config),
            json.dumps(updated_config),
        )
        return result == "UPDATE 1"
