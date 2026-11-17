"""Mocked local gateway checks; no listening socket or external request is used."""
import unittest

import httpx

from scripts.server import api_gateway as gateway


class GatewayLifespanTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.requests = []

        def respond(request):
            self.requests.append(request)
            return httpx.Response(200, text='fixture')

        self.upstream = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        gateway._client = self.upstream
        self.context = gateway.app.router.lifespan_context(gateway.app)
        await self.context.__aenter__()
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=gateway.app), base_url='http://testserver'
        )

    async def asyncTearDown(self):
        await self.client.aclose()
        await self.context.__aexit__(None, None, None)
        self.assertTrue(self.upstream.is_closed)
        self.assertIsNone(gateway._client)

    async def test_fetch_and_proxy_use_mock_transport(self):
        fetch = await self.client.post('/api/gw/fetch', json={'url': 'https://example.test/test'})
        proxy = await self.client.get('/api/gw/proxy', params={'url': 'https://example.test/test'})
        self.assertEqual((fetch.status_code, proxy.status_code), (200, 200))
        self.assertEqual((fetch.text, proxy.text), ('fixture', 'fixture'))
        self.assertEqual(len(self.requests), 2)

    async def test_non_http_protocols_are_rejected_before_request(self):
        fetch = await self.client.post('/api/gw/fetch', json={'url': 'file:///private'})
        proxy = await self.client.get('/api/gw/proxy', params={'url': 'file:///private'})
        self.assertEqual((fetch.status_code, proxy.status_code), (400, 400))
        self.assertEqual(self.requests, [])
