from __future__ import annotations

import asyncio
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from quantagent.api.config.settings import Settings
from quantagent.api.demo import discord_approval_smoke
from quantagent.api.main import create_app


class DiscordApprovalSmokeDemoTestCase(unittest.TestCase):
    def _settings(self) -> Settings:
        return Settings(
            _env_file=None,
            APP_ENV="development",
            DATABASE_URL=None,
            AUTH_ENABLED=False,
            NOTIFICATION_INGRESS_ENABLED=False,
            NOTIFICATION_INGRESS_PLUGIN_ID="",
            NOTIFICATION_INGRESS_PLUGIN_CONFIG={},
        )

    def test_regular_api_does_not_expose_fullflow_debug_route(self) -> None:
        with TestClient(create_app(self._settings())) as client:
            response = client.get("/api/v1/debug/fullflow")

        self.assertEqual(response.status_code, 404)

    def test_smoke_app_exposes_debug_route_only_for_harness(self) -> None:
        harness = discord_approval_smoke.DiscordApprovalSmokeHarness(
            repo_root=Path.cwd(),
            approval_id="approval-fullflow",
            action_id="action-fullflow",
        )
        asyncio.run(harness.seed_and_send())

        app = discord_approval_smoke.build_app(settings=self._settings(), harness=harness)
        with TestClient(app) as client:
            response = client.get("/api/v1/debug/fullflow")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["approval_id"], "approval-fullflow")
        self.assertEqual(payload["approval_status"], "pending")
        self.assertEqual(payload["notification_completed_count"], 1)
        self.assertEqual(payload["notification_completed_payloads"][0]["code"], "LOCAL_SMOKE_SENT")


if __name__ == "__main__":
    unittest.main()
