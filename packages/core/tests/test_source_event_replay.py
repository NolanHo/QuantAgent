from __future__ import annotations

from datetime import UTC, datetime, timedelta
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from quantagent.core.db.base import Base
from quantagent.core.db.models.raw_event import RawEventORM
from quantagent.core.db.models.raw_event_capture import RawEventCaptureORM
from quantagent.core.replay.source_event_replay import _select_targets


class SourceEventReplayTargetSelectionTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.session = Session(self.engine)

    def tearDown(self) -> None:
        self.session.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_replay_all_selects_latest_capture_per_raw_event(self) -> None:
        base_time = datetime(2026, 6, 18, 8, 0, tzinfo=UTC)
        self._raw_event("raw_1", "old and new captures")
        self._capture("cap_1_old", "raw_1", base_time)
        self._capture("cap_1_new", "raw_1", base_time + timedelta(minutes=1))
        self._raw_event("raw_2", "single capture")
        self._capture("cap_2", "raw_2", base_time + timedelta(minutes=2))
        self.session.commit()

        targets = _select_targets(
            session=self.session,
            raw_event_ids=[],
            capture_ids=[],
            binding_id=None,
            replay_all=True,
            limit=20,
        )

        self.assertEqual([item.raw_event.raw_event_id for item in targets], ["raw_2", "raw_1"])
        self.assertEqual([item.capture.capture_id for item in targets], ["cap_2", "cap_1_new"])

    def test_explicit_capture_id_keeps_capture_level_selection(self) -> None:
        base_time = datetime(2026, 6, 18, 8, 0, tzinfo=UTC)
        self._raw_event("raw_1", "old and new captures")
        self._capture("cap_1_old", "raw_1", base_time)
        self._capture("cap_1_new", "raw_1", base_time + timedelta(minutes=1))
        self.session.commit()

        targets = _select_targets(
            session=self.session,
            raw_event_ids=[],
            capture_ids=["cap_1_old"],
            binding_id=None,
            replay_all=False,
            limit=20,
        )

        self.assertEqual([item.capture.capture_id for item in targets], ["cap_1_old"])

    def _raw_event(self, raw_event_id: str, title: str) -> None:
        now = datetime(2026, 6, 18, 8, 0, tzinfo=UTC)
        self.session.add(
            RawEventORM(
                raw_event_id=raw_event_id,
                source_plugin_id="quantagent.official.source.rss",
                external_id=raw_event_id,
                canonical_url=f"https://example.com/{raw_event_id}",
                title=title,
                content="content",
                first_captured_at=now,
                last_captured_at=now,
                raw_payload={},
                metadata_json={},
                canonical_dedupe_key=f"dedupe_{raw_event_id}",
                dedupe_strategy="url",
                first_binding_id=None,
                first_run_id=None,
            )
        )

    def _capture(self, capture_id: str, raw_event_id: str, captured_at: datetime) -> None:
        self.session.add(
            RawEventCaptureORM(
                capture_id=capture_id,
                raw_event_id=raw_event_id,
                source_plugin_id="quantagent.official.source.rss",
                source_binding_id=None,
                scheduler_run_id=None,
                capture_dedupe_key=f"dedupe_{capture_id}",
                capture_status="captured",
                captured_at=captured_at,
                request_id=f"request_{capture_id}",
                metadata_json={},
            )
        )


if __name__ == "__main__":
    unittest.main()
