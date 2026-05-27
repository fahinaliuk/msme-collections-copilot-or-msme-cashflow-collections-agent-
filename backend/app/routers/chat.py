from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from openai import OpenAI

from backend.app.config import settings
from backend.app.routers.auth import get_current_user
from backend.app.models.user import User

router = APIRouter(prefix="/api/chat", tags=["chat"])

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    context: Optional[Dict[str, Any]] = None

class ChatResponse(BaseModel):
    reply: str

@router.post("", response_model=ChatResponse)
async def process_chat(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="OpenAI API key is missing. Chatbot requires OPENAI_API_KEY in environment."
        )

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    
    # Format the dashboard context into a readable string
    context_str = "No specific dashboard data provided."
    if req.context:
        try:
            kpis = req.context.get("kpis", {})
            priorities = req.context.get("top_priorities", [])
            
            context_str = f"Dashboard Overview:\n"
            context_str += f"- Total Receivables: ₹{kpis.get('total_receivables', 0)}\n"
            context_str += f"- Overdue Amount: ₹{kpis.get('overdue_invoices_amount', 0)}\n"
            context_str += f"- Overdue %: {kpis.get('overdue_percentage', 0)}%\n"
            context_str += f"- Total Collected: ₹{kpis.get('collected_amount', 0)}\n\n"
            
            context_str += f"Top High-Risk Accounts:\n"
            for p in priorities[:5]:
                context_str += f"- {p.get('customer_name')}: Owes ₹{p.get('total_outstanding')}, {p.get('max_overdue_days')} days overdue (Risk: {p.get('risk_tier')})\n"
        except Exception:
            context_str = str(req.context)

    # Build system prompt
    system_prompt = f"""
You are the internal AI Assistant for MSME Collections Copilot.
You are helping the business owner ({current_user.full_name}) manage their accounts receivable, cash flow, and collections strategies.

CURRENT DATA CONTEXT:
{context_str}

RULES:
- Be concise, professional, and action-oriented.
- If asked to draft an email or WhatsApp, provide a great template.
- If asked about the data, rely strictly on the CURRENT DATA CONTEXT provided.
- Do NOT make up numbers that aren't in the context.
- Keep your answers formatting clean using markdown.
"""

    messages = [{"role": "system", "content": system_prompt}]
    
    # Add history
    for msg in req.history[-10:]:  # Keep last 10 messages for context window
        messages.append({"role": msg.role, "content": msg.content})
        
    # Add current message
    messages.append({"role": "user", "content": req.message})

    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            temperature=0.7,
            max_tokens=500,
        )
        reply = response.choices[0].message.content
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
