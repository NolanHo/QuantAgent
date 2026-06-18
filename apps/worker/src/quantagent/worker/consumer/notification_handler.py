from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from quantagent.core.events import EventBusPublisher, EventEnvelope
from quantagent.core.notifications import NotificationDispatchService, NotificationEventPublisher, NotificationRequestedHandler
from quantagent.core.registry import PluginRegistry
from quantagent.core.runtime import PluginRuntimeService


@dataclass(frozen=True)
class WorkerNotificationDispatchConfig:
    enabled: bool
    plugin_id: str
    plugin_config: Mapping[str, Any]
    channel: str = "discord"


class WorkerNotificationRequestedHandler:
    def __init__(
        self,
        *,
        registry: PluginRegistry,
        runtime: PluginRuntimeService,
        publisher: EventBusPublisher,
        config: WorkerNotificationDispatchConfig,
    ) -> None:
        self._handler = NotificationRequestedHandler(
            dispatch_service=NotificationDispatchService(
                registry=registry,
                runtime=runtime,
                enabled=config.enabled,
                config=config.plugin_config,
            ),
            event_publisher=NotificationEventPublisher(publisher),
            plugin_id=config.plugin_id,
            channel=config.channel,
        )

    async def handle(self, envelope: EventEnvelope) -> None:
        await self._handler.handle(envelope)
