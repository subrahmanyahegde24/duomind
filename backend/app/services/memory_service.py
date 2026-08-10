import os
import logging
import base64
import lzma
from typing import List, Dict
from cryptography.fernet import Fernet
from pymongo import MongoClient
from app.core.config import settings
from datetime import datetime

logger = logging.getLogger(__name__)
KEY_FILE = "/tmp/encryption.key"

def get_encryption_key():
    if settings.encryption_key:
        return settings.encryption_key.encode("utf-8")
        
    if os.path.exists(KEY_FILE):
        with open(KEY_FILE, "rb") as f:
            return f.read()
    else:
        key = Fernet.generate_key()
        with open(KEY_FILE, "wb") as f:
            f.write(key)
        return key

FERNET = Fernet(get_encryption_key())

def compress_encrypt(text: str) -> str:
    # 1. Compress string bytes using lzma (highest built-in compression ratio)
    compressed = lzma.compress(text.encode("utf-8"))
    # 2. Encrypt the compressed bytes using AES-128-CBC (Fernet)
    encrypted = FERNET.encrypt(compressed)
    # 3. Fernet already returns url-safe base64 bytes, just decode to string
    return encrypted.decode("utf-8")

def decrypt_decompress(data: str) -> str:
    try:
        # Handle the previous double-base64 bug gracefully
        if data.startswith("Z0FBQUFB"):
            decoded = base64.urlsafe_b64decode(data.encode("utf-8"))
            decrypted = FERNET.decrypt(decoded)
            decompressed = lzma.decompress(decrypted)
            return decompressed.decode("utf-8")
            
        if not data.startswith("gAAAAA"): 
            return data
                
        decrypted = FERNET.decrypt(data.encode("utf-8"))
        decompressed = lzma.decompress(decrypted)
        return decompressed.decode("utf-8")
    except Exception as e:
        logger.error(f"Failed to decrypt message: {e}")
        return data

class MemoryService:
    def __init__(self):
        try:
            self.client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=5000)
            self.db = self.client["duomind"]
            self.sessions = self.db["chat_sessions"]
            self.messages = self.db["chat_messages"]
            
            # Create indexes
            self.sessions.create_index("user_id")
            self.messages.create_index("session_id")
            
        except Exception as e:
            logger.error(f"Failed to initialize MongoDB: {e}")

    def upsert_session(self, session_id: str, user_id: str, title: str):
        try:
            self.sessions.update_one(
                {"_id": session_id},
                {"$set": {"user_id": user_id, "title": title, "updated_at": datetime.utcnow()}},
                upsert=True
            )
        except Exception as e:
            logger.error(f"Failed to upsert session: {e}")

    def update_session_title(self, session_id: str, title: str):
        try:
            self.sessions.update_one(
                {"_id": session_id},
                {"$set": {"title": title, "updated_at": datetime.utcnow()}}
            )
        except Exception as e:
            logger.error(f"Failed to update session title: {e}")

    def delete_session(self, session_id: str):
        try:
            self.sessions.delete_one({"_id": session_id})
            self.messages.delete_many({"session_id": session_id})
        except Exception as e:
            logger.error(f"Failed to delete session: {e}")

    def get_sessions(self, user_id: str) -> List[Dict[str, str]]:
        try:
            cursor = self.sessions.find({"user_id": user_id}).sort("updated_at", -1)
            return [{"id": doc["_id"], "title": doc["title"], "updated_at": str(doc.get("updated_at", ""))} for doc in cursor]
        except Exception as e:
            logger.error(f"Failed to get sessions: {e}")
            return []

    def add_message(self, session_id: str, role: str, content: str):
        try:
            encrypted_content = compress_encrypt(content)
            
            self.messages.insert_one({
                "session_id": session_id,
                "role": role,
                "message": encrypted_content,
                "timestamp": datetime.utcnow()
            })
            
            self.sessions.update_one(
                {"_id": session_id},
                {"$set": {"updated_at": datetime.utcnow()}}
            )
        except Exception as e:
            logger.error(f"Failed to save message to MongoDB: {e}")

    def get_messages(self, session_id: str) -> List[Dict[str, str]]:
        try:
            cursor = self.messages.find({"session_id": session_id}).sort("timestamp", 1)
            return [{"role": doc["role"], "content": decrypt_decompress(doc["message"])} for doc in cursor]
        except Exception as e:
            logger.error(f"Failed to fetch messages: {e}")
            return []
