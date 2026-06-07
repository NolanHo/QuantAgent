from __future__ import annotations

from sqlalchemy.orm import Session

from quantagent.core.db.models.plugin_config import PluginConfigORM


class PluginConfigRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get(self, plugin_id: str) -> PluginConfigORM | None:
        return self._session.get(PluginConfigORM, plugin_id)

    def save(self, row: PluginConfigORM) -> PluginConfigORM:
        self._session.add(row)
        self._session.flush()
        return row
