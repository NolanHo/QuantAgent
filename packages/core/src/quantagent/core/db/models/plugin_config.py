from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import DateTime, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from quantagent.core.db.base import Base


class PluginConfigORM(Base):
    __tablename__ = "plugin_configs"

    plugin_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    values: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    encrypted_values: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    masked_paths: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    version_tag: Mapped[str] = mapped_column(String(64), nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
