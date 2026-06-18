from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from dataclasses import dataclass

from sqlalchemy.orm import Session

from quantagent.core.events import EventBusPublisher, EventEnvelope
from quantagent.core.notifications import NotificationEventPublisher, NotificationRequestedHandler
from quantagent.core.notifications.sender import NotificationDispatchService
from quantagent.core.plugin_config import PluginConfigService, PluginConfigServiceError
from quantagent.core.registry import PluginRegistry
from quantagent.core.runtime import PluginRuntimeService

logger = logging.getLogger(__name__)

DISCORD_NOTIFICATION_PLUGIN_ID = "quantagent.official.notification.discord"
DISCORD_WEBHOOK_URL_PATH = "webhook_url"

SessionFactory = Callable[[], Session]


@dataclass(frozen=True)
class WorkerNotificationDispatchConfig:
    enabled: bool = True
    plugin_id: str = DISCORD_NOTIFICATION_PLUGIN_ID
    channel: str = "discord"
    encryption_key: str | None = None


@dataclass
class WorkerNotificationRequestedHandler:
    session_factory: SessionFactory
    publisher: EventBusPublisher
    registry: PluginRegistry
    runtime: PluginRuntimeService
    config: WorkerNotificationDispatchConfig

    async def handle(self, envelope: EventEnvelope) -> None:
        dispatch_service = self._build_dispatch_service()
        handler = NotificationRequestedHandler(
            dispatch_service=dispatch_service,
            event_publisher=NotificationEventPublisher(self.publisher),
            plugin_id=self.config.plugin_id,
            channel=self.config.channel,
        )
        await handler.handle(envelope)

    def _build_dispatch_service(self) -> NotificationDispatchService:
        return NotificationDispatchService(
            registry=self.registry,
            runtime=self.runtime,
            enabled=self.config.enabled,
            config=self._plugin_runtime_config() if self.config.enabled else {},
        )

    def _plugin_runtime_config(self) -> Mapping[str, object]:
        session = self.session_factory()
        try:
            webhook_url = PluginConfigService(
                session,
                encryption_key=self.config.encryption_key,
            ).resolve_secret(plugin_id=self.config.plugin_id, path=DISCORD_WEBHOOK_URL_PATH)
        except PluginConfigServiceError as exc:
            logger.warning(
                "Discord notification plugin config unavailable: code=%s details=%s",
                exc.code,
                exc.safe_details,
            )
            webhook_url = None
        finally:
            session.close()

        if not webhook_url:
            return {}
        # 敏感值只在内存里交给插件 runtime；不写入 event、transcript 或日志。
        return {"webhook_url": webhook_url}
