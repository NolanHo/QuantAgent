from __future__ import annotations

from unittest import TestCase

from quantagent.agent.artifacts import InMemoryArtifactStore


class ArtifactStoreTest(TestCase):
    def test_artifact_store_returns_id_first_ref(self) -> None:
        store = InMemoryArtifactStore()

        ref = store.put(
            kind="runtime_output",
            producer_id="agent_test",
            payload={"value": "raw"},
            content="raw artifact content",
        )

        self.assertTrue(ref.artifact_id.startswith("artifact_"))
        self.assertEqual(ref.content, "raw artifact content")
        self.assertEqual(store.get(ref.artifact_id).payload, {"value": "raw"})
        self.assertEqual(store.list_for_run(), [ref])
