from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Optional
import asyncio
from google import genai
from google.genai import types
from app.api.dependencies import get_gemini_service
from app.api.auth_deps import get_current_user
from app.services.gemini_service import GeminiService
from app.services.memory_service import MemoryService
from app.core.config import settings

router = APIRouter()
memory_service = MemoryService()

@router.websocket("/live")
async def live_chat_websocket(websocket: WebSocket):
    await websocket.accept()
    client = genai.Client(api_key=settings.gemini_api_key)
    
    try:
        async with client.aio.live.connect(model="gemini-3.1-flash-live-preview", config={"system_instruction": {"parts": [{"text": "You are DuoMind, a conversational voice assistant. Be extremely concise and natural."}]}}) as session:
            
            async def receive_from_browser():
                try:
                    while True:
                        data = await websocket.receive_bytes()
                        # Forward audio blobs to Gemini (defaults to expecting PCM or WebM)
                        await session.send(input={"data": data, "mime_type": "audio/webm"})
                except WebSocketDisconnect:
                    pass

            async def receive_from_gemini():
                async for response in session.receive():
                    server_content = response.server_content
                    if server_content is not None:
                        model_turn = server_content.model_turn
                        if model_turn is not None:
                            for part in model_turn.parts:
                                if part.inline_data and part.inline_data.data:
                                    # Forward binary audio frames back to the browser
                                    await websocket.send_bytes(part.inline_data.data)
            
            await asyncio.gather(receive_from_browser(), receive_from_gemini())
    except Exception as e:
        print("WebSocket Live Error:", e)
        try:
            await websocket.close()
        except:
            pass

class ChatFile(BaseModel):
    mime_type: str
    data: str

class ChatRequest(BaseModel):
    session_id: str
    prompt: str
    files: Optional[List[ChatFile]] = None

class SessionRenameRequest(BaseModel):
    title: str

@router.get("/sessions")
async def get_chat_sessions(current_user = Depends(get_current_user)):
    try:
        sessions = memory_service.get_sessions(current_user.id)
        return {"sessions": sessions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str, current_user = Depends(get_current_user)):
    try:
        messages = memory_service.get_messages(session_id)
        return {"messages": messages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, current_user = Depends(get_current_user)):
    try:
        memory_service.delete_session(session_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/sessions/{session_id}")
async def rename_session(session_id: str, request: SessionRenameRequest, current_user = Depends(get_current_user)):
    try:
        if not request.title:
            raise HTTPException(status_code=400, detail="Title is required")
        memory_service.update_session_title(session_id, request.title)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/online")
async def chat_online(
    request: ChatRequest, 
    gemini_service: GeminiService = Depends(get_gemini_service),
    current_user = Depends(get_current_user)
):
    if not request.prompt or not request.session_id:
        raise HTTPException(status_code=400, detail="Prompt and session_id are required")
    try:
        def stream_generator():
            # Generate title if new session
            title = request.prompt[:30] + "..." if len(request.prompt) > 30 else request.prompt
            memory_service.upsert_session(request.session_id, current_user.id, title)
            
            # Save user prompt (we only save text to memory for now to save DB space)
            memory_service.add_message(request.session_id, "user", request.prompt)
            
            # Fetch history to feed into Gemini
            history = memory_service.get_messages(request.session_id)
            # Remove the last message (the one we just added) so we don't duplicate it in the prompt parameter
            if history and history[-1]["role"] == "user" and history[-1]["content"] == request.prompt:
                history = history[:-1]
                
            bot_full_response = ""
            
            for chunk in gemini_service.generate_response_stream(request.prompt, history, request.files):
                bot_full_response += chunk
                yield chunk
                
            if bot_full_response:
                memory_service.add_message(request.session_id, "bot", bot_full_response)
                
        return StreamingResponse(stream_generator(), media_type="text/plain")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))