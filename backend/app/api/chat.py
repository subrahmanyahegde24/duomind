from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Optional
import asyncio
from google import genai
from google.genai import types
from app.api.dependencies import get_gemini_service
from app.api.auth_deps import get_current_user, get_supabase
from app.services.gemini_service import GeminiService
from app.services.memory_service import MemoryService
from app.core.config import settings

router = APIRouter()
memory_service = MemoryService()

import websockets
import json
import base64

@router.websocket("/live/{session_id}")
async def live_chat_websocket(websocket: WebSocket, session_id: str, token: str = None):
    if not token:
        await websocket.close()
        return
    supabase = get_supabase()
    user_response = supabase.auth.get_user(token)
    if not user_response or not user_response.user:
        await websocket.close()
        return
    user_id = user_response.user.id

    await websocket.accept()
    
    ws_url = f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={settings.gemini_api_key}"
    
    try:
        async with websockets.connect(ws_url) as google_ws:
            # 1. Send the initial configuration
            setup_message = {
                "setup": {
                    "model": "models/gemini-3.1-flash-live-preview",
                    "generationConfig": {
                        "responseModalities": ["AUDIO"]
                    },
                    "systemInstruction": {
                        "parts": [{"text": "You are DuoMind, a conversational voice assistant. Be extremely concise and natural."}]
                    }
                }
            }
            await google_ws.send(json.dumps(setup_message))
            
            async def receive_from_browser():
                try:
                    while True:
                        # Receive WebM chunks from browser
                        data = await websocket.receive_bytes()
                        # Send as realtimeInput to Google
                        realtime_input = {
                            "realtimeInput": {
                                "audio": {
                                    "mimeType": "audio/pcm;rate=16000",
                                    "data": base64.b64encode(data).decode('utf-8')
                                }
                            }
                        }
                        await google_ws.send(json.dumps(realtime_input))
                except WebSocketDisconnect:
                    pass

            async def receive_from_gemini():
                ai_text_buffer = ""
                async for response_str in google_ws:
                    try:
                        response_json = json.loads(response_str)
                        server_content = response_json.get("serverContent", {})
                        model_turn = server_content.get("modelTurn", {})
                        parts = model_turn.get("parts", [])
                        turn_complete = server_content.get("turnComplete", False)
                        
                        text_response = ""
                        for part in parts:
                            if "text" in part:
                                text_response += part["text"]
                            inline_data = part.get("inlineData")
                            if inline_data and inline_data.get("data"):
                                # Decode the base64 audio and send binary to browser
                                audio_bytes = base64.b64decode(inline_data["data"])
                                await websocket.send_bytes(audio_bytes)
                                
                        if text_response:
                            ai_text_buffer += text_response
                            await websocket.send_text(json.dumps({"type": "text", "content": text_response}))
                            
                        if turn_complete and ai_text_buffer:
                            # Save full response to DB
                            memory_service.add_message(session_id, user_id, "model", ai_text_buffer, [])
                            ai_text_buffer = ""
                    except Exception as e:
                        pass
            
            await asyncio.gather(receive_from_browser(), receive_from_gemini())
    except Exception as e:
        import traceback
        traceback.print_exc()
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