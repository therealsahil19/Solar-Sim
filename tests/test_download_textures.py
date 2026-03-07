import unittest
from unittest.mock import patch
import urllib.error
import ssl
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import download_textures

class TestDownloadTextures(unittest.TestCase):
    @patch('download_textures.urllib.request.urlopen')
    def test_download_texture_timeout(self, mock_urlopen):
        mock_urlopen.side_effect = urllib.error.URLError("Connection timed out")
        
        filename = "test_timeout.jpg"
        remote_info = ("2k_test.jpg", "dummy_hash")
        context = ssl.create_default_context()
        
        result = download_textures.download_texture((filename, remote_info, context))
        self.assertEqual(result, "test_timeout.jpg")

if __name__ == '__main__':
    unittest.main()
