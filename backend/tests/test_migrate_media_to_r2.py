import base64
import copy
import unittest

from scripts.migrate_media_to_r2 import (
    R2_URL_PREFIX,
    json_path,
    object_key,
    replace_paths,
    scan_profile_document,
)


def data_url(mime: str, body: bytes) -> str:
    return f"data:{mime};base64,{base64.b64encode(body).decode()}"


class MediaMigrationTests(unittest.TestCase):
    def test_recursively_finds_assets_tracks_portfolio_and_other_nested_media(self) -> None:
        profile = {
            "config": {
                "profile": {"displayName": "Misa", "description": "unchanged"},
                "settings": {"layout": "Modern"},
                "assets": {
                    "avatar": {"url": data_url("image/jpeg", b"avatar")},
                    "backgroundVideo": {"url": data_url("video/mp4", b"video")},
                    "tracks": [{
                        "id": "track-1",
                        "audio": {"url": data_url("audio/mpeg", b"audio")},
                        "artwork": {"url": data_url("image/png", b"art")},
                    }],
                    "futureNestedMedia": {"preview": {"url": data_url("image/webp", b"future")}},
                },
                "sections": [{"id": "project-1", "cover": {"url": data_url("image/png", b"cover")}}],
            }
        }
        before = copy.deepcopy(profile)
        scan = scan_profile_document(profile)

        self.assertEqual(len(scan.candidates), 6)
        self.assertEqual(profile, before)
        paths = {json_path(candidate.path) for candidate in scan.candidates}
        self.assertIn("$.config.assets.avatar.url", paths)
        self.assertIn("$.config.assets.tracks[0].audio.url", paths)
        self.assertIn("$.config.sections[0].cover.url", paths)

    def test_replaces_only_selected_values_and_preserves_every_other_field(self) -> None:
        original = {
            "profile": {"displayName": "Misa"},
            "settings": {"layout": "Sleek"},
            "socials": [{"id": "github", "value": "github.com/misa"}],
            "assets": {"avatar": {"url": data_url("image/png", b"avatar"), "name": "me.png"}},
            "widgets": [{"id": "weather", "city": "Tokyo"}],
        }
        scan = scan_profile_document(original)
        updated = replace_paths(original, [(scan.candidates[0].path, R2_URL_PREFIX + "avatar.png")])

        expected = copy.deepcopy(original)
        expected["assets"]["avatar"]["url"] = R2_URL_PREFIX + "avatar.png"
        self.assertEqual(updated, expected)
        self.assertNotEqual(updated, original)

    def test_already_migrated_and_unsupported_values_are_skipped(self) -> None:
        profile = {
            "assets": {
                "avatar": {"url": R2_URL_PREFIX + "profiles/u/avatar.png"},
                "unsafe": {"url": data_url("application/pdf", b"pdf")},
            }
        }
        scan = scan_profile_document(profile)
        self.assertEqual(scan.candidates, [])
        self.assertEqual(scan.already_r2, 1)
        self.assertEqual(scan.unsupported_data_urls, 1)

    def test_key_is_deterministic_and_user_scoped(self) -> None:
        scan = scan_profile_document({"assets": {"cursor": {"url": data_url("image/png", b"same")}}})
        key_a = object_key("user-a", scan.candidates[0])
        key_b = object_key("user-a", scan.candidates[0])
        key_other_user = object_key("user-b", scan.candidates[0])
        self.assertEqual(key_a, key_b)
        self.assertNotEqual(key_a, key_other_user)
        self.assertTrue(key_a.startswith("profiles/user-a/legacy/image/"))

    def test_invalid_base64_is_reported_without_replacement(self) -> None:
        scan = scan_profile_document({"assets": {"avatar": {"url": "data:image/png;base64,!!!"}}})
        self.assertEqual(scan.candidates, [])
        self.assertEqual(len(scan.invalid_data_urls), 1)


if __name__ == "__main__":
    unittest.main()
