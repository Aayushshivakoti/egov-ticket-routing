import asyncio
import json
import os
from fastapi import WebSocket
from typing import List
import redis.asyncio as aioredis

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WebSocket client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"WebSocket client disconnected. Total remaining: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"Failed to transmit WebSocket message, disconnecting client: {e}")
                self.disconnect(connection)

manager = ConnectionManager()

async def redis_listener():
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    print(f"Initializing Redis subscription listener task on channel 'ticket_updates' (broker: {redis_url})")
    
    while True:
        try:
            r = aioredis.from_url(redis_url)
            pubsub = r.pubsub()
            await pubsub.subscribe("ticket_updates")
            print("Successfully subscribed to Redis Pub/Sub channel 'ticket_updates'")
            
            async for message in pubsub.listen():
                if message and message["type"] == "message":
                    payload = message["data"]
                    # If bytes, decode
                    if isinstance(payload, bytes):
                        payload = payload.decode("utf-8")
                    
                    print(f"Broadcasting Redis pub/sub event to WebSockets: {payload}")
                    await manager.broadcast(payload)
                    
        except asyncio.CancelledError:
            print("Redis subscription listener task cancelled.")
            break
        except Exception as e:
            print(f"Redis pub/sub listener connection lost: {e}. Retrying in 5 seconds...")
            await asyncio.sleep(5)
