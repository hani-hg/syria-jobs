import unittest
from types import SimpleNamespace
from unittest.mock import patch

import bot


class FakeQuery:
    def __init__(self, client, table_name):
        self.client = client
        self.table_name = table_name
        self.operation = None
        self.payload = None
        self.filters = {}

    def select(self, columns):
        self.operation = "select"
        return self

    def insert(self, payload):
        self.operation = "insert"
        self.payload = payload
        return self

    def update(self, payload):
        self.operation = "update"
        self.payload = payload
        return self

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def execute(self):
        if self.table_name == "job_submissions" and self.operation == "select":
            if self.client.fail_job_select:
                raise RuntimeError("simulated job_submissions read failure")
            return SimpleNamespace(data=[{"id": "existing-job"}] if self.client.duplicate else [])
        if self.table_name == "job_submissions" and self.operation == "insert":
            self.client.inserted_jobs.append(self.payload)
            return SimpleNamespace(data=[self.payload])
        if self.table_name == "telegram_delivery_log" and self.operation == "update":
            self.client.delivery_updates.append((self.payload, self.filters))
            return SimpleNamespace(data=[])
        raise AssertionError(f"Unexpected query: {self.table_name} {self.operation}")


class FakeRPC:
    def __init__(self, rows):
        self.rows = rows

    def execute(self):
        return SimpleNamespace(data=self.rows)


class FakeSupabase:
    def __init__(self, claim_rows, duplicate=True, fail_job_select=False):
        self.claim_rows = list(claim_rows)
        self.duplicate = duplicate
        self.fail_job_select = fail_job_select
        self.inserted_jobs = []
        self.delivery_updates = []
        self.rpc_calls = []

    def table(self, table_name):
        return FakeQuery(self, table_name)

    def rpc(self, function_name, params):
        self.rpc_calls.append((function_name, params))
        rows = self.claim_rows.pop(0)
        return FakeRPC(rows)


def sample_job():
    return {
        "title": "إعلان وظيفة تجريبي",
        "company": "من قناة source_channel",
        "governorate": "سوريا",
        "field": "عام",
        "type": "خاص",
        "deadline": "2026-12-09",
        "description": "وصف إعلان اختبار محلي، لا يتصل بأي خدمة خارجية.",
        "source": "https://t.me/source_channel/123",
        "status": "pending",
        "_telegram_delivery_key": "telegram:source_channel/123",
    }


class TelegramDeliveryTests(unittest.TestCase):
    def test_source_message_id_is_the_stable_identity(self):
        key, url = bot.make_delivery_identity("source_channel", "source_channel/123", "body")
        self.assertEqual(key, "telegram:source_channel/123")
        self.assertEqual(url, "https://t.me/source_channel/123")

    def test_fallback_identity_normalizes_whitespace(self):
        first = bot.make_delivery_identity("source_channel", None, "two\n  lines")
        second = bot.make_delivery_identity("source_channel", None, "two lines")
        self.assertEqual(first, second)
        self.assertTrue(first[0].startswith("sha256:"))

    def test_non_json_telegram_response_is_not_counted_as_sent(self):
        class BadResponse:
            ok = True
            status_code = 200
            text = "not-json"

            def json(self):
                raise ValueError("invalid JSON")

        with patch.object(bot, "BOT_TOKEN", "test-token"), patch.object(
            bot.requests, "post", return_value=BadResponse()
        ):
            result = bot.send_to_telegram("title", "body", "https://t.me/channel/1")

        self.assertFalse(result["ok"])
        self.assertIn("not-json", result["error"])

    def test_network_error_redacts_telegram_token(self):
        token = "test-token-secret"
        network_error = RuntimeError(f"failed URL /bot{token}/sendMessage")
        with patch.object(bot, "BOT_TOKEN", token), patch.object(
            bot.requests, "post", side_effect=network_error
        ):
            result = bot.send_to_telegram("title", "body", "https://t.me/channel/1")

        self.assertFalse(result["ok"])
        self.assertNotIn(token, result["error"])
        self.assertIn("[REDACTED]", result["error"])

    def test_duplicate_job_submission_is_still_sent_once(self):
        client = FakeSupabase(claim_rows=[[{"claimed": True}]], duplicate=True)
        with patch.object(bot, "supabase", client), patch.object(
            bot,
            "send_to_telegram",
            return_value={"ok": True, "message_id": 456, "error": None},
        ) as sender:
            summary = bot.save_to_supabase([sample_job()])

        self.assertEqual(summary["duplicates"], 1)
        self.assertEqual(summary["telegram_sent"], 1)
        self.assertEqual(summary["telegram_skipped"], 0)
        self.assertEqual(client.inserted_jobs, [])
        sender.assert_called_once()
        self.assertEqual(client.delivery_updates[0][0]["status"], "sent")

    def test_new_job_is_inserted_without_internal_delivery_key(self):
        client = FakeSupabase(claim_rows=[[{"claimed": True}]], duplicate=False)
        with patch.object(bot, "supabase", client), patch.object(
            bot,
            "send_to_telegram",
            return_value={"ok": True, "message_id": 654, "error": None},
        ):
            summary = bot.save_to_supabase([sample_job()])

        self.assertEqual(summary["added"], 1)
        self.assertEqual(len(client.inserted_jobs), 1)
        self.assertNotIn("_telegram_delivery_key", client.inserted_jobs[0])

    def test_existing_delivery_claim_skips_a_later_send(self):
        client = FakeSupabase(claim_rows=[[]], duplicate=True)
        with patch.object(bot, "supabase", client), patch.object(bot, "send_to_telegram") as sender:
            summary = bot.save_to_supabase([sample_job()])

        self.assertEqual(summary["telegram_sent"], 0)
        self.assertEqual(summary["telegram_skipped"], 1)
        sender.assert_not_called()

    def test_failed_telegram_send_is_recorded_and_can_be_retried(self):
        client = FakeSupabase(
            claim_rows=[[{"claimed": True}], [{"claimed": True}]], duplicate=True
        )
        send_results = [
            {"ok": False, "message_id": None, "error": "simulated Telegram rejection"},
            {"ok": True, "message_id": 999, "error": None},
        ]
        with patch.object(bot, "supabase", client), patch.object(
            bot, "send_to_telegram", side_effect=send_results
        ) as sender:
            with self.assertRaisesRegex(RuntimeError, "Telegram send"):
                bot.save_to_supabase([sample_job()])
            summary = bot.save_to_supabase([sample_job()])

        self.assertEqual(summary["telegram_sent"], 1)
        self.assertEqual([entry[0]["status"] for entry in client.delivery_updates], ["failed", "sent"])
        self.assertEqual(sender.call_count, 2)

    def test_job_table_failure_does_not_gate_telegram_attempt(self):
        client = FakeSupabase(claim_rows=[[{"claimed": True}]], fail_job_select=True)
        with patch.object(bot, "supabase", client), patch.object(
            bot,
            "send_to_telegram",
            return_value={"ok": True, "message_id": 789, "error": None},
        ) as sender:
            with self.assertRaisesRegex(RuntimeError, "database operation"):
                bot.save_to_supabase([sample_job()])

        sender.assert_called_once()
        self.assertEqual(client.delivery_updates[0][0]["status"], "sent")


if __name__ == "__main__":
    unittest.main()
