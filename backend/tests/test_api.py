from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    """Test that the API health check endpoint returns healthy"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_chat_sessions_unauthorized():
    """Test that accessing chat sessions without a token returns 401 Unauthorized or 403 Forbidden"""
    response = client.get("/api/chat/sessions")
    # Depends on how Supabase auth is mocked/handled, but without a header it should be unauthorized
    assert response.status_code in [401, 403]
