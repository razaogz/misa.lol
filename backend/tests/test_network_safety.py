import unittest

from app.core.network_safety import safe_public_url
from app.core.profile_sanitize import public_social_href


class NetworkSafetyTests(unittest.TestCase):
    def test_rejects_local_private_and_metadata_addresses(self) -> None:
        rejected = (
            "http://localhost/image.png",
            "http://127.0.0.1/image.png",
            "http://[::1]/image.png",
            "http://10.0.0.1/image.png",
            "http://172.16.0.1/image.png",
            "http://192.168.1.1/image.png",
            "http://169.254.169.254/latest/meta-data",
            "http://0177.0.0.1/image.png",
            "http://2130706433/image.png",
            "http://0x7f000001/image.png",
            "https://metadata.google.internal/computeMetadata/v1/",
            "https://api/internal",
        )
        for value in rejected:
            with self.subTest(value=value):
                self.assertIsNone(safe_public_url(value))

    def test_requires_exact_allowlisted_media_hostname(self) -> None:
        allowed = {"r2.misa.lol"}
        self.assertEqual(
            safe_public_url("https://r2.misa.lol/profiles/u/avatar.png", allowed_hosts=allowed, https_only=True),
            "https://r2.misa.lol/profiles/u/avatar.png",
        )
        self.assertIsNone(
            safe_public_url("https://r2.misa.lol.attacker.example/avatar.png", allowed_hosts=allowed, https_only=True)
        )
        self.assertIsNone(safe_public_url("http://r2.misa.lol/avatar.png", allowed_hosts=allowed, https_only=True))

    def test_rejects_credentials_and_nonstandard_ports(self) -> None:
        self.assertIsNone(safe_public_url("https://user:pass@example.com/image.png"))
        self.assertIsNone(safe_public_url("https://example.com:8443/image.png"))

    def test_public_profile_links_cannot_target_private_services(self) -> None:
        self.assertIsNone(public_social_href("http://127.0.0.1/admin", "Custom URL"))
        self.assertIsNone(public_social_href("http://169.254.169.254/latest/meta-data", "Custom URL"))
        self.assertEqual(public_social_href("https://example.com/profile", "Custom URL"), "https://example.com/profile")


if __name__ == "__main__":
    unittest.main()
