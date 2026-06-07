"""plugin config values

Revision ID: 20260607_0001
Revises: 20260605_0001
Create Date: 2026-06-07 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260607_0001"
down_revision = "20260605_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plugin_configs",
        sa.Column("plugin_id", sa.String(length=255), nullable=False),
        sa.Column("values", sa.JSON(), nullable=False),
        sa.Column("encrypted_values", sa.JSON(), nullable=False),
        sa.Column("masked_paths", sa.JSON(), nullable=False),
        sa.Column("version_tag", sa.String(length=64), nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("plugin_id"),
    )


def downgrade() -> None:
    op.drop_table("plugin_configs")
