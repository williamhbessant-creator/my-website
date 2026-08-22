from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
import os
from datetime import datetime, timezone
from supabase import create_client
from openai import OpenAI
import hashlib


# ============================================================
# CONFIGURATION
# ============================================================

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_PUBLISHABLE_KEY"]
AI_KEY = os.environ.get("AI_KEY")

AI_MAX_USES = 5


# ============================================================
# CLIENTS
# ============================================================

supabase = create_client(
    SUPABASE_URL,
    SUPABASE_KEY
)

app = Flask(__name__)

app.config["SECRET_KEY"] = os.environ.get(
    "FLASK_SECRET_KEY",
    "development-secret"
)

socketio = SocketIO(
    app,
    cors_allowed_origins="*"
)

openai_client = (
    OpenAI(api_key=AI_KEY)
    if AI_KEY
    else None
)


# ============================================================
# VISITOR IDENTIFICATION
# ============================================================

def ai_user_id():
    """
    Creates a privacy-friendly visitor ID.

    The visitor's IP address is hashed before being used.
    The raw IP address is never stored in Supabase.
    """

    forwarded = request.headers.get(
        "X-Forwarded-For",
        ""
    )

    if forwarded:
        ip = forwarded.split(",")[0].strip()
    else:
        ip = request.remote_addr

    if not ip:
        ip = "unknown"

    return hashlib.sha256(
        ip.encode("utf-8")
    ).hexdigest()


# ============================================================
# SUPABASE AI USAGE
# ============================================================

def get_ai_uses(visitor_id):
    """
    Get the number of AI uses already consumed.
    """

    result = (
        supabase
        .table("ai_usage")
        .select("uses")
        .eq("visitor_id", visitor_id)
        .limit(1)
        .execute()
    )

    if result.data:
        return int(result.data[0]["uses"])

    return 0


def save_ai_uses(visitor_id, uses):
    """
    Permanently save AI usage in Supabase.
    """

    now = datetime.now(timezone.utc).isoformat()

    (
        supabase
        .table("ai_usage")
        .upsert(
            {
                "visitor_id": visitor_id,
                "uses": uses,
                "updated_at": now
            },
            on_conflict="visitor_id"
        )
        .execute()
    )


# ============================================================
# MAIN PAGE
# ============================================================

@app.route("/")
def index():
    return render_template("index.html")


# ============================================================
# AI ASSISTANT
# ============================================================

@app.post("/api/ai")
def ai_assistant():

    # --------------------------------------------------------
    # Check AI key
    # --------------------------------------------------------

    if openai_client is None:
        return jsonify({
            "error": "AI_KEY is not configured on the server."
        }), 500


    # --------------------------------------------------------
    # Identify visitor
    # --------------------------------------------------------

    visitor_id = ai_user_id()


    # --------------------------------------------------------
    # Get permanent usage
    # --------------------------------------------------------

    try:

        used = get_ai_uses(visitor_id)

    except Exception as error:

        print(
            "Supabase usage lookup failed:",
            repr(error)
        )

        return jsonify({
            "error": "Could not check your AI usage."
        }), 500


    remaining = AI_MAX_USES - used


    # --------------------------------------------------------
    # No uses remaining
    # --------------------------------------------------------

    if remaining <= 0:

        return jsonify({
            "error": "You have no AI uses remaining.",
            "uses_remaining": 0
        }), 429


    # --------------------------------------------------------
    # Read request
    # --------------------------------------------------------

    data = request.get_json(
        silent=True
    ) or {}

    message = str(
        data.get("message", "")
    ).strip()

    history = data.get(
        "history",
        []
    )


    # --------------------------------------------------------
    # Validate message
    # --------------------------------------------------------

    if not message:

        return jsonify({
            "error": "Please enter a message."
        }), 400


    if len(message) > 2000:

        return jsonify({
            "error": "Message is too long."
        }), 400


    # --------------------------------------------------------
    # Build conversation
    # --------------------------------------------------------

    conversation = []

    if isinstance(history, list):

        for item in history[-12:]:

            if not isinstance(item, dict):
                continue

            role = item.get("role")

            text = str(
                item.get("content", "")
            ).strip()

            if (
                role in ("user", "assistant")
                and text
            ):

                conversation.append({
                    "role": role,
                    "content": text[:4000]
                })


    conversation.append({
        "role": "user",
        "content": message
    })


    # --------------------------------------------------------
    # Ask OpenAI
    # --------------------------------------------------------

    try:

        response = openai_client.responses.create(

            model="gpt-4.1-mini",

            instructions=(
                "You are the AI assistant inside "
                "Woocorp Public Chat. "
                "Be helpful, concise, friendly, "
                "and clear."
            ),

            input=conversation
        )


        # ----------------------------------------------------
        # Only consume a use AFTER successful response
        # ----------------------------------------------------

        used += 1

        save_ai_uses(
            visitor_id,
            used
        )

        remaining = AI_MAX_USES - used


        # ----------------------------------------------------
        # Return response
        # ----------------------------------------------------

        return jsonify({

            "response":
                response.output_text,

            "uses_remaining":
                remaining

        })


    except Exception as error:

        print(
            "AI request failed:",
            repr(error)
        )

        return jsonify({
            "error":
                "The AI assistant could not "
                "get a response."
        }), 502


# ============================================================
# CHAT HISTORY
# ============================================================

@socketio.on("request_history")
def send_history():

    response = (
        supabase
        .table("messageport5555")
        .select(
            "username, message, timestamp"
        )
        .order("id")
        .limit(500)
        .execute()
    )

    rows = [

        (
            row["username"],
            row["message"],
            row["timestamp"]
        )

        for row in response.data

    ]

    emit(
        "chat_history",
        rows
    )


# ============================================================
# SEND CHAT MESSAGE
# ============================================================

@socketio.on("send_message")
def handle_message(data):

    username = data["username"]
    message = data["message"]

    timestamp = datetime.now().strftime(
        "%H:%M:%S"
    )


    supabase.table(
        "messageport5555"
    ).insert({

        "username":
            username,

        "message":
            message,

        "timestamp":
            timestamp

    }).execute()


    emit(

        "new_message",

        {

            "username":
                username,

            "message":
                message,

            "timestamp":
                timestamp

        },

        broadcast=True

    )


# ============================================================
# CLEAR CHAT
# ============================================================

@socketio.on("clear_history")
def clear_history():

    (
        supabase
        .table("messageport5555")
        .delete()
        .neq("id", 0)
        .execute()
    )

    emit(
        "history_cleared",
        broadcast=True
    )


# ============================================================
# START SERVER
# ============================================================

if __name__ == "__main__":

    print("=" * 45)

    print(
        " Public Chat Server"
    )

    print("=" * 45)

    print(
        "Port: 5555"
    )

    print(
        "Database:",
        SUPABASE_URL
    )

    print(
        "AI:",
        "enabled"
        if AI_KEY
        else
        "disabled - AI_KEY missing"
    )

    print("=" * 45)

    socketio.run(
        app,
        host="0.0.0.0",
        port=5555
    )
