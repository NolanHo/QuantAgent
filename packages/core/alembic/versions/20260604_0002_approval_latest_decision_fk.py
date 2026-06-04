"""approval latest decision foreign key

Revision ID: 20260604_0002
Revises: 20260604_0001
Create Date: 2026-06-04
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260604_0002"
down_revision: str | Sequence[str] | None = "20260604_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_CONSTRAINT_NAME = "fk_approval_requests_latest_decision_record_id"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {fk.get("name") for fk in inspector.get_foreign_keys("approval_requests")}
    if _CONSTRAINT_NAME in existing:
        return
    op.create_foreign_key(
        _CONSTRAINT_NAME,
        "approval_requests",
        "approval_decisions",
        ["latest_decision_record_id"],
        ["record_id"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {fk.get("name") for fk in inspector.get_foreign_keys("approval_requests")}
    if _CONSTRAINT_NAME not in existing:
        return
    op.drop_constraint(
        _CONSTRAINT_NAME,
        "approval_requests",
        type_="foreignkey",
    )
